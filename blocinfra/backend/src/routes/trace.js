const express = require('express');
const router = express.Router();
const traceController = require('../controllers/traceController');
const authMiddleware = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authMiddleware.verifyToken);

// ============================================================================
// BLOCKCHAIN-ONLY TRACE ROUTES (NEW - Recommended)
// All data fetched directly from blockchain, not World State
// ============================================================================

// Get full trace from blockchain by Item ID
// Returns: searchedItem (with history), children (full details), parents (basic info)
router.get('/blockchain/:itemId', traceController.getBlockchainTrace);

// Get trace by Transaction Hash from blockchain
// Returns: transactionInfo (for audit) + traceability tree
router.get('/blockchain/tx/:txHash', traceController.getBlockchainTraceByTxHash);

// Get parent basic info from blockchain
router.get('/blockchain/parent/:itemId', traceController.getParentInfo);

// Get item with full history from blockchain
router.get('/blockchain/item/:itemId', traceController.getItemFromBlockchain);

// ============================================================================
// UNIFIED TRACE ENDPOINT (Auto-detect ItemID vs TxHash)
// Uses blockchain functions internally
// ============================================================================

// Trace by txHash or itemId (auto-detect) - returns full tree with tx details from blockchain
router.get('/trace/:searchTerm', traceController.traceByHashOrId);

// ============================================================================
// LEGACY ROUTES (World State based - kept for backward compatibility)
// ============================================================================

// Scan barcode / Get trace (World State)
router.get('/scan/:itemId', traceController.scanBarcode);

// Get transaction history
router.get('/history/:itemId', traceController.getTransactionHistory);

// Get item details (World State)
router.get('/item/:itemId', traceController.getItem);

// Get full trace with history
router.get('/full/:itemId', traceController.getFullTrace);

// Verify item authenticity
router.get('/verify/:itemId', traceController.verifyItem);

module.exports = router;
