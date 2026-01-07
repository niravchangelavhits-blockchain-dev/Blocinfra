const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'blocinfra-secret-key-2024';

const authMiddleware = {
    // Verify JWT token
    verifyToken(req, res, next) {
        try {
            const authHeader = req.headers.authorization;

            if (!authHeader) {
                return res.status(401).json({
                    success: false,
                    message: 'No authorization header provided'
                });
            }

            const token = authHeader.split(' ')[1]; // Bearer <token>

            if (!token) {
                return res.status(401).json({
                    success: false,
                    message: 'No token provided'
                });
            }

            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
            next();
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    message: 'Token has expired'
                });
            }

            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid token'
                });
            }

            return res.status(500).json({
                success: false,
                message: 'Failed to authenticate token',
                error: error.message
            });
        }
    },

    // Check if user is admin
    requireAdmin(req, res, next) {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        next();
    },

    // Optional auth - sets user if token exists but doesn't require it
    optionalAuth(req, res, next) {
        try {
            const authHeader = req.headers.authorization;

            if (authHeader) {
                const token = authHeader.split(' ')[1];
                if (token) {
                    const decoded = jwt.verify(token, JWT_SECRET);
                    req.user = decoded;
                }
            }

            next();
        } catch (error) {
            // Continue without user if token is invalid
            next();
        }
    }
};

module.exports = authMiddleware;
