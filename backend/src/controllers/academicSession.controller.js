/* ===== backend/src/controllers/academicSession.controller.js ===== */
const academicSessionService = require('../services/academicSession.service');
const asyncHandler = require('../utils/asyncHandler');

const createSession = asyncHandler(async (req, res) => {
    const session = await academicSessionService.createSession(req.body);
    res.status(201).json(session);
});

const getSessions = asyncHandler(async (req, res) => {
    const sessions = await academicSessionService.getSessions();
    res.json(sessions);
});

const getCurrentSession = asyncHandler(async (req, res) => {
    const session = await academicSessionService.getCurrentSession();
    res.json(session || null);
});

const updateSession = asyncHandler(async (req, res) => {
    const session = await academicSessionService.updateSession(req.params.id, req.body);
    res.json(session);
});

const deleteSession = asyncHandler(async (req, res) => {
    await academicSessionService.deleteSession(req.params.id);
    res.json({ message: 'Session deleted successfully' });
});

module.exports = {
    createSession,
    getSessions,
    getCurrentSession,
    updateSession,
    deleteSession
};