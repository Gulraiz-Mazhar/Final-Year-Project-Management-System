/* ===== backend/src/validations/announcement.validation.js ===== */
const Joi = require('joi');

const createAnnouncementSchema = Joi.object({
    title: Joi.string().required(),
    body: Joi.string().required(),
    targetAudience: Joi.string().valid('All', 'Student', 'Supervisor', 'Coordinator').default('All'),
    attachments: Joi.array().items(
        Joi.object({ 
            name: Joi.string(), 
            url: Joi.string() 
        })
    ).optional(),
    expiresAt: Joi.date().min('now').optional()
});

const updateAnnouncementSchema = Joi.object({
    title: Joi.string(),
    body: Joi.string(),
    targetAudience: Joi.string().valid('All', 'Student', 'Supervisor', 'Coordinator'),
    attachments: Joi.array().items(
        Joi.object({ 
            name: Joi.string(), 
            url: Joi.string() 
        })
    ).optional(),
    expiresAt: Joi.date().min('now')
}).min(1); // Require at least one field to be updated

module.exports = {
    createAnnouncementSchema,
    updateAnnouncementSchema
};