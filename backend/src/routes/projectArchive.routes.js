/* ===== backend/src/routes/projectArchive.routes.js ===== */
const express = require('express');
const router = Router = express.Router();

const projectArchiveController = require('../controllers/projectArchive.controller');
const authenticateJWT = require('../middlewares/auth');
const { restrictTo } = require('../middlewares/rbac');
const validate = require('../middlewares/validate');
const { createArchiveSchema } = require('../validations/projectArchive.validation');

router.post('/', authenticateJWT, restrictTo('Coordinator'), validate(createArchiveSchema), projectArchiveController.createArchive);
router.get('/', authenticateJWT, projectArchiveController.getArchives);
router.get('/:id', authenticateJWT, projectArchiveController.getArchive);
router.delete('/:id', authenticateJWT, restrictTo('Coordinator'), projectArchiveController.deleteArchive);

module.exports = router;