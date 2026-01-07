const fabricService = require('./fabricService');
const { BATCH_PREFIXES } = require('../config/constants');

// Packaging hierarchy constants
const TABLETS_PER_STRIP = 10;
const STRIPS_PER_BOX = 5;
const BOXES_PER_CARTON = 5;
const CARTONS_PER_SHIPMENT = 8;

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
    calculateProductionPlan(tablets) {
        const totalStrips = Math.ceil(tablets / TABLETS_PER_STRIP);
        const totalBoxes = Math.ceil(totalStrips / STRIPS_PER_BOX);
        const totalCartons = Math.ceil(totalBoxes / BOXES_PER_CARTON);
        const totalShipments = Math.ceil(totalCartons / CARTONS_PER_SHIPMENT);

        return {
            totalStrips,
            totalBoxes,
            totalCartons,
            totalShipments
        };
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
    async produceProduct(product, tablets) {
        console.log(`\n========================================`);
        console.log(`Starting production for ${product}: ${tablets} tablets`);
        console.log(`========================================\n`);

        const plan = this.calculateProductionPlan(tablets);
        console.log(`Production plan for ${product}:`);
        console.log(`  - Strips: ${plan.totalStrips}`);
        console.log(`  - Boxes: ${plan.totalBoxes}`);
        console.log(`  - Cartons: ${plan.totalCartons}`);
        console.log(`  - Shipments: ${plan.totalShipments}`);

        // Initialize progress for this product
        this.productionProgress = {
            currentProduct: product,
            totalStrips: plan.totalStrips,
            totalBoxes: plan.totalBoxes,
            totalCartons: plan.totalCartons,
            totalShipments: plan.totalShipments,
            stripsCreated: 0,
            boxesCreated: 0,
            cartonsCreated: 0,
            shipmentsCreated: 0
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

        // Handle remaining items that didn't fill a complete container
        console.log(`\nHandling remaining items...`);
        console.log(`  Pending strips: ${pendingStrips.length}`);
        console.log(`  Pending boxes: ${pendingBoxes.length}`);
        console.log(`  Pending cartons: ${pendingCartons.length}`);

        // Seal remaining strips into partial box if any
        if (pendingStrips.length > 0 && this.isRunning) {
            const stripIds = pendingStrips.map(s => s.id);
            const box = await this.createBoxFromStrips(product, stripIds);
            if (box) {
                pendingBoxes.push(box);
            }
            pendingStrips.length = 0;
        }

        // Seal remaining boxes into partial carton if any
        if (pendingBoxes.length > 0 && this.isRunning) {
            const boxIds = pendingBoxes.map(b => b.id);
            const carton = await this.createCartonFromBoxes(product, boxIds);
            if (carton) {
                pendingCartons.push(carton);
            }
            pendingBoxes.length = 0;
        }

        // Seal remaining cartons into partial shipment if any
        if (pendingCartons.length > 0 && this.isRunning) {
            const cartonIds = pendingCartons.map(c => c.id);
            await this.createShipmentFromCartons(product, cartonIds);
            pendingCartons.length = 0;
        }

        console.log(`\n========================================`);
        console.log(`Completed production for ${product}`);
        console.log(`Created: ${this.productionProgress.stripsCreated} strips, ${this.productionProgress.boxesCreated} boxes, ${this.productionProgress.cartonsCreated} cartons, ${this.productionProgress.shipmentsCreated} shipments`);
        console.log(`========================================\n`);

        return {
            product,
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

        try {
            await fabricService.connect();
            this.isRunning = true;
            this.productionQueue = [...productionItems];
            console.log('Production started with queue:', JSON.stringify(productionItems));

            // Process each product in the queue
            this.processProductionQueue();

            return { success: true, message: 'Production started' };
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

        // Production complete
        this.isRunning = false;
        this.currentProduction = null;
        this.productionProgress = null;
        console.log('Production queue completed');
    }

    // Legacy start method (random generation)
    async start() {
        if (this.isRunning) {
            console.log('Data generator is already running');
            return { success: false, message: 'Generator already running' };
        }

        // For backward compatibility, generate random production
        const randomProduct = BATCH_PREFIXES[Math.floor(Math.random() * BATCH_PREFIXES.length)];
        const randomTablets = 30000; // 1 shipment worth

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
        return {
            success: true,
            isRunning: this.isRunning,
            stats: this.stats,
            currentProduction: this.currentProduction,
            productionProgress: this.productionProgress,
            queueLength: this.productionQueue.length,
            recentErrors: this.stats.errors.slice(-5)
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
