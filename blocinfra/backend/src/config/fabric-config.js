const path = require('path');
const fs = require('fs');
const grpc = require('@grpc/grpc-js');
const { connect, signers } = require('@hyperledger/fabric-gateway');
const crypto = require('crypto');

class FabricConfig {
    constructor() {
        this.channelName = process.env.CHANNEL_NAME || 'mychannel';
        this.chaincodeName = process.env.CHAINCODE_NAME || 'pharma';
        this.mspId = process.env.MSP_ID || 'Org1MSP';

        // Must match TLS cert CN/SAN
        this.peerEndpoint = process.env.PEER_ENDPOINT || 'localhost:7051';
        this.peerHostAlias =
            process.env.PEER_HOST_ALIAS || 'peer0.org1.example.com';

        // Base path for Fabric crypto materials
        this.cryptoPath = path.resolve(
            __dirname,
            '../../../../test-network/organizations'
        );
        this.orgPath = path.join(
            this.cryptoPath,
            'peerOrganizations/org1.example.com'
        );

        this.gateway = null;
        this.client = null;
    }

    /**
     * Idempotent connect — SAFE to call multiple times
     */
    async connect() {
        if (this.gateway) {
            return this.gateway;
        }

        try {
            const credentials = await this.loadCredentials();

            if (!credentials?.cert || !credentials?.privateKey) {
                throw new Error('Fabric identity not loaded correctly');
            }

            this.client = await this.createGrpcClient(credentials.tlsCert);

            // 🔥 CORRECT fabric-gateway v2 CONNECT
            this.gateway = connect({
                client: this.client,
                identity: {
                    mspId: this.mspId,
                    credentials: credentials.cert // Uint8Array
                },
                signer: signers.newPrivateKeySigner(credentials.privateKey),
                evaluateOptions: () => ({ deadline: Date.now() + 30000 }),
                endorseOptions: () => ({ deadline: Date.now() + 45000 }),
                submitOptions: () => ({ deadline: Date.now() + 30000 }),
                commitStatusOptions: () => ({ deadline: Date.now() + 60000 })
            });

            console.log('Connected to Fabric Gateway');
            return this.gateway;
        } catch (error) {
            this.gateway = null;
            if (this.client) {
                try { this.client.close(); } catch (_) {}
            }
            this.client = null;

            console.error('Failed to connect to Fabric Gateway:', error);
            throw error;
        }
    }

    /**
     * Load Fabric identity + TLS material
     */
    async loadCredentials() {
        const certPath = path.join(
            this.orgPath,
            'users/Admin@org1.example.com/msp/signcerts/cert.pem'
        );

        const keyDir = path.join(
            this.orgPath,
            'users/Admin@org1.example.com/msp/keystore'
        );

        const tlsCertPath = path.join(
            this.orgPath,
            'tlsca/tlsca.org1.example.com-cert.pem'
        );

        if (!fs.existsSync(certPath)) {
            throw new Error(`Identity cert not found: ${certPath}`);
        }
        if (!fs.existsSync(keyDir)) {
            throw new Error(`Keystore not found: ${keyDir}`);
        }
        if (!fs.existsSync(tlsCertPath)) {
            throw new Error(`TLS CA cert not found: ${tlsCertPath}`);
        }

        const certPem = fs.readFileSync(certPath);
        const keyFiles = fs.readdirSync(keyDir);
        const privateKeyPem = fs.readFileSync(
            path.join(keyDir, keyFiles[0])
        );

        return {
            cert: Uint8Array.from(certPem),      // Fabric Gateway
            privateKey: crypto.createPrivateKey(privateKeyPem),
            tlsCert: fs.readFileSync(tlsCertPath) // gRPC
        };
    }

    async createGrpcClient(tlsCert) {
        const tlsCredentials = grpc.credentials.createSsl(tlsCert);

        return new grpc.Client(this.peerEndpoint, tlsCredentials, {
            'grpc.ssl_target_name_override': this.peerHostAlias,
            'grpc.default_authority': this.peerHostAlias
        });
    }

    getContract() {
        if (!this.gateway) {
            throw new Error('Gateway not connected. Call connect() first.');
        }

        const network = this.gateway.getNetwork(this.channelName);
        return network.getContract(this.chaincodeName);
    }

    async disconnect() {
        if (this.gateway) {
            this.gateway.close();
            this.gateway = null;
        }
        if (this.client) {
            this.client.close();
            this.client = null;
        }
    }
}

module.exports = new FabricConfig();
