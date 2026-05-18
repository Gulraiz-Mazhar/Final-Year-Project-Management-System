const mongoose = require('mongoose');

const phaseSchema = new mongoose.Schema({
  stage: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectStage', required: true },
  startDate: { type: Date, required: true },
  deadline: { type: Date, required: true },
  isSubmissionOpen: { type: Boolean, default: true },
}, { _id: false });

const sessionSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, index: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isCurrent: { type: Boolean, default: false, index: true },
  config: {
    maxGroupSize: { type: Number, default: 4, min: 2 },
    gradingSystem: { type: String, enum: ['LETTER_GRADE', 'GPA'], default: 'LETTER_GRADE' },
    gradingAuthority: { type: String, enum: ['HYBRID', 'SUPERVISOR_ONLY', 'COORDINATOR_ONLY'], default: 'HYBRID' },
    isSupervisorGradingEnabled: { type: Boolean, default: true }, 
    doMeetingsAffectGraceMarks: { type: Boolean, default: true },
    defaultEvaluationSplit: {
      supervisor: { type: Number, default: 40, min: 0, max: 100 },
      coordinator: { type: Number, default: 60, min: 0, max: 100 },
    },
    maxGraceMarksPerMeeting: { type: Number, default: 5 },
    maxTotalGraceMarks: { type: Number, default: 20 },
    gradeLockingAuthority: { 
      type: String, 
      enum: ['Coordinator', 'Both'],
      default: 'Coordinator' 
    },
  },
  timeline: { type: [phaseSchema], default: [] },
  isDeleted: { type: Boolean, default: false, index: true },
}, { timestamps: true });

sessionSchema.query.notDeleted = function () {
  return this.where({ isDeleted: false });
};

sessionSchema.methods.softDelete = function () {
  this.isDeleted = true;
  return this.save();
};

sessionSchema.pre('save', async function () {  
  if (this.isCurrent) {  
    await mongoose.model('AcademicSession').updateMany(  
      { _id: { $ne: this._id } },  
      { $set: { isCurrent: false } }  
    );
  }
  
  if (this.startDate && this.endDate && this.endDate <= this.startDate) {
    throw new Error('Session end date must be after start date');
  }
  
  const splitSum = (this.config?.defaultEvaluationSplit?.supervisor || 0) + (this.config?.defaultEvaluationSplit?.coordinator || 0);
  if (splitSum !== 100) {
    throw new Error('defaultEvaluationSplit must sum to 100');
  }
  
  if (this.timeline && this.timeline.length > 0) {  
    for (let i = 0; i < this.timeline.length; i++) {
      const phase = this.timeline[i];
      if (!phase.startDate || !phase.deadline) {
        throw new Error(`Phase ${i + 1}: Both start date and deadline are required`);
      }
      
      const start = new Date(phase.startDate);
      const end = new Date(phase.deadline);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error(`Phase ${i + 1}: Invalid date format`);
      }
      
      if (end <= start) {
        throw new Error(`Phase ${i + 1}: Deadline must be after start date`);
      }
    }
  }  
}); 

sessionSchema.pre('save', async function(next) {
  if (this.isModified('isCurrent') && this.isCurrent === true) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id } }, 
      { $set: { isCurrent: false } }
    );
  }
});

module.exports = mongoose.model('AcademicSession', sessionSchema);