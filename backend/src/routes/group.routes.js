/* ===== backend/src/routes/group.routes.js ===== */
const express = require('express');
const router = express.Router();

// Controllers
const groupController = require('../controllers/group.controller');

// Middlewares
const authenticateJWT = require('../middlewares/auth');
const { restrictTo, ownershipCheck } = require('../middlewares/rbac');
const validate = require('../middlewares/validate');

// Validations & Models
const { 
    createGroupSchema, 
    updateGroupSchema, 
    assignSupervisorSchema 
} = require('../validations/group.validation');
const Group = require('../models/group.model');

// Custom Route-Level Middleware
const checkOwnershipOrRole = (req, res, next) => {
    if (req.user.role === 'Coordinator' || req.user.role === 'Admin') {
        return next();
    }
    return ownershipCheck(Group, 'leader')(req, res, next);
};

// ═══════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════

// Create a new group (Student only)
router.post('/', 
    authenticateJWT, 
    restrictTo('Student'), 
    validate(createGroupSchema), 
    groupController.createGroup
);

// Join a group using a join code (Student only)
router.post('/join/:code', 
    authenticateJWT, 
    restrictTo('Student'), 
    groupController.joinGroup
);

// Get all groups based on role context
router.get('/', 
    authenticateJWT, 
    groupController.getGroups
);

// Get a specific group by ID
router.get('/:id', 
    authenticateJWT, 
    groupController.getGroup
);

// Unlock a group (Coordinator only)
router.patch('/:id/unlock', 
    authenticateJWT, 
    restrictTo('Coordinator'), 
    groupController.unlockGroup
);

// Leave a group (Student only)
router.post('/:id/leave', 
    authenticateJWT, 
    restrictTo('Student'), 
    groupController.leaveGroup
);

// Update group details (Student Leader or Coordinator)
router.put('/:id',
    authenticateJWT,
    restrictTo('Student', 'Coordinator'),
    checkOwnershipOrRole,
    validate(updateGroupSchema),
    groupController.updateGroup
);

// Assign a supervisor to a group (Coordinator only)
router.put('/:id/assign-supervisor', 
    authenticateJWT, 
    restrictTo('Coordinator'), 
    validate(assignSupervisorSchema), 
    groupController.assignSupervisor
);

// Delete a group completely (Coordinator only)
router.delete('/:id', 
    authenticateJWT, 
    restrictTo('Coordinator'), 
    groupController.deleteGroup
);

module.exports = router;