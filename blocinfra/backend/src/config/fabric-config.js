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
        this.peerEndpoint = process.env.PEER_ENDPOINT || 'localhost:7051';
        this.peerHostAlias = process.env.PEER_HOST_ALIAS || 'peer0.org1.example.com';

        // Base path for crypto materials
        this.cryptoPath = path.resolve(__dirname, '../../../../test-network/organizations');
        this.orgPath = path.join(this.cryptoPath, 'peerOrganizations/org1.example.com');

        this.gateway = null;
        this.client = null;
    }

    async connect() {
        try {
            // Load credentials
            const credentials = await this.loadCredentials();

            // Create gRPC client
            this.client = await this.createGrpcClient(credentials.tlsCert);

            // Create gateway connection
            this.gateway = connect({
                client: this.client,
                identity: {
                    mspId: this.mspId,
                    credentials: credentials.cert
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
            console.error('Failed to connect to Fabric Gateway:', error);
            throw error;
        }
    }

    async loadCredentials() {
        const certPath = path.join(this.orgPath, 'users/Admin@org1.example.com/msp/signcerts/cert.pem');
        const keyDir = path.join(this.orgPath, 'users/Admin@org1.example.com/msp/keystore');
        const tlsCertPath = path.join(this.orgPath, 'peers/peer0.org1.example.com/tls/ca.crt');

        // Read certificate
        const cert = fs.readFileSync(certPath);

        // Read private key (first file in keystore)
        const keyFiles = fs.readdirSync(keyDir);
        const keyPath = path.join(keyDir, keyFiles[0]);
        const privateKeyPem = fs.readFileSync(keyPath);
        const privateKey = crypto.createPrivateKey(privateKeyPem);

        // Read TLS certificate
        const tlsCert = fs.readFileSync(tlsCertPath);

        return { cert, privateKey, tlsCert };
    }

    async createGrpcClient(tlsCert) {
        // Create TLS credentials that skip verification for development
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
        console.log('Disconnected from Fabric Gateway');
    }
}

module.exports = new FabricConfig();
