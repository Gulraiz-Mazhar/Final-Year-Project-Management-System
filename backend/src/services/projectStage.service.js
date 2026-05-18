/* ===== backend/src/services/projectStage.service.js ===== */
const ProjectStage = require('../models/projectStage.model');

const createStage = async (data) => {
    const stage = new ProjectStage(data);
    await stage.save(); // Note: pre('save') hook in the model validates evaluation splits
    return stage;
};

const getStages = async () => {
    return ProjectStage.find().notDeleted().sort({ order: 1 });
};

const getStage = async (id) => {
    return ProjectStage.findById(id).notDeleted();
};

const updateStage = async (id, data) => {
    // We fetch the document first so the Mongoose pre('save') hook runs
    const stage = await ProjectStage.findById(id).notDeleted();
    if (!stage) throw new Error('Stage not found');

    if (data.name !== undefined)                  stage.name = data.name;
    if (data.order !== undefined)                 stage.order = data.order;
    if (data.description !== undefined)           stage.description = data.description;
    if (data.totalMarks !== undefined)            stage.totalMarks = data.totalMarks;
    if (data.evaluationSplit !== undefined)       stage.evaluationSplit = data.evaluationSplit;
    if (data.allowedSubmissionTypes !== undefined) stage.allowedSubmissionTypes = data.allowedSubmissionTypes;
    if (data.weeklyTasks !== undefined)           stage.weeklyTasks = data.weeklyTasks;

    await stage.save(); 
    return stage;
};

const deleteStage = async (id) => {
    const stage = await ProjectStage.findById(id).notDeleted();
    if (!stage) throw new Error('Stage not found');
    await stage.softDelete();
    return stage;
};

module.exports = {
    createStage,
    getStages,
    getStage,
    updateStage,
    deleteStage
};