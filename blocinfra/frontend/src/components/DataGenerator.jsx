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
const TABLETS_PER_STRIP = 10;
const STRIPS_PER_BOX = 5;
const BOXES_PER_CARTON = 10;
const CARTONS_PER_SHIPMENT = 15;

// Calculated values
const TABLETS_PER_BOX = TABLETS_PER_STRIP * STRIPS_PER_BOX; // 100
const TABLETS_PER_CARTON = TABLETS_PER_BOX * BOXES_PER_CARTON; // 1500
const TABLETS_PER_SHIPMENT = TABLETS_PER_CARTON * CARTONS_PER_SHIPMENT; // 30000

const DataGenerator = ({ onUpdate }) => {
    const [productionItems, setProductionItems] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState('');
    const [tabletCount, setTabletCount] = useState('');
    const [loading, setLoading] = useState(false);
    const [generatingProduct, setGeneratingProduct] = useState(null);
    const [progress, setProgress] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [stats, setStats] = useState(null);

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
                if (response.productionProgress) {
                    setProgress(response.productionProgress);
                    setGeneratingProduct(response.productionProgress.currentProduct);
                }
            }
        } catch (error) {
            console.error('Failed to fetch status:', error);
        }
    };

    // Calculate packaging breakdown for tablets
    const calculateBreakdown = (tablets) => {
        if (!tablets || tablets <= 0) return null;

        const fullShipments = Math.floor(tablets / TABLETS_PER_SHIPMENT);
        let remaining = tablets % TABLETS_PER_SHIPMENT;

        const fullCartons = Math.floor(remaining / TABLETS_PER_CARTON);
        remaining = remaining % TABLETS_PER_CARTON;

        const fullBoxes = Math.floor(remaining / TABLETS_PER_BOX);
        remaining = remaining % TABLETS_PER_BOX;

        const fullStrips = Math.floor(remaining / TABLETS_PER_STRIP);
        const leftoverTablets = remaining % TABLETS_PER_STRIP;

        // Total items to be created
        const totalStrips = Math.ceil(tablets / TABLETS_PER_STRIP);
        const totalBoxes = Math.ceil(totalStrips / STRIPS_PER_BOX);
        const totalCartons = Math.ceil(totalBoxes / BOXES_PER_CARTON);
        const totalShipments = Math.ceil(totalCartons / CARTONS_PER_SHIPMENT);

        return {
            tablets,
            shipments: totalShipments,
            cartons: totalCartons,
            boxes: totalBoxes,
            strips: totalStrips,
            leftoverTablets,
            breakdown: {
                fullShipments,
                fullCartons,
                fullBoxes,
                fullStrips
            }
        };
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

        // Check if product already exists
        const existingIndex = productionItems.findIndex(item => item.product === selectedProduct);
        if (existingIndex >= 0) {
            // Update existing
            const updated = [...productionItems];
            updated[existingIndex].tablets = parseInt(tabletCount);
            setProductionItems(updated);
        } else {
            // Add new
            setProductionItems([...productionItems, {
                product: selectedProduct,
                tablets: parseInt(tabletCount)
            }]);
        }

        setSelectedProduct('');
        setTabletCount('');
        setError('');
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
                fetchStatus();
            }
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResetStats = async () => {
        try {
            await api.resetGeneratorStats();
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


            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            {/* Production Form */}
            {!generatingProduct && (
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
                            <label>Number of Tablets</label>
                            <input
                                type="number"
                                value={tabletCount}
                                onChange={(e) => setTabletCount(e.target.value)}
                                placeholder="e.g., 30000"
                                className="form-input"
                                min="1"
                            />
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
                        {[30000, 60000, 90000, 150000].map(count => (
                            <button
                                key={count}
                                onClick={() => setTabletCount(count.toString())}
                                className="btn btn-quick"
                            >
                                {(count / 1000)}K
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

            {/* Active Production Progress */}
            {generatingProduct && progress && (
                <div className="production-progress">
                    <div className="progress-header">
                        <h3>Production in Progress</h3>
                        <span className={`status-badge running`}>Running</span>
                    </div>
                    <div className="current-product">
                        <span className="label">Current Product:</span>
                        <span className="value">{generatingProduct}</span>
                    </div>
                    <div className="progress-bars">
                        <div className="progress-item">
                            <span className="progress-label">Strips</span>
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${(progress.stripsCreated / progress.totalStrips) * 100}%` }}
                                />
                            </div>
                            <span className="progress-count">{progress.stripsCreated} / {progress.totalStrips}</span>
                        </div>
                        <div className="progress-item">
                            <span className="progress-label">Boxes</span>
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${(progress.boxesCreated / progress.totalBoxes) * 100}%` }}
                                />
                            </div>
                            <span className="progress-count">{progress.boxesCreated} / {progress.totalBoxes}</span>
                        </div>
                        <div className="progress-item">
                            <span className="progress-label">Cartons</span>
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${(progress.cartonsCreated / progress.totalCartons) * 100}%` }}
                                />
                            </div>
                            <span className="progress-count">{progress.cartonsCreated} / {progress.totalCartons}</span>
                        </div>
                        <div className="progress-item">
                            <span className="progress-label">Shipments</span>
                            <div className="progress-bar">
                                <div
                                    className="progress-fill shipment"
                                    style={{ width: `${(progress.shipmentsCreated / progress.totalShipments) * 100}%` }}
                                />
                            </div>
                            <span className="progress-count">{progress.shipmentsCreated} / {progress.totalShipments}</span>
                        </div>
                    </div>
                    <button
                        onClick={handleStopProduction}
                        className="btn btn-danger"
                        disabled={loading}
                    >
                        Stop Production
                    </button>
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

                    <button
                        onClick={handleResetStats}
                        className="btn btn-secondary btn-small"
                        disabled={generatingProduct}
                    >
                        Reset Statistics
                    </button>
                </div>
            )}
        </div>
    );
};

export default DataGenerator;
