/* ===== backend/src/services/projectArchive.service.js ===== */
const ProjectArchive = require('../models/projectArchive.model');
const Group = require('../models/group.model');

const createArchive = async (data) => {
    const archive = new ProjectArchive(data);
    await archive.save();
    return archive;
};

const getArchives = async (user) => {
    let filter = { isDeleted: { $ne: true } };

    // Role scoping matching original business rules
    if (user.role === 'Student') {
        const grp = await Group.findOne({ members: user.id || user._id }).notDeleted();
        if (!grp || !grp.project) return [];
        filter.projectRef = grp.project;
    }

    return ProjectArchive.find(filter)
        .populate('projectRef', 'title category year')
        .sort({ archivedAt: -1 });
};

const getArchive = async (id, user) => {
    const archive = await ProjectArchive.findById(id).notDeleted()
        .populate('projectRef', 'title category year');

    if (!archive) return null;

    if (user.role === 'Student') {
        const grp = await Group.findOne({ members: user.id || user._id }).notDeleted();
        if (!grp || !grp.project || grp.project.toString() !== archive.projectRef?.toString()) {
            throw new Error('Not authorized to access this archive');
        }
    }

    return archive;
};

const deleteArchive = async (id) => {
    const archive = await ProjectArchive.findById(id).notDeleted();
    if (!archive) throw new Error('Archive not found');
    await archive.softDelete();
    return archive;
};

module.exports = {
    createArchive,
    getArchives,
    getArchive,
    deleteArchive
};