/* ===== backend/src/services/submission.service.js ===== */
const Submission = require('../models/submission.model');
const Group = require('../models/group.model');
const AcademicSession = require('../models/academicSession.model');
const SubmissionSummary = require('../models/submissionSummary.model');
const ProjectStage = require('../models/projectStage.model');
const copyleaksService = require('./copyleaksService'); // Assuming this stays in the original location for now
const notificationService = require('./notification.service');

// --- Internal Helper ---
const updateSummary = async (projectId, phaseId) => {
    const subs = await Submission.find({ project: projectId, phase: phaseId });
    if (!subs.length) return;
    
    const gradedSubs = subs.filter(s => s.status === 'Graded' || s.status === 'Approved');
    const rejectedSubs = subs.filter(s => s.status === 'Rejected');
    
    const totalMarks = gradedSubs.reduce((sum, s) => sum + (s.evaluation?.totalMarks || 0), 0);
    const avgMarks = gradedSubs.length > 0 ? totalMarks / gradedSubs.length : 0;
    
    const totalPlag = subs.reduce((sum, s) => sum + (s.integrity?.plagiarismScore || 0), 0);
    const avgPlag = subs.length > 0 ? totalPlag / subs.length : 0;

    await SubmissionSummary.findOneAndUpdate(
        { project: projectId, phase: phaseId },
        { 
            totalSubmissions: subs.length, 
            approvedCount: gradedSubs.length, 
            rejectedCount: rejectedSubs.length, 
            averageMarks: avgMarks, 
            plagiarismAverage: avgPlag, 
            lastUpdated: new Date() 
        },
        { upsert: true }
    );
};

// --- Main Service Functions ---

const createSubmission = async (data, userId) => {
    const { project, phase, submissionType, attachments, links, description, parentSubmission, weeklyTask } = data;
    
    const hasFiles = attachments && attachments.length > 0;
    const hasLinks = links && Object.keys(links).length > 0;

    switch (submissionType) {
        case 'DOCUMENT': if (!hasFiles || !links?.doc) throw new Error('File upload and Document link required.'); break;
        case 'CODE_REPO': if (!links?.repo) throw new Error('GitHub link required.'); break;
        case 'DESIGN_FILE': if (!hasFiles || !links?.design) throw new Error('Zip upload and Design link required.'); break;
        case 'AI_NOTEBOOK': if (!links?.notebook && !links?.repo) throw new Error('Colab or GitHub link required.'); break;
        default: if (!hasFiles && !hasLinks) throw new Error('File or link required.');
    }

    const currentSession = await AcademicSession.findOne({ isCurrent: true });
    if (!currentSession) throw new Error('No active session found');

    const stageDoc = await ProjectStage.findById(phase);
    if (!stageDoc) throw new Error('Invalid phase');

    const timelinePhase = currentSession.timeline.find(p => p.stage.toString() === phase && p.isSubmissionOpen);
    if (!timelinePhase) throw new Error('Submission closed for this phase');

    const group = await Group.findOne({ members: userId }).notDeleted();
    if (!group) throw new Error('Not in a group');
    if (group.leader.toString() !== userId.toString()) throw new Error('Only leader can submit');

    let version = 1;
    if (parentSubmission) {
        const parent = await Submission.findById(parentSubmission);
        if (parent) version = (parent.version || 1) + 1;
    }

    const submissionTitle = weeklyTask && weeklyTask.taskTitle ? `Weekly Task: ${weeklyTask.taskTitle}` : `${stageDoc.name} Submission`;

    const sub = new Submission({
        project, 
        group: group._id, 
        academicSession: currentSession._id, 
        submittedBy: userId, 
        phase, 
        submissionType,
        title: submissionTitle, 
        attachments: attachments || [], 
        links, 
        description, 
        parentSubmission: parentSubmission || null, 
        version,
        weeklyTask: weeklyTask || undefined, 
        status: 'Submitted'
    });

    await sub.save();

    if (group.supervisor) {
        await notificationService.createNotification({
            recipient: group.supervisor,
            type: 'INFO',
            title: 'New Submission Received',
            message: `${group.name} has submitted work for "${stageDoc.name}".`
        });
    }

    return sub;
};

const getSubmissions = async (user) => {
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

    return Submission.find({ 
        group: { $in: activeGroupIds }, 
        isDeleted: { $ne: true } 
    })
    .populate('project', 'title')
    .populate('submittedBy', 'name email')
    .populate('phase', 'name')
    .sort({ createdAt: -1 });
};

const getSubmissionById = async (id) => {
    return Submission.findById(id)
        .notDeleted()
        .populate('project')
        .populate('submittedBy', 'name email')
        .populate('phase', 'name');
};

const updateSubmission = async (id, data, userId) => {
    const sub = await Submission.findById(id).notDeleted();
    if (!sub) throw new Error('Submission not found');
    if (sub.submittedBy.toString() !== userId.toString()) throw new Error('Not authorized');
    if (sub.status !== 'Draft' && sub.status !== 'Resubmission Required') throw new Error('Cannot edit this submission');

    if (data.attachments) sub.attachments = data.attachments;
    if (data.links) sub.links = { ...sub.links, ...data.links };
    if (data.description !== undefined) sub.description = data.description;
    sub.version = (sub.version || 1) + 1;

    await sub.save();
    return sub;
};

