const fabricConfig = require('../config/fabric-config');
const { TX_TYPES } = require('../config/constants');
const http = require('http');

// CLEAN VERSION: For use after chaincode is updated to use 'carton' instead of 'karton'
// No mapping needed - carton is used directly in CouchDB

// Fast CouchDB query helper
function queryCouchDB(query) {
    return new Promise((resolve, reject) => {
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
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error('Failed to parse CouchDB response'));
                }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('CouchDB timeout')); });
        req.write(postData);
        req.end();
    });
}

class FabricService {
    constructor() {
        this.contract = null;
        this.isConnected = false;
        this.recentTransactions = [];
        this.maxTransactions = 50;
    }

    // Helper to convert Uint8Array to string properly
    resultToString(result) {
        if (!result || result.length === 0) {
            return '';
        }
        // Fabric Gateway returns Uint8Array, use Buffer to convert properly
        return Buffer.from(result).toString('utf8');
    }

    // Helper to parse JSON result safely
    parseResult(result) {
        const str = this.resultToString(result);
        if (!str) {
            return null;
        }
        return JSON.parse(str);
    }

    // Add transaction to recent history
    addToHistory(txId, type, itemId, status = 'success', parentId = null, childIds = null) {
        const tx = {
            txId,
            type,
            itemId,
            status,
            parentId,
            childIds,
            timestamp: new Date().toISOString()
        };
        this.recentTransactions.unshift(tx);
        if (this.recentTransactions.length > this.maxTransactions) {
            this.recentTransactions.pop();
        }
        return tx;
    }

    // Get recent transactions
    getRecentTransactions(limit = 20) {
        return this.recentTransactions.slice(0, limit);
    }

    async connect() {
        if (this.isConnected) {
            return;
        }
        await fabricConfig.connect();
        this.contract = fabricConfig.getContract();
        this.isConnected = true;
        console.log('FabricService connected');
    }

    async disconnect() {
        await fabricConfig.disconnect();
        this.isConnected = false;
        this.contract = null;
    }

    async ensureConnected() {
        if (!this.isConnected) {
            await this.connect();
        }
    }

    // Initialize Ledger
    async initLedger() {
        await this.ensureConnected();
        const result = await this.contract.submitTransaction(TX_TYPES.INIT_LEDGER);
        return this.resultToString(result) || 'Ledger initialized';
    }

    // Strip Operations - with txId tracking
    async createStrip(id, batchNumber, medicineType, mfgDate, expDate) {
        await this.ensureConnected();

        // Use newProposal to get transaction ID
        const proposal = this.contract.newProposal(TX_TYPES.CREATE_STRIP, {
            arguments: [id, batchNumber, medicineType, mfgDate, expDate]
        });
        const txn = await proposal.endorse();
        const txId = txn.getTransactionId();
        const commit = await txn.submit();

        // IMPORTANT: Wait for transaction to be committed to the ledger
        const status = await commit.getStatus();
        if (status.code !== 0) {
            throw new Error(`Transaction ${txId} failed with status: ${status.code}`);
        }

        // Get the result from the commit
        const resultBytes = commit.getResult();
        const data = this.parseResult(resultBytes);

        // Record transaction with parent/child info
        this.addToHistory(txId, 'CREATE_STRIP', id, 'success', null, null);

        return { ...data, txId };
    }

    async getAvailableStrips() {
        await this.ensureConnected();
        const result = await this.contract.evaluateTransaction(TX_TYPES.GET_AVAILABLE_STRIPS);
        return this.parseResult(result) || [];
    }

    // Box Operations - with txId tracking
    async sealBox(boxId, stripIds) {
        await this.ensureConnected();

        const proposal = this.contract.newProposal(TX_TYPES.SEAL_BOX, {
            arguments: [boxId, JSON.stringify(stripIds)]
        });
        const txn = await proposal.endorse();
        const txId = txn.getTransactionId();
        const commit = await txn.submit();

        // Wait for transaction to be committed
        const status = await commit.getStatus();
        if (status.code !== 0) {
            throw new Error(`Transaction ${txId} failed with status: ${status.code}`);
        }

        const resultBytes = commit.getResult();
        const data = this.parseResult(resultBytes);

        // Record transaction: box contains strips (children)
        this.addToHistory(txId, 'SEAL_BOX', boxId, 'success', null, stripIds);

        return { ...data, txId };
    }

