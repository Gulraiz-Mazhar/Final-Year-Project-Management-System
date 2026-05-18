/* ===== backend/src/controllers/meeting.controller.js ===== */
const meetingService = require('../services/meeting.service');
const asyncHandler = require('../utils/asyncHandler');

const createMeeting = asyncHandler(async (req, res) => {
    const meeting = await meetingService.createMeeting(req.body, req.user.id || req.user._id);
    res.status(201).json(meeting);
});

const getMeetings = asyncHandler(async (req, res) => {
    const meetings = await meetingService.getMeetings(req.user);
    res.json(meetings);
});

const getMeeting = asyncHandler(async (req, res, next) => {
    try {
        const meeting = await meetingService.getMeeting(req.params.id, req.user);
        if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
        res.json(meeting);
    } catch (err) {
        if (err.message === 'Not authorized to view this meeting') {
            return res.status(403).json({ message: err.message });
        }
        next(err);
    }
});

const updateMeeting = asyncHandler(async (req, res) => {
    const meeting = await meetingService.updateMeeting(req.params.id, req.body, req.user.id || req.user._id);
    res.json(meeting);
});

const deleteMeeting = asyncHandler(async (req, res) => {
    await meetingService.deleteMeeting(req.params.id);
    res.json({ message: 'Meeting deleted successfully' });
});

module.exports = {
    createMeeting,
    getMeetings,
    getMeeting,
    updateMeeting,
    deleteMeeting
};