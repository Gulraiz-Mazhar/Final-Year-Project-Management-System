  // src/components/StudentContent.jsx
  import PropTypes from "prop-types";
  import React, { useState, useEffect, useMemo } from "react";
  import api from "../utils/api";
  import VivaSimulator from './VivaSimulator';

  const StudentContent = ({ activeTab, mockData, showToast, currentUser }) => {

    const maxSize = 4;

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
      ?? effectiveUser?.user?._id
      ?? "guest-user-id";

    const [localData, setLocalData] = useState({
      submissions: [],
      projects: [],
      groups: [],
      users: [],
      notifications: [],
      projectStages: [],
      submissionSummaries: [],
      academicSessions: [],
      ...mockData,
    });

    const [selectedSubmission, setSelectedSubmission] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [joinGroupId, setJoinGroupId] = useState("");
    const [newMemberEmail, setNewMemberEmail] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const [isEditingSettings, setIsEditingSettings] = useState(false);
    const [students, setStudents] = useState([]);
    const [meetings, setMeetings] = useState([]);
    const [loadingMeetings, setLoadingMeetings] = useState(true);

    useEffect(() => {
      let isMounted = true;
      const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
          const [groupRes, submissionsRes, projectsRes, studentsRes, stagesRes, sessionsRes, notifsRes, announcementsRes] = await Promise.all([
            api.get("/groups"),
            api.get("/submissions"),
            api.get("/projects/my-project").catch(err => ({ data: null })),
            api.get("/users/students"),
            api.get("/project-stages"),
            api.get("/sessions"),
            api.get("/notifications").catch(() => ({ data: [] })),
            api.get("/announcements").catch(() => ({ data: [] })) // <-- Added Announcements
          ]);

          if (isMounted) {
            let fetchedGroups = [];
            const groupData = groupRes.data;
            if (Array.isArray(groupData)) {
              fetchedGroups = groupData.filter(g => g && g._id);
            } else if (groupData && typeof groupData === 'object' && groupData._id) {
              fetchedGroups = [groupData];
            }

            setLocalData((prev) => ({
              ...prev,
              groups: fetchedGroups,
              submissions: submissionsRes.data || [],
              projects: projectsRes.data ? [projectsRes.data] : [],
              projectStages: stagesRes.data || [],
              academicSessions: sessionsRes.data || [],
              notifications: notifsRes.data || [],
              announcements: announcementsRes?.data || [] // <-- Added Announcements
            }));
            setStudents(studentsRes.data || []);
          }
        } catch (err) {
          if (isMounted) {
            console.error("Fetch Error:", err);
            setError(err.message);
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      };

      if (userId && userId !== "guest-user-id") {
        fetchData();
      } else {
        setLoading(false);
      }

      return () => {
        isMounted = false;
      };
    }, [userId]);

    const submissions = Array.isArray(localData.submissions) ? localData.submissions : [];
    const projects = Array.isArray(localData.projects) ? localData.projects : [];
    const groups = Array.isArray(localData.groups) ? localData.groups : [];
    const users = Array.isArray(localData.users) ? localData.users : [];
    const notifications = Array.isArray(localData.notifications) ? localData.notifications : [];

    const projectStages = useMemo(() => {
      return Array.isArray(localData.projectStages)
        ? [...localData.projectStages].sort((a, b) => a.order - b.order)
        : [];
    }, [localData.projectStages]);

    const academicSessions = Array.isArray(localData.academicSessions) ? localData.academicSessions : [];
    const group = groups[0] || {};
    const hasGroup = !!group?._id;
    const project = projects[0] ?? {};

    const members = Array.isArray(group.members) ? group.members : [];
    const leaderId = typeof group.leader === 'object' ? group.leader?._id : group.leader;
    const isLeader = leaderId === userId;

    // FIX: Force the leader to always be at index 0 of the array!
    const sortedMembers = [...members].sort((a, b) => {
      const aId = String(typeof a === 'object' ? a._id : a);
      const bId = String(typeof b === 'object' ? b._id : b);
      if (aId === String(leaderId)) return -1;
      if (bId === String(leaderId)) return 1;
      return 0;
    });

    const safeDateString = (d) => {
      if (!d) return "—";
      const date = d instanceof Date ? d : new Date(d);
      return isNaN(date.getTime()) ? "—" : date.toDateString();
    };

    const currentSession = useMemo(() => {
      return academicSessions.find((s) => s.isCurrent) ?? academicSessions[0] ?? {};
    }, [academicSessions]);

    const getDeadlineForStage = (stageId) => {
      const phaseTimeline = currentSession.timeline?.find((t) => {
        const tlStageId = typeof t.stage === 'object' ? t.stage._id : t.stage;
        return tlStageId?.toString() === stageId?.toString();
      });
      if (phaseTimeline?.deadline) {
        return safeDateString(phaseTimeline.deadline);
      }
      return "TBA";
    };

    const getMemberName = (m) => {
      if (!m) return "Unknown";
      if (typeof m === 'object') return m.name || m.email || "Unknown";
      const user = users.find(u => u._id === m);
      return user ? user.name : m;
    };

    const getMemberId = (m) => {
      if (!m) return null;
      return typeof m === 'object' ? m._id : m;
    };

    const getSupervisorName = () => {
      const sup = group.supervisor;
      if (!sup) return "Pending";
      if (typeof sup === 'object') return sup.name || sup.email || "Unknown";
      const user = users.find(u => u._id === sup);
      return user ? user.name : "Pending";
    };

    const getProjectTitle = () => {
      const proj = group.project;
      if (!proj) return "Not Assigned";
      if (typeof proj === 'object') return proj.title || "Untitled Project";
      const foundProject = projects.find(p => p._id === proj);
      return foundProject ? foundProject.title : "Not Assigned";
    };

    const getStatusColor = (status) => {
      switch (status) {
        case 'Approved': return 'bg-green-100 text-green-800 border-green-200';
        case 'Graded': return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'Rejected': return 'bg-red-100 text-red-800 border-red-200';
        case 'Changes Requested': return 'bg-amber-100 text-amber-800 border-amber-200';
        case 'Submitted':
        case 'Pending':
        case 'Under Review': return 'bg-purple-100 text-purple-800 border-purple-200';
        default: return 'bg-gray-100 text-gray-800 border-gray-200';
      }
    };

    const tasks = useMemo(() => {
      return projectStages.map(stage => {
        const sub = submissions.find(s => {
          const sPhaseId = typeof s.phase === 'object' ? s.phase._id : s.phase;
          const sProjId = typeof s.project === 'object' ? s.project._id : s.project;
          return sPhaseId?.toString() === stage._id?.toString() && sProjId?.toString() === project._id?.toString();
        });

        const timeline = currentSession.timeline?.find(t => {
          const tlStageId = typeof t.stage === 'object' ? t.stage._id : t.stage;
          return tlStageId?.toString() === stage._id?.toString();
        });

        const deadline = timeline?.deadline ? new Date(timeline.deadline).toDateString() : "TBA";
        const startDate = timeline?.startDate ? new Date(timeline.startDate).toDateString() : "TBA";
        const isOpen = timeline?.isSubmissionOpen ?? true;
        const status = sub ? sub.status : "Not Submitted";

        return { stage, sub, deadline, startDate, status, isOpen };
      });
    }, [projectStages, submissions, project._id, currentSession]);

    useEffect(() => {
      if (activeTab === "tasks" && !selectedSubmission && tasks.length > 0) {
        const firstTask = tasks[0];
        setSelectedSubmission({
          phase: firstTask.stage._id,
          submissionType: firstTask.stage.allowedSubmissionTypes?.[0] || 'DOCUMENT',
          sub: firstTask.sub,
          stageName: firstTask.stage.name
        });
      }
    }, [activeTab, tasks.length]);

// ===== UPDATE IN StudentContent.jsx =====
  useEffect(() => {
    // 🔧 INFINITE LOAD FIX: If there is no group, turn off loading immediately and exit.
    if (!group?._id) {
      setLoadingMeetings(false);
      return;
    }

    const fetchMeetings = async () => {
      try {
        setLoadingMeetings(true);
        const res = await api.get('/meetings');

        const groupMeetings = res.data.filter(m => {
          const meetingGroupId = typeof m.group === 'object' ? m.group._id : m.group;
          return meetingGroupId?.toString() === group._id.toString();
        });

        setMeetings(groupMeetings);
      } catch (err) {
        console.error("Error fetching meetings:", err);
        showToast("Error loading meetings", "error");
      } finally {
        setLoadingMeetings(false);
      }
    };

    fetchMeetings();
  }, [group?._id]);

    const handleSubmitIdea = async (e) => {
      e.preventDefault();
      if (!group || !group._id) {
        showToast("You must create or join a group first!", "error");
        return;
      }
      if (!isLeader) {
        showToast("Only the Group Leader can submit a proposal.", "error");
        return;
      }

      const formData = new FormData(e.target);
      const rawData = Object.fromEntries(formData);

      const payload = {
        title: rawData.title,
        category: rawData.category,
        description: rawData.description,
        techStack: rawData.techStack ? rawData.techStack.split(",").map((tag) => tag.trim()).filter(t => t !== "") : [],
        visibility: rawData.visibility || 'Internal'
      };

      if (rawData.supervisorId && rawData.supervisorId.trim() !== "") {
        payload.supervisor = rawData.supervisorId;
      }

      try {
        let res;
        if (project && project._id && (project.status === 'Changes Requested' || project.status === 'Rejected')) {
          payload.status = 'Pending';
          payload.isIdeaApproved = false;
          if (payload.description === "") delete payload.description;

          res = await api.put(`/projects/${project._id}`, payload);
          showToast("Proposal Updated Successfully!");
        } else {
          payload.group = group._id;
          payload.year = parseInt(rawData.year) || new Date().getFullYear();
          res = await api.post("/projects", payload);
          showToast("Idea Submitted Successfully!");
        }

        setLocalData((prev) => ({
          ...prev,
          projects: [res.data],
          myProject: res.data
        }));
      } catch (err) {
        console.error("❌ Project Submit Error:", err.response?.data);
        const msg = err.response?.data?.message || err.response?.data?.error || "Error submitting proposal";
        showToast(msg, "error");
      }
    };

    const handleCreateGroup = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      if (!userId || userId === "guest-user-id") {
        showToast("Error: You are not logged in (Invalid User ID)", "error");
        return;
      }

      const selectedMembers = formData.getAll('members');

      const payload = {
        name: formData.get('name'),
        batch: formData.get('batch'),
        leader: formData.get('leader'),
        members: selectedMembers
      };

      try {
        const res = await api.post("/groups", payload);
        setLocalData((prev) => ({
          ...prev,
          groups: [res.data],
        }));
        showToast("Group Created Successfully!");
      } catch (err) {
        console.error("❌ Create Group Error:", err.response?.data);
        const serverMessage = err.response?.data?.message || "Error creating group";
        showToast(serverMessage, "error");
      }
    };

    const handleJoinGroup = async (e) => {
      e.preventDefault();
      if (!joinGroupId) return showToast("Enter group ID", "error");
      try {
        const res = await api.post(`/groups/join/${joinGroupId}`);
        setLocalData((prev) => ({
          ...prev,
          groups: [res.data],
        }));
        showToast("Joined Group Successfully!");
        setJoinGroupId("");
      } catch (err) {
        const msg = err.response?.data?.message || "Error joining group";
        showToast(msg, "error");
      }
    };

    const handleAddMember = async (groupId, memberEmail) => {
      const gid = groupId ?? group._id;
      if (!gid) return showToast("No group selected", "error");
      if (!isLeader) return showToast("Only leader can add members", "error");

      try {
        const userRes = await api.get(`/users?email=${memberEmail}`);

        const memberId = userRes.data[0]?._id;
        if (!memberId) throw new Error("User not found");

        const res = await api.put(`/groups/${gid}`, { members: [...members.map(getMemberId), memberId] });
        setLocalData((prev) => ({
          ...prev,
          groups: (Array.isArray(prev.groups) ? prev.groups : []).map((g) => (g._id === gid ? res.data : g)),
        }));
        showToast("Member added");
        setIsAdding(false);
        setNewMemberEmail("");
      } catch (err) {
        showToast(err.response?.data?.message || "Error adding member", "error");
      }
    };

    const handleMarkNotificationRead = async (id) => {
      try {
        if (id === "all") {
          await Promise.all(notifications.map(n => api.put(`/notifications/${n._id}/read`)));
          showToast("All notifications marked as read");
          setLocalData((prev) => ({
            ...prev,
            notifications: prev.notifications.map(n => ({ ...n, isRead: true }))
          }));
        } else {
          await api.put(`/notifications/${id}/read`);
          showToast("Notification marked as read");
          setLocalData((prev) => ({
            ...prev,
            notifications: prev.notifications.map((n) => n._id === id ? { ...n, isRead: true } : n)
          }));
        }
      } catch (err) {
        showToast("Error marking notification", "error");
      }
    };

    if (activeTab === "dashboard") {
      if (!project || !project._id) {
        return (
          <div className="max-w-2xl mx-auto mt-10">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 border-2 border-blue-200 dark:border-gray-700 rounded-2xl p-10 text-center shadow-lg">
              <div className="inline-flex p-5 bg-blue-100 text-blue-600 rounded-full mb-6">
                <span className="material-symbols-outlined text-5xl">lightbulb</span>
              </div>
              <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-3">No Project Idea Submitted</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Your group has not submitted a project proposal yet. Please go to the "Submit Idea" tab to send your proposal to the coordinator.
              </p>
            </div>
          </div>
        );
      }

      if (project.status === 'Changes Requested') {
        return (
          <div className="max-w-3xl mx-auto mt-10">
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-2xl p-10 shadow-xl">
              <div className="flex flex-col items-center text-center">
                <div className="bg-amber-100 text-amber-600 p-5 rounded-full mb-6">
                  <span className="material-symbols-outlined text-5xl">edit_note</span>
                </div>
                <h3 className="text-3xl font-black text-amber-900 dark:text-amber-200 mb-4">Changes Requested</h3>
                <p className="text-lg text-amber-800 dark:text-amber-300 mb-6">
                  The coordinator has reviewed your proposal and requested changes.
                </p>
                <div className="w-full bg-white dark:bg-gray-800 rounded-xl p-6 mb-6 border-2 border-amber-200 dark:border-amber-800">
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Coordinator Feedback:</p>
                  <p className="text-gray-800 dark:text-gray-200 italic leading-relaxed">{project.remarks || "Please review project requirements."}</p>
                </div>
                <button
                  onClick={() => showToast("Click 'Submit Idea' on the sidebar to edit your proposal.", "info")}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
                >
                  Go to "Submit Idea" tab to Edit
                </button>
              </div>
            </div>
          </div>
        );
      }

      if (project.status === 'Rejected') {
        return (
          <div className="max-w-3xl mx-auto mt-10">
            <div className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl p-10 text-center shadow-xl">
              <div className="inline-flex p-5 bg-red-100 text-red-600 rounded-full mb-6">
                <span className="material-symbols-outlined text-5xl">cancel</span>
              </div>
              <h3 className="text-3xl font-black text-red-900 dark:text-red-200 mb-4">Proposal Rejected</h3>
              <p className="text-lg text-red-800 dark:text-red-300 mb-4">
                Unfortunately, your project proposal "{project.title}" was not approved.
              </p>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-6 border-2 border-red-200 dark:border-red-800">
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Reason: {project.remarks || "Please contact your supervisor for feedback."}</p>
              </div>
              <p className="text-gray-700 dark:text-gray-300">Please submit a new idea using the "Submit Idea" tab.</p>
            </div>
          </div>
        );
      }

      const isPending = project.status === 'Pending' || (project.isIdeaApproved === false && project.status !== 'Rejected' && project.status !== 'Changes Requested');

      if (isPending) {
        return (
          <div className="max-w-3xl mx-auto mt-10">
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-2 border-purple-200 dark:border-purple-800 rounded-2xl p-10 text-center shadow-xl">
              <div className="inline-flex p-5 bg-purple-100 text-purple-600 rounded-full mb-6">
                <span className="material-symbols-outlined text-5xl">hourglass_top</span>
              </div>
              <h3 className="text-3xl font-black text-purple-900 dark:text-purple-200 mb-4">Proposal Under Review</h3>
              <p className="text-xl font-semibold text-purple-800 dark:text-purple-300 mb-6">
                "{project.title}"
              </p>
              <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
                Your idea has been submitted successfully and is currently being reviewed by the Coordinator/Supervisor.
                <br />
                <br />
                Once approved, this dashboard will unlock, and you can begin submitting tasks.
              </p>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <p>Submitted on: {safeDateString(project.createdAt)}</p>
              </div>
            </div>
          </div>
        );
      }

      const totalTasks = projectStages.length;
      const completedTasks = tasks.filter(t => ['Graded', 'Approved'].includes(t.status)).length;
      const progressPercentage = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

      return (
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-8 shadow-xl">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-1.5 rounded-full text-sm font-semibold mb-3">
                    <span className="material-symbols-outlined text-sm">verified</span>
                    Approved Project
                  </div>
                  <h1 className="text-3xl font-black mb-2">{project.title || "No Project Title"}</h1>
                  <p className="text-blue-100">Supervisor: {getSupervisorName()}</p>
                </div>
                <div className="text-right">
                  <div className="text-5xl font-black mb-1">{progressPercentage}%</div>
                  <div className="text-sm text-blue-100">Progress</div>
                </div>
              </div>
              <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
                <div className="bg-white h-full rounded-full transition-all duration-500" style={{ width: `${progressPercentage}%` }}></div>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-4 text-center">
                <div className="bg-white/10 rounded-lg p-3">
                  <p className="text-sm text-blue-100">Category: {project.category || "N/A"}</p>
                </div>
                <div className="bg-white/10 rounded-lg p-3">
                  <p className="text-sm text-blue-100">Year: {project.year || "N/A"}</p>
                </div>
                <div className="bg-white/10 rounded-lg p-3">
                  <p className="text-sm text-blue-100">Visibility: {project.visibility || "N/A"}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Pending Tasks</h2>
              </div>
              <div className="p-6 grid gap-4">
                {tasks.filter((t) => t.status === "Not Submitted" || t.status === "Changes Requested" || t.status === "Rejected").map((task) => (
                  <div
                    key={task.stage._id}
                    onClick={() => setSelectedSubmission({ phase: task.stage._id, submissionType: task.stage.allowedSubmissionTypes[0] })}
                    className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-5 cursor-pointer hover:shadow-md transition-all"
                  >
                    <div className="flex items-start gap-4">
                      <div className="bg-blue-100 text-blue-600 p-3 rounded-full">
                        <span className="material-symbols-outlined">description</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-1">{task.stage.name}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Due: {task.deadline}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(task.status)}`}>{task.status}</span>
                    </div>
                  </div>
                ))}
                {tasks.filter(t => t.status === "Not Submitted" || t.status === "Changes Requested" || t.status === "Rejected").length === 0 && (
                  <p className="text-center text-gray-500 py-8">No pending tasks.</p>
                )}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow border border-gray-200 dark:border-gray-700">
              <p className="text-center text-gray-700 dark:text-gray-300">Total Marks: {project.totalMarks || 0} | Final Grade: {project.finalGrade || "N/A"}</p>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Notifications</h3>
              </div>
              <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
                {notifications.length > 0 ? (
                  notifications.slice(0, 5).map((notif) => (
                    <div key={notif._id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                      <div className="flex justify-between items-start">
                        <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{notif.title}</h4>
                        <span className="text-xs text-gray-500">{notif.createdAt ? new Date(notif.createdAt).toLocaleTimeString() : "—"}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 py-8">No new notifications.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === "groups") {
      if (loading) {
        return <div className="text-center mt-20 text-gray-500">Loading group information...</div>;
      }
      if (error) {
        return <div className="text-center mt-20 text-red-500">Error loading group: {error}</div>;
      }

      if (!hasGroup) {
        return (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-8">
                <h2 className="text-3xl font-bold mb-8 text-center">Join or Create Group</h2>

                <form onSubmit={handleCreateGroup} className="space-y-6 mb-12">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Group Name</label>
                    <input type="text" name="name" required className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-3 bg-transparent" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Batch</label>
                    <input type="text" name="batch" required className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-3 bg-transparent" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Leader</label>
                    <select name="leader" required className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-3 bg-transparent">
                      <option value="">Choose Leader</option>
                      {students.map(student => (
                        <option key={student._id} value={student._id}>{student.name} ({student.email})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Members</label>
                    <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-4">
                      {students.length > 0 ? (
                        students.map(student => (
                          <label key={student._id} className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              name="members"
                              value={student._id}
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm">
                              {student.name}
                              <span className="text-gray-500 ml-1">({student.email})</span>
                            </span>
                          </label>
                        ))
                      ) : (
                        <p className="text-center text-gray-500">No students available.</p>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Select all members including the leader.</p>
                  </div>

                  <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors">
                    Create New Group
                  </button>
                </form>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
                  <h3 className="text-xl font-bold mb-4 text-center">Join Existing Group</h3>
                  <form onSubmit={handleJoinGroup} className="flex gap-3">
                    <input
                      type="text"
                      value={joinGroupId}
                      onChange={(e) => setJoinGroupId(e.target.value)}
                      placeholder="Enter Group ID"
                      className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-3 bg-transparent"
                      required
                    />
                    <button type="submit" className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors">
                      Join
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-8 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">{group.name}</h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400">ID: {group._id}</p>
                </div>
                {!isLeader && (
                  <button
                    onClick={async () => {
                      try {
                        await api.post(`/groups/${group._id}/leave`);
                        setLocalData((prev) => ({ ...prev, groups: [] }));
                        showToast("Left group successfully");
                      } catch (err) {
                        showToast(err.response?.data?.message || "Error leaving group", "error");
                      }
                    }}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700"
                  >
                    Leave Group
                  </button>
                )}
                {isLeader && members.length < maxSize && (
                  <div>
                    {isAdding ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (newMemberEmail) handleAddMember(group._id, newMemberEmail);
                        }}
                        className="flex gap-2"
                      >
                        <input type="email" placeholder="Student Email" value={newMemberEmail} onChange={(e) => setNewMemberEmail(e.target.value)} className="px-3 py-2 border rounded" required />
                        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Add</button>
                        <button type="button" onClick={() => setIsAdding(false)} className="text-gray-500 px-2">✕</button>
                      </form>
                    ) : (
                      <button onClick={() => setIsAdding(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2">
                        <span className="material-symbols-outlined">person_add</span> Add Member
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {isLeader && (
              <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Group Join Code</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{group.joinCode || "LOADING..."}</p>
                    <p className="text-xs text-gray-500 mt-1">Share this code with students to let them join.</p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(group.joinCode);
                      showToast("Join code copied to clipboard!");
                    }}
                    className="p-2 hover:bg-indigo-100 dark:hover:bg-indigo-800 rounded-lg transition-colors text-indigo-600 dark:text-indigo-400"
                    title="Copy Code"
                  >
                    <span className="material-symbols-outlined">content_copy</span>
                  </button>
                </div>
              </div>
            )}

            <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400">Batch</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{group.batch}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400">Project</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{getProjectTitle()}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400">Supervisor</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{getSupervisorName()}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl">
                <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                <span className="inline-block mt-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-bold">
                  {group.status || "Draft"}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Team Members ({members.length}/{maxSize})</h2>
            </div>
            <div className="p-6 grid gap-4">
              {sortedMembers.map((memberOrId, index) => {
                const name = getMemberName(memberOrId);
                const email = typeof memberOrId === 'object' ? memberOrId.email : (users.find(u => u._id === memberOrId)?.email);
                const memberId = getMemberId(memberOrId);
                const isThisMemberLeader = memberId === leaderId;

                return (
                  <div key={memberId || index} className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-5 flex items-center gap-4 border border-gray-200 dark:border-gray-700">
                    <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xl">
                      {name?.[0] || "?"}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900 dark:text-white">{name}</h3>
                        {isThisMemberLeader && <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold rounded">Leader</span>}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{email || "Loading..."}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            {members.length >= maxSize && <p className="text-center text-amber-600 p-4 bg-amber-50 dark:bg-amber-900/20">⚠️ Maximum group size reached.</p>}
          </div>

          {isLeader && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-6 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Group Settings</h2>
                  {!isEditingSettings && (
                    <button
                      onClick={() => setIsEditingSettings(true)}
                      className="text-sm text-blue-600 font-medium hover:underline flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">edit</span> Edit Details
                    </button>
                  )}
                </div>
              </div>
              <div className="p-6">
                {isEditingSettings ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = new FormData(e.target);
                      const payload = {
                        name: form.get("name"),
                        links: { repo: form.get("repo_link") }
                      };
                      try {
                        api.put(`/groups/${group._id}`, payload).then((res) => {
                          setLocalData((prev) => ({
                            ...prev,
                            groups: (Array.isArray(prev.groups) ? prev.groups : []).map((g) => (g._id === group._id ? res.data : g)),
                          }));
                          showToast("Settings saved successfully");
                          setIsEditingSettings(false);
                        });
                      } catch (err) {
                        showToast("Error saving settings", "error");
                      }
                    }}
                    className="grid gap-4 bg-gray-50 dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 animate-fade-in"
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Group Name</label>
                      <input type="text" name="name" defaultValue={group.name} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 bg-transparent" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">GitHub Repository Link</label>
                      <input type="url" name="repo_link" defaultValue={group.links?.repo} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 bg-transparent" />
                    </div>
                    <div className="flex gap-3">
                      <button type="submit" className="bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors">
                        Save Changes
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingSettings(false)}
                        className="bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 py-2 px-4 rounded-lg font-semibold hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Group Name</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{group.name}</p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                      <p className="text-sm text-gray-500 dark:text-gray-400">GitHub Repository</p>
                      {group.links?.repo ? (
                        <a href={group.links.repo} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 mt-1">
                          <span className="material-symbols-outlined text-sm">link</span>
                          {group.links.repo}
                        </a>
                      ) : (
                        <p className="text-gray-500 italic mt-1">No link provided</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (activeTab === "group-progress") {
      return (
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-8 shadow-xl">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-black mb-2">{group.name || "My Group"}</h1>
                <p className="text-blue-100 text-lg">{project.title || "No Project Assigned"}</p>
              </div>
              <div className="text-right">
                <div className="text-5xl font-black">{Math.round((tasks.filter(t => t.status === 'Graded' || t.status === 'Approved').length / tasks.length) * 100) || 0}%</div>
                <div className="text-sm text-blue-100">Completed</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-500">Total Tasks</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{tasks.length}</p>
                </div>
                <div className="bg-blue-100 p-3 rounded-full">
                  <span className="material-symbols-outlined text-blue-600">assignment</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-500">Completed</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">{tasks.filter(t => t.status === 'Graded' || t.status === 'Approved').length}</p>
                </div>
                <div className="bg-green-100 p-3 rounded-full">
                  <span className="material-symbols-outlined text-green-600">check_circle</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-500">Pending</p>
                  <p className="text-3xl font-bold text-amber-600 mt-1">{tasks.filter(t => t.status === 'Not Submitted').length}</p>
                </div>
                <div className="bg-amber-100 p-3 rounded-full">
                  <span className="material-symbols-outlined text-amber-600">hourglass_empty</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-500">Team Members</p>
                  <p className="text-3xl font-bold text-purple-600 mt-1">{members.length}</p>
                </div>
                <div className="bg-purple-100 p-3 rounded-full">
                  <span className="material-symbols-outlined text-purple-600">groups</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">info</span> Project Information
              </h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg">
                <p className="text-sm text-gray-500">Category</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{project.category || "Not Specified"}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg">
                <p className="text-sm text-gray-500">Academic Year</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{project.year || "N/A"}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg">
                <p className="text-sm text-gray-500">Supervisor</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{getSupervisorName()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">timeline</span> Project Timeline
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Stage</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Deadline</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Marks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {tasks.map((task, idx) => (
                    <tr key={task.stage._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                            {idx + 1}
                          </div>
                          <span className="font-medium text-gray-900 dark:text-white">{task.stage.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{task.deadline}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(task.status)}`}>
                          {task.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {task.sub?.evaluation?.totalMarks ?? 0}/{task.stage.totalMarks}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">group</span> Team Members
              </h2>
            </div>
            <div className="p-6 grid gap-4">
              {sortedMembers.map((m, idx) => {
                const name = getMemberName(m);
                const email = typeof m === 'object' ? m.email : users.find(u => u._id === m)?.email;
                const memberId = getMemberId(m);
                const isThisMemberLeader = memberId === leaderId;

                return (
                  <div key={memberId || idx} className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-5 flex items-center gap-4 border border-gray-200 dark:border-gray-700">
                    <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xl">
                      {name?.[0] || "?"}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900 dark:text-white">{name}</h3>
                        {isThisMemberLeader && <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold rounded">Leader</span>}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{email || "Loading..."}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === "submit-idea") {
      const isEditing = project && project._id && (project.status === 'Changes Requested' || project.status === 'Rejected');

      if (project && project._id && !isEditing) {
        const isApproved = project.status === 'Approved';

        return (
          <div className="max-w-2xl mx-auto mt-10 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-10 text-center">
              <div className={`inline-flex p-5 rounded-full mb-6 ${isApproved ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                <span className="material-symbols-outlined text-5xl">
                  {isApproved ? 'verified' : 'inventory_2'}
                </span>
              </div>
              <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-3">
                {isApproved ? 'Project Approved!' : 'Proposal Submitted'}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6 text-lg">
                Your group's proposal for <span className="font-bold">"{project.title}"</span> is currently:
                <span className={`ml-2 px-3 py-1 rounded-full text-sm font-bold ${getStatusColor(project.status)}`}>
                  {project.status}
                </span>
              </p>

              <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl border border-gray-200 dark:border-gray-600 mb-8 text-left max-w-md mx-auto">
                <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-500">info</span>
                  {isApproved
                    ? "Congratulations! Your project is approved. You can now start tracking progress and submitting tasks from your Dashboard."
                    : "Your proposal is being reviewed by the coordinator. Once approved, your project dashboard will be unlocked."
                  }
                </p>
              </div>

              {/* <button
                onClick={() => {
                  if (typeof navigateDashboard === 'function') {
                    navigateDashboard("dashboard");
                  } else {
                    showToast("Please click 'Dashboard' on the left sidebar to continue.", "info");
                  }
                }}
                className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold shadow-md transition-all active:scale-95"
              >
                <span className="material-symbols-outlined">dashboard</span>
                Go to Dashboard
              </button> */}
            </div>
          </div>
        );
      }

      const supervisors = users.filter(u => u.role === 'Supervisor');

      return (
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-8 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">{isEditing ? "Edit Project Proposal" : "Submit Project Proposal"}</h2>
              <p className="text-gray-600 dark:text-gray-300">
                {isEditing
                  ? "Update your proposal based on coordinator feedback."
                  : "Define your Final Year Project clearly. This proposal will be reviewed by the coordinator."
                }
              </p>
            </div>

            <form onSubmit={handleSubmitIdea} className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Project Title</label>
                <input type="text" name="title" defaultValue={project?.title} required className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-3 bg-transparent" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Domain / Category</label>
                <select name="category" defaultValue={project?.category} required className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-3 bg-transparent">
                  <option value="">Select Domain...</option>
                  <option value="Web Development">Web Development</option>
                  <option value="Mobile App (Android/iOS)">Mobile App (Android/iOS)</option>
                  <option value="Artificial Intelligence / ML">Artificial Intelligence / ML</option>
                  <option value="Internet of Things (IoT)">Internet of Things (IoT)</option>
                  <option value="Blockchain">Blockchain</option>
                  <option value="Cybersecurity">Cybersecurity</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Technology Stack
                  <span className="text-xs text-gray-500 ml-1">(Comma separated)</span>
                </label>
                <input type="text" name="techStack" defaultValue={project?.techStack?.join(", ")} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-3 bg-transparent" placeholder="React, Node.js, MongoDB" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Preferred Supervisor
                  <span className="text-xs text-gray-500 ml-1">(Optional)</span>
                </label>
                <select name="supervisorId" defaultValue={project?.supervisor?._id || project?.supervisor} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-3 bg-transparent">
                  <option value="">Any Available Supervisor</option>
                  {supervisors.map(sup => (
                    <option key={sup._id} value={sup._id}>{sup.name} ({sup.department || 'CS'})</option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Problem Statement & Proposed Solution</label>
                <textarea
                  name="description"
                  defaultValue={project?.description}
                  rows="8"
                  minLength="100"
                  required
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-3 bg-transparent resize-none"
                  placeholder="Describe the problem your project solves and your proposed approach..."
                />
                <span className="absolute bottom-3 right-3 text-xs text-gray-400 bg-white dark:bg-gray-800 px-2 rounded">Min 100 chars</span>
              </div>

              <input type="hidden" name="year" value={new Date().getFullYear()} />
              <input type="hidden" name="visibility" value="Internal" />

              <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
                <button type="reset" className="px-6 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  Reset
                </button>
                <button
                  type="submit"
                  className="px-8 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm hover:shadow-md transition-all active:scale-95"
                >
                  {isEditing ? "Update Proposal" : "Submit Proposal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      );
    }

    if (activeTab === "tasks") {
      const currentTask = tasks.find(t => t.stage._id === selectedSubmission?.phase);
      const currentSub = currentTask?.sub;

      const isSubmitted = !!currentSub;
      const canEdit = !isSubmitted || currentSub?.status === 'Changes Requested';
      const isGraded = currentSub?.status === 'Graded';

      const submissionType = selectedSubmission?.submissionType || currentTask?.stage.allowedSubmissionTypes?.[0] || 'DOCUMENT';

      const handleSubmitTask = async (e) => {
        e.preventDefault();
        const projectId = project?._id;
        if (!projectId) {
          showToast("Error: Project ID not found.", "error");
          return;
        }

        // 1. Create a FormData Object
        const formData = new FormData();

        // 2. Add text fields
        formData.append('project', projectId);
        formData.append('phase', currentTask.stage._id);
        formData.append('submissionType', submissionType);
        formData.append('description', e.target.description.value);

        // 3. Handle nested links object (Send as stringified JSON)
        const links = {
          repo: e.target['links.repo']?.value,
          notebook: e.target['links.notebook']?.value,
          liveDemo: e.target['links.liveDemo']?.value,
          video: e.target['links.video']?.value,
          doc: e.target['links.doc']?.value,
          design: e.target['links.design']?.value,
          other: e.target['links.other']?.value,
        };
        formData.append('links', JSON.stringify(links));

        // 4. Append physical files
        const fileInput = e.target.querySelector('input[type="file"]');
        if (fileInput && fileInput.files.length > 0) {
          Array.from(fileInput.files).forEach(file => {
            formData.append('attachments', file);
          });
        }

        // --- NEW LOGIC: Frontend Pre-flight Validation ---
        const hasFiles = fileInput && fileInput.files.length > 0;
        const hasLinks = Object.values(links).some(link => link && link.trim() !== '');

        if (submissionType === 'DOCUMENT' && (!hasFiles || !links.doc)) {
          return showToast("Documents require BOTH a file upload and a Doc link.", "error");
        }
        if (submissionType === 'CODE_REPO' && !links.repo) {
          return showToast("Code submissions strictly require a GitHub Repository link.", "error");
        }
        if (submissionType === 'DESIGN_FILE' && (!hasFiles || !links.design)) {
          return showToast("Design submissions require BOTH a file upload and a Design link.", "error");
        }
        if (submissionType === 'AI_NOTEBOOK' && (!links.notebook && !links.repo)) {
          return showToast("AI/ML submissions require a Colab OR GitHub link.", "error");
        }
        if (['VIDEO', 'OTHER'].includes(submissionType) && !hasFiles && !hasLinks) {
          return showToast("Please provide either a file upload or a link.", "error");
        }
        // --- END OF NEW LOGIC ---

        try {
          showToast("Uploading to Cloudinary...", "info");

          // THE FIX 1: Set Content-Type to undefined to allow browser to set the multipart boundary
          const config = {
            headers: {
              'Content-Type': undefined
            }
          };

          let res;

          // THE FIX 2: Actually pass the 'config' object into the api calls!
          if (currentSub && currentSub._id) {
            res = await api.put(`/submissions/${currentSub._id}`, formData, config);
          } else {
            res = await api.post('/submissions', formData, config);
          }

          // Update UI state
          setLocalData(prev => ({
            ...prev,
            submissions: [res.data, ...prev.submissions.filter(s => s.phase !== currentTask.stage._id)]
          }));

          setSelectedSubmission(prev => ({ ...prev, sub: res.data }));
          showToast("Uploaded Successfully!", "success");
        } catch (error) {
          showToast(error.response?.data?.message || "Upload failed", "error");
        }
      };

      return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)] animate-fade-in">

          <div className="w-full lg:w-1/3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <span className="material-symbols-outlined">timeline</span>
                Project Timeline
              </h3>
              <p className="text-xs text-gray-500 mt-1">Click a stage to submit or view details</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {tasks.map((task, index) => {
                const isActive = selectedSubmission?.phase === task.stage._id;
                const statusColor = getStatusColor(task.status);

                return (
                  <div
                    key={task.stage._id}
                    onClick={() => setSelectedSubmission({
                      phase: task.stage._id,
                      submissionType: task.stage.allowedSubmissionTypes[0],
                      sub: task.sub,
                      stageName: task.stage.name
                    })}
                    className={`relative p-4 rounded-xl cursor-pointer transition-all border ${isActive
                      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-500 shadow-md'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:shadow-sm'
                      }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                          }`}>
                          {index + 1}
                        </div>
                        <span className={`text-xs font-bold uppercase tracking-wider ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500'}`}>
                          Stage {index + 1}
                        </span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${statusColor}`}>
                        {task.status}
                      </span>
                    </div>
                    <h4 className={`font-bold text-sm mb-1 ${isActive ? 'text-blue-900 dark:text-blue-100' : 'text-gray-700 dark:text-gray-300'}`}>
                      {task.stage.name}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                      <span>Due: {task.deadline}</span>
                    </div>
                  </div>
                );
              })}
              {tasks.length === 0 && (
                <div className="p-8 text-center">
                  <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">hourglass_empty</span>
                  <p className="text-gray-500 text-sm">No stages assigned yet</p>
                </div>
              )}
            </div>
          </div>

          <div className="w-full lg:w-2/3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
            {selectedSubmission && currentTask ? (
              <>
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-800">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{currentTask.stage.name}</h2>
                      <div className="flex flex-wrap gap-3 items-center text-sm">
                        <span className="flex items-center gap-1 text-gray-600">
                          <span className="material-symbols-outlined text-sm">category</span>
                          Formats: <span className="font-mono text-xs bg-white px-2 py-0.5 rounded border">{currentTask.stage.allowedSubmissionTypes?.join(', ')}</span>
                        </span>
                        <span className="flex items-center gap-1 text-gray-600">
                          <span className="material-symbols-outlined text-sm">grade</span>
                          <span className="font-bold text-indigo-600">{currentTask.stage.totalMarks}</span> marks
                        </span>
                        <span className="flex items-center gap-1 text-gray-600">
                          <span className="material-symbols-outlined text-sm">event</span>
                          Due: <span className="font-semibold">{currentTask.deadline}</span>
                        </span>
                      </div>
                    </div>

                    {isSubmitted && (
                      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-xs font-bold text-gray-500 uppercase">Integrity Status</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`w-2 h-2 rounded-full ${currentSub.integrity?.status === 'Completed' ? 'bg-green-500' :
                                currentSub.integrity?.status === 'Processing' ? 'bg-blue-500 animate-pulse' : 'bg-gray-400'
                                }`} />
                              <span className="text-sm font-semibold">{currentSub.integrity?.status || 'Pending Scan'}</span>
                            </div>
                          </div>

                          {currentSub.integrity?.status === 'Completed' && (
                            <div className="text-right">
                              <p className="text-xs font-bold text-gray-500 uppercase">Similarity Score</p>
                              <p className={`text-xl font-black ${currentSub.integrity.plagiarismScore > 30 ? 'text-red-500' : 'text-green-600'}`}>
                                {currentSub.integrity.plagiarismScore}%
                              </p>
                            </div>
                          )}
                        </div>

                        {currentSub.integrity?.status === 'Processing' && (
                          <p className="text-[10px] text-blue-600 mt-2 italic">Copyleaks is currently analyzing your submission...</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">

                  {isGraded && (
                    <div className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 border-2 border-green-200 dark:border-green-800 rounded-2xl p-6 shadow-sm">
                      <div className="flex items-start gap-4">
                        <div className="bg-green-100 text-green-600 p-3 rounded-full">
                          <span className="material-symbols-outlined text-2xl">workspace_premium</span>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-black text-green-900 dark:text-green-100 text-xl mb-3 flex items-center gap-2">
                            <span>Evaluation Complete</span>
                            <span className="material-symbols-outlined text-sm">verified</span>
                          </h4>
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow border border-green-100">
                              <span className="text-xs text-gray-500 uppercase font-bold block mb-1">Your Score</span>
                              <p className="text-4xl font-black text-green-600">{currentSub.evaluation?.totalMarks || 0}</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow border border-gray-200">
                              <span className="text-xs text-gray-500 uppercase font-bold block mb-1">Maximum</span>
                              <p className="text-4xl font-black text-gray-400">{currentTask.stage.totalMarks}</p>
                            </div>
                          </div>
                          {(currentSub.evaluation?.supervisor?.remarks || currentSub.evaluation?.coordinator?.remarks) && (
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-green-100">
                              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Evaluator Feedback</p>
                              <p className="text-sm text-gray-700 dark:text-gray-300 italic leading-relaxed">
                                "{currentSub.evaluation?.supervisor?.remarks || currentSub.evaluation?.coordinator?.remarks}"
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {currentSub?.status === 'Changes Requested' && (
                    <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 border-2 border-amber-300 dark:border-amber-700 rounded-xl p-5 shadow-sm">
                      <div className="flex gap-3">
                        <span className="material-symbols-outlined text-amber-600 text-2xl">warning</span>
                        <div className="flex-1">
                          <p className="font-bold text-amber-900 dark:text-amber-200 text-lg mb-2">Revisions Required</p>
                          <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
                            {currentSub.evaluation?.supervisor?.remarks || currentSub.evaluation?.coordinator?.remarks || "Please review the requirements and resubmit your work."}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleSubmitTask} className="space-y-6">

                    <div className="bg-gray-50 dark:bg-gray-900/50 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-600">category</span>
                        Submission Format
                      </label>
                      <select
                        name="submissionType"
                        value={submissionType}
                        onChange={(e) => setSelectedSubmission(prev => ({ ...prev, submissionType: e.target.value }))}
                        disabled={!canEdit}
                        className="w-full rounded-xl border-2 border-gray-300 dark:border-gray-600 px-4 py-3 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500 font-medium transition-all"
                      >
                        {currentTask.stage.allowedSubmissionTypes?.length > 0 ? (
                          currentTask.stage.allowedSubmissionTypes.map((type) => (
                            <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
                          ))
                        ) : (
                          <option value="DOCUMENT">Document (Default)</option>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-600">description</span>
                        Work Description
                      </label>
                      <textarea
                        name="description"
                        defaultValue={currentSub?.description || ""}
                        disabled={!canEdit}
                        className="w-full rounded-xl border-2 border-gray-300 dark:border-gray-600 px-4 py-3 h-32 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none disabled:bg-gray-100 disabled:text-gray-500 transition-all"
                        placeholder="Describe what you've submitted, key features, challenges overcome, etc..."
                      />
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 p-6 rounded-xl border-2 border-blue-200 dark:border-blue-800">
                      <label className="block text-sm font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-600">link</span>
                        Resource Links
                        <span className="text-xs font-normal text-gray-500">(Optional if uploading files)</span>
                      </label>

                      <div className="space-y-4">

                        {submissionType === 'CODE_REPO' && (
                          <>
                            <div className="relative">
                              <span className="material-symbols-outlined absolute left-4 top-4 text-xl text-blue-600">code</span>
                              <input
                                name="links.repo"
                                type="url"
                                defaultValue={currentSub?.links?.repo || ""}
                                disabled={!canEdit}
                                className="w-full pl-12 pr-4 py-3.5 rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 disabled:bg-gray-100 focus:ring-2 focus:ring-blue-500 font-medium"
                                placeholder="https://github.com/username/repository"

                              />
                              <span className="absolute right-4 top-4 text-xs text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded">GitHub/GitLab</span>
                            </div>
                            <div className="relative">
                              <span className="material-symbols-outlined absolute left-4 top-4 text-xl text-indigo-600">desktop_windows</span>
                              <input
                                name="links.liveDemo"
                                type="url"
                                defaultValue={currentSub?.links?.liveDemo || ""}
                                disabled={!canEdit}
                                className="w-full pl-12 pr-4 py-3.5 rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 disabled:bg-gray-100 focus:ring-2 focus:ring-blue-500 font-medium"
                                placeholder="https://myproject.vercel.app (Optional)"
                              />
                              <span className="absolute right-4 top-4 text-xs text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded">Live Demo</span>
                            </div>
                          </>
                        )}

                        {submissionType === 'AI_NOTEBOOK' && (
                          <>
                            <div className="relative">
                              <span className="material-symbols-outlined absolute left-4 top-4 text-xl text-purple-600">analytics</span>
                              <input
                                name="links.notebook"
                                type="url"
                                defaultValue={currentSub?.links?.notebook || ""}
                                disabled={!canEdit}
                                className="w-full pl-12 pr-4 py-3.5 rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 disabled:bg-gray-100 focus:ring-2 focus:ring-blue-500 font-medium"
                                placeholder="https://colab.research.google.com/..."

                              />
                              <span className="absolute right-4 top-4 text-xs text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded">Colab/Jupyter</span>
                            </div>
                          </>
                        )}

                        {submissionType === 'VIDEO' && (
                          <div className="relative">
                            <span className="material-symbols-outlined absolute left-4 top-4 text-xl text-red-600">play_circle</span>
                            <input
                              name="links.video"
                              type="url"
                              defaultValue={currentSub?.links?.video || ""}
                              disabled={!canEdit}
                              className="w-full pl-12 pr-4 py-3.5 rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 disabled:bg-gray-100 focus:ring-2 focus:ring-blue-500 font-medium"
                              placeholder="https://youtube.com/watch?v=... or Drive link"

                            />
                            <span className="absolute right-4 top-4 text-xs text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded">Video URL</span>
                          </div>
                        )}

                        {submissionType === 'DOCUMENT' && (
                          <div className="relative">
                            <span className="material-symbols-outlined absolute left-4 top-4 text-xl text-green-600">description</span>
                            <input
                              name="links.doc"
                              type="url"
                              defaultValue={currentSub?.links?.doc || ""}
                              disabled={!canEdit}
                              className="w-full pl-12 pr-4 py-3.5 rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 disabled:bg-gray-100 focus:ring-2 focus:ring-blue-500 font-medium"
                              placeholder="https://docs.google.com/..."

                            />
                            <span className="absolute right-4 top-4 text-xs text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded">Doc URL</span>
                          </div>
                        )}

                        {submissionType === 'DESIGN_FILE' && (
                          <div className="relative">
                            <span className="material-symbols-outlined absolute left-4 top-4 text-xl text-pink-600">palette</span>
                            <input
                              name="links.design"
                              type="url"
                              defaultValue={currentSub?.links?.design || ""}
                              disabled={!canEdit}
                              className="w-full pl-12 pr-4 py-3.5 rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 disabled:bg-gray-100 focus:ring-2 focus:ring-blue-500 font-medium"
                              placeholder="https://figma.com/..."

                            />
                            <span className="absolute right-4 top-4 text-xs text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded">Design URL</span>
                          </div>
                        )}

                        {submissionType === 'OTHER' && (
                          <div className="relative">
                            <span className="material-symbols-outlined absolute left-4 top-4 text-xl text-gray-600">link</span>
                            <input
                              name="links.other"
                              type="url"
                              defaultValue={currentSub?.links?.other || ""}
                              disabled={!canEdit}
                              className="w-full pl-12 pr-4 py-3.5 rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 disabled:bg-gray-100 focus:ring-2 focus:ring-blue-500 font-medium"
                              placeholder="External Resource Link"

                            />
                            <span className="absolute right-4 top-4 text-xs text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded">Resource URL</span>
                          </div>
                        )}

                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                          <p className="text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
                            <span className="material-symbols-outlined text-sm mt-0.5">info</span>
                            <span>Ensure all links are publicly accessible. Use cloud storage (Google Drive, Dropbox) with "Anyone with link can view" permission.</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 transition-colors">
                      <label className="block text-sm font-bold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                        <span className="material-symbols-outlined text-gray-600">attachment</span>
                        Attachments {['DOCUMENT', 'DESIGN_FILE'].includes(submissionType) ? <span className="text-red-500 text-xs ml-1">* (Required)</span> : <span className="text-xs text-gray-500 font-normal ml-1">(Optional)</span>}
                      </label>
                      <input
                        type="file"
                        multiple
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        disabled={!canEdit}
                      />
                      {currentSub?.attachments && currentSub.attachments.length > 0 && (
                        <div className="mt-4 space-y-2">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Uploaded Files:</p>
                          {currentSub.attachments.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                              <div className="flex items-center gap-3 overflow-hidden">
                                <span className="material-symbols-outlined text-blue-500">description</span>
                                <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline truncate">
                                  {file.name}
                                </a>
                              </div>
                              <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
                                {(file.size / 1024).toFixed(1)} KB
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-6 border-t-2 border-gray-200 dark:border-gray-700">
                      {isLeader ? (
                        canEdit ? (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <span className="material-symbols-outlined text-green-600">verified_user</span>
                              <span>Submitting as <strong>Group Leader</strong></span>
                            </div>
                            <button
                              type="submit"
                              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-10 py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-300/50 dark:shadow-none transition-all active:scale-95 flex items-center gap-2"
                            >
                              <span className="material-symbols-outlined">send</span>
                              {currentSub ? "Update & Resubmit" : "Submit Work"}
                            </button>
                          </div>
                        ) : (
                          <div className="w-full text-center py-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl">
                            <div className="flex items-center justify-center gap-3 text-green-700 dark:text-green-300">
                              <span className="material-symbols-outlined text-2xl">lock</span>
                              <div>
                                <p className="font-bold">Submission Locked</p>
                                <p className="text-sm">Waiting for supervisor evaluation</p>
                              </div>
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="w-full bg-gray-100 dark:bg-gray-700 p-5 rounded-xl text-center border-2 border-gray-300 dark:border-gray-600">
                          <div className="flex items-center justify-center gap-3 text-gray-600 dark:text-gray-400">
                            <span className="material-symbols-outlined text-2xl">lock_person</span>
                            <div>
                              <p className="font-bold">Leader-Only Access</p>
                              <p className="text-sm">Only the group leader can submit work</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
                <span className="material-symbols-outlined text-6xl mb-4 text-gray-300">task</span>
                <p className="text-xl font-medium text-gray-600 dark:text-gray-400">Select a Stage to Begin</p>
                <p className="text-sm text-gray-500 mt-2">Choose a task from the timeline to submit your work</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (activeTab === "uploads") {
      return (
        <div className="max-w-7xl mx-auto animate-fade-in">
          <div className="flex flex-wrap justify-between gap-4 mb-8">
            <div className="flex min-w-72 flex-col gap-2">
              <p className="text-4xl font-extrabold leading-tight text-gray-900 dark:text-white">Submitted Documents</p>
              <p className="text-base text-gray-500 dark:text-gray-400">
                View your submitted documents and links for each stage.
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow ring-1 ring-gray-100 dark:ring-gray-700 overflow-hidden">
            {submissions.length === 0 ? (
              <div className="p-12 text-center">
                <span className="material-symbols-outlined text-6xl text-gray-300 mb-4">folder_open</span>
                <p className="text-gray-500 text-lg font-medium">No submissions yet</p>
                <p className="text-gray-400 text-sm mt-2">Your submitted work will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Stage</th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Links</th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {submissions.map((sub) => {
                      const phaseId = typeof sub.phase === 'object' ? sub.phase._id : sub.phase;
                      const stage = projectStages.find(s => s._id === phaseId);

                      return (
                        <tr key={sub._id ?? Math.random()} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {stage?.name || 'Unknown Stage'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                              {sub.submissionType}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate">
                            {sub.description || "No description"}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className="flex flex-col gap-3">
                              {/* Render External Links */}
                              {sub.links && Object.values(sub.links).some(v => v) && (
                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] font-bold text-gray-400 uppercase">Links</span>
                                  {Object.entries(sub.links).map(([key, val]) => val && (
                                    <a key={key} href={val} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                                      <span className="material-symbols-outlined text-sm">link</span>
                                      <span className="capitalize">{key}</span>
                                    </a>
                                  ))}
                                </div>
                              )}

                              {/* Render Cloudinary Attachments */}
                              {sub.attachments && sub.attachments.length > 0 && (
                                <div className="flex flex-col gap-1">
                                  <span className="text-[10px] font-bold text-gray-400 uppercase">Files</span>
                                  {sub.attachments.map((file, idx) => (
                                    <a key={idx} href={file.url} target="_blank" rel="noopener noreferrer" className="text-green-600 dark:text-green-400 hover:underline flex items-center gap-1 max-w-[200px]" title={file.name}>
                                      <span className="material-symbols-outlined text-sm shrink-0">download</span>
                                      <span className="truncate">{file.name}</span>
                                    </a>
                                  ))}
                                </div>
                              )}

                              {/* Fallback if nothing was submitted */}
                              {(!sub.links || Object.values(sub.links).every(v => !v)) && (!sub.attachments || sub.attachments.length === 0) && (
                                <span className="text-gray-400 italic text-xs">No uploads</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(sub.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${getStatusColor(sub.status)}`}>
                              {sub.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (activeTab === "meetings") {
      if (loadingMeetings) {
        return (
          <div className="flex justify-center items-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600"></div>
              <p className="text-gray-500">Loading meetings...</p>
            </div>
          </div>
        );
      }

      if (!hasGroup) {
        return (
          <div className="max-w-2xl mx-auto mt-10">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-2xl p-8 text-center">
              <div className="inline-flex p-4 bg-yellow-100 text-yellow-600 rounded-full mb-4">
                <span className="material-symbols-outlined text-4xl">group_off</span>
              </div>
              <h3 className="text-xl font-bold text-yellow-900 dark:text-yellow-200 mb-2">No Group Found</h3>
              <p className="text-yellow-800 dark:text-yellow-300">
                You need to create or join a group to view scheduled meetings.
              </p>
            </div>
          </div>
        );
      }

      const now = new Date();
      const upcomingMeetings = meetings
        .filter(m => new Date(m.scheduledDate) > now)
        .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));

      const pastMeetings = meetings
        .filter(m => new Date(m.scheduledDate) <= now)
        .sort((a, b) => new Date(b.scheduledDate) - new Date(a.scheduledDate));

      return (
        <div className="max-w-6xl mx-auto animate-fade-in space-y-8">

          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-black mb-2 flex items-center gap-3">
                  <span className="material-symbols-outlined text-4xl">event</span>
                  Scheduled Meetings
                </h1>
                <p className="text-blue-100 text-lg">
                  Your group: <span className="font-bold">{group.name}</span>
                </p>
                <p className="text-blue-200 text-sm mt-1">
                  Supervisor: <span className="font-semibold">{getSupervisorName()}</span>
                </p>
              </div>
              <div className="text-right">
                <div className="text-5xl font-black">{upcomingMeetings.length}</div>
                <div className="text-sm text-blue-100">Upcoming</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Total Meetings</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{meetings.length}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
                  <span className="material-symbols-outlined text-blue-600">event</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Upcoming</p>
                  <p className="text-3xl font-bold text-green-600">{upcomingMeetings.length}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
                  <span className="material-symbols-outlined text-green-600">upcoming</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Past Meetings</p>
                  <p className="text-3xl font-bold text-gray-600">{pastMeetings.length}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
                  <span className="material-symbols-outlined text-gray-600">history</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-green-600">upcoming</span>
              Upcoming Meetings
            </h2>

            {upcomingMeetings.length === 0 ? (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-12 text-center border-2 border-dashed border-gray-300 dark:border-gray-700">
                <span className="material-symbols-outlined text-6xl text-gray-300 mb-4 block">event_available</span>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Upcoming Meetings</h3>
                <p className="text-gray-500">Your supervisor hasn't scheduled any meetings yet.</p>
              </div>
            ) : (
              <div className="grid gap-6">
                {upcomingMeetings.map(meeting => {
                  const meetingDate = new Date(meeting.scheduledDate);
                  const daysUntil = Math.ceil((meetingDate - now) / (1000 * 60 * 60 * 24));

                  return (
                    <div
                      key={meeting._id}
                      className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-green-200 dark:border-green-800 p-6 shadow-md hover:shadow-xl transition-all"
                    >
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-start gap-4">
                            <div className="bg-green-100 text-green-600 p-3 rounded-full">
                              <span className="material-symbols-outlined text-2xl">event</span>
                            </div>
                            <div className="flex-1">
                              <h3 className={`text-2xl font-bold dark:text-white mb-2 ${meeting.status === 'Cancelled' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                {meeting.title}
                              </h3>

                              <div className="flex flex-wrap gap-4 mb-4 text-sm text-gray-600 dark:text-gray-400">
                                <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg">
                                  <span className="material-symbols-outlined text-base">calendar_today</span>
                                  <span className="font-semibold">
                                    {meetingDate.toLocaleDateString('en-US', {
                                      weekday: 'long',
                                      month: 'long',
                                      day: 'numeric',
                                      year: 'numeric'
                                    })}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1.5 rounded-lg">
                                  <span className="material-symbols-outlined text-base">schedule</span>
                                  <span className="font-semibold">
                                    {meetingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>

                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${meeting.mode === 'Online' ? 'bg-blue-50 text-blue-700' : meeting.mode === 'Hybrid' ? 'bg-purple-50 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
                                  <span className="material-symbols-outlined text-base">
                                    {meeting.mode === 'Online' ? 'videocam' : meeting.mode === 'Hybrid' ? 'cast_connected' : 'meeting_room'}
                                  </span>
                                  <span className="font-semibold">{meeting.mode || 'In-Person'}</span>
                                </div>

                                {meeting.location && (
                                  <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-900/20 px-3 py-1.5 rounded-lg">
                                    {meeting.location.startsWith('http') ? (
                                      <a href={meeting.location} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline font-bold">
                                        <span className="material-symbols-outlined text-base">link</span>
                                        Join Meeting
                                      </a>
                                    ) : (
                                      <span className="flex items-center gap-1">
                                        <span className="material-symbols-outlined text-base">location_on</span>
                                        <span className="font-semibold">{meeting.location}</span>
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {meeting.agenda && (
                                <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                                  <p className="text-xs font-bold text-blue-900 dark:text-blue-200 uppercase mb-2 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">list</span>
                                    Agenda
                                  </p>
                                  <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
                                    {meeting.agenda}
                                  </p>
                                </div>
                              )}

                              {meeting.description && (
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-700">
                                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                    {meeting.description}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-center justify-center bg-gradient-to-br from-green-400 to-emerald-500 text-white p-4 rounded-2xl min-w-[120px] shadow-lg">
                          <div className="text-4xl font-black">{daysUntil}</div>
                          <div className="text-xs font-bold uppercase tracking-wider">
                            {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : 'Days Left'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-gray-500">history</span>
              Past Meetings
            </h2>

            {pastMeetings.length === 0 ? (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-12 text-center border-2 border-dashed border-gray-300 dark:border-gray-700">
                <span className="material-symbols-outlined text-6xl text-gray-300 mb-4 block">event_busy</span>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Past Meetings</h3>
                <p className="text-gray-500">Meeting history will appear here.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {pastMeetings.map(meeting => {
                  const meetingDate = new Date(meeting.scheduledDate);

                  let statusBadge = '';
                  if (meeting.status === 'Completed') statusBadge = 'bg-green-100 text-green-800 border-green-200';
                  else if (meeting.status === 'No-Show') statusBadge = 'bg-red-100 text-red-800 border-red-200';
                  else if (meeting.status === 'Cancelled' || meeting.status === 'Rescheduled') statusBadge = 'bg-gray-200 text-gray-700 border-gray-300';
                  else statusBadge = 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse';

                  return (
                    <div
                      key={meeting._id}
                      className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-5 opacity-75 hover:opacity-100 transition-opacity"
                    >
                      <div className="flex items-start gap-4">
                        <div className="bg-gray-200 dark:bg-gray-700 text-gray-500 p-2 rounded-full">
                          <span className="material-symbols-outlined">event</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className={`text-lg font-bold dark:text-white ${(meeting.status === 'Cancelled' || meeting.status === 'No-Show') ? 'text-gray-500 line-through decoration-gray-400' : 'text-gray-900'}`}>
                              {meeting.title}
                            </h3>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusBadge}`}>
                              {meeting.status}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1 bg-white border px-2 py-1 rounded"><span className="material-symbols-outlined text-[14px]">calendar_today</span>{meetingDate.toLocaleDateString()}</span>
                            <span className="flex items-center gap-1 bg-white border px-2 py-1 rounded"><span className="material-symbols-outlined text-[14px]">schedule</span>{meetingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>

                            <span className="flex items-center gap-1 bg-white border px-2 py-1 rounded">
                              <span className="material-symbols-outlined text-[14px]">{meeting.mode === 'Online' ? 'videocam' : 'groups'}</span>
                              {meeting.mode || 'In-Person'}
                            </span>

                            {meeting.location && (
                              <span className="flex items-center gap-1 bg-white border px-2 py-1 rounded">
                                {meeting.location.startsWith('http') ? (
                                  <a href={meeting.location} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline font-bold text-xs">
                                    <span className="material-symbols-outlined text-sm">link</span> Meeting Link
                                  </a>
                                ) : (
                                  <span className="flex items-center gap-1 text-xs">
                                    <span className="material-symbols-outlined text-sm">location_on</span>
                                    <span className="font-semibold">{meeting.location}</span>
                                  </span>
                                )}
                              </span>
                            )}
                          </div>

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

                          {meeting.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 p-3 bg-white rounded border">{meeting.description}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6 border-2 border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-4">
              <div className="bg-blue-100 text-blue-600 p-3 rounded-full">
                <span className="material-symbols-outlined text-2xl">info</span>
              </div>
              <div>
                <h3 className="font-bold text-blue-900 dark:text-blue-200 text-lg mb-2">About Meetings</h3>
                <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-base mt-0.5">check_circle</span>
                    <span>Your supervisor schedules meetings to discuss project progress</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-base mt-0.5">check_circle</span>
                    <span>All group members can see scheduled meetings</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-base mt-0.5">check_circle</span>
                    <span>Make sure to attend on time and come prepared</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-base mt-0.5">check_circle</span>
                    <span>Contact your supervisor if you can't attend</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      );
    }
    if (activeTab === "notifications") {
      return (
        <div className="max-w-4xl mx-auto animate-fade-in">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-semibold">Alerts & Notifications</h2>
              <p className="text-sm text-gray-500 mt-1">Stay updated with important announcements and deadlines</p>
            </div>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={() => handleMarkNotificationRead("all")}
                className="text-sm text-blue-600 font-semibold hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">done_all</span>
                Mark all as read
              </button>
            )}
          </div>{notifications.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center border-2 border-dashed border-gray-200 dark:border-gray-700">
              <span className="material-symbols-outlined text-6xl text-gray-300 mb-4">notifications_off</span>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No notifications yet</h3>
              <p className="text-gray-500">You're all caught up! New notifications will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map((notif) => (
                <div
                  key={notif._id ?? Math.random()}
                  className={`bg-white dark:bg-gray-800 p-5 rounded-xl ring-1 ring-gray-200 dark:ring-gray-700 flex items-start gap-4 transition-all hover:shadow-md ${!notif.isRead ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${notif.isRead ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-600'}`}>
                    <span className="material-symbols-outlined" aria-hidden>notifications</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{notif.title}</h3>
                      <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                        {notif.createdAt ? new Date(notif.createdAt).toLocaleString() : "—"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{notif.message}</p>
                    {!notif.isRead && (
                      <button
                        onClick={() => handleMarkNotificationRead(notif._id)}
                        className="mt-2 text-xs text-blue-600 font-medium hover:underline"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    if (activeTab === "announcements") {
      const announcementsList = localData.announcements || []; 

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
    if (activeTab === 'mock-viva') {
      return (
        <VivaSimulator 
          project={project} 
          showToast={showToast} 
        />
      );
    }
    return (
      <div className="text-center mt-20 text-gray-500">
        Content for {activeTab} not implemented in this demo.
      </div>
    );
  };

  StudentContent.propTypes = {
    activeTab: PropTypes.string.isRequired,
    mockData: PropTypes.object.isRequired,
    showToast: PropTypes.func.isRequired,
    currentUser: PropTypes.object,
  };

  export default StudentContent;