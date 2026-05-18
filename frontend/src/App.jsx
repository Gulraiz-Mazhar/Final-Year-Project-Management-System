// src/App.jsx
import { useState, useEffect } from 'react';
import AuthPage from './components/AuthPage';
import DashboardShell from './components/DashboardShell';
import api from './utils/api';
import React from "react";

function App() {
  const [view, setView] = useState("auth");
  const [authMode, setAuthMode] = useState("login");
  const [selectedRole, setSelectedRole] = useState("Student");
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const triggerGlobalRefetch = () => setRefreshTrigger(prev => prev + 1);

  const [data, setData] = useState({
    academicSessions: [],
    groups: [],
    projects: [],
    myProject: null,
    projectStages: [],
    submissions: [],
    submissionSummaries: [],
    users: [],
    announcements: []
  });

  // ===== INITIAL LOAD =====
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    
    // INTEGRATION FIX: We only check for the user object. 
    // If the httpOnly cookie is missing/expired, the API will naturally fail with 401.
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setCurrentUser(parsed);
        setView('dashboard');
        setSelectedRole(parsed.role);
      } catch (e) {
        console.error('Failed to parse saved user', e);
        localStorage.clear();
      }
    }
  }, []);

  const showToast = (message, type = "success") => {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    const color = type === "success" ? "bg-green-500" : type === "error" ? "bg-red-500" : "bg-blue-500";
    toast.className = `${color} text-white px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 translate-x-full flex items-center gap-2`;
    toast.innerHTML = `<span class="material-symbols-outlined">${type === "success" ? "check_circle" : type === "error" ? "error" : "info"}</span><span>${message}</span>`;

    container.appendChild(toast);
    requestAnimationFrame(() => { toast.classList.remove("translate-x-full"); });
    setTimeout(() => {
      toast.classList.add("translate-x-full", "opacity-0");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const formObject = Object.fromEntries(formData);

    if (authMode === "signup") {
      if (formObject.password !== formObject.confirmPassword) {
        showToast("Passwords do not match!", "error");
        return;
      }
      delete formObject.confirmPassword;
    }

    formObject.role = selectedRole;

    const btn = e.target.querySelector("button[type='submit']");
    const originalText = btn.innerText;
    btn.innerText = "Processing...";
    btn.disabled = true;

    try {
      if (authMode === "signup") {
        await api.post('/users/register', formObject);
        showToast("Account created! Please log in.");
        setAuthMode("login");
      } else {
        const res = await api.post('/users/login', {
          email: formObject.email,
          password: formObject.password,
          role: selectedRole
        });

        // 🔒 SECURITY FIX: Token is now in an httpOnly cookie. We ONLY save user data.
        localStorage.setItem('user', JSON.stringify(res.data.user));

        setCurrentUser(res.data.user);
        setView('dashboard');
        showToast(`Welcome back, ${res.data.user.name || res.data.user.email}!`);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Authentication failed";
      showToast(errorMsg, "error");
    } finally {
      btn.innerText = originalText;
      btn.disabled = false;
    }
  };

  const toggleAuthMode = () => setAuthMode(authMode === "login" ? "signup" : "login");

  const logout = () => {
    localStorage.removeItem('user');
    // 🔒 SECURITY FIX: Removed localStorage.removeItem('token') as it no longer exists here.
    setCurrentUser(null);
    setView("auth");
    setAuthMode("login");
    setActiveTab("dashboard");
    showToast("Logged out successfully", "info");
  };

  const navigateDashboard = (tabId) => setActiveTab(tabId);

  // ===== GLOBAL FETCHER =====
  useEffect(() => {
    let isMounted = true; 
    if (view !== 'auth' && currentUser) {
      const fetchData = async () => {
        setLoading(true);
        try {
          const newData = { ...data };

          const stagesRes = await api.get('/project-stages');
          newData.projectStages = Array.isArray(stagesRes.data) ? stagesRes.data : [];

          const sessionsRes = await api.get('/sessions');
          newData.academicSessions = Array.isArray(sessionsRes.data) ? sessionsRes.data : [];

          if (currentUser.role === 'Student') {
            try {
              const groupsRes = await api.get('/groups');
              newData.groups = Array.isArray(groupsRes.data) ? groupsRes.data : (groupsRes.data ? [groupsRes.data] : []);

              const projectRes = await api.get('/projects/my-project');
              if (projectRes.data) {
                newData.myProject = projectRes.data;
                newData.projects = [projectRes.data];
              }

              const subRes = await api.get('/submissions');
              newData.submissions = Array.isArray(subRes.data) ? subRes.data : [];
            } catch (e) {
              console.error("Student data fetch error:", e);
            }
          }

          if (currentUser.role === 'Coordinator') {
            try {
              const [pRes, gRes, sRes, uRes, annRes] = await Promise.all([
                api.get('/projects'),
                api.get('/groups'),
                api.get('/submissions'),
                api.get('/users'),
                api.get('/announcements')
              ]);

              newData.projects = Array.isArray(pRes.data) ? pRes.data : [];
              newData.groups = Array.isArray(gRes.data) ? gRes.data : [];
              newData.submissions = Array.isArray(sRes.data) ? sRes.data : [];
              newData.users = Array.isArray(uRes.data) ? uRes.data : [];
              newData.announcements = Array.isArray(annRes.data) ? annRes.data : [];
            } catch (e) {
              console.error("Coordinator data fetch error:", e);
            }
          }

          if (currentUser.role === 'Supervisor') {
            try {
              const [gRes, pRes, sRes] = await Promise.all([
                api.get('/groups'),
                api.get('/projects'),
                api.get('/submissions')
              ]);

              newData.groups = Array.isArray(gRes.data) ? gRes.data : [];
              newData.projects = Array.isArray(pRes.data) ? pRes.data : [];
              newData.submissions = Array.isArray(sRes.data) ? sRes.data : [];
            } catch (e) {
              console.error("Supervisor data fetch error:", e);
            }
          }

          if (isMounted) {
            setData(newData);
          }

        } catch (err) {
          console.error("Global fetch error:", err);
          if (isMounted) showToast("Failed to load dashboard data", "error");
        } finally {
          if (isMounted) setLoading(false);
        }
      };

      fetchData();
    }

    return () => {
      isMounted = false;
    };
  }, [view, currentUser?.id,refreshTrigger]);

  return (
    <>
      <div id="toast-container" className="fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none"></div>

      {loading && view !== 'auth' ? (
        <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600"></div>
            <p className="text-gray-500 font-medium">Loading dashboard...</p>
          </div>
        </div>
      ) : (
        <>
          {view === "auth" ? (
            <AuthPage
              authMode={authMode}
              selectedRole={selectedRole}
              setSelectedRole={setSelectedRole}
              toggleAuthMode={toggleAuthMode}
              handleAuthSubmit={handleAuthSubmit}
            />
          ) : (
            <DashboardShell
              role={currentUser?.role || selectedRole}
              activeTab={activeTab}
              currentUser={currentUser}
              navigateDashboard={navigateDashboard}
              logout={logout}
              mockData={data}
              showToast={showToast}
              triggerRefresh={triggerGlobalRefetch}
            />
          )}
        </>
      )}
    </>
  );
}

export default App;