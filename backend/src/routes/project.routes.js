/* ===== backend/src/routes/project.routes.js ===== */
const express = require('express');
const router = express.Router();

// Controllers
const projectController = require('../controllers/project.controller');

// Middlewares
const authenticateJWT = require('../middlewares/auth');
const { restrictTo } = require('../middlewares/rbac');
const validate = require('../middlewares/validate');

// Validations
const { 
    createProjectSchema, 
    updateProjectSchema 
} = require('../validations/project.validation');

// ═══════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════

// --- STATIC ROUTES (Must go before dynamic /:id routes) ---

// Get archived projects (accessible to all authenticated users)
router.get('/archive', 
    authenticateJWT, 
    projectController.getArchivedProjects
);

// Get the logged-in student's personal project
router.get('/my-project', 
    authenticateJWT, 
    restrictTo('Student'), 
    projectController.getMyProject
);

// Get projects filtered by a specific year
router.get('/year/:year', 
    authenticateJWT, 
    projectController.getProjectsByYear
);

// --- DYNAMIC ROUTES ---

// Create a new project (Student Group Leader only)
router.post('/', 
    authenticateJWT, 
    restrictTo('Student'), 
    validate(createProjectSchema), 
    projectController.createProject
);

// Get all projects based on user's role context
router.get('/', 
    authenticateJWT, 
    projectController.getProjects
);

// Get a specific project by ID
router.get('/:id', 
    authenticateJWT, 
    projectController.getProject
);

// Update a project (Content fields: Student/Supervisor/Coordinator. Auth fields: Coordinator only)
router.put('/:id', 
    authenticateJWT, 
    restrictTo('Student', 'Coordinator', 'Supervisor'), 
    validate(updateProjectSchema), 
    projectController.updateProject
);

// Delete a project (Coordinator only)
router.delete('/:id', 
    authenticateJWT, 
    restrictTo('Coordinator'), 
    projectController.deleteProject
);

module.exports = router;