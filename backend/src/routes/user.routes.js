/* ===== backend/src/routes/user.routes.js ===== */
const express = require('express');
const router = express.Router();

const userController = require('../controllers/user.controller');
const authenticateJWT = require('../middlewares/auth');
const { restrictTo } = require('../middlewares/rbac');
const validate = require('../middlewares/validate');
const { 
    registerSchema, 
    loginSchema, 
    selfUpdateSchema, 
    adminUpdateSchema, 
    updateLimitSchema 
} = require('../validations/user.validation');

router.post('/register', validate(registerSchema), userController.registerUser);
router.post('/login', validate(loginSchema), userController.loginUser);
router.get('/profile', authenticateJWT, userController.getProfile);
router.put('/me', authenticateJWT, validate(selfUpdateSchema), userController.selfUpdateUser);

// Admin / Coordinator Only Infrastructure
router.get('/', authenticateJWT, restrictTo('Coordinator'), userController.getAllUsers);
router.put('/:id', authenticateJWT, restrictTo('Coordinator'), validate(adminUpdateSchema), userController.adminUpdateUser);
router.delete('/:id', authenticateJWT, restrictTo('Coordinator'), userController.deleteUser);
router.put('/:id/limit', authenticateJWT, restrictTo('Coordinator'), validate(updateLimitSchema), userController.updateSupervisorLimit);

// Cross-role utilities
router.get('/students', authenticateJWT, restrictTo('Student', 'Coordinator', 'Supervisor'), userController.getStudents);

module.exports = router;