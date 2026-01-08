const fabricService = require('../services/fabricService');
const dataGenerator = require('../services/dataGenerator');
const { DOC_TYPES } = require('../config/constants');
const http = require('http');

/* ============================================================================
   CouchDB CONFIG (FROM ENV)
============================================================================ */
const COUCHDB_PROTOCOL = process.env.COUCHDB_PROTOCOL || 'http';
const COUCHDB_HOST = process.env.COUCHDB_HOST || '127.0.0.1';
const COUCHDB_PORT = process.env.COUCHDB_PORT || 5984;
const COUCHDB_DB = process.env.COUCHDB_DB;
const COUCHDB_USER = process.env.COUCHDB_USERNAME;
const COUCHDB_PASS = process.env.COUCHDB_PASSWORD;

// HARD FAIL if anything is missing (prevents silent 500s)
if (!COUCHDB_DB || !COUCHDB_USER || !COUCHDB_PASS) {
  throw new Error('❌ CouchDB environment variables are missing in .env');
}

const AUTH_HEADER =
  'Basic ' + Buffer.from(`${COUCHDB_USER}:${COUCHDB_PASS}`).toString('base64');

/* ============================================================================
   CouchDB Helper
============================================================================ */
function couchdbPost(path, body, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);

    const req = http.request(
      {
        hostname: COUCHDB_HOST,
        port: COUCHDB_PORT,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          Authorization: AUTH_HEADER
        },
        timeout
      },
      res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.error) {
              return reject(new Error(json.reason || json.error));
            }
            resolve(json);
          } catch {
            reject(new Error('Invalid CouchDB JSON response'));
          }
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('CouchDB request timeout'));
    });

    req.write(payload);
    req.end();
  });
}

/* ============================================================================
   Controller
============================================================================ */
module.exports = {

  /* ---------------- Ledger ---------------- */
  initLedger: async (req, res) => {
    try {
      const result = await fabricService.initLedger();
      res.json({ success: true, result });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  },

  /* ---------------- Generator ---------------- */
  startGenerator: async (req, res) => res.json(await dataGenerator.start()),
  stopGenerator: async (req, res) => res.json(dataGenerator.stop()),
  getGeneratorStatus: async (req, res) => res.json(dataGenerator.getStatus()),
  resetGeneratorStats: async (req, res) => res.json(dataGenerator.resetStats()),

  startProduction: async (req, res) => {
    try {
      res.json(await dataGenerator.startProduction(req.body.productionItems));
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  },

  /* ---------------- Strip ---------------- */
  createStrip: async (req, res) =>
    res.json(await fabricService.createStrip(
      req.body.id,
      req.body.batchNumber,
      req.body.medicineType,
      req.body.mfgDate,
      req.body.expDate
    )),

  getAvailableStrips: async (req, res) =>
    res.json(await fabricService.getAvailableStrips()),

  /* ---------------- Box ---------------- */
  sealBox: async (req, res) =>
    res.json(await fabricService.sealBox(req.body.boxId, req.body.stripIds)),

  getAvailableBoxes: async (req, res) =>
    res.json(await fabricService.getAvailableBoxes()),

  /* ---------------- Carton ---------------- */
  sealCarton: async (req, res) =>
    res.json(await fabricService.sealCarton(req.body.cartonId, req.body.boxIds)),

  getAvailableCartons: async (req, res) =>
    res.json(await fabricService.getAvailableCartons()),

  /* ---------------- Shipment ---------------- */
  sealShipment: async (req, res) =>
    res.json(await fabricService.sealShipment(
      req.body.shipmentId,
      req.body.cartonIds
    )),

  getAvailableShipments: async (req, res) =>
    res.json(await fabricService.getAvailableShipments()),

  distributeShipment: async (req, res) =>
    res.json(await fabricService.distributeShipment(
      req.body.shipmentId,
      req.body.distributor
    )),

  /* ---------------- Statistics ---------------- */
  getStatistics: async (req, res) =>
    res.json(await fabricService.getStatistics()),

  /* ---------------- Generic ---------------- */
  getAllItems: async (req, res) =>
    res.json(await fabricService.getAllItems(req.params.type)),

  /* ---------------- Pagination (CouchDB) ---------------- */
  getItemsPaginated: async (req, res) => {
    try {
      const { type } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 50, 100);
      const skip = (page - 1) * limit;

      if (!Object.values(DOC_TYPES).includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid item type'
        });
      }

      const result = await couchdbPost(
        `/${COUCHDB_DB}/_find`,
        {
          selector: { docType: type },
          limit,
          skip
        }
      );

      res.json({
        success: true,
        count: result.docs.length,
        page,
        limit,
        data: result.docs
      });

    } catch (error) {
      console.error('❌ getItemsPaginated error:', error.message);
      res.status(500).json({
        success: false,
        message: 'Failed to get paginated items',
        error: error.message
      });
    }
  },

  /* ---------------- Search ---------------- */
  searchItems: async (req, res) =>
    res.json(await fabricService.searchItems(req.query.q)),

  /* ---------------- QR ---------------- */
  markQRGenerated: async (req, res) =>
    res.json(await fabricService.markQRGenerated(req.params.itemId))
};

