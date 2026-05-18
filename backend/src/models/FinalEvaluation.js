const mongoose = require('mongoose');

const finalEvaluationSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
  academicSession: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
  evaluationType: { 
    type: String, 
    enum: ['Mid-Semester', 'Final', 'Re-Evaluation', 'Viva'], 
    required: true,
    index: true
  },
  weightDistribution: {
    weeklyTasks: { type: Number, default: 70, min: 0, max: 100 },
    finalComponent: { type: Number, default: 30, min: 0, max: 100 },
  },
  supervisorEvaluation: {
    evaluator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    marks: { type: Number, min: 0, default: 0 },
    maxMarks: { type: Number, default: 0 },
    breakdown: {
      technicalImplementation: { type: Number, min: 0 },
      innovation: { type: Number, min: 0 },
      documentation: { type: Number, min: 0 },
      presentation: { type: Number, min: 0 },
      overallQuality: { type: Number, min: 0 },
    },
    remarks: { type: String, trim: true },
    strengths: { type: String, trim: true },
    weaknesses: { type: String, trim: true },
    submittedAt: { type: Date },
    status: { 
      type: String, 
      enum: ['Pending', 'Submitted', 'Locked'], 
      default: 'Pending' 
    },
  },
  coordinatorEvaluation: {
    evaluator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    marks: { type: Number, min: 0, default: 0 },
    maxMarks: { type: Number, default: 0 },
    breakdown: {
      projectScope: { type: Number, min: 0 },
      technicalDepth: { type: Number, min: 0 },
      innovation: { type: Number, min: 0 },
      presentation: { type: Number, min: 0 },
      vivaPerformance: { type: Number, min: 0 },
    },
    remarks: { type: String, trim: true },
    strengths: { type: String, trim: true },
    weaknesses: { type: String, trim: true },
    submittedAt: { type: Date },
    status: { 
      type: String, 
      enum: ['Pending', 'Submitted', 'Locked'], 
      default: 'Pending' 
    },
  },
  graceMarksFromMeetings: { type: Number, default: 0, min: 0 },
  totalMarksObtained: { type: Number, default: 0 },
  totalMaxMarks: { type: Number, default: 100 },
  percentage: { type: Number, default: 0 },
  finalGrade: { type: String },
  history: [{
    action: { type: String, required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    timestamp: { type: Date, default: Date.now },
    field: { type: String },
    oldValue: { type: mongoose.Schema.Types.Mixed },
    newValue: { type: mongoose.Schema.Types.Mixed },
    reason: { type: String },
  }],
  isLocked: { type: Boolean, default: false, index: true },
  lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lockedAt: { type: Date },
  vivaDetails: {
    date: { type: Date },
    duration: { type: Number },
    panelMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    vivaRemarks: { type: String },
  },
  isDeleted: { type: Boolean, default: false, index: true },
}, { timestamps: true });

finalEvaluationSchema.index({ project: 1, evaluationType: 1 }, { unique: true });
finalEvaluationSchema.index({ group: 1, evaluationType: 1 });

finalEvaluationSchema.query.notDeleted = function () {
  return this.where({ isDeleted: false });
};

finalEvaluationSchema.methods.softDelete = function () {
  this.isDeleted = true;
  return this.save();
};

finalEvaluationSchema.methods.addHistory = function (action, performedBy, field, oldValue, newValue, reason) {
  this.history.push({
    action,
    performedBy,
    field,
    oldValue,
    newValue,
    reason,
    timestamp: new Date()
  });
};

finalEvaluationSchema.pre('save', async function () {
  const weightSum = (this.weightDistribution?.weeklyTasks || 0) + (this.weightDistribution?.finalComponent || 0);
  if (weightSum !== 100) {
    throw new Error('weightDistribution.weeklyTasks + weightDistribution.finalComponent must equal 100');
  }
  
  const supMarks = this.supervisorEvaluation?.marks || 0;
  const coordMarks = this.coordinatorEvaluation?.marks || 0;
  const graceMarks = this.graceMarksFromMeetings || 0;
  this.totalMarksObtained = supMarks + coordMarks + graceMarks;

  if (this.totalMaxMarks > 0) {
    this.percentage = parseFloat(((this.totalMarksObtained / this.totalMaxMarks) * 100).toFixed(2));
  }

  if (this.percentage >= 90) this.finalGrade = 'A+';
  else if (this.percentage >= 85) this.finalGrade = 'A';
  else if (this.percentage >= 80) this.finalGrade = 'A-';
  else if (this.percentage >= 75) this.finalGrade = 'B+';
  else if (this.percentage >= 70) this.finalGrade = 'B';
  else if (this.percentage >= 65) this.finalGrade = 'B-';
  else if (this.percentage >= 60) this.finalGrade = 'C+';
  else if (this.percentage >= 55) this.finalGrade = 'C';
  else if (this.percentage >= 50) this.finalGrade = 'C-';
  else this.finalGrade = 'F';

  if (this.isLocked && !this.isNew) {
    throw new Error('Cannot modify locked evaluation');
  }
});

module.exports = mongoose.model('FinalEvaluation', finalEvaluationSchema);