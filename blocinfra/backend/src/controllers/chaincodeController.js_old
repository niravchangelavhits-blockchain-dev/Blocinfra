const fabricService = require('../services/fabricService');
const dataGenerator = require('../services/dataGenerator');
const { DOC_TYPES } = require('../config/constants');
const http = require('http');

// CLEAN VERSION: For use after chaincode is updated to use 'carton' instead of 'karton'
// No mapping needed - carton is used directly in CouchDB

// Error transaction counter
let errorTransactionCount = 0;
// Transaction history
let recentTransactions = [
    {
        type: 'System Init',
        hash: 'INIT-001',
        timestamp: new Date().toISOString(),
        success: true
    }
];

// Helper function to add transaction to history
function addTransaction(type, hash, success = true) {
    const transaction = {
        type,
        hash,
        timestamp: new Date().toISOString(),
        success
    };

    recentTransactions.unshift(transaction);

    // Keep only last 20 transactions
    if (recentTransactions.length > 20) {
        recentTransactions = recentTransactions.slice(0, 20);
    }
}

const chaincodeController = {
    // Initialize ledger
    async initLedger(req, res) {
        try {
            const result = await fabricService.initLedger();
            res.json({
                success: true,
                message: 'Ledger initialized',
                result
            });
        } catch (error) {
            console.error('Init ledger error:', error);
            errorTransactionCount++;
            res.status(500).json({
                success: false,
                message: 'Failed to initialize ledger',
                error: error.message
            });
        }
    },

    // Data Generator Controls
    async startGenerator(req, res) {
        try {
            const result = await dataGenerator.start();
            res.json(result);
        } catch (error) {
            console.error('Start generator error:', error);
            errorTransactionCount++;
            res.status(500).json({
                success: false,
                message: 'Failed to start generator',
                error: error.message
            });
        }
    },

    async stopGenerator(req, res) {
        try {
            const result = dataGenerator.stop();
            res.json(result);
        } catch (error) {
            console.error('Stop generator error:', error);
            errorTransactionCount++;
            res.status(500).json({
                success: false,
                message: 'Failed to stop generator',
                error: error.message
            });
        }
    },

    async getGeneratorStatus(req, res) {
        try {
            const status = dataGenerator.getStatus();
            res.json({
                success: true,
                ...status
            });
        } catch (error) {
            console.error('Get generator status error:', error);
            errorTransactionCount++;
            res.status(500).json({
                success: false,
                message: 'Failed to get generator status',
                error: error.message
            });
        }
    },

    async resetGeneratorStats(req, res) {
        try {
            // Reset error transaction counter as well
            errorTransactionCount = 0;
            const result = dataGenerator.resetStats();
            res.json(result);
        } catch (error) {
            console.error('Reset stats error:', error);
            errorTransactionCount++;
            res.status(500).json({
                success: false,
                message: 'Failed to reset stats',
                error: error.message
            });
        }
    },

    // Start production with specific products and tablet counts
    async startProduction(req, res) {
        try {
            const { productionItems } = req.body;

            if (!productionItems || !Array.isArray(productionItems) || productionItems.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Production items are required'
                });
            }

            // Validate each item
            for (const item of productionItems) {
                if (!item.product || !item.tablets || item.tablets <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Each production item must have a product name and positive tablet count'
                    });
                }
            }

            const result = await dataGenerator.startProduction(productionItems);
            res.json(result);
        } catch (error) {
            console.error('Start production error:', error);
            errorTransactionCount++;
            res.status(500).json({
                success: false,
                message: 'Failed to start production',
                error: error.message
            });
        }
    },

    // Strip Operations
    async createStrip(req, res) {
        try {
            const { id, batchNumber, medicineType, mfgDate, expDate } = req.body;

            if (!id || !batchNumber || !medicineType || !mfgDate || !expDate) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields'
                });
            }

            const result = await fabricService.createStrip(id, batchNumber, medicineType, mfgDate, expDate);

            // Add transaction to history
            addTransaction('Create Strip', result.txId || 'N/A');

            res.json({
                success: true,
                message: 'Strip created',
                data: result
            });
        } catch (error) {
            console.error('Create strip error:', error);
            errorTransactionCount++;
            res.status(500).json({
                success: false,
                message: 'Failed to create strip',
                error: error.message
            });
        }
    },

    async getAvailableStrips(req, res) {
        try {
            const strips = await fabricService.getAvailableStrips();
            res.json({
                success: true,
                count: strips.length,
                data: strips
            });
        } catch (error) {
            console.error('Get available strips error:', error);
            errorTransactionCount++;
            res.status(500).json({
                success: false,
                message: 'Failed to get available strips',
                error: error.message
            });
        }
    },

    // Box Operations
    async sealBox(req, res) {
        try {
            const { boxId, stripIds } = req.body;

            if (!boxId || !stripIds || !Array.isArray(stripIds)) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields'
                });
            }

            const result = await fabricService.sealBox(boxId, stripIds);

            // Add transaction to history
            addTransaction('Seal Box', result.txId || 'N/A');

            res.json({
                success: true,
                message: 'Box sealed',
                data: result
            });
        } catch (error) {
            console.error('Seal box error:', error);
            errorTransactionCount++;
            res.status(500).json({
                success: false,
                message: 'Failed to seal box',
                error: error.message
            });
        }
    },

    async getAvailableBoxes(req, res) {
        try {
            const boxes = await fabricService.getAvailableBoxes();
            res.json({
                success: true,
                count: boxes.length,
                data: boxes
            });
        } catch (error) {
            console.error('Get available boxes error:', error);
            errorTransactionCount++;
            res.status(500).json({
                success: false,
                message: 'Failed to get available boxes',
                error: error.message
            });
        }
    },

    // Carton Operations
    async sealCarton(req, res) {
        try {
            const { cartonId, boxIds } = req.body;

            if (!cartonId || !boxIds || !Array.isArray(boxIds)) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields'
                });
            }

            const result = await fabricService.sealCarton(cartonId, boxIds);

            // Add transaction to history
            addTransaction('Seal Carton', result.txId || 'N/A');

            res.json({
                success: true,
                message: 'Carton sealed',
                data: result
            });
        } catch (error) {
            console.error('Seal carton error:', error);
            errorTransactionCount++;
            res.status(500).json({
                success: false,
                message: 'Failed to seal carton',
                error: error.message
            });
        }
    },

    async getAvailableCartons(req, res) {
        try {
            const cartons = await fabricService.getAvailableCartons();
            res.json({
                success: true,
                count: cartons.length,
                data: cartons
            });
        } catch (error) {
            console.error('Get available cartons error:', error);
            errorTransactionCount++;
            res.status(500).json({
                success: false,
                message: 'Failed to get available cartons',
                error: error.message
            });
        }
    },

    // Shipment Operations
    async sealShipment(req, res) {
        try {
            const { shipmentId, cartonIds } = req.body;

            if (!shipmentId || !cartonIds || !Array.isArray(cartonIds)) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields'
                });
            }

            const result = await fabricService.sealShipment(shipmentId, cartonIds);

            // Add transaction to history
            addTransaction('Seal Shipment', result.txId || 'N/A');

            res.json({
                success: true,
                message: 'Shipment sealed',
                data: result
            });
        } catch (error) {
            console.error('Seal shipment error:', error);
            errorTransactionCount++;
            res.status(500).json({
                success: false,
                message: 'Failed to seal shipment',
                error: error.message
            });
        }
    },

    async getAvailableShipments(req, res) {
        try {
            const shipments = await fabricService.getAvailableShipments();
            res.json({
                success: true,
                count: shipments.length,
                data: shipments
            });
        } catch (error) {
            console.error('Get available shipments error:', error);
            errorTransactionCount++;
            res.status(500).json({
                success: false,
                message: 'Failed to get available shipments',
                error: error.message
            });
        }
    },

    async distributeShipment(req, res) {
        try {
            const { shipmentId, distributor } = req.body;

            if (!shipmentId || !distributor) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields'
                });
            }

            const result = await fabricService.distributeShipment(shipmentId, distributor);

            // Add transaction to history
            addTransaction('Distribute Shipment', result.txId || 'N/A');

            res.json({
                success: true,
                message: 'Shipment distributed',
                data: result
            });
        } catch (error) {
            console.error('Distribute shipment error:', error);
            errorTransactionCount++;
            res.status(500).json({
                success: false,
                message: 'Failed to distribute shipment',
                error: error.message
            });
        }
    },

    // Statistics
    async getStatistics(req, res) {
        try {
            const stats = await fabricService.getStatistics();

            // NO MAPPING NEEDED - chaincode now uses 'cartons' directly

            // Get real blockchain transactions from fabricService
            const fabricTransactions = fabricService.getRecentTransactions(20);

            // Add error count and transaction history to stats
            stats.errorTransactions = errorTransactionCount;

            // Map fabricService transactions to the expected format for frontend
            stats.recentTransactions = fabricTransactions.map(tx => ({
                type: tx.type,
                hash: tx.txId,
                timestamp: tx.timestamp,
                success: tx.status === 'success',
                itemId: tx.itemId,
                parentId: tx.parentId,
                childIds: tx.childIds
            }));

            // Debug logging
            console.log('Stats with real blockchain transactions:', {
                errorTransactions: stats.errorTransactions,
                recentTransactionsCount: stats.recentTransactions.length,
                recentTransactions: stats.recentTransactions.slice(0, 3)
            });

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('Get statistics error:', error);
            errorTransactionCount++;
            res.status(500).json({
                success: false,
                message: 'Failed to get statistics',
                error: error.message
            });
        }
    },

    // Get all items by type
    async getAllItems(req, res) {
        try {
            const { type } = req.params;

            if (!Object.values(DOC_TYPES).includes(type)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid item type'
                });
            }

            const items = await fabricService.getAllItems(type);
            res.json({
                success: true,
                count: items.length,
                data: items
            });
        } catch (error) {
            console.error('Get all items error:', error);
            errorTransactionCount++;
            res.status(500).json({
                success: false,
                message: 'Failed to get items',
                error: error.message
            });
        }
    },

    // Get items with pagination (queries CouchDB directly)
    async getItemsPaginated(req, res) {
        try {
            const { type } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Max 100 per page
            const skip = (page - 1) * limit;

            if (!Object.values(DOC_TYPES).includes(type)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid item type'
                });
            }

            // NO MAPPING NEEDED - query for carton directly
            const couchDbType = type;

            // Query CouchDB directly with pagination
            const couchDbUrl = 'http://admin:adminpw@localhost:5984/mychannel_pharma/_find';

            const query = {
                selector: { docType: couchDbType },
                limit: limit,
                skip: skip
            };

            const response = await new Promise((resolve, reject) => {
                const postData = JSON.stringify(query);
                const options = {
                    hostname: 'localhost',
                    port: 5984,
                    path: '/mychannel_pharma/_find',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(postData),
                        'Authorization': 'Basic ' + Buffer.from('admin:adminpw').toString('base64')
                    },
                    timeout: 10000
                };

                const req = http.request(options, (httpRes) => {
                    let data = '';
                    httpRes.on('data', chunk => data += chunk);
                    httpRes.on('end', () => {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            reject(new Error('Failed to parse CouchDB response'));
                        }
                    });
                });
                req.on('error', reject);
                req.on('timeout', () => {
                    req.destroy();
                    reject(new Error('CouchDB request timeout'));
                });
                req.write(postData);
                req.end();
            });

            // Get total count directly from CouchDB (faster than chaincode)
            let totalCount = 0;
            try {
                const countResponse = await new Promise((resolve, reject) => {
                    const countQuery = JSON.stringify({
                        selector: { docType: couchDbType },
                        fields: ["_id"],
                        limit: 100000
                    });
                    const countOptions = {
                        hostname: 'localhost',
                        port: 5984,
                        path: '/mychannel_pharma/_find',
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(countQuery),
                            'Authorization': 'Basic ' + Buffer.from('admin:adminpw').toString('base64')
                        },
                        timeout: 5000
                    };
                    const countReq = http.request(countOptions, (httpRes) => {
                        let data = '';
                        httpRes.on('data', chunk => data += chunk);
                        httpRes.on('end', () => {
                            try {
                                resolve(JSON.parse(data));
                            } catch (e) {
                                resolve({ docs: [] });
                            }
                        });
                    });
                    countReq.on('error', () => resolve({ docs: [] }));
                    countReq.on('timeout', () => { countReq.destroy(); resolve({ docs: [] }); });
                    countReq.write(countQuery);
                    countReq.end();
                });
                totalCount = countResponse.docs?.length || 0;
            } catch (e) {
                console.error('Failed to get count:', e);
            }

            // Check if CouchDB returned an error
            if (response.error) {
                console.error('[getItemsPaginated] CouchDB error:', response.error, response.reason);
                throw new Error(response.reason || response.error);
            }

            const docs = response.docs || [];
            const totalPages = Math.ceil(totalCount / limit);

            // NO MAPPING NEEDED - data comes directly as carton

            res.json({
                success: true,
                count: docs.length,
                totalCount: totalCount,
                page: page,
                limit: limit,
                totalPages: totalPages,
                hasMore: page < totalPages,
                data: docs
            });
        } catch (error) {
            console.error('Get paginated items error:', error);
            errorTransactionCount++;
            res.status(500).json({
                success: false,
                message: 'Failed to get items',
                error: error.message
            });
        }
    },

    // Search items
    async searchItems(req, res) {
        try {
            const { q } = req.query;

            if (!q) {
                return res.status(400).json({
                    success: false,
                    message: 'Search query is required'
                });
            }

            const results = await fabricService.searchItems(q);
            res.json({
                success: true,
                count: results.length,
                data: results
            });
        } catch (error) {
            console.error('Search items error:', error);
            errorTransactionCount++;
            res.status(500).json({
                success: false,
                message: 'Failed to search items',
                error: error.message
            });
        }
    },

    // Mark QR as generated (one-time only)
    async markQRGenerated(req, res) {
        try {
            const { itemId } = req.params;

            if (!itemId) {
                return res.status(400).json({
                    success: false,
                    message: 'Item ID is required'
                });
            }

            const result = await fabricService.markQRGenerated(itemId);

            // Add transaction to history
            addTransaction('Generate QR', result.txId || 'N/A');

            res.json({
                success: true,
                message: 'QR code marked as generated',
                data: result
            });
        } catch (error) {
            console.error('Mark QR generated error:', error);
            errorTransactionCount++;

            // Check if it's an "already generated" error
            if (error.message && error.message.includes('already been generated')) {
                return res.status(409).json({
                    success: false,
                    message: 'QR code has already been generated for this item',
                    error: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Failed to mark QR as generated',
                error: error.message
            });
        }
    }
};

module.exports = chaincodeController;
