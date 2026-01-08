import React, { useState, useEffect } from 'react';
import api from '../services/api';

// Product list with tablet production
const AVAILABLE_PRODUCTS = [
    'PARACETAMOL',
    'AMOXICILLIN',
    'IBUPROFEN',
    'ASPIRIN',
    'METFORMIN',
    'OMEPRAZOLE',
    'ATORVASTATIN',
    'LISINOPRIL'
];

// Packaging hierarchy constants
const TABLETS_PER_STRIP = 10;     // 10 tablets per strip
const STRIPS_PER_BOX = 5;         // 5 strips per box
const BOXES_PER_CARTON = 5;       // 5 boxes per carton
const CARTONS_PER_SHIPMENT = 8;   // 8 cartons per shipment

// Calculated values
const TABLETS_PER_BOX = TABLETS_PER_STRIP * STRIPS_PER_BOX; // 50 tablets
const TABLETS_PER_CARTON = TABLETS_PER_BOX * BOXES_PER_CARTON; // 250 tablets
const TABLETS_PER_SHIPMENT = TABLETS_PER_CARTON * CARTONS_PER_SHIPMENT; // 2000 tablets

// Minimum tablets required (1 full shipment)
const MIN_TABLETS = TABLETS_PER_SHIPMENT; // 2000 tablets

