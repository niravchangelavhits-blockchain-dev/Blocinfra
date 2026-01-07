const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

// Import services
const couchdbInit = require('./services/couchdbInit');

// Import routes
const authRoutes = require('./routes/auth');
const chaincodeRoutes = require('./routes/chaincode');
const traceRoutes = require('./routes/trace');
const orderRoutes = require('./routes/order');
const publicTraceRoutes = require('./routes/publicTrace');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
// CORS configuration - allow requests from frontend URL or any origin in development
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = process.env.FRONTEND_URL 
            ? process.env.FRONTEND_URL.split(',')
            : ['http://localhost:5173'];
        
        // In development, allow any origin (useful for port forwarding)
        if (process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }
        
        // In production, check against allowed origins
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan('dev'));

// Health check
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'BlocInfra API is running',
        timestamp: new Date().toISOString()
    });
});

// Public Routes (no authentication required)
app.use('/api/trace', publicTraceRoutes);

// API Routes (authentication required)
app.use('/api/auth', authRoutes);
app.use('/api/chaincode', chaincodeRoutes);
app.use('/api/trace', traceRoutes);
app.use('/api/orders', orderRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Start server - listen on all interfaces (0.0.0.0) to allow access from other machines
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, async () => {
    console.log(`
    ╔══════════════════════════════════════════╗
    ║                                          ║
    ║     BlocInfra API Server Started         ║
    ║                                          ║
    ║     Host: ${HOST.padEnd(35)}║
    ║     Port: ${PORT}                           ║
    ║     Mode: ${process.env.NODE_ENV || 'development'}                  ║
    ║                                          ║
    ╚══════════════════════════════════════════╝
    `);

    // Initialize CouchDB indexes after server starts
    try {
        await couchdbInit.initializeIndexes();
    } catch (error) {
        console.error('[CouchDB] Index initialization failed:', error.message);
    }
});

module.exports = app;
