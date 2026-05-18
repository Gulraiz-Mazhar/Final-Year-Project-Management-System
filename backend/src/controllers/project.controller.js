/* ===== backend/src/controllers/project.controller.js ===== */
const projectService = require('../services/project.service');
const asyncHandler = require('../utils/asyncHandler');

const createProject = asyncHandler(async (req, res) => {
    const project = await projectService.createProject(req.body, req.user.id || req.user._id);
    res.status(201).json(project);
});

const getProjects = asyncHandler(async (req, res) => {
    const projects = await projectService.getProjects(req.user);
    res.json(projects);
});

const getProject = asyncHandler(async (req, res) => {
    const project = await projectService.getProject(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json(project);
});

const updateProject = asyncHandler(async (req, res) => {
    const project = await projectService.updateProject(req.params.id, req.body, req.user);
    res.json(project);
});

const deleteProject = asyncHandler(async (req, res) => {
    await projectService.deleteProject(req.params.id);
    res.json({ message: 'Project deleted successfully' });
});

const getProjectsByYear = asyncHandler(async (req, res) => {
    const projects = await projectService.getProjectsByYear(req.params.year);
    res.json(projects);
});

const getMyProject = asyncHandler(async (req, res) => {
    const project = await projectService.getMyProject(req.user.id || req.user._id);
    res.json(project);
});

const getArchivedProjects = asyncHandler(async (req, res) => {
    const archives = await projectService.getArchivedProjects();
    res.json(archives);
});

module.exports = {
    createProject,
    getProjects,
    getProject,
    updateProject,
    deleteProject,
    getProjectsByYear,
    getMyProject,
    getArchivedProjects
};