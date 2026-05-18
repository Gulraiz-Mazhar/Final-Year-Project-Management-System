/* ===== backend/src/routes/finalEvaluation.routes.js ===== */
const express = require('express');
const router = express.Router();

// Controllers
const finalEvaluationController = require('../controllers/finalEvaluation.controller');

// Middlewares
const authenticateJWT = require('../middlewares/auth');
const { restrictTo } = require('../middlewares/rbac');
const validate = require('../middlewares/validate');

// Validations
const { 
    createEvaluationSchema,
    supervisorEvalSchema,
    coordinatorEvalSchema,
    vivaDetailsSchema
} = require('../validations/finalEvaluation.validation');

// ═══════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════

// Create a new Final Evaluation record (Coordinator only)
router.post('/', 
    authenticateJWT, 
    restrictTo('Coordinator'), 
    validate(createEvaluationSchema), 
    finalEvaluationController.createFinalEvaluation
);

// Get all evaluations based on user role context
router.get('/', 
    authenticateJWT, 
    finalEvaluationController.getFinalEvaluations
);

// Get a specific evaluation by ID
router.get('/:id', 
    authenticateJWT, 
    finalEvaluationController.getFinalEvaluation
);

// Submit Supervisor Evaluation (Supervisor only)
router.patch('/:id/supervisor-eval', 
    authenticateJWT, 
    restrictTo('Supervisor'), 
    validate(supervisorEvalSchema), 
    finalEvaluationController.submitSupervisorEvaluation
);

// Submit Coordinator Evaluation (Coordinator only)
router.patch('/:id/coordinator-eval', 
    authenticateJWT, 
    restrictTo('Coordinator'), 
    validate(coordinatorEvalSchema), 
    finalEvaluationController.submitCoordinatorEvaluation
);

// Lock Final Evaluation & Calculate Final Grades (Coordinator only)
router.patch('/:id/lock', 
    authenticateJWT, 
    restrictTo('Coordinator'), 
    finalEvaluationController.lockFinalEvaluation
);

// Set Viva Details (Coordinator only)
router.patch('/:id/viva', 
    authenticateJWT, 
    restrictTo('Coordinator'), 
    validate(vivaDetailsSchema), 
    finalEvaluationController.setVivaDetails
);

module.exports = router;