const asyncHandler = (fn) => async (req, res, next) => {
    try {
        return await fn(req, res, next);
    } catch (error) {
        console.error('AsyncHandler Error:', error);
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Internal Server Error",
            ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
        });
    }
}

export default asyncHandler;