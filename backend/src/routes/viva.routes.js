/* ===== backend/src/routes/viva.routes.js ===== */
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const vivaController = require('../controllers/viva.controller');
const authenticateJWT = require('../middlewares/auth');
const { restrictTo } = require('../middlewares/rbac');
const validate = require('../middlewares/validate');
const { startVivaSchema, chatSchema } = require('../validations/viva.validation');

const vivaRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 20, 
    message: { message: 'Institutional AI quota exceeded. Please wait before continuing your Viva.' },
    standardHeaders: true,
    legacyHeaders: false
});

router.post('/start', authenticateJWT, restrictTo('Student'), validate(startVivaSchema), vivaController.startViva);
router.post('/:sessionId/chat', authenticateJWT, restrictTo('Student'), vivaRateLimiter, validate(chatSchema), vivaController.chatMessage);
router.post('/:sessionId/end', authenticateJWT, restrictTo('Student'), vivaRateLimiter, vivaController.endViva);
router.get('/project/:projectId', authenticateJWT, vivaController.getResults);

module.exports = router;