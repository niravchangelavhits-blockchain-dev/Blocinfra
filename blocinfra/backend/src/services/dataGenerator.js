const fabricService = require('./fabricService');
const { BATCH_PREFIXES } = require('../config/constants');

// Packaging hierarchy constants
const TABLETS_PER_STRIP = 10;    // 10 tablets per strip
const STRIPS_PER_BOX = 5;        // 5 strips per box (50 tablets)
const BOXES_PER_CARTON = 5;      // 5 boxes per carton (250 tablets)
const CARTONS_PER_SHIPMENT = 8;  // 8 cartons per shipment (2000 tablets)

// Minimum tablets for 1 full shipment
const TABLETS_PER_SHIPMENT = TABLETS_PER_STRIP * STRIPS_PER_BOX * BOXES_PER_CARTON * CARTONS_PER_SHIPMENT; // 2000
const MIN_TABLETS = TABLETS_PER_SHIPMENT; // Minimum 2000 tablets

class DataGenerator {
    constructor() {
        this.isRunning = false;
        this.stats = {
            stripsCreated: 0,
            boxesCreated: 0,
            cartonsCreated: 0,
            shipmentsCreated: 0,
            lastActivity: null,
            errors: []
        };
        this.productionQueue = [];
        this.currentProduction = null;
        this.productionProgress = null;
        this.batchCounter = 0;
        this.recentTransactions = [];
        this.maxRecentTransactions = 50;
    }

    addTransaction(type, id, status = 'success', details = {}) {
        const tx = {
            type,
            id,
            status,
            timestamp: new Date().toISOString(),
            ...details
        };
        this.recentTransactions.unshift(tx);
        if (this.recentTransactions.length > this.maxRecentTransactions) {
            this.recentTransactions.pop();
        }
    }

    generateId(prefix, type) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `${prefix}-${type}-${timestamp}-${random}`;
    }

    generateDates() {
        const today = new Date();
        const mfgDate = new Date(today);
        mfgDate.setDate(mfgDate.getDate() - Math.floor(Math.random() * 30));

        const expDate = new Date(mfgDate);
        expDate.setFullYear(expDate.getFullYear() + 2);

        return {
            mfgDate: mfgDate.toISOString().split('T')[0],
            expDate: expDate.toISOString().split('T')[0]
        };
    }

    // Calculate production breakdown from tablet count
    // Always creates FULL shipments - no partial shipments allowed
    calculateProductionPlan(tablets) {
        // Round up to nearest full shipment (2000 tablets)
        const totalShipments = Math.ceil(tablets / TABLETS_PER_SHIPMENT);

        // Calculate exact amounts for full shipments
        const totalCartons = totalShipments * CARTONS_PER_SHIPMENT;
        const totalBoxes = totalCartons * BOXES_PER_CARTON;
        const totalStrips = totalBoxes * STRIPS_PER_BOX;
        const actualTablets = totalStrips * TABLETS_PER_STRIP;

        return {
            totalStrips,
            totalBoxes,
            totalCartons,
            totalShipments,
            actualTablets,  // The rounded-up tablet count
            originalTablets: tablets
        };
    }

    // Normalize tablet count to ensure full shipments
    normalizeTabletCount(tablets) {
        // Enforce minimum 2000 tablets
        if (tablets < MIN_TABLETS) {
            console.log(`Tablet count ${tablets} is below minimum. Adjusting to ${MIN_TABLETS}`);
            return MIN_TABLETS;
        }

        // Round up to nearest full shipment
        const shipments = Math.ceil(tablets / TABLETS_PER_SHIPMENT);
        const normalized = shipments * TABLETS_PER_SHIPMENT;

        if (normalized !== tablets) {
            console.log(`Tablet count ${tablets} rounded up to ${normalized} for full shipments`);
        }

        return normalized;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Create a single strip
    async createStrip(product, batchNumber) {
        const stripId = this.generateId(product, 'STRIP');
        const { mfgDate, expDate } = this.generateDates();

        try {
            const strip = await fabricService.createStrip(
                stripId,
                batchNumber,
                product,
                mfgDate,
                expDate
            );
            this.stats.stripsCreated++;
            if (this.productionProgress) {
                this.productionProgress.stripsCreated++;
            }
            console.log(`Created strip: ${stripId}`);
            return strip;
        } catch (error) {
            console.error(`Failed to create strip ${stripId}:`, error.message);
            this.stats.errors.push({
                type: 'strip',
                id: stripId,
                error: error.message,
                timestamp: new Date()
            });
            return null;
        }
    }

    // Create box from strips (same product)
    async createBoxFromStrips(product, stripIds) {
        const boxId = this.generateId(product, 'BOX');

        try {
            const box = await fabricService.sealBox(boxId, stripIds);
            this.stats.boxesCreated++;
            if (this.productionProgress) {
                this.productionProgress.boxesCreated++;
            }
            console.log(`Created box: ${boxId} with ${stripIds.length} strips of ${product}`);
            return box;
        } catch (error) {
            console.error(`Failed to create box ${boxId}:`, error.message);
            this.stats.errors.push({
                type: 'box',
                id: boxId,
                error: error.message,
                timestamp: new Date()
            });
            return null;
        }
    }

    // Create carton from boxes (same product)
    async createCartonFromBoxes(product, boxIds) {
        const cartonId = this.generateId(product, 'CARTON');

        try {
            const carton = await fabricService.sealCarton(cartonId, boxIds);
            this.stats.cartonsCreated++;
            if (this.productionProgress) {
                this.productionProgress.cartonsCreated++;
            }
            console.log(`Created carton: ${cartonId} with ${boxIds.length} boxes of ${product}`);
            return carton;
        } catch (error) {
            console.error(`Failed to create carton ${cartonId}:`, error.message);
            this.stats.errors.push({
                type: 'carton',
                id: cartonId,
                error: error.message,
                timestamp: new Date()
            });
            return null;
        }
    }

    // Create shipment from cartons (same product)
    async createShipmentFromCartons(product, cartonIds) {
        const shipmentId = this.generateId(product, 'SHIP');

        try {
            const shipment = await fabricService.sealShipment(shipmentId, cartonIds);
            this.stats.shipmentsCreated++;
            if (this.productionProgress) {
                this.productionProgress.shipmentsCreated++;
            }
            console.log(`Created shipment: ${shipmentId} with ${cartonIds.length} cartons of ${product}`);
            return shipment;
        } catch (error) {
            console.error(`Failed to create shipment ${shipmentId}:`, error.message);
            this.stats.errors.push({
                type: 'shipment',
                id: shipmentId,
                error: error.message,
                timestamp: new Date()
            });
            return null;
        }
    }

    // Main production function - PARALLEL PROCESSING
    // Creates strips and immediately seals into boxes/cartons/shipments as items become available
    // ALWAYS creates full shipments - no partial shipments allowed
    async produceProduct(product, tablets) {
        // Normalize tablet count to ensure full shipments
        const normalizedTablets = this.normalizeTabletCount(tablets);

        console.log(`\n========================================`);
        console.log(`Starting production for ${product}`);
        console.log(`Requested: ${tablets} tablets`);
        if (normalizedTablets !== tablets) {
            console.log(`Adjusted to: ${normalizedTablets} tablets (for full shipments)`);
        }
        console.log(`========================================\n`);

        const plan = this.calculateProductionPlan(normalizedTablets);
        console.log(`Production plan for ${product}:`);
        console.log(`  - Tablets: ${plan.actualTablets}`);
        console.log(`  - Strips: ${plan.totalStrips} (${TABLETS_PER_STRIP} tablets each)`);
        console.log(`  - Boxes: ${plan.totalBoxes} (${STRIPS_PER_BOX} strips each)`);
        console.log(`  - Cartons: ${plan.totalCartons} (${BOXES_PER_CARTON} boxes each)`);
        console.log(`  - Shipments: ${plan.totalShipments} (${CARTONS_PER_SHIPMENT} cartons each)`);

        // Initialize progress for this product
        this.productionProgress = {
            currentProduct: product,
            originalTablets: tablets,
            actualTablets: plan.actualTablets,
            totalStrips: plan.totalStrips,
            totalBoxes: plan.totalBoxes,
            totalCartons: plan.totalCartons,
            totalShipments: plan.totalShipments,
            stripsCreated: 0,
            boxesCreated: 0,
            cartonsCreated: 0,
            shipmentsCreated: 0,
            status: 'running'
        };

        this.batchCounter++;
        const batchNumber = `BATCH-${product}-${this.batchCounter.toString().padStart(4, '0')}`;

        // Pending items waiting to be packed
        const pendingStrips = [];
        const pendingBoxes = [];
        const pendingCartons = [];

        // Create strips one by one and pack as we go
        for (let i = 0; i < plan.totalStrips; i++) {
            if (!this.isRunning) {
                console.log('Production stopped by user');
                return;
            }

            // Create a strip
            const strip = await this.createStrip(product, batchNumber);
            if (strip) {
                pendingStrips.push(strip);
            }

            // Check if we can seal a box (need STRIPS_PER_BOX strips)
            while (pendingStrips.length >= STRIPS_PER_BOX) {
                if (!this.isRunning) return;

                const stripsForBox = pendingStrips.splice(0, STRIPS_PER_BOX);
                const stripIds = stripsForBox.map(s => s.id);
                const box = await this.createBoxFromStrips(product, stripIds);
                if (box) {
                    pendingBoxes.push(box);
                }

                // Check if we can seal a carton (need BOXES_PER_CARTON boxes)
                while (pendingBoxes.length >= BOXES_PER_CARTON) {
                    if (!this.isRunning) return;

                    const boxesForCarton = pendingBoxes.splice(0, BOXES_PER_CARTON);
                    const boxIds = boxesForCarton.map(b => b.id);
                    const carton = await this.createCartonFromBoxes(product, boxIds);
                    if (carton) {
                        pendingCartons.push(carton);
                    }

                    // Check if we can seal a shipment (need CARTONS_PER_SHIPMENT cartons)
                    while (pendingCartons.length >= CARTONS_PER_SHIPMENT) {
                        if (!this.isRunning) return;

                        const cartonsForShipment = pendingCartons.splice(0, CARTONS_PER_SHIPMENT);
                        const cartonIds = cartonsForShipment.map(c => c.id);
                        await this.createShipmentFromCartons(product, cartonIds);
                    }
                }
            }

            // Small delay every 20 strips to avoid overwhelming the blockchain
            if (i % 20 === 19) {
                await this.delay(10);
            }
        }

        // With normalized tablet counts, there should be NO remaining items
        // But log a warning if there are (indicates a bug)
        if (pendingStrips.length > 0 || pendingBoxes.length > 0 || pendingCartons.length > 0) {
            console.warn(`WARNING: Unexpected remaining items after production!`);
            console.warn(`  Pending strips: ${pendingStrips.length}`);
            console.warn(`  Pending boxes: ${pendingBoxes.length}`);
            console.warn(`  Pending cartons: ${pendingCartons.length}`);
        }

        // Mark production progress as completed
        if (this.productionProgress) {
            this.productionProgress.status = 'completed';
        }

        console.log(`\n========================================`);
        console.log(`COMPLETED production for ${product}`);
        console.log(`Created: ${this.productionProgress.stripsCreated} strips, ${this.productionProgress.boxesCreated} boxes, ${this.productionProgress.cartonsCreated} cartons, ${this.productionProgress.shipmentsCreated} shipments`);
        console.log(`========================================\n`);

        return {
            product,
            status: 'completed',
            strips: this.productionProgress.stripsCreated,
            boxes: this.productionProgress.boxesCreated,
            cartons: this.productionProgress.cartonsCreated,
            shipments: this.productionProgress.shipmentsCreated
        };
    }

    // Start production with multiple products
    async startProduction(productionItems) {
        if (this.isRunning) {
            console.log('Production is already running');
            return { success: false, message: 'Production already running' };
        }

        if (!productionItems || productionItems.length === 0) {
            return { success: false, message: 'No products specified for production' };
        }

        // Validate and normalize tablet counts
        const normalizedItems = productionItems.map(item => {
            const normalizedTablets = this.normalizeTabletCount(item.tablets);
            return {
                product: item.product,
                tablets: normalizedTablets,
                originalTablets: item.tablets
            };
        });

        try {
            await fabricService.connect();

            // Reset stats when starting new production
            this.stats = {
                stripsCreated: 0,
                boxesCreated: 0,
                cartonsCreated: 0,
                shipmentsCreated: 0,
                lastActivity: new Date(),
                errors: []
            };

            this.isRunning = true;
            this.productionQueue = [...normalizedItems];

            // Log the normalized production plan
            console.log('\n========================================');
            console.log('PRODUCTION STARTED');
            console.log('========================================');
            normalizedItems.forEach(item => {
                const plan = this.calculateProductionPlan(item.tablets);
                console.log(`${item.product}: ${item.originalTablets} tablets -> ${item.tablets} tablets (${plan.totalShipments} full shipments)`);
            });
            console.log('========================================\n');

            // Process each product in the queue
            this.processProductionQueue();

            return {
                success: true,
                message: 'Production started',
                normalizedItems: normalizedItems.map(item => ({
                    product: item.product,
                    originalTablets: item.originalTablets,
                    actualTablets: item.tablets,
                    shipments: Math.ceil(item.tablets / TABLETS_PER_SHIPMENT)
                }))
            };
        } catch (error) {
            console.error('Failed to start production:', error);
            this.isRunning = false;
            return { success: false, message: error.message };
        }
    }

    async processProductionQueue() {
        while (this.productionQueue.length > 0 && this.isRunning) {
            const item = this.productionQueue.shift();
            this.currentProduction = item;
            this.stats.lastActivity = new Date();

            try {
                await this.produceProduct(item.product, item.tablets);
            } catch (error) {
                console.error(`Failed to produce ${item.product}:`, error);
                this.stats.errors.push({
                    type: 'production',
                    product: item.product,
                    error: error.message,
                    timestamp: new Date()
                });
            }
        }

        // Production complete - update status BEFORE clearing progress
        console.log('\n========================================');
        console.log('ALL PRODUCTION COMPLETED');
        console.log(`Total: ${this.stats.stripsCreated} strips, ${this.stats.boxesCreated} boxes, ${this.stats.cartonsCreated} cartons, ${this.stats.shipmentsCreated} shipments`);
        console.log('========================================\n');

        // Keep the final progress for status display, but mark as completed
        if (this.productionProgress) {
            this.productionProgress.status = 'completed';
        }

        this.isRunning = false;
        this.currentProduction = null;
        // Don't null out productionProgress immediately - keep it for status display
        // It will be reset when new production starts
    }

    // Legacy start method (random generation)
    async start() {
        if (this.isRunning) {
            console.log('Data generator is already running');
            return { success: false, message: 'Generator already running' };
        }

        // For backward compatibility, generate random production (1 full shipment = 2000 tablets)
        const randomProduct = BATCH_PREFIXES[Math.floor(Math.random() * BATCH_PREFIXES.length)];
        const randomTablets = TABLETS_PER_SHIPMENT; // 2000 tablets = 1 full shipment

        return this.startProduction([{ product: randomProduct, tablets: randomTablets }]);
    }

    stop() {
        if (!this.isRunning) {
            console.log('Production is not running');
            return { success: false, message: 'Production not running' };
        }

        this.isRunning = false;
        this.productionQueue = [];
        this.currentProduction = null;
        console.log('Production stopped');
        return { success: true, message: 'Production stopped' };
    }

    getStatus() {
        // Determine overall production status
        let productionStatus = 'idle';
        if (this.isRunning) {
            productionStatus = 'running';
        } else if (this.productionProgress && this.productionProgress.status === 'completed') {
            productionStatus = 'completed';
        }

        return {
            success: true,
            isRunning: this.isRunning,
            productionStatus: productionStatus,
            stats: this.stats,
            currentProduction: this.currentProduction,
            productionProgress: this.productionProgress,
            queueLength: this.productionQueue.length,
            recentErrors: this.stats.errors.slice(-5),
            // Packaging info for frontend
            packagingInfo: {
                tabletsPerStrip: TABLETS_PER_STRIP,
                stripsPerBox: STRIPS_PER_BOX,
                boxesPerCarton: BOXES_PER_CARTON,
                cartonsPerShipment: CARTONS_PER_SHIPMENT,
                tabletsPerShipment: TABLETS_PER_SHIPMENT,
                minTablets: MIN_TABLETS
            }
        };
    }

    resetStats() {
        this.stats = {
            stripsCreated: 0,
            boxesCreated: 0,
            cartonsCreated: 0,
            shipmentsCreated: 0,
            lastActivity: null,
            errors: []
        };
        this.productionQueue = [];
        this.currentProduction = null;
        this.productionProgress = null;
        return { success: true, message: 'Stats reset' };
    }
}

module.exports = new DataGenerator();
