// src/components/VivaHistoryPanel.jsx
import React, { useState, useEffect } from 'react';
import api from '../utils/api';

const VivaHistoryPanel = ({ projectId }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      // FIX: Stop loading immediately if there is no project
      if (!projectId) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        const res = await api.get(`/viva/project/${projectId}`);
        // Sort newest first
        const sorted = res.data.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
        setSessions(sorted);
      } catch (err) {
        setError("Failed to load Mock Viva history.");
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [projectId]);

  if (loading) {
    return <div className="text-center p-6 text-gray-500 animate-pulse">Loading AI Evaluation History...</div>;
  }

  // If there is no project ID, tell the user politely
  if (!projectId) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-8 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 mt-6">
        <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">error_outline</span>
        <h4 className="font-bold text-gray-700 dark:text-gray-300">No Project Assigned</h4>
        <p className="text-sm text-gray-500">This group needs an approved project before they can take Mock Vivas.</p>
      </div>
    );
  }

  if (error) {
    return <div className="text-center p-6 text-red-500 bg-red-50 rounded-xl">{error}</div>;
  }

  if (sessions.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-8 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 mt-6">
        <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">record_voice_over</span>
        <h4 className="font-bold text-gray-700 dark:text-gray-300">No Mock Vivas Taken</h4>
        <p className="text-sm text-gray-500">Students in this group have not completed any AI Mock Vivas yet.</p>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
        <span className="material-symbols-outlined text-indigo-600">psychology</span>
        AI Mock Viva History ({sessions.length})
      </h3>
      
      <div className="space-y-4">
        {sessions.map((session) => (
          <div key={session._id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-gray-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white text-lg">
                  {session.student?.name || 'Unknown Student'}
                </h4>
                <p className="text-xs text-gray-500 font-medium">
                  {new Date(session.completedAt).toLocaleString()} • ID: {session.student?.universityId || 'N/A'}
                </p>
              </div>
              <div className={`px-4 py-2 rounded-xl border-2 text-center min-w-[80px] ${
                session.evaluation?.score >= 80 ? 'bg-green-50 border-green-200 text-green-700' :
                session.evaluation?.score >= 60 ? 'bg-blue-50 border-blue-200 text-blue-700' :
                session.evaluation?.score >= 40 ? 'bg-amber-50 border-amber-200 text-amber-700' :
                'bg-red-50 border-red-200 text-red-700'
              }`}>
                <span className="block text-xs uppercase font-black opacity-70">Score</span>
                <span className="text-xl font-black">{session.evaluation?.score || 0}</span>
              </div>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h5 className="text-xs font-bold text-green-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">thumb_up</span> Verified Strengths
                </h5>
                <ul className="space-y-1">
                  {session.evaluation?.strengths?.map((s, i) => (
                    <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">•</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h5 className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">warning</span> Knowledge Gaps
                </h5>
                <ul className="space-y-1">
                  {session.evaluation?.weaknesses?.map((w, i) => (
                    <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">•</span> {w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                <span className="font-bold mr-1">AI Note to Supervisor:</span> 
                "{session.evaluation?.advice}"
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VivaHistoryPanel;