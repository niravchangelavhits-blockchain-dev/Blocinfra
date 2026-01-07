const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authMiddleware = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authMiddleware.verifyToken);

// Create order
router.post('/', orderController.createOrder);

// Get all orders
router.get('/', orderController.getAllOrders);

// Get orders by recipient
router.get('/recipient/:recipient', orderController.getOrdersByRecipient);

// Get specific order
router.get('/:orderId', orderController.getOrder);

// Get order with full details
router.get('/:orderId/details', orderController.getOrderWithDetails);

// Dispatch order
router.post('/:orderId/dispatch', orderController.dispatchOrder);

// Deliver order
router.post('/:orderId/deliver', orderController.deliverOrder);

module.exports = router;
