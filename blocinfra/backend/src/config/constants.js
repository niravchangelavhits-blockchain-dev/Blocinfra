// BlockInfra Constants
// CLEAN VERSION: For use after chaincode is updated to use 'carton' instead of 'karton'

module.exports = {
    // Transaction Types
    TX_TYPES: {
        CREATE_STRIP: 'CreateStrip',
        SEAL_BOX: 'SealBox',
        SEAL_CARTON: 'SealCarton',  // Changed from SealKarton
        SEAL_SHIPMENT: 'SealShipment',
        DISTRIBUTE_SHIPMENT: 'DistributeShipment',
        SCAN_BARCODE: 'ScanBarcode',
        GET_AVAILABLE_STRIPS: 'GetAvailableStrips',
        GET_AVAILABLE_BOXES: 'GetAvailableBoxes',
        GET_AVAILABLE_CARTONS: 'GetAvailableCartons',  // Changed from GetAvailableKartons
        GET_AVAILABLE_SHIPMENTS: 'GetAvailableShipments',
        INIT_LEDGER: 'InitLedger',
        // Order related
        CREATE_ORDER: 'CreateOrder',
        DISPATCH_ORDER: 'DispatchOrder',
        DELIVER_ORDER: 'DeliverOrder',
        GET_ALL_ORDERS: 'GetAllOrders',
        GET_ORDERS_BY_RECIPIENT: 'GetOrdersByRecipient',
        GET_ORDER: 'GetOrder',
        // Blockchain trace functions (matches chaincodeV2)
        GET_FULL_TRACE_FROM_BLOCKCHAIN: 'GetFullTraceFromBlockchain',
        GET_TRACE_BY_TX_HASH: 'GetTraceByTxHash',
        GET_ITEM_HISTORY_FROM_BLOCKCHAIN: 'GetItemHistoryFromBlockchain',
        GET_ITEM_BY_CREATION_TX_HASH: 'GetItemByCreationTxHash'
    },

    // Item Status
    STATUS: {
        CREATED: 'CREATED',
        SEALED: 'SEALED',
        IN_ORDER: 'IN_ORDER',
        DISPATCHED: 'DISPATCHED',
        SHIPPED: 'SHIPPED',
        DELIVERED: 'DELIVERED'
    },

    // Doc Types
    DOC_TYPES: {
        STRIP: 'strip',
        BOX: 'box',
        CARTON: 'carton',  // Direct carton (no mapping needed)
        SHIPMENT: 'shipment',
        ORDER: 'order'
    },

    // Data Generation Config
    GENERATION: {
        STRIPS_PER_BOX: 5,        // 5 strips = 1 box
        BOXES_PER_CARTON: 10,     // 10 boxes = 1 carton
        CARTONS_PER_SHIPMENT: 10, // 10 cartons = 1 shipment
        MIN_STRIPS_PER_CYCLE: 1,  // Random strips: min
        MAX_STRIPS_PER_CYCLE: 8,  // Random strips: max
        INTERVAL_MS: 3000         // Faster cycles
    },

    // Batch prefixes for dummy data
    BATCH_PREFIXES: [
        'PARACETAMOL',
        'AMOXICILLIN',
        'IBUPROFEN',
        'ASPIRIN',
        'METFORMIN',
        'OMEPRAZOLE',
        'ATORVASTATIN',
        'LISINOPRIL'
    ]
};
