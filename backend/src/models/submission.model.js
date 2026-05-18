const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  phase: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectStage', required: true, index: true },
  academicSession: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
  weeklyTask: {
    weekNumber: { type: Number, min: 1 },
    taskTitle: { type: String, trim: true },
  },
  submissionType: { 
    type: String, 
    required: true,
    enum: ['DOCUMENT', 'CODE_REPO', 'AI_NOTEBOOK', 'VIDEO', 'DESIGN_FILE', 'OTHER']
  }, 
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  links: { 
    repo: String,
    notebook: String,
    video: String,
    liveDemo: String,
    doc: String,
    design: String,
    other: String
  },
  attachments: [{
    name: String,
    url: String,
    size: Number,
    publicId: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  status: { 
    type: String, 
    enum: ['Draft', 'Submitted', 'Under Review', 'Graded', 'Rejected', 'Approved', 'Resubmission Required'], 
    default: 'Draft',
    index: true
  },
  evaluation: {
    supervisor: {
      evaluator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      marks: { type: Number, min: 0, default: 0 },
      maxMarks: { type: Number, default: 0 },
      rubric: [{
        criterion: { type: String },
        marksObtained: { type: Number, min: 0, default: 0 },
        maxMarks: { type: Number, default: 0 },
        feedback: { type: String, trim: true }
      }],
      remarks: { type: String, trim: true },
      strengths: { type: String, trim: true },
      areasForImprovement: { type: String, trim: true },
      gradedAt: { type: Date },
      status: { 
        type: String, 
        enum: ['Pending', 'Graded', 'Locked'], 
        default: 'Pending' 
      },
    },
    coordinator: {
      evaluator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      marks: { type: Number, min: 0, default: 0 },
      maxMarks: { type: Number, default: 0 },
      rubric: [{
        criterion: { type: String },
        marksObtained: { type: Number, min: 0, default: 0 },
        maxMarks: { type: Number, default: 0 },
        feedback: { type: String, trim: true }
      }],
      remarks: { type: String, trim: true },
      strengths: { type: String, trim: true },
      areasForImprovement: { type: String, trim: true },
      gradedAt: { type: Date },
      status: { 
        type: String, 
        enum: ['Pending', 'Graded', 'Locked'], 
        default: 'Pending' 
      },
    },
    totalMarks: { type: Number, default: 0 },
    totalMaxMarks: { type: Number, default: 0 },
  },
  integrity: {
    plagiarismScore: { type: Number, default: 0, min: 0, max: 100 },
    status: { 
      type: String, 
      enum: ['Pending', 'Processing', 'Completed', 'Error', 'Flagged', 'Cleared'], 
      default: 'Pending' 
    },
    scanId: { type: String, unique: true, sparse: true }, 
    reportUrl: { type: String }, 
    checkedAt: { type: Date },
    errorDetails: { type: String } 
  },
  version: { type: Number, default: 1 },
  parentSubmission: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission' },
  submittedAt: { type: Date },
  isDeleted: { type: Boolean, default: false, index: true }
}, { timestamps: true });

submissionSchema.index({ project: 1, phase: 1 });
submissionSchema.index({ group: 1, phase: 1 });
submissionSchema.index({ 'weeklyTask.weekNumber': 1 });
submissionSchema.index({ submittedBy: 1, createdAt: -1 });
submissionSchema.index({ 'evaluation.supervisor.evaluator': 1 });
submissionSchema.index({ 'evaluation.coordinator.evaluator': 1 });

submissionSchema.query.notDeleted = function () {
  return this.where({ isDeleted: false });
};

submissionSchema.methods.softDelete = function () {
  this.isDeleted = true;
  return this.save();
};

submissionSchema.pre('save', async function () {
  const Group = mongoose.model('Group');
  const group = await Group.findOne({ _id: this.group, isDeleted: false });
  if (!group) {
    throw new Error('Invalid group reference');
  }

  const isGroupMember = group.members.some(m => m.toString() === this.submittedBy.toString());
  if (!isGroupMember) {
    throw new Error('Submitter must be a member of the group');
  }

  const ProjectStage = mongoose.model('ProjectStage');
  const phase = await ProjectStage.findOne({ _id: this.phase, isDeleted: false, isActive: true });
  if (!phase) {
    throw new Error('Invalid or inactive phase reference');
  }

  if (this.isModified('status') && this.status === 'Submitted' && !this.submittedAt) {
    this.submittedAt = new Date();
  }

  if (this.evaluation?.supervisor?.rubric && this.evaluation.supervisor.rubric.length > 0) {
    this.evaluation.supervisor.marks = this.evaluation.supervisor.rubric.reduce((sum, item) => sum + (item.marksObtained || 0), 0);
    this.evaluation.supervisor.maxMarks = this.evaluation.supervisor.rubric.reduce((sum, item) => sum + (item.maxMarks || 0), 0);
  }
  
  if (this.evaluation?.coordinator?.rubric && this.evaluation.coordinator.rubric.length > 0) {
    this.evaluation.coordinator.marks = this.evaluation.coordinator.rubric.reduce((sum, item) => sum + (item.marksObtained || 0), 0);
    this.evaluation.coordinator.maxMarks = this.evaluation.coordinator.rubric.reduce((sum, item) => sum + (item.maxMarks || 0), 0);
  }
});

module.exports = mongoose.model('Submission', submissionSchema);