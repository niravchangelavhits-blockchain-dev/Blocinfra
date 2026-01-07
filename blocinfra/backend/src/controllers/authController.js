const jwt = require('jsonwebtoken');
const fabricService = require('../services/fabricService');
const caService = require('../services/caService');

const JWT_SECRET = process.env.JWT_SECRET || 'blocinfra-secret-key-2024';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

const fs = require('fs');
const path = require('path');

// Base path for certificates
const CRYPTO_PATH = process.env.CRYPTO_PATH || path.join(__dirname, '../../../../test-network/organizations/peerOrganizations');

// Fallback predefined users (used if CA is unavailable)
const FALLBACK_USERS = {
    // Org1 Users
    'org1admin': {
        password: 'org1adminpw',
        org: 'Org1MSP',
        role: 'admin',
        displayName: 'Org1 Admin',
        certPath: 'org1.example.com/users/Admin@org1.example.com/msp/signcerts/cert.pem'
    },
    'user1org1': {
        password: 'user1pw',
        org: 'Org1MSP',
        role: 'client',
        displayName: 'User1 (Org1)',
        certPath: 'org1.example.com/users/User1@org1.example.com/msp/signcerts/cert.pem'
    },
    // Org2 Users
    'org2admin': {
        password: 'org2adminpw',
        org: 'Org2MSP',
        role: 'admin',
        displayName: 'Org2 Admin',
        certPath: 'org2.example.com/users/Admin@org2.example.com/msp/signcerts/cert.pem'
    },
    'user1org2': {
        password: 'user1pw',
        org: 'Org2MSP',
        role: 'client',
        displayName: 'User1 (Org2)',
        certPath: 'org2.example.com/users/User1@org2.example.com/msp/signcerts/cert.pem'
    }
};

// Alias for backward compatibility
const ADMIN_CREDENTIALS = FALLBACK_USERS;

const authController = {
    // Login handler
    async login(req, res) {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Username and password are required'
                });
            }

            const user = ADMIN_CREDENTIALS[username.toLowerCase()];

            if (!user || user.password !== password) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid credentials'
                });
            }

            // Try to connect to Fabric to validate connection
            try {
                await fabricService.connect();
            } catch (fabricError) {
                console.error('Fabric connection error:', fabricError);
                return res.status(503).json({
                    success: false,
                    message: 'Unable to connect to blockchain network',
                    error: fabricError.message
                });
            }

            // Generate JWT token
            const token = jwt.sign(
                {
                    username: username.toLowerCase(),
                    org: user.org,
                    role: user.role,
                    displayName: user.displayName
                },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRY }
            );

            res.json({
                success: true,
                message: 'Login successful',
                token,
                user: {
                    username: username.toLowerCase(),
                    org: user.org,
                    role: user.role,
                    displayName: user.displayName
                }
            });

        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({
                success: false,
                message: 'Login failed',
                error: error.message
            });
        }
    },

    // Logout handler
    async logout(req, res) {
        try {
            // In a production app, you might want to blacklist the token
            res.json({
                success: true,
                message: 'Logged out successfully'
            });
        } catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({
                success: false,
                message: 'Logout failed',
                error: error.message
            });
        }
    },

    // Verify token handler
    async verifyToken(req, res) {
        try {
            const token = req.headers.authorization?.split(' ')[1];

            if (!token) {
                return res.status(401).json({
                    success: false,
                    message: 'No token provided'
                });
            }

            const decoded = jwt.verify(token, JWT_SECRET);

            res.json({
                success: true,
                valid: true,
                user: {
                    username: decoded.username,
                    org: decoded.org,
                    role: decoded.role,
                    displayName: decoded.displayName
                }
            });

        } catch (error) {
            res.status(401).json({
                success: false,
                valid: false,
                message: 'Invalid or expired token'
            });
        }
    },

    // Get current user info
    async getCurrentUser(req, res) {
        try {
            res.json({
                success: true,
                user: req.user
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to get user info',
                error: error.message
            });
        }
    },

    // Get all users in the network (for order recipient selection)
    // Dynamically fetches from Fabric CA
    async getAllUsers(req, res) {
        try {
            // Fetch users from Fabric CA (both Org1 and Org2)
            const users = await caService.getAllUsers();

            if (users.length === 0) {
                // Fallback to predefined users if CA returns empty
                const fallbackUsers = Object.entries(FALLBACK_USERS).map(([username, userData]) => ({
                    userId: `${username}@${userData.org}`,
                    username: username,
                    org: userData.org,
                    role: userData.role,
                    displayName: userData.displayName
                }));

                return res.json({
                    success: true,
                    count: fallbackUsers.length,
                    data: fallbackUsers,
                    source: 'fallback'
                });
            }

            res.json({
                success: true,
                count: users.length,
                data: users,
                source: 'fabric-ca'
            });
        } catch (error) {
            console.error('Failed to fetch users from CA:', error.message);

            // Fallback to predefined users on error
            const fallbackUsers = Object.entries(FALLBACK_USERS).map(([username, userData]) => ({
                userId: `${username}@${userData.org}`,
                username: username,
                org: userData.org,
                role: userData.role,
                displayName: userData.displayName
            }));

            res.json({
                success: true,
                count: fallbackUsers.length,
                data: fallbackUsers,
                source: 'fallback',
                warning: 'Could not fetch from CA, using fallback users'
            });
        }
    },

    // Clear user cache (force refresh from CA)
    async refreshUsers(req, res) {
        try {
            caService.clearCache();
            const users = await caService.getAllUsers();

            res.json({
                success: true,
                message: 'User cache refreshed',
                count: users.length,
                data: users
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to refresh users',
                error: error.message
            });
        }
    },

    // Get current user's certificate (for client users to copy)
    async getMyCertificate(req, res) {
        try {
            const username = req.user?.username;

            if (!username) {
                return res.status(401).json({
                    success: false,
                    message: 'Not authenticated'
                });
            }

            const user = FALLBACK_USERS[username];

            if (!user || !user.certPath) {
                return res.status(404).json({
                    success: false,
                    message: 'Certificate path not found for user'
                });
            }

            const fullCertPath = path.join(CRYPTO_PATH, user.certPath);

            console.log('[Auth] Getting certificate from:', fullCertPath);

            if (!fs.existsSync(fullCertPath)) {
                return res.status(404).json({
                    success: false,
                    message: 'Certificate file not found',
                    path: fullCertPath
                });
            }

            const certificate = fs.readFileSync(fullCertPath, 'utf8');

            res.json({
                success: true,
                data: {
                    username: username,
                    org: user.org,
                    role: user.role,
                    displayName: user.displayName,
                    certificate: certificate
                }
            });
        } catch (error) {
            console.error('Get certificate error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get certificate',
                error: error.message
            });
        }
    }
};

module.exports = authController;
