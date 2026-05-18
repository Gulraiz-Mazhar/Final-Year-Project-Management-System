/* ===== backend/src/validations/group.validation.js ===== */
const Joi = require('joi');

const createGroupSchema = Joi.object({
    name: Joi.string().required(),
    batch: Joi.string().allow('', null).optional(),
    leader: Joi.string().hex().length(24).required(),
    members: Joi.array().items(Joi.string().hex().length(24)).min(1).required()
});

const updateGroupSchema = Joi.object({
    name: Joi.string(),
    batch: Joi.string().allow('', null),
    links: Joi.object({
        repo: Joi.string().allow('', null),
        liveDemo: Joi.string().allow('', null)
    }),
    status: Joi.string().valid('Pending', 'Approved', 'Rejected'),
    isApproved: Joi.boolean()
});

const assignSupervisorSchema = Joi.object({
    supervisorId: Joi.string().hex().length(24).required()
});

module.exports = {
    createGroupSchema,
    updateGroupSchema,
    assignSupervisorSchema
};