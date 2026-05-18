/* ===== backend/src/routes/meeting.routes.js ===== */
const express = require('express');
const router = express.Router();

// Controllers
const meetingController = require('../controllers/meeting.controller');

// Middlewares
const authenticateJWT = require('../middlewares/auth');
const { restrictTo } = require('../middlewares/rbac');
const validate = require('../middlewares/validate');

// Validations
const { 
    createMeetingSchema, 
    updateMeetingSchema 
} = require('../validations/meeting.validation');

// ═══════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════

// Create a new meeting (Supervisor only)
router.post('/', 
    authenticateJWT, 
    restrictTo('Supervisor'), 
    validate(createMeetingSchema), 
    meetingController.createMeeting
);

// Get all meetings relevant to the user (filtered in service)
router.get('/', 
    authenticateJWT, 
    meetingController.getMeetings
);

// Get a specific meeting by ID
router.get('/:id', 
    authenticateJWT, 
    meetingController.getMeeting
);

// Update a meeting (Supervisor only)
router.put('/:id', 
    authenticateJWT, 
    restrictTo('Supervisor'), 
    validate(updateMeetingSchema), 
    meetingController.updateMeeting
);

// Delete a meeting (Coordinator only)
router.delete('/:id', 
    authenticateJWT, 
    restrictTo('Coordinator'), 
    meetingController.deleteMeeting
);

module.exports = router;