    async getAvailableBoxes() {
        await this.ensureConnected();
        const result = await this.contract.evaluateTransaction(TX_TYPES.GET_AVAILABLE_BOXES);
        return this.parseResult(result) || [];
    }

    // Carton Operations - with txId tracking
    // NO MAPPING: Calls SealCarton directly (chaincode updated)
    async sealCarton(cartonId, boxIds) {
        await this.ensureConnected();

        const proposal = this.contract.newProposal(TX_TYPES.SEAL_CARTON, {
            arguments: [cartonId, JSON.stringify(boxIds)]
        });
        const txn = await proposal.endorse();
        const txId = txn.getTransactionId();
        const commit = await txn.submit();

        // Wait for transaction to be committed
        const status = await commit.getStatus();
        if (status.code !== 0) {
            throw new Error(`Transaction ${txId} failed with status: ${status.code}`);
        }

        const resultBytes = commit.getResult();
        const data = this.parseResult(resultBytes);

        // Record transaction: carton contains boxes (children)
        this.addToHistory(txId, 'SEAL_CARTON', cartonId, 'success', null, boxIds);

        return { ...data, txId };
    }

    // NO MAPPING: Calls GetAvailableCartons directly (chaincode updated)
    async getAvailableCartons() {
        await this.ensureConnected();
        const result = await this.contract.evaluateTransaction(TX_TYPES.GET_AVAILABLE_CARTONS);
        return this.parseResult(result) || [];
    }

    // Shipment Operations - with txId tracking
    async sealShipment(shipmentId, cartonIds) {
        await this.ensureConnected();

        const proposal = this.contract.newProposal(TX_TYPES.SEAL_SHIPMENT, {
            arguments: [shipmentId, JSON.stringify(cartonIds)]
        });
        const txn = await proposal.endorse();
        const txId = txn.getTransactionId();
        const commit = await txn.submit();

        // Wait for transaction to be committed
        const status = await commit.getStatus();
        if (status.code !== 0) {
            throw new Error(`Transaction ${txId} failed with status: ${status.code}`);
        }

        const resultBytes = commit.getResult();
        const data = this.parseResult(resultBytes);

        // Record transaction: shipment contains cartons (children)
        this.addToHistory(txId, 'SEAL_SHIPMENT', shipmentId, 'success', null, cartonIds);

        return { ...data, txId };
    }

    async getAvailableShipments() {
        await this.ensureConnected();
        const result = await this.contract.evaluateTransaction(TX_TYPES.GET_AVAILABLE_SHIPMENTS);
        return this.parseResult(result) || [];
    }

    async distributeShipment(shipmentId, distributor) {
        await this.ensureConnected();

        const proposal = this.contract.newProposal(TX_TYPES.DISTRIBUTE_SHIPMENT, {
            arguments: [shipmentId, distributor]
        });
        const txn = await proposal.endorse();
        const txId = txn.getTransactionId();
        const commit = await txn.submit();

        // Wait for transaction to be committed
        const status = await commit.getStatus();
        if (status.code !== 0) {
            throw new Error(`Transaction ${txId} failed with status: ${status.code}`);
        }

        const resultBytes = commit.getResult();
        const data = this.parseResult(resultBytes);

        // Record distribution transaction
        this.addToHistory(txId, 'DISTRIBUTE_SHIPMENT', shipmentId, 'success', null, null);

        return { ...data, txId };
    }

