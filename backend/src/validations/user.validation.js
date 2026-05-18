/* ===== backend/src/validations/user.validation.js ===== */
const Joi = require('joi');

const registerSchema = Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    password: Joi.string().required(),
    role: Joi.string().valid('Student', 'Supervisor', 'Coordinator').required(),
    universityId: Joi.string().when('role', { is: 'Student', then: Joi.required() }),
    batch: Joi.string().when('role', { is: 'Student', then: Joi.required() }),
    department: Joi.string().optional(),
    maxGroupsSupervising: Joi.number().when('role', { is: 'Supervisor', then: Joi.required() })
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
    role: Joi.string().valid('Student', 'Supervisor', 'Coordinator').required()
}); 

const selfUpdateSchema = Joi.object({
    name: Joi.string(),
    department: Joi.string(),
    password: Joi.string()
});

const adminUpdateSchema = Joi.object({
    name: Joi.string(),
    email: Joi.string().email(),
    password: Joi.string(),
    batch: Joi.string(),
    department: Joi.string(),
    maxGroupsSupervising: Joi.number()
});

const updateLimitSchema = Joi.object({
    newLimit: Joi.number().required()
});

module.exports = {
    registerSchema,
    loginSchema,
    selfUpdateSchema,
    adminUpdateSchema,
    updateLimitSchema
};