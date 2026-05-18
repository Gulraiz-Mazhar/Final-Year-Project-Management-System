/* ===== backend/src/routes/submissionSummary.routes.js ===== */
const express = require('express');
const router = express.Router();

const submissionSummaryController = require('../controllers/submissionSummary.controller');
const authenticateJWT = require('../middlewares/auth');

router.get('/', authenticateJWT, submissionSummaryController.getSummaries);
router.get('/project/:projectId', authenticateJWT, submissionSummaryController.getSummaryByProject);

module.exports = router;