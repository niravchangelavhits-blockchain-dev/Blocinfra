const crypto = require('crypto');

/**
 * Certificate Service
 * Parses X.509 certificates and extracts identity information
 */
class CertificateService {

    /**
     * Parse a PEM-encoded X.509 certificate and extract identity info
     * @param {string} pemCertificate - The PEM-encoded certificate string
     * @returns {object} - Parsed certificate info including CN, Org, etc.
     */
    parseCertificate(pemCertificate) {
        try {
            // Clean up the PEM string - handle various newline formats
            let cleanPem = pemCertificate.trim();

            // Replace escaped newlines with actual newlines (browser might escape them)
            cleanPem = cleanPem.replace(/\\n/g, '\n');

            // Ensure proper line breaks after header and before footer
            cleanPem = cleanPem.replace(/(-----BEGIN CERTIFICATE-----)([^\n])/, '$1\n$2');
            cleanPem = cleanPem.replace(/([^\n])(-----END CERTIFICATE-----)/, '$1\n$2');

            console.log('[CertService] Parsing certificate, length:', cleanPem.length);
            console.log('[CertService] Has newlines:', cleanPem.includes('\n'));

            // Validate it's a certificate
            if (!cleanPem.includes('-----BEGIN CERTIFICATE-----')) {
                throw new Error('Invalid certificate format: Missing BEGIN CERTIFICATE header');
            }
            if (!cleanPem.includes('-----END CERTIFICATE-----')) {
                throw new Error('Invalid certificate format: Missing END CERTIFICATE footer');
            }

            console.log('[CertService] Certificate format validated, attempting X509 parse...');

            // Use Node.js crypto to parse the certificate
            const cert = new crypto.X509Certificate(cleanPem);
            console.log('[CertService] X509 parse successful');

            // Extract subject fields
            const subject = this.parseDistinguishedName(cert.subject);
            const issuer = this.parseDistinguishedName(cert.issuer);

            // Calculate certificate hash for logging/audit
            const certHash = crypto.createHash('sha256')
                .update(cleanPem)
                .digest('hex')
                .substring(0, 16);

            return {
                success: true,
                commonName: subject.CN || null,
                organization: subject.O || null,
                organizationalUnit: subject.OU || null,
                issuerOrg: issuer.O || null,
                issuerCN: issuer.CN || null,
                serialNumber: cert.serialNumber,
                validFrom: cert.validFrom,
                validTo: cert.validTo,
                isExpired: new Date() > new Date(cert.validTo),
                isNotYetValid: new Date() < new Date(cert.validFrom),
                certHash: certHash,
                fingerprint: cert.fingerprint256
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Parse a distinguished name string into an object
     * @param {string} dn - Distinguished name string (e.g., "CN=user1,O=Org1MSP")
     * @returns {object} - Object with DN fields
     */
    parseDistinguishedName(dn) {
        const result = {};
        if (!dn) return result;

        // Split by comma or newline, handling escaped commas
        const parts = dn.split('\n');

        for (const part of parts) {
            const trimmed = part.trim();
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex > 0) {
                const key = trimmed.substring(0, eqIndex).trim();
                const value = trimmed.substring(eqIndex + 1).trim();
                result[key] = value;
            }
        }

        return result;
    }

    /**
     * Verify if a certificate identity matches expected receiver
     * @param {string} pemCertificate - The PEM certificate
     * @param {string} expectedUserId - Expected user ID (e.g., "user1")
     * @param {string} expectedOrg - Expected organization (e.g., "Org2MSP")
     * @returns {object} - Verification result
     */
    verifyIdentity(pemCertificate, expectedUserId, expectedOrg) {
        const certInfo = this.parseCertificate(pemCertificate);

        if (!certInfo.success) {
            return {
                verified: false,
                error: certInfo.error,
                reason: 'INVALID_CERTIFICATE'
            };
        }

        // Check if certificate is expired
        if (certInfo.isExpired) {
            return {
                verified: false,
                certInfo,
                reason: 'CERTIFICATE_EXPIRED',
                message: 'Certificate has expired'
            };
        }

        // Check if certificate is not yet valid
        if (certInfo.isNotYetValid) {
            return {
                verified: false,
                certInfo,
                reason: 'CERTIFICATE_NOT_YET_VALID',
                message: 'Certificate is not yet valid'
            };
        }

        // Extract user ID from certificate CN
        // CN might be in format "user1" or "User1@org2.example.com"
        let certUserId = certInfo.commonName || '';

        // Handle format like "User1@org2.example.com" - extract just the username part
        if (certUserId.includes('@')) {
            certUserId = certUserId.split('@')[0];
        }

        // Normalize for comparison (case-insensitive)
        const normalizedCertUser = certUserId.toLowerCase();
        const normalizedExpectedUser = (expectedUserId || '').toLowerCase();

        // Also check if expectedUserId is in format "user1@Org2MSP" and extract just username
        let expectedUserPart = normalizedExpectedUser;
        if (expectedUserPart.includes('@')) {
            expectedUserPart = expectedUserPart.split('@')[0];
        }

        // Extract org from certificate
        // For Fabric certificates, the ISSUER O field determines the MSP membership
        // The issuer O field contains the org name like "org2.example.com"
        // Subject O might be generic like "Hyperledger"
        let certOrg = certInfo.issuerOrg || certInfo.organization || '';

        console.log('[CertService] Org extraction - issuerOrg:', certInfo.issuerOrg, 'organization:', certInfo.organization, 'using:', certOrg);

        // Try to match org - the expectedOrg is like "Org2MSP"
        // The cert issuer might have "org2.example.com" or similar
        const normalizedCertOrg = certOrg.toLowerCase();
        const normalizedExpectedOrg = (expectedOrg || '').toLowerCase();

        console.log('[CertService] Org matching - certOrg:', normalizedCertOrg, 'expectedOrg:', normalizedExpectedOrg);

        // Check if org matches (flexible matching)
        const orgMatches = this.checkOrgMatch(normalizedCertOrg, normalizedExpectedOrg);
        console.log('[CertService] Org match result:', orgMatches);
        const userMatches = normalizedCertUser === expectedUserPart;

        if (userMatches && orgMatches) {
            return {
                verified: true,
                certInfo,
                reason: 'MATCH',
                message: 'Identity verified successfully'
            };
        } else {
            return {
                verified: false,
                certInfo: {
                    ...certInfo,
                    // Override organization with the one we're actually using (issuerOrg)
                    organization: certOrg
                },
                reason: 'IDENTITY_MISMATCH',
                message: 'Certificate identity does not match expected receiver',
                expected: {
                    userId: expectedUserId,
                    org: expectedOrg
                },
                actual: {
                    userId: certUserId,
                    org: certOrg  // This now shows issuerOrg (org2.example.com)
                },
                details: {
                    userMatches,
                    orgMatches
                }
            };
        }
    }

    /**
     * Flexible org matching - handles different formats
     * @param {string} certOrg - Org from certificate (e.g., "org2.example.com")
     * @param {string} expectedOrg - Expected org (e.g., "Org2MSP" or "org2msp")
     * @returns {boolean}
     */
    checkOrgMatch(certOrg, expectedOrg) {
        if (!certOrg || !expectedOrg) return false;

        // Direct match
        if (certOrg === expectedOrg) return true;

        // Check if certOrg contains the org number (e.g., "org2" in "org2.example.com")
        // and expectedOrg is like "org2msp"
        const orgNumberMatch = certOrg.match(/org(\d+)/i);
        const expectedOrgNumberMatch = expectedOrg.match(/org(\d+)/i);

        if (orgNumberMatch && expectedOrgNumberMatch) {
            return orgNumberMatch[1] === expectedOrgNumberMatch[1];
        }

        // Check if one contains the other
        if (certOrg.includes(expectedOrg) || expectedOrg.includes(certOrg)) {
            return true;
        }

        return false;
    }
}

module.exports = new CertificateService();
