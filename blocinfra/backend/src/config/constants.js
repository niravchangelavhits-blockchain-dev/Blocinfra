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

    // Data Generation Config - Packaging Hierarchy
    // 1 shipment = 8 cartons × 5 boxes × 5 strips × 10 tablets = 2000 tablets
    GENERATION: {
        TABLETS_PER_STRIP: 10,     // 10 tablets = 1 strip
        STRIPS_PER_BOX: 5,         // 5 strips = 1 box (50 tablets)
        BOXES_PER_CARTON: 5,       // 5 boxes = 1 carton (250 tablets)
        CARTONS_PER_SHIPMENT: 8,   // 8 cartons = 1 shipment (2000 tablets)
        TABLETS_PER_SHIPMENT: 2000, // Minimum tablets for 1 full shipment
        MIN_TABLETS: 2000          // Minimum production quantity
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
