/* ===== backend/src/routes/academicSession.routes.js ===== */
const express = require('express');
const router = express.Router();

// Controllers
const academicSessionController = require('../controllers/academicSession.controller');

// Middlewares
const authenticateJWT = require('../middlewares/auth');
const { restrictTo } = require('../middlewares/rbac');
const validate = require('../middlewares/validate');

// Validations
const { 
    createSessionSchema, 
    updateSessionSchema 
} = require('../validations/academicSession.validation');

// ═══════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════

// Get the currently active session (accessible to all authenticated users)
router.get('/current', 
    authenticateJWT, 
    academicSessionController.getCurrentSession
);

// Get all sessions (accessible to all authenticated users)
router.get('/', 
    authenticateJWT, 
    academicSessionController.getSessions
);

// Create a new session (Coordinator only)
router.post('/', 
    authenticateJWT, 
    restrictTo('Coordinator'), 
    validate(createSessionSchema), 
    academicSessionController.createSession
);

// Update a session (Coordinator only)
router.put('/:id', 
    authenticateJWT, 
    restrictTo('Coordinator'), 
    validate(updateSessionSchema), 
    academicSessionController.updateSession
);

// Delete a session (Coordinator only)
router.delete('/:id', 
    authenticateJWT, 
    restrictTo('Coordinator'), 
    academicSessionController.deleteSession
);

module.exports = router;