const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  location: { type: String, trim: true },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
  supervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  scheduledDate: { type: Date, required: true, index: true },
  actualDate: { type: Date },
  duration: { type: Number }, 
  mode: { 
    type: String, 
    enum: ['In-Person', 'Online', 'Hybrid'], 
    default: 'In-Person' 
  },
  status: { 
    type: String, 
    enum: ['Scheduled', 'Completed', 'Cancelled', 'Rescheduled', 'No-Show'], 
    default: 'Scheduled',
    index: true
  },
  attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  absentees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  agenda: { type: String, trim: true },
  minutesOfMeeting: { type: String, trim: true },
  actionItems: [{ 
    task: String, 
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dueDate: Date,
    status: { type: String, enum: ['Pending', 'Completed'], default: 'Pending' }
  }],
  attachments: [{
    name: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  isDeleted: { type: Boolean, default: false, index: true },
}, { timestamps: true });

meetingSchema.index({ group: 1, scheduledDate: -1 });
meetingSchema.index({ supervisor: 1, status: 1 });
meetingSchema.index({ scheduledDate: 1, status: 1 });

meetingSchema.query.notDeleted = function () {
  return this.where({ isDeleted: false });
};

meetingSchema.methods.softDelete = function () {
  this.isDeleted = true;
  return this.save();
};

meetingSchema.pre('save', async function () {
  const User = mongoose.model('User');
  const supervisor = await User.findOne({ _id: this.supervisor, role: 'Supervisor', isDeleted: false });
  if (!supervisor) {
    throw new Error('Invalid supervisor reference');
  }

  const Group = mongoose.model('Group');
  const group = await Group.findOne({ _id: this.group, isDeleted: false });
  if (!group) {
    throw new Error('Invalid group reference');
  }

  if (this.attendees && this.attendees.length > 0) {
    const validMembers = this.attendees.every(id => 
      group.members.some(m => m.toString() === id.toString())
    );
    if (!validMembers) {
      throw new Error('All attendees must be group members');
    }
  }
});

module.exports = mongoose.model('Meeting', meetingSchema);