/* ===== backend/src/routes/announcement.routes.js ===== */
const express = require('express');
const router = express.Router();

// Controllers
const announcementController = require('../controllers/announcement.controller');

// Middlewares
const authenticateJWT = require('../middlewares/auth');
const { restrictTo } = require('../middlewares/rbac');
const validate = require('../middlewares/validate');

// Validations
const { 
    createAnnouncementSchema, 
    updateAnnouncementSchema 
} = require('../validations/announcement.validation');

// ═══════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════

// Get all announcements (Filtered by role in the service)
router.get('/', 
    authenticateJWT, 
    announcementController.getAnnouncements
);

// Get a single announcement by ID
router.get('/:id', 
    authenticateJWT, 
    announcementController.getAnnouncement
);

// Create a new announcement (Coordinator or Supervisor only)
router.post('/', 
    authenticateJWT, 
    restrictTo('Coordinator', 'Supervisor'), 
    validate(createAnnouncementSchema), 
    announcementController.createAnnouncement
);

// Update an announcement (Coordinator or Authoring Supervisor only)
router.put('/:id', 
    authenticateJWT, 
    restrictTo('Coordinator', 'Supervisor'), 
    validate(updateAnnouncementSchema), 
    announcementController.updateAnnouncement
);

// Delete an announcement (Coordinator or Authoring Supervisor only)
router.delete('/:id', 
    authenticateJWT, 
    restrictTo('Coordinator', 'Supervisor'), 
    announcementController.deleteAnnouncement
);

module.exports = router;