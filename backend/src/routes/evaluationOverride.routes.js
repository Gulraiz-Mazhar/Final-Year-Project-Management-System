/* ===== backend/src/routes/evaluationOverride.routes.js ===== */
const express = require('express');
const router = express.Router();

const evaluationOverrideController = require('../controllers/evaluationOverride.controller');
const authenticateJWT = require('../middlewares/auth');
const { restrictTo } = require('../middlewares/rbac');
const validate = require('../middlewares/validate');
const { createOverrideSchema, acknowledgeOverrideSchema } = require('../validations/evaluationOverride.validation');

router.post('/', authenticateJWT, restrictTo('Coordinator'), validate(createOverrideSchema), evaluationOverrideController.createOverride);
router.get('/', authenticateJWT, restrictTo('Coordinator', 'Supervisor'), evaluationOverrideController.getOverrides);
router.patch('/:id/ack', authenticateJWT, restrictTo('Supervisor'), validate(acknowledgeOverrideSchema), evaluationOverrideController.acknowledgeOverride);
router.patch('/:id/revert', authenticateJWT, restrictTo('Coordinator'), evaluationOverrideController.revertOverride);

module.exports = router;