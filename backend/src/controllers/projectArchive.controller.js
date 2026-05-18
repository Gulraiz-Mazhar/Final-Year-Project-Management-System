/* ===== backend/src/controllers/projectArchive.controller.js ===== */
const projectArchiveService = require('../services/projectArchive.service');
const asyncHandler = require('../utils/asyncHandler');

const createArchive = asyncHandler(async (req, res) => {
    const archive = await projectArchiveService.createArchive(req.body);
    res.status(201).json(archive);
});

const getArchives = asyncHandler(async (req, res) => {
    const archives = await projectArchiveService.getArchives(req.user);
    res.json(archives);
});

const getArchive = asyncHandler(async (req, res, next) => {
    try {
        const archive = await projectArchiveService.getArchive(req.params.id, req.user);
        if (!archive) return res.status(404).json({ message: 'Archive not found' });
        res.json(archive);
    } catch (err) {
        if (err.message.includes('Not authorized')) {
            return res.status(403).json({ message: err.message });
        }
        next(err);
    }
});

const deleteArchive = asyncHandler(async (req, res) => {
    await projectArchiveService.deleteArchive(req.params.id);
    res.json({ message: 'Archive record deleted successfully' });
});

module.exports = {
    createArchive,
    getArchives,
    getArchive,
    deleteArchive
};