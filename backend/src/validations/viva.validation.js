/* ===== backend/src/validations/viva.validation.js ===== */
const Joi = require('joi');

const startVivaSchema = Joi.object({
    devMode: Joi.boolean().default(false)
});

const chatSchema = Joi.object({
    message: Joi.string().required().trim()
});

module.exports = {
    startVivaSchema,
    chatSchema
};