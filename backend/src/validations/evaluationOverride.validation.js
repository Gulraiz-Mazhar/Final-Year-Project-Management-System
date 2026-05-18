/* ===== backend/src/validations/evaluationOverride.validation.js ===== */
const Joi = require('joi');

const createOverrideSchema = Joi.object({
    targetEvaluation: Joi.string().hex().length(24).required(),
    evaluationModel: Joi.string().valid('WeeklyEvaluation', 'FinalEvaluation', 'Submission').required(),
    fieldOverridden: Joi.string().required(), // e.g., "evaluation.coordinator.marks"
    overriddenValue: Joi.any().required(),
    overrideReason: Joi.string().required().trim()
});

const acknowledgeOverrideSchema = Joi.object({
    comments: Joi.string().allow('').optional()
});

module.exports = {
    createOverrideSchema,
    acknowledgeOverrideSchema
};