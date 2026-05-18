const mongoose = require('mongoose');

const projectArchiveSchema = new mongoose.Schema({
  projectRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  snapshot: { type: mongoose.Schema.Types.Mixed },
  year: { type: Number, index: true },
  archivedAt: { type: Date, default: Date.now },
  isDeleted: { type: Boolean, default: false, index: true },
}, { timestamps: true });

projectArchiveSchema.index({ projectRef: 1, year: 1 }, { unique: true });

projectArchiveSchema.query.notDeleted = function () {
  return this.where({ isDeleted: false });
};

projectArchiveSchema.methods.softDelete = function () {
  this.isDeleted = true;
  return this.save();
};

module.exports = mongoose.model('ProjectArchive', projectArchiveSchema);