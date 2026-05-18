// src/components/SupervisorManager.jsx
import React, { useState } from 'react';
import api from '../utils/api';

const SupervisorManager = ({ users, showToast }) => {
  const [localSupervisors, setLocalSupervisors] = useState(users.filter((u) => u.role === "Supervisor"));
  const [editingId, setEditingId] = useState(null);
  const [tempLimit, setTempLimit] = useState({});

  const startEditing = (sup) => {
    setEditingId(sup._id);
    setTempLimit(prev => ({ ...prev, [sup._id]: sup.maxGroupsSupervising }));
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const handleInputChange = (id, value) => {
    setTempLimit((prev) => ({ ...prev, [id]: value }));
  };

  const handleSave = async (supervisorId) => {
    const newLimit = tempLimit[supervisorId];
    if (newLimit === undefined || newLimit === "") return;

    try {
      await api.put(`/users/${supervisorId}/limit`, { newLimit });
      
      // Optimistic Update
      setLocalSupervisors(prev => 
        prev.map(sup => sup._id === supervisorId ? { ...sup, maxGroupsSupervising: newLimit } : sup)
      );
      
      showToast("Workload limit updated!", "success");
      setEditingId(null);
    } catch (err) {
      showToast("Failed to update limit.", "error");
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Supervisor Workload</h2>
          <p className="text-sm text-gray-500 mt-1">Manage group supervision limits for faculty.</p>
        </div>
        <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-semibold">
          Total Supervisors: {localSupervisors.length}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full text-left">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Supervisor Name</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Department</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Max Groups</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {localSupervisors.map((sup) => {
              const isEditing = editingId === sup._id;

              return (
                <tr key={sup._id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                        {sup.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{sup.name}</p>
                        <p className="text-xs text-gray-500 font-normal">{sup.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-medium">
                      {sup.department || "General"}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-center">
                    {isEditing ? (
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={tempLimit[sup._id]}
                        onChange={(e) => handleInputChange(sup._id, e.target.value)}
                        className="w-20 p-2 text-center rounded-lg border-2 border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none shadow-sm"
                        autoFocus
                      />
                    ) : (
                      <span className="inline-block w-16 py-1 text-center bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm font-semibold border border-gray-200 dark:border-gray-600">
                        {sup.maxGroupsSupervising}
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={cancelEditing}
                          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Cancel"
                        >
                          <span className="material-symbols-outlined text-lg">close</span>
                        </button>
                        <button
                          onClick={() => handleSave(sup._id)}
                          className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors border border-green-200"
                          title="Save"
                        >
                          <span className="material-symbols-outlined text-lg">check</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditing(sup)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors group"
                        title="Edit Limit"
                      >
                        <span className="material-symbols-outlined text-lg group-hover:scale-110 transition-transform">edit</span>
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {localSupervisors.length === 0 && (
              <tr>
                <td colSpan="4" className="text-center py-12">
                  <div className="flex flex-col items-center justify-center text-gray-400">
                    <span className="material-symbols-outlined text-4xl mb-2">person_off</span>
                    <p>No supervisors found.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SupervisorManager;