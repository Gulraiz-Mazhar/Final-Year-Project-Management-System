// src/components/SupervisorContent.jsx
import PropTypes from 'prop-types';
import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import VivaHistoryPanel from './VivaHistoryPanel';

const SupervisorContent = ({ activeTab, showToast, currentUser }) => {

  const getStoredUser = () => {
    try {
      const stored = localStorage.getItem("user") || localStorage.getItem("userInfo");
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error("Error parsing stored user", error);
      return null;
    }
  };

  const effectiveUser = currentUser || getStoredUser();

  const userId = effectiveUser?.id
    ?? effectiveUser?._id
    ?? effectiveUser?.user?.id
    ?? effectiveUser?.user?._id;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    groups: [], projects: [], submissions: [], users: [], academicSessions: [], meetings: [], projectStages: [], notifications: []
  });

  const [selectedGroupId, setSelectedGroupId] = useState(null);

  const [meetingForm, setMeetingForm] = useState({
    title: '', description: '', scheduledDate: '', scheduledTime: '', location: '', agenda: '', groupId: '', status: 'Scheduled', attendees: [], mode: 'In-Person'
  });
  const [editingMeetingId, setEditingMeetingId] = useState(null);

  const [gradingModal, setGradingModal] = useState({
    isOpen: false, submission: null, marks: 0, remarks: ''
  });

  // BUG FIX: Automatically clear the selected group when switching tabs via the sidebar!
  useEffect(() => {
    setSelectedGroupId(null);
  }, [activeTab]);

  useEffect(() => {
    const fetchData = async () => {
      if (!userId) { setLoading(false); return; }
      setLoading(true);
   try {
        const [groupsRes, projectsRes, subRes, sessionRes, meetingsRes, stagesRes, usersRes, notifsRes, announcementsRes] = await Promise.all([
          api.get('/groups'), api.get('/projects'), api.get('/submissions'),
          api.get('/sessions').catch(() => ({ data: [] })),
          api.get('/meetings').catch(() => ({ data: [] })),
          api.get('/project-stages').catch(() => ({ data: [] })),
          api.get('/users/students').catch(() => ({ data: [] })),
          api.get('/notifications').catch(() => ({ data: [] })), 
          api.get("/announcements").catch(() => ({ data: [] })) // <-- Added Announcements
        ]);

        setData({
          groups: groupsRes.data || [], projects: projectsRes.data || [], submissions: subRes.data || [],
          academicSessions: sessionRes.data || [], meetings: meetingsRes.data || [],
          projectStages: stagesRes.data || [], users: usersRes.data || [],
          notifications: notifsRes.data || [],
          announcements: announcementsRes?.data || [] // <-- Added Announcements
        });
      } catch (err) {
        showToast("Error loading dashboard data", "error");
      } finally { setLoading(false); }
    };
    fetchData();
  }, [userId]);

  // Add the read handler right below the useEffect:
  const handleMarkNotificationRead = async (id) => {
    try {
      if (id === "all") {
        await Promise.all(data.notifications.map(n => api.put(`/notifications/${n._id}/read`)));
        setData(prev => ({ ...prev, notifications: prev.notifications.map(n => ({ ...n, isRead: true })) }));
        showToast("All notifications marked as read");
      } else {
        await api.put(`/notifications/${id}/read`);
        setData(prev => ({ ...prev, notifications: prev.notifications.map(n => n._id === id ? { ...n, isRead: true } : n) }));
      }
    } catch (err) { showToast("Error marking notification", "error"); }
  };

  const currentSession = data.academicSessions.find(s => s.isCurrent) || data.academicSessions[0];
  const supervisorEnabled = currentSession?.config?.isSupervisorGradingEnabled !== false;

  const myGroups = data.groups.filter(g => {
    if (!g.supervisor) return false;
    const supId = typeof g.supervisor === 'object' ? g.supervisor._id : g.supervisor;
    return supId === userId;
  });

  const getProjectTitle = (projId) => {
    if (!projId) return "No Project Assigned";
    const idToSearch = typeof projId === 'object' ? projId._id : projId;
    const p = data.projects.find(proj => proj._id === idToSearch);
    return p ? p.title : "No Project Assigned";
  };

  const getProjectId = (projId) => typeof projId === 'object' ? projId._id : projId;

  const calculateProgress = (groupId) => {
    const group = data.groups.find(g => g._id === groupId);
    if (!group) return 0;
    const projectId = getProjectId(group.project);
    if (!projectId) return 0;
    const groupSubs = data.submissions.filter(s => getProjectId(s.project) === projectId);
    if (groupSubs.length === 0) return 0;
    const totalStages = data.projectStages.length || 4;
    const completed = groupSubs.filter(s => s.status === 'Graded' || s.status === 'Approved').length;
    return Math.min(Math.round((completed / totalStages) * 100), 100);
  };

  const handleMeetingInputChange = (e) => {
    const { name, value } = e.target;
    setMeetingForm(prev => ({ ...prev, [name]: value }));
  };

  const handleMeetingSubmit = async (e) => {
    e.preventDefault();
    if (!meetingForm.groupId) { showToast("Please select a group", "error"); return; }

    const localDateTimeString = `${meetingForm.scheduledDate}T${meetingForm.scheduledTime}`;
    const isoScheduledDate = new Date(localDateTimeString).toISOString();

    const activeGroup = myGroups.find(g => String(g._id) === String(meetingForm.groupId));
    const allMemberIds = activeGroup?.members.map(m => typeof m === 'object' ? String(m._id) : String(m)) || [];
    const finalAttendees = meetingForm.status === 'Completed' ? meetingForm.attendees.map(String) : [];
    const finalAbsentees = meetingForm.status === 'Completed' ? allMemberIds.filter(id => !finalAttendees.includes(id)) : [];

    const payload = {
      title: meetingForm.title,
      description: meetingForm.description,
      scheduledDate: isoScheduledDate,
      location: meetingForm.location,
      mode: meetingForm.mode,
      agenda: meetingForm.agenda,
      status: meetingForm.status,
      attendees: finalAttendees
    };

    try {
      if (editingMeetingId) {
        payload.absentees = finalAbsentees;
        await api.put(`/meetings/${editingMeetingId}`, payload);
        showToast('Meeting updated successfully');
      } else {
        payload.group = meetingForm.groupId;
        await api.post('/meetings', payload);
        showToast('Meeting scheduled successfully');
      }
      
      const freshMeetings = await api.get('/meetings');
      setData(prev => ({ ...prev, meetings: freshMeetings.data }));

      setEditingMeetingId(null);
      setMeetingForm({ title: '', description: '', scheduledDate: '', scheduledTime: '', location: '', agenda: '', groupId: '', status: 'Scheduled', attendees: [], mode: 'In-Person' });
    } catch (err) { 
      showToast(err.response?.data?.message || 'Error saving meeting', 'error'); 
    }
  };

  const handleDeleteMeeting = async (id) => {
    if (!window.confirm('Delete this meeting?')) return;
    try {
      await api.delete(`/meetings/${id}`);
      setData(prev => ({ ...prev, meetings: prev.meetings.filter(m => m._id !== id) }));
      showToast('Meeting deleted');
    } catch (err) { showToast('Error deleting meeting', 'error'); }
  };

  const startEditingMeeting = (meeting) => {
    const d = new Date(meeting.scheduledDate);
    const groupId = typeof meeting.group === 'object' ? meeting.group._id : meeting.group;
    const attendeesList = meeting.attendees ? meeting.attendees.map(a => typeof a === 'object' ? String(a._id) : String(a)) : [];

    const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const localTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    setMeetingForm({
      title: meeting.title, description: meeting.description || '',
      scheduledDate: localDate, scheduledTime: localTime,
      location: meeting.location || '', agenda: meeting.agenda || '', 
      groupId: groupId, status: meeting.status || 'Scheduled', attendees: attendeesList,
      mode: meeting.mode || 'In-Person'
    });
    setEditingMeetingId(meeting._id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openGradingModal = (sub) => { setGradingModal({ isOpen: true, submission: sub, marks: sub.evaluation?.supervisor?.marks || 0, remarks: sub.evaluation?.supervisor?.remarks || '' }); };
  const closeGradingModal = () => { setGradingModal({ isOpen: false, submission: null, marks: 0, remarks: '' }); };

  const submitGrade = async () => {
    const { submission, marks, remarks } = gradingModal;
    if (!submission) return;

    const phaseId = typeof submission.phase === 'object' ? submission.phase._id : submission.phase;
    const stage = data.projectStages.find(s => s._id === phaseId);
    const maxAllowed = stage?.totalMarks || 100;

    if (Number(marks) > maxAllowed || Number(marks) < 0) {
      showToast(`Invalid entry! Marks must be between 0 and ${maxAllowed} for this stage.`, "error");
      return;
    }

    try {
      const res = await api.patch(`/submissions/${submission._id}/grade`, { marks: Number(marks), remarks });
      setData(prev => ({ ...prev, submissions: prev.submissions.map(s => s._id === submission._id ? res.data : s) }));
      showToast("Submission graded successfully"); closeGradingModal();
    } catch (err) { showToast(err.response?.data?.message || "Error grading submission", "error"); }
  };

  const GradingModal = () => {
    if (!gradingModal.isOpen) return null;
    const phaseId = typeof gradingModal.submission?.phase === 'object' ? gradingModal.submission?.phase._id : gradingModal.submission?.phase;
    const stage = data.projectStages.find(s => s._id === phaseId);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm fade-in">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          <div className="p-6 border-b bg-indigo-50 dark:bg-indigo-900/20"><h3 className="text-xl font-bold text-indigo-900 dark:text-indigo-200">Evaluate Submission</h3></div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Marks Obtained <span className="text-xs text-gray-400 font-normal ml-2">(Max: {stage?.totalMarks || 100})</span>
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
    );
  };

  const renderGroupDetail = () => {
    const group = myGroups.find(g => g._id === selectedGroupId);
    if (!group) return (<><GradingModal /><div className="p-8 text-center"><p className="text-gray-500">Group not found (might have been deleted)</p><button onClick={() => setSelectedGroupId(null)} className="mt-4 text-blue-600 hover:underline">Back to Dashboard</button></div></>);

    const projectId = getProjectId(group.project);
    const project = data.projects.find(p => p._id === projectId);
    const groupSubmissions = data.submissions.filter(s => getProjectId(s.project) === projectId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const members = Array.isArray(group.members) ? group.members : [];

    return (
      <>
        <GradingModal />
        <div className="fade-in space-y-6">
          <button onClick={() => setSelectedGroupId(null)} className="flex items-center text-sm text-gray-500 hover:text-blue-600 transition-colors font-medium"><span className="material-symbols-outlined text-lg mr-1">arrow_back</span>Back to Dashboard</button>
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white shadow-xl">
            <div className="flex justify-between items-start">
              <div><h2 className="text-3xl font-black mb-2">{group.name}</h2><p className="text-lg text-blue-100 font-medium">{project?.title || "No Project Title"}</p></div>
              <span className={`px-4 py-2 rounded-full text-sm font-bold ${group.isApproved ? 'bg-green-400 text-green-900' : 'bg-yellow-400 text-yellow-900'}`}>{group.isApproved ? 'Approved' : 'Pending Approval'}</span>
            </div>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4"><p className="text-xs text-blue-100 uppercase font-bold">Batch</p><p className="text-2xl font-black mt-1">{group.batch}</p></div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4"><p className="text-xs text-blue-100 uppercase font-bold">Members</p><p className="text-2xl font-black mt-1">{members.length}</p></div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4"><p className="text-xs text-blue-100 uppercase font-bold">Submissions</p><p className="text-2xl font-black mt-1">{groupSubmissions.length}</p></div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4"><p className="text-xs text-blue-100 uppercase font-bold">Progress</p><p className="text-2xl font-black mt-1">{calculateProgress(group._id)}%</p></div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-blue-600">group</span>Team Members</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {members.map((m, idx) => {
                const memberData = typeof m === 'object' ? m : data.users.find(u => u._id === m);
                const name = memberData?.name || memberData?.email || 'Unknown';
                const email = memberData?.email || '';
                const isLeader = (typeof group.leader === 'object' ? group.leader._id : group.leader) === (typeof m === 'object' ? m._id : m);
                return (
                  <div key={idx} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">{name?.[0]?.toUpperCase() || "?"}</div>
                    <div className="flex-1"><p className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">{name}{isLeader && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">Leader</span>}</p><p className="text-sm text-gray-500">{email}</p></div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-blue-600">assignment</span>Submitted Work ({groupSubmissions.length})</h3>
            {groupSubmissions.length === 0 ? (
              <div className="p-8 bg-gray-50 dark:bg-gray-700/30 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-center"><span className="material-symbols-outlined text-4xl text-gray-300 mb-2 block">inbox</span><p className="text-gray-500">No submissions uploaded by this group yet.</p></div>
            ) : (
              <div className="grid gap-4">
                {groupSubmissions.map(sub => {
                  const phaseId = getProjectId(sub.phase);
                  const stage = data.projectStages.find(s => s._id === phaseId);
                  const stageName = stage?.name || (typeof sub.phase === 'object' ? sub.phase.name : 'Unknown Stage');
                  return (
                    <div key={sub._id} className="bg-gray-50 dark:bg-gray-700/30 p-5 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-start gap-4 flex-1">
                          <div className={`p-3 rounded-full ${sub.status === 'Graded' ? 'bg-green-100 text-green-600' : sub.status === 'Submitted' ? 'bg-blue-100 text-blue-600' : 'bg-yellow-100 text-yellow-600'}`}><span className="material-symbols-outlined">description</span></div>
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-900 dark:text-white">{stageName}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Type: <span className="font-medium">{sub.submissionType}</span></p>
                            <p className="text-xs text-gray-500 mt-1">Submitted: {new Date(sub.createdAt).toLocaleString()}</p>
                            {sub.description && <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 italic">"{sub.description}"</p>}
                            {sub.links && Object.entries(sub.links).some(([k, v]) => v) && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {Object.entries(sub.links).map(([key, val]) => val && (
                                  <a key={key} href={val} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full hover:bg-blue-200 transition-colors font-medium"><span className="material-symbols-outlined text-sm">link</span>{key}</a>
                                ))}
                              </div>
                            )}
                            {sub.status === 'Graded' && (
                              <div className="mt-3 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                                <p className="text-sm font-bold text-green-900 dark:text-green-200">Grade: <span className="text-lg">{sub.evaluation?.totalMarks || 0}</span>/{stage?.totalMarks || 'N/A'} marks</p>
                                {sub.evaluation?.supervisor?.remarks && <p className="text-xs text-green-700 dark:text-green-300 mt-1 italic">Your feedback: "{sub.evaluation.supervisor.remarks}"</p>}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0 items-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${sub.status === 'Graded' ? 'bg-green-100 text-green-800' : sub.status === 'Submitted' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>{sub.status}</span>
                          {!supervisorEnabled ? (
                            <span className="text-[10px] font-bold text-red-500 bg-red-50 border border-red-200 px-2 py-1 rounded">Grading Disabled</span>
                          ) : (
                            <button onClick={() => openGradingModal(sub)} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors">
                              {sub.status === 'Graded' ? 'Edit Grade' : 'Grade'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
             <VivaHistoryPanel projectId={projectId} />
          </div>
          </div>
        </div>
      </>
    );
  };

  if (loading) return (<div className="flex justify-center items-center h-64"><div className="flex flex-col items-center gap-3"><div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600"></div><p className="text-gray-500">Loading Dashboard...</p></div></div>);
  if (!userId) return (<div className="p-10 text-center"><div className="inline-flex p-4 bg-red-50 text-red-600 rounded-full mb-4"><span className="material-symbols-outlined text-4xl">error</span></div><h3 className="text-xl font-bold text-red-600 mb-2">Authentication Error</h3><p className="text-gray-600">User not authenticated. Please log in again.</p></div>);
  if (selectedGroupId) return renderGroupDetail();

  if (activeTab === 'dashboard') {
    return (
      <>
        <GradingModal />
        <div className="fade-in space-y-6">
          <div className="flex justify-between items-center">
            <div><h2 className="text-3xl font-black text-gray-900 dark:text-white">My Supervised Groups</h2><p className="text-gray-500 mt-1">Manage and track your assigned student groups</p></div>
            <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-xl border border-blue-200 dark:border-blue-800"><p className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase">Total Groups</p><p className="text-3xl font-black text-blue-600 dark:text-blue-400">{myGroups.length}</p></div>
          </div>
          {myGroups.length === 0 ? (
            <div className="p-16 bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 text-center"><div className="inline-flex p-4 bg-gray-100 dark:bg-gray-700 rounded-full mb-4"><span className="material-symbols-outlined text-4xl text-gray-400">group_off</span></div><h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Groups Assigned Yet</h3><p className="text-gray-500 max-w-md mx-auto">You haven't been assigned to any student groups yet.</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myGroups.map((group) => {
                const progress = calculateProgress(group._id);
                const projectTitle = getProjectTitle(group.project);
                const members = Array.isArray(group.members) ? group.members : [];
                return (
                  <div key={group._id} className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden hover:border-blue-400 dark:hover:border-blue-600 transition-all shadow-sm hover:shadow-lg group">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 text-white">
                      <div className="flex justify-between items-start mb-3"><div className="flex items-center gap-2"><div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center font-bold">{group.batch?.slice(-2) || 'FY'}</div><span className={`px-3 py-1 rounded-full text-xs font-bold ${group.isApproved ? 'bg-green-400 text-green-900' : 'bg-yellow-400 text-yellow-900'}`}>{group.isApproved ? 'Approved' : 'Pending'}</span></div></div>
                      <h3 className="font-black text-xl mb-1 truncate" title={group.name}>{group.name}</h3><p className="text-sm text-blue-100 line-clamp-1">{projectTitle}</p>
                    </div>
                    <div className="p-5">
                      <div className="mb-4"><div className="flex items-center justify-between text-xs mb-2"><span className="font-medium text-gray-600 dark:text-gray-400">Progress</span><span className="font-bold text-blue-600">{progress}%</span></div><div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2"><div className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} /></div></div>
                      <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700"><div className="flex -space-x-2">{members.slice(0, 4).map((m, idx) => { const memberData = typeof m === 'object' ? m : data.users.find(u => u._id === m); const name = memberData?.name || memberData?.email || '?'; return (<div key={idx} className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 border-2 border-white dark:border-gray-800 flex items-center justify-center text-white text-xs font-bold" title={name}>{name[0]?.toUpperCase()}</div>); })}{members.length > 4 && (<div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-gray-800 flex items-center justify-center text-xs text-gray-600 dark:text-gray-400 font-bold">+{members.length - 4}</div>)}</div><button onClick={() => setSelectedGroupId(group._id)} className="text-sm font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 group-hover:gap-2 transition-all">Manage <span className="material-symbols-outlined text-sm">arrow_forward</span></button></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </>
    );
  }

  if (activeTab === 'my-groups') {
    return (
      <>
        <GradingModal />
        <div className="fade-in space-y-6">
          <div><h2 className="text-3xl font-black text-gray-900 dark:text-white">All Supervised Groups</h2><p className="text-gray-500 mt-1">Detailed list of all groups under your supervision</p></div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700"><tr><th className="px-6 py-4 font-bold text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400">Group Name</th><th className="px-6 py-4 font-bold text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400">Batch</th><th className="px-6 py-4 font-bold text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400">Project Title</th><th className="px-6 py-4 font-bold text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400">Members</th><th className="px-6 py-4 font-bold text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400">Progress</th><th className="px-6 py-4 font-bold text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400">Status</th><th className="px-6 py-4 font-bold text-xs uppercase tracking-wider text-gray-600 dark:text-gray-400 text-right">Actions</th></tr></thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {myGroups.length === 0 ? (
                    <tr><td colSpan="7" className="px-6 py-12 text-center"><span className="material-symbols-outlined text-4xl text-gray-300 block mb-2">group_off</span><p className="text-gray-500">No groups assigned yet.</p></td></tr>
                  ) : myGroups.map((group) => {
                    const progress = calculateProgress(group._id);
                    const members = Array.isArray(group.members) ? group.members : [];
                    return (
                      <tr key={group._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{group.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{group.batch}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate" title={getProjectTitle(group.project)}>{getProjectTitle(group.project)}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{members.length} students</td>
                        <td className="px-6 py-4"><div className="flex items-center gap-2"><div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2"><div className="bg-blue-600 h-2 rounded-full" style={{ width: `${progress}%` }} /></div><span className="text-xs font-bold text-blue-600">{progress}%</span></div></td>
                        <td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${group.isApproved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{group.isApproved ? 'Approved' : 'Pending'}</span></td>
                        <td className="px-6 py-4 text-right"><button className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-900 font-semibold text-sm bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors" onClick={() => setSelectedGroupId(group._id)}>Manage <span className="material-symbols-outlined text-sm">open_in_new</span></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (activeTab === 'meetings') {
    const now = new Date();
    const upcomingMeetings = data.meetings.filter(m => new Date(m.scheduledDate) > now).sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
    const pastMeetings = data.meetings.filter(m => new Date(m.scheduledDate) <= now).sort((a, b) => new Date(b.scheduledDate) - new Date(a.scheduledDate));
    
    return (
      <>
        <GradingModal />
        <div className="max-w-7xl mx-auto fade-in">
          <div className="mb-8"><h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">Meeting Management</h1><p className="text-gray-500">Schedule and track meetings with your supervised groups</p></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 h-fit sticky top-6">
              <div className={`p-6 border-b ${editingMeetingId ? 'bg-amber-50/50 dark:bg-amber-900/20' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined">{editingMeetingId ? 'edit_calendar' : 'event'}</span>
                  {editingMeetingId ? 'Edit Meeting' : 'Schedule New Meeting'}
                </h3>
              </div>
              <div className="p-6">
                <form className="space-y-5" onSubmit={handleMeetingSubmit}>
                  <div><label className="block text-sm font-bold mb-2">Meeting Title <span className="text-red-500">*</span></label><input name="title" value={meetingForm.title} onChange={handleMeetingInputChange} required className="block w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 py-2.5 px-3 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-600 focus:border-blue-600" placeholder="Weekly Progress Review" /></div>
                  
                  <div>
                    <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-300">Select Group <span className="text-red-500">*</span></label>
                    <select name="groupId" value={meetingForm.groupId} onChange={handleMeetingInputChange} disabled={!!editingMeetingId} required className={`block w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 py-2.5 px-3 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 ${editingMeetingId ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-gray-800' : ''}`}>
                      <option value="">Choose a group...</option>
                      {myGroups.map(g => (<option key={g._id} value={g._id}>{g.name} - {g.batch}</option>))}
                    </select>
                    {editingMeetingId && <p className="text-[10px] text-amber-600 mt-1">Group cannot be changed on an existing meeting.</p>}
                  </div>

                  {editingMeetingId && (
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                      <label className="block text-sm font-bold mb-2 text-indigo-800 dark:text-indigo-300">Meeting Status</label>
                      <select name="status" value={meetingForm.status} onChange={handleMeetingInputChange} className="block w-full rounded-lg border-2 border-indigo-300 py-2.5 px-3 bg-white focus:ring-2 focus:ring-indigo-600">
                        <option value="Scheduled">Scheduled</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                        <option value="Rescheduled">Rescheduled</option>
                        <option value="No-Show">No-Show</option>
                      </select>
                    </div>
                  )}

                  {meetingForm.status === 'Completed' && meetingForm.groupId && (
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800 animate-fade-in">
                      <label className="block text-sm font-bold mb-3 text-green-800 dark:text-green-300 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">how_to_reg</span>
                        Log Student Attendance
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {myGroups.find(g => g._id === meetingForm.groupId)?.members.map(member => {
                          const mData = typeof member === 'object' ? member : data.users.find(u => u._id === member);
                          const mId = mData?._id;
                          const isChecked = meetingForm.attendees?.some(id => String(id) === String(mId));
                          return (
                            <label key={mId} className={`flex items-center gap-2 text-sm bg-white dark:bg-gray-800 p-2 rounded border cursor-pointer transition-colors ${isChecked ? 'border-green-500 ring-1 ring-green-500' : 'hover:border-green-400'}`}>
                              <input type="checkbox"
                                className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setMeetingForm(prev => ({ ...prev, attendees: [...(prev.attendees || []), String(mId)] }));
                                  } else {
                                    setMeetingForm(prev => ({ ...prev, attendees: (prev.attendees || []).filter(id => String(id) !== String(mId)) }));
                                  }
                                }}
                              />
                              <span className="font-medium text-gray-700 dark:text-gray-200 truncate">{mData?.name || mData?.email || 'Unknown'}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-sm font-bold mb-2">Date <span className="text-red-500">*</span></label><input name="scheduledDate" type="date" value={meetingForm.scheduledDate} onChange={handleMeetingInputChange} required className="block w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 py-2.5 px-3 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-600 focus:border-blue-600" /></div>
                    <div><label className="block text-sm font-bold mb-2">Time <span className="text-red-500">*</span></label><input name="scheduledTime" type="time" value={meetingForm.scheduledTime} onChange={handleMeetingInputChange} required className="block w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 py-2.5 px-3 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-600 focus:border-blue-600" /></div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div>
                      <label className="block text-xs font-bold mb-1 text-gray-500 uppercase">Mode</label>
                      <select name="mode" value={meetingForm.mode} onChange={handleMeetingInputChange} className="block w-full rounded border-gray-300 dark:border-gray-600 py-2 px-2 bg-white dark:bg-gray-800 text-sm">
                        <option value="In-Person">In-Person</option>
                        <option value="Online">Online</option>
                        <option value="Hybrid">Hybrid</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1 text-gray-500 uppercase">
                        {meetingForm.mode === 'In-Person' ? 'Room' : 'Link'}
                      </label>
                      <input name="location" value={meetingForm.location} onChange={handleMeetingInputChange} className="block w-full rounded border-gray-300 dark:border-gray-600 py-2 px-2 bg-white dark:bg-gray-800 text-sm" 
                        placeholder={meetingForm.mode === 'In-Person' ? 'e.g., Room 302' : 'https://zoom.us/j/...'} />
                    </div>
                  </div>

                  <div><label className="block text-sm font-bold mb-2">Agenda</label><textarea name="agenda" value={meetingForm.agenda} onChange={handleMeetingInputChange} rows={2} className="block w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 py-2.5 px-3 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 resize-none" placeholder="Topics to discuss..." /></div>
                  <div><label className="block text-sm font-bold mb-2">Description / Notes</label><textarea name="description" value={meetingForm.description} onChange={handleMeetingInputChange} rows={3} className="block w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 py-2.5 px-3 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 resize-none" placeholder="Any additional context..." /></div>
                  
                  <div className="flex gap-3 pt-2">
                    {editingMeetingId && (<button type="button" onClick={() => { setEditingMeetingId(null); setMeetingForm({ title: '', description: '', scheduledDate: '', scheduledTime: '', location: '', agenda: '', groupId: '', status: 'Scheduled', attendees: [], mode: 'In-Person' }); }} className="flex-1 py-3 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 font-semibold transition-colors">Cancel</button>)}
                    <button type="submit" className={`flex-1 flex justify-center items-center gap-2 rounded-lg px-3 py-3 text-sm font-bold text-white shadow-lg transition-all active:scale-95 ${editingMeetingId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}><span className="material-symbols-outlined">{editingMeetingId ? 'save' : 'add'}</span>{editingMeetingId ? 'Update Meeting' : 'Schedule Meeting'}</button>
                  </div>
                </form>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-8">
              
              <div>
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">upcoming</span>
                  Upcoming Meetings <span className="bg-blue-100 text-blue-800 text-sm py-0.5 px-2 rounded-full">{upcomingMeetings.length}</span>
                </h2>
                
                {upcomingMeetings.length === 0 ? (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-12 text-center border-2 border-dashed border-gray-300 dark:border-gray-700">
                    <span className="material-symbols-outlined text-5xl text-gray-300 mb-3 block">event_available</span>
                    <p className="text-gray-500 font-medium">No upcoming meetings scheduled.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {upcomingMeetings.map(meeting => {
                      const meetingDate = new Date(meeting.scheduledDate);
                      const groupName = meeting.group?.name || 'Unknown Group';
                      
                      return (
                        <div key={meeting._id} className="bg-white dark:bg-gray-800 p-6 rounded-2xl border-2 border-blue-100 dark:border-gray-700 shadow-sm hover:border-blue-300 transition-all">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className={`text-xl font-bold dark:text-white ${meeting.status === 'Cancelled' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{meeting.title}</h3>
                                <span className={`px-2 py-0.5 border text-[10px] font-bold uppercase rounded-full tracking-wider ${
                                  meeting.status === 'Scheduled' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                  meeting.status === 'Cancelled' ? 'bg-gray-100 text-gray-600 border-gray-300' :
                                  meeting.status === 'Rescheduled' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                  'bg-green-50 text-green-700 border-green-200'
                                }`}>
                                  {meeting.status}
                                </span>
                              </div>
                              <p className="text-sm text-gray-500 font-medium mb-3 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[16px]">groups</span> {groupName}
                              </p>
                              
                              <div className="flex flex-wrap gap-3 text-sm text-gray-700 dark:text-gray-300">
                                <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg font-semibold">
                                  <span className="material-symbols-outlined text-[18px]">calendar_today</span>
                                  {meetingDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {meetingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                                
                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold border ${meeting.mode === 'Online' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : meeting.mode === 'Hybrid' ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-orange-50 border-orange-200 text-orange-700'}`}>
                                  <span className="material-symbols-outlined text-[18px]">
                                    {meeting.mode === 'Online' ? 'videocam' : meeting.mode === 'Hybrid' ? 'cast_connected' : 'meeting_room'}
                                  </span>
                                  {meeting.mode || 'In-Person'}
                                </div>

                                {meeting.location && (
                                  <div className="flex items-center">
                                    {meeting.location.startsWith('http') ? (
                                      <a href={meeting.location} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg font-bold shadow-sm transition-colors">
                                        <span className="material-symbols-outlined text-[18px]">link</span> Join Meeting
                                      </a>
                                    ) : (
                                      <span className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg font-semibold">
                                        <span className="material-symbols-outlined text-[18px]">location_on</span>
                                        {meeting.location}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2 bg-gray-50 dark:bg-gray-700 p-1 rounded-lg border border-gray-200 dark:border-gray-600">
                              <button onClick={() => startEditingMeeting(meeting)} className="p-1.5 text-amber-600 hover:bg-amber-100 dark:hover:bg-gray-600 rounded transition-colors" title="Edit"><span className="material-symbols-outlined text-[20px]">edit</span></button>
                            </div>
                          </div>
                          
                          {meeting.agenda && (
                            <div className="mt-4 p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border-l-4 border-blue-400">
                              <p className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase mb-1">Agenda</p>
                              <p className="text-sm text-gray-700 dark:text-gray-300">{meeting.agenda}</p>
                            </div>
                          )}
                          {meeting.description && <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">{meeting.description}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-gray-500">history</span>
                  Past Meetings <span className="bg-gray-200 text-gray-700 text-sm py-0.5 px-2 rounded-full">{pastMeetings.length}</span>
                </h2>
                
                {pastMeetings.length === 0 ? (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-12 text-center border-2 border-dashed border-gray-300 dark:border-gray-700">
                    <span className="material-symbols-outlined text-5xl text-gray-300 mb-3 block">event_busy</span>
                    <p className="text-gray-500 font-medium">No past meetings recorded.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pastMeetings.map(meeting => {
                      const meetingDate = new Date(meeting.scheduledDate);
                      const groupName = meeting.group?.name || 'Unknown Group';
                      
                      let statusBadge = '';
                      if (meeting.status === 'Completed') statusBadge = 'bg-green-100 text-green-800 border-green-200';
                      else if (meeting.status === 'No-Show') statusBadge = 'bg-red-100 text-red-800 border-red-200';
                      else if (meeting.status === 'Cancelled' || meeting.status === 'Rescheduled') statusBadge = 'bg-gray-200 text-gray-700 border-gray-300';
                      else statusBadge = 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'; 

                      return (
                        <div key={meeting._id} className="bg-gray-50 dark:bg-gray-800/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 transition-all hover:bg-white hover:shadow-sm">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                  <h3 className={`text-lg font-bold dark:text-white ${(meeting.status === 'Cancelled' || meeting.status === 'No-Show') ? 'text-gray-500 line-through decoration-gray-400' : 'text-gray-900'}`}>{meeting.title}</h3>
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusBadge}`}>
                                    {meeting.status}
                                  </span>
                              </div>
                              <p className="text-sm text-gray-500 font-medium mb-3">{groupName}</p>

                              <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-3">
                                <span className="flex items-center gap-1 bg-white border px-2 py-1 rounded"><span className="material-symbols-outlined text-[14px]">calendar_today</span>{meetingDate.toLocaleDateString()}</span>
                                <span className="flex items-center gap-1 bg-white border px-2 py-1 rounded"><span className="material-symbols-outlined text-[14px]">schedule</span>{meetingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <span className="flex items-center gap-1 bg-white border px-2 py-1 rounded">
                                  <span className="material-symbols-outlined text-[14px]">{meeting.mode === 'Online' ? 'videocam' : 'groups'}</span>
                                  {meeting.mode}
                                </span>
                              </div>

                              {meeting.status === 'Scheduled' && (
                                <div className="mt-3 bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-start gap-2 max-w-lg">
                                  <span className="material-symbols-outlined text-amber-600 text-sm mt-0.5">warning</span>
                                  <div>
                                    <p className="text-xs font-bold text-amber-800">Action Required</p>
                                    <p className="text-xs text-amber-700">This meeting has passed. Click Edit (✏️) to mark it "Completed" and log attendance.</p>
                                  </div>
                                </div>
                              )}

                              {meeting.status === 'Completed' && (
                                <div className="mt-3">
                                  <p className="text-xs font-bold text-gray-500 uppercase mb-1">Attendance Logged:</p>
                                  <div className="flex flex-wrap gap-2">
                                    {meeting.attendees && meeting.attendees.length > 0 ? (
                                      meeting.attendees.map((a, i) => (
                                        <span key={i} className="bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
                                          <span className="material-symbols-outlined text-[12px]">check_circle</span>
                                          {typeof a === 'object' ? (a.name || a.email) : 'Student'}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-xs text-gray-400 italic">No attendees logged.</span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex gap-2">
                                <button onClick={() => startEditingMeeting(meeting)} className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors" title="Update Status / Edit"><span className="material-symbols-outlined">edit</span></button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }
  if (activeTab === "notifications") {
    return (
      <div className="max-w-4xl mx-auto animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-semibold">Alerts & Notifications</h2>
            <p className="text-sm text-gray-500 mt-1">Stay updated with your supervised groups</p>
          </div>
          {data.notifications.length > 0 && (
            <button onClick={() => handleMarkNotificationRead("all")} className="text-sm text-blue-600 font-semibold hover:underline flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">done_all</span> Mark all as read
            </button>
          )}
        </div>
        {data.notifications.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center border-2 border-dashed border-gray-200 dark:border-gray-700">
            <span className="material-symbols-outlined text-6xl text-gray-300 mb-4">notifications_off</span>
            <h3 className="text-xl font-bold mb-2">No notifications yet</h3>
            <p className="text-gray-500">You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {data.notifications.map((notif) => (
              <div key={notif._id} className={`bg-white dark:bg-gray-800 p-5 rounded-xl ring-1 ring-gray-200 flex items-start gap-4 transition-all hover:shadow-md ${!notif.isRead ? 'bg-blue-50/50' : ''}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${notif.isRead ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-600'}`}>
                  <span className="material-symbols-outlined">notifications</span>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-semibold">{notif.title}</h3>
                    <span className="text-xs text-gray-500">{new Date(notif.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-gray-600">{notif.message}</p>
                  {!notif.isRead && <button onClick={() => handleMarkNotificationRead(notif._id)} className="mt-2 text-xs text-blue-600 font-medium hover:underline">Mark as read</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (activeTab === "announcements") {
    const announcementsList = data.announcements || []; 

    return (
      <div className="max-w-4xl mx-auto animate-fade-in">
        <div className="mb-8">
          <h2 className="text-3xl font-semibold">Global Announcements</h2>
          <p className="text-sm text-gray-500 mt-1">Important updates, news, and deadlines from the Coordinator</p>
        </div>
        
        {announcementsList.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center border-2 border-dashed border-gray-200 dark:border-gray-700">
            <span className="material-symbols-outlined text-6xl text-gray-300 mb-4">campaign</span>
            <h3 className="text-xl font-bold mb-2">No announcements yet</h3>
            <p className="text-gray-500">Check back later for updates.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {announcementsList.map((ann) => (
              <div key={ann._id} className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-all hover:shadow-md">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-2xl">campaign</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{ann.title}</h3>
                    <div className="text-xs text-gray-500 mb-4 mt-1 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                      {new Date(ann.createdAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full font-medium">From: {ann.author?.name || 'Coordinator'}</span>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{ann.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
  return (
    <>
      <GradingModal />
      <div className="text-center mt-20 text-gray-500">Content coming soon.</div>
    </>
  );
};

SupervisorContent.propTypes = {
  activeTab: PropTypes.string.isRequired,
  showToast: PropTypes.func.isRequired,
  currentUser: PropTypes.object,
};

export default SupervisorContent;