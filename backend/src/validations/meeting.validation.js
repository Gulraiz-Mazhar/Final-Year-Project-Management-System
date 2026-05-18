/* ===== backend/src/validations/meeting.validation.js ===== */
const Joi = require('joi');

const createMeetingSchema = Joi.object({
    title: Joi.string().required(),
    description: Joi.string().allow('').optional(),
    location: Joi.string().allow('').optional(),
    group: Joi.string().hex().length(24).required(),
    scheduledDate: Joi.date().required(),
    duration: Joi.number().optional(),
    mode: Joi.string().valid('In-Person', 'Online', 'Hybrid').default('In-Person'),
    agenda: Joi.string().allow('').optional(),
    status: Joi.string().valid('Scheduled', 'Completed', 'Cancelled', 'Rescheduled', 'No-Show').default('Scheduled'),
    attendees: Joi.array().items(Joi.string().hex().length(24)).optional()
});

const updateMeetingSchema = Joi.object({
    title: Joi.string(),
    description: Joi.string().allow(''),
    location: Joi.string().allow(''),
    scheduledDate: Joi.date(),
    actualDate: Joi.date(),
    duration: Joi.number(),
    mode: Joi.string().valid('In-Person', 'Online', 'Hybrid'),
    status: Joi.string().valid('Scheduled', 'Completed', 'Cancelled', 'Rescheduled', 'No-Show'),
    agenda: Joi.string().allow(''),
    minutesOfMeeting: Joi.string().allow(''),
    attendees: Joi.array().items(Joi.string().hex().length(24)),
    absentees: Joi.array().items(Joi.string().hex().length(24)),
    actionItems: Joi.array().items(
        Joi.object({
            task: Joi.string(),
            assignedTo: Joi.string().hex().length(24),
            dueDate: Joi.date(),
            status: Joi.string().valid('Pending', 'Completed').default('Pending')
        })
    ),
    attachments: Joi.array().items(
        Joi.object({ 
            name: Joi.string(), 
            url: Joi.string() 
        })
    )
}).min(1);

module.exports = {
    createMeetingSchema,
    updateMeetingSchema
};