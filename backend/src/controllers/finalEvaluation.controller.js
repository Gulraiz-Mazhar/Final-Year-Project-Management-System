/* ===== backend/src/controllers/finalEvaluation.controller.js ===== */
const finalEvaluationService = require('../services/finalEvaluation.service');
const asyncHandler = require('../utils/asyncHandler');

const createFinalEvaluation = asyncHandler(async (req, res) => {
    const evaluation = await finalEvaluationService.createFinalEvaluation(req.body);
    res.status(201).json(evaluation);
});

const getFinalEvaluations = asyncHandler(async (req, res) => {
    const evaluations = await finalEvaluationService.getFinalEvaluations(req.user);
    res.json(evaluations);
});

const getFinalEvaluation = asyncHandler(async (req, res) => {
    const evaluation = await finalEvaluationService.getFinalEvaluation(req.params.id);
    if (!evaluation) return res.status(404).json({ message: 'Evaluation not found' });
    res.json(evaluation);
});

const submitSupervisorEvaluation = asyncHandler(async (req, res) => {
    const evaluation = await finalEvaluationService.submitSupervisorEvaluation(
        req.params.id, 
        req.body, 
        req.user.id || req.user._id
    );
    res.json(evaluation);
});

const submitCoordinatorEvaluation = asyncHandler(async (req, res) => {
    const evaluation = await finalEvaluationService.submitCoordinatorEvaluation(
        req.params.id, 
        req.body, 
        req.user.id || req.user._id
    );
    res.json(evaluation);
});

const lockFinalEvaluation = asyncHandler(async (req, res) => {
    const evaluation = await finalEvaluationService.lockFinalEvaluation(
        req.params.id, 
        req.user.id || req.user._id
    );
    res.json(evaluation);
});

const setVivaDetails = asyncHandler(async (req, res) => {
    const evaluation = await finalEvaluationService.setVivaDetails(
        req.params.id, 
        req.body, 
        req.user.id || req.user._id
    );
    res.json(evaluation);
});

module.exports = {
    createFinalEvaluation,
    getFinalEvaluations,
    getFinalEvaluation,
    submitSupervisorEvaluation,
    submitCoordinatorEvaluation,
    lockFinalEvaluation,
    setVivaDetails
};