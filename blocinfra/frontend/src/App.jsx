import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ClientDashboard from './components/ClientDashboard';
import PublicTrace from './components/PublicTrace';
import api from './services/api';
import './styles.css';

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        const token = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');

        if (token && savedUser) {
            try {
                await api.verifyToken();
                setUser(JSON.parse(savedUser));
            } catch (error) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        }

        setLoading(false);
    };

    const handleLogin = (userData) => {
        setUser(userData);
    };

    const handleLogout = () => {
        setUser(null);
    };

    if (loading) {
        return (
            <div className="app-loading">
                <div className="loading-spinner"></div>
                <p>Loading BlocInfra...</p>
            </div>
        );
    }

    return (
        <Router>
            <div className="app">
                <Routes>
                    {/* Public trace route - no auth required */}
                    <Route path="/trace/:txHash" element={<PublicTrace />} />
                    <Route path="/trace" element={<PublicTrace />} />

                    {/* Protected routes */}
                    <Route
                        path="/*"
                        element={
                            user ? (
                                <Dashboard user={user} onLogout={handleLogout} />
                            ) : (
                                <Login onLogin={handleLogin} />
                            )
                        }
                    />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
