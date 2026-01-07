import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../services/api';

const ManufacturerDashboard = ({ stats: parentStats }) => {
    const [selectedType, setSelectedType] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [stats, setStats] = useState(parentStats || {});
    const [expandedItem, setExpandedItem] = useState(null);
    const [qrModalItem, setQrModalItem] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const ITEMS_PER_PAGE = 20;

    // Update stats when parent stats change - but don't cause full re-render
    useEffect(() => {
        if (parentStats) {
            setStats(prev => {
                // Only update if values actually changed
                if (JSON.stringify(prev) !== JSON.stringify(parentStats)) {
                    return parentStats;
                }
                return prev;
            });
        }
    }, [parentStats]);

    // Item categories - memoized to prevent re-creation
    const categories = useMemo(() => [
        { type: 'strip', label: 'Strips', emoji: '💊', color: '#dc2626', bgGradient: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' },
        { type: 'box', label: 'Boxes', emoji: '📦', color: '#2563eb', bgGradient: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' },
        { type: 'carton', label: 'Cartons', emoji: '🗃️', color: '#d97706', bgGradient: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' },
        { type: 'shipment', label: 'Shipments', emoji: '🚚', color: '#059669', bgGradient: 'linear-gradient(135deg, #059669 0%, #047857 100%)' },
        { type: 'order', label: 'Orders', emoji: '📋', color: '#7c3aed', bgGradient: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)' }
    ], []);

    const loadItems = useCallback(async (type, page = 1) => {
        setLoading(true);
        setError('');
        try {
            const response = await api.getItemsPaginated(type, page, ITEMS_PER_PAGE);
            if (response.success) {
                setItems(response.data || []);
                setTotalPages(response.totalPages || 1);
                setTotalCount(response.totalCount || 0);
                setCurrentPage(page);
            } else {
                setError(response.message || 'Failed to load items');
                setItems([]);
            }
        } catch (err) {
            console.error('Failed to load items:', err);
            setError('Failed to load items. Please try again.');
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleCategoryClick = useCallback((type) => {
        if (selectedType === type) {
            setSelectedType(null);
            setItems([]);
            setError('');
            setCurrentPage(1);
            setTotalPages(1);
            setTotalCount(0);
        } else {
            setSelectedType(type);
            loadItems(type, 1);
        }
    }, [selectedType, loadItems]);

    const handlePageChange = useCallback((newPage) => {
        if (newPage >= 1 && newPage <= totalPages && selectedType) {
            loadItems(selectedType, newPage);
        }
    }, [totalPages, selectedType, loadItems]);

    const getTraceUrl = useCallback((item) => {
        const txHash = item?.creationTxId || item?.txHash;
        const baseUrl = window.location.origin;
        return `${baseUrl}/trace/${txHash || item?.id || 'unknown'}`;
    }, []);

    const formatDate = useCallback((date) => {
        if (!date || date === '0001-01-01T00:00:00Z') return 'N/A';
        try {
            return new Date(date).toLocaleString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch {
            return 'N/A';
        }
    }, []);

    const formatTxHash = useCallback((hash) => {
        if (!hash) return 'N/A';
        if (hash.length < 18) return hash;
        return `${hash.substring(0, 10)}...${hash.substring(hash.length - 8)}`;
    }, []);

    const copyToClipboard = useCallback((text) => {
        if (text) navigator.clipboard.writeText(text);
    }, []);

    const handleExpandItem = useCallback((itemId) => {
        setExpandedItem(prev => prev === itemId ? null : itemId);
    }, []);

    const handleShowQrModal = useCallback((item, e) => {
        e.stopPropagation();
        setQrModalItem(item);
    }, []);

    const handleCloseQrModal = useCallback(() => {
        setQrModalItem(null);
    }, []);

    const downloadQR = useCallback((item) => {
        const svg = document.getElementById(`qr-${item?.id}`);
        if (!svg) return;

        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            canvas.width = 300;
            canvas.height = 300;
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, 300, 300);

            const link = document.createElement('a');
            link.download = `QR-${item?.id || 'item'}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        };

        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    }, []);

    const getCategoryCount = useCallback((type) => {
        switch (type) {
            case 'strip': return stats.strips || 0;
            case 'box': return stats.boxes || 0;
            case 'carton': return stats.cartons || 0;
            case 'shipment': return stats.shipments || 0;
            case 'order': return stats.orders || 0;
            default: return 0;
        }
    }, [stats]);


    // ==================== QR Modal - Memoized ====================
    const QRModal = memo(({ item, onClose }) => {
        if (!item) return null;
        const url = getTraceUrl(item);

        const handleDownload = () => {
            const svg = document.getElementById(`qr-modal-${item.id}`);
            if (!svg) return;
            const svgData = new XMLSerializer().serializeToString(svg);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                canvas.width = 300;
                canvas.height = 300;
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, 300, 300);
                const link = document.createElement('a');
                link.download = `QR-${item.id}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            };
            img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
        };

        return (
            <div className="qr-modal-overlay" onClick={onClose}>
                <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="qr-modal-header">
                        <h3>QR Code</h3>
                        <button className="qr-modal-close" onClick={onClose}>×</button>
                    </div>
                    <div className="qr-modal-body">
                        <div className="qr-large">
                            <QRCodeSVG
                                id={`qr-modal-${item.id}`}
                                value={url}
                                size={250}
                                level="H"
                                includeMargin={true}
                            />
                        </div>
                        <div className="qr-info">
                            <p className="qr-item-id">{item.id}</p>
                            <p className="qr-url">{url}</p>
                        </div>
                        <div className="qr-actions">
                            <button onClick={() => copyToClipboard(url)} className="qr-action-btn">
                                Copy URL
                            </button>
                            <button onClick={handleDownload} className="qr-action-btn primary">
                                Download QR
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    });

    // ==================== Item Card - Memoized ====================
    const ItemCard = memo(({ item, category, isExpanded, onToggle, onShowQr }) => {
        if (!item || !category) return null;

        const itemId = item.id || item.Id || 'Unknown';
        const status = item.status || item.Status || 'CREATED';
        const createdAt = item.createdAt || item.CreatedAt || '';

        const getUrl = () => {
            const txHash = item.creationTxId || item.txHash || item.CreationTxId;
            const baseUrl = window.location.origin;
            return `${baseUrl}/trace/${txHash || itemId}`;
        };

        return (
            <div className={`mfg-item-card ${isExpanded ? 'expanded' : ''}`}>
                <div
                    className="item-card-row"
                    onClick={() => onToggle(item.id)}
                >
                    <div className="item-main-info">
                        <span className="item-emoji">{category.emoji}</span>
                        <div className="item-text">
                            <span className="item-id-text">{itemId}</span>
                            <span className="item-date">{formatDate(createdAt)}</span>
                        </div>
                    </div>
                    <div className="item-quick-actions">
                        <span className={`item-status status-${status.toLowerCase().replace(/\s+/g, '-')}`}>
                            {status}
                        </span>
                        <button
                            className="qr-btn-small"
                            onClick={(e) => onShowQr(item, e)}
                            title="View QR Code"
                        >
                            QR
                        </button>
                        <span className="expand-arrow">{isExpanded ? '▼' : '▶'}</span>
                    </div>
                </div>

                <div className={`item-expanded-wrapper ${isExpanded ? 'open' : ''}`}>
                    <div className="item-expanded-content">
                        <div className="item-details-grid">
                            <div className="detail-group">
                                <label>Transaction Hash</label>
                                <div className="tx-hash-row">
                                    <code>{formatTxHash(item.creationTxId)}</code>
                                    <button
                                        className="copy-btn-inline"
                                        onClick={() => copyToClipboard(item.creationTxId)}
                                    >
                                        📋
                                    </button>
                                </div>
                            </div>
                            {item.medicineType && (
                                <div className="detail-group">
                                    <label>Product</label>
                                    <span>{item.medicineType}</span>
                                </div>
                            )}
                            {item.batchNumber && (
                                <div className="detail-group">
                                    <label>Batch Number</label>
                                    <span>{item.batchNumber}</span>
                                </div>
                            )}
                            {item.mfgDate && (
                                <div className="detail-group">
                                    <label>Mfg Date</label>
                                    <span>{item.mfgDate}</span>
                                </div>
                            )}
                            {item.expDate && (
                                <div className="detail-group">
                                    <label>Exp Date</label>
                                    <span>{item.expDate}</span>
                                </div>
                            )}
                            {item.strips && item.strips.length > 0 && (
                                <div className="detail-group">
                                    <label>Contents</label>
                                    <span>{item.strips.length} Strips</span>
                                </div>
                            )}
                            {item.boxes && item.boxes.length > 0 && (
                                <div className="detail-group">
                                    <label>Contents</label>
                                    <span>{item.boxes.length} Boxes</span>
                                </div>
                            )}
                            {item.cartons && item.cartons.length > 0 && (
                                <div className="detail-group">
                                    <label>Contents</label>
                                    <span>{item.cartons.length} Cartons</span>
                                </div>
                            )}
                            {item.itemIds && item.itemIds.length > 0 && (
                                <div className="detail-group">
                                    <label>Contents</label>
                                    <span>{item.itemIds.length} Shipments</span>
                                </div>
                            )}
                            {item.recipient && (
                                <div className="detail-group">
                                    <label>Recipient</label>
                                    <span>{item.recipient}</span>
                                </div>
                            )}
                        </div>

                        <div className="item-qr-section">
                            <div className="qr-container">
                                <QRCodeSVG
                                    id={`qr-${item.id}`}
                                    value={getUrl()}
                                    size={120}
                                    level="H"
                                    includeMargin={true}
                                />
                            </div>
                            <div className="qr-actions-inline">
                                <button onClick={(e) => onShowQr(item, e)} className="btn-view-qr">
                                    View Large
                                </button>
                                <button onClick={() => downloadQR(item)} className="btn-download-qr">
                                    Download
                                </button>
                                <button onClick={() => copyToClipboard(getUrl())} className="btn-copy-url">
                                    Copy URL
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    });

    // ==================== Pagination Controls ====================
    const PaginationControls = memo(({ currentPage, totalPages, totalCount, onPageChange, loading }) => {
        if (totalPages <= 1) return null;

        return (
            <div className="pagination-controls">
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1 || loading}
                    className="pagination-btn"
                >
                    Previous
                </button>
                <span className="pagination-info">
                    Page {currentPage} of {totalPages} ({totalCount} total)
                </span>
                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages || loading}
                    className="pagination-btn"
                >
                    Next
                </button>
            </div>
        );
    });

    // ==================== MAIN RENDER ====================
    const selectedCategory = useMemo(() =>
        categories.find(c => c.type === selectedType),
        [categories, selectedType]
    );

    return (
        <div className="manufacturer-dashboard">
            <div className="mfg-header">
                <h2>Manufacturer Dashboard</h2>
                <p>View all generated items, QR codes, and transaction details</p>
            </div>

            {/* Category Cards */}
            <div className="category-grid">
                {categories.map((cat) => (
                    <div
                        key={cat.type}
                        className={`category-card ${selectedType === cat.type ? 'selected' : ''}`}
                        style={{
                            background: selectedType === cat.type ? cat.bgGradient : undefined,
                            borderColor: cat.color
                        }}
                        onClick={() => handleCategoryClick(cat.type)}
                    >
                        <span className="category-emoji">{cat.emoji}</span>
                        <div className="category-info">
                            <span className="category-count">{getCategoryCount(cat.type)}</span>
                            <span className="category-label">{cat.label}</span>
                        </div>
                        <span className="category-arrow">{selectedType === cat.type ? '▼' : '▶'}</span>
                    </div>
                ))}
            </div>

            {/* Items List */}
            {selectedType && (
                <div className="items-section">
                    <div className="items-header">
                        <h3>
                            {selectedCategory?.emoji} {selectedCategory?.label}
                        </h3>
                        <span className="items-count">{items.length} items</span>
                    </div>

                    {loading ? (
                        <div className="items-loading">
                            <div className="loading-spinner"></div>
                            <p>Loading items...</p>
                        </div>
                    ) : error ? (
                        <div className="items-error">
                            <span>⚠️</span>
                            <p>{error}</p>
                            <button onClick={() => loadItems(selectedType, currentPage)} className="retry-btn">
                                Retry
                            </button>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="items-empty">
                            <span>📭</span>
                            <p>No {selectedCategory?.label.toLowerCase()} found</p>
                        </div>
                    ) : (
                        <>
                            <PaginationControls
                                currentPage={currentPage}
                                totalPages={totalPages}
                                totalCount={totalCount}
                                onPageChange={handlePageChange}
                                loading={loading}
                            />
                            <div className="items-list">
                                {items.map((item) => (
                                    <ItemCard
                                        key={item.id || item._id}
                                        item={item}
                                        category={selectedCategory}
                                        isExpanded={expandedItem === item.id}
                                        onToggle={handleExpandItem}
                                        onShowQr={handleShowQrModal}
                                    />
                                ))}
                            </div>
                            <PaginationControls
                                currentPage={currentPage}
                                totalPages={totalPages}
                                totalCount={totalCount}
                                onPageChange={handlePageChange}
                                loading={loading}
                            />
                        </>
                    )}
                </div>
            )}

            {/* QR Modal */}
            {qrModalItem && (
                <QRModal item={qrModalItem} onClose={handleCloseQrModal} />
            )}
        </div>
    );
};

export default memo(ManufacturerDashboard);
