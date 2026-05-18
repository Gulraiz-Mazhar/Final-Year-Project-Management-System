// src/components/DashboardShell.jsx
import React, { useState, useRef, useEffect } from "react";
import StudentContent from './StudentContent';
import CoordinatorContent from './CoordinatorContent';
import SupervisorContent from './SupervisorContent';
import SupervisorManager from './SupervisorManager';
import ProjectArchives from './ProjectArchives';

const getMenuItemsForRole = (role) => {
  let items = [];

  if (role === 'Student') {
    items = [
      { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
      { id: 'submit-idea', label: 'Submit Idea', icon: 'lightbulb' },
      { id: 'groups', label: 'My Group', icon: 'groups' },
      { id: 'group-progress', label: 'Progress View', icon: 'bar_chart' },
      { id: 'tasks', label: 'Tasks', icon: 'task_alt' },
      { id: 'meetings', label: 'Meetings', icon: 'event' },
      { id: 'mock-viva', label: 'AI Viva Simulator', icon: 'record_voice_over' },
      { id: 'uploads', label: 'Documents', icon: 'upload_file' },
      { id: 'notifications', label: 'Alerts', icon: 'notifications' },
      { id: 'announcements', label: 'Announcements', icon: 'campaign' },
    ];
  } else if (role === 'Coordinator') {
    items = [
      { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
      { id: 'review-ideas', label: 'Review Ideas', icon: 'rate_review' },
      { id: 'manage-stages', label: 'Project Stages', icon: 'alt_route' },
      { id: 'supervisors', label: 'Manage Supervisors', icon: 'manage_accounts' },
      { id: 'manage-groups', label: 'Manage Groups', icon: 'folder_managed' },
      { id: 'review-submissions', label: 'Review Submissions', icon: 'grade' },
      { id: 'plagiarism', label: 'Plagiarism Check', icon: 'verified' },
      { id: 'announcements', label: 'Announcements', icon: 'campaign' },
      { id: 'settings', label: 'Settings & Session', icon: 'settings' },
    ];
  } else if (role === 'Supervisor') {
    items = [
      { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
      { id: 'my-groups', label: 'My Groups', icon: 'group_work' },
      { id: 'meetings', label: 'Meetings', icon: 'event' },
      { id: 'notifications', label: 'Alerts', icon: 'notifications' },
      { id: 'announcements', label: 'Announcements', icon: 'campaign' },
    ];
  }

  // Add the Project Library to ALL roles if a valid role was passed
  if (items.length > 0) {
    items.push({ id: 'archives', label: 'Project Library', icon: 'library_books' });
  }

  return items;
};

const DashboardShell = ({ role, activeTab, currentUser, navigateDashboard, logout, mockData, showToast ,triggerRefresh}) => {
  const menuItems = getMenuItemsForRole(role);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getEffectiveUser = () => {
    if (currentUser && typeof currentUser === 'object' && currentUser.name) {
      return currentUser;
    }

    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && (parsed.name || parsed.email)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Failed to parse stored user", e);
    }

    if (currentUser) return currentUser;
    return {};
  };

  const effectiveUser = getEffectiveUser();
  
  const getDisplayName = () => {
    if (effectiveUser.name) return effectiveUser.name;
    if (effectiveUser.fullName) return effectiveUser.fullName;
    if (effectiveUser.email) {
      const nameFromEmail = effectiveUser.email.split('@')[0];
      return nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1);
    }
    return `${role} User`;
  };

  const displayName = getDisplayName();
  const displayEmail = effectiveUser.email || "user@fypms.edu";
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=2563eb&color=fff&bold=true`;

  let ContentComponent = null;
  if (role === 'Student') {
    ContentComponent = StudentContent;
  } else if (role === 'Coordinator') {
    ContentComponent = CoordinatorContent;
  } else if (role === 'Supervisor') {
    ContentComponent = SupervisorContent;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden fade-in">
      <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col z-20 hidden md:flex">
        <div className="p-6 flex items-center gap-3 border-b border-gray-100 dark:border-gray-800">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <span className="material-symbols-outlined">hub</span>
          </div>
          <h1 className="font-bold text-xl tracking-tight">FYPMS</h1>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => navigateDashboard(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all bg-transparent focus:outline-none ${
                activeTab === item.id 
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="font-medium text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
          >
            <span className="material-symbols-outlined">logout</span>
            <span className="font-medium text-sm">Logout</span>
          </button>
        </div>
      </aside>

      <div className="md:hidden fixed top-0 w-full bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-30 flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <span className="material-symbols-outlined">hub</span>
          </div>
          <h1 className="font-bold text-lg">FYPMS</h1>
        </div>
        <button onClick={logout} className="text-red-500">
          <span className="material-symbols-outlined">logout</span>
        </button>
      </div>

      <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-gray-50 dark:bg-gray-900 md:pt-0 pt-16">
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-8 shrink-0 hidden md:flex">
          <h2 className="text-xl font-bold capitalize">{activeTab.replace("-", " ")}</h2>
          
          <div className="flex items-center gap-4 relative" ref={dropdownRef}>
            <div className="flex flex-col text-right">
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{displayName}</span>
              <span className="text-xs text-gray-500">{displayEmail}</span>
            </div>
            
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="w-10 h-10 rounded-full cursor-pointer hover:ring-4 hover:ring-blue-50 dark:hover:ring-blue-900/30 transition-all focus:outline-none"
              aria-label="User menu"
            >
              <img src={avatarUrl} className="w-full h-full rounded-full" alt="Profile" />
            </button>

            {showProfileMenu && (
              <div className="absolute top-14 right-0 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 animate-in fade-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 rounded-t-xl">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Signed in as</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{displayName}</p>
                  <p className="text-xs text-gray-500 truncate">{displayEmail}</p>
                </div>
                <div className="p-2">
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-left"
                  >
                    <span className="material-symbols-outlined text-[20px]">logout</span>
                    Confirm Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>
        
        <div id="content-area" className="flex-1 overflow-y-auto p-6 md:p-8">
          {/* 🌟 New Archives Tab Logic here */}
          {activeTab === 'archives' ? (
            <ProjectArchives showToast={showToast} />
          ) : role === 'Coordinator' && activeTab === 'supervisors' ? (
            <SupervisorManager users={mockData?.users || []} showToast={showToast} />
          ) : (
            ContentComponent && (
              <ContentComponent
                activeTab={activeTab}
                mockData={mockData}
                showToast={showToast}
                currentUser={effectiveUser}
                triggerRefresh={triggerRefresh} 
              />
            )
          )}
        </div>
      </main>

      <nav className="md:hidden fixed bottom-0 w-full bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex justify-around p-2 z-30">
        {menuItems.slice(0, 5).map((item) => (
          <button
            key={item.id}
            onClick={() => navigateDashboard(item.id)}
            className={`flex flex-col items-center p-2 rounded-lg ${
              activeTab === item.id 
                ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600" 
                : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            <span className="material-symbols-outlined text-2xl">{item.icon}</span>
            <span className="text-[10px] mt-1">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default DashboardShell;