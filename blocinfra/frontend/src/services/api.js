// Dynamically determine API URL based on current hostname
// This allows the app to work when accessed from other machines via port forwarding or ngrok
const getApiBaseUrl = () => {
    // If VITE_API_URL is explicitly set, use it
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
    }
    
    // Get current hostname and protocol
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const port = window.location.port;
    
    // If accessing through ngrok or any tunnel (not localhost), use relative path
    // This allows Vite's proxy to handle the request and forward to backend
    // The proxy works even when accessed through ngrok because it's server-side
    if (import.meta.env.DEV) {
        // In development, always use relative path to leverage Vite proxy
        // This works for both localhost and ngrok/tunnel scenarios
        return '/api';
    }
    
    // In production build, use the same hostname with port 3001
    // (assuming both ports are forwarded in production)
    return `${protocol}//${hostname}:3001/api`;
};

const API_BASE_URL = getApiBaseUrl();

class ApiService {
    constructor() {
        this.baseUrl = API_BASE_URL;
        // Debug: log the API base URL (remove in production)
        if (import.meta.env.DEV) {
            console.log('API Base URL:', this.baseUrl);
        }
    }

    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };

        const token = localStorage.getItem('token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        return headers;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;

        const config = {
            ...options,
            headers: {
                ...this.getHeaders(),
                ...options.headers
            }
        };

        try {
            if (import.meta.env.DEV) {
                console.log('API Request:', url, config);
            }
            
            const response = await fetch(url, config);
            
            // Check if response is ok before trying to parse JSON
            if (!response.ok) {
                let errorMessage = `Request failed with status ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorMessage;
                } catch (e) {
                    // If response is not JSON, use status text
                    errorMessage = response.statusText || errorMessage;
                }
                throw new Error(errorMessage);
            }

            // Try to parse JSON, but handle non-JSON responses
            let data;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                throw new Error(`Expected JSON but got: ${text.substring(0, 100)}`);
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            // Provide more helpful error messages
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Failed to connect to server. Please check if the backend is running.');
            }
            throw error;
        }
    }

    // Auth endpoints
    async login(username, password) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    }

    async logout() {
        return this.request('/auth/logout', { method: 'POST' });
    }

    async verifyToken() {
        return this.request('/auth/verify');
    }

    async getCurrentUser() {
        return this.request('/auth/me');
    }

    async getAllUsers() {
        return this.request('/auth/users');
    }

    // Get current user's certificate (for client users)
    async getMyCertificate() {
        return this.request('/auth/my-certificate');
    }

    // Generator endpoints
    async startGenerator() {
        return this.request('/chaincode/generator/start', { method: 'POST' });
    }

    // Production endpoint - start production with specific products and tablet counts
    async startProduction(productionItems) {
        return this.request('/chaincode/generator/production', {
            method: 'POST',
            body: JSON.stringify({ productionItems })
        });
    }

    async stopGenerator() {
        return this.request('/chaincode/generator/stop', { method: 'POST' });
    }

    async getGeneratorStatus() {
        return this.request('/chaincode/generator/status');
    }

    async resetGeneratorStats() {
        return this.request('/chaincode/generator/reset', { method: 'POST' });
    }

    // Statistics
    async getStatistics() {
        return this.request('/chaincode/statistics');
    }

    // ============================================================================
    // BLOCKCHAIN TRACE ENDPOINTS (NEW - Recommended)
    // All data fetched directly from blockchain
    // ============================================================================

    // Get full trace from blockchain by Item ID
    // Returns: searchedItem (with history), children (full details), parents (basic info)
    async getBlockchainTrace(itemId) {
        return this.request(`/trace/blockchain/${encodeURIComponent(itemId)}`);
    }

    // Get trace by Transaction Hash from blockchain
    // Returns: transactionInfo (for audit) + traceability tree
    async getBlockchainTraceByTxHash(txHash) {
        return this.request(`/trace/blockchain/tx/${encodeURIComponent(txHash)}`);
    }

    // Get parent basic info from blockchain
    async getParentInfo(itemId) {
        return this.request(`/trace/blockchain/parent/${encodeURIComponent(itemId)}`);
    }

    // Get item with full history from blockchain
    async getItemFromBlockchain(itemId) {
        return this.request(`/trace/blockchain/item/${encodeURIComponent(itemId)}`);
    }

    // Unified trace - auto-detect txHash vs itemId (uses blockchain)
    // Returns new structure: searchedItem, children, parentIds, parents
    async traceByHashOrId(searchTerm) {
        return this.request(`/trace/trace/${encodeURIComponent(searchTerm)}`);
    }

    // ============================================================================
    // LEGACY TRACE ENDPOINTS (World State based)
    // ============================================================================

    async scanBarcode(itemId) {
        return this.request(`/trace/scan/${encodeURIComponent(itemId)}`);
    }

    async getTransactionHistory(itemId) {
        return this.request(`/trace/history/${encodeURIComponent(itemId)}`);
    }

    async getItem(itemId) {
        return this.request(`/trace/item/${encodeURIComponent(itemId)}`);
    }

    async getFullTrace(itemId) {
        return this.request(`/trace/full/${encodeURIComponent(itemId)}`);
    }

    async verifyItem(itemId) {
        return this.request(`/trace/verify/${encodeURIComponent(itemId)}`);
    }

    // Order endpoints
    async createOrder(orderId, shipmentIds, receiverId, receiverOrg) {
        return this.request('/orders', {
            method: 'POST',
            body: JSON.stringify({ orderId, shipmentIds, receiverId, receiverOrg })
        });
    }

    async getAllOrders() {
        return this.request('/orders');
    }

    async getOrder(orderId) {
        return this.request(`/orders/${encodeURIComponent(orderId)}`);
    }

    async getOrderWithDetails(orderId) {
        return this.request(`/orders/${encodeURIComponent(orderId)}/details`);
    }

    async getOrdersByRecipient(recipient) {
        return this.request(`/orders/recipient/${encodeURIComponent(recipient)}`);
    }

    async dispatchOrder(orderId) {
        return this.request(`/orders/${encodeURIComponent(orderId)}/dispatch`, {
            method: 'POST'
        });
    }

    async deliverOrder(orderId) {
        return this.request(`/orders/${encodeURIComponent(orderId)}/deliver`, {
            method: 'POST'
        });
    }

    // Chaincode endpoints
    async initLedger() {
        return this.request('/chaincode/init', { method: 'POST' });
    }

    async getAvailableStrips() {
        return this.request('/chaincode/strips/available');
    }

    async getAvailableBoxes() {
        return this.request('/chaincode/boxes/available');
    }

    async getAvailableCartons() {
        return this.request('/chaincode/cartons/available');
    }

    async getAvailableShipments() {
        return this.request('/chaincode/shipments/available');
    }

    async getAllItems(type) {
        return this.request(`/chaincode/items/${type}`);
    }

    async getItemsPaginated(type, page = 1, limit = 50) {
        return this.request(`/chaincode/items/${type}/paginated?page=${page}&limit=${limit}`);
    }

    async searchItems(query) {
        return this.request(`/chaincode/search?q=${encodeURIComponent(query)}`);
    }

    // QR Code generation (one-time only)
    async generateQR(itemId) {
        return this.request(`/chaincode/qr/generate/${encodeURIComponent(itemId)}`, {
            method: 'POST'
        });
    }

    // ============================================================================
    // PUBLIC TRACE - No auth required
    // ============================================================================

    // Public trace by txHash or itemId (used by QR scanning)
    // Now includes order info and delivery status for shipments
    async publicTrace(searchTerm) {
        return this.request(`/trace/public/${encodeURIComponent(searchTerm)}`);
    }

    // ============================================================================
    // DELIVERY VERIFICATION - Certificate based
    // ============================================================================

    // Verify delivery using certificate (no auth required)
    async verifyDelivery(shipmentId, certificate) {
        return this.request(`/trace/verify-delivery/${encodeURIComponent(shipmentId)}`, {
            method: 'POST',
            body: JSON.stringify({ certificate })
        });
    }

    // ============================================================================
    // ALERTS - For manufacturer dashboard
    // ============================================================================

    // Get all alerts
    async getAlerts() {
        return this.request('/chaincode/alerts');
    }

    // Mark alert as read
    async markAlertRead(alertId) {
        return this.request(`/chaincode/alerts/${encodeURIComponent(alertId)}/read`, {
            method: 'PUT'
        });
    }

    // Mark all alerts as read
    async markAllAlertsRead() {
        return this.request('/chaincode/alerts/read-all', {
            method: 'PUT'
        });
    }
}

export default new ApiService();
