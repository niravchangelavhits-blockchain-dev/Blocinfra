const express = require('express');
const router = express.Router();
const chaincodeController = require('../controllers/chaincodeController');
const traceController = require('../controllers/traceController');
const authMiddleware = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authMiddleware.verifyToken);

// Initialize ledger
router.post('/init', chaincodeController.initLedger);

// Data Generator routes
router.post('/generator/start', chaincodeController.startGenerator);
router.post('/generator/stop', chaincodeController.stopGenerator);
router.get('/generator/status', chaincodeController.getGeneratorStatus);
router.post('/generator/reset', chaincodeController.resetGeneratorStats);
router.post('/generator/production', chaincodeController.startProduction);

// Strip routes
router.post('/strip', chaincodeController.createStrip);
router.get('/strips/available', chaincodeController.getAvailableStrips);

// Box routes
router.post('/box', chaincodeController.sealBox);
router.get('/boxes/available', chaincodeController.getAvailableBoxes);

// Carton routes
router.post('/carton', chaincodeController.sealCarton);
router.get('/cartons/available', chaincodeController.getAvailableCartons);

// Shipment routes
router.post('/shipment', chaincodeController.sealShipment);
router.get('/shipments/available', chaincodeController.getAvailableShipments);
router.post('/shipment/distribute', chaincodeController.distributeShipment);

// Statistics
router.get('/statistics', chaincodeController.getStatistics);

// Generic item routes
router.get('/items/:type', chaincodeController.getAllItems);
router.get('/items/:type/paginated', chaincodeController.getItemsPaginated);
router.get('/search', chaincodeController.searchItems);

// QR Code generation (one-time only)
router.post('/qr/generate/:itemId', chaincodeController.markQRGenerated);

// ============================================================================
// ALERTS ROUTES - For manufacturer notifications
// ============================================================================

// Get all alerts
router.get('/alerts', traceController.getAlerts);

// Mark single alert as read
router.put('/alerts/:alertId/read', traceController.markAlertRead);

// Mark all alerts as read
router.put('/alerts/read-all', traceController.markAllAlertsRead);

module.exports = router;
