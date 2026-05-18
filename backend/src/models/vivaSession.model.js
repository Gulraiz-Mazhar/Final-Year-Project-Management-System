const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'model'], required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const vivaSessionSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  status: { 
    type: String, 
    enum: ['In Progress', 'Completed', 'Failed', 'Error'], 
    default: 'In Progress' 
  },
  extractedContext: { type: String, select: false }, 
  chatTranscript: { type: [chatMessageSchema], default: [] },
  evaluation: {
    score: { type: Number, min: 0, max: 100 },
    strengths: { type: [String], default: [] },
    weaknesses: { type: [String], default: [] },
    advice: { type: String }
  },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
}, { timestamps: true });

vivaSessionSchema.index({ student: 1, status: 1 });

module.exports = mongoose.model('VivaSession', vivaSessionSchema);