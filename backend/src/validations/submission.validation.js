/* ===== backend/src/validations/submission.validation.js ===== */
const Joi = require('joi');

const createSubmissionSchema = Joi.object({
    project: Joi.string().trim().required(),
    phase: Joi.string().trim().required(),
    submissionType: Joi.string().trim().valid('DOCUMENT', 'CODE_REPO', 'AI_NOTEBOOK', 'VIDEO', 'DESIGN_FILE', 'OTHER').required(),
    attachments: Joi.array().items(Joi.any()).optional(),
    links: Joi.object({
        repo: Joi.string().allow(null, ''), 
        notebook: Joi.string().allow(null, ''), 
        liveDemo: Joi.string().allow(null, ''),
        video: Joi.string().allow(null, ''), 
        doc: Joi.string().allow(null, ''), 
        design: Joi.string().allow(null, ''), 
        other: Joi.string().allow(null, '')
    }).optional(),
    description: Joi.string().allow(''),
    parentSubmission: Joi.string().optional(),
    weeklyTask: Joi.object({ 
        weekNumber: Joi.number().min(1), 
        taskTitle: Joi.string() 
    }).optional()
});

const updateSubmissionSchema = Joi.object({
    attachments: Joi.array().items(Joi.any()).optional(),
    links: Joi.object({
        repo: Joi.string().allow(null, ''), 
        notebook: Joi.string().allow(null, ''), 
        liveDemo: Joi.string().allow(null, ''),
        video: Joi.string().allow(null, ''), 
        doc: Joi.string().allow(null, ''), 
        design: Joi.string().allow(null, ''), 
        other: Joi.string().allow(null, '')
    }),
    description: Joi.string().allow('')
});

const gradeSubmissionSchema = Joi.object({
    marks: Joi.number().required(),
    remarks: Joi.string().allow(''),
    rubric: Joi.array().items(
        Joi.object({
            criterion: Joi.string(), 
            marksObtained: Joi.number().min(0), 
            maxMarks: Joi.number().min(0), 
            feedback: Joi.string().allow('')
        })
    ).optional(),
    strengths: Joi.string().allow('').optional(),
    areasForImprovement: Joi.string().allow('').optional()
});

module.exports = {
    createSubmissionSchema,
    updateSubmissionSchema,
    gradeSubmissionSchema
};