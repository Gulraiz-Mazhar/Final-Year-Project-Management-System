const mongoose = require('mongoose');

const submissionSummarySchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  phase: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectStage', required: true },
  department: { type: String, index: true },
  batch: { type: String, index: true },
  totalSubmissions: { type: Number, default: 0 },
  approvedCount: { type: Number, default: 0 },
  rejectedCount: { type: Number, default: 0 },
  averageMarks: { type: Number, default: 0 },
  plagiarismAverage: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
  isDeleted: { type: Boolean, default: false, index: true },
}, { timestamps: true });

submissionSummarySchema.index({ project: 1, phase: 1 }, { unique: true });

submissionSummarySchema.query.notDeleted = function () {
  return this.where({ isDeleted: false });
};

submissionSummarySchema.methods.softDelete = function () {
  this.isDeleted = true;
  return this.save();
};

module.exports = mongoose.model('SubmissionSummary', submissionSummarySchema);