    // Trace Operations (World State - legacy)
    async scanBarcode(itemId) {
        // Use fast CouchDB direct query to build trace
        try {
            const item = await this.getItem(itemId);
            if (!item) {
                throw new Error(`Item ${itemId} not found`);
            }

            // Build parent chain
            let parent = null;
            let grandParent = null;
            let root = null;

            // Get parent (boxId, cartonId, shipmentId, orderId based on item type)
            // NO MAPPING: cartonId is used directly in CouchDB
            const parentId = item.boxId || item.cartonId || item.shipmentId || item.orderId;
            if (parentId) {
                parent = await this.getItem(parentId);
                if (parent) {
                    const gpId = parent.cartonId || parent.shipmentId || parent.orderId;
                    if (gpId) {
                        grandParent = await this.getItem(gpId);
                        if (grandParent) {
                            const rootId = grandParent.shipmentId || grandParent.orderId;
                            if (rootId) {
                                root = await this.getItem(rootId);
                            }
                        }
                    }
                }
            }

            return {
                item,
                itemType: item.docType,
                parent,
                grandParent,
                root,
                children: [] // Children not fetched in fast mode
            };
        } catch (error) {
            console.error('Fast scanBarcode failed, falling back to chaincode:', error.message);
            await this.ensureConnected();
            const result = await this.contract.evaluateTransaction(TX_TYPES.SCAN_BARCODE, itemId);
            return this.parseResult(result);
        }
    }

    async getTransactionHistory(itemId) {
        await this.ensureConnected();
        const result = await this.contract.evaluateTransaction('GetTransactionHistory', itemId);
        return this.parseResult(result) || [];
    }

    // ============================================================================
    // BLOCKCHAIN-ONLY TRACE FUNCTIONS (matches chaincodeV2)
    // All data fetched directly from blockchain, not World State
    // ============================================================================

    // Get full trace from blockchain by Item ID
    // Returns: searchedItem (with history), parents (full details), children (full details)
    async getFullTraceFromBlockchain(itemId) {
        await this.ensureConnected();
        const result = await this.contract.evaluateTransaction(TX_TYPES.GET_FULL_TRACE_FROM_BLOCKCHAIN, itemId);
        return this.parseResult(result);
    }

    // Get trace by Transaction Hash from blockchain (chaincode function)
    // Returns: transactionInfo (for audit) + traceability tree
    async getTraceByTxHashFromBlockchain(txHash) {
        await this.ensureConnected();
        const result = await this.contract.evaluateTransaction(TX_TYPES.GET_TRACE_BY_TX_HASH, txHash);
        return this.parseResult(result);
    }

    // Get item history from blockchain
    async getItemHistoryFromBlockchain(itemId) {
        await this.ensureConnected();
        const result = await this.contract.evaluateTransaction(TX_TYPES.GET_ITEM_HISTORY_FROM_BLOCKCHAIN, itemId);
        return this.parseResult(result);
    }

    // Get item by its unique creation transaction hash
    // This searches by the creationTxId field which is unique to each item
    async getItemByCreationTxHash(txHash) {
        await this.ensureConnected();
        const result = await this.contract.evaluateTransaction(TX_TYPES.GET_ITEM_BY_CREATION_TX_HASH, txHash);
        return this.parseResult(result);
    }

    // Order Operations - with txId tracking
    async createOrder(orderId, shipmentIds, senderId, senderOrg, receiverId, receiverOrg) {
        await this.ensureConnected();

        // Chaincode expects: orderID, itemIDsJSON (shipment IDs), senderId, senderOrg, receiverId, receiverOrg
        const proposal = this.contract.newProposal(TX_TYPES.CREATE_ORDER, {
            arguments: [orderId, JSON.stringify(shipmentIds), senderId, senderOrg, receiverId, receiverOrg]
        });
        const txn = await proposal.endorse();
        const txId = txn.getTransactionId();
        const commit = await txn.submit();

        // Wait for transaction to be committed
        const status = await commit.getStatus();
        if (status.code !== 0) {
            throw new Error(`Transaction ${txId} failed with status: ${status.code}`);
        }

        const resultBytes = commit.getResult();
        const data = this.parseResult(resultBytes);

        // Record order creation: order contains shipments (children)
        this.addToHistory(txId, 'CREATE_ORDER', orderId, 'success', null, shipmentIds);

        return { ...data, txId };
    }

