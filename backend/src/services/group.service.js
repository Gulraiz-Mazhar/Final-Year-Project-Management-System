/* ===== backend/src/services/group.service.js ===== */
const mongoose = require('mongoose');
const Group = require('../models/group.model');
const User = require('../models/user.model');
const AcademicSession = require('../models/academicSession.model');

const createGroup = async (data, creatorId) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { name, batch, leader, members } = data;

        const currentSession = await AcademicSession.findOne({ isCurrent: true }).session(session);
        if (!currentSession) throw new Error('No current academic session found');

        const creator = await User.findById(creatorId).session(session);
        if (creator.group) {
            throw new Error('Action Failed: You are already in a group.');
        }

        if (leader.toString() !== creatorId.toString() && !members.includes(creatorId.toString())) {
            members.push(creatorId.toString());
        }

        const group = new Group({ name, batch, leader, members, academicSession: currentSession._id });
        await group.save({ session });

        await User.updateMany(
            { _id: { $in: group.members } },
            { group: group._id },
            { session }
        );

        await session.commitTransaction();
        return group;
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
};

const joinGroup = async (code, userId) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const user = await User.findById(userId).session(session);
        if (user.group) throw new Error('Action Failed: You are already in a group.');
        if (!user || user.role !== 'Student') throw new Error('Only students can join groups');

        const currentSession = await AcademicSession.findOne({ isCurrent: true }).session(session);
        if (!currentSession) throw new Error('No current academic session found');

        const max = currentSession.config?.maxGroupSize || 4;

        // Atomic Update: Prevents race conditions strictly at the database level
        const updatedGroup = await Group.findOneAndUpdate(
            { 
                joinCode: code, 
                isDeleted: { $ne: true },
                isLocked: false,
                [`members.${max - 1}`]: { $exists: false } // Ensures array is less than max
            },
            { $addToSet: { members: userId } },
            { new: true, session }
        );

        if (!updatedGroup) {
            const checkGroup = await Group.findOne({ joinCode: code }).notDeleted();
            if (!checkGroup) throw new Error('Invalid Join Code');
            if (checkGroup.isLocked) throw new Error('Group is locked');
            if (checkGroup.members.length >= max) throw new Error('Group is full');
            if (checkGroup.members.includes(userId)) throw new Error('Already a member');
            throw new Error('Failed to join group');
        }

        await User.findByIdAndUpdate(userId, { group: updatedGroup._id }, { session });
        await session.commitTransaction();

        return await Group.findById(updatedGroup._id)
            .populate('leader', 'name email')
            .populate('members', 'name email');
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
};

const unlockGroup = async (id) => {
    const group = await Group.findById(id).notDeleted();
    if (!group) throw new Error('Group not found');
    
    group.isLocked = false;
    group.isApproved = false;
    group.status = 'Pending';
    await group.save();
    
    return group.populate([
        { path: 'leader', select: 'name email' },
        { path: 'members', select: 'name email' }
    ]);
};

const getGroups = async (user) => {
    const currentSession = await AcademicSession.findOne({ isCurrent: true });
    if (!currentSession) return []; 

    let query = { academicSession: currentSession._id, isDeleted: { $ne: true } };

    if (user.role === 'Student') {
        query.members = user.id || user._id;
    } else if (user.role === 'Supervisor') {
        query.supervisor = user.id || user._id;
    }

    return Group.find(query)
        .populate('leader', 'name email')
        .populate('members', 'name email')
        .populate('supervisor', 'name email')
        .populate('project');
};

const getGroup = async (id, user) => {
    const group = await Group.findById(id).notDeleted()
        .populate('leader', 'name email')
        .populate('members', 'name email')
        .populate('supervisor', 'name email')
        .populate('project');

    if (!group) return null;
    if (user.role === 'Coordinator') return group;

    const userIdString = (user._id || user.id).toString();

    if (user.role === 'Supervisor') {
        if (!group.supervisor || group.supervisor._id.toString() !== userIdString) {
            throw new Error('Not authorized to view this group');
        }
        return group;
    }

    if (user.role === 'Student') {
        const isMember = group.members.some(m => (m._id ? m._id.toString() : m.toString()) === userIdString);
        if (!isMember) throw new Error('Not authorized to view this group');
        return group;
    }

    return null;
};

const updateGroup = async (id, data) => {
    const group = await Group.findById(id).notDeleted();
    if (!group) throw new Error('Group not found');

    const { name, batch, links, status, isApproved } = data;

    if (isApproved !== undefined) {
        group.isApproved = isApproved;
        group.status = isApproved ? 'Approved' : 'Pending';
        group.isLocked = isApproved; 
    } else if (status) {
        group.status = status;
        group.isApproved = (status === 'Approved');
        if (status === 'Approved') group.isLocked = true;
    }

    if (links) {
        if (!group.links) group.links = {};
        if (links.repo !== undefined) group.links.repo = links.repo;
        if (links.liveDemo !== undefined) group.links.liveDemo = links.liveDemo;
    }

    if (!group.isLocked || isApproved !== undefined) {
        if (name) group.name = name;
        if (batch) group.batch = batch;
    } else {
        if (name && name !== group.name) {
            throw new Error('Group is approved/locked. You can only update resource links.');
        }
    }

    await group.save(); 
    return group.populate([
        { path: 'leader', select: 'name email' },
        { path: 'members', select: 'name email' },
        { path: 'supervisor', select: 'name email' },
        { path: 'project' }
    ]);
};

const assignSupervisor = async (groupId, supervisorId, coordinatorId) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        await Group.assignSupervisorManually(groupId, supervisorId, coordinatorId, session);
        await session.commitTransaction();
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
};

const leaveGroup = async (groupId, userId) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const group = await Group.findById(groupId).notDeleted().session(session);
        if (!group) throw new Error('Group not found');
        if (!group.members.some(m => m.toString() === userId.toString())) {
            throw new Error('Not a member');
        }

        group.members = group.members.filter(m => m.toString() !== userId.toString());

        if (group.leader.toString() === userId.toString()) {
            if (group.members.length > 0) {
                group.leader = group.members[0];
            } else {
                group.isLocked = true;
            }
        }

        await group.save({ session });
        await User.findByIdAndUpdate(userId, { group: null }, { session });

        await session.commitTransaction();
        return group;
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
};

const deleteGroup = async (id) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const group = await Group.findById(id).notDeleted().session(session);
        if (!group) throw new Error('Group not found');

        if (group.supervisor) {
            await Group.unassignSupervisorManually(id, session);
        }

        await group.softDelete(session);

        await User.updateMany(
            { group: id },
            { group: null },
            { session }
        );

        await session.commitTransaction();
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
};

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