const gradeSubmission = async (id, data, user) => {
    const { marks, remarks, rubric, strengths, areasForImprovement } = data;
    const sub = await Submission.findById(id).notDeleted();
    if (!sub) throw new Error('Submission not found');

    const currentSession = await AcademicSession.findOne({ isCurrent: true });
    const stage = await ProjectStage.findById(sub.phase);
    
    if (marks > stage.totalMarks || marks < 0) {
        throw new Error(`Marks entered (${marks}) exceed the maximum allowed (${stage.totalMarks}) for this stage.`);
    }

    const authority = currentSession.config?.gradingAuthority || 'HYBRID';
    const role = user.role;

    if (authority === 'SUPERVISOR_ONLY' && role !== 'Supervisor') throw new Error('Only supervisor can grade');
    if (authority === 'COORDINATOR_ONLY' && role !== 'Coordinator') throw new Error('Only coordinator can grade');

    const key = role.toLowerCase();
    sub.evaluation[key] = {
        ...sub.evaluation[key], 
        evaluator: user.id || user._id, 
        marks, 
        maxMarks: stage.totalMarks, 
        remarks: remarks || '', 
        strengths: strengths || '', 
        areasForImprovement: areasForImprovement || '', 
        gradedAt: new Date(), 
        status: 'Graded'
    };

    if (rubric && rubric.length > 0) sub.evaluation[key].rubric = rubric;

    const supWeight = stage.evaluationSplit?.supervisor || 0;
    const coWeight = stage.evaluationSplit?.coordinator || 0;

    const supMarks = sub.evaluation.supervisor?.marks || 0;
    const coMarks = sub.evaluation.coordinator?.marks || 0;

    sub.evaluation.totalMarks = parseFloat(((supMarks * (supWeight / 100)) + (coMarks * (coWeight / 100))).toFixed(2));
    
    let isComplete = false;
    if (supWeight > 0 && coWeight > 0) {
        isComplete = !!sub.evaluation.supervisor?.status && !!sub.evaluation.coordinator?.status;
    } else if (supWeight === 0) {
        isComplete = !!sub.evaluation.coordinator?.status;
    } else if (coWeight === 0) {
        isComplete = !!sub.evaluation.supervisor?.status;
    }

    if (isComplete) {
        sub.status = 'Graded';
        const targetGroup = await Group.findById(sub.group);
        if (targetGroup) {
            for (const memberId of targetGroup.members) {
                await notificationService.createNotification({
                    recipient: memberId,
                    type: 'SUCCESS',
                    title: 'Submission Graded',
                    message: `Your submission for "${stage.name}" has been fully evaluated. Final Score: ${sub.evaluation.totalMarks}/${stage.totalMarks}.`
                });
            }
        }
    }

    await sub.save();
    await updateSummary(sub.project, sub.phase);
    return sub;
};

const deleteSubmission = async (id) => {
    const sub = await Submission.findById(id).notDeleted();
    if (!sub) throw new Error('Submission not found');
    await sub.softDelete();
};

const triggerCopyleaksScan = async (id) => {
    const sub = await Submission.findById(id);
    if (!sub) throw new Error("Submission not found");
    await copyleaksService.submitScan(sub);
    sub.integrity.status = 'Processing';
    sub.integrity.errorDetails = null;
    await sub.save();
    return { message: "Scan started successfully", status: "Processing" };
};

const checkCopyleaksIntegrity = async (id) => {
    const sub = await Submission.findById(id);
    if (!sub) throw new Error("Submission not found");
    
    const results = await copyleaksService.getScanResults(id);
    sub.integrity.plagiarismScore = Math.round((results.scannedDocument?.totalSimilarity || 0) * 100);
    sub.integrity.status = 'Completed';
    sub.integrity.checkedAt = new Date();
    sub.integrity.reportUrl = results.results?.internet?.[0]?.url || `https://api.copyleaks.com/v3/scans/${id}/view`;
    
    await sub.save();
    await updateSummary(sub.project, sub.phase);
    return sub.integrity;
};

const handleCopyleaksWebhook = async (id, status, headers, body, expectedSignature, isDevMode) => {
    const providedSignature = headers['x-copyleaks-signature'];

    if (isDevMode && !expectedSignature) {
        console.warn(`[SANDBOX MODE] Bypassing Webhook signature validation for submission: ${id}`);
    } else if (!providedSignature || providedSignature !== expectedSignature) {
        throw new Error('Unauthorized webhook invocation');
    }

    const sub = await Submission.findById(id);
    if (!sub) throw new Error('Submission not found for webhook');
    
    if (status === 'completed') {
        sub.integrity.plagiarismScore = Math.round((body.scannedDocument?.totalSimilarity || 0) * 100);
        sub.integrity.status = 'Completed';
        sub.integrity.checkedAt = new Date();
        sub.integrity.reportUrl = body.results?.internet?.[0]?.url || `https://api.copyleaks.com/v3/downloads/report/${id}`;
        await sub.save();
        await updateSummary(sub.project, sub.phase); 
    } else if (status === 'error') {
        sub.integrity.status = 'Error';
        sub.integrity.errorDetails = body.developerPayload || 'Scan failed in Copyleaks';
        await sub.save();
    }
};

const getCopyleaksReportStream = async (id) => {
    const token = await copyleaksService.login();
    const axios = require('axios');
    const response = await axios.get(`https://api.copyleaks.com/v3/downloads/report/${id}`, { 
        headers: { 'Authorization': `Bearer ${token}` }, 
        responseType: 'stream' 
    });
    return response.data;
};

module.exports = {
    createSubmission,
    getSubmissions,
    getSubmissionById,
    updateSubmission,
    gradeSubmission,
    deleteSubmission,
    triggerCopyleaksScan,
    checkCopyleaksIntegrity,
    handleCopyleaksWebhook,
    getCopyleaksReportStream
};