    async dispatchOrder(orderId) {
        await this.ensureConnected();

        const proposal = this.contract.newProposal(TX_TYPES.DISPATCH_ORDER, {
            arguments: [orderId]
        });
        const txn = await proposal.endorse();
        const txId = txn.getTransactionId();
        const commit = await txn.submit();

        // Wait for transaction to be committed
        const status = await commit.getStatus();
        if (status.code !== 0) {
            throw new Error(`Transaction ${txId} failed with status: ${status.code}`);
        }

        const resultBytes = commit.getResult();
        const data = this.parseResult(resultBytes);

        // Record dispatch transaction
        this.addToHistory(txId, 'DISPATCH_ORDER', orderId, 'success', null, null);

        return { ...data, txId };
    }

    async deliverOrder(orderId) {
        await this.ensureConnected();

        const proposal = this.contract.newProposal(TX_TYPES.DELIVER_ORDER, {
            arguments: [orderId]
        });
        const txn = await proposal.endorse();
        const txId = txn.getTransactionId();
        const commit = await txn.submit();

        // Wait for transaction to be committed
        const status = await commit.getStatus();
        if (status.code !== 0) {
            throw new Error(`Transaction ${txId} failed with status: ${status.code}`);
        }

        const resultBytes = commit.getResult();
        const data = this.parseResult(resultBytes);

        // Record delivery transaction
        this.addToHistory(txId, 'DELIVER_ORDER', orderId, 'success', null, null);

        return { ...data, txId };
    }

    async getOrder(orderId) {
        await this.ensureConnected();
        const result = await this.contract.evaluateTransaction(TX_TYPES.GET_ORDER, orderId);
        return this.parseResult(result);
    }

    async getAllOrders() {
        await this.ensureConnected();
        const result = await this.contract.evaluateTransaction(TX_TYPES.GET_ALL_ORDERS);
        return this.parseResult(result) || [];
    }

    async getOrdersByRecipient(recipient) {
        await this.ensureConnected();
        const result = await this.contract.evaluateTransaction(TX_TYPES.GET_ORDERS_BY_RECIPIENT, recipient);
        return this.parseResult(result) || [];
    }

    // Generic Operations
    async getItem(itemId) {
        // Use fast CouchDB direct query
        try {
            const result = await queryCouchDB({
                selector: { id: itemId },
                limit: 1
            });
            if (result.docs && result.docs.length > 0) {
                return result.docs[0];
            }
            // Try by _id if id field not found
            const result2 = await queryCouchDB({
                selector: { _id: itemId },
                limit: 1
            });
            if (result2.docs && result2.docs.length > 0) {
                return result2.docs[0];
            }
            return null;
        } catch (error) {
            console.error('Fast getItem failed, falling back to chaincode:', error.message);
            await this.ensureConnected();
            const result = await this.contract.evaluateTransaction('GetItem', itemId);
            return this.parseResult(result);
        }
    }

    async getAllItems(docType) {
        await this.ensureConnected();
        const result = await this.contract.evaluateTransaction('GetAllItems', docType);
        return this.parseResult(result) || [];
    }

    // NO MAPPING: Query for 'carton' directly (chaincode updated)
    async getStatistics() {
        // Use fast CouchDB direct queries instead of slow chaincode
        try {
            const docTypes = ['strip', 'box', 'carton', 'shipment', 'order'];
            const counts = await Promise.all(docTypes.map(async (type) => {
                const result = await queryCouchDB({
                    selector: { docType: type },
                    fields: ['_id'],
                    limit: 100000
                });
                return { type, count: result.docs ? result.docs.length : 0 };
            }));

            const stats = {
                strips: 0,
                boxes: 0,
                cartons: 0,
                shipments: 0,
                orders: 0
            };
            counts.forEach(({ type, count }) => {
                if (type === 'strip') stats.strips = count;
                else if (type === 'box') stats.boxes = count;
                else if (type === 'carton') stats.cartons = count;
                else if (type === 'shipment') stats.shipments = count;
                else if (type === 'order') stats.orders = count;
            });
            return stats;
        } catch (error) {
            console.error('Fast statistics query failed, falling back to chaincode:', error.message);
            // Fallback to chaincode (slow)
            await this.ensureConnected();
            const result = await this.contract.evaluateTransaction('GetStatistics');
            return this.parseResult(result) || {
                strips: 0,
                boxes: 0,
                cartons: 0,
                shipments: 0,
                orders: 0
            };
        }
    }

    async searchItems(searchTerm) {
        await this.ensureConnected();
        const result = await this.contract.evaluateTransaction('SearchItems', searchTerm);
        return this.parseResult(result) || [];
    }

    // Mark QR as generated (one-time only)
    async markQRGenerated(itemId) {
        await this.ensureConnected();

        const proposal = this.contract.newProposal('MarkQRGenerated', {
            arguments: [itemId]
        });
        const txn = await proposal.endorse();
        const txId = txn.getTransactionId();
        const commit = await txn.submit();

        // Wait for transaction to be committed
        const status = await commit.getStatus();
        if (status.code !== 0) {
            throw new Error(`Transaction ${txId} failed with status: ${status.code}`);
        }

        const resultBytes = commit.getResult();
        const data = this.parseResult(resultBytes);

        // Record QR generation transaction
        this.addToHistory(txId, 'GENERATE_QR', itemId, 'success', null, null);

        return { ...data, txId };
    }

    // Find transaction by txHash in recent history
    findTransactionByHash(txHash) {
        return this.recentTransactions.find(tx => tx.txId === txHash);
    }

    // Get full trace by transaction hash from in-memory history - returns item details, parents, children with their tx info
    async getTraceByTxHashFromHistory(txHash) {
        await this.ensureConnected();

        // First, find the transaction in our history
        const transaction = this.findTransactionByHash(txHash);

        if (!transaction) {
            throw new Error(`Transaction ${txHash} not found in recent history`);
        }

        // Get the item associated with this transaction
        const itemId = transaction.itemId;

        // Get the full trace using ScanBarcode
        const trace = await this.scanBarcode(itemId);

        // Get transaction history for the main item
        const itemHistory = await this.getTransactionHistory(itemId);

        // Build enhanced trace with transaction details
        const enhancedTrace = {
            transaction: {
                txHash: transaction.txId,
                type: transaction.type,
                itemId: transaction.itemId,
                timestamp: transaction.timestamp,
                status: transaction.status,
                childIds: transaction.childIds
            },
            itemType: trace.itemType,
            item: trace.item,
            itemHistory: itemHistory,
            parent: null,
            grandParent: null,
            root: null,
            children: []
        };

        // Get parent with its transaction history
        if (trace.parent) {
            const parentId = trace.parent.id;
            const parentHistory = await this.getTransactionHistory(parentId);
            enhancedTrace.parent = {
                ...trace.parent,
                history: parentHistory,
                txHash: parentHistory.length > 0 ? parentHistory[0].txId : null
            };
        }

        // Get grandParent with its transaction history
        if (trace.grandParent) {
            const grandParentId = trace.grandParent.id;
            const grandParentHistory = await this.getTransactionHistory(grandParentId);
            enhancedTrace.grandParent = {
                ...trace.grandParent,
                history: grandParentHistory,
                txHash: grandParentHistory.length > 0 ? grandParentHistory[0].txId : null
            };
        }

        // Get root with its transaction history
        if (trace.root) {
            const rootId = trace.root.id;
            const rootHistory = await this.getTransactionHistory(rootId);
            enhancedTrace.root = {
                ...trace.root,
                history: rootHistory,
                txHash: rootHistory.length > 0 ? rootHistory[0].txId : null
            };
        }

        // Get children with their transaction histories (limit to first 10 for performance)
        if (trace.children && Array.isArray(trace.children)) {
            const childrenWithHistory = [];
            const childrenToProcess = trace.children.slice(0, 10);

            for (const child of childrenToProcess) {
                try {
                    const childHistory = await this.getTransactionHistory(child.id);
                    childrenWithHistory.push({
                        ...child,
                        history: childHistory,
                        txHash: childHistory.length > 0 ? childHistory[0].txId : null
                    });
                } catch (err) {
                    childrenWithHistory.push({
                        ...child,
                        history: [],
                        txHash: null
                    });
                }
            }

            enhancedTrace.children = childrenWithHistory;
            enhancedTrace.totalChildren = trace.children.length;
        }

        return enhancedTrace;
    }

