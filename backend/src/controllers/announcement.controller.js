/* ===== backend/src/controllers/announcement.controller.js ===== */
const announcementService = require('../services/announcement.service');
const asyncHandler = require('../utils/asyncHandler');

const createAnnouncement = asyncHandler(async (req, res) => {
    // req.user.id or req.user._id depending on how your JWT payload is structured
    const authorId = req.user.id || req.user._id; 
    const announcement = await announcementService.createAnnouncement(req.body, authorId);
    res.status(201).json(announcement);
});

const getAnnouncements = asyncHandler(async (req, res) => {
    const announcements = await announcementService.getAnnouncements(req.user.role);
    res.json(announcements);
});

const getAnnouncement = asyncHandler(async (req, res) => {
    const announcement = await announcementService.getAnnouncement(req.params.id);
    if (!announcement) {
        return res.status(404).json({ message: 'Announcement not found' });
    }
    res.json(announcement);
});

const updateAnnouncement = asyncHandler(async (req, res) => {
    // We pass req.user entirely so the service can check roles and ID for ownership
    const announcement = await announcementService.updateAnnouncement(req.params.id, req.body, req.user);
    res.json(announcement);
});

const deleteAnnouncement = asyncHandler(async (req, res) => {
    // We pass req.user entirely so the service can check roles and ID for ownership
    await announcementService.deleteAnnouncement(req.params.id, req.user);
    res.json({ message: 'Announcement deleted successfully' });
});

module.exports = {
    createAnnouncement,
    getAnnouncements,
    getAnnouncement,
    updateAnnouncement,
    deleteAnnouncement
};