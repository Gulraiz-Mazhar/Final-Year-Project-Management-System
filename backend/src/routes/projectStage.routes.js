/* ===== backend/src/routes/projectStage.routes.js ===== */
const express = require('express');
const router = express.Router();

// Controllers
const projectStageController = require('../controllers/projectStage.controller');

// Middlewares
const authenticateJWT = require('../middlewares/auth');
const { restrictTo } = require('../middlewares/rbac');
const validate = require('../middlewares/validate');

// Validations
const { 
    createStageSchema, 
    updateStageSchema 
} = require('../validations/projectStage.validation');

// ═══════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════

// Create a new Project Stage (Coordinator only)
router.post('/', 
    authenticateJWT, 
    restrictTo('Coordinator'), 
    validate(createStageSchema), 
    projectStageController.createStage
);

// Get all Project Stages
router.get('/', 
    authenticateJWT, 
    projectStageController.getStages
);

// Get a single Project Stage by ID
router.get('/:id', 
    authenticateJWT, 
    projectStageController.getStage
);

// Update a Project Stage (Coordinator only)
router.put('/:id', 
    authenticateJWT, 
    restrictTo('Coordinator'), 
    validate(updateStageSchema), 
    projectStageController.updateStage
);

// Delete a Project Stage (Coordinator only)
router.delete('/:id', 
    authenticateJWT, 
    restrictTo('Coordinator'), 
    projectStageController.deleteStage
);

module.exports = router;