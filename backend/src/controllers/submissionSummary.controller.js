/* ===== backend/src/controllers/submissionSummary.controller.js ===== */
const submissionSummaryService = require('../services/submissionSummary.service');
const asyncHandler = require('../utils/asyncHandler');

const getSummaries = asyncHandler(async (req, res) => {
    const summaries = await submissionSummaryService.getSummaries(req.user);
    res.json(summaries);
});

const getSummaryByProject = asyncHandler(async (req, res, next) => {
    try {
        const summaries = await submissionSummaryService.getSummaryByProject(req.params.projectId, req.user);
        res.json(summaries);
    } catch (err) {
        if (err.message.includes('Not authorized')) {
            return res.status(403).json({ message: err.message });
        }
        next(err);
    }
});

module.exports = {
    getSummaries,
    getSummaryByProject
};