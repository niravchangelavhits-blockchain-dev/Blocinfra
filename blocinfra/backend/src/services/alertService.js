/**
 * Alert Service
 * Manages delivery alerts and notifications for manufacturers
 */

class AlertService {
    constructor() {
        // In-memory storage for alerts (in production, use database)
        this.alerts = [];
        this.alertIdCounter = 1;
    }

    /**
     * Create a delivery success alert
     */
    createDeliverySuccessAlert(orderId, receiverId, receiverOrg, shipmentIds, certHash) {
        const alert = {
            id: `ALERT-${String(this.alertIdCounter++).padStart(4, '0')}`,
            type: 'DELIVERY_SUCCESS',
            severity: 'info',
            orderId,
            timestamp: new Date().toISOString(),
            title: 'Delivery Confirmed',
            message: `Order ${orderId} has been delivered successfully`,
            details: {
                receivedBy: receiverId,
                receiverOrg: receiverOrg,
                shipmentIds: shipmentIds || [],
                certificateHash: certHash
            },
            read: false
        };

        this.alerts.unshift(alert); // Add to beginning
        console.log(`[ALERT] Delivery success: ${orderId} received by ${receiverId}`);
        return alert;
    }

    /**
     * Create an unauthorized access alert (security alert)
     */
    createUnauthorizedAccessAlert(orderId, expectedReceiver, expectedOrg, actualPerson, actualOrg, certHash) {
        const alert = {
            id: `ALERT-${String(this.alertIdCounter++).padStart(4, '0')}`,
            type: 'UNAUTHORIZED_ATTEMPT',
            severity: 'critical',
            orderId,
            timestamp: new Date().toISOString(),
            title: 'SECURITY ALERT: Unauthorized Delivery Attempt',
            message: `Someone other than the intended recipient attempted to confirm delivery for Order ${orderId}`,
            details: {
                expectedReceiver,
                expectedOrg,
                attemptedBy: actualPerson,
                attemptedOrg: actualOrg,
                certificateHash: certHash
            },
            read: false
        };

        this.alerts.unshift(alert);
        console.log(`[SECURITY ALERT] Unauthorized attempt on ${orderId}: Expected ${expectedReceiver}@${expectedOrg}, Got ${actualPerson}@${actualOrg}`);
        return alert;
    }

    /**
     * Create an invalid certificate alert
     */
    createInvalidCertificateAlert(orderId, errorMessage) {
        const alert = {
            id: `ALERT-${String(this.alertIdCounter++).padStart(4, '0')}`,
            type: 'INVALID_CERTIFICATE',
            severity: 'warning',
            orderId,
            timestamp: new Date().toISOString(),
            title: 'Invalid Certificate Submitted',
            message: `An invalid certificate was submitted for Order ${orderId}`,
            details: {
                error: errorMessage
            },
            read: false
        };

        this.alerts.unshift(alert);
        console.log(`[ALERT] Invalid certificate for ${orderId}: ${errorMessage}`);
        return alert;
    }

    /**
     * Get all alerts
     */
    getAllAlerts() {
        return this.alerts;
    }

    /**
     * Get unread alerts
     */
    getUnreadAlerts() {
        return this.alerts.filter(a => !a.read);
    }

    /**
     * Get alerts by type
     */
    getAlertsByType(type) {
        return this.alerts.filter(a => a.type === type);
    }

    /**
     * Get alert count by severity
     */
    getAlertCounts() {
        return {
            total: this.alerts.length,
            unread: this.alerts.filter(a => !a.read).length,
            critical: this.alerts.filter(a => a.severity === 'critical' && !a.read).length,
            warning: this.alerts.filter(a => a.severity === 'warning' && !a.read).length,
            info: this.alerts.filter(a => a.severity === 'info' && !a.read).length
        };
    }

    /**
     * Mark alert as read
     */
    markAsRead(alertId) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.read = true;
            return true;
        }
        return false;
    }

    /**
     * Mark all alerts as read
     */
    markAllAsRead() {
        this.alerts.forEach(a => a.read = true);
        return true;
    }

    /**
     * Delete an alert
     */
    deleteAlert(alertId) {
        const index = this.alerts.findIndex(a => a.id === alertId);
        if (index !== -1) {
            this.alerts.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Clear all alerts
     */
    clearAllAlerts() {
        this.alerts = [];
        return true;
    }
}

module.exports = new AlertService();
