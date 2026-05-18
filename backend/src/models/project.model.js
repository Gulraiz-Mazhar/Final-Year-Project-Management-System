const mongoose = require('mongoose');

const normalizeTitle = (title) => title.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

const projectSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, unique: true, index: true },
  title: { type: String, required: true, trim: true },
  titleNormalized: { type: String, index: true },
  description: { type: String, trim: true },
  category: { type: String, required: true, index: true },
  techStack: { type: [String], default: [] },
  currentStage: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectStage', required: true, index: true },
  isIdeaApproved: { type: Boolean, default: false },
  year: { type: Number, required: true, index: true },
  officialOutputs: [{
    name: String,
    url: String,
    type: String,
    uploadedAt: { type: Date, default: Date.now },
    providedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }],
  status: { 
    type: String, 
    enum: ['Pending', 'Approved', 'Rejected', 'Changes Requested', 'In Progress', 'Completed'], 
    default: 'Pending',
    index: true
  },
  remarks: { type: String, trim: true },
  visibility: { type: String, enum: ['Internal', 'Public'], default: 'Internal' },
  evaluationStatus: { 
    type: String, 
    enum: ['Not Started', 'In Progress', 'Supervisor Graded', 'Coordinator Graded', 'Graded', 'Locked'], 
    default: 'Not Started',
    index: true
  },
  finalEvaluation: { type: mongoose.Schema.Types.ObjectId, ref: 'FinalEvaluation' },
  evaluationSummary: {
    supervisorMarks: { type: Number, default: 0 },
    coordinatorMarks: { type: Number, default: 0 },
    graceMarks: { type: Number, default: 0 },
    totalMarks: { type: Number, default: 0 },
    maxMarks: { type: Number, default: 100 },
    finalGrade: { type: String },
    lastUpdated: { type: Date },
  },
  isDeleted: { type: Boolean, default: false, index: true },
  embedding: { type: [Number], select: false },
}, { timestamps: true });

projectSchema.index({ group: 1, year: 1 });
projectSchema.index({ currentStage: 1, status: 1 });

projectSchema.query.notDeleted = function () {
  return this.where({ isDeleted: false });
};

projectSchema.methods.softDelete = async function () {
  this.isDeleted = true;
  await this.save();
};

projectSchema.statics.findByYear = function (year) {
  return this.find({ year, isDeleted: false }).sort({ title: 1 });
};

projectSchema.pre('save', async function () {
  if (this.isModified('title')) {
    this.titleNormalized = normalizeTitle(this.title);
  }

  const Group = mongoose.model('Group');
  const group = await Group.findOne({ _id: this.group, isDeleted: false });
  if (!group) {
    throw new Error('Invalid group reference');
  }

  if (this.currentStage) {
    const ProjectStage = mongoose.model('ProjectStage');
    const stage = await ProjectStage.findOne({ _id: this.currentStage, isDeleted: false });
    if (!stage) {
      throw new Error('Invalid stage reference');
    }
  }
});

module.exports = mongoose.model('Project', projectSchema);