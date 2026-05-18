/* ===== backend/src/services/user.service.js ===== */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');

const registerUser = async (data) => {
    const { name, email, password, role, universityId, batch, department, maxGroupsSupervising } = data;
    const normalizedEmail = email.toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail }).notDeleted();
    if (existingUser) throw new Error('Email already registered');

    const user = new User({
        name,
        email: normalizedEmail,
        password,
        role,
        universityId,
        batch,
        department,
        maxGroupsSupervising
    });
    await user.save();

    return { id: user._id, name: user.name, role: user.role };
};

const loginUser = async (data) => {
    const { email, password, role } = data; 
    const normalizedEmail = email.toLowerCase();

    const user = await User.findOne({ email: normalizedEmail })
        .select('+password')
        .notDeleted();

    if (!user) throw new Error('Invalid credentials');

    if (user.role !== role) {
        throw new Error(`Access Denied. This email is registered as a ${user.role}, but you tried to log in as a ${role}.`);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) throw new Error('Invalid credentials');

    const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
    );

    return {
        user: {
            id: user._id,
            role: user.role,
            email: user.email,
            name: user.name,
            department: user.department,
            universityId: user.universityId
        },
        token
    };
};

const getProfile = async (id) => {
    return User.findById(id).notDeleted().select('-password');
};

const getStudents = async () => {
    return User.find({ role: 'Student' }).notDeleted().select('name email _id');
};

const selfUpdateUser = async (userId, data) => {
    const updateData = {};
    if (data.name)       updateData.name = data.name;
    if (data.department) updateData.department = data.department;
    if (data.password) {
        updateData.password = await bcrypt.hash(data.password, 12);
    }
    return User.findByIdAndUpdate(userId, updateData, { new: true }).select('-password');
};

const adminUpdateUser = async (id, data) => {
    const { name, email, password, batch, department, maxGroupsSupervising } = data;
    const updateData = {};

    if (name)       updateData.name = name;
    if (email)      updateData.email = email.toLowerCase();
    if (batch)      updateData.batch = batch;
    if (department) updateData.department = department;
    if (maxGroupsSupervising !== undefined) {
        updateData.maxGroupsSupervising = maxGroupsSupervising;
    }
    if (password) {
        updateData.password = await bcrypt.hash(password, 12);
    }

    return User.findByIdAndUpdate(id, updateData, { new: true })
        .notDeleted()
        .select('-password');
};

const deleteUser = async (id) => {
    const user = await User.findById(id).notDeleted();
    if (!user) throw new Error('User not found');
    await user.softDelete();
};

const getAllUsers = async () => {
    return User.find().notDeleted().select('-password');
};

const updateSupervisorLimit = async (id, newLimit) => {
    const user = await User.findById(id).notDeleted();
    if (!user || user.role !== 'Supervisor') throw new Error('Invalid supervisor reference');
    user.maxGroupsSupervising = newLimit;
    await user.save();
    return user;
};

module.exports = {
    registerUser,
    loginUser,
    getProfile,
    getStudents,
    selfUpdateUser,
    adminUpdateUser,
    deleteUser,
    getAllUsers,
    updateSupervisorLimit
};