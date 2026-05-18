/* ===== backend/src/routes/submission.routes.js ===== */
const express = require('express');
const router = express.Router();
const multer = require('multer');

// Controllers
const submissionController = require('../controllers/submission.controller');

// Middlewares
const authenticateJWT = require('../middlewares/auth');
const { restrictTo } = require('../middlewares/rbac');
const validate = require('../middlewares/validate');
const { storage } = require('../config/cloudinary');

// Validations
const { 
    createSubmissionSchema, 
    updateSubmissionSchema, 
    gradeSubmissionSchema 
} = require('../validations/submission.validation');

// --- Multer Configuration ---
const upload = multer({ 
    storage: storage,
    limits: { 
        fileSize: 25 * 1024 * 1024, // 25MB per file
        files: 5 // Max 5 files
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/pdf', 
            'application/zip', 
            'application/x-zip-compressed',
            'image/jpeg', 
            'image/png'
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Security Policy Violation: File type ${file.mimetype} is not permitted.`));
        }
    }
});

// Custom Form-Data Parser Middleware
const parseFormDataPayload = (req, res, next) => {
    try {
        if (req.body.links && typeof req.body.links === 'string') {
            req.body.links = JSON.parse(req.body.links);
        }
        if (req.body.weeklyTask && typeof req.body.weeklyTask === 'string') {
            req.body.weeklyTask = JSON.parse(req.body.weeklyTask);
        }
        if (req.files && req.files.length > 0) {
            req.body.attachments = req.files.map(file => ({
                name: file.originalname, 
                url: file.path, 
                size: file.size, 
                publicId: file.filename
            }));
        } else {
            delete req.body.attachments;
        }
        next();
    } catch (err) {
        return res.status(400).json({ message: 'Invalid format in form data' });
    }
};

// ═══════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════

// --- Core Submission Routes ---

// Create Submission (Student only)
router.post('/', 
    authenticateJWT, 
    restrictTo('Student'), 
    upload.array('attachments', 5), 
    parseFormDataPayload, 
    validate(createSubmissionSchema), 
    submissionController.createSubmission
);

// Get all submissions based on user context
router.get('/', 
    authenticateJWT, 
    submissionController.getSubmissions
);

// Get single submission by ID
router.get('/:id', 
    authenticateJWT, 
    submissionController.getSubmissionById
);

// Update a submission (Student only)
router.put('/:id', 
    authenticateJWT, 
    restrictTo('Student'), 
    upload.array('attachments', 5), 
    parseFormDataPayload, 
    validate(updateSubmissionSchema), 
    submissionController.updateSubmission
);

// Grade a submission (Supervisor or Coordinator)
router.patch('/:id/grade', 
    authenticateJWT, 
    restrictTo('Supervisor', 'Coordinator'), 
    validate(gradeSubmissionSchema), 
    submissionController.gradeSubmission
);

// Delete a submission (Coordinator only)
router.delete('/:id', 
    authenticateJWT, 
    restrictTo('Coordinator'), 
    submissionController.deleteSubmission
);

// --- Copyleaks Integrity Routes ---

router.post('/:id/trigger-scan', 
    authenticateJWT, 
    restrictTo('Coordinator'), 
    submissionController.triggerCopyleaksScan
);

router.get('/:id/check-integrity', 
    authenticateJWT, 
    restrictTo('Coordinator'), 
    submissionController.checkCopyleaksIntegrity
);

// Webhook for Copyleaks API (No JWT Auth, relies on secret headers)
router.post('/webhook/:id/:status', 
    submissionController.handleCopyleaksWebhook
);

router.get('/:id/download-report', 
    authenticateJWT, 
    restrictTo('Coordinator'), 
    submissionController.getCopyleaksReportStream
);

module.exports = router;