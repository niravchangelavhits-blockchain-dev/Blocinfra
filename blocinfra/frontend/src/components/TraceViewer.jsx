import React, { useState, useCallback, useMemo, memo } from 'react';
import api from '../services/api';

const TraceViewer = () => {
    const [searchId, setSearchId] = useState('');
    const [traceResult, setTraceResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [expandedNodes, setExpandedNodes] = useState({});
    const [layoutMode, setLayoutMode] = useState('row');

    // Item type configurations - memoized
    const itemConfig = useMemo(() => ({
        strip: { emoji: '💊', color: '#dc2626', bgColor: '#fef2f2', label: 'Strip' },
        box: { emoji: '📦', color: '#2563eb', bgColor: '#eff6ff', label: 'Box' },
        carton: { emoji: '🗃️', color: '#d97706', bgColor: '#fffbeb', label: 'Carton' },
        shipment: { emoji: '🚚', color: '#059669', bgColor: '#ecfdf5', label: 'Shipment' },
        order: { emoji: '📋', color: '#7c3aed', bgColor: '#f5f3ff', label: 'Order' }
    }), []);

    const getConfig = useCallback((type) =>
        itemConfig[type?.toLowerCase()] || { emoji: '📄', color: '#64748b', bgColor: '#f8fafc', label: type || 'Item' },
        [itemConfig]
    );

    const handleSearch = useCallback(async (e) => {
        e.preventDefault();
        if (!searchId.trim()) return;
        setLoading(true);
        setError('');
        setTraceResult(null);
        try {
            const response = await api.traceByHashOrId(searchId.trim());
            if (response.success) {
                setTraceResult(response.data);
                setExpandedNodes({});
            } else {
                setError(response.message || 'Item not found');
            }
        } catch (err) {
            setError(err.message || 'Failed to trace item');
        } finally {
            setLoading(false);
        }
    }, [searchId]);

    const toggleNode = useCallback((nodeId) => {
        setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
    }, []);

    const isExpanded = useCallback((nodeId) => expandedNodes[nodeId] ?? false, [expandedNodes]);

    const copyToClipboard = useCallback((text) => {
        navigator.clipboard.writeText(text);
    }, []);

    const formatDate = useCallback((date) => {
        if (!date) return 'N/A';
        return new Date(date).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }, []);

    const formatTxHash = useCallback((hash) => hash ? `${hash.substring(0, 8)}...${hash.substring(hash.length - 6)}` : 'N/A', []);

    const formatStatus = useCallback((status) => {
        if (status === null || status === undefined || status === '') return null;
        const statusStr = String(status).trim();
        if (statusStr === '0' || statusStr === 0) return { text: 'CREATED', class: 'created' };
        if (statusStr === '1' || statusStr === 1) return { text: 'SEALED', class: 'sealed' };
        if (statusStr === '2' || statusStr === 2) return { text: 'SHIPPED', class: 'shipped' };
        const upperStatus = statusStr.toUpperCase();
        if (upperStatus === 'CREATED') return { text: 'CREATED', class: 'created' };
        if (upperStatus === 'SEALED') return { text: 'SEALED', class: 'sealed' };
        if (upperStatus === 'SHIPPED') return { text: 'SHIPPED', class: 'shipped' };
        return { text: statusStr, class: statusStr.toLowerCase().replace(/\s+/g, '-') };
    }, []);

    // ==================== COLUMN 1: ITEM DETAILS ====================
    const ItemDetailsColumn = memo(({ item, searchedTransaction, searchType }) => {
        if (!item) return null;
        const config = getConfig(item.itemType);
        const data = item.current || {};
        const history = item.history || [];

        const displayTxId = data.creationTxId
            || (searchType === 'txHash' && searchedTransaction?.txId ? searchedTransaction.txId : null)
            || (history.length > 0 ? history[0].txId : null);

        const getContentsLabel = () => {
            if (data.strips) return `${data.strips.length} Strips`;
            if (data.boxes) return `${data.boxes.length} Boxes`;
            if (data.cartons) return `${data.cartons.length} Cartons`;
            return null;
        };

        return (
            <div className="trace-column details-column">
                <div className="column-header" style={{ background: config.color }}>
                    <span className="column-icon">{config.emoji}</span>
                    <span className="column-title">{config.label} Details</span>
                    <span className="column-subtitle">Transaction History</span>
                </div>

                <div className="column-body">
                    <div className="item-info-card">
                        <div className="info-row">
                            <span className="info-label">TX Hash:</span>
                            <span className="info-value tx-hash">
                                {displayTxId ? formatTxHash(displayTxId) : 'N/A'}
                                {displayTxId && (
                                    <button className="copy-btn" onClick={() => copyToClipboard(displayTxId)}>📋</button>
                                )}
                            </span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">{config.label} ID:</span>
                            <span className="info-value highlight">{item.itemId}</span>
                        </div>
                        {data.medicineType && (
                            <div className="info-row">
                                <span className="info-label">Product:</span>
                                <span className="info-value">{data.medicineType}</span>
                            </div>
                        )}
                        {getContentsLabel() && (
                            <div className="info-row">
                                <span className="info-label">Contents:</span>
                                <span className="info-value">{getContentsLabel()}</span>
                            </div>
                        )}
                        {data.batchNumber && (
                            <div className="info-row">
                                <span className="info-label">Batch:</span>
                                <span className="info-value">{data.batchNumber}</span>
                            </div>
                        )}
                        {data.mfgDate && (
                            <div className="info-row">
                                <span className="info-label">Mfg Date:</span>
                                <span className="info-value">{data.mfgDate}</span>
                            </div>
                        )}
                        {data.expDate && (
                            <div className="info-row">
                                <span className="info-label">Exp Date:</span>
                                <span className="info-value">{data.expDate}</span>
                            </div>
                        )}
                        {(() => {
                            const statusInfo = data.status !== undefined && data.status !== null ? formatStatus(data.status) : null;
                            return statusInfo ? (
                                <div className="info-row">
                                    <span className="info-label">Status:</span>
                                    <span className={`info-value status-badge status-${statusInfo.class}`}>{statusInfo.text}</span>
                                </div>
                            ) : null;
                        })()}
                        {item.itemType?.toLowerCase() === 'order' && (
                            <>
                                {data.senderId && (
                                    <div className="info-row">
                                        <span className="info-label">Sender:</span>
                                        <span className="info-value">
                                            {data.senderId}
                                            {data.senderOrg && ` (${data.senderOrg})`}
                                        </span>
                                    </div>
                                )}
                                {data.receiverId && (
                                    <div className="info-row">
                                        <span className="info-label">Receiver:</span>
                                        <span className="info-value">
                                            {data.receiverId}
                                            {data.receiverOrg && ` (${data.receiverOrg})`}
                                        </span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {history.length > 0 && (
                        <div className="history-table-container">
                            <table className="history-table">
                                <thead>
                                    <tr>
                                        <th>Event</th>
                                        <th>Timestamp</th>
                                        <th>Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map((tx, index) => {
                                        const status = tx.value?.status || 'Updated';
                                        let event = status;
                                        if (status === 'CREATED') event = 'Manufactured';
                                        else if (status === 'SEALED' && item.itemType === 'strip') event = 'Packed';
                                        else if (status === 'SEALED') event = 'Sealed';
                                        else if (status === 'SHIPPED') event = 'Shipped';

                                        return (
                                            <tr key={tx.txId || index}>
                                                <td>{event}</td>
                                                <td>{formatDate(tx.timestamp)}</td>
                                                <td className="details-cell">
                                                    {tx.value?.boxId && tx.value.boxId !== '' && `Packed into ${tx.value.boxId}`}
                                                    {tx.value?.cartonId && tx.value.cartonId !== '' && !tx.value?.boxId && `Packed into ${tx.value.cartonId}`}
                                                    {tx.value?.shipmentId && tx.value.shipmentId !== '' && !tx.value?.cartonId && `Added to ${tx.value.shipmentId}`}
                                                    {tx.value?.distributor && `Shipped to ${tx.value.distributor}`}
                                                    {!tx.value?.boxId && !tx.value?.cartonId && !tx.value?.shipmentId && !tx.value?.distributor && status === 'CREATED' && 'Created in system'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        );
    });

    // ==================== COLUMN 2: PARENT HIERARCHY ====================
    const ParentHierarchyColumn = memo(({ parents }) => {
        const parentList = parents || [];

        const ParentNode = memo(({ parent, index, isLast }) => {
            const config = getConfig(parent.itemType);
            const data = parent.current || {};
            const history = parent.history || [];
            const nodeId = `parent-${parent.itemId}`;
            const expanded = isExpanded(nodeId);

            const getContentsLabel = () => {
                if (data.strips) return `Contains: ${data.strips.length} Strips`;
                if (data.boxes) return `Contains: ${data.boxes.length} Boxes`;
                if (data.cartons) return `Contains: ${data.cartons.length} Cartons`;
                return null;
            };

            return (
                <div className="tree-node-wrapper">
                    {!isLast && <div className="tree-vertical-line"></div>}

                    <div className="tree-node-row">
                        <div className="tree-line-container">
                            <div className="tree-horizontal-line" style={{ borderColor: config.color }}></div>
                            <div className="tree-dot" style={{ backgroundColor: config.color }}></div>
                        </div>

                        <div
                            className={`tree-card ${expanded ? 'expanded' : ''}`}
                            style={{ borderLeftColor: config.color }}
                            onClick={() => toggleNode(nodeId)}
                        >
                            <div className="tree-card-header">
                                <span className="tree-card-icon">{config.emoji}</span>
                                <span className="tree-card-label" style={{ color: config.color }}>{config.label}</span>
                                <span className="tree-card-id">{parent.itemId.split('-').slice(-2).join('-')}</span>
                                <span className="tree-card-arrow">{expanded ? '▼' : '▶'}</span>
                            </div>

                            <div className={`tree-card-body-wrapper ${expanded ? 'open' : ''}`}>
                                <div className="tree-card-body">
                                    <div className="detail-row">
                                        <span className="detail-key">Full ID:</span>
                                        <span className="detail-val">{parent.itemId}</span>
                                    </div>
                                    {getContentsLabel() && (
                                        <div className="detail-row highlight">
                                            <span className="detail-val">{getContentsLabel()}</span>
                                        </div>
                                    )}
                                    {data.distributor && (
                                        <div className="detail-row">
                                            <span className="detail-key">Distributor:</span>
                                            <span className="detail-val">{data.distributor}</span>
                                        </div>
                                    )}
                                    {(() => {
                                        const statusInfo = data.status !== undefined && data.status !== null ? formatStatus(data.status) : null;
                                        return statusInfo ? (
                                            <div className="detail-row">
                                                <span className="detail-key">Status:</span>
                                                <span className={`detail-val status-badge status-${statusInfo.class}`}>{statusInfo.text}</span>
                                            </div>
                                        ) : null;
                                    })()}
                                    {parent.itemType?.toLowerCase() === 'order' && (
                                        <>
                                            {data.senderId && (
                                                <div className="detail-row">
                                                    <span className="detail-key">Sender:</span>
                                                    <span className="detail-val">
                                                        {data.senderId}
                                                        {data.senderOrg && ` (${data.senderOrg})`}
                                                    </span>
                                                </div>
                                            )}
                                            {data.receiverId && (
                                                <div className="detail-row">
                                                    <span className="detail-key">Receiver:</span>
                                                    <span className="detail-val">
                                                        {data.receiverId}
                                                        {data.receiverOrg && ` (${data.receiverOrg})`}
                                                    </span>
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {data.creationTxId && (
                                        <div className="detail-row">
                                            <span className="detail-key">TX Hash:</span>
                                            <span className="detail-val tx-hash-small">
                                                {formatTxHash(data.creationTxId)}
                                                <button className="copy-btn-small" onClick={(e) => { e.stopPropagation(); copyToClipboard(data.creationTxId); }}>📋</button>
                                            </span>
                                        </div>
                                    )}
                                    {history.length > 0 && (
                                        <div className="detail-row">
                                            <span className="detail-key">Transactions:</span>
                                            <span className="detail-val">{history.length}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        });

        return (
            <div className="trace-column hierarchy-column">
                <div className="column-header hierarchy-header">
                    <span className="column-icon">🔗</span>
                    <span className="column-title">Parent Hierarchy</span>
                </div>

                <div className="column-body">
                    {parentList.length > 0 ? (
                        <div className="parent-tree-container">
                            {parentList.map((parent, index) => (
                                <ParentNode
                                    key={parent.itemId}
                                    parent={parent}
                                    index={index}
                                    isLast={index === parentList.length - 1}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="empty-tree">
                            <span className="empty-icon">👑</span>
                            <p className="empty-title">Root Level</p>
                            <p className="empty-subtitle">This is the top-level item</p>
                        </div>
                    )}
                </div>
            </div>
        );
    });

    // ==================== COLUMN 3: CHILD ITEMS (NESTED TREE) ====================
    const ChildItemsColumn = memo(({ children, parentType, allChildrenMap, topLevelChildIds, searchedItem }) => {
        const childList = children || [];

        const NestedTreeNode = memo(({ item, depth = 0, isLast = false }) => {
            const config = getConfig(item.itemType);
            const data = item.current || {};
            const nodeId = `child-${item.itemId}`;
            const expanded = isExpanded(nodeId);

            const findChildrenByIds = (childIds, childType) => {
                if (!childIds || !Array.isArray(childIds) || !allChildrenMap) return [];
                return childIds
                    .map(id => allChildrenMap[id])
                    .filter(childItem => childItem && childItem.itemType === childType);
            };

            const nestedChildren = useMemo(() => {
                const children = [];
                if (data.strips && Array.isArray(data.strips)) {
                    children.push(...findChildrenByIds(data.strips, 'strip'));
                }
                if (data.boxes && Array.isArray(data.boxes)) {
                    children.push(...findChildrenByIds(data.boxes, 'box'));
                }
                if (data.cartons && Array.isArray(data.cartons)) {
                    children.push(...findChildrenByIds(data.cartons, 'carton'));
                }
                if (data.shipments && Array.isArray(data.shipments)) {
                    children.push(...findChildrenByIds(data.shipments, 'shipment'));
                }
                if (data.itemIds && Array.isArray(data.itemIds)) {
                    const orderChildren = data.itemIds
                        .map(id => allChildrenMap[id])
                        .filter(childItem => childItem);
                    children.push(...orderChildren);
                }
                if (item.children && Array.isArray(item.children) && item.children.length > 0) {
                    children.push(...item.children);
                }
                return children;
            }, [data, allChildrenMap, item.children]);

            const hasChildren = nestedChildren.length > 0;

            const getContentsLabel = () => {
                if (data.strips) return `${data.strips.length} Strips`;
                if (data.boxes) return `${data.boxes.length} Boxes`;
                if (data.cartons) return `${data.cartons.length} Cartons`;
                if (data.itemIds) return `${data.itemIds.length} Shipments`;
                return null;
            };

            return (
                <div className="nested-tree-node" style={{ marginLeft: depth > 0 ? '24px' : '0' }}>
                    <div className="node-container">
                        {depth > 0 && (
                            <div className="vertical-guide-line" style={{
                                height: isLast ? '20px' : '100%',
                                borderColor: config.color + '40'
                            }}></div>
                        )}

                        <div className="node-row">
                            {depth > 0 && (
                                <div className="horizontal-guide-line" style={{ borderColor: config.color + '40' }}></div>
                            )}
                            <div className="node-dot" style={{ backgroundColor: config.color }}></div>

                            <div
                                className={`nested-node-card ${expanded ? 'expanded' : ''}`}
                                style={{ borderLeftColor: config.color }}
                                onClick={() => toggleNode(nodeId)}
                            >
                                <div className="node-card-header">
                                    <span className="node-icon">{config.emoji}</span>
                                    <span className="node-type" style={{ color: config.color }}>{config.label}</span>
                                    <span className="node-id-short">{item.itemId.split('-').slice(-2).join('-')}</span>
                                    {hasChildren && (
                                        <span className="node-badge">{getContentsLabel()}</span>
                                    )}
                                    <span className="node-arrow">{hasChildren || true ? (expanded ? '▼' : '▶') : ''}</span>
                                </div>

                                <div className={`node-card-body-wrapper ${expanded ? 'open' : ''}`}>
                                    <div className="node-card-body">
                                        <div className="node-detail-row">
                                            <span className="node-detail-label">Full ID:</span>
                                            <span className="node-detail-value">{item.itemId}</span>
                                        </div>
                                        {data.medicineType && (
                                            <div className="node-detail-row">
                                                <span className="node-detail-label">Product:</span>
                                                <span className="node-detail-value">{data.medicineType}</span>
                                            </div>
                                        )}
                                        {data.batchNumber && (
                                            <div className="node-detail-row">
                                                <span className="node-detail-label">Batch:</span>
                                                <span className="node-detail-value">{data.batchNumber}</span>
                                            </div>
                                        )}
                                        {data.mfgDate && (
                                            <div className="node-detail-row">
                                                <span className="node-detail-label">Mfg Date:</span>
                                                <span className="node-detail-value">{data.mfgDate}</span>
                                            </div>
                                        )}
                                        {data.expDate && (
                                            <div className="node-detail-row">
                                                <span className="node-detail-label">Exp Date:</span>
                                                <span className="node-detail-value">{data.expDate}</span>
                                            </div>
                                        )}
                                        {data.distributor && (
                                            <div className="node-detail-row">
                                                <span className="node-detail-label">Distributor:</span>
                                                <span className="node-detail-value">{data.distributor}</span>
                                            </div>
                                        )}
                                        {(() => {
                                            const statusInfo = data.status !== undefined && data.status !== null ? formatStatus(data.status) : null;
                                            return statusInfo ? (
                                                <div className="node-detail-row">
                                                    <span className="node-detail-label">Status:</span>
                                                    <span className={`node-detail-value status-badge status-${statusInfo.class}`}>{statusInfo.text}</span>
                                                </div>
                                            ) : null;
                                        })()}
                                        {item.itemType?.toLowerCase() === 'order' && (
                                            <>
                                                {data.senderId && (
                                                    <div className="node-detail-row">
                                                        <span className="node-detail-label">Sender:</span>
                                                        <span className="node-detail-value">
                                                            {data.senderId}
                                                            {data.senderOrg && ` (${data.senderOrg})`}
                                                        </span>
                                                    </div>
                                                )}
                                                {data.receiverId && (
                                                    <div className="node-detail-row">
                                                        <span className="node-detail-label">Receiver:</span>
                                                        <span className="node-detail-value">
                                                            {data.receiverId}
                                                            {data.receiverOrg && ` (${data.receiverOrg})`}
                                                        </span>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        {data.creationTxId && (
                                            <div className="node-detail-row">
                                                <span className="node-detail-label">TX Hash:</span>
                                                <span className="node-detail-value tx-hash-small">
                                                    {formatTxHash(data.creationTxId)}
                                                    <button className="copy-btn-small" onClick={(e) => { e.stopPropagation(); copyToClipboard(data.creationTxId); }}>📋</button>
                                                </span>
                                            </div>
                                        )}
                                        {item.history && item.history.length > 0 && (
                                            <div className="node-detail-row">
                                                <span className="node-detail-label">Transactions:</span>
                                                <span className="node-detail-value">{item.history.length}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {expanded && hasChildren && (
                        <div className="nested-children">
                            {nestedChildren.map((child, idx) => (
                                <NestedTreeNode
                                    key={child.itemId}
                                    item={child}
                                    depth={depth + 1}
                                    isLast={idx === nestedChildren.length - 1}
                                />
                            ))}
                        </div>
                    )}
                </div>
            );
        });

        const getChildTypeLabel = () => {
            if (childList.length === 0) return '';
            const types = [...new Set(childList.map(c => c.itemType))];
            return types.map(t => `${getConfig(t).label}s`).join(' & ');
        };

        return (
            <div className="trace-column children-column">
                <div className="column-header children-header">
                    <span className="column-icon">📋</span>
                    <span className="column-title">Child Items</span>
                    {childList.length > 0 && <span className="column-badge">{childList.length} {getChildTypeLabel()}</span>}
                </div>

                <div className="column-body">
                    {searchedItem ? (
                        <div className="nested-tree-container">
                            <NestedTreeNode item={searchedItem} depth={0} isLast={false} />
                        </div>
                    ) : childList.length > 0 ? (
                        <div className="nested-tree-container">
                            {childList
                                .filter(child => !topLevelChildIds || topLevelChildIds.has(child.itemId))
                                .map((child, idx, filteredList) => (
                                    <NestedTreeNode
                                        key={child.itemId}
                                        item={child}
                                        depth={0}
                                        isLast={idx === filteredList.length - 1}
                                    />
                                ))}
                        </div>
                    ) : (
                        <div className="empty-tree">
                            <span className="empty-icon">🍃</span>
                            <p className="empty-title">Leaf Level</p>
                            <p className="empty-subtitle">
                                {parentType?.toLowerCase() === 'strip'
                                    ? 'Strips are the smallest unit'
                                    : 'No child items'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        );
    });

    // Memoized result processing
    const processedResult = useMemo(() => {
        if (!traceResult) return null;

        const allChildrenMap = {};
        const buildChildrenMap = (childrenArray) => {
            if (!childrenArray || !Array.isArray(childrenArray)) return;
            childrenArray.forEach(child => {
                if (child && child.itemId) {
                    allChildrenMap[child.itemId] = child;
                    if (child.children && Array.isArray(child.children)) {
                        buildChildrenMap(child.children);
                    }
                }
            });
        };
        buildChildrenMap(traceResult.children);

        const nestedChildIds = new Set();
        (traceResult.children || []).forEach(child => {
            const data = child.current || {};
            if (data.strips && Array.isArray(data.strips)) {
                data.strips.forEach(id => nestedChildIds.add(id));
            }
            if (data.boxes && Array.isArray(data.boxes)) {
                data.boxes.forEach(id => nestedChildIds.add(id));
            }
            if (data.cartons && Array.isArray(data.cartons)) {
                data.cartons.forEach(id => nestedChildIds.add(id));
            }
            if (data.shipments && Array.isArray(data.shipments)) {
                data.shipments.forEach(id => nestedChildIds.add(id));
            }
            if (data.itemIds && Array.isArray(data.itemIds)) {
                data.itemIds.forEach(id => nestedChildIds.add(id));
            }
        });

        const searchedItem = traceResult.searchedItem;
        const topLevelChildIds = new Set();
        if (searchedItem && searchedItem.current) {
            const data = searchedItem.current;
            if (data.strips && Array.isArray(data.strips)) {
                data.strips.forEach(id => topLevelChildIds.add(id));
            }
            if (data.boxes && Array.isArray(data.boxes)) {
                data.boxes.forEach(id => topLevelChildIds.add(id));
            }
            if (data.cartons && Array.isArray(data.cartons)) {
                data.cartons.forEach(id => topLevelChildIds.add(id));
            }
            if (data.shipments && Array.isArray(data.shipments)) {
                data.shipments.forEach(id => topLevelChildIds.add(id));
            }
            if (data.itemIds && Array.isArray(data.itemIds)) {
                data.itemIds.forEach(id => topLevelChildIds.add(id));
            }
        } else {
            (traceResult.children || []).forEach(child => {
                if (!nestedChildIds.has(child.itemId)) {
                    topLevelChildIds.add(child.itemId);
                }
            });
        }

        return { allChildrenMap, topLevelChildIds };
    }, [traceResult]);

    // ==================== MAIN RENDER ====================
    return (
        <div className="trace-viewer-wrapper">
            <div className="trace-search-header">
                <div className="search-title">
                    <span className="search-icon">🔍</span>
                    <h2>Blockchain Track & Trace</h2>
                </div>
                <form onSubmit={handleSearch} className="trace-search-form">
                    <div className="search-input-wrapper">
                        <input
                            type="text"
                            value={searchId}
                            onChange={(e) => setSearchId(e.target.value)}
                            placeholder="Enter Transaction Hash or Item ID..."
                            className="search-input"
                        />
                    </div>
                    <button type="submit" disabled={loading} className="search-btn">
                        {loading ? 'Searching...' : '🔍 Trace'}
                    </button>
                    <div className="layout-toggle">
                        <button
                            type="button"
                            className={`layout-btn ${layoutMode === 'row' ? 'active' : ''}`}
                            onClick={() => setLayoutMode('row')}
                            title="Row Layout"
                        >
                            ☰
                        </button>
                        <button
                            type="button"
                            className={`layout-btn ${layoutMode === 'column' ? 'active' : ''}`}
                            onClick={() => setLayoutMode('column')}
                            title="Column Layout"
                        >
                            ▤
                        </button>
                    </div>
                </form>
            </div>

            {error && (
                <div className="trace-error-msg">
                    <span>❌</span> {error}
                </div>
            )}

            {traceResult && processedResult && (
                <div className={`trace-columns-container ${layoutMode === 'column' ? 'column-layout' : 'row-layout'}`}>
                    <ItemDetailsColumn
                        item={traceResult.searchedItem}
                        searchedTransaction={traceResult.transaction}
                        searchType={traceResult.searchType}
                    />
                    <ParentHierarchyColumn parents={traceResult.parents} />
                    <ChildItemsColumn
                        children={traceResult.children}
                        parentType={traceResult.searchedItem?.itemType}
                        allChildrenMap={processedResult.allChildrenMap}
                        topLevelChildIds={processedResult.topLevelChildIds}
                        searchedItem={traceResult.searchedItem}
                    />
                </div>
            )}
        </div>
    );
};

export default memo(TraceViewer);
