/* ===== backend/src/services/notification.service.js ===== */
const Notification = require('../models/notification.model');

/**
 * Internal helper — also exported for use by other modules 
 * (meeting, project evaluation, etc.) to trigger notifications directly.
 */
const createNotification = async (data) => {
    const { recipient, type, title, message, relatedLink } = data;
    const notification = new Notification({ recipient, type, title, message, relatedLink });
    await notification.save();
    return notification;
};

const getNotifications = async (userId) => {
    return Notification.find({ recipient: userId })
        .notDeleted()
        .sort({ createdAt: -1 });
};

const markAsRead = async (id) => {
    return Notification.findByIdAndUpdate(id, { isRead: true }, { new: true });
};

const deleteNotification = async (id) => {
    const notification = await Notification.findById(id).notDeleted();
    if (!notification) throw new Error('Notification not found');
    
    await notification.softDelete();
    return notification;
};

module.exports = {
    createNotification,
    getNotifications,
    markAsRead,
    deleteNotification
};