/* ===== backend/src/services/finalEvaluation.service.js ===== */
const FinalEvaluation = require('../models/FinalEvaluation');
const Group = require('../models/group.model');
const Meeting = require('../models/Meeting');
const ProjectStage = require('../models/projectStage.model');
const Submission = require('../models/submission.model');
const AcademicSession = require('../models/academicSession.model');

const createFinalEvaluation = async (data) => {
    const evaluation = new FinalEvaluation(data);
    await evaluation.save();
    return evaluation;
};

const getFinalEvaluations = async (user) => {
    let filter = { isDeleted: { $ne: true } };

    if (user.role === 'Student') {
        const grp = await Group.findOne({ members: user.id || user._id }).notDeleted();
        if (!grp || !grp.project) return [];
        filter.project = grp.project;
    } else if (user.role === 'Supervisor') {
        const groups = await Group.find({ supervisor: user.id || user._id }).notDeleted().select('project');
        filter.project = { $in: groups.map(g => g.project).filter(Boolean) };
    }

    return FinalEvaluation.find(filter)
        .populate('project', 'title')
        .populate('group', 'name')
        .populate('supervisorEvaluation.evaluator', 'name email')
        .populate('coordinatorEvaluation.evaluator', 'name email')
        .sort({ createdAt: -1 });
};

const getFinalEvaluation = async (id) => {
    return FinalEvaluation.findById(id)
        .notDeleted()
        .populate('project', 'title')
        .populate('group', 'name')
        .populate('supervisorEvaluation.evaluator', 'name email')
        .populate('coordinatorEvaluation.evaluator', 'name email');
};

const submitSupervisorEvaluation = async (id, data, supervisorId) => {
    const evaluation = await FinalEvaluation.findById(id).notDeleted();
    if (!evaluation) throw new Error('Final evaluation not found');
    if (evaluation.isLocked) throw new Error('This evaluation is locked');
    if (evaluation.supervisorEvaluation?.status === 'Locked') {
        throw new Error('Supervisor evaluation is already locked');
    }

    const group = await Group.findById(evaluation.group).notDeleted();
    if (!group || group.supervisor?.toString() !== supervisorId.toString()) {
        throw new Error('Not authorized: you do not supervise this group');
    }

    evaluation.supervisorEvaluation = {
        evaluator: supervisorId,
        marks: data.marks,
        maxMarks: data.maxMarks,
        breakdown: data.breakdown || {},
        remarks: data.remarks || '',
        strengths: data.strengths || '',
        weaknesses: data.weaknesses || '',
        submittedAt: new Date(),
        status: 'Submitted'
    };

    evaluation.addHistory('supervisor_eval_submitted', supervisorId, 'supervisorEvaluation', null, evaluation.supervisorEvaluation);
    await evaluation.save();
    return evaluation;
};

const submitCoordinatorEvaluation = async (id, data, coordinatorId) => {
    const evaluation = await FinalEvaluation.findById(id).notDeleted();
    if (!evaluation) throw new Error('Final evaluation not found');
    if (evaluation.isLocked) throw new Error('This evaluation is locked');
    if (evaluation.coordinatorEvaluation?.status === 'Locked') {
        throw new Error('Coordinator evaluation is already locked');
    }

    evaluation.coordinatorEvaluation = {
        evaluator: coordinatorId,
        marks: data.marks,
        maxMarks: data.maxMarks,
        breakdown: data.breakdown || {},
        remarks: data.remarks || '',
        strengths: data.strengths || '',
        weaknesses: data.weaknesses || '',
        submittedAt: new Date(),
        status: 'Submitted'
    };

    evaluation.addHistory('coordinator_eval_submitted', coordinatorId, 'coordinatorEvaluation', null, evaluation.coordinatorEvaluation);
    await evaluation.save();
    return evaluation;
};

const lockFinalEvaluation = async (id, coordinatorId) => {
    const evaluation = await FinalEvaluation.findById(id).notDeleted();
    if (!evaluation) throw new Error('Final evaluation not found');
    if (evaluation.isLocked) throw new Error('Already locked');

    const currentSession = await AcademicSession.findById(evaluation.academicSession);
    const supervisorEnabled = currentSession?.config?.isSupervisorGradingEnabled !== false;
    const meetingsAffectGrace = currentSession?.config?.doMeetingsAffectGraceMarks !== false;

    // 1. Calculate Dynamic Grace Marks
    let totalGrace = 0;
    if (meetingsAffectGrace) {
        const threshold = currentSession?.config?.attendanceThreshold || 80;
        const bonusMarks = currentSession?.config?.graceMarksBonus || 5;

        const meetings = await Meeting.find({
            group: evaluation.group,
            status: 'Completed',
            isDeleted: { $ne: true }
        });
        
        const targetGroup = await Group.findById(evaluation.group).notDeleted();
        const memberCount = targetGroup?.members?.length || 0;

        if (meetings.length > 0 && memberCount > 0) {
            const totalPossibleAttendance = meetings.length * memberCount;
            const actualAttendance = meetings.reduce((sum, m) => sum + (m.attendees?.length || 0), 0);
            const attendancePercentage = (actualAttendance / totalPossibleAttendance) * 100;

            if (attendancePercentage >= threshold) {
                totalGrace = bonusMarks;
            }
        }
    }

    // 2. Calculate Weekly Submissions Average
    const weeklyStages = await ProjectStage.find({ componentType: 'WEEKLY_PROGRESS', isDeleted: false });
    const weeklyStageIds = weeklyStages.map(s => s._id);
    
    const weeklySubmissions = await Submission.find({
        group: evaluation.group,
        phase: { $in: weeklyStageIds },
        status: { $in: ['Graded', 'Approved'] },
        isDeleted: false
    });

    let weeklyMarksTotal = 0;
    let weeklyMaxTotal = 0;
    
    weeklySubmissions.forEach(sub => {
        const stage = weeklyStages.find(s => s._id.toString() === sub.phase.toString());
        weeklyMarksTotal += sub.evaluation?.totalMarks || 0;
        weeklyMaxTotal += stage?.totalMarks || 0; 
    });

    let weeklyPercentage = 0;
    if (weeklyMaxTotal > 0) {
        weeklyPercentage = (weeklyMarksTotal / weeklyMaxTotal) * 100;
    }

    // 3. Calculate Final Component
    let finalComponentPercentage = 0;
    const supMarks = evaluation.supervisorEvaluation?.marks || 0;
    const supMax = evaluation.supervisorEvaluation?.maxMarks || 100;
    const coMarks = evaluation.coordinatorEvaluation?.marks || 0;
    const coMax = evaluation.coordinatorEvaluation?.maxMarks || 100;

    const defaultSupWeight = currentSession?.config?.defaultEvaluationSplit?.supervisor || 40;
    const defaultCoWeight = currentSession?.config?.defaultEvaluationSplit?.coordinator || 60;

    if (supervisorEnabled && defaultSupWeight > 0) {
        const supContribution = supMax > 0 ? (supMarks / supMax) * defaultSupWeight : 0;
        const coContribution = coMax > 0 ? (coMarks / coMax) * defaultCoWeight : 0;
        finalComponentPercentage = supContribution + coContribution;
    } else {
        finalComponentPercentage = coMax > 0 ? (coMarks / coMax) * 100 : 0;
    }

    // 4. Apply Overall Weightings
    const wWeight = evaluation.weightDistribution?.weeklyTasks || 70;
    const fWeight = evaluation.weightDistribution?.finalComponent || 30;

    const weightedWeekly = (weeklyPercentage * wWeight) / 100;
    const weightedFinal = (finalComponentPercentage * fWeight) / 100;

    const finalCalculatedMarks = parseFloat((weightedWeekly + weightedFinal + totalGrace).toFixed(2));
    const finalPercentage = Math.min(finalCalculatedMarks, 100);

    // Grade Assignment
    let finalGrade = 'F';
    if (finalPercentage >= 90) finalGrade = 'A+';
    else if (finalPercentage >= 85) finalGrade = 'A';
    else if (finalPercentage >= 80) finalGrade = 'A-';
    else if (finalPercentage >= 75) finalGrade = 'B+';
    else if (finalPercentage >= 70) finalGrade = 'B';
    else if (finalPercentage >= 65) finalGrade = 'B-';
    else if (finalPercentage >= 60) finalGrade = 'C+';
    else if (finalPercentage >= 55) finalGrade = 'C';
    else if (finalPercentage >= 50) finalGrade = 'C-';

    // Update using findByIdAndUpdate to bypass pre-save hooks
    const lockedEvaluation = await FinalEvaluation.findByIdAndUpdate(id, {
        isLocked: true,
        lockedBy: coordinatorId,
        lockedAt: new Date(),
        graceMarksFromMeetings: totalGrace,
        totalMarksObtained: finalCalculatedMarks,
        totalMaxMarks: 100, 
        percentage: finalPercentage,
        finalGrade: finalGrade,
        'supervisorEvaluation.status': evaluation.supervisorEvaluation ? 'Locked' : 'Pending',
        'coordinatorEvaluation.status': evaluation.coordinatorEvaluation ? 'Locked' : 'Pending'
    }, { new: true });

    lockedEvaluation.addHistory('evaluation_locked', coordinatorId, 'isLocked', false, true, 'Coordinator final lock');
    await lockedEvaluation.save(); 

    return lockedEvaluation;
};

const setVivaDetails = async (id, data, coordinatorId) => {
    const evaluation = await FinalEvaluation.findById(id).notDeleted();
    if (!evaluation) throw new Error('Final evaluation not found');
    if (evaluation.isLocked) throw new Error('Cannot modify locked evaluation');

    evaluation.vivaDetails = data;
    evaluation.addHistory('viva_details_set', coordinatorId, 'vivaDetails', null, data);
    await evaluation.save();
    return evaluation;
};

module.exports = {
    createFinalEvaluation,
    getFinalEvaluations,
    getFinalEvaluation,
    submitSupervisorEvaluation,
    submitCoordinatorEvaluation,
    lockFinalEvaluation,
    setVivaDetails
};