    // Get item details from history (workaround for GetItem schema issues)
    async getItemFromHistory(itemId) {
        const history = await this.getTransactionHistory(itemId);
        if (history && history.length > 0 && history[0].value) {
            return {
                ...history[0].value,
                txHash: history[0].txId,
                fullHistory: history
            };
        }
        return null;
    }

    // Find the transaction that created a specific relationship
    findRelationshipTx(history, field, expectedValue) {
        // History is ordered newest first, so we look for the first tx where field changed to expectedValue
        for (let i = 0; i < history.length; i++) {
            const current = history[i];
            const next = history[i + 1]; // older transaction

            if (current.value && current.value[field] === expectedValue) {
                // Check if previous tx had different value (meaning this tx created the relationship)
                if (!next || !next.value || next.value[field] !== expectedValue) {
                    return {
                        txHash: current.txId,
                        timestamp: current.timestamp,
                        action: `${field} set to ${expectedValue}`
                    };
                }
            }
        }
        return null;
    }

    // Build trace hierarchy manually (workaround for ScanBarcode schema issues)
    // NO MAPPING: Uses cartonId directly
    async buildTraceHierarchy(itemId) {
        const item = await this.getItemFromHistory(itemId);
        if (!item) {
            throw new Error(`Item ${itemId} not found`);
        }

        const itemHistory = await this.getTransactionHistory(itemId);
        const result = {
            itemType: item.docType,
            item: item,
            itemHistory: itemHistory,
            parent: null,
            grandParent: null,
            root: null,
            children: [],
            totalChildren: 0,
            relationships: [] // Track all relationship transactions
        };

        // Build parent chain based on item type
        if (item.docType === 'strip') {
            // Strip -> Box -> Carton -> Shipment
            if (item.boxId) {
                // Find the transaction that linked this strip to the box
                const linkTx = this.findRelationshipTx(itemHistory, 'boxId', item.boxId);
                if (linkTx) {
                    result.relationships.push({
                        type: 'ADDED_TO_BOX',
                        fromItem: itemId,
                        toItem: item.boxId,
                        txHash: linkTx.txHash,
                        timestamp: linkTx.timestamp,
                        description: `Strip added to Box via transaction`
                    });
                }

                const box = await this.getItemFromHistory(item.boxId);
                if (box) {
                    const boxHistory = await this.getTransactionHistory(item.boxId);
                    result.parent = {
                        ...box,
                        history: boxHistory,
                        txHash: box.txHash,
                        linkedByTx: linkTx ? linkTx.txHash : null,
                        linkedAt: linkTx ? linkTx.timestamp : null
                    };

                    if (box.cartonId) {
                        // Find the transaction that linked the box to carton
                        const boxLinkTx = this.findRelationshipTx(boxHistory, 'cartonId', box.cartonId);
                        if (boxLinkTx) {
                            result.relationships.push({
                                type: 'BOX_ADDED_TO_CARTON',
                                fromItem: item.boxId,
                                toItem: box.cartonId,
                                txHash: boxLinkTx.txHash,
                                timestamp: boxLinkTx.timestamp,
                                description: `Box added to Carton via transaction`
                            });
                        }

                        const carton = await this.getItemFromHistory(box.cartonId);
                        if (carton) {
                            const cartonHistory = await this.getTransactionHistory(box.cartonId);
                            result.grandParent = {
                                ...carton,
                                history: cartonHistory,
                                txHash: carton.txHash,
                                linkedByTx: boxLinkTx ? boxLinkTx.txHash : null,
                                linkedAt: boxLinkTx ? boxLinkTx.timestamp : null
                            };

                            if (carton.shipmentId) {
                                // Find the transaction that linked carton to shipment
                                const cartonLinkTx = this.findRelationshipTx(cartonHistory, 'shipmentId', carton.shipmentId);
                                if (cartonLinkTx) {
                                    result.relationships.push({
                                        type: 'CARTON_ADDED_TO_SHIPMENT',
                                        fromItem: box.cartonId,
                                        toItem: carton.shipmentId,
                                        txHash: cartonLinkTx.txHash,
                                        timestamp: cartonLinkTx.timestamp,
                                        description: `Carton added to Shipment via transaction`
                                    });
                                }

                                const shipment = await this.getItemFromHistory(carton.shipmentId);
                                if (shipment) {
                                    const shipmentHistory = await this.getTransactionHistory(carton.shipmentId);
                                    result.root = {
                                        ...shipment,
                                        history: shipmentHistory,
                                        txHash: shipment.txHash,
                                        linkedByTx: cartonLinkTx ? cartonLinkTx.txHash : null,
                                        linkedAt: cartonLinkTx ? cartonLinkTx.timestamp : null
                                    };
                                }
                            }
                        }
                    }
                }
            }
        } else if (item.docType === 'box') {
            // Box has strips as children
            if (item.strips && item.strips.length > 0) {
                result.totalChildren = item.strips.length;
                const stripsToFetch = item.strips.slice(0, 10);
                for (const stripId of stripsToFetch) {
                    try {
                        const strip = await this.getItemFromHistory(stripId);
                        if (strip) {
                            const stripHistory = await this.getTransactionHistory(stripId);
                            result.children.push({ ...strip, history: stripHistory, txHash: strip.txHash });
                        }
                    } catch (e) {
                        console.error(`Failed to get strip ${stripId}:`, e.message);
                    }
                }
            }

            // Box -> Carton -> Shipment -> Order
            if (item.cartonId) {
                const carton = await this.getItemFromHistory(item.cartonId);
                if (carton) {
                    const cartonHistory = await this.getTransactionHistory(item.cartonId);
                    result.parent = { ...carton, history: cartonHistory, txHash: carton.txHash };

                    if (carton.shipmentId) {
                        const shipment = await this.getItemFromHistory(carton.shipmentId);
                        if (shipment) {
                            const shipmentHistory = await this.getTransactionHistory(carton.shipmentId);
                            result.grandParent = { ...shipment, history: shipmentHistory, txHash: shipment.txHash };

                            // Shipment -> Order
                            if (shipment.orderId) {
                                const order = await this.getItemFromHistory(shipment.orderId);
                                if (order) {
                                    const orderHistory = await this.getTransactionHistory(shipment.orderId);
                                    result.root = { ...order, history: orderHistory, txHash: order.txHash };
                                }
                            }
                        }
                    }
                }
            }
        } else if (item.docType === 'carton') {
            // Carton has boxes as children
            if (item.boxes && item.boxes.length > 0) {
                result.totalChildren = item.boxes.length;
                const boxesToFetch = item.boxes.slice(0, 10);
                for (const boxId of boxesToFetch) {
                    try {
                        const box = await this.getItemFromHistory(boxId);
                        if (box) {
                            const boxHistory = await this.getTransactionHistory(boxId);
                            result.children.push({ ...box, history: boxHistory, txHash: box.txHash });
                        }
                    } catch (e) {
                        console.error(`Failed to get box ${boxId}:`, e.message);
                    }
                }
            }

            // Carton -> Shipment -> Order
            if (item.shipmentId) {
                const shipment = await this.getItemFromHistory(item.shipmentId);
                if (shipment) {
                    const shipmentHistory = await this.getTransactionHistory(item.shipmentId);
                    result.parent = { ...shipment, history: shipmentHistory, txHash: shipment.txHash };

                    // Shipment -> Order
                    if (shipment.orderId) {
                        const order = await this.getItemFromHistory(shipment.orderId);
                        if (order) {
                            const orderHistory = await this.getTransactionHistory(shipment.orderId);
                            result.grandParent = { ...order, history: orderHistory, txHash: order.txHash };
                        }
                    }
                }
            }
        } else if (item.docType === 'shipment') {
            // Shipment has cartons as children
            if (item.cartons && item.cartons.length > 0) {
                result.totalChildren = item.cartons.length;
                const cartonsToFetch = item.cartons.slice(0, 10);
                for (const cartonId of cartonsToFetch) {
                    try {
                        const carton = await this.getItemFromHistory(cartonId);
                        if (carton) {
                            const cartonHistory = await this.getTransactionHistory(cartonId);
                            result.children.push({ ...carton, history: cartonHistory, txHash: carton.txHash });
                        }
                    } catch (e) {
                        console.error(`Failed to get carton ${cartonId}:`, e.message);
                    }
                }
            }

            // Shipment -> Order
            if (item.orderId) {
                const order = await this.getItemFromHistory(item.orderId);
                if (order) {
                    const orderHistory = await this.getTransactionHistory(item.orderId);
                    result.parent = { ...order, history: orderHistory, txHash: order.txHash };
                }
            }
        } else if (item.docType === 'order') {
            // Order has shipments/cartons/boxes as children based on itemType
            if (item.itemIds && item.itemIds.length > 0) {
                result.totalChildren = item.itemIds.length;
                const itemsToFetch = item.itemIds.slice(0, 10);
                for (const childId of itemsToFetch) {
                    try {
                        const childItem = await this.getItemFromHistory(childId);
                        if (childItem) {
                            const childHistory = await this.getTransactionHistory(childId);
                            result.children.push({ ...childItem, history: childHistory, txHash: childItem.txHash });
                        }
                    } catch (e) {
                        console.error(`Failed to get order item ${childId}:`, e.message);
                    }
                }
            }
        }

        return result;
    }