const DataGenerator = ({ onUpdate }) => {
    const [productionItems, setProductionItems] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState('');
    const [tabletCount, setTabletCount] = useState('');
    const [loading, setLoading] = useState(false);
    const [generatingProduct, setGeneratingProduct] = useState(null);
    const [progress, setProgress] = useState(null);
    const [productionStatus, setProductionStatus] = useState('idle'); // 'idle', 'running', 'completed'
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [stats, setStats] = useState(null);
    const [tabletWarning, setTabletWarning] = useState('');

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 10000);
        return () => clearInterval(interval);
    }, []);

    const fetchStatus = async () => {
        try {
            const response = await api.getGeneratorStatus();
            if (response.success) {
                setStats(response.stats);
                // Use productionStatus from backend to determine actual status
                const status = response.productionStatus || 'idle';
                setProductionStatus(status);

                if (response.productionProgress) {
                    setProgress(response.productionProgress);
                    // Only set generatingProduct if actually running
                    if (status === 'running') {
                        setGeneratingProduct(response.productionProgress.currentProduct);
                    } else {
                        // Production completed or idle - clear generatingProduct
                        setGeneratingProduct(null);
                    }
                } else {
                    setProgress(null);
                    setGeneratingProduct(null);
                }
            }
        } catch (error) {
            console.error('Failed to fetch status:', error);
        }
    };

    // Calculate packaging breakdown for tablets
    // Always rounds up to full shipments - no partial shipments allowed
    const calculateBreakdown = (tablets) => {
        if (!tablets || tablets <= 0) return null;

        // Round up to nearest full shipment (2000 tablets)
        const totalShipments = Math.ceil(tablets / TABLETS_PER_SHIPMENT);
        const actualTablets = totalShipments * TABLETS_PER_SHIPMENT;

        // Calculate exact amounts for full shipments
        const totalCartons = totalShipments * CARTONS_PER_SHIPMENT;
        const totalBoxes = totalCartons * BOXES_PER_CARTON;
        const totalStrips = totalBoxes * STRIPS_PER_BOX;

        return {
            tablets: actualTablets,
            originalTablets: tablets,
            shipments: totalShipments,
            cartons: totalCartons,
            boxes: totalBoxes,
            strips: totalStrips,
            wasRoundedUp: actualTablets !== tablets,
            tabletsDifference: actualTablets - tablets
        };
    };

    // Validate tablet count
    const validateTabletCount = (count) => {
        if (!count || count <= 0) return { valid: false, warning: '' };
        if (count < MIN_TABLETS) {
            return {
                valid: false,
                warning: `Minimum ${MIN_TABLETS.toLocaleString()} tablets required for 1 full shipment. Please enter at least ${MIN_TABLETS.toLocaleString()} tablets.`
            };
        }
        return { valid: true, warning: '' };
    };

    const handleAddProduct = () => {
        if (!selectedProduct) {
            setError('Please select a product');
            return;
        }
        if (!tabletCount || parseInt(tabletCount) <= 0) {
            setError('Please enter a valid tablet count');
            return;
        }

        const tablets = parseInt(tabletCount);
        const validation = validateTabletCount(tablets);
        if (!validation.valid) {
            setError(validation.warning);
            return;
        }

        // Check if product already exists
        const existingIndex = productionItems.findIndex(item => item.product === selectedProduct);
        if (existingIndex >= 0) {
            // Update existing
            const updated = [...productionItems];
            updated[existingIndex].tablets = tablets;
            setProductionItems(updated);
        } else {
            // Add new
            setProductionItems([...productionItems, {
                product: selectedProduct,
                tablets: tablets
            }]);
        }

        setSelectedProduct('');
        setTabletCount('');
        setTabletWarning('');
        setError('');
    };

    // Handle tablet count change with validation feedback
    const handleTabletCountChange = (value) => {
        setTabletCount(value);
        const count = parseInt(value);
        if (count && count > 0 && count < MIN_TABLETS) {
            setTabletWarning(`Minimum ${MIN_TABLETS.toLocaleString()} tablets required. Will be rounded up to ${MIN_TABLETS.toLocaleString()}.`);
        } else if (count && count > 0) {
            const breakdown = calculateBreakdown(count);
            if (breakdown && breakdown.wasRoundedUp) {
                setTabletWarning(`Will be rounded up to ${breakdown.tablets.toLocaleString()} tablets for ${breakdown.shipments} full shipment(s).`);
            } else {
                setTabletWarning('');
            }
        } else {
            setTabletWarning('');
        }
    };

    const handleRemoveProduct = (index) => {
        setProductionItems(productionItems.filter((_, i) => i !== index));
    };

    const handleStartProduction = async () => {
        if (productionItems.length === 0) {
            setError('Please add at least one product to produce');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const response = await api.startProduction(productionItems);
            if (response.success) {
                setSuccess('Production started successfully!');
                setProductionItems([]);
                fetchStatus();
                onUpdate && onUpdate();
            } else {
                setError(response.message || 'Failed to start production');
            }
        } catch (error) {
            setError(error.message || 'Failed to start production');
        } finally {
            setLoading(false);
        }
    };

    const handleStopProduction = async () => {
        setLoading(true);
        try {
            const response = await api.stopGenerator();
            if (response.success) {
                setGeneratingProduct(null);
                setProgress(null);
                setProductionStatus('idle');
                fetchStatus();
            }
            await api.resetGeneratorStats();
            fetchStatus();
            onUpdate && onUpdate();
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResetStats = async () => {
        try {
            await api.resetGeneratorStats();
            // Clear local state immediately
            setProductionStatus('idle');
            setProgress(null);
            setGeneratingProduct(null);
            fetchStatus();
            onUpdate && onUpdate();
        } catch (error) {
            setError(error.message);
        }
    };

    // Get total breakdown for all products
    const getTotalBreakdown = () => {
        if (productionItems.length === 0) return null;

        const totals = {
            tablets: 0,
            strips: 0,
            boxes: 0,
            cartons: 0,
            shipments: 0
        };

        productionItems.forEach(item => {
            const breakdown = calculateBreakdown(item.tablets);
            if (breakdown) {
                totals.tablets += breakdown.tablets;
                totals.strips += breakdown.strips;
                totals.boxes += breakdown.boxes;
                totals.cartons += breakdown.cartons;
                totals.shipments += breakdown.shipments;
            }
        });

        return totals;
    };

    const totalBreakdown = getTotalBreakdown();

    return (
        <div className="data-generator">
            <div className="generator-header">
                <h2>Production Planning</h2>
                <p className="generator-subtitle">Plan tablet production and create shipments on blockchain</p>
            </div>

            {/* Shipment Flow Info */}
            <div className="shipment-flow-info">
                <h4>📦 Packaging Hierarchy (1 Full Shipment = {TABLETS_PER_SHIPMENT.toLocaleString()} tablets)</h4>
                <div className="flow-diagram">
                    <div className="flow-item">
                        <span className="flow-value">{TABLETS_PER_STRIP}</span>
                        <span className="flow-label">Tablets/Strip</span>
                    </div>
                    <span className="flow-arrow">→</span>
                    <div className="flow-item">
                        <span className="flow-value">{STRIPS_PER_BOX}</span>
                        <span className="flow-label">Strips/Box</span>
                    </div>
                    <span className="flow-arrow">→</span>
                    <div className="flow-item">
                        <span className="flow-value">{BOXES_PER_CARTON}</span>
                        <span className="flow-label">Boxes/Carton</span>
                    </div>
                    <span className="flow-arrow">→</span>
                    <div className="flow-item">
                        <span className="flow-value">{CARTONS_PER_SHIPMENT}</span>
                        <span className="flow-label">Cartons/Shipment</span>
                    </div>
                </div>
                <p className="flow-note">
                    <strong>Note:</strong> Minimum {MIN_TABLETS.toLocaleString()} tablets required.
                    All shipments must be complete (no partial shipments).
                    Tablet counts will be rounded up to the nearest full shipment.
                </p>
            </div>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            {/* Production Form - Show only when idle (not running or completed with visible progress) */}
            {productionStatus === 'idle' && (
                <div className="production-form">
                    <h3>Add Products for Production</h3>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Select Product</label>
                            <select
                                value={selectedProduct}
                                onChange={(e) => setSelectedProduct(e.target.value)}
                                className="form-select"
                            >
                                <option value="">-- Select Product --</option>
                                {AVAILABLE_PRODUCTS.map(product => (
                                    <option key={product} value={product}>{product}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Number of Tablets (min {MIN_TABLETS.toLocaleString()})</label>
                            <input
                                type="number"
                                value={tabletCount}
                                onChange={(e) => handleTabletCountChange(e.target.value)}
                                placeholder={`e.g., ${MIN_TABLETS.toLocaleString()}`}
                                className="form-input"
                                min={MIN_TABLETS}
                            />
                            {tabletWarning && <div className="tablet-warning">{tabletWarning}</div>}
                        </div>
                        <button
                            onClick={handleAddProduct}
                            className="btn btn-secondary"
                            disabled={!selectedProduct || !tabletCount}
                        >
                            Add Product
                        </button>
                    </div>

                    {/* Quick Add Buttons */}
                    <div className="quick-add">
                        <span className="quick-label">Quick add:</span>
                        {[2000, 4000, 10000, 20000].map(count => (
                            <button
                                key={count}
                                onClick={() => handleTabletCountChange(count.toString())}
                                className="btn btn-quick"
                            >
                                {count.toLocaleString()} ({count / TABLETS_PER_SHIPMENT} ship)
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Production Queue */}
            {productionItems.length > 0 && (
                <div className="production-queue">
                    <h3>Production Queue</h3>
                    <div className="queue-list">
                        {productionItems.map((item, index) => {
                            const breakdown = calculateBreakdown(item.tablets);
                            return (
                                <div key={index} className="queue-item">
                                    <div className="queue-item-header">
                                        <span className="product-name">{item.product}</span>
                                        <button
                                            onClick={() => handleRemoveProduct(index)}
                                            className="btn-remove"
                                        >
                                            ×
                                        </button>
                                    </div>
                                    <div className="queue-item-details">
                                        <span className="tablet-count">{item.tablets.toLocaleString()} tablets</span>
                                        {breakdown && (
                                            <div className="breakdown-preview">
                                                <span>→ {breakdown.shipments} shipments</span>
                                                <span>→ {breakdown.cartons} cartons</span>
                                                <span>→ {breakdown.boxes} boxes</span>
                                                <span>→ {breakdown.strips} strips</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Total Summary */}
                    {totalBreakdown && (
                        <div className="total-summary">
                            <h4>Total Production Summary</h4>
                            <div className="summary-grid">
                                <div className="summary-item">
                                    <span className="summary-value">{totalBreakdown.tablets.toLocaleString()}</span>
                                    <span className="summary-label">Tablets</span>
                                </div>
                                <div className="summary-item">
                                    <span className="summary-value">{totalBreakdown.strips.toLocaleString()}</span>
                                    <span className="summary-label">Strips</span>
                                </div>
                                <div className="summary-item">
                                    <span className="summary-value">{totalBreakdown.boxes.toLocaleString()}</span>
                                    <span className="summary-label">Boxes</span>
                                </div>
                                <div className="summary-item">
                                    <span className="summary-value">{totalBreakdown.cartons.toLocaleString()}</span>
                                    <span className="summary-label">Cartons</span>
                                </div>
                                <div className="summary-item highlight">
                                    <span className="summary-value">{totalBreakdown.shipments.toLocaleString()}</span>
                                    <span className="summary-label">Shipments</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="production-actions">
                        <button
                            onClick={handleStartProduction}
                            className="btn btn-primary btn-large"
                            disabled={loading}
                        >
                            {loading ? 'Starting Production...' : 'Start Production'}
                        </button>
                        <button
                            onClick={() => setProductionItems([])}
                            className="btn btn-secondary"
                            disabled={loading}
                        >
                            Clear All
                        </button>
                    </div>
                </div>
            )}

            {/* Active Production Progress - Show when running OR just completed */}
            {(productionStatus === 'running' || productionStatus === 'completed') && progress && (
                <div className={`production-progress ${productionStatus === 'completed' ? 'completed' : ''}`}>
                    <div className="progress-header">
                        <h3>{productionStatus === 'completed' ? 'Production Completed' : 'Production in Progress'}</h3>
                        <span className={`status-badge ${productionStatus}`}>
                            {productionStatus === 'completed' ? 'Completed' : 'Running'}
                        </span>
                    </div>
                    <div className="current-product">
                        <span className="label">{productionStatus === 'completed' ? 'Product:' : 'Current Product:'}</span>
                        <span className="value">{progress.currentProduct || generatingProduct}</span>
                    </div>
                    <div className="progress-bars">
                        <div className="progress-item">
                            <span className="progress-label">Strips</span>
                            <div className="progress-bar">
                                <div
                                    className={`progress-fill ${productionStatus === 'completed' ? 'completed' : ''}`}
                                    style={{ width: `${(progress.stripsCreated / progress.totalStrips) * 100}%` }}
                                />
                            </div>
                            <span className="progress-count">{progress.stripsCreated} / {progress.totalStrips}</span>
                        </div>
                        <div className="progress-item">
                            <span className="progress-label">Boxes</span>
                            <div className="progress-bar">
                                <div
                                    className={`progress-fill ${productionStatus === 'completed' ? 'completed' : ''}`}
                                    style={{ width: `${(progress.boxesCreated / progress.totalBoxes) * 100}%` }}
                                />
                            </div>
                            <span className="progress-count">{progress.boxesCreated} / {progress.totalBoxes}</span>
                        </div>
                        <div className="progress-item">
                            <span className="progress-label">Cartons</span>
                            <div className="progress-bar">
                                <div
                                    className={`progress-fill ${productionStatus === 'completed' ? 'completed' : ''}`}
                                    style={{ width: `${(progress.cartonsCreated / progress.totalCartons) * 100}%` }}
                                />
                            </div>
                            <span className="progress-count">{progress.cartonsCreated} / {progress.totalCartons}</span>
                        </div>
                        <div className="progress-item">
                            <span className="progress-label">Shipments</span>
                            <div className="progress-bar">
                                <div
                                    className={`progress-fill shipment ${productionStatus === 'completed' ? 'completed' : ''}`}
                                    style={{ width: `${(progress.shipmentsCreated / progress.totalShipments) * 100}%` }}
                                />
                            </div>
                            <span className="progress-count">{progress.shipmentsCreated} / {progress.totalShipments}</span>
                        </div>
                    </div>
                    {productionStatus === 'running' ? (
                        <button
                            onClick={handleStopProduction}
                            className="btn btn-danger"
                            disabled={loading}
                        >
                            Stop Production
                        </button>
                    ) : (
                        <button
                            onClick={handleResetStats}
                            className="btn btn-secondary"
                            disabled={loading}
                        >
                            Clear & Start New Production
                        </button>
                    )}
                </div>
            )}

            {/* Statistics */}
            {stats && (
                <div className="generator-stats">
                    <h3>Production Statistics</h3>
                    <div className="stats-grid">
                        <div className="stat-card">
                            <span className="stat-number">{stats.stripsCreated || 0}</span>
                            <span className="stat-name">Strips Created</span>
                        </div>
                        <div className="stat-card">
                            <span className="stat-number">{stats.boxesCreated || 0}</span>
                            <span className="stat-name">Boxes Created</span>
                        </div>
                        <div className="stat-card">
                            <span className="stat-number">{stats.cartonsCreated || 0}</span>
                            <span className="stat-name">Cartons Created</span>
                        </div>
                        <div className="stat-card">
                            <span className="stat-number">{stats.shipmentsCreated || 0}</span>
                            <span className="stat-name">Shipments Created</span>
                        </div>
                    </div>

                    {stats.lastActivity && (
                        <div className="last-activity">
                            Last Activity: {new Date(stats.lastActivity).toLocaleString()}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DataGenerator;
