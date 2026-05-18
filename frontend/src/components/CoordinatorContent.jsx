// src/components/CoordinatorContent.jsx
import PropTypes from 'prop-types';
import React, { useState, useEffect } from 'react';
import api from '../utils/api.js';
import VivaHistoryPanel from './VivaHistoryPanel';

// ============================================================
// COMPONENT
// ============================================================
const CoordinatorContent = ({ activeTab, mockData, showToast, currentUser, triggerRefresh }) => {
  const [localData, setLocalData] = useState(mockData || {});
  const [loading, setLoading] = useState(true);
  const [viewingGroup, setViewingGroup] = useState(null);
  const [isCreatingStage, setIsCreatingStage] = useState(false);
  const [timelineSaving, setTimelineSaving] = useState(null);
  const [allSessions, setAllSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [viewingSession, setViewingSession] = useState(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState(null);
  const [announcementForm, setAnnouncementForm] = useState({ title: '', body: '', expiresAt: '' });

  const [stageForm, setStageForm] = useState({ name: '', totalMarks: 10, order: 1, submissionType: 'DOCUMENT', supervisorWeight: 40, coordinatorWeight: 60, componentType: 'WEEKLY_PROGRESS' });

  const [reviewModal, setReviewModal] = useState({ isOpen: false, projectId: null, action: null, feedback: '' });
  const [gradingModal, setGradingModal] = useState({ isOpen: false, submission: null, marks: 0, remarks: '' });
  const [plagiarismCheck, setPlagiarismCheck] = useState({ selectedSubmission: null, isChecking: false, result: null });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, sessionId: null });


  useEffect(() => { if (mockData) setLocalData(mockData); }, [mockData]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [stagesRes, projectsRes, submissionsRes, usersRes, groupsRes, announcementsRes, sessionsRes, notificationsRes] =
          await Promise.allSettled([
            api.get('/project-stages'), api.get('/projects'), api.get('/submissions'),
            api.get('/users'), api.get('/groups'), api.get('/announcements'),
            api.get('/sessions'), api.get('/notifications')
          ]);
        const getData = (res) => (res.status === 'fulfilled' ? res.value.data : []);
        setLocalData(prev => ({
          ...prev,
          projectStages: getData(stagesRes) || [], projects: getData(projectsRes) || [],
          submissions: getData(submissionsRes) || [], users: getData(usersRes) || [],
          groups: getData(groupsRes) || [], announcements: getData(announcementsRes) || [],
          notifications: getData(notificationsRes) || []
        }));
        if (sessionsRes.status === 'fulfilled') {
          const sessions = Array.isArray(sessionsRes.value.data) ? sessionsRes.value.data : [sessionsRes.value.data];
          setAllSessions(sessions);
          const active = sessions.find(s => s.isCurrent) || sessions[0] || null;
          setCurrentSession(active); setViewingSession(active);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        showToast("Failed to load data", "error");
      } finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const projects = localData.projects || [];
  const projectStages = Array.isArray(localData.projectStages) ? localData.projectStages : [];
  const submissions = localData.submissions || [];
  const users = localData.users || [];
  const groups = localData.groups || [];
  const announcements = localData.announcements || [];
  const notifications = localData.notifications || [];

  const handleStartCopyleaksScan = async (submissionId) => {
    try {
      showToast("Requesting Copyleaks Scan...", "info");
      const res = await api.post(`/submissions/${submissionId}/trigger-scan`);

      setLocalData(prev => ({
        ...prev,
        submissions: prev.submissions.map(s =>
          s._id === submissionId ? { ...s, integrity: { ...s.integrity, status: 'Processing' } } : s
        )
      }));
      showToast("Scan started! Wait 30s then click 'Sync'.", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to start scan", "error");
    }
  };

  const handleSyncCopyleaksResults = async (submissionId) => {
    try {
      showToast("Checking Copyleaks for results...", "info");
      const res = await api.get(`/submissions/${submissionId}/check-integrity`);

      if (res.status === 202) {
        showToast("Still processing in the cloud. Try again in a bit.", "info");
        return;
      }

      setLocalData(prev => ({
        ...prev,
        submissions: prev.submissions.map(s =>
          s._id === submissionId ? { ...s, integrity: res.data } : s
        )
      }));
      showToast("Results synced successfully!", "success");
    } catch (err) {
      showToast("Results not ready or scan failed.", "error");
    }
  };

  const handleDownloadReport = async (submissionId) => {
    try {
      showToast("Requesting report...", "info");

      const response = await api.get(`/submissions/${submissionId}/download-report`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Plagiarism_Report_${submissionId}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast("PDF Downloaded!", "success");

    } catch (err) {
      console.warn("PDF file not generated by Copyleaks Sandbox. Switching to Web View...");

      const sub = localData.submissions.find(s => s._id === submissionId);

      if (sub?.integrity?.reportUrl) {
        window.open(sub.integrity.reportUrl, '_blank');
        showToast("Opening Interactive Web Report", "info");
      } else {
        showToast("Report data not found. Please click 'Sync Results' first.", "error");
      }
    }
  };

  const handlePlagiarismCheck = (submission) => {
    if (submission.integrity?.status === 'Completed') {
      setPlagiarismCheck({
        selectedSubmission: submission,
        isChecking: false,
        result: {
          overallScore: submission.integrity.plagiarismScore,
          recommendation: submission.integrity.plagiarismScore > 30
            ? 'High similarity detected. Please review the matched sections.'
            : 'Low similarity. Content appears largely original.',
          reportUrl: submission.integrity.reportUrl
        }
      });

      showToast("Analysis details loaded in the side pane", "success");
    } else {
      showToast("Scan not completed yet. Please click 'Sync Results' first.", "info");
    }
  };

  const handleMarkNotificationRead = async (id) => {
    try {
      if (id === "all") {
        await Promise.all(notifications.map(n => api.put(`/notifications/${n._id}/read`)));
        showToast("All notifications marked as read");
        setLocalData(prev => ({ ...prev, notifications: prev.notifications.map(n => ({ ...n, isRead: true })) }));
      } else {
        await api.put(`/notifications/${id}/read`);
        showToast("Notification marked as read");
        setLocalData(prev => ({ ...prev, notifications: prev.notifications.map(n => n._id === id ? { ...n, isRead: true } : n) }));
      }
    } catch (err) { showToast("Error marking notification", "error"); }
  };

  const handleCreateNewSession = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      const payload = { name: formData.get('name'), startDate: formData.get('startDate'), endDate: formData.get('endDate'), isCurrent: false, timeline: [] };
      const res = await api.post('/sessions', payload);
      setAllSessions(prev => [...prev, res.data]);
      setViewingSession(res.data); setIsCreatingSession(false);
      showToast("New Session Draft Created");
    } catch (err) { showToast(err.response?.data?.message || "Error creating session", "error"); }
  };


  // 1. Opens the beautiful modal instead of the ugly browser alert
  const handleActivateSessionClick = (sessionId) => {
    setConfirmModal({ isOpen: true, sessionId });
  };

  // 2. Executes the actual database update when they click "Confirm"
  const executeActivateSession = async () => {
    const sessionId = confirmModal.sessionId;
    setConfirmModal({ isOpen: false, sessionId: null }); // Close modal instantly

    try {

      const updatedSessions = allSessions.map(s => ({ ...s, isCurrent: s._id === sessionId }));
      setAllSessions(updatedSessions);
      const newActive = updatedSessions.find(s => s.isCurrent);
      setCurrentSession(newActive);
      setViewingSession(newActive);

      await api.put(`/sessions/${sessionId}`, { isCurrent: true });
      showToast("Session Activated Successfully!", "success");

      // Trigger the global sync
      if (triggerRefresh) {
        triggerRefresh();
      }

    } catch (err) {
      showToast("Error activating session", "error");
      const refresh = await api.get('/sessions');
      setAllSessions(Array.isArray(refresh.data) ? refresh.data : [refresh.data]);
    }
  };

  const handleUpdateTimeline = async (stageId, field, value) => {
    if (!value && value !== false) { showToast("Value cannot be empty", "error"); return; }
    if (!viewingSession) return;
    if (!viewingSession.isCurrent) { showToast("You cannot edit dates for archived sessions. Activate it first.", "error"); return; }
    setTimelineSaving(stageId);
    let updatedTimeline = viewingSession.timeline ? viewingSession.timeline.map(t => ({ ...t })) : [];
    const phaseIndex = updatedTimeline.findIndex(p => (p.stage?._id || p.stage) === stageId);
    let currentStartDate = phaseIndex > -1 ? updatedTimeline[phaseIndex].startDate : new Date().toISOString().split('T')[0];
    let currentDeadline = phaseIndex > -1 ? updatedTimeline[phaseIndex].deadline : new Date().toISOString().split('T')[0];
    if (field === 'startDate') currentStartDate = value;
    if (field === 'deadline') currentDeadline = value;
    if (new Date(currentDeadline) < new Date(currentStartDate)) { showToast("Deadline cannot be before the start date.", "error"); setTimelineSaving(null); return; }
    if (phaseIndex > -1) { updatedTimeline[phaseIndex][field] = value; }
    else { updatedTimeline.push({ stage: stageId, startDate: currentStartDate, deadline: currentDeadline, isSubmissionOpen: true, [field]: value }); }
    setViewingSession(prev => ({ ...prev, timeline: updatedTimeline }));
    const cleanTimeline = updatedTimeline.filter(item => item.stage).map(item => ({
      stage: item.stage && item.stage._id ? item.stage._id : item.stage,
      startDate: item.startDate, deadline: item.deadline, isSubmissionOpen: item.isSubmissionOpen ?? true
    }));
    try { await api.put(`/sessions/${viewingSession._id}`, { timeline: cleanTimeline }); }
    catch (err) { setViewingSession(prev => ({ ...prev, timeline: viewingSession.timeline })); showToast("Failed to save changes", "error"); }
    finally { setTimelineSaving(null); }
  };

  const handleUpdateSessionConfig = async (field, value) => {
    if (!viewingSession) return;
    try {
      const updatedConfig = { ...viewingSession.config, [field]: value };
      const res = await api.put(`/sessions/${viewingSession._id}`, { config: updatedConfig });
      setViewingSession(res.data);
      setAllSessions(prev => prev.map(s => s._id === res.data._id ? res.data : s));
      if (res.data.isCurrent) setCurrentSession(res.data);
      showToast("Settings updated successfully", "success");
    } catch (err) { showToast("Error updating settings", "error"); }
  };

  const openReviewModal = (projectId, action) => setReviewModal({ isOpen: true, projectId, action, feedback: '' });
  const closeReviewModal = () => setReviewModal(prev => ({ ...prev, isOpen: false }));

  const handleQuickAccept = async (id) => {
    try {
      const res = await api.put(`/projects/${id}`, { isIdeaApproved: true, status: 'Approved', remarks: 'Proposal Accepted' });
      setLocalData(prev => ({ ...prev, projects: (prev.projects || []).map(p => p._id === id ? res.data : p) }));
      showToast("Project Accepted successfully");
    } catch (err) { showToast("Error accepting project", "error"); }
  };

  const submitProjectReview = async () => {
    const { projectId, action, feedback } = reviewModal;
    if (!feedback.trim()) { showToast("Please provide feedback/reason.", "error"); return; }
    const updateData = action === 'reject'
      ? { isIdeaApproved: false, status: 'Rejected', remarks: feedback }
      : { isIdeaApproved: false, status: 'Changes Requested', remarks: feedback };
    try {
      const res = await api.put(`/projects/${projectId}`, updateData);
      setLocalData(prev => ({ ...prev, projects: (prev.projects || []).map(p => p._id === projectId ? res.data : p) }));
      closeReviewModal();
      showToast(`Project marked as: ${action === 'reject' ? 'Rejected' : 'Changes Requested'}`);
    } catch (err) { showToast('Error updating project', 'error'); }
  };

  const openGradingModal = (sub) => setGradingModal({ isOpen: true, submission: sub, marks: sub.evaluation?.coordinator?.marks || 0, remarks: sub.evaluation?.coordinator?.remarks || '' });
  const closeGradingModal = () => setGradingModal({ isOpen: false, submission: null, marks: 0, remarks: '' });

  const submitGrade = async () => {
    const { submission, marks, remarks } = gradingModal;
    if (!submission) return;

    const phaseId = typeof submission.phase === 'object' ? submission.phase._id : submission.phase;
    const stage = localData.projectStages.find(s => s._id === phaseId);
    const maxAllowed = stage?.totalMarks || 100;

    if (Number(marks) > maxAllowed || Number(marks) < 0) {
      showToast(`Invalid entry! Marks must be between 0 and ${maxAllowed} for this stage.`, "error");
      return;
    }

    try {
      const res = await api.patch(`/submissions/${submission._id}/grade`, { marks: Number(marks), remarks });
      setLocalData(prev => ({ ...prev, submissions: prev.submissions.map(s => s._id === submission._id ? res.data : s) }));
      showToast("Submission graded successfully"); closeGradingModal();
    } catch (err) { showToast(err.response?.data?.message || "Error grading submission", "error"); }
  };

  const handleStageInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'supervisorWeight') {
      const sup = Math.min(100, Math.max(0, parseInt(value) || 0));
      setStageForm(prev => ({ ...prev, supervisorWeight: sup, coordinatorWeight: 100 - sup }));
    } else if (name === 'coordinatorWeight') {
      const co = Math.min(100, Math.max(0, parseInt(value) || 0));
      setStageForm(prev => ({ ...prev, coordinatorWeight: co, supervisorWeight: 100 - co }));
    } else { setStageForm(prev => ({ ...prev, [name]: value })); }
  };

  const handleCreateStage = async (e) => {
    e.preventDefault();
    if (isCreatingStage) return;
    if (!stageForm.name.trim()) { showToast("Stage Name is required", "error"); return; }
    const marks = parseInt(stageForm.totalMarks), order = parseInt(stageForm.order);
    if (isNaN(marks) || isNaN(order)) { showToast("Total Marks and Order must be numbers", "error"); return; }

    setIsCreatingStage(true);

    // Check if supervisor is enabled globally to ensure we send 0/100 if it's disabled.
    const supervisorEnabled = currentSession?.config?.isSupervisorGradingEnabled !== false;

    const payload = {
      name: stageForm.name,
      totalMarks: marks,
      order,
      componentType: stageForm.componentType,
      allowedSubmissionTypes: [stageForm.submissionType || 'DOCUMENT'],
      evaluationSplit: {
        supervisor: supervisorEnabled ? stageForm.supervisorWeight : 0,
        coordinator: supervisorEnabled ? stageForm.coordinatorWeight : 100
      }
    };

    try {
      const res = await api.post('/project-stages', payload);
      setLocalData(prev => ({ ...prev, projectStages: [...(prev.projectStages || []), res.data].sort((a, b) => a.order - b.order) }));
      showToast("Stage created successfully!");
      setStageForm(prev => ({ name: '', totalMarks: 10, order: prev.order + 1, submissionType: 'DOCUMENT', supervisorWeight: 40, coordinatorWeight: 60, componentType: 'WEEKLY_PROGRESS' }));
    } catch (err) {
      if (err.response?.status === 429) showToast("Too many requests. Please wait a moment.", "error");
      else showToast(err.response?.data?.message || "Error creating stage", "error");
    } finally { setIsCreatingStage(false); }
  };

  const handleDeleteStage = async (id) => {
    if (!window.confirm("Delete this stage? This will affect the timeline.")) return;
    try {
      await api.delete(`/project-stages/${id}`);
      setLocalData(prev => ({ ...prev, projectStages: (prev.projectStages || []).filter(s => s._id !== id) }));
      showToast("Stage deleted");
    } catch (err) { showToast("Error deleting stage", "error"); }
  };

  const handleAnnouncementInputChange = (e) => {
    const { name, value } = e.target;
    setAnnouncementForm(prev => ({ ...prev, [name]: value }));
  };

  const startEditingAnnouncement = (ann) => {
    setEditingAnnouncementId(ann._id);
    const formattedDate = ann.expiresAt ? new Date(ann.expiresAt).toISOString().split('T')[0] : '';
    setAnnouncementForm({ title: ann.title, body: ann.body, expiresAt: formattedDate });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditingAnnouncement = () => {
    setEditingAnnouncementId(null);
    setAnnouncementForm({ title: '', body: '', expiresAt: '' });
  };
  const handleAnnouncementSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingAnnouncementId) {
        const res = await api.put(`/announcements/${editingAnnouncementId}`, announcementForm);
        setLocalData(prev => ({ ...prev, announcements: (prev.announcements || []).map(a => a._id === editingAnnouncementId ? res.data : a) }));
        showToast('Announcement updated successfully'); cancelEditingAnnouncement();
      } else {
        const res = await api.post('/announcements', announcementForm);
        setLocalData(prev => ({ ...prev, announcements: [res.data, ...(prev.announcements || [])] }));
        showToast('Announcement published'); setAnnouncementForm({ title: '', body: '' });
      }
    } catch (err) { showToast('Error saving announcement', 'error'); }
  };

  const handleDeleteAnnouncement = async (id) => {
    if (!window.confirm("Delete this announcement?")) return;
    try {
      await api.delete(`/announcements/${id}`);
      setLocalData(prev => ({ ...prev, announcements: (prev.announcements || []).filter(a => a._id !== id) }));
      showToast('Announcement deleted');
    } catch (err) { showToast('Error deleting announcement', 'error'); }
  };

  const handleAssignSupervisor = async (groupId, supervisorId) => {
    if (!supervisorId) return;
    try {
      const res = await api.put(`/groups/${groupId}/assign-supervisor`, { supervisorId });
      setLocalData(prev => ({ ...prev, groups: (prev.groups || []).map(g => g._id === groupId ? res.data : g) }));
      showToast('Supervisor assigned successfully');
    } catch (err) { showToast('Error assigning supervisor', 'error'); }
  };

  const handleGroupStatus = async (id, isApproved) => {
    try {
      const res = await api.put(`/groups/${id}`, { isApproved });
      setLocalData(prev => ({ ...prev, groups: (prev.groups || []).map(g => g._id === id ? res.data : g) }));
      if (viewingGroup && viewingGroup._id === id) setViewingGroup(res.data);
      showToast(`Group ${isApproved ? 'Approved' : 'Revoked'} successfully`);
    } catch (err) { showToast(err.response?.data?.message || 'Error updating group status', 'error'); }
  };

  const handleDeleteGroup = async (id) => {
    if (!window.confirm("Delete this group? This cannot be undone.")) return;
    try {
      await api.delete(`/groups/${id}`);
      setLocalData(prev => ({ ...prev, groups: (prev.groups || []).filter(g => g._id !== id) }));
      showToast('Group deleted');
    } catch (err) { showToast('Error deleting group', 'error'); }
  };

  if (loading) return <div className="flex justify-center items-center h-64"><span className="text-gray-500">Loading Dashboard Data...</span></div>;

  // ==========================================
  // DASHBOARD TAB
  // ==========================================
  if (activeTab === 'dashboard') {
    const recentSubmissions = submissions.slice(0, 10);
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 fade-in animate-fade-in">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700"><p className="text-xs font-bold text-gray-500 uppercase">Pending Proposals</p><p className="text-3xl font-black text-amber-500">{projects.filter(p => !p.isIdeaApproved && p.status === 'Pending').length}</p></div>
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700"><p className="text-xs font-bold text-gray-500 uppercase">Active Projects</p><p className="text-3xl font-black text-blue-600">{projects.length}</p></div>
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700"><p className="text-xs font-bold text-gray-500 uppercase">Students Enrolled</p><p className="text-3xl font-black text-indigo-600">{users.filter(u => u.role === 'Student').length}</p></div>
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700"><p className="text-xs font-bold text-gray-500 uppercase">Unassigned Groups</p><p className="text-3xl font-black text-red-500">{groups.filter(g => !g.supervisor).length}</p></div>
          </div>
          {currentSession ? (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-xl border border-indigo-100 dark:border-indigo-800 flex justify-between items-center">
              <div><h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-200">Session: {currentSession.name}</h3><p className="text-sm text-indigo-700 dark:text-indigo-400">Manage academic dates in "Settings".</p></div>
              <div className="bg-white dark:bg-gray-800 px-3 py-1 rounded text-xs font-bold text-indigo-600 shadow-sm">ACTIVE</div>
            </div>
          ) : (
            <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-xl border border-red-100 dark:border-red-800 flex justify-between items-center">
              <div><h3 className="text-lg font-bold text-red-900 dark:text-red-200">No Active Session</h3><p className="text-sm text-red-700 dark:text-red-400">Please go to "Settings" to create one.</p></div>
            </div>
          )}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"><h3 className="font-bold text-lg">Recent Submissions</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase text-gray-500"><tr><th className="px-5 py-3">Project</th><th className="px-5 py-3">Stage</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Status</th></tr></thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {recentSubmissions.map((sub, idx) => {
                    const projId = typeof sub.project === 'object' ? sub.project._id : sub.project;
                    const project = projects.find(p => p._id === projId);
                    const phaseId = typeof sub.phase === 'object' ? sub.phase._id : sub.phase;
                    const stage = projectStages.find(s => s._id === phaseId);
                    return (
                      <tr key={sub._id || idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-5 py-3 font-medium text-sm">{project?.title || 'Unknown'}</td>
                        <td className="px-5 py-3 text-sm text-gray-500">{stage?.name || 'Unknown'}</td>
                        <td className="px-5 py-3"><span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] rounded uppercase font-bold">{sub.submissionType}</span></td>
                        <td className="px-5 py-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${sub.status === 'Graded' ? 'bg-green-100 text-green-800' : sub.status === 'Submitted' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>{sub.status}</span></td>
                      </tr>
                    );
                  })}
                  {recentSubmissions.length === 0 && <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-500">No recent submissions</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <aside className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 h-fit sticky top-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">Alerts</h3>
            {notifications.length > 0 && <button onClick={() => handleMarkNotificationRead("all")} className="text-xs text-blue-600 hover:underline font-medium">Mark all read</button>}
          </div>
          <div className="space-y-3">
            {notifications.length > 0 ? notifications.slice(0, 8).map((notif) => (
              <div key={notif._id || Math.random()} className={`flex gap-3 p-3 rounded-lg transition-all ${!notif.isRead ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}`}>
                <div className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${notif.isRead ? 'bg-gray-300' : 'bg-red-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-gray-900 dark:text-gray-100">{notif.title}</p>
                  <p className="text-xs text-gray-500 line-clamp-2">{notif.message}</p>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[10px] text-gray-400">{notif.createdAt ? new Date(notif.createdAt).toLocaleDateString() : 'Just now'}</span>
                    {!notif.isRead && <button onClick={() => handleMarkNotificationRead(notif._id)} className="text-[10px] text-blue-600 hover:underline">Read</button>}
                  </div>
                </div>
              </div>
            )) : (
              <div className="text-center py-8 text-gray-400">
                <span className="material-symbols-outlined text-3xl mb-2">notifications_off</span>
                <p className="text-sm">No new alerts.</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    );
  }

  // ==========================================
  // REVIEW IDEAS TAB
  // ==========================================
  if (activeTab === 'review-ideas') {
    const sortedProjects = [...projects].sort((a, b) => {
      const aPending = a.status === 'Pending', bPending = b.status === 'Pending';
      if (aPending && !bPending) return -1; if (!aPending && bPending) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    const pendingCount = projects.filter(p => p.status === 'Pending').length;
    return (
      <div className="space-y-6 max-w-4xl mx-auto fade-in">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Project Idea Review</h2>
          <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-bold">{pendingCount} Pending Review</span>
        </div>
        {sortedProjects.map((project) => (
          <div key={project._id} className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm transition-all">
            <div className="flex justify-between items-start mb-4">
              <div><h3 className="text-xl font-bold">{project.title}</h3><p className="text-sm text-gray-500">Group: <span className="font-medium text-gray-700 dark:text-gray-300">{project.group?.name || "Unknown"}</span></p></div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${project.status === 'Approved' ? 'bg-green-100 text-green-800' : project.status === 'Rejected' ? 'bg-red-100 text-red-800' : project.status === 'Changes Requested' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>{project.status}</span>
            </div>
            <div className="space-y-2 mb-6">
              <p className="text-sm"><span className="font-bold">Category:</span> {project.category}</p>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg text-sm text-gray-700 dark:text-gray-300 border border-gray-100 dark:border-gray-700"><span className="font-bold block mb-1">Description:</span>{project.description}</div>
              {project.remarks && <div className="mt-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-sm text-indigo-800 dark:text-indigo-200 border border-indigo-100 dark:border-indigo-800"><span className="font-bold">Coordinator Remarks:</span> {project.remarks}</div>}
            </div>
            {project.status === 'Pending' ? (
              <div className="flex gap-3">
                <button onClick={() => handleQuickAccept(project._id)} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-semibold shadow-sm">Accept</button>
                <button onClick={() => openReviewModal(project._id, 'changes')} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-lg font-semibold shadow-sm">Changes</button>
                <button onClick={() => openReviewModal(project._id, 'reject')} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg font-semibold shadow-sm">Reject</button>
              </div>
            ) : (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-500 italic">Processed.</span>
                <button onClick={() => openReviewModal(project._id, 'changes')} className="text-sm text-blue-600 font-semibold hover:underline">Modify Status</button>
              </div>
            )}
          </div>
        ))}
        {reviewModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className={`p-6 border-b ${reviewModal.action === 'reject' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                <h3 className={`text-xl font-bold ${reviewModal.action === 'reject' ? 'text-red-700' : 'text-amber-700'}`}>{reviewModal.action === 'reject' ? 'Reject Project' : 'Request Changes'}</h3>
              </div>
              <div className="p-6"><label className="block text-sm font-medium mb-2">Remarks</label><textarea className="w-full p-3 rounded-xl border dark:bg-gray-900" rows="4" value={reviewModal.feedback} onChange={(e) => setReviewModal({ ...reviewModal, feedback: e.target.value })} autoFocus></textarea></div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/30 flex gap-3 justify-end border-t">
                <button onClick={closeReviewModal} className="px-4 py-2 font-semibold hover:bg-gray-200 rounded-lg">Cancel</button>
                <button onClick={submitProjectReview} className={`px-6 py-2 text-white font-bold rounded-lg ${reviewModal.action === 'reject' ? 'bg-red-600' : 'bg-amber-600'}`}>Submit</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // REVIEW SUBMISSIONS TAB
  // ==========================================
  if (activeTab === 'review-submissions') {
    return (
      <div className="max-w-7xl mx-auto fade-in">
        <h2 className="text-3xl font-black mb-6">Student Submissions</h2>
        <div className="grid gap-6">
          {submissions.map((sub) => {
            const getObjId = (obj) => (obj && typeof obj === 'object' ? obj._id : obj);
            const stage = projectStages.find(s => String(s._id) === String(getObjId(sub.phase)));
            const project = projects.find(p => String(p._id) === String(getObjId(sub.project)));
            return (
              <div key={sub._id} className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold">{project?.title || sub.project?.title || 'Unknown Project'}</h3>
                    <p className="text-sm text-gray-500">Stage: <span className="font-semibold text-gray-700 dark:text-gray-300">{stage?.name || sub.phase?.name || 'Unknown Stage'}</span></p>
                    <p className="text-xs text-gray-400 mt-1">Submitted: {new Date(sub.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${sub.status === 'Graded' ? 'bg-green-100 text-green-800' : sub.status === 'Submitted' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>{sub.status}</span>

                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider ${sub.integrity?.status === 'Processing' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                      sub.integrity?.status === 'Completed' ? 'bg-green-100 text-green-700' :
                        sub.integrity?.status === 'Failed' || sub.integrity?.status === 'Error' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-500'
                      }`}>
                      {sub.integrity?.status || 'Pending'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg flex flex-col h-full">
                    <h4 className="font-bold text-sm mb-4 text-gray-500 uppercase tracking-wider border-b pb-2">Attached Work</h4>

                    <div className="space-y-4 flex-1">
                      {sub.integrity?.status === 'Completed' && (
                        <div className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg flex items-center justify-between shadow-sm">
                          <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Integrity Score</span>
                            <div className={`text-lg font-black ${sub.integrity.plagiarismScore > 30 ? 'text-red-600' : 'text-green-600'}`}>
                              {sub.integrity.plagiarismScore}% Similarity
                            </div>
                          </div>
                          {sub.integrity?.reportUrl && (
                            <button
                              onClick={() => window.open(sub.integrity.reportUrl, '_blank')}
                              className="flex items-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm"
                            >
                              <span className="material-symbols-outlined text-[16px]">analytics</span>
                              View Report
                            </button>
                          )}
                        </div>
                      )}

                      {sub.links && Object.values(sub.links).some(v => v) && (
                        <div className="space-y-2">
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">External Links</span>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(sub.links).map(([key, val]) => val && (
                              <a key={key} href={val} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition-colors shadow-sm">
                                <span className="material-symbols-outlined text-[14px]">link</span>
                                <span className="capitalize">{key}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {sub.attachments && sub.attachments.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Uploaded Files</span>
                          <div className="space-y-2">
                            {sub.attachments.map((file, idx) => (
                              <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm">
                                <div className="flex items-center gap-3 overflow-hidden">
                                  <div className="w-8 h-8 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-sm">description</span>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate pr-4" title={file.name}>{file.name}</p>
                                    <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB • Uploaded</p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => window.open(file.url, '_blank')}
                                  className="shrink-0 flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                                >
                                  <span className="material-symbols-outlined text-[14px]">download</span>
                                  View / Download
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {(!sub.links || !Object.values(sub.links).some(v => v)) && (!sub.attachments || sub.attachments.length === 0) && (
                        <div className="flex flex-col items-center justify-center h-full py-6 text-gray-400">
                          <span className="material-symbols-outlined text-4xl mb-2 opacity-50">folder_off</span>
                          <p className="text-sm italic font-medium">No files or links provided.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg">
                    <h4 className="font-bold text-sm mb-2 text-gray-500">Evaluation</h4>
                    {sub.evaluation?.supervisor?.status === 'Graded' && (
                      <div className="mb-4 bg-blue-50 dark:bg-blue-900/10 border-l-2 border-blue-400 p-2 pl-3">
                        <span className="block text-xs font-bold text-blue-600 uppercase mb-1">Supervisor's Score</span>
                        <div className="flex justify-between items-center"><span className="text-sm font-bold">{sub.evaluation.supervisor.marks} / {sub.evaluation.supervisor.maxMarks || 0}</span><span className="text-xs text-gray-500 italic">"{sub.evaluation.supervisor.remarks}"</span></div>
                      </div>
                    )}
                    {sub.status === 'Graded' ? (
                      <div><p className="text-2xl font-black text-indigo-600">{sub.evaluation?.totalMarks || 0} <span className="text-sm font-normal text-gray-500">marks</span></p><p className="text-sm mt-2 italic">"{sub.evaluation?.coordinator?.remarks || sub.evaluation?.supervisor?.remarks}"</p><button onClick={() => openGradingModal(sub)} className="text-xs text-blue-600 font-semibold hover:underline mt-2">Edit Grade</button></div>
                    ) : (
                      <div className="h-full flex flex-col justify-center items-center"><p className="text-sm text-gray-500 mb-2">Pending Evaluation</p><button onClick={() => openGradingModal(sub)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm">Grade Submission</button></div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {submissions.length === 0 && <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-xl border border-dashed">No submissions found.</div>}
        </div>
        {gradingModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="p-6 border-b bg-indigo-50 dark:bg-indigo-900/20"><h3 className="text-xl font-bold text-indigo-900 dark:text-indigo-200">Evaluate Submission</h3></div>
              <div className="p-6 space-y-4">
                {gradingModal.submission?.evaluation?.supervisor?.status === 'Graded' && (
                  <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm"><p className="font-bold text-blue-800 text-xs uppercase mb-1">Supervisor's Grade</p><div className="flex justify-between"><span>Score: <strong>{gradingModal.submission.evaluation.supervisor.marks}</strong></span><span className="italic text-gray-600">"{gradingModal.submission.evaluation.supervisor.remarks}"</span></div></div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Marks Obtained <span className="text-xs text-gray-400 font-normal ml-2">(Max: {localData.projectStages.find(s => s._id === (typeof gradingModal.submission?.phase === 'object' ? gradingModal.submission?.phase._id : gradingModal.submission?.phase))?.totalMarks || 100})</span>
                  </label>
                  <input type="number" className="w-full p-3 rounded-xl border dark:bg-gray-900" value={gradingModal.marks} onChange={(e) => setGradingModal({ ...gradingModal, marks: e.target.value })} />
                </div>
                <div><label className="block text-sm font-medium mb-1">Remarks / Feedback</label><textarea className="w-full p-3 rounded-xl border dark:bg-gray-900" rows="4" value={gradingModal.remarks} onChange={(e) => setGradingModal({ ...gradingModal, remarks: e.target.value })}></textarea></div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/30 flex gap-3 justify-end border-t">
                <button onClick={closeGradingModal} className="px-4 py-2 font-semibold hover:bg-gray-200 rounded-lg">Cancel</button>
                <button onClick={submitGrade} className="px-6 py-2 text-white font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700">Save Grade</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // PLAGIARISM TAB
  // ==========================================
  if (activeTab === 'plagiarism') {
    return (
      <div className="max-w-7xl mx-auto fade-in">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">Plagiarism & AI Detection</h1>
          <p className="text-gray-500 text-sm">Powered by <strong>Copyleaks API (Sandbox Mode)</strong>. Results are fetched via secure webhooks.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-bold">Submissions for Integrity Review</h2>
            {submissions.length === 0 ? (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-8 text-center border-2 border-dashed">
                <span className="material-symbols-outlined text-4xl text-gray-400 mb-2">description</span>
                <p className="text-gray-500">No submissions available.</p>
              </div>
            ) : (
              submissions.map(sub => {
                const projectId = typeof sub.project === 'object' ? sub.project._id : sub.project;
                const project = projects.find(p => p._id === projectId);
                const isSelected = plagiarismCheck.selectedSubmission?._id === sub._id;

                return (
                  <div key={sub._id} className={`bg-white dark:bg-gray-800 rounded-xl p-5 border flex justify-between items-start hover:shadow-md transition-all ${isSelected ? 'border-blue-500 ring-1 ring-blue-400' : 'border-gray-200 dark:border-gray-700'}`}>
                    <div className="flex-1 mr-4">
                      <h3 className="font-bold text-gray-900 dark:text-white">{project?.title || 'Unknown Project'}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-500">Type: {sub.submissionType}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${sub.integrity?.status === 'Completed' ? 'bg-green-100 text-green-700' :
                          sub.integrity?.status === 'Processing' ? 'bg-blue-100 text-blue-700 animate-pulse' : 'bg-gray-100 text-gray-500'
                          }`}>
                          {sub.integrity?.status || 'Pending'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">Submitted: {new Date(sub.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2">
                      {(sub.integrity?.status === 'Pending' || !sub.integrity?.status || sub.integrity?.status === 'Error') && (
                        <button onClick={() => handleStartCopyleaksScan(sub._id)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-sm">Start Scan</button>
                      )}
                      {sub.integrity?.status === 'Processing' && (
                        <button onClick={() => handleSyncCopyleaksResults(sub._id)} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-sm flex items-center gap-2">
                          <span className="material-symbols-outlined animate-spin text-sm">sync</span> Sync Results
                        </button>
                      )}
                      {sub.integrity?.status === 'Completed' && (
                        <button onClick={() => handlePlagiarismCheck(sub)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-sm">View Analysis</button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 sticky top-6 shadow-sm">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-blue-600">analytics</span> Integrity Report</h2>
              {!plagiarismCheck.selectedSubmission ? (
                <div className="text-center py-10"><p className="text-gray-400 text-sm">Select a completed scan to see details.</p></div>
              ) : (
                <div className="space-y-4 animate-fade-in">
                  <div className={`p-6 rounded-xl text-center border-2 ${plagiarismCheck.selectedSubmission.integrity.plagiarismScore > 30 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                    <div className={`text-5xl font-black mb-1 ${plagiarismCheck.selectedSubmission.integrity.plagiarismScore > 30 ? 'text-red-600' : 'text-green-600'}`}>
                      {plagiarismCheck.selectedSubmission.integrity.plagiarismScore}%
                    </div>
                    <p className="text-xs font-bold uppercase text-gray-500">Matched Content</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm p-2 bg-gray-50 rounded"><span className="text-gray-500">Status:</span><span className="font-bold text-green-600">Verified by Copyleaks</span></div>
                    <div className="flex justify-between text-sm p-2 bg-gray-50 rounded"><span className="text-gray-500">Scan ID:</span><span className="font-mono text-[10px]">{plagiarismCheck.selectedSubmission._id}</span></div>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-xs text-amber-800 leading-relaxed"><span className="font-bold block mb-1">Sandbox Mode Active:</span> Full interactive heatmaps are restricted to production API keys. Similarity score and AI detection data are successfully retrieved and verified.</p>
                  </div>
                  <button onClick={() => window.open("https://copyleaks.com/compare-text/demo-report", "_blank")} className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg">
                    <span className="material-symbols-outlined text-xl">open_in_new</span> Show Sample Heatmap
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // MANAGE STAGES TAB
  // ==========================================
  if (activeTab === 'manage-stages' || activeTab === 'assign-tasks') {
    const sortedStages = [...projectStages].sort((a, b) => a.order - b.order);

    // CHECK GLOBAL SUPERVISOR ENABLEMENT
    const supervisorEnabled = currentSession?.config?.isSupervisorGradingEnabled !== false;

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 fade-in items-start">
        <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 h-fit">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2"><span className="material-symbols-outlined text-primary">post_add</span> Define Project Stage</h3>
          <p className="text-sm text-gray-500 mb-4">Creating a stage automatically creates the task for all students.</p>
          <form onSubmit={handleCreateStage} className="space-y-4">
            <div><label className="block text-sm font-medium mb-1">Stage Name (Task Title)</label><input name="name" value={stageForm.name} onChange={handleStageInputChange} required className="w-full border rounded-lg p-2 dark:bg-gray-700 dark:text-white" placeholder="e.g. Documentation Ch. 1" /></div>

            <div>
              <label className="block text-sm font-medium mb-1">Component Type</label>
              <select name="componentType" value={stageForm.componentType} onChange={handleStageInputChange} className="w-full border rounded-lg p-2 dark:bg-gray-700 dark:text-white font-semibold text-blue-700">
                <option value="WEEKLY_PROGRESS">Weekly Progress (Averaged)</option>
                <option value="FINAL_DELIVERABLE">Final Deliverable (Single Entry)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div><label className="block text-sm font-medium mb-1">Total Marks</label><input name="totalMarks" type="number" value={stageForm.totalMarks} onChange={handleStageInputChange} required className="w-full border rounded-lg p-2 dark:bg-gray-700 dark:text-white" /></div>
              <div><label className="block text-sm font-medium mb-1">Sequence Order</label><input name="order" type="number" value={stageForm.order} onChange={handleStageInputChange} required className="w-full border rounded-lg p-2 dark:bg-gray-700 dark:text-white" /></div>
            </div>

            {/* CONDITIONAL RENDERING: HIDE SPLIT IF SUPERVISOR DISABLED */}
            {supervisorEnabled ? (
              <div>
                <label className="block text-sm font-medium mb-1">Evaluation Split (%)</label>
                <div className="grid grid-cols-2 gap-3 bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div><label className="text-xs text-gray-500 uppercase font-bold">Supervisor</label><div className="flex items-center mt-1"><input type="number" name="supervisorWeight" value={stageForm.supervisorWeight} onChange={handleStageInputChange} className="w-full border rounded-md p-1.5 text-center font-bold text-blue-600" min="0" max="100" /><span className="ml-1 text-sm">%</span></div></div>
                  <div><label className="text-xs text-gray-500 uppercase font-bold">Coordinator</label><div className="flex items-center mt-1"><input type="number" name="coordinatorWeight" value={stageForm.coordinatorWeight} onChange={handleStageInputChange} className="w-full border rounded-md p-1.5 text-center font-bold text-indigo-600" min="0" max="100" /><span className="ml-1 text-sm">%</span></div></div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
                <strong>Note:</strong> Supervisor grading is globally disabled in Settings. Coordinator holds 100% weight.
              </div>
            )}

            <div><label className="block text-sm font-medium mb-1">Submission Type</label><select name="submissionType" value={stageForm.submissionType} onChange={handleStageInputChange} className="w-full border rounded-lg p-2 dark:bg-gray-700 dark:text-white"><option value="DOCUMENT">DOCUMENT</option><option value="CODE_REPO">CODE_REPO</option><option value="VIDEO">VIDEO</option><option value="AI_NOTEBOOK">AI_NOTEBOOK</option><option value="DESIGN_FILE">DESIGN_FILE</option><option value="OTHER">OTHER</option></select></div>
            <button type="submit" disabled={isCreatingStage} className={`w-full py-2 rounded-lg font-bold shadow-sm transition-all ${isCreatingStage ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>{isCreatingStage ? 'Creating...' : 'Create Stage & Task'}</button>
          </form>
        </div>
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Active Stages (Tasks)</h3>
          {sortedStages.length === 0 ? <div className="p-8 text-center text-gray-500 border-2 border-dashed rounded-xl">No stages defined.</div> : sortedStages.map((stage) => (
            <div key={stage._id} className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 flex justify-between items-start shadow-sm">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2"><span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded text-xs font-mono font-bold">Step {stage.order}</span><h4 className="font-bold text-lg text-gray-900 dark:text-white">{stage.name}</h4></div>
                <div className="flex flex-wrap gap-4 text-xs text-gray-500 mt-2">
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">grade</span> Marks: <strong>{stage.totalMarks}</strong></span>
                  <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">category</span> Format: <strong>{stage.allowedSubmissionTypes?.join(', ')}</strong></span>

                  {/* CONDITIONAL RENDERING: HIDE SPLIT BADGE IF SUPERVISOR DISABLED */}
                  {supervisorEnabled ? (
                    <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                      <span className="material-symbols-outlined text-[14px]">pie_chart</span> Split: <strong>Sup {stage.evaluationSplit?.supervisor}%</strong> / <strong>Coord {stage.evaluationSplit?.coordinator}%</strong>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 bg-gray-100 text-gray-500 px-2 py-0.5 rounded border border-gray-200">
                      <span className="material-symbols-outlined text-[14px]">pie_chart</span> Split: <strong>Coord 100%</strong> (Sup Disabled)
                    </span>
                  )}

                  <span className={`px-2 py-0.5 rounded border font-bold uppercase tracking-wider ${stage.componentType === 'FINAL_DELIVERABLE' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                    {stage.componentType === 'FINAL_DELIVERABLE' ? 'Final Deliverable' : 'Weekly Task'}
                  </span>
                </div>
              </div>
              <button onClick={() => handleDeleteStage(stage._id)} className="ml-4 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors" title="Delete Stage"><span className="material-symbols-outlined">delete</span></button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ==========================================
  // MANAGE GROUPS TAB
  // ==========================================
  if (activeTab === 'manage-groups') {
    const supervisors = users.filter(u => u.role === 'Supervisor');
    const sortedGroups = [...groups].sort((a, b) => (a.isApproved ? 1 : -1));

    if (viewingGroup) {
      const groupSubmissions = submissions.filter(s => { const sGroupId = typeof s.group === 'object' ? s.group._id : s.group; return sGroupId === viewingGroup._id; });
      const projectId = typeof viewingGroup.project === 'object' ? viewingGroup.project._id : viewingGroup.project;
      const project = projects.find(p => p._id === projectId);
      return (
        <div className="max-w-6xl mx-auto fade-in">
          <button onClick={() => setViewingGroup(null)} className="mb-6 flex items-center text-sm font-semibold text-gray-500 hover:text-blue-600 transition-colors"><span className="material-symbols-outlined text-lg mr-1">arrow_back</span>Back to Groups List</button>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 shadow-sm mb-8">
            <div className="flex justify-between items-start">
              <div><h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">{viewingGroup.name}</h2><p className="text-lg text-blue-600 font-bold">{project?.title || "No Project Assigned"}</p></div>
              <span className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider ${viewingGroup.isApproved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{viewingGroup.isApproved ? 'Approved' : 'Pending Approval'}</span>
            </div>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6 text-sm text-gray-600 dark:text-gray-400 pt-6 border-t border-gray-100 dark:border-gray-700">
              <div><span className="block text-xs font-bold uppercase text-gray-400 mb-1">Batch</span><span className="font-semibold text-gray-900 dark:text-white">{viewingGroup.batch}</span></div>
              <div><span className="block text-xs font-bold uppercase text-gray-400 mb-1">Supervisor</span><span className="font-semibold text-gray-900 dark:text-white">{users.find(u => u._id === (typeof viewingGroup.supervisor === 'object' ? viewingGroup.supervisor._id : viewingGroup.supervisor))?.name || "Unassigned"}</span></div>
              <div><span className="block text-xs font-bold uppercase text-gray-400 mb-1">Members</span><div className="flex -space-x-2">{viewingGroup.members?.map((m, i) => (<div key={i} className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-bold text-gray-600" title={typeof m === 'object' ? m.email : m}>{typeof m === 'object' ? m.name?.[0] : '?'}</div>))}</div></div>
              <div><span className="block text-xs font-bold uppercase text-gray-400 mb-1">Progress</span><div className="w-full bg-gray-200 rounded-full h-2.5 mt-1"><div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${Math.min((groupSubmissions.filter(s => s.status === 'Graded').length / (projectStages.length || 1)) * 100, 100)}%` }}></div></div></div>
            </div>
          </div>
          <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">Submission Progress</h3>
          <div className="space-y-4">
            {projectStages.sort((a, b) => a.order - b.order).map((stage, idx) => {
              const sub = groupSubmissions.find(s => { const sPhaseId = typeof s.phase === 'object' ? s.phase._id : s.phase; return sPhaseId === stage._id; });
              return (
                <div key={stage._id} className={`p-4 rounded-xl border-l-4 ${sub ? (sub.status === 'Graded' ? 'border-l-green-500 bg-white' : 'border-l-blue-500 bg-white') : 'border-l-gray-300 bg-gray-50'} shadow-sm`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4"><div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${sub ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'}`}>{idx + 1}</div><div><h4 className={`font-bold ${!sub && 'text-gray-500'}`}>{stage.name}</h4><p className="text-xs text-gray-500">{sub ? `Submitted: ${new Date(sub.createdAt).toLocaleDateString()}` : 'Not submitted yet'}</p></div></div>
                    <div className="text-right">
                      {sub ? (<div className="flex flex-col items-end gap-1"><span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${sub.status === 'Graded' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{sub.status}</span>{sub.evaluation?.totalMarks ? <span className="text-sm font-bold text-gray-900">{sub.evaluation.totalMarks} / {stage.totalMarks} marks</span> : <span className="text-xs text-gray-400">Pending Grade</span>}<div className="flex gap-2 mt-1">{sub.links && Object.values(sub.links).map((link, i) => link && (<a key={i} href={link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs flex items-center"><span className="material-symbols-outlined text-[14px]">link</span> View</a>))}</div></div>) : <span className="text-xs text-gray-400 font-medium">PENDING</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ADDED AI VIVA HISTORY PANEL HERE */}
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
            <VivaHistoryPanel projectId={projectId} />
          </div>

        </div>
      );
    }

    return (
      <div className="flex flex-col gap-8 fade-in">
        <div className="flex justify-between items-center px-6">
          <h2 className="text-3xl font-black">Group Management</h2>
          <div className="flex gap-4"><span className="px-4 py-2 bg-white border rounded-lg shadow-sm font-bold text-amber-600">{groups.filter(g => !g.isApproved).length} Pending</span><span className="px-4 py-2 bg-white border rounded-lg shadow-sm font-bold text-green-600">{groups.filter(g => g.isApproved).length} Approved</span></div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 overflow-hidden mx-6">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-700"><tr><th className="px-6 py-4 font-bold text-gray-500 uppercase text-xs">Group Name</th><th className="px-6 py-4 font-bold text-gray-500 uppercase text-xs">Batch</th><th className="px-6 py-4 font-bold text-gray-500 uppercase text-xs">Members</th><th className="px-6 py-4 font-bold text-gray-500 uppercase text-xs">Supervisor</th><th className="px-6 py-4 font-bold text-gray-500 uppercase text-xs">Status</th><th className="px-6 py-4 text-right font-bold text-gray-500 uppercase text-xs">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {sortedGroups.map((group) => {
                const supId = typeof group.supervisor === 'object' ? group.supervisor?._id : group.supervisor;
                return (
                  <tr key={group._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4 font-medium">{group.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{group.batch}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{group.members?.length || 0} students</td>
                    <td className="px-6 py-4"><select className="block w-full rounded-md border-0 py-1.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600" value={supId || ""} onChange={(e) => handleAssignSupervisor(group._id, e.target.value)}><option value="">Select Supervisor</option>{supervisors.map(sup => <option key={sup._id} value={sup._id}>{sup.name}</option>)}</select></td>
                    <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${group.isApproved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{group.isApproved ? 'Approved' : 'Pending'}</span></td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2 items-center">
                      <button onClick={() => setViewingGroup(group)} className="text-xs font-bold text-blue-600 hover:underline mr-2">View Progress</button>
                      {!group.isApproved && <button onClick={() => handleGroupStatus(group._id, true)} className="p-2 bg-green-50 text-green-600 rounded hover:bg-green-100" title="Approve"><span className="material-symbols-outlined text-lg">check</span></button>}
                      {group.isApproved && <button onClick={() => handleGroupStatus(group._id, false)} className="p-2 bg-amber-50 text-amber-600 rounded hover:bg-amber-100" title="Revoke"><span className="material-symbols-outlined text-lg">block</span></button>}
                      <button onClick={() => handleDeleteGroup(group._id)} className="p-2 bg-red-50 text-red-600 rounded hover:bg-red-100" title="Delete"><span className="material-symbols-outlined text-lg">delete</span></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ==========================================
  // ANNOUNCEMENTS TAB
  // ==========================================
  if (activeTab === 'announcements') {
    return (
      <div className="max-w-7xl mx-auto fade-in">
        <div className="mb-8"><h1 className="text-3xl font-black text-gray-900 dark:text-white">Manage Announcements</h1></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 h-fit sticky top-6">
            <div className={`p-6 border-b ${editingAnnouncementId ? 'bg-amber-50/50' : ''}`}><h3 className="text-xl font-bold flex items-center gap-2"><span className="material-symbols-outlined">{editingAnnouncementId ? 'edit_document' : 'campaign'}</span>{editingAnnouncementId ? 'Edit Announcement' : 'New Announcement'}</h3></div>
            <div className="p-6">
              <form className="space-y-5" onSubmit={handleAnnouncementSubmit}>
                <div><label className="block text-sm font-medium mb-1.5">Subject Line <span className="text-red-500">*</span></label><input name="title" value={announcementForm.title} onChange={handleAnnouncementInputChange} required className="block w-full rounded-lg border-0 py-2.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 dark:bg-gray-700 dark:text-white" /></div>

                {/* --- ADD EXPIRY DATE INPUT HERE --- */}
                <div>
                  <label className="block text-sm font-medium mb-1.5">Auto-Expire On <span className="text-gray-400 font-normal text-xs">(Optional, defaults to 14 days)</span></label>
                  <input type="date" name="expiresAt" value={announcementForm.expiresAt} onChange={handleAnnouncementInputChange} min={new Date().toISOString().split('T')[0]} className="block w-full rounded-lg border-0 py-2.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 dark:bg-gray-700 dark:text-white" />
                </div>
                {/* ---------------------------------- */}

                <div><label className="block text-sm font-medium mb-1.5">Content <span className="text-red-500">*</span></label><textarea name="body" value={announcementForm.body} onChange={handleAnnouncementInputChange} required rows={6} className="block w-full rounded-lg border-0 py-2.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 dark:bg-gray-700 dark:text-white resize-none" /></div>
                <div className="flex gap-3">
                  {editingAnnouncementId && <button type="button" onClick={cancelEditingAnnouncement} className="flex-1 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>}
                  <button type="submit" className={`flex-1 flex justify-center items-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold text-white shadow-sm ${editingAnnouncementId ? 'bg-amber-600 hover:bg-amber-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}>{editingAnnouncementId ? 'Update' : 'Publish'}</button>
                </div>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-bold">Published History ({announcements.length})</h2>
            {announcements.map((ann) => {
              // Format the expiration date for display
              const isExpiring = ann.expiresAt ? true : false;
              const expireDate = isExpiring ? new Date(ann.expiresAt).toLocaleDateString() : 'Never';

              return (
                <div key={ann._id} className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold">{ann.title}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-xs text-gray-500">Posted: {new Date(ann.createdAt).toLocaleDateString()}</p>
                        {isExpiring && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Expires: {expireDate}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 z-10">
                      <button onClick={() => startEditingAnnouncement(ann)} className="p-2 text-gray-400 hover:text-amber-600"><span className="material-symbols-outlined">edit</span></button>
                      <button onClick={() => handleDeleteAnnouncement(ann._id)} className="p-2 text-gray-400 hover:text-red-600"><span className="material-symbols-outlined">delete</span></button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{ann.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // SETTINGS TAB
  // ==========================================
  if (activeTab === 'settings' || activeTab === 'academic-session') {
    return (
      <div className="flex h-[calc(100vh-140px)] gap-6 fade-in">
        <div className="w-64 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col">
          <div className="p-4 border-b flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
            <h3 className="font-bold text-gray-700 dark:text-gray-200">Sessions</h3>
            <button onClick={() => setIsCreatingSession(true)} className="p-1 hover:bg-gray-200 rounded text-gray-600" title="Create New Session">
              <span className="material-symbols-outlined">add</span>
            </button>
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-2">
            {allSessions.map(session => (
              <button key={session._id} onClick={() => { setViewingSession(session); setIsCreatingSession(false); }} className={`w-full text-left p-3 rounded-lg border transition-all ${viewingSession?._id === session._id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-500' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-sm truncate">{session.name}</span>
                  {session.isCurrent && <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">ACTIVE</span>}
                </div>
                <div className="text-xs text-gray-400">{new Date(session.createdAt).toLocaleDateString()}</div>
              </button>
            ))}
            {allSessions.length === 0 && <div className="text-center p-4 text-sm text-gray-400">No sessions found</div>}
          </div>
        </div>
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
          {isCreatingSession ? (
            <div className="p-8 max-w-lg mx-auto w-full mt-10">
              <h2 className="text-2xl font-bold mb-6">Create New Session</h2>
              <form onSubmit={handleCreateNewSession} className="space-y-4">
                <div><label className="block text-sm font-bold mb-1">Session Name</label><input name="name" placeholder="Spring 2027" required className="w-full border rounded-lg p-3 dark:bg-gray-900" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-bold mb-1">Start Date</label><input name="startDate" type="date" required className="w-full border rounded-lg p-3 dark:bg-gray-900" /></div>
                  <div><label className="block text-sm font-bold mb-1">End Date</label><input name="endDate" type="date" required className="w-full border rounded-lg p-3 dark:bg-gray-900" /></div>
                </div>
                <div className="flex gap-3 pt-4"><button type="button" onClick={() => setIsCreatingSession(false)} className="px-6 py-2 border rounded-lg font-bold">Cancel</button><button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700">Create</button></div>
              </form>
            </div>
          ) : viewingSession ? (
            <>
              <div className="p-6 border-b flex justify-between items-center bg-gray-50 dark:bg-gray-700/30">
                <div>
                  <h2 className="text-2xl font-black">{viewingSession.name}</h2>
                  <p className="text-xs text-gray-500">ID: {viewingSession._id}</p>
                </div>
                {!viewingSession.isCurrent && (
                  <button
                    onClick={() => handleActivateSessionClick(viewingSession._id)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-sm flex items-center gap-2 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">check_circle</span>
                    Set Active
                  </button>
                )}
                {viewingSession.isCurrent && <div className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-600">Currently Active</div>}
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {!viewingSession.isCurrent && <div className="mb-4 flex items-center gap-2 text-blue-600 bg-blue-50 p-3 rounded-lg text-sm border border-blue-100"><span className="material-symbols-outlined">lock</span><span>This session is archived. Activate it to make changes.</span></div>}

                {viewingSession.isCurrent && (
                  <div className="mb-8 bg-indigo-50 dark:bg-indigo-900/10 p-5 rounded-xl border border-indigo-100 dark:border-indigo-800">
                    <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-200 mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined">tune</span> Evaluation Settings
                    </h3>
                    <div className="space-y-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-600"
                          checked={viewingSession.config?.isSupervisorGradingEnabled !== false}
                          onChange={(e) => handleUpdateSessionConfig('isSupervisorGradingEnabled', e.target.checked)}
                        />
                        <div>
                          <p className="font-bold text-sm text-gray-900 dark:text-white">Enable Supervisor Grading</p>
                          <p className="text-xs text-gray-500">Allow supervisors to grade submissions. If off, Coordinator grading holds 100% weight.</p>
                        </div>
                      </label>

                      <div className="pt-2 border-t border-indigo-200 dark:border-indigo-800/50">
                        <label className="flex items-center gap-3 cursor-pointer mt-2">
                          <input
                            type="checkbox"
                            className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-600"
                            checked={viewingSession.config?.doMeetingsAffectGraceMarks !== false}
                            onChange={(e) => handleUpdateSessionConfig('doMeetingsAffectGraceMarks', e.target.checked)}
                          />
                          <div>
                            <p className="font-bold text-sm text-gray-900 dark:text-white">Automate Meeting Grace Marks</p>
                            <p className="text-xs text-gray-500">Apply grace marks automatically based on group attendance percentage.</p>
                          </div>
                        </label>

                        {/* DYNAMIC GRACE MARK SETTINGS UI */}
                        {viewingSession.config?.doMeetingsAffectGraceMarks !== false && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 ml-8 bg-white dark:bg-gray-800 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800 shadow-sm">
                            <div>
                              <label className="block text-xs font-bold text-indigo-900 dark:text-indigo-300 mb-1">
                                Required Attendance (%)
                              </label>
                              <input
                                type="number" min="0" max="100"
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 text-sm bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500"
                                value={viewingSession.config?.attendanceThreshold ?? 80}
                                onBlur={(e) => handleUpdateSessionConfig('attendanceThreshold', Number(e.target.value))}
                                onChange={(e) => setViewingSession(prev => ({ ...prev, config: { ...prev.config, attendanceThreshold: e.target.value } }))}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-indigo-900 dark:text-indigo-300 mb-1">
                                Bonus Marks Awarded
                              </label>
                              <input
                                type="number" min="0"
                                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 text-sm bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500"
                                value={viewingSession.config?.graceMarksBonus ?? 5}
                                onBlur={(e) => handleUpdateSessionConfig('graceMarksBonus', Number(e.target.value))}
                                onChange={(e) => setViewingSession(prev => ({ ...prev, config: { ...prev.config, graceMarksBonus: e.target.value } }))}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {viewingSession.isCurrent && <div className="mb-4 flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-lg text-sm border border-amber-100"><span className="material-symbols-outlined">info</span> Changes to dates are saved automatically on blur.</div>}

                <h3 className="font-bold text-gray-900 mb-3">Timeline Constraints</h3>
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b">
                      <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase">Stage</th>
                      <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase">Start</th>
                      <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase">Deadline</th>
                      <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {projectStages.sort((a, b) => a.order - b.order).map((stage) => {
                      const phase = viewingSession.timeline?.find(p => (p.stage?._id || p.stage) === stage._id) || {};
                      const startDate = phase.startDate ? new Date(phase.startDate).toISOString().split('T')[0] : '';
                      const deadline = phase.deadline ? new Date(phase.deadline).toISOString().split('T')[0] : '';
                      const isSaving = timelineSaving === stage._id;
                      const isEditable = viewingSession.isCurrent;
                      return (
                        <tr key={stage._id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 ${isSaving ? 'bg-indigo-50' : ''}`}>
                          <td className="py-4 px-2 font-bold flex items-center gap-2">{stage.name}{isSaving && <span className="animate-spin h-4 w-4 border-2 border-indigo-600 rounded-full border-t-transparent"></span>}</td>
                          <td className="py-4 px-2"><input type="date" defaultValue={startDate} disabled={!isEditable} onBlur={(e) => isEditable && handleUpdateTimeline(stage._id, 'startDate', e.target.value)} className={`border border-gray-300 rounded p-2 text-sm dark:bg-gray-900 ${!isEditable ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''}`} /></td>
                          <td className="py-4 px-2"><input type="date" defaultValue={deadline} disabled={!isEditable} onBlur={(e) => isEditable && handleUpdateTimeline(stage._id, 'deadline', e.target.value)} className={`border border-gray-300 rounded p-2 text-sm dark:bg-gray-900 ${!isEditable ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''}`} /></td>
                          <td className="py-4 px-2 text-center"><button onClick={() => isEditable && handleUpdateTimeline(stage._id, 'isSubmissionOpen', !phase.isSubmissionOpen)} disabled={!isEditable} className={`px-3 py-1 rounded text-xs font-bold transition-colors ${!isEditable ? 'opacity-50 cursor-not-allowed ' : ''} ${phase.isSubmissionOpen ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>{phase.isSubmissionOpen ? 'OPEN' : 'CLOSED'}</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400"><span className="material-symbols-outlined text-4xl mb-2">event_busy</span><p>Select a session to view details or create a new one.</p></div>
          )}
        </div>
        {/* ===== BEAUTIFUL CONFIRMATION MODAL ===== */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-md border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <span className="material-symbols-outlined text-2xl">sync_warning</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Activate Session?</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  This will archive the currently active batch and completely refresh the system dashboard.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
              <button 
                onClick={() => setConfirmModal({ isOpen: false, sessionId: null })}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={executeActivateSession}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">check_circle</span>
                Yes, Activate
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    );
  }

  return <div className="text-center mt-20 text-gray-500">Select a tab from the sidebar.</div>;
};

CoordinatorContent.propTypes = {
  activeTab: PropTypes.string.isRequired,
  mockData: PropTypes.object,
  showToast: PropTypes.func.isRequired,
};

export default CoordinatorContent;