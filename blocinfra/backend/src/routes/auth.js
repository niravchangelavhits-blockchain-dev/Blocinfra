const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// Public routes
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/verify', authController.verifyToken);

// Protected routes
router.get('/me', authMiddleware.verifyToken, authController.getCurrentUser);
router.get('/users', authMiddleware.verifyToken, authController.getAllUsers);
router.post('/users/refresh', authMiddleware.verifyToken, authController.refreshUsers);

// Get current user's certificate (for client users)
router.get('/my-certificate', authMiddleware.verifyToken, authController.getMyCertificate);

module.exports = router;
