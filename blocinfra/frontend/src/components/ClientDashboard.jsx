import React, { useState, useEffect } from 'react';
import api from '../services/api';

function ClientDashboard({ user, onLogout }) {
    const [certificate, setCertificate] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        fetchCertificate();
    }, []);

    const fetchCertificate = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await api.getMyCertificate();
            if (response.success && response.data?.certificate) {
                setCertificate(response.data.certificate);
            } else {
                setError('Failed to load certificate');
            }
        } catch (err) {
            console.error('Failed to fetch certificate:', err);
            setError(err.message || 'Failed to load certificate');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(certificate);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = certificate;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleLogout = async () => {
        try {
            await api.logout();
        } catch (err) {
            console.error('Logout error:', err);
        } finally {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            onLogout();
        }
    };

    return (
        <div className="client-dashboard">
            <header className="client-header">
                <div className="header-content">
                    <div className="logo-section">
                        <div className="logo-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                                <path d="M2 17l10 5 10-5"/>
                                <path d="M2 12l10 5 10-5"/>
                            </svg>
                        </div>
                        <h1>BlocInfra</h1>
                    </div>
                    <div className="user-section">
                        <div className="user-info">
                            <span className="user-name">{user?.displayName || user?.username}</span>
                            <span className="user-org">{user?.org}</span>
                        </div>
                        <button className="logout-btn" onClick={handleLogout}>
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="client-main">
                <div className="certificate-card">
                    <div className="card-header">
                        <div className="card-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="4" width="18" height="16" rx="2"/>
                                <path d="M7 8h10M7 12h10M7 16h6"/>
                            </svg>
                        </div>
                        <div className="card-title">
                            <h2>Your Certificate</h2>
                            <p>Use this certificate to verify delivery of shipments</p>
                        </div>
                    </div>

                    <div className="user-details">
                        <div className="detail-item">
                            <span className="detail-label">Username</span>
                            <span className="detail-value">{user?.username}</span>
                        </div>
                        <div className="detail-item">
                            <span className="detail-label">Organization</span>
                            <span className="detail-value">{user?.org}</span>
                        </div>
                        <div className="detail-item">
                            <span className="detail-label">Role</span>
                            <span className="detail-value role-badge">{user?.role}</span>
                        </div>
                    </div>

                    {loading ? (
                        <div className="certificate-loading">
                            <div className="loading-spinner"></div>
                            <p>Loading certificate...</p>
                        </div>
                    ) : error ? (
                        <div className="certificate-error">
                            <div className="error-icon">!</div>
                            <p>{error}</p>
                            <button className="retry-btn" onClick={fetchCertificate}>
                                Retry
                            </button>
                        </div>
                    ) : (
                        <div className="certificate-content">
                            <div className="certificate-actions">
                                <button
                                    className={`copy-btn ${copied ? 'copied' : ''}`}
                                    onClick={handleCopy}
                                >
                                    {copied ? (
                                        <>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M20 6L9 17l-5-5"/>
                                            </svg>
                                            Copied!
                                        </>
                                    ) : (
                                        <>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <rect x="9" y="9" width="13" height="13" rx="2"/>
                                                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                                            </svg>
                                            Copy Certificate
                                        </>
                                    )}
                                </button>
                            </div>
                            <textarea
                                className="certificate-textarea"
                                value={certificate}
                                readOnly
                                rows={15}
                            />
                        </div>
                    )}

                    <div className="certificate-instructions">
                        <h3>How to verify delivery:</h3>
                        <ol>
                            <li>When you receive a shipment, scan the QR code on the package</li>
                            <li>The system will ask for your certificate to verify your identity</li>
                            <li>Click "Copy Certificate" above and paste it into the verification form</li>
                            <li>Once verified, the delivery will be confirmed on the blockchain</li>
                        </ol>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default ClientDashboard;
