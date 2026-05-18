/* ===== backend/src/controllers/submission.controller.js ===== */
const submissionService = require('../services/submission.service');
const asyncHandler = require('../utils/asyncHandler');

const createSubmission = asyncHandler(async (req, res) => {
    const submission = await submissionService.createSubmission(req.body, req.user.id || req.user._id);
    res.status(201).json(submission);
});

const getSubmissions = asyncHandler(async (req, res) => {
    const submissions = await submissionService.getSubmissions(req.user);
    res.json(submissions);
});

const getSubmissionById = asyncHandler(async (req, res) => {
    const submission = await submissionService.getSubmissionById(req.params.id);
    if (!submission) return res.status(404).json({ message: 'Submission not found' });
    res.json(submission);
});

const updateSubmission = asyncHandler(async (req, res) => {
    const submission = await submissionService.updateSubmission(req.params.id, req.body, req.user.id || req.user._id);
    res.json(submission);
});

const gradeSubmission = asyncHandler(async (req, res) => {
    const submission = await submissionService.gradeSubmission(req.params.id, req.body, req.user);
    res.json(submission);
});

const deleteSubmission = asyncHandler(async (req, res) => {
    await submissionService.deleteSubmission(req.params.id);
    res.json({ message: 'Submission deleted successfully' });
});

const triggerCopyleaksScan = asyncHandler(async (req, res) => {
    const result = await submissionService.triggerCopyleaksScan(req.params.id);
    res.json(result);
});

const checkCopyleaksIntegrity = asyncHandler(async (req, res) => {
    try {
        const integrity = await submissionService.checkCopyleaksIntegrity(req.params.id);
        res.json(integrity);
    } catch (err) {
        if (err.response?.status === 404 || err.response?.status === 409) {
            return res.status(202).json({ message: "Scan still processing. Try again in 30s." });
        }
        res.status(400).json({ message: "Unable to sync results. Ensure scan was triggered." });
    }
});

const handleCopyleaksWebhook = async (req, res) => {
    try {
        const expectedSignature = process.env.COPYLEAKS_WEBHOOK_SECRET;
        const isDevMode = process.env.NODE_ENV !== 'production';

        await submissionService.handleCopyleaksWebhook(
            req.params.id, 
            req.params.status, 
            req.headers, 
            req.body, 
            expectedSignature, 
            isDevMode
        );
        res.sendStatus(200);
    } catch (err) {
        console.error('[WEBHOOK ERROR]', err.message);
        if (err.message === 'Unauthorized webhook invocation') {
            return res.status(403).json({ message: err.message });
        }
        res.sendStatus(500);
    }
};

const getCopyleaksReportStream = asyncHandler(async (req, res) => {
    try {
        const stream = await submissionService.getCopyleaksReportStream(req.params.id);
        res.setHeader('Content-Type', 'application/pdf');
        stream.pipe(res);
    } catch (err) {
        const sub = await submissionService.getSubmissionById(req.params.id);
        if (sub && sub.integrity?.reportUrl) {
            return res.status(400).json({ 
                message: "PDF not generated yet. Please use the 'View Results' button to see the online report.", 
                webUrl: sub.integrity.reportUrl 
            });
        }
        res.status(500).json({ message: "Internal Server Error during download." });
    }
});

module.exports = {
    createSubmission,
    getSubmissions,
    getSubmissionById,
    updateSubmission,
    gradeSubmission,
    deleteSubmission,
    triggerCopyleaksScan,
    checkCopyleaksIntegrity,
    handleCopyleaksWebhook,
    getCopyleaksReportStream
};