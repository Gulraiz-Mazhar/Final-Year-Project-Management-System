/* ===== backend/src/routes/index.js ===== */
const express = require('express');
const router = express.Router();

// Import individual route modules
const userRoutes = require('./user.routes');
const groupRoutes = require('./group.routes');
const projectRoutes = require('./project.routes');
const submissionRoutes = require('./submission.routes');
const announcementRoutes = require('./announcement.routes');
const notificationRoutes = require('./notification.routes');
const academicSessionRoutes = require('./academicSession.routes');
const projectStageRoutes = require('./projectStage.routes');
const projectArchiveRoutes = require('./projectArchive.routes');
const submissionSummaryRoutes = require('./submissionSummary.routes');
const meetingRoutes = require('./meeting.routes');
const finalEvaluationRoutes = require('./finalEvaluation.routes');
const evaluationOverrideRoutes = require('./evaluationOverride.routes');
const vivaRoutes = require('./viva.routes');

// Mount routes to their respective endpoints
router.use('/users', userRoutes);
router.use('/groups', groupRoutes);
router.use('/projects', projectRoutes);
router.use('/submissions', submissionRoutes);
router.use('/announcements', announcementRoutes);
router.use('/notifications', notificationRoutes);
router.use('/sessions', academicSessionRoutes);
router.use('/project-stages', projectStageRoutes);
router.use('/project-archives', projectArchiveRoutes);
router.use('/submission-summaries', submissionSummaryRoutes);
router.use('/meetings', meetingRoutes);
router.use('/final-evaluations', finalEvaluationRoutes);
router.use('/evaluation-overrides', evaluationOverrideRoutes);
router.use('/viva', vivaRoutes);

// Health check endpoint for load balancers or uptime monitoring
router.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'API is running smoothly.' });
});

module.exports = router;