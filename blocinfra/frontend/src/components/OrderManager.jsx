import React, { useState, useEffect } from 'react';
import api from '../services/api';

const OrderManager = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);

    // Users and shipments data
    const [users, setUsers] = useState([]);
    const [availableShipments, setAvailableShipments] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);

    // Form state
    const [formData, setFormData] = useState({
        orderId: '',
        receiverId: '',
        receiverOrg: '',
        selectedShipments: []
    });
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState('');

    useEffect(() => {
        fetchOrders();
        fetchCurrentUser();
        fetchUsers();
    }, []);

    const fetchCurrentUser = async () => {
        try {
            const response = await api.getCurrentUser();
            if (response.success) {
                setCurrentUser(response.user);
            }
        } catch (err) {
            console.error('Failed to fetch current user:', err);
        }
    };

    const fetchUsers = async () => {
        try {
            const response = await api.getAllUsers();
            if (response.success) {
                setUsers(response.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch users:', err);
        }
    };

    const fetchAvailableShipments = async () => {
        try {
            const response = await api.getAvailableShipments();
            if (response.success) {
                setAvailableShipments(response.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch shipments:', err);
        }
    };

    const fetchOrders = async () => {
        try {
            const response = await api.getAllOrders();
            if (response.success) {
                setOrders(response.data || []);
            }
        } catch (err) {
            setError('Failed to fetch orders');
        } finally {
            setLoading(false);
        }
    };

    const generateOrderId = () => {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `ORDER-${timestamp}-${random}`;
    };

    const openCreateForm = async () => {
        setFormData({
            orderId: generateOrderId(),
            receiverId: '',
            receiverOrg: '',
            selectedShipments: []
        });
        setFormError('');
        await fetchAvailableShipments();
        setShowCreateForm(true);
    };

    const handleReceiverChange = (userId) => {
        const user = users.find(u => u.userId === userId);
        // Use functional update to avoid stale closure issues
        setFormData(prev => ({
            ...prev,
            receiverId: userId,
            receiverOrg: user?.org || ''
        }));
    };

    const toggleShipmentSelection = (shipmentId) => {
        setFormData(prev => {
            const isSelected = prev.selectedShipments.includes(shipmentId);
            return {
                ...prev,
                selectedShipments: isSelected
                    ? prev.selectedShipments.filter(id => id !== shipmentId)
                    : [...prev.selectedShipments, shipmentId]
            };
        });
    };

    const selectAllShipments = () => {
        setFormData(prev => ({
            ...prev,
            selectedShipments: availableShipments.map(s => s.ID || s.id)
        }));
    };

    const clearAllShipments = () => {
        setFormData(prev => ({
            ...prev,
            selectedShipments: []
        }));
    };

    const handleCreateOrder = async (e) => {
        e.preventDefault();
        setFormError('');
        setFormLoading(true);

        try {
            if (formData.selectedShipments.length === 0) {
                throw new Error('Please select at least one shipment');
            }

            if (!formData.receiverId) {
                throw new Error('Please select a receiver');
            }

            const response = await api.createOrder(
                formData.orderId,
                formData.selectedShipments,
                formData.receiverId,
                formData.receiverOrg
            );

            if (response.success) {
                setShowCreateForm(false);
                fetchOrders();
                fetchAvailableShipments();
            } else {
                setFormError(response.message);
            }
        } catch (err) {
            setFormError(err.message);
        } finally {
            setFormLoading(false);
        }
    };

    const handleDispatch = async (orderId) => {
        try {
            const response = await api.dispatchOrder(orderId);
            if (response.success) {
                fetchOrders();
            }
        } catch (err) {
            setError('Failed to dispatch order');
        }
    };

    // Delivery is disabled from dashboard - must use QR scan with certificate
    const handleDeliver = async (orderId) => {
        setError('Delivery must be confirmed by the receiver scanning the shipment QR code and verifying their identity with a certificate.');
    };

    const viewOrderDetails = async (orderId) => {
        try {
            const response = await api.getOrderWithDetails(orderId);
            if (response.success) {
                setSelectedOrder(response.data);
            }
        } catch (err) {
            setError('Failed to get order details');
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'CREATED': return 'status-created';
            case 'DISPATCHED': return 'status-dispatched';
            case 'DELIVERED': return 'status-delivered';
            default: return '';
        }
    };

    // Filter out current user from receiver list (can't send to yourself)
    // Compare using username field or extract username from userId (which is now username@org)
    const availableReceivers = users.filter(u => {
        const userIdentifier = u.username || u.userId?.split('@')[0];
        return userIdentifier !== currentUser?.username;
    });

    return (
        <div className="order-manager">
            <div className="order-header">
                <h2>Order Management</h2>
                <div className="header-info">
                    {currentUser && (
                        <span className="current-user-badge">
                            Logged in as: <strong>{currentUser.displayName}</strong> ({currentUser.org})
                        </span>
                    )}
                    <button
                        className="create-order-btn"
                        onClick={openCreateForm}
                    >
                        + Create Order
                    </button>
                </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            {/* Create Order Modal */}
            {showCreateForm && (
                <div className="modal-overlay">
                    <div className="modal large">
                        <div className="modal-header">
                            <h3>Create New Order</h3>
                            <button
                                className="close-btn"
                                onClick={() => setShowCreateForm(false)}
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleCreateOrder} className="order-form">
                            {formError && <div className="error-message">{formError}</div>}

                            {/* Sender Info (Auto-filled) */}
                            <div className="form-section">
                                <h4>Sender (You)</h4>
                                <div className="sender-info">
                                    <span className="sender-badge">
                                        {currentUser?.displayName} ({currentUser?.org})
                                    </span>
                                </div>
                            </div>

                            {/* Order ID */}
                            <div className="form-group">
                                <label>Order ID</label>
                                <input
                                    type="text"
                                    value={formData.orderId}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setFormData(prev => ({...prev, orderId: value}));
                                    }}
                                    placeholder="Auto-generated"
                                />
                            </div>

                            {/* Receiver Selection */}
                            <div className="form-section">
                                <h4>Select Receiver</h4>
                                <div className="form-group">
                                    <label>Receiver User</label>
                                    <select
                                        value={formData.receiverId}
                                        onChange={(e) => handleReceiverChange(e.target.value)}
                                        required
                                    >
                                        <option value="">-- Select Receiver --</option>
                                        {availableReceivers.map(user => (
                                            <option key={user.userId} value={user.userId}>
                                                {user.displayName || user.username || user.userId} ({user.org}) - {user.role}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {formData.receiverId && (
                                    <div className="receiver-info">
                                        Selected: <strong>{users.find(u => u.userId === formData.receiverId)?.displayName || formData.receiverId}</strong> from <strong>{formData.receiverOrg}</strong>
                                    </div>
                                )}
                            </div>

                            {/* Shipment Selection */}
                            <div className="form-section">
                                <h4>Select Shipments to Send</h4>
                                <div className="shipment-controls">
                                    <button type="button" onClick={selectAllShipments} className="select-all-btn">
                                        Select All
                                    </button>
                                    <button type="button" onClick={clearAllShipments} className="clear-all-btn">
                                        Clear All
                                    </button>
                                    <span className="selection-count">
                                        {formData.selectedShipments.length} of {availableShipments.length} selected
                                    </span>
                                </div>

                                {availableShipments.length === 0 ? (
                                    <div className="no-shipments">
                                        <p>No available shipments. Create shipments first.</p>
                                    </div>
                                ) : (
                                    <div className="shipment-list">
                                        {availableShipments.map(shipment => {
                                            // Handle both ID and id (chaincode uses ID, but some responses might use id)
                                            const shipmentId = shipment.ID || shipment.id;
                                            const cartons = shipment.Cartons || shipment.cartons || [];
                                            const status = shipment.Status || shipment.status || 'N/A';
                                            const distributor = shipment.Distributor || shipment.distributor;
                                            const isSelected = formData.selectedShipments.includes(shipmentId);
                                            
                                            return (
                                                <div
                                                    key={shipmentId}
                                                    className={`shipment-item ${isSelected ? 'selected' : ''}`}
                                                    onClick={() => toggleShipmentSelection(shipmentId)}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => {}}
                                                    />
                                                    <div className="shipment-info">
                                                        <span className="shipment-id">{shipmentId}</span>
                                                        <span className="shipment-details">
                                                            {Array.isArray(cartons) ? cartons.length : 0} Cartons |
                                                            Status: {status}
                                                        </span>
                                                        {distributor && (
                                                            <span className="shipment-distributor">
                                                                Distributor: {distributor}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="form-actions">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateForm(false)}
                                    className="cancel-btn"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={formLoading || formData.selectedShipments.length === 0 || !formData.receiverId}
                                    className="submit-btn"
                                >
                                    {formLoading ? 'Creating...' : `Send Order (${formData.selectedShipments.length} Shipments)`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Order Details Modal */}
            {selectedOrder && (
                <div className="modal-overlay">
                    <div className="modal large">
                        <div className="modal-header">
                            <h3>Order Details</h3>
                            <button
                                className="close-btn"
                                onClick={() => setSelectedOrder(null)}
                            >
                                &times;
                            </button>
                        </div>

                        <div className="order-details">
                            <div className="detail-row">
                                <span className="label">Order ID:</span>
                                <span className="value">{selectedOrder.order.id}</span>
                            </div>
                            <div className="detail-row">
                                <span className="label">Status:</span>
                                <span className={`value ${getStatusColor(selectedOrder.order.status)}`}>
                                    {selectedOrder.order.status}
                                </span>
                            </div>
                            <div className="detail-row">
                                <span className="label">Sender:</span>
                                <span className="value">
                                    {selectedOrder.order.senderId || 'N/A'} ({selectedOrder.order.senderOrg || 'N/A'})
                                </span>
                            </div>
                            <div className="detail-row">
                                <span className="label">Receiver:</span>
                                <span className="value">
                                    {selectedOrder.order.receiverId || selectedOrder.order.recipient || 'N/A'}
                                    {selectedOrder.order.receiverOrg && ` (${selectedOrder.order.receiverOrg})`}
                                </span>
                            </div>
                            <div className="detail-row">
                                <span className="label">Created:</span>
                                <span className="value">
                                    {new Date(selectedOrder.order.createdAt).toLocaleString()}
                                </span>
                            </div>
                            {selectedOrder.order.dispatchedAt && (
                                <div className="detail-row">
                                    <span className="label">Dispatched:</span>
                                    <span className="value">
                                        {new Date(selectedOrder.order.dispatchedAt).toLocaleString()}
                                    </span>
                                </div>
                            )}
                            {selectedOrder.order.deliveredAt && (
                                <div className="detail-row">
                                    <span className="label">Delivered:</span>
                                    <span className="value">
                                        {new Date(selectedOrder.order.deliveredAt).toLocaleString()}
                                    </span>
                                </div>
                            )}
                            {selectedOrder.order.creationTxId && (
                                <div className="detail-row">
                                    <span className="label">TX Hash:</span>
                                    <span className="value tx-hash">
                                        {selectedOrder.order.creationTxId.substring(0, 16)}...
                                    </span>
                                </div>
                            )}

                            <h4>Shipments in Order ({selectedOrder.order.itemIds?.length || 0})</h4>
                            <div className="order-items-list">
                                {selectedOrder.itemDetails?.map((item, index) => (
                                    <div key={index} className="order-item-card">
                                        <span className="item-id">{item.item?.id || item.id}</span>
                                        <span className="item-type">{item.itemType || 'Shipment'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Orders List */}
            {loading ? (
                <div className="loading">Loading orders...</div>
            ) : orders.length === 0 ? (
                <div className="no-orders">
                    <p>No orders found. Create your first order!</p>
                </div>
            ) : (
                <div className="orders-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Order ID</th>
                                <th>From</th>
                                <th>To</th>
                                <th>Shipments</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((order) => (
                                <tr key={order.id}>
                                    <td className="order-id">{order.id}</td>
                                    <td>{order.senderId || 'N/A'} <br/><small>({order.senderOrg || ''})</small></td>
                                    <td>{order.receiverId || order.recipient || 'N/A'} <br/><small>({order.receiverOrg || ''})</small></td>
                                    <td>{order.itemIds?.length || 0}</td>
                                    <td>
                                        <span className={`status-badge ${getStatusColor(order.status)}`}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                                    <td className="actions">
                                        <button
                                            onClick={() => viewOrderDetails(order.id)}
                                            className="action-btn view"
                                        >
                                            View
                                        </button>
                                        {order.status === 'CREATED' && (
                                            <button
                                                onClick={() => handleDispatch(order.id)}
                                                className="action-btn dispatch"
                                            >
                                                Dispatch
                                            </button>
                                        )}
                                        {order.status === 'DISPATCHED' && (
                                            <span
                                                className="action-info awaiting-delivery"
                                                title="Receiver must scan shipment QR and verify with certificate"
                                            >
                                                📦 Awaiting Delivery
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default OrderManager;
