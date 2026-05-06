import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

/**
 * IPFS Service using Pinata
 * Handles file uploads to IPFS via Pinata API
 * Supports both in-memory buffers (cloud/Railway) and disk paths (local dev)
 */
class IPFSService {
    constructor() {
        this.pinataGateway = 'https://gateway.pinata.cloud/ipfs/';
        console.log('📦 IPFS Service module loaded');
    }

    /**
     * Get Pinata JWT from environment
     * @returns {string} JWT token
     */
    getPinataJWT() {
        return process.env.PINATA_JWT;
    }

    /**
     * Upload a file to IPFS via Pinata
     * @param {Object} file - multer file object (buffer OR path)
     * @returns {Promise<Object>} { ipfsHash, ipfsUrl }
     */
    async uploadFile(file) {
        try {
            const pinataJWT = this.getPinataJWT();

            if (!pinataJWT) {
                // Demo/local mode: return a mock hash
                console.warn('⚠️ PINATA_JWT not set — using DEMO MODE mock hash');
                await new Promise(resolve => setTimeout(resolve, 500));
                const mockHash = `QmDEMO${Math.random().toString(36).substring(2, 12)}MOCK`;
                return {
                    ipfsHash: mockHash,
                    ipfsUrl: `${this.pinataGateway}${mockHash}`,
                    isMock: true
                };
            }

            console.log('✅ Uploading to IPFS via Pinata...');

            const formData = new FormData();

            if (file.buffer) {
                // ✅ Cloud-safe: multer memoryStorage gives a Buffer directly
                formData.append('file', file.buffer, {
                    filename: file.originalname || 'certificate',
                    contentType: file.mimetype || 'application/octet-stream'
                });
            } else if (file.path) {
                // Fallback for local disk storage
                formData.append('file', fs.createReadStream(file.path), file.originalname || file.filename);
            } else {
                throw new Error('File must have either a buffer or a path');
            }

            formData.append('pinataMetadata', JSON.stringify({
                name: file.originalname || file.filename || 'certificate',
                keyvalues: {
                    uploadedAt: new Date().toISOString(),
                    type: 'product-certificate'
                }
            }));

            // Upload to Pinata
            const response = await axios.post(
                'https://api.pinata.cloud/pinning/pinFileToIPFS',
                formData,
                {
                    headers: {
                        'Authorization': `Bearer ${pinataJWT}`,
                        ...formData.getHeaders()
                    },
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity
                }
            );

            const ipfsHash = response.data.IpfsHash;
            const ipfsUrl = `${this.pinataGateway}${ipfsHash}`;

            console.log('✅ IPFS Upload complete — Hash:', ipfsHash);
            return {
                ipfsHash,
                ipfsUrl,
                pinataResponse: response.data
            };

        } catch (error) {
            console.error('❌ IPFS upload error:', error.message);
            if (error.response) {
                console.error('   Status:', error.response.status, error.response.data);
            }
            throw new Error(`Failed to upload to IPFS: ${error.message}`);
        }
    }

    /**
     * Get IPFS gateway URL from hash
     * @param {string} ipfsHash - IPFS hash (CID)
     * @returns {string} Gateway URL
     */
    getGatewayUrl(ipfsHash) {
        return `${this.pinataGateway}${ipfsHash}`;
    }

    /**
     * Optional: Unpin a file from Pinata (to free up storage)
     * @param {string} ipfsHash - IPFS hash to unpin
     * @returns {Promise<boolean>} Success status
     */
    async unpinFile(ipfsHash) {
        try {
            const pinataJWT = this.getPinataJWT();
            if (!pinataJWT) throw new Error('Pinata JWT not configured');

            await axios.delete(
                `https://api.pinata.cloud/pinning/unpin/${ipfsHash}`,
                {
                    headers: {
                        'Authorization': `Bearer ${pinataJWT}`
                    }
                }
            );

            console.log('✅ File unpinned from IPFS:', ipfsHash);
            return true;

        } catch (error) {
            console.error('❌ IPFS unpin error:', error.message);
            return false;
        }
    }
}

export default new IPFSService();
