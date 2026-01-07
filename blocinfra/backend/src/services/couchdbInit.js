/**
 * CouchDB Initialization Service
 * Automatically creates required indexes on startup
 */
const http = require('http');

const COUCHDB_HOST = process.env.COUCHDB_HOST || 'localhost';
const COUCHDB_PORT = process.env.COUCHDB_PORT || 5984;
const COUCHDB_USER = process.env.COUCHDB_USER || 'admin';
const COUCHDB_PASSWORD = process.env.COUCHDB_PASSWORD || 'adminpw';
const COUCHDB_DATABASE = process.env.COUCHDB_DATABASE || 'mychannel_pharma';

// Required indexes for optimal query performance
const REQUIRED_INDEXES = [
    {
        name: 'indexDocTypeDoc',
        index: {
            fields: ['docType']
        }
    },
    {
        name: 'indexDocTypeStatus',
        index: {
            fields: ['docType', 'status']
        }
    },
    {
        name: 'indexDocTypeCreatedAt',
        index: {
            fields: ['docType', 'createdAt']
        }
    },
    {
        name: 'indexCreationTxId',
        index: {
            fields: ['creationTxId']
        }
    }
];

/**
 * Make HTTP request to CouchDB
 */
function couchRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const auth = Buffer.from(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`).toString('base64');
        const options = {
            hostname: COUCHDB_HOST,
            port: COUCHDB_PORT,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${auth}`
            },
            timeout: 10000
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('CouchDB request timeout'));
        });

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

/**
 * Check if an index exists
 */
async function indexExists(indexName) {
    try {
        const result = await couchRequest('GET', `/${COUCHDB_DATABASE}/_index`);
        if (result.status === 200 && result.data.indexes) {
            return result.data.indexes.some(idx => idx.name === indexName);
        }
        return false;
    } catch (error) {
        console.error(`Error checking index ${indexName}:`, error.message);
        return false;
    }
}

/**
 * Create an index
 */
async function createIndex(indexDef) {
    try {
        const body = {
            index: indexDef.index,
            name: indexDef.name,
            type: 'json'
        };

        const result = await couchRequest('POST', `/${COUCHDB_DATABASE}/_index`, body);

        if (result.status === 200 || result.status === 201) {
            if (result.data.result === 'created') {
                console.log(`  ✓ Created index: ${indexDef.name}`);
            } else if (result.data.result === 'exists') {
                console.log(`  ○ Index already exists: ${indexDef.name}`);
            }
            return true;
        } else {
            console.error(`  ✗ Failed to create index ${indexDef.name}:`, result.data);
            return false;
        }
    } catch (error) {
        console.error(`  ✗ Error creating index ${indexDef.name}:`, error.message);
        return false;
    }
}

/**
 * Initialize all required CouchDB indexes
 */
async function initializeIndexes() {
    console.log('\n[CouchDB] Checking and creating required indexes...');

    // First check if database exists
    try {
        const dbCheck = await couchRequest('GET', `/${COUCHDB_DATABASE}`);
        if (dbCheck.status === 404) {
            console.log(`[CouchDB] Database ${COUCHDB_DATABASE} not found. Indexes will be created when database is available.`);
            return false;
        }
    } catch (error) {
        console.error('[CouchDB] Cannot connect to CouchDB:', error.message);
        console.log('[CouchDB] Will retry index creation on next startup.');
        return false;
    }

    let allSuccess = true;
    for (const indexDef of REQUIRED_INDEXES) {
        const exists = await indexExists(indexDef.name);
        if (!exists) {
            const success = await createIndex(indexDef);
            if (!success) allSuccess = false;
        } else {
            console.log(`  ○ Index already exists: ${indexDef.name}`);
        }
    }

    if (allSuccess) {
        console.log('[CouchDB] All indexes are ready.\n');
    } else {
        console.log('[CouchDB] Some indexes failed to create. Queries may be slower.\n');
    }

    return allSuccess;
}

module.exports = {
    initializeIndexes,
    createIndex,
    indexExists,
    REQUIRED_INDEXES
};
