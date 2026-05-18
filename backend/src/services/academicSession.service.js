/* ===== backend/src/services/academicSession.service.js ===== */
const AcademicSession = require('../models/academicSession.model');

const createSession = async (data) => {
    const { name, isCurrent, config, timeline, startDate, endDate } = data;
    const session = new AcademicSession({ name, isCurrent, config, timeline, startDate, endDate });
    await session.save();
    return session;
};

const getSessions = async () => {
    return AcademicSession.find().notDeleted().sort({ createdAt: -1 });
};

const getCurrentSession = async () => {
    return AcademicSession.findOne({ isCurrent: true }).notDeleted();
};

const updateSession = async (id, data) => {
    const session = await AcademicSession.findById(id);
    if (!session) throw new Error('Session not found');

    if (data.name !== undefined)      session.name = data.name;
    if (data.startDate !== undefined) session.startDate = data.startDate;
    if (data.endDate !== undefined)   session.endDate = data.endDate;

    if (data.config !== undefined) {
        // Ensure config merge works whether config is a Mongoose subdoc or raw object
        session.config = { ...session.config?.toObject?.() || session.config, ...data.config };
    }

    if (data.isCurrent !== undefined) {
        session.isCurrent = data.isCurrent;
    }

    if (data.timeline !== undefined) {
        session.timeline = data.timeline;
    }

    // Safety checks for dates
    if (!session.startDate) session.startDate = new Date();
    if (!session.endDate) {
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        session.endDate = nextYear;
    }

    await session.save(); 
    return session;
};

const deleteSession = async (id) => {
    const session = await AcademicSession.findById(id);
    if (!session) throw new Error('Session not found');
    
    session.isDeleted = true;
    if (session.isCurrent) session.isCurrent = false;
    await session.save();
    
    return session; // Returning the deleted object can be useful for audit logs
};

module.exports = {
    createSession,
    getSessions,
    getCurrentSession,
    updateSession,
    deleteSession
};