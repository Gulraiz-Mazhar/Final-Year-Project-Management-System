const mongoose = require('mongoose');
const crypto = require('crypto');

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  batch: { type: String, trim: true, index: true },
  joinCode: { type: String, unique: true, index: true },
  leader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  supervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
  assignedAt: { type: Date },
  academicSession: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', index: true },
  links: {
    repo: { type: String, trim: true },
    liveDemo: { type: String, trim: true },
  },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending', index: true },
  isApproved: { type: Boolean, default: false },
  isLocked: { type: Boolean, default: false },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  isDeleted: { type: Boolean, default: false, index: true },
}, { timestamps: true, versionKey: 'version' });

groupSchema.index({ supervisor: 1, status: 1 });

groupSchema.pre('save', async function () {
  if (this.isNew && !this.joinCode) {
    this.joinCode = crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  const leaderId = this.leader?.toString();
  if (leaderId && !this.members.some(m => m.toString() === leaderId)) {
    this.members.push(this.leader);
  }

  const session = await mongoose.model('AcademicSession').findOne({ isCurrent: true }).select('config.maxGroupSize').lean();
  const max = session?.config?.maxGroupSize || 4;
  
  if (this.members.length > max) {
    throw new Error(`Group cannot exceed ${max} members`);
  }

  const User = mongoose.model('User');
  const invalid = await User.find({
    _id: { $in: [this.leader, ...this.members] },
    role: { $ne: 'Student' }
  }).countDocuments();

  if (invalid > 0) {
    throw new Error('Leader and members must be Students');
  }

  if (this.isModified('status')) {
    if (this.status === 'Approved') {
      this.isApproved = true;
      this.isLocked = true;
    } else {
      this.isApproved = false;
    }
  }
  
  if (this.isModified('supervisor') && this.supervisor) {
    if (!this.assignedAt) {
      this.assignedAt = new Date();
    }
  }
});

groupSchema.statics.assignSupervisorManually = async function (groupId, supervisorId, coordinatorId, mongooseSession) {
  const User = mongoose.model('User');
  const sup = await User.findOne({ _id: supervisorId, role: 'Supervisor', isDeleted: false }).session(mongooseSession);
  if (!sup) throw new Error('Supervisor not found');
  if (sup.currentGroupsSupervising >= sup.maxGroupsSupervising) {
    throw new Error('Supervisor has reached max group capacity');
  }
  
  const gUpdate = await this.findOneAndUpdate(
    { _id: groupId, isDeleted: false },
    { 
      $set: { 
        supervisor: supervisorId,
        assignedBy: coordinatorId,
        assignedAt: new Date()
      } 
    },
    { new: true, session: mongooseSession }
  );
  
  if (!gUpdate) throw new Error('Group not found');
  await User.updateOne({ _id: supervisorId }, { $inc: { currentGroupsSupervising: 1 } }).session(mongooseSession);
  return gUpdate;
};

groupSchema.statics.unassignSupervisorManually = async function (groupId, mongooseSession) {
  const group = await this.findById(groupId).session(mongooseSession);
  if (!group || !group.supervisor) return false;
  const supervisorId = group.supervisor;
  
  await this.updateOne(
    { _id: groupId }, 
    { $unset: { supervisor: 1, assignedBy: 1, assignedAt: 1 } }
  ).session(mongooseSession);
  
  await mongoose.model('User').updateOne(
    { _id: supervisorId }, 
    { $inc: { currentGroupsSupervising: -1 } }
  ).session(mongooseSession);
  
  return true;
};

groupSchema.methods.softDelete = async function (session) {
  this.isDeleted = true;
  await this.save({ session });
};

groupSchema.query.notDeleted = function () {
  return this.where({ isDeleted: false });
};

module.exports = mongoose.model('Group', groupSchema);