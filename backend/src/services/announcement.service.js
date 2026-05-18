/* ===== backend/src/services/announcement.service.js ===== */
const Announcement = require('../models/announcement.model');

const createAnnouncement = async (data, authorId) => {
    const { title, body, targetAudience, attachments, expiresAt } = data;
    
    const announcement = new Announcement({ 
        title, 
        body, 
        targetAudience, 
        author: authorId, 
        attachments, 
        expiresAt 
    });
    
    await announcement.save();
    return announcement;
};

const getAnnouncements = async (role) => {
    const query = { isDeleted: false };
    
    // Coordinators see all announcements. 
    // Everyone else only sees 'All' or announcements specifically targeting their role.
    if (role !== 'Coordinator') {
        query.$or = [{ targetAudience: 'All' }, { targetAudience: role }];
    }
    
    return Announcement.find(query)
        .populate('author', 'name email role')
        .sort({ createdAt: -1 });
};

const getAnnouncement = async (id) => {
    return Announcement.findById(id)
        .notDeleted()
        .populate('author', 'name email role');
};

const updateAnnouncement = async (id, data, user) => {
    const announcement = await Announcement.findById(id).notDeleted();
    if (!announcement) throw new Error('Announcement not found');

    // Coordinators can edit any announcement.
    // Supervisors can only edit their own.
    if (user.role === 'Supervisor') {
        if (announcement.author.toString() !== user._id.toString()) {
            throw new Error('Only the author or a Coordinator can edit this announcement');
        }
    }

    const { title, body, targetAudience, attachments, expiresAt } = data;
    
    const updatePayload = {};
    if (title !== undefined)          updatePayload.title = title;
    if (body !== undefined)           updatePayload.body = body;
    if (targetAudience !== undefined) updatePayload.targetAudience = targetAudience;
    if (attachments !== undefined)    updatePayload.attachments = attachments;
    if (expiresAt !== undefined)      updatePayload.expiresAt = expiresAt;
    
    return Announcement.findByIdAndUpdate(id, updatePayload, { new: true })
        .populate('author', 'name email role');
};

const deleteAnnouncement = async (id, user) => {
    const announcement = await Announcement.findById(id).notDeleted();
    if (!announcement) throw new Error('Announcement not found');

    // Coordinators can delete any announcement.
    // Supervisors can only delete their own.
    if (user.role === 'Supervisor') {
        if (announcement.author.toString() !== user._id.toString()) {
            throw new Error('Only the author or a Coordinator can delete this announcement');
        }
    }

    await announcement.softDelete();
    return announcement;
};

module.exports = {
    createAnnouncement,
    getAnnouncements,
    getAnnouncement,
    updateAnnouncement,
    deleteAnnouncement
};