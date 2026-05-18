/* ===== backend/src/validations/notification.validation.js ===== */
const Joi = require('joi');

const createNotificationSchema = Joi.object({
    recipient: Joi.string().hex().length(24).required(),
    type: Joi.string().valid('INFO', 'SUCCESS', 'WARNING', 'ERROR').default('INFO'),
    title: Joi.string().required(),
    message: Joi.string().required(),
    relatedLink: Joi.string().allow('', null).optional()
});

module.exports = {
    createNotificationSchema
};