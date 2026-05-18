/* ===== backend/src/validations/finalEvaluation.validation.js ===== */
const Joi = require('joi');

const createEvaluationSchema = Joi.object({
    project: Joi.string().hex().length(24).required(),
    group: Joi.string().hex().length(24).required(),
    academicSession: Joi.string().hex().length(24).required(),
    evaluationType: Joi.string().valid('Mid-Semester', 'Final', 'Re-Evaluation', 'Viva').required(),
    weightDistribution: Joi.object({
        weeklyTasks: Joi.number().min(0).max(100).default(70),
        finalComponent: Joi.number().min(0).max(100).default(30)
    }).optional()
});

const supervisorEvalSchema = Joi.object({
    marks: Joi.number().min(0).required(),
    maxMarks: Joi.number().min(0).required(),
    breakdown: Joi.object({
        technicalImplementation: Joi.number().min(0),
        innovation: Joi.number().min(0),
        documentation: Joi.number().min(0),
        presentation: Joi.number().min(0),
        overallQuality: Joi.number().min(0)
    }).optional(),
    remarks: Joi.string().allow(''),
    strengths: Joi.string().allow(''),
    weaknesses: Joi.string().allow('')
});

const coordinatorEvalSchema = Joi.object({
    marks: Joi.number().min(0).required(),
    maxMarks: Joi.number().min(0).required(),
    breakdown: Joi.object({
        projectScope: Joi.number().min(0),
        technicalDepth: Joi.number().min(0),
        innovation: Joi.number().min(0),
        presentation: Joi.number().min(0),
        vivaPerformance: Joi.number().min(0)
    }).optional(),
    remarks: Joi.string().allow(''),
    strengths: Joi.string().allow(''),
    weaknesses: Joi.string().allow('')
});

const vivaDetailsSchema = Joi.object({
    date: Joi.date().required(),
    duration: Joi.number().optional(),
    panelMembers: Joi.array().items(Joi.string().hex().length(24)).optional(),
    vivaRemarks: Joi.string().allow('').optional()
});

module.exports = {
    createEvaluationSchema,
    supervisorEvalSchema,
    coordinatorEvalSchema,
    vivaDetailsSchema
};