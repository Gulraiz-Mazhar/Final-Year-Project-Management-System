/* ===== backend/src/services/meeting.service.js ===== */
const Meeting = require('../models/Meeting');
const Group = require('../models/group.model');
const notificationService = require('./notification.service');

const createMeeting = async (data, supervisorId) => {
    const { title, description, location, group, scheduledDate, duration, mode, agenda, status, attendees } = data;

    // Verify this supervisor actually supervises the group
    const grp = await Group.findById(group).notDeleted();
    if (!grp) throw new Error('Group not found');
    
    if (!grp.supervisor || grp.supervisor.toString() !== supervisorId.toString()) {
        throw new Error('You are not the supervisor of this group');
    }

    const meeting = new Meeting({
        title,
        description,
        location,
        group,
        supervisor: supervisorId,
        scheduledDate,
        duration,
        mode,
        agenda,
        status,
        attendees
    });

    await meeting.save();

    // --- Internal Notification Integration ---
    const formattedDate = new Date(scheduledDate).toLocaleString();
    for (const memberId of grp.members) {
        await notificationService.createNotification({
            recipient: memberId,
            type: 'INFO',
            title: 'New Meeting Scheduled',
            message: `Your supervisor has scheduled a meeting: "${title}" on ${formattedDate}. Mode: ${mode}.`
        });
    }

    return meeting;
};

const getMeetings = async (user) => {
    let filter = { isDeleted: { $ne: true } };

    if (user.role === 'Student') {
        const grp = await Group.findOne({ members: user.id || user._id }).notDeleted();
        if (!grp) return [];
        filter.group = grp._id;
    } else if (user.role === 'Supervisor') {
        filter.supervisor = user.id || user._id;
    }
    // Coordinators see all automatically because no filter is applied

    return Meeting.find(filter)
        .populate('group', 'name')
        .populate('supervisor', 'name email')
        .populate('attendees', 'name email')
        .populate('absentees', 'name email')
        .sort({ scheduledDate: -1 });
};

const getMeeting = async (id, user) => {
    const meeting = await Meeting.findById(id).notDeleted()
        .populate('group', 'name')
        .populate('supervisor', 'name email')
        .populate('attendees', 'name email')
        .populate('absentees', 'name email');

    if (!meeting) return null;

    const userIdString = (user._id || user.id).toString();

    // Access checks
    if (user.role === 'Student') {
        const grp = await Group.findOne({ members: userIdString, _id: meeting.group._id || meeting.group });
        if (!grp) throw new Error('Not authorized to view this meeting');
    } else if (user.role === 'Supervisor') {
        const supervisorId = (meeting.supervisor._id || meeting.supervisor).toString();
        if (supervisorId !== userIdString) {
            throw new Error('Not authorized to view this meeting');
        }
    }

    return meeting;
};

const updateMeeting = async (id, data, supervisorId) => {
    const meeting = await Meeting.findById(id).notDeleted();
    if (!meeting) throw new Error('Meeting not found');
    
    if (meeting.supervisor.toString() !== supervisorId.toString()) {
        throw new Error('Not authorized to update this meeting');
    }

    const allowedUpdates = [
        'title', 'description', 'location', 'scheduledDate', 'actualDate', 
        'duration', 'mode', 'status', 'agenda', 'minutesOfMeeting', 
        'attendees', 'absentees', 'actionItems', 'attachments'
    ];
    
    for (const key of allowedUpdates) {
        if (data[key] !== undefined) meeting[key] = data[key];
    }

    await meeting.save();
    return meeting;
};

const deleteMeeting = async (id) => {
    const meeting = await Meeting.findById(id).notDeleted();
    if (!meeting) throw new Error('Meeting not found');
    
    await meeting.softDelete();
    return meeting;
};

module.exports = {
    createMeeting,
    getMeetings,
    getMeeting,
    updateMeeting,
    deleteMeeting
};