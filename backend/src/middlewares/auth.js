const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const AppError = require('../utils/AppError');

const authenticateJWT = async (req, res, next) => {
    let token = req.header('Authorization');

    if (token && token.startsWith('Bearer ')) {
        token = token.slice(7);
    } else if (req.cookies && req.cookies.jwt) {
        token = req.cookies.jwt;
    }

    if (!token) {
        return next(new AppError('Access denied: No token provided', 401));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const currentUser = await User.findById(decoded.id || decoded._id)
            .select('-password')
            .notDeleted();

        if (!currentUser) {
            return next(new AppError('The user belonging to this token no longer exists.', 401));
        }

        req.user = currentUser;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return next(new AppError('Token has expired. Please log in again.', 401));
        }
        return next(new AppError('Invalid token', 403));
    }
};

module.exports = authenticateJWT;