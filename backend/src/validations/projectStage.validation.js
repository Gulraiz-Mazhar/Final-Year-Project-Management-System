/* ===== backend/src/validations/projectStage.validation.js ===== */
const Joi = require('joi');

const weeklyTaskSchema = Joi.object({
    weekNumber: Joi.number().min(1).required(),
    title: Joi.string().required(),
    description: Joi.string().allow(''),
    maxMarks: Joi.number().min(0).default(0),
    evaluationSplit: Joi.object({
        supervisor: Joi.number().min(0).max(100).default(40),
        coordinator: Joi.number().min(0).max(100).default(60)
    }).optional(),
    deadline: Joi.date().optional(),
    allowedSubmissionTypes: Joi.array().items(
        Joi.string().valid('DOCUMENT', 'CODE_REPO', 'AI_NOTEBOOK', 'VIDEO', 'DESIGN_FILE', 'OTHER')
    ).min(1).default(['DOCUMENT']),
    isMandatory: Joi.boolean().default(true)
});

const createStageSchema = Joi.object({
    name: Joi.string().required(),
    order: Joi.number().required(),
    description: Joi.string().allow('').optional(),
    totalMarks: Joi.number().default(0),
    evaluationSplit: Joi.object({
        supervisor: Joi.number().min(0).max(100).default(40),
        coordinator: Joi.number().min(0).max(100).default(60)
    }).optional(),
    allowedSubmissionTypes: Joi.array().items(
        Joi.string().valid('DOCUMENT', 'CODE_REPO', 'AI_NOTEBOOK', 'VIDEO', 'DESIGN_FILE', 'OTHER')
    ).min(1),
    weeklyTasks: Joi.array().items(weeklyTaskSchema).optional()
});

const updateStageSchema = Joi.object({
    name: Joi.string(),
    order: Joi.number(),
    description: Joi.string().allow(''),
    totalMarks: Joi.number(),
    evaluationSplit: Joi.object({
        supervisor: Joi.number().min(0).max(100),
        coordinator: Joi.number().min(0).max(100)
    }),
    allowedSubmissionTypes: Joi.array().items(
        Joi.string().valid('DOCUMENT', 'CODE_REPO', 'AI_NOTEBOOK', 'VIDEO', 'DESIGN_FILE', 'OTHER')
    ).min(1),
    weeklyTasks: Joi.array().items(weeklyTaskSchema)
}).min(1);

module.exports = {
    createStageSchema,
    updateStageSchema
};