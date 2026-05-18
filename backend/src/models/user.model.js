const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['Student', 'Supervisor', 'Coordinator'];

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, index: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ROLES, default: 'Student', index: true },
  universityId: { type: String, trim: true, sparse: true },
  batch: { type: String, trim: true, index: true },
  department: { type: String, trim: true, index: true },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null, index: true },
  maxGroupsSupervising: { type: Number, default: 0, min: 0 },
  currentGroupsSupervising: { type: Number, default: 0, index: true },
  permissions: {
    canLockGrades: { type: Boolean, default: false },
    canOverrideEvaluations: { type: Boolean, default: false },
  },
  emailVerified: { type: Boolean, default: false },
  lastLoginAt: { type: Date },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false, index: true },
  passwordResetToken: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },
}, { timestamps: true, versionKey: 'version' });

userSchema.index({ role: 1, isActive: 1 });

userSchema.query.notDeleted = function () {
  return this.where({ isDeleted: false });
};

userSchema.query.active = function () {
  return this.where({ isActive: true });
};

userSchema.pre('save', async function () {
  if (this.role !== 'Supervisor') {
    this.maxGroupsSupervising = 0;
    this.currentGroupsSupervising = 0;
  } else if (this.maxGroupsSupervising < 1) {
    throw new Error('Supervisors must have maxGroupsSupervising >= 1');
  }

  if (this.role === 'Student' && (!this.universityId || !this.batch)) {
    throw new Error('Students must have universityId and batch');
  }

  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  
  if (this.isModified('role')) {
    if (this.role === 'Coordinator') {
      this.permissions.canLockGrades = true;
      this.permissions.canOverrideEvaluations = true;
    } else if (this.role === 'Supervisor') {
      this.permissions.canLockGrades = false;
      this.permissions.canOverrideEvaluations = false;
    }
  }
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.softDelete = async function () {
  this.isDeleted = true;
  this.isActive = false;
  await this.save();
};

module.exports = mongoose.model('User', userSchema);