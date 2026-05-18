/* ===== backend/src/controllers/projectStage.controller.js ===== */
const projectStageService = require('../services/projectStage.service');
const asyncHandler = require('../utils/asyncHandler');

const createStage = asyncHandler(async (req, res) => {
    const stage = await projectStageService.createStage(req.body);
    res.status(201).json(stage);
});

const getStages = asyncHandler(async (req, res) => {
    const stages = await projectStageService.getStages();
    res.json(stages);
});

const getStage = asyncHandler(async (req, res) => {
    const stage = await projectStageService.getStage(req.params.id);
    if (!stage) return res.status(404).json({ message: 'Stage not found' });
    res.json(stage);
});

const updateStage = asyncHandler(async (req, res) => {
    const stage = await projectStageService.updateStage(req.params.id, req.body);
    res.json(stage);
});

const deleteStage = asyncHandler(async (req, res) => {
    await projectStageService.deleteStage(req.params.id);
    res.json({ message: 'Stage deleted successfully' });
});

module.exports = {
    createStage,
    getStages,
    getStage,
    updateStage,
    deleteStage
};