const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// CA Database paths for both organizations
const CA_CONFIG = {
    org1: {
        mspId: 'Org1MSP',
        dbPath: path.resolve(__dirname, '../../../../test-network/organizations/fabric-ca/org1/fabric-ca-server.db'),
        orgName: 'Org1'
    },
    org2: {
        mspId: 'Org2MSP',
        dbPath: path.resolve(__dirname, '../../../../test-network/organizations/fabric-ca/org2/fabric-ca-server.db'),
        orgName: 'Org2'
    }
};

class CAService {
    constructor() {
        this.cachedUsers = [];
        this.lastFetchTime = null;
        this.cacheDuration = 10000; // Cache for 10 seconds (short for quick updates)
    }

    // Query SQLite database to get identities
    getIdentitiesFromDB(caConfig) {
        let db = null;
        try {
            if (!fs.existsSync(caConfig.dbPath)) {
                console.warn(`CA database not found: ${caConfig.dbPath}`);
                return [];
            }

            // Open database in readonly mode
            db = new Database(caConfig.dbPath, { readonly: true });

            // Query the users table in the CA SQLite database
            const query = `SELECT id, type, affiliation, attributes, max_enrollments FROM users WHERE id != 'admin'`;
            const users = db.prepare(query).all();

            return users.map(user => {
                // Parse attributes if they exist
                let attrs = [];
                let role = user.type || 'client';

                if (user.attributes) {
                    try {
                        attrs = JSON.parse(user.attributes);
                        // Check for role attribute
                        const roleAttr = attrs.find(a => a.name === 'role');
                        if (roleAttr) {
                            role = roleAttr.value;
                        }
                    } catch (e) {
                        // Ignore parse errors
                    }
                }

                return {
                    // Make userId unique by combining user ID with org to avoid duplicates across orgs
                    userId: `${user.id}@${caConfig.mspId}`,
                    username: user.id,  // Keep original username for display
                    org: caConfig.mspId,
                    role: role,
                    displayName: this.formatDisplayName(user.id, caConfig.orgName, role),
                    affiliation: user.affiliation || '',
                    maxEnrollments: user.max_enrollments,
                    attrs: attrs
                };
            });
        } catch (err) {
            console.error(`Failed to get identities from ${caConfig.mspId} database:`, err.message);
            return [];
        } finally {
            if (db) {
                db.close();
            }
        }
    }

    // Format display name
    formatDisplayName(userId, orgName, role) {
        const roleLabel = role === 'admin' ? 'Admin' : 'User';
        return `${userId} (${orgName} ${roleLabel})`;
    }

    // Get all users from both CA databases
    async getAllUsers() {
        // Check cache
        if (this.lastFetchTime && (Date.now() - this.lastFetchTime) < this.cacheDuration) {
            return this.cachedUsers;
        }

        const allUsers = [];

        // Fetch from both CA databases
        const org1Users = this.getIdentitiesFromDB(CA_CONFIG.org1);
        const org2Users = this.getIdentitiesFromDB(CA_CONFIG.org2);

        allUsers.push(...org1Users, ...org2Users);

        // Filter out system identities (peers, orderers) - only keep human users
        const humanUsers = allUsers.filter(user => {
            // Exclude peer and orderer identities
            if (user.role === 'peer' || user.role === 'orderer') return false;
            // Exclude identities that start with 'peer' or 'orderer'
            if (user.userId.startsWith('peer') || user.userId.startsWith('orderer')) return false;
            return true;
        });

        // Update cache
        this.cachedUsers = humanUsers;
        this.lastFetchTime = Date.now();

        console.log(`Fetched ${humanUsers.length} human users from CA databases (filtered from ${allUsers.length} total)`);
        return humanUsers;
    }

    // Clear cache (useful after registration)
    clearCache() {
        this.cachedUsers = [];
        this.lastFetchTime = null;
    }
}

module.exports = new CAService();