    // Get trace by item ID or txHash (auto-detect) - USES BLOCKCHAIN
    // Now uses creationTxId field for reliable txHash lookup (unique per item)
    async getTraceByIdOrHash(searchTerm) {
        await this.ensureConnected();

        // Check if it looks like a txHash (hex characters, at least 32 chars)
        const isTxHash = /^[a-f0-9]{32,}$/i.test(searchTerm) && searchTerm.length >= 32;

        if (isTxHash) {
            // First check in-memory history (for immediate response after creating items)
            // This is useful because it provides instant results without waiting for blockchain query
            const tx = this.findTransactionByHash(searchTerm);
            if (tx) {
                try {
                    const trace = await this.getFullTraceFromBlockchain(tx.itemId);
                    return {
                        searchType: 'txHash',
                        transaction: {
                            txId: tx.txId,
                            type: tx.type,
                            itemId: tx.itemId,
                            timestamp: tx.timestamp,
                            status: tx.status
                        },
                        searchedItem: trace.searchedItem,
                        children: trace.children || [],
                        parents: trace.parents || []
                    };
                } catch (err) {
                    console.log(`Trace by txHash from history failed, trying chaincode: ${err.message}`);
                }
            }

            // Use chaincode's GetTraceByTxHash which now:
            // 1. First searches by creationTxId (unique to each item, never changes)
            // 2. Falls back to history search for backward compatibility
            try {
                const result = await this.getTraceByTxHashFromBlockchain(searchTerm);
                return {
                    searchType: 'txHash',
                    transaction: result.transactionInfo,
                    searchedItem: result.traceability.searchedItem,
                    children: result.traceability.children || [],
                    parents: result.traceability.parents || []
                };
            } catch (err) {
                // If chaincode call fails, try as itemId instead
                console.log(`Chaincode trace by txHash failed, trying as itemId: ${err.message}`);
            }
        }

        // Try as Item ID (fallback or if not a txHash pattern)
        try {
            const trace = await this.getFullTraceFromBlockchain(searchTerm);

            // Get the item's creationTxId for display
            const current = trace.searchedItem?.current;
            const creationTxId = current?.creationTxId;

            return {
                searchType: 'itemId',
                transaction: creationTxId
                    ? {
                        txId: creationTxId,
                        type: trace.searchedItem.itemType?.toUpperCase() || 'UNKNOWN',
                        itemId: searchTerm,
                        timestamp: trace.searchedItem.history?.[0]?.timestamp || null,
                        status: 'success'
                    }
                    : (trace.searchedItem?.history && trace.searchedItem.history.length > 0
                        ? {
                            txId: trace.searchedItem.history[0].txId,
                            type: trace.searchedItem.itemType?.toUpperCase() || 'UNKNOWN',
                            itemId: searchTerm,
                            timestamp: trace.searchedItem.history[0].timestamp,
                            status: 'success'
                        }
                        : null),
                searchedItem: trace.searchedItem,
                children: trace.children || [],
                parents: trace.parents || []
            };
        } catch (err) {
            throw new Error(`Item or transaction "${searchTerm}" not found. ${err.message}`);
        }
    }
}

module.exports = new FabricService();
