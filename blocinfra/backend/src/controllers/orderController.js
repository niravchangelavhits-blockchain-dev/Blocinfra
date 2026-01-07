const fabricService = require('../services/fabricService');

const orderController = {
    // Create a new order (shipments only)
    async createOrder(req, res) {
        try {
            const { orderId, shipmentIds, receiverId, receiverOrg } = req.body;

            // Sender info comes from the authenticated user
            const senderId = req.user?.username;
            const senderOrg = req.user?.org;

            if (!senderId || !senderOrg) {
                return res.status(401).json({
                    success: false,
                    message: 'User authentication required'
                });
            }

            if (!orderId || !shipmentIds || !receiverId || !receiverOrg) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: orderId, shipmentIds, receiverId, receiverOrg'
                });
            }

            if (!Array.isArray(shipmentIds) || shipmentIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'shipmentIds must be a non-empty array'
                });
            }

            const result = await fabricService.createOrder(
                orderId,
                shipmentIds,
                senderId,
                senderOrg,
                receiverId,
                receiverOrg
            );

            res.json({
                success: true,
                message: 'Order created successfully',
                data: result
            });
        } catch (error) {
            console.error('Create order error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create order',
                error: error.message
            });
        }
    },

    // Dispatch an order
    async dispatchOrder(req, res) {
        try {
            const { orderId } = req.params;

            if (!orderId) {
                return res.status(400).json({
                    success: false,
                    message: 'Order ID is required'
                });
            }

            const result = await fabricService.dispatchOrder(orderId);
            res.json({
                success: true,
                message: 'Order dispatched successfully',
                data: result
            });
        } catch (error) {
            console.error('Dispatch order error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to dispatch order',
                error: error.message
            });
        }
    },

    // Deliver an order - DISABLED: Delivery must be done via QR scan with certificate verification
    async deliverOrder(req, res) {
        // Delivery is not allowed from dashboard - must use QR scan with certificate
        return res.status(403).json({
            success: false,
            message: 'Delivery confirmation is not allowed from dashboard. The receiver must scan the shipment QR code and verify their identity with a certificate.',
            requiresQRScan: true
        });
    },

    // Get a specific order
    async getOrder(req, res) {
        try {
            const { orderId } = req.params;

            if (!orderId) {
                return res.status(400).json({
                    success: false,
                    message: 'Order ID is required'
                });
            }

            const result = await fabricService.getOrder(orderId);
            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('Get order error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get order',
                error: error.message
            });
        }
    },

    // Get all orders
    async getAllOrders(req, res) {
        try {
            const orders = await fabricService.getAllOrders();
            res.json({
                success: true,
                count: orders.length,
                data: orders
            });
        } catch (error) {
            console.error('Get all orders error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get orders',
                error: error.message
            });
        }
    },

    // Get orders by recipient
    async getOrdersByRecipient(req, res) {
        try {
            const { recipient } = req.params;

            if (!recipient) {
                return res.status(400).json({
                    success: false,
                    message: 'Recipient is required'
                });
            }

            const orders = await fabricService.getOrdersByRecipient(recipient);
            res.json({
                success: true,
                count: orders.length,
                data: orders
            });
        } catch (error) {
            console.error('Get orders by recipient error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get orders',
                error: error.message
            });
        }
    },

    // Get order with full item details
    async getOrderWithDetails(req, res) {
        try {
            const { orderId } = req.params;

            if (!orderId) {
                return res.status(400).json({
                    success: false,
                    message: 'Order ID is required'
                });
            }

            // Get order
            const order = await fabricService.getOrder(orderId);

            // Get details for each item
            const itemDetails = await Promise.all(
                order.itemIds.map(async (itemId) => {
                    try {
                        return await fabricService.scanBarcode(itemId);
                    } catch (e) {
                        return { id: itemId, error: 'Failed to get details' };
                    }
                })
            );

            res.json({
                success: true,
                data: {
                    order,
                    itemDetails
                }
            });
        } catch (error) {
            console.error('Get order with details error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get order details',
                error: error.message
            });
        }
    }
};

module.exports = orderController;
