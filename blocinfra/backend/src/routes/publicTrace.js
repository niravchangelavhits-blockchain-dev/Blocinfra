const express = require('express');
const router = express.Router();
const traceController = require('../controllers/traceController');

// ============================================================================
// PUBLIC TRACE ROUTES - No authentication required
// For QR code scanning and public traceability access
// ============================================================================

// Public trace by txHash or itemId (auto-detect)
// This is the main endpoint for QR code scanning
// Now includes order info and delivery status for shipments
router.get('/public/:searchTerm', traceController.traceByHashOrId);

// Public item lookup
router.get('/public/item/:itemId', traceController.getItemFromBlockchain);

// ============================================================================
// DELIVERY VERIFICATION - No authentication required
// Certificate-based delivery confirmation
// ============================================================================

// Verify delivery using certificate (for shipments)
// POST body: { certificate: "-----BEGIN CERTIFICATE-----..." }
router.post('/verify-delivery/:shipmentId', traceController.verifyDelivery);

module.exports = router;
