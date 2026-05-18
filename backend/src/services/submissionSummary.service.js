/* ===== backend/src/services/submissionSummary.service.js ===== */
const SubmissionSummary = require('../models/submissionSummary.model');
const Group = require('../models/group.model');
const Project = require('../models/project.model');

const getSummaries = async (user) => {
    let filter = { isDeleted: { $ne: true } };

    if (user.role === 'Student') {
        const groups = await Group.find({ members: user.id || user._id }).select('_id');
        const projects = await Project.find({ group: { $in: groups.map(g => g._id) } }).select('_id');
        filter.project = { $in: projects.map(p => p._id) };
    } else if (user.role === 'Supervisor') {
        const groups = await Group.find({ supervisor: user.id || user._id }).select('_id');
        const projects = await Project.find({ group: { $in: groups.map(g => g._id) } }).select('_id');
        filter.project = { $in: projects.map(p => p._id) };
    }

    return SubmissionSummary.find(filter)
        .populate('project', 'title')
        .populate('phase', 'name')
        .sort({ lastUpdated: -1 });
};

const getSummaryByProject = async (projectId, user) => {
    const userIdString = (user.id || user._id).toString();

    if (user.role === 'Student') {
        const group = await Group.findOne({ members: userIdString, project: projectId });
        if (!group) throw new Error('Not authorized to view dashboard analytics for this project.');
    } else if (user.role === 'Supervisor') {
        const group = await Group.findOne({ supervisor: userIdString, project: projectId });
        if (!group) throw new Error('Not authorized to view dashboard analytics for this project.');
    }

    return SubmissionSummary.find({ project: projectId, isDeleted: { $ne: true } })
        .populate('phase', 'name')
        .sort({ lastUpdated: -1 });
};

module.exports = {
    getSummaries,
    getSummaryByProject
};