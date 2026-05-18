const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['INFO', 'SUCCESS', 'WARNING', 'ERROR'], default: 'INFO' },
  title: { type: String, required: true },
  message: { type: String, required: true },
  relatedLink: { type: String },
  isRead: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false, index: true },
}, { timestamps: true });

notificationSchema.index({ recipient: 1, createdAt: -1 });

notificationSchema.pre('save', async function () {  
  const userExists = await mongoose.model('User').exists({ _id: this.recipient });  
  if (!userExists) throw new Error('Invalid recipient');  
});  

notificationSchema.query.notDeleted = function () {
  return this.where({ isDeleted: false });
};

notificationSchema.methods.softDelete = function () {
  this.isDeleted = true; 
  return this.save();
};

module.exports = mongoose.model('Notification', notificationSchema);