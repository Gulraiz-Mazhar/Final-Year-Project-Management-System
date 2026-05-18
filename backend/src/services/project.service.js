/* ===== backend/src/services/project.service.js ===== */
const Project = require('../models/project.model');
const Group = require('../models/group.model');
const ProjectStage = require('../models/projectStage.model');
const AcademicSession = require('../models/academicSession.model');
const notificationService = require('./notification.service');

const createProject = async (data, creatorId) => {
    const group = await Group.findById(data.group);
    if (!group) throw new Error('Group not found');

    if (group.leader.toString() !== creatorId.toString()) {
        throw new Error('Only the group leader can submit a project proposal');
    }

    const initialStage = await ProjectStage.findOne({ isDeleted: false }).sort({ order: 1 });
    if (!initialStage) {
        throw new Error('System Error: No Project Stages found. Please ask the Coordinator to setup stages.');
    }

    const project = new Project({
        ...data,
        currentStage: initialStage._id,
        status: 'Pending',
        isIdeaApproved: false
    });

    const savedProject = await project.save();

    group.project = savedProject._id;
    await group.save();

    return savedProject;
};

const getProjects = async (user) => {
    const currentSession = await AcademicSession.findOne({ isCurrent: true });
    if (!currentSession) return [];

    let groupQuery = { academicSession: currentSession._id, isDeleted: { $ne: true } };

    if (user.role === 'Student') {
        groupQuery.members = user.id || user._id;
    } else if (user.role === 'Supervisor') {
        groupQuery.supervisor = user.id || user._id;
    }

    const activeGroups = await Group.find(groupQuery).select('_id');
    const activeGroupIds = activeGroups.map(g => g._id);

    return Project.find({ group: { $in: activeGroupIds }, isDeleted: { $ne: true } })
        .populate('group')
        .populate('currentStage');
};

const getProject = async (id) => {
    return Project.findById(id).notDeleted().populate('group currentStage');
};

const updateProject = async (id, data, user) => {
    const project = await Project.findById(id).notDeleted();
    if (!project) throw new Error('Project not found');

    const previousStatus = project.status;

    const contentFields = ['title', 'description', 'category', 'techStack', 'visibility'];
    const authorityFields = ['status', 'isIdeaApproved', 'remarks', 'supervisor'];

    const updatePayload = {};

    // Always allow content fields
    for (const key of contentFields) {
        if (data[key] !== undefined) updatePayload[key] = data[key];
    }

    // Authority fields: Coordinator only
    if (user.role === 'Coordinator') {
        for (const key of authorityFields) {
            if (data[key] !== undefined) updatePayload[key] = data[key];
        }
    }
    
    // Ownership checks
    let group = null;
    if (user.role === 'Student') {
        group = await Group.findOne({ members: user._id || user.id, project: id }).notDeleted();
        if (!group) throw new Error('Not authorized to edit this project');
    }

    if (user.role === 'Supervisor') {
        group = await Group.findOne({ supervisor: user._id || user.id, project: id }).notDeleted();
        if (!group) throw new Error('Not authorized to edit this project');
    }

    const updatedProject = await Project.findByIdAndUpdate(id, updatePayload, { new: true }).populate('currentStage');

    // Notification Logic on Status Change
    if (user.role === 'Coordinator' && data.status && data.status !== previousStatus) {
        const targetGroup = await Group.findById(updatedProject.group);
        if (targetGroup) {
            let notifType = 'INFO';
            let title = 'Project Status Updated';
            if (data.status === 'Approved') { notifType = 'SUCCESS'; title = 'Project Approved!'; }
            if (data.status === 'Rejected') { notifType = 'ERROR'; title = 'Project Rejected'; }
            if (data.status === 'Changes Requested') { notifType = 'WARNING'; title = 'Changes Requested on Project'; }

            for (const memberId of targetGroup.members) {
                await notificationService.createNotification({
                    recipient: memberId,
                    type: notifType,
                    title: title,
                    message: `Your project proposal "${updatedProject.title}" is now marked as: ${data.status}.`
                });
            }
        }
    }

    return updatedProject;
};

const deleteProject = async (id) => {
    const project = await Project.findById(id).notDeleted();
    if (!project) throw new Error('Project not found');

    await Group.updateOne({ project: id }, { $unset: { project: 1 } });
    await project.softDelete();
};

const getProjectsByYear = async (year) => {
    return Project.findByYear(year);
};

const getMyProject = async (userId) => {
    const group = await Group.findOne({ members: userId }).notDeleted();
    if (!group || !group.project) return null;
    return Project.findById(group.project)
        .notDeleted()
        .populate('currentStage')
        .populate({
            path: 'group',
            populate: { path: 'members supervisor', select: 'name email' }
        });
};

const getArchivedProjects = async () => {
    const pastSessions = await AcademicSession.find({ isCurrent: false }).select('_id name');
    const pastSessionIds = pastSessions.map(s => s._id);

    const pastGroups = await Group.find({ academicSession: { $in: pastSessionIds } }).select('_id academicSession name');
    const pastGroupIds = pastGroups.map(g => g._id);

    const archivedProjects = await Project.find({ 
        group: { $in: pastGroupIds },
        status: 'Approved', 
        isDeleted: false 
    })
    .populate('group', 'name')
    .populate('supervisor', 'name email');

    return archivedProjects.map(proj => {
        const group = pastGroups.find(g => g._id.toString() === proj.group?._id?.toString());
        const session = pastSessions.find(s => s._id.toString() === group?.academicSession?.toString());
        return {
            ...proj.toObject(),
            sessionName: session ? session.name : 'Archived Session'
        };
    });
};

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