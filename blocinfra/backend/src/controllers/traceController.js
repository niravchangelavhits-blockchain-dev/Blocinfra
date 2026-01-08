const fabricService = require('../services/fabricService');
const certificateService = require('../services/certificateService');
const alertService = require('../services/alertService');
const http = require('http');

// CLEAN VERSION: For use after chaincode is updated to use 'carton' instead of 'karton'
// No mapping needed - carton is used directly in CouchDB

// Helper to find order containing a shipment
async function findOrderForShipment(shipmentId) {
    return new Promise((resolve, reject) => {
        const query = JSON.stringify({
            selector: {
                docType: 'order',
                itemIds: { $elemMatch: { $eq: shipmentId } }
            },
            limit: 1
        });
        const options = {
            hostname: process.env.COUCHDB_HOST || 'localhost',
            port: process.env.COUCHDB_PORT || 5984,
            path: `/${process.env.COUCHDB_DB || 'mychannel_pharma'}/_find`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(query),
                'Authorization': 'Basic ' + Buffer.from(`${process.env.COUCHDB_USERNAME || 'admin'}:${process.env.COUCHDB_PASSWORD || 'adminpw'}`).toString('base64')
            },
            timeout: 5000
        };
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.docs && result.docs.length > 0) {
                        resolve(result.docs[0]);
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    resolve(null);
                }
            });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
        req.write(query);
        req.end();
    });
}

// Helper to query CouchDB directly for txHash lookup
async function findItemByTxHash(txHash) {
    return new Promise((resolve, reject) => {
        const query = JSON.stringify({
            selector: { creationTxId: txHash },
            limit: 1,
            use_index: 'indexCreationTxIdDoc'
        });
        const options = {
            hostname: process.env.COUCHDB_HOST || 'localhost',
            port: process.env.COUCHDB_PORT || 5984,
            path: `/${process.env.COUCHDB_DB || 'mychannel_pharma'}/_find`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(query),
                'Authorization': 'Basic ' + Buffer.from(`${process.env.COUCHDB_USERNAME || 'admin'}:${process.env.COUCHDB_PASSWORD || 'adminpw'}`).toString('base64')
            },
            timeout: 5000
        };
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.docs && result.docs.length > 0) {
                        resolve(result.docs[0]);
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    resolve(null);
                }
            });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
        req.write(query);
        req.end();
    });
}

const traceController = {
    // ============================================================================
    // BLOCKCHAIN-ONLY TRACE ENDPOINTS (NEW)
    // All data fetched directly from blockchain, not World State
    // ============================================================================

    // Get full trace from blockchain by Item ID
    // Returns: searchedItem (with history), children (full details), parents (basic info)
    async getBlockchainTrace(req, res) {
        try {
            const { itemId } = req.params;

            if (!itemId) {
                return res.status(400).json({
                    success: false,
                    message: 'Item ID is required'
                });
            }

            const result = await fabricService.getFullTraceFromBlockchain(itemId);
            res.json({
                success: true,
                source: 'blockchain',
                data: result  // No mapping needed
            });
        } catch (error) {
            console.error('Blockchain trace error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get blockchain trace',
                error: error.message
            });
        }
    },

    // Get trace by Transaction Hash from blockchain
    // Returns: transactionInfo (for audit) + traceability tree
    async getBlockchainTraceByTxHash(req, res) {
        try {
            const { txHash } = req.params;

            if (!txHash) {
                return res.status(400).json({
                    success: false,
                    message: 'Transaction hash is required'
                });
            }

            const result = await fabricService.getFullTraceByTxHash(txHash);
            res.json({
                success: true,
                source: 'blockchain',
                data: result  // No mapping needed
            });
        } catch (error) {
            console.error('Blockchain trace by txHash error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get blockchain trace by transaction hash',
                error: error.message
            });
        }
    },

    // Get parent basic info from blockchain
    async getParentInfo(req, res) {
        try {
            const { itemId } = req.params;

            if (!itemId) {
                return res.status(400).json({
                    success: false,
                    message: 'Item ID is required'
                });
            }

            const result = await fabricService.getParentBasicInfo(itemId);
            res.json({
                success: true,
                source: 'blockchain',
                data: result  // No mapping needed
            });
        } catch (error) {
            console.error('Get parent info error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get parent info',
                error: error.message
            });
        }
    },

    // Get item with full history from blockchain
    async getItemFromBlockchain(req, res) {
        try {
            const { itemId } = req.params;

            if (!itemId) {
                return res.status(400).json({
                    success: false,
                    message: 'Item ID is required'
                });
            }

            const result = await fabricService.getItemFromBlockchain(itemId);
            res.json({
                success: true,
                source: 'blockchain',
                data: result  // No mapping needed
            });
        } catch (error) {
            console.error('Get item from blockchain error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get item from blockchain',
                error: error.message
            });
        }
    },

    // ============================================================================
    // LEGACY ENDPOINTS (World State based)
    // ============================================================================

    // Scan barcode / Get complete trace
    async scanBarcode(req, res) {
        try {
            const { itemId } = req.params;

            if (!itemId) {
                return res.status(400).json({
                    success: false,
                    message: 'Item ID is required'
                });
            }

            const result = await fabricService.scanBarcode(itemId);
            res.json({
                success: true,
                data: result  // No mapping needed
            });
        } catch (error) {
            console.error('Scan barcode error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to scan barcode',
                error: error.message
            });
        }
    },

    // Get transaction history
    async getTransactionHistory(req, res) {
        try {
            const { itemId } = req.params;

            if (!itemId) {
                return res.status(400).json({
                    success: false,
                    message: 'Item ID is required'
                });
            }

            const history = await fabricService.getTransactionHistory(itemId);
            res.json({
                success: true,
                count: history.length,
                data: history
            });
        } catch (error) {
            console.error('Get transaction history error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get transaction history',
                error: error.message
            });
        }
    },

    // Get item details
    async getItem(req, res) {
        try {
            const { itemId } = req.params;

            if (!itemId) {
                return res.status(400).json({
                    success: false,
                    message: 'Item ID is required'
                });
            }

            const item = await fabricService.getItem(itemId);
            res.json({
                success: true,
                data: item  // No mapping needed
            });
        } catch (error) {
            console.error('Get item error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get item',
                error: error.message
            });
        }
    },

    // Full trace with history
    async getFullTrace(req, res) {
        try {
            const { itemId } = req.params;

            if (!itemId) {
                return res.status(400).json({
                    success: false,
                    message: 'Item ID is required'
                });
            }

            // Get both trace and history in parallel
            const [trace, history] = await Promise.all([
                fabricService.scanBarcode(itemId),
                fabricService.getTransactionHistory(itemId)
            ]);

            res.json({
                success: true,
                data: {
                    trace,
                    history
                }  // No mapping needed
            });
        } catch (error) {
            console.error('Get full trace error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get full trace',
                error: error.message
            });
        }
    },

    // Trace by transaction hash or item ID (auto-detect)
    // Also includes order info if the item is a shipment that's part of an order
    async traceByHashOrId(req, res) {
        try {
            const { searchTerm } = req.params;

            if (!searchTerm) {
                return res.status(400).json({
                    success: false,
                    message: 'Search term (txHash or itemId) is required'
                });
            }

            // Check if it looks like a txHash (hex chars, at least 32 chars)
            const isTxHash = /^[a-f0-9]{32,}$/i.test(searchTerm) && searchTerm.length >= 32;

            let result;
            let itemId = searchTerm;

            if (isTxHash) {
                // First try CouchDB direct lookup for txHash (much faster)
                const item = await findItemByTxHash(searchTerm);
                if (item) {
                    // Found item by creationTxId, now get full trace using itemId
                    itemId = item.id;
                    result = await fabricService.getTraceByIdOrHash(itemId);
                    result.searchType = 'txHash';
                    result.lookupMethod = 'couchdb-direct';
                } else {
                    result = await fabricService.getTraceByIdOrHash(searchTerm);
                }
            } else {
                // Standard lookup by itemId
                result = await fabricService.getTraceByIdOrHash(searchTerm);
            }

            // Check if the searched item is a shipment - if so, find its order
            // Note: Chaincode returns searchedItem.itemType (not docType at top level)
            // The actual docType is in searchedItem.current.docType
            const searchedItem = result.searchedItem;
            const docType = searchedItem?.itemType || searchedItem?.current?.docType || '';

            console.log('[PublicTrace] searchedItem:', JSON.stringify({
                itemId: searchedItem?.itemId,
                itemType: searchedItem?.itemType,
                currentDocType: searchedItem?.current?.docType,
                detectedDocType: docType
            }));

            let orderInfo = null;
            let deliveryStatus = null;

            if (docType === 'shipment') {
                console.log('[PublicTrace] Detected shipment, looking for order with shipmentId:', itemId);
                const order = await findOrderForShipment(itemId);
                console.log('[PublicTrace] Order found:', order ? { orderId: order.id, status: order.status } : null);
                if (order) {
                    orderInfo = {
                        orderId: order.id,
                        status: order.status,
                        senderId: order.senderId,
                        senderOrg: order.senderOrg,
                        receiverId: order.receiverId,
                        receiverOrg: order.receiverOrg,
                        createdAt: order.createdAt,
                        dispatchedAt: order.dispatchedAt,
                        deliveredAt: order.deliveredAt,
                        deliveredBy: order.deliveredBy
                    };

                    // Determine delivery status for UI
                    if (order.status === 'DELIVERED') {
                        deliveryStatus = {
                            status: 'DELIVERED',
                            message: 'This shipment has been delivered',
                            deliveredAt: order.deliveredAt,
                            deliveredBy: order.deliveredBy,
                            requiresCertificate: false
                        };
                    } else if (order.status === 'DISPATCHED') {
                        deliveryStatus = {
                            status: 'AWAITING_DELIVERY',
                            message: 'This shipment is ready for delivery confirmation',
                            expectedReceiver: order.receiverId,
                            expectedOrg: order.receiverOrg,
                            requiresCertificate: true
                        };
                    } else if (order.status === 'CREATED') {
                        deliveryStatus = {
                            status: 'NOT_DISPATCHED',
                            message: 'This shipment has not been dispatched yet',
                            requiresCertificate: false
                        };
                    }
                }
            }

            res.json({
                success: true,
                data: {
                    ...result,
                    orderInfo,
                    deliveryStatus
                }
            });
        } catch (error) {
            console.error('Trace by hash/id error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to trace',
                error: error.message
            });
        }
    },

    // Verify delivery using certificate
    async verifyDelivery(req, res) {
        try {
            const { shipmentId } = req.params;
            const { certificate } = req.body;

            if (!shipmentId) {
                return res.status(400).json({
                    success: false,
                    message: 'Shipment ID is required'
                });
            }

            if (!certificate) {
                return res.status(400).json({
                    success: false,
                    message: 'Certificate is required for delivery verification'
                });
            }

            // Find the order for this shipment
            const order = await findOrderForShipment(shipmentId);

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'No order found for this shipment'
                });
            }

            // Check order status
            if (order.status === 'DELIVERED') {
                return res.status(400).json({
                    success: false,
                    message: 'This order has already been delivered',
                    deliveredAt: order.deliveredAt,
                    deliveredBy: order.deliveredBy
                });
            }

            if (order.status === 'CREATED') {
                return res.status(400).json({
                    success: false,
                    message: 'This order has not been dispatched yet'
                });
            }

            // Parse and verify the certificate
            console.log('[VerifyDelivery] Certificate received, length:', certificate.length);
            console.log('[VerifyDelivery] Certificate first 100 chars:', certificate.substring(0, 100));
            console.log('[VerifyDelivery] Certificate has BEGIN:', certificate.includes('-----BEGIN CERTIFICATE-----'));
            console.log('[VerifyDelivery] Certificate has END:', certificate.includes('-----END CERTIFICATE-----'));

            const certInfo = certificateService.parseCertificate(certificate);
            console.log('[VerifyDelivery] Parse result:', JSON.stringify(certInfo, null, 2));

            if (!certInfo.success) {
                // Invalid certificate - create alert
                alertService.createInvalidCertificateAlert(order.id, certInfo.error);
                return res.status(400).json({
                    success: false,
                    message: 'Invalid certificate format',
                    error: certInfo.error
                });
            }

            // Verify identity matches expected receiver
            const verification = certificateService.verifyIdentity(
                certificate,
                order.receiverId,
                order.receiverOrg
            );

            if (verification.verified) {
                // SUCCESS - Mark order as delivered
                try {
                    await fabricService.deliverOrder(order.id);

                    // Create success alert for manufacturer
                    alertService.createDeliverySuccessAlert(
                        order.id,
                        verification.certInfo.commonName,
                        order.receiverOrg,
                        order.itemIds,
                        verification.certInfo.certHash
                    );

                    return res.json({
                        success: true,
                        message: 'Delivery confirmed successfully!',
                        data: {
                            orderId: order.id,
                            deliveredBy: verification.certInfo.commonName,
                            deliveredAt: new Date().toISOString(),
                            shipmentIds: order.itemIds,
                            certificateInfo: {
                                commonName: verification.certInfo.commonName,
                                organization: verification.certInfo.organization,
                                certHash: verification.certInfo.certHash
                            }
                        }
                    });
                } catch (deliverError) {
                    console.error('Failed to mark order as delivered:', deliverError);
                    return res.status(500).json({
                        success: false,
                        message: 'Verification successful but failed to update order status',
                        error: deliverError.message
                    });
                }
            } else {
                // UNAUTHORIZED - Certificate doesn't match expected receiver
                alertService.createUnauthorizedAccessAlert(
                    order.id,
                    order.receiverId,
                    order.receiverOrg,
                    verification.certInfo?.commonName || 'Unknown',
                    verification.certInfo?.organization || 'Unknown',
                    verification.certInfo?.certHash || 'N/A'
                );

                return res.status(403).json({
                    success: false,
                    alert: true,
                    message: 'UNAUTHORIZED: You are not the intended recipient of this shipment!',
                    reason: verification.reason,
                    details: {
                        expected: {
                            userId: order.receiverId,
                            org: order.receiverOrg
                        },
                        actual: {
                            userId: verification.certInfo?.commonName || 'Unknown',
                            org: verification.certInfo?.organization || 'Unknown'
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Verify delivery error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to verify delivery',
                error: error.message
            });
        }
    },

    // Get all alerts (for manufacturer dashboard)
    async getAlerts(req, res) {
        try {
            const alerts = alertService.getAllAlerts();
            const counts = alertService.getAlertCounts();

            res.json({
                success: true,
                counts,
                data: alerts
            });
        } catch (error) {
            console.error('Get alerts error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get alerts',
                error: error.message
            });
        }
    },

    // Mark alert as read
    async markAlertRead(req, res) {
        try {
            const { alertId } = req.params;
            const result = alertService.markAsRead(alertId);

            res.json({
                success: result,
                message: result ? 'Alert marked as read' : 'Alert not found'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to mark alert as read',
                error: error.message
            });
        }
    },

    // Mark all alerts as read
    async markAllAlertsRead(req, res) {
        try {
            alertService.markAllAsRead();
            res.json({
                success: true,
                message: 'All alerts marked as read'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to mark alerts as read',
                error: error.message
            });
        }
    },

    // Verify item authenticity
    async verifyItem(req, res) {
        try {
            const { itemId } = req.params;

            if (!itemId) {
                return res.status(400).json({
                    success: false,
                    message: 'Item ID is required'
                });
            }

            const [item, history] = await Promise.all([
                fabricService.getItem(itemId),
                fabricService.getTransactionHistory(itemId)
            ]);

            // Basic verification checks
            const verification = {
                exists: true,
                hasHistory: history.length > 0,
                createdAt: history.length > 0 ? history[history.length - 1].timestamp : null,
                transactionCount: history.length,
                isValid: true,
                itemDetails: item  // No mapping needed
            };

            res.json({
                success: true,
                data: verification
            });
        } catch (error) {
            // If item doesn't exist
            if (error.message.includes('does not exist')) {
                return res.json({
                    success: true,
                    data: {
                        exists: false,
                        isValid: false,
                        message: 'Item not found in blockchain'
                    }
                });
            }

            console.error('Verify item error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to verify item',
                error: error.message
            });
        }
    }
};

module.exports = traceController;
