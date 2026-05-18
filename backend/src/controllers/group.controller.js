/* ===== backend/src/controllers/group.controller.js ===== */
const groupService = require('../services/group.service');
const asyncHandler = require('../utils/asyncHandler');

const createGroup = asyncHandler(async (req, res, next) => {
    try {
        const group = await groupService.createGroup(req.body, req.user.id || req.user._id);
        const populated = await group.populate([
            { path: 'leader', select: 'name email' },
            { path: 'members', select: 'name email' }
        ]);
        res.status(201).json(populated);
    } catch (error) {
        if (error.message.includes('already in a group')) {
            return res.status(400).json({ message: error.message });
        }
        next(error);
    }
});

const joinGroup = asyncHandler(async (req, res, next) => {
    try {
        const group = await groupService.joinGroup(req.params.code, req.user.id || req.user._id);
        res.json(group);
    } catch (error) {
        if (error.message === 'Group is locked') {
            return res.status(403).json({ message: 'This group is locked and cannot accept new members.' });
        }
        if (error.message === 'Group is full') {
            return res.status(409).json({ message: 'This group has reached its maximum capacity.' });
        }
        if (error.message === 'Invalid Join Code') {
            return res.status(404).json({ message: 'Invalid Join Code' });
        }
        next(error);
    }
});

const unlockGroup = asyncHandler(async (req, res) => {
    const group = await groupService.unlockGroup(req.params.id);
    res.json(group);
});

const getGroups = asyncHandler(async (req, res) => {
    const groups = await groupService.getGroups(req.user);
    const groupsArray = Array.isArray(groups) ? groups : [groups].filter(Boolean);
    res.json(groupsArray);
});

const getGroup = asyncHandler(async (req, res, next) => {
    try {
        const group = await groupService.getGroup(req.params.id, req.user);
        if (!group) return res.status(404).json({ message: 'Group not found' });
        res.json(group);
    } catch (err) {
        if (err.message.includes('Not authorized')) {
            return res.status(403).json({ message: err.message });
        }
        next(err);
    }
});

const updateGroup = asyncHandler(async (req, res) => {
    try {
        const group = await groupService.updateGroup(req.params.id, req.body);
        res.json(group);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

const assignSupervisor = asyncHandler(async (req, res) => {
    await groupService.assignSupervisor(req.params.id, req.body.supervisorId, req.user.id || req.user._id);
    res.json({ message: 'Supervisor assigned successfully' });
});

const leaveGroup = asyncHandler(async (req, res) => {
    const group = await groupService.leaveGroup(req.params.id, req.user.id || req.user._id);
    res.json(group);
});

const deleteGroup = asyncHandler(async (req, res) => {
    await groupService.deleteGroup(req.params.id);
    res.json({ message: 'Group deleted successfully' });
});

module.exports = {
    createGroup,
    joinGroup,
    unlockGroup,
    getGroups,
    getGroup,
    updateGroup,
    assignSupervisor,
    leaveGroup,
    deleteGroup
};