// src/components/VivaSimulator.jsx
import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import VivaHistoryPanel from './VivaHistoryPanel'; // <-- Importing the History Panel

const VivaSimulator = ({ project, showToast }) => {
  const [session, setSession] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  
  // NEW: State for the custom End Viva modal
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  
  // Timer state
  const [timeLeft, setTimeLeft] = useState(60);
  const timerRef = useRef(null);
  const chatEndRef = useRef(null);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, loading]);

  // Anti-Cheat: Detect Tab Switching
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && session && session.status === 'In Progress') {
        showToast("Warning: Switching tabs during the viva is recorded.", "warning");
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [session]);

  // Timer Logic
  useEffect(() => {
    if (session && session.status === 'In Progress' && !loading) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [session, loading]);

  const handleTimeUp = async () => {
    showToast("Time's up! Moving to the next question.", "warning");
    await sendMessage("I hesitated and ran out of time to answer.");
  };

  const startViva = async () => {
    setLoading(true);
    try {
      const res = await api.post('/viva/start', { devMode: true }); 
      setSession({ _id: res.data.sessionId, status: 'In Progress' });
      setTranscript([{ role: 'model', text: res.data.question }]);
      setTimeLeft(60);
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to start Viva.", "error");
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (overrideText = null) => {
    const messageToSend = overrideText || input;
    if (!messageToSend.trim()) return;

    // Optimistic UI update
    setTranscript(prev => [...prev, { role: 'user', text: messageToSend }]);
    setInput('');
    setLoading(true);
    clearInterval(timerRef.current);

    try {
      const res = await api.post(`/viva/${session._id}/chat`, { message: messageToSend });
      setTranscript(prev => [...prev, { role: 'model', text: res.data.question }]);
      setTimeLeft(60); // Reset timer for the new question
    } catch (err) {
      showToast("Network error. The AI couldn't hear you.", "error");
    } finally {
      setLoading(false);
    }
  };

  // NEW: Proper Custom Modal Handler for Ending Viva
  const confirmEndViva = async () => {
    setShowEndConfirm(false);
    setLoading(true);
    clearInterval(timerRef.current);
    try {
      const res = await api.post(`/viva/${session._id}/end`);
      setSession(prev => ({ ...prev, status: 'Completed' }));
      setEvaluation(res.data);
      showToast("Viva completed! Generating report...", "success");
    } catch (err) {
      showToast("Failed to generate evaluation.", "error");
    } finally {
      setLoading(false);
    }
  };

  // --- RENDERING VIEWS ---

  // 1. Welcome Screen & History
  if (!session) {
    return (
      <div className="space-y-8 animate-fade-in pb-10">
        <div className="max-w-3xl mx-auto mt-6 text-center bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-10 border border-gray-200 dark:border-gray-700">
          <div className="inline-flex p-5 bg-indigo-100 text-indigo-600 rounded-full mb-6 shadow-inner">
            <span className="material-symbols-outlined text-5xl">record_voice_over</span>
          </div>
          <h2 className="text-3xl font-black mb-4 text-gray-900 dark:text-white">AI Mock Viva Simulator</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-8 text-lg">
            Practice your final defense with an autonomous AI Panel Examiner. It will read your submitted reports and drill you on your technical decisions.
          </p>
          <div className="bg-amber-50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-200 p-6 rounded-xl border border-amber-200 dark:border-amber-800 text-left mb-8 space-y-3 text-sm">
            <p className="font-bold flex items-center gap-2"><span className="material-symbols-outlined text-sm">warning</span> Rules of Engagement:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>You will have <strong>60 seconds</strong> to answer each question.</li>
              <li>If you switch browser tabs, the AI will be notified and your score will drop.</li>
              <li>Clicking "End Viva" will trigger the automated grading agent.</li>
            </ul>
          </div>
          <button onClick={startViva} disabled={loading} className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white px-10 py-4 rounded-xl font-bold shadow-lg transition-all active:scale-95 disabled:opacity-50 text-lg flex items-center justify-center gap-2 mx-auto">
            {loading ? "Initializing Agent..." : <><span className="material-symbols-outlined">play_arrow</span> Start Mock Viva</>}
          </button>
        </div>

        {/* The Student's History View */}
        <div className="max-w-4xl mx-auto">
          <VivaHistoryPanel projectId={project?._id} />
        </div>
      </div>
    );
  }

  // 2. Evaluation Screen
  if (session.status === 'Completed' && evaluation) {
    return (
      <div className="max-w-3xl mx-auto mt-10 animate-fade-in">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-8 text-white text-center relative">
            <div className="w-24 h-24 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white/30 shadow-inner">
              <span className="text-4xl font-black">{evaluation.score}</span>
            </div>
            <h2 className="text-3xl font-black mb-1">Mock Viva Completed</h2>
            <p className="text-indigo-100 font-medium tracking-wide uppercase text-sm">AI Panel Assessment Report</p>
          </div>
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-green-50 dark:bg-green-900/10 p-6 rounded-xl border border-green-200 dark:border-green-800">
                <h3 className="font-bold text-green-800 dark:text-green-300 mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined">verified</span> Strengths
                </h3>
                <ul className="space-y-3">
                  {evaluation.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-green-700 dark:text-green-400">
                      <span className="material-symbols-outlined text-[18px] mt-0.5 shrink-0">check_circle</span>
                      <span className="leading-relaxed">{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-xl border border-red-200 dark:border-red-800">
                <h3 className="font-bold text-red-800 dark:text-red-300 mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined">flag</span> Areas to Improve
                </h3>
                <ul className="space-y-3">
                  {evaluation.weaknesses.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400">
                      <span className="material-symbols-outlined text-[18px] mt-0.5 shrink-0">error</span>
                      <span className="leading-relaxed">{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-xl border border-blue-200 dark:border-blue-800">
              <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined">lightbulb</span> Study Advice
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-400 font-medium leading-relaxed italic">
                "{evaluation.advice}"
              </p>
            </div>
            <div className="pt-4 text-center">
              <button onClick={() => setSession(null)} className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white px-10 py-3 rounded-xl font-bold transition-colors shadow-sm active:scale-95">
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Active Chat Screen
  return (
    <>
      {/* CUSTOM END VIVA MODAL */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all scale-100">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl">front_hand</span>
              </div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">End Mock Viva?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Are you sure you want to finish the session? The AI will immediately analyze your answers and generate your performance report.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowEndConfirm(false)} 
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmEndViva} 
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg transition-colors"
                >
                  Yes, End Viva
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto h-[calc(100vh-140px)] flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="bg-gray-50 dark:bg-gray-900 p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined">smart_toy</span>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">Panel Examiner</h3>
              <p className="text-xs text-green-500 font-semibold animate-pulse">● Online</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-sm ${timeLeft < 15 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-blue-50 text-blue-600'}`}>
              <span className="material-symbols-outlined text-[18px]">timer</span>
              00:{timeLeft.toString().padStart(2, '0')}
            </div>
            <button onClick={() => setShowEndConfirm(true)} className="bg-white dark:bg-gray-800 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-2 rounded-lg text-sm font-bold border border-red-200 dark:border-red-800 transition-colors shadow-sm">
              End Viva
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50 dark:bg-gray-800">
          {transcript.map((msg, index) => (
            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] p-4 rounded-2xl ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-bl-none shadow-sm'}`}>
                <p className="text-sm leading-relaxed">{msg.text}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-gray-700 p-4 rounded-2xl rounded-bl-none border border-gray-200 shadow-sm flex items-center gap-2">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              placeholder="Type your answer and defend your project..."
              className="flex-1 border-2 border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 transition-all"
              autoFocus
            />
            <button type="submit" disabled={loading || !input.trim()} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white p-3 rounded-xl transition-all shadow-md active:scale-95">
              <span className="material-symbols-outlined">send</span>
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default VivaSimulator;