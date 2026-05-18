/* ===== backend/src/services/evaluationOverride.service.js ===== */
const mongoose = require('mongoose');
const EvaluationOverride = require('../models/EvaluationOverride');

const createOverride = async (data, coordinatorId) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { targetEvaluation, evaluationModel, fieldOverridden, overriddenValue } = data;

        const TargetModel = mongoose.model(evaluationModel);
        const targetDoc = await TargetModel.findById(targetEvaluation).session(session);

        if (!targetDoc) throw new Error(`${evaluationModel} record not found`);

        const originalValue = fieldOverridden.split('.').reduce((obj, key) => obj?.[key], targetDoc);

        // Mutate the specific nested path on the target document
        targetDoc.set(fieldOverridden, overriddenValue);

        // Force downstream mathematical recalculation if overriding a student's submission grade
        if (evaluationModel === 'Submission' && fieldOverridden.includes('marks')) {
            const ProjectStage = mongoose.model('ProjectStage');
            const stage = await ProjectStage.findById(targetDoc.phase).session(session);
            
            if (stage) {
                const supWeight = stage.evaluationSplit?.supervisor || 0;
                const coWeight = stage.evaluationSplit?.coordinator || 0;
                const supMarks = targetDoc.evaluation?.supervisor?.marks || 0;
                const coMarks = targetDoc.evaluation?.coordinator?.marks || 0;
                
                targetDoc.evaluation.totalMarks = parseFloat(
                    ((supMarks * (supWeight / 100)) + (coMarks * (coWeight / 100))).toFixed(2)
                );
            }
        }

        await targetDoc.save({ session });

        const override = new EvaluationOverride({
            ...data,
            originalValue,
            overriddenBy: coordinatorId,
            overriddenByRole: 'Coordinator',
            originalEvaluator: targetDoc.evaluation?.coordinator?.evaluator || targetDoc.evaluation?.supervisor?.evaluator || null
        });

        await override.save({ session });

        await session.commitTransaction();
        return override;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const getOverrides = async (user) => {
    let filter = { isDeleted: { $ne: true } };

    if (user.role === 'Supervisor') {
        filter.originalEvaluator = user.id || user._id;
    }

    return EvaluationOverride.find(filter)
        .populate('overriddenBy', 'name email')
        .populate('originalEvaluator', 'name email')
        .sort({ overriddenAt: -1 });
};

const acknowledgeOverride = async (id, supervisorId, data) => {
    const override = await EvaluationOverride.findById(id).notDeleted();
    if (!override) throw new Error('Override record not found');

    if (override.originalEvaluator && override.originalEvaluator.toString() !== supervisorId.toString()) {
        throw new Error('Not authorized to acknowledge this override');
    }

    override.status = 'Acknowledged';
    override.acknowledgment = {
        acknowledgedBy: supervisorId,
        acknowledgedAt: new Date(),
        comments: data.comments || ''
    };

    await override.save();
    return override;
};

const revertOverride = async (id) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const override = await EvaluationOverride.findById(id).notDeleted().session(session);
        if (!override) throw new Error('Override record not found');
        if (override.status === 'Reverted') throw new Error('Override has already been reverted');

        const TargetModel = mongoose.model(override.evaluationModel);
        const targetDoc = await TargetModel.findById(override.targetEvaluation).session(session);
        
        if (targetDoc) {
            targetDoc.set(override.fieldOverridden, override.originalValue);
            await targetDoc.save({ session });
        }

        override.status = 'Reverted';
        await override.save({ session });

        await session.commitTransaction();
        return override;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

module.exports = {
    createOverride,
    getOverrides,
    acknowledgeOverride,
    revertOverride
};