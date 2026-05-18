/* ===== backend/src/routes/notification.routes.js ===== */
const express = require('express');
const router = express.Router();

// Controllers
const notificationController = require('../controllers/notification.controller');

// Middlewares
const authenticateJWT = require('../middlewares/auth');
const { restrictTo, ownershipCheck } = require('../middlewares/rbac');
const validate = require('../middlewares/validate');

// Validations & Models
const { createNotificationSchema } = require('../validations/notification.validation');
const Notification = require('../models/notification.model'); // Needed specifically for ownershipCheck

// ═══════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════

// Get all notifications for the logged-in user
router.get('/', 
    authenticateJWT, 
    notificationController.getNotifications
);

// Manually create a notification (Coordinator only)
// Note: System-generated notifications bypass this and call the service directly.
router.post('/', 
    authenticateJWT, 
    restrictTo('Coordinator'), 
    validate(createNotificationSchema), 
    notificationController.createNotification
);

// Mark a specific notification as read (Must be the recipient)
router.put('/:id/read', 
    authenticateJWT, 
    ownershipCheck(Notification, 'recipient'), 
    notificationController.markAsRead
);

// Delete a specific notification (Must be the recipient)
router.delete('/:id', 
    authenticateJWT, 
    ownershipCheck(Notification, 'recipient'), 
    notificationController.deleteNotification
);

module.exports = router;