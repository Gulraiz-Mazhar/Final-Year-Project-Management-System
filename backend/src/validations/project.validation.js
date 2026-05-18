/* ===== backend/src/validations/project.validation.js ===== */
const Joi = require('joi');

const createProjectSchema = Joi.object({
    title: Joi.string().required().trim(),
    description: Joi.string().allow(''),
    category: Joi.string().required(),
    techStack: Joi.array().items(Joi.string()),
    year: Joi.number().required(),
    supervisor: Joi.string().hex().length(24).optional(),
    group: Joi.string().hex().length(24).required(),
    visibility: Joi.string().valid('Internal', 'Public').default('Internal')
});

// Validator allows all fields through — role filtering happens securely in the service layer
const updateProjectSchema = Joi.object({
    title: Joi.string(),
    description: Joi.string(),
    category: Joi.string(),
    techStack: Joi.array().items(Joi.string()),
    visibility: Joi.string().valid('Internal', 'Public'),
    supervisor: Joi.string().hex().length(24),
    isIdeaApproved: Joi.boolean(),
    remarks: Joi.string().allow('', null),
    status: Joi.string().valid('Pending', 'Approved', 'Rejected', 'Changes Requested')
}).min(1);

module.exports = {
    createProjectSchema,
    updateProjectSchema
};