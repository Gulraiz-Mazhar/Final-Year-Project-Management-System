/* ===== backend/src/controllers/evaluationOverride.controller.js ===== */
const evaluationOverrideService = require('../services/evaluationOverride.service');
const asyncHandler = require('../utils/asyncHandler');

const createOverride = asyncHandler(async (req, res) => {
    const override = await evaluationOverrideService.createOverride(req.body, req.user.id || req.user._id);
    res.status(201).json(override);
});

const getOverrides = asyncHandler(async (req, res) => {
    const overrides = await evaluationOverrideService.getOverrides(req.user);
    res.json(overrides);
});

const acknowledgeOverride = asyncHandler(async (req, res) => {
    const override = await evaluationOverrideService.acknowledgeOverride(req.params.id, req.user.id || req.user._id, req.body);
    res.json(override);
});

const revertOverride = asyncHandler(async (req, res) => {
    const override = await evaluationOverrideService.revertOverride(req.params.id);
    res.json(override);
});

module.exports = {
    createOverride,
    getOverrides,
    acknowledgeOverride,
    revertOverride
};