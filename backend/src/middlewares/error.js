const errorHandler = (err, req, res, next) => {
    console.error('[ERROR]', err.stack);

    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({ success: false, message: messages[0] || 'Validation failed' });
    }

    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || 'field';
        return res.status(409).json({ success: false, message: `Duplicate value for ${field}` });
    }

    if (err.name === 'CastError') {
        return res.status(400).json({ success: false, message: `Invalid value for ${err.path}` });
    }

    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Token expired' });
    }

    const statusCode = err.statusCode || err.status || 500;
    const body = {
        success: false,
        message: err.message || 'Internal Server Error'
    };

    if (process.env.NODE_ENV === 'development') {
        body.stack = err.stack;
    }

    res.status(statusCode).json(body);
};

module.exports = errorHandler;