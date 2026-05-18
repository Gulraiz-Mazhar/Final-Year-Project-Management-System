// ===== CREATE frontend/src/components/ProjectArchives.jsx =====
import React, { useState, useEffect } from 'react';
import api from '../utils/api';

const ProjectArchives = ({ showToast }) => {
    const [archives, setArchives] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchArchives = async () => {
            try {
                const res = await api.get('/projects/archive');
                setArchives(res.data);
            } catch (error) {
                console.error("Failed to fetch archives", error);
                showToast("Failed to load project archives", "error");
            } finally {
                setLoading(false);
            }
        };
        fetchArchives();
    }, []);

    const filteredArchives = archives.filter(p => 
        p.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sessionName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Institutional Project Library</h2>
                <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400">search</span>
                    <input 
                        type="text" 
                        placeholder="Search by title, category, or year..." 
                        className="pl-10 pr-4 py-2 border rounded-lg w-full md:w-80 dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {filteredArchives.length === 0 ? (
                <div className="text-center py-16 text-gray-500 dark:text-gray-400 border-2 border-dashed rounded-lg dark:border-gray-700">
                    <span className="material-symbols-outlined text-5xl mb-3">inventory_2</span>
                    <p className="text-lg font-medium">No archived projects found.</p>
                    <p className="text-sm">Approved projects from past sessions will appear here.</p>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {filteredArchives.map(proj => (
                        <div key={proj._id} className="p-5 border rounded-lg hover:shadow-lg transition-all dark:border-gray-700 dark:bg-gray-750 flex flex-col justify-between">
                            <div>
                                <div className="text-xs font-bold tracking-wider text-blue-600 dark:text-blue-400 mb-2 uppercase">
                                    {proj.sessionName}
                                </div>
                                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-3">{proj.title}</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-3 mb-4">
                                    {proj.description || "No description provided."}
                                </p>
                            </div>
                            <div className="flex justify-between items-center text-sm pt-4 border-t dark:border-gray-700">
                                <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full font-medium">
                                    {proj.category || 'General'}
                                </span>
                                <span className="text-gray-500 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[16px]">group</span>
                                    {proj.group?.name || 'N/A'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProjectArchives;