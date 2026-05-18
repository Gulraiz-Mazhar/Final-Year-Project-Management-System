const mongoose = require('mongoose');

const evaluationOverrideSchema = new mongoose.Schema({
  targetEvaluation: { 
    type: mongoose.Schema.Types.ObjectId, 
    refPath: 'evaluationModel', 
    required: true,
    index: true
  },
  evaluationModel: { 
    type: String, 
    enum: ['WeeklyEvaluation', 'FinalEvaluation', 'Submission'], 
    required: true 
  },
  fieldOverridden: { type: String, required: true }, 
  originalValue: { type: mongoose.Schema.Types.Mixed, required: true },
  overriddenValue: { type: mongoose.Schema.Types.Mixed, required: true },
  originalRemarks: { type: String, trim: true },
  overrideReason: { type: String, required: true, trim: true },
  originalEvaluator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  overriddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  overriddenByRole: { 
    type: String, 
    enum: ['Coordinator', 'Supervisor'], 
    required: true 
  },
  overriddenAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['Active', 'Reverted', 'Acknowledged'],
    default: 'Active'
  },
  acknowledgment: {
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    acknowledgedAt: { type: Date },
    comments: { type: String, trim: true }
  },
  isDeleted: { type: Boolean, default: false, index: true },
}, { timestamps: true });

evaluationOverrideSchema.index({ targetEvaluation: 1, evaluationModel: 1 });
evaluationOverrideSchema.index({ overriddenBy: 1, overriddenAt: -1 });
evaluationOverrideSchema.index({ originalEvaluator: 1 });

evaluationOverrideSchema.query.notDeleted = function () {
  return this.where({ isDeleted: false });
};

evaluationOverrideSchema.methods.softDelete = function () {
  this.isDeleted = true;
  return this.save();
};

evaluationOverrideSchema.pre('save', async function () {
  const User = mongoose.model('User');
  const user = await User.findOne({ _id: this.overriddenBy, isDeleted: false }).select('role');
  if (!user) {
    throw new Error('Invalid overriddenBy user reference');
  }
  if (user.role !== this.overriddenByRole) {
    throw new Error(`Override role mismatch: expected ${this.overriddenByRole}, got ${user.role}`);
  }

  const TargetModel = mongoose.model(this.evaluationModel);
  const target = await TargetModel.findOne({ _id: this.targetEvaluation, isDeleted: false });
  if (!target) {
    throw new Error(`Invalid ${this.evaluationModel} reference`);
  }
});

module.exports = mongoose.model('EvaluationOverride', evaluationOverrideSchema);