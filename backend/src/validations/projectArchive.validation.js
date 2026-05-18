/* ===== backend/src/validations/projectArchive.validation.js ===== */
const Joi = require('joi');

const createArchiveSchema = Joi.object({
    projectRef: Joi.string().hex().length(24).required(),
    snapshot: Joi.object().required(),
    year: Joi.number().required()
});

module.exports = {
    createArchiveSchema
};