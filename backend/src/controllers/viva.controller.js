/* ===== backend/src/controllers/viva.controller.js ===== */
const vivaService = require('../services/vivaService');
const Group = require('../models/group.model');
const Project = require('../models/project.model');
const VivaSession = require('../models/vivaSession.model');
const asyncHandler = require('../utils/asyncHandler');

const startViva = asyncHandler(async (req, res) => {
    const { devMode } = req.body;
    const studentId = req.user._id || req.user.id;

    const group = await Group.findOne({ members: studentId }).notDeleted();
    if (!group) throw new Error("You must be in a group to start a viva.");
    if (!group.project) throw new Error("Your group does not have a project assigned.");

    const project = await Project.findById(group.project).notDeleted();
    if (!project) throw new Error("Project not found.");

    const result = await vivaService.startSession(req.user, group, project, devMode);
    res.status(201).json(result);
});

const chatMessage = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const { message } = req.body;
    const studentId = req.user._id || req.user.id;

    const result = await vivaService.handleChatMessage(sessionId, studentId, message);
    res.json(result);
});

const endViva = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const studentId = req.user._id || req.user.id;

    const evaluation = await vivaService.evaluateSession(sessionId, studentId);
    res.json(evaluation);
});

const getResults = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    
    const sessions = await VivaSession.find({ 
        project: projectId, 
        status: 'Completed' 
    }).populate('student', 'name email universityId');

    res.json(sessions);
});

module.exports = {
    startViva,
    chatMessage,
    endViva,
    getResults
};