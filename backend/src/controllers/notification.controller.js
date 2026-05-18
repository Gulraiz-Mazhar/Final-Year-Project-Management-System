/* ===== backend/src/controllers/notification.controller.js ===== */
const notificationService = require('../services/notification.service');
const asyncHandler = require('../utils/asyncHandler');

const createNotification = asyncHandler(async (req, res) => {
    const notification = await notificationService.createNotification(req.body);
    res.status(201).json(notification);
});

const getNotifications = asyncHandler(async (req, res) => {
    const notifications = await notificationService.getNotifications(req.user.id);
    res.json(notifications);
});

const markAsRead = asyncHandler(async (req, res) => {
    const notification = await notificationService.markAsRead(req.params.id);
    res.json(notification);
});

const deleteNotification = asyncHandler(async (req, res) => {
    await notificationService.deleteNotification(req.params.id);
    res.json({ message: 'Notification deleted successfully' });
});

module.exports = {
    createNotification,
    getNotifications,
    markAsRead,
    deleteNotification
};