/* ===== backend/src/validations/academicSession.validation.js ===== */
const Joi = require('joi');

const phase = Joi.object({
    stage: Joi.string().required(),
    startDate: Joi.date().required(),
    deadline: Joi.date().required(),
    isSubmissionOpen: Joi.boolean().default(true)
});

const createSessionSchema = Joi.object({
    name: Joi.string().required(),
    startDate: Joi.date().required(),
    endDate: Joi.date().required(),
    isCurrent: Joi.boolean().default(false),
    config: Joi.object({
        maxGroupSize: Joi.number().min(2).default(4),
        gradingSystem: Joi.string().valid('LETTER_GRADE', 'GPA').default('LETTER_GRADE'),
        gradingAuthority: Joi.string().valid('HYBRID', 'SUPERVISOR_ONLY', 'COORDINATOR_ONLY').default('HYBRID'),
        autoAssignSupervisor: Joi.boolean().default(true),
        isSupervisorGradingEnabled: Joi.boolean().default(true),
        doMeetingsAffectGraceMarks: Joi.boolean().default(true),
        defaultEvaluationSplit: Joi.object({
            supervisor: Joi.number().min(0).max(100).default(40),
            coordinator: Joi.number().min(0).max(100).default(60)
        }).optional(),
        maxGraceMarksPerMeeting: Joi.number().default(5),
        maxTotalGraceMarks: Joi.number().default(20),
        gradeLockingAuthority: Joi.string().valid('Coordinator', 'Both').default('Coordinator')
    }).optional(),
    timeline: Joi.array().items(phase).optional()
});

const updateSessionSchema = Joi.object({
    name: Joi.string().optional(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    isCurrent: Joi.boolean().optional(),
    config: Joi.object({
        maxGroupSize: Joi.number().min(2).optional(),
        gradingSystem: Joi.string().valid('LETTER_GRADE', 'GPA').optional(),
        gradingAuthority: Joi.string().valid('HYBRID', 'SUPERVISOR_ONLY', 'COORDINATOR_ONLY').optional(),
        autoAssignSupervisor: Joi.boolean().optional(),
        isSupervisorGradingEnabled: Joi.boolean().optional(),
        doMeetingsAffectGraceMarks: Joi.boolean().optional(),
        defaultEvaluationSplit: Joi.object({
            supervisor: Joi.number().min(0).max(100),
            coordinator: Joi.number().min(0).max(100)
        }).optional(),
        maxGraceMarksPerMeeting: Joi.number().optional(),
        maxTotalGraceMarks: Joi.number().optional(),
        gradeLockingAuthority: Joi.string().valid('Coordinator', 'Both').optional()
    }).optional(),
    timeline: Joi.array().items(phase).optional()
}).min(1);

module.exports = {
    createSessionSchema,
    updateSessionSchema
};