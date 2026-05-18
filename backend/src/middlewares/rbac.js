const AppError = require('../utils/AppError');

const restrictTo = (...roles) => (req, res, next) => {
    if (!req.user || !req.user.role) {
        return next(new AppError('User not authenticated or role missing', 401));
    }

    if (!roles.includes(req.user.role)) {
        return next(new AppError(`Forbidden. Your role: ${req.user.role}. Required: ${roles.join(' or ')}`, 403));
    }

    next();
};

const ownershipCheck = (Model, field = '_id') => async (req, res, next) => {
    try {
        const doc = await Model.findById(req.params.id);

        if (!doc) {
            return next(new AppError('Resource not found', 404));
        }

        const docOwnerId = doc[field]?.toString();
        const reqUserId  = req.user._id?.toString();

        if (docOwnerId !== reqUserId) {
            return next(new AppError('Not authorized to access this resource', 403));
        }

        req.doc = doc;
        next();
    } catch (err) {
        next(new AppError('Ownership check failed', 500));
    }
};

module.exports = { restrictTo, ownershipCheck };