const errorHandler = (err, req, res, next) => {
    console.error(`[ERROR] ${err.message}`);

    if (err.name === 'ValidateError') {
        const errors = Object.values(err.errors).map(e => ({ field: e.path, message: e.message }));
        return res.status(400).json({ success: false, message: "Validation error", errors });
    }

    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return res.status(400).json({ success: false, message: `${field} already exists` });
    }

    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
    });
};

const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { errorHandler, asyncHandler };