const mongoose = require('mongoose');

const weeklyTaskSchema = new mongoose.Schema({
  weekNumber: { type: Number, required: true, min: 1 },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  maxMarks: { type: Number, default: 0, min: 0 },
  evaluationSplit: {
    supervisor: { type: Number, default: 40, min: 0, max: 100 },
    coordinator: { type: Number, default: 60, min: 0, max: 100 },
  },
  deadline: { type: Date },
  allowedSubmissionTypes: {
    type: [String],
    enum: ['DOCUMENT', 'CODE_REPO', 'AI_NOTEBOOK', 'VIDEO', 'DESIGN_FILE', 'OTHER'],
    default: ['DOCUMENT'],
  },
  isMandatory: { type: Boolean, default: true },
}, { _id: false });

const projectStageSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  order: { type: Number, required: true, index: true },
  isActive: { type: Boolean, default: true, index: true },
  description: { type: String, trim: true },
  componentType: { 
    type: String, 
    enum: ['WEEKLY_PROGRESS', 'FINAL_DELIVERABLE'], 
    default: 'WEEKLY_PROGRESS',
    required: true
  },
  totalMarks: { type: Number, default: 0 },
  evaluationSplit: {
    supervisor: { type: Number, default: 40, min: 0, max: 100 },
    coordinator: { type: Number, default: 60, min: 0, max: 100 },
  },
  allowedSubmissionTypes: {
    type: [String],
    enum: ['DOCUMENT', 'CODE_REPO', 'AI_NOTEBOOK', 'VIDEO', 'DESIGN_FILE', 'OTHER'],
    default: ['DOCUMENT'],
  },
  weeklyTasks: { type: [weeklyTaskSchema], default: [] },
  isDeleted: { type: Boolean, default: false, index: true },
}, { timestamps: true });

projectStageSchema.query.notDeleted = function () {
  return this.where({ isDeleted: false });
};

projectStageSchema.methods.softDelete = function () {
  this.isDeleted = true;
  return this.save();
};

projectStageSchema.pre('save', async function () {  
  const s = (this.evaluationSplit?.supervisor || 0) + (this.evaluationSplit?.coordinator || 0);  
  if (s !== 100) {  
    throw new Error('evaluationSplit.supervisor + evaluationSplit.coordinator must equal 100');  
  }
  
  if (this.allowedSubmissionTypes.length === 0) {  
    throw new Error('At least one allowedSubmissionType required');  
  }
  
  if (this.weeklyTasks && this.weeklyTasks.length > 0) {
    for (let i = 0; i < this.weeklyTasks.length; i++) {
      const task = this.weeklyTasks[i];
      const taskSplit = (task.evaluationSplit?.supervisor || 0) + (task.evaluationSplit?.coordinator || 0);
      if (taskSplit !== 100) {
        throw new Error(`Weekly task ${i + 1}: evaluationSplit must sum to 100`);
      }
      if (!task.allowedSubmissionTypes || task.allowedSubmissionTypes.length === 0) {
        throw new Error(`Weekly task ${i + 1}: At least one allowedSubmissionType required`);
      }
    }
  }
});  

module.exports = mongoose.model('ProjectStage', projectStageSchema);