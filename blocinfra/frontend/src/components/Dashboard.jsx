import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import api from '../services/api';
import DataGenerator from './DataGenerator';
import TraceViewer from './TraceViewer';
import OrderManager from './OrderManager';
import ManufacturerDashboard from './ManufacturerDashboard';

// Memoized components to prevent unnecessary re-renders
const MemoizedDataGenerator = memo(DataGenerator);
const MemoizedTraceViewer = memo(TraceViewer);
const MemoizedOrderManager = memo(OrderManager);
const MemoizedManufacturerDashboard = memo(ManufacturerDashboard);

const Dashboard = ({ user, onLogout }) => {
    const [activeTab, setActiveTab] = useState('generator');
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    // Alerts state
    const [alerts, setAlerts] = useState([]);
    const [alertCounts, setAlertCounts] = useState({ unread: 0, critical: 0 });
    const [showAlerts, setShowAlerts] = useState(false);

    const fetchStats = useCallback(async () => {
        try {
            const response = await api.getStatistics();
            if (response.success) {
                setStats(response.data);
            }
        } catch (error) {
            console.error('Stats fetch error:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch alerts
    const fetchAlerts = useCallback(async () => {
        try {
            const response = await api.getAlerts();
            if (response.success) {
                setAlerts(response.data || []);
                setAlertCounts(response.counts || { unread: 0, critical: 0 });
            }
        } catch (error) {
            console.error('Alerts fetch error:', error);
        }
    }, []);

    // Mark alert as read
    const handleMarkAlertRead = async (alertId) => {
        try {
            await api.markAlertRead(alertId);
            fetchAlerts();
        } catch (error) {
            console.error('Mark alert read error:', error);
        }
    };

    // Mark all alerts as read
    const handleMarkAllRead = async () => {
        try {
            await api.markAllAlertsRead();
            fetchAlerts();
        } catch (error) {
            console.error('Mark all alerts read error:', error);
        }
    };

    // Only auto-refresh stats when NOT on trace or manufacturer tabs
    // These tabs don't need live updates and the refresh causes animation flicker
    useEffect(() => {
        fetchStats();
        // Only set up interval if not on trace or manufacturer tabs
        if (activeTab !== 'trace' && activeTab !== 'manufacturer') {
            const interval = setInterval(fetchStats, 10000);
            return () => clearInterval(interval);
        }
    }, [fetchStats, activeTab]);

    // Fetch alerts on load and every 5 seconds
    useEffect(() => {
        fetchAlerts();
        const alertInterval = setInterval(fetchAlerts, 5000);
        return () => clearInterval(alertInterval);
    }, [fetchAlerts]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        onLogout();
    };

    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <div className="header-left">
                    <img src="/logo.svg" alt="BlocInfra" className="header-logo" />
                </div>
                <div className="header-right">
                    {/* Alerts Bell */}
                    <div className="alerts-container">
                        <button
                            className={`alerts-bell ${alertCounts.critical > 0 ? 'critical' : ''}`}
                            onClick={() => setShowAlerts(!showAlerts)}
                            title={`${alertCounts.unread} unread notifications`}
                        >
                            <span className="bell-icon">🔔</span>
                            {alertCounts.unread > 0 && (
                                <span className={`alert-badge ${alertCounts.critical > 0 ? 'critical' : ''}`}>
                                    {alertCounts.unread}
                                </span>
                            )}
                        </button>

                        {/* Alerts Dropdown Panel */}
                        {showAlerts && (
                            <div className="alerts-panel">
                                <div className="alerts-header">
                                    <h4>Notifications</h4>
                                    {alertCounts.unread > 0 && (
                                        <button className="mark-all-read" onClick={handleMarkAllRead}>
                                            Mark all read
                                        </button>
                                    )}
                                </div>
                                <div className="alerts-list">
                                    {alerts.length === 0 ? (
                                        <div className="no-alerts">No notifications yet</div>
                                    ) : (
                                        alerts.slice(0, 10).map(alert => (
                                            <div
                                                key={alert.id}
                                                className={`alert-item ${alert.severity} ${alert.read ? 'read' : 'unread'}`}
                                                onClick={() => !alert.read && handleMarkAlertRead(alert.id)}
                                            >
                                                <div className="alert-icon">
                                                    {alert.type === 'DELIVERY_SUCCESS' && '✅'}
                                                    {alert.type === 'UNAUTHORIZED_ATTEMPT' && '🚨'}
                                                    {alert.type === 'INVALID_CERTIFICATE' && '⚠️'}
                                                </div>
                                                <div className="alert-content">
                                                    <div className="alert-title">{alert.title}</div>
                                                    <div className="alert-message">{alert.message}</div>
                                                    <div className="alert-time">
                                                        {new Date(alert.timestamp).toLocaleString()}
                                                    </div>
                                                    {alert.type === 'UNAUTHORIZED_ATTEMPT' && alert.details && (
                                                        <div className="alert-extra">
                                                            Expected: {alert.details.expectedReceiver} ({alert.details.expectedOrg})<br/>
                                                            Attempted: {alert.details.attemptedBy} ({alert.details.attemptedOrg})
                                                        </div>
                                                    )}
                                                </div>
                                                {!alert.read && <div className="unread-dot"></div>}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    <span className="user-info">
                        {user.displayName} ({user.org})
                    </span>
                    <button onClick={handleLogout} className="logout-button">
                        Logout
                    </button>
                </div>
            </header>

            {/* Click outside to close alerts */}
            {showAlerts && <div className="alerts-overlay" onClick={() => setShowAlerts(false)} />}

            <div className="stats-bar">
                {loading ? (
                    <div className="loading">Loading statistics...</div>
                ) : stats ? (
                    <>
                        <div className="stat-item">
                            <span className="stat-value">{stats?.strips || 0}</span>
                            <span className="stat-label">Strips</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value">{stats?.boxes || 0}</span>
                            <span className="stat-label">Boxes</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value">{stats?.cartons || 0}</span>
                            <span className="stat-label">Cartons</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value">{stats?.shipments || 0}</span>
                            <span className="stat-label">Shipments</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value">{stats?.orders || 0}</span>
                            <span className="stat-label">Orders</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value">{stats?.errorTransactions || 0}</span>
                            <span className="stat-label">Error Tx</span>
                        </div>
                    </>
                ) : null}
            </div>

            {/* Transaction History Section */}
            <div className="transaction-history">
                <h3 className="history-title">Recent Blockchain Transactions</h3>
                <div className="history-list">
                    {stats?.recentTransactions && stats.recentTransactions.length > 0 ? (
                        stats.recentTransactions.slice(0, 10).map((tx) => (
                            <div key={`tx-${tx.hash}`} className={`history-item ${tx.success ? 'success' : 'error'}`}>
                                <div className="tx-header">
                                    <span className={`tx-type tx-type-${tx.type?.toLowerCase().replace(/_/g, '-')}`}>
                                        {tx.type}
                                    </span>
                                    <span className="tx-time">{new Date(tx.timestamp).toLocaleString()}</span>
                                </div>
                                <div className="tx-details">
                                    <div className="tx-item-id">
                                        <span className="label">Item:</span>
                                        <code>{tx.itemId}</code>
                                    </div>
                                    {tx.childIds && tx.childIds.length > 0 && (
                                        <div className="tx-children">
                                            <span className="label">Contains:</span>
                                            <span className="child-count">{tx.childIds.length} items</span>
                                        </div>
                                    )}
                                </div>
                                <div className="tx-hash">
                                    <span className="label">TxHash:</span>
                                    <code className="hash-text" title={tx.hash}>
                                        {tx.hash?.substring(0, 16)}...{tx.hash?.substring(tx.hash.length - 8)}
                                    </code>
                                    <button
                                        className="copy-btn"
                                        onClick={() => navigator.clipboard.writeText(tx.hash)}
                                        title="Copy transaction hash"
                                    >
                                        Copy
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="no-transactions">No recent transactions - start the generator to create blockchain transactions</div>
                    )}
                </div>
            </div>

            <nav className="dashboard-nav">
                <button
                    className={`nav-button ${activeTab === 'generator' ? 'active' : ''}`}
                    onClick={() => setActiveTab('generator')}
                >
                    Data Generator
                </button>
                <button
                    className={`nav-button ${activeTab === 'trace' ? 'active' : ''}`}
                    onClick={() => setActiveTab('trace')}
                >
                    Track & Trace
                </button>
                <button
                    className={`nav-button ${activeTab === 'orders' ? 'active' : ''}`}
                    onClick={() => setActiveTab('orders')}
                >
                    Orders
                </button>
                <button
                    className={`nav-button ${activeTab === 'manufacturer' ? 'active' : ''}`}
                    onClick={() => setActiveTab('manufacturer')}
                >
                    Manufacturer
                </button>
            </nav>

            <main className="dashboard-content">
                {activeTab === 'generator' && <MemoizedDataGenerator onUpdate={fetchStats} />}
                {activeTab === 'trace' && <MemoizedTraceViewer />}
                {activeTab === 'orders' && <MemoizedOrderManager />}
                {activeTab === 'manufacturer' && <MemoizedManufacturerDashboard stats={stats} />}
            </main>
        </div>
    );
};

export default Dashboard;
