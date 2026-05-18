const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  body: { type: String, required: true },
  targetAudience: {
    type: String,
    enum: ['All', 'Student', 'Supervisor', 'Coordinator'],
    default: 'All',
    index: true,
  },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isPosted: { type: Boolean, default: true },
  attachments: [{ name: String, url: String }],
  isDeleted: { type: Boolean, default: false, index: true },
  expiresAt: { 
    type: Date, 
    default: () => new Date(+new Date() + 14 * 24 * 60 * 60 * 1000) 
  }
}, { timestamps: true });

announcementSchema.index({ author: 1, createdAt: -1 });
announcementSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

announcementSchema.query.notDeleted = function () {
  return this.where({ isDeleted: false });
};

announcementSchema.methods.softDelete = function () {
  this.isDeleted = true;
  return this.save();
};

module.exports = mongoose.model('Announcement', announcementSchema);