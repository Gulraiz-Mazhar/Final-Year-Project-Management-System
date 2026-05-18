/* ===== backend/src/controllers/user.controller.js ===== */
const userService = require('../services/user.service');
const asyncHandler = require('../utils/asyncHandler');

const registerUser = asyncHandler(async (req, res) => {
    const user = await userService.registerUser(req.body);
    res.status(201).json(user);
});

const loginUser = asyncHandler(async (req, res) => {
    const { user, token } = await userService.loginUser(req.body);
    
    res.cookie('jwt', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    });

    res.json({ user });
});

const getProfile = asyncHandler(async (req, res) => {
    const user = await userService.getProfile(req.user.id || req.user._id);
    res.json(user);
});

const selfUpdateUser = asyncHandler(async (req, res) => {
    const user = await userService.selfUpdateUser(req.user.id || req.user._id, req.body);
    res.json(user);
});

const adminUpdateUser = asyncHandler(async (req, res) => {
    const user = await userService.adminUpdateUser(req.params.id, req.body);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
});

const deleteUser = asyncHandler(async (req, res) => {
    await userService.deleteUser(req.params.id);
    res.json({ message: 'User profile soft-deleted successfully' });
});

const getAllUsers = asyncHandler(async (req, res) => {
    const users = await userService.getAllUsers();
    res.json(users);
});

const updateSupervisorLimit = asyncHandler(async (req, res) => {
    const user = await userService.updateSupervisorLimit(req.params.id, req.body.newLimit);
    res.json(user);
});

const getStudents = asyncHandler(async (req, res) => {
    const students = await userService.getStudents();
    res.json(students);
});

module.exports = {
    registerUser,
    loginUser,
    getProfile,
    selfUpdateUser,
    adminUpdateUser,
    deleteUser,
    getAllUsers,
    updateSupervisorLimit,
    getStudents
};