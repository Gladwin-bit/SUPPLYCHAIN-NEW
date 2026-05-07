import User from '../models/User.js';

/**
 * @route   GET /api/certificates/:productId
 * @desc    Get manufacturer + product certificate for a given productId
 * @access  Public
 *
 * Strategy (production-safe):
 *  1. Look up the Product record in MongoDB → gives us manufacturerAddress + productCertificate
 *  2. Look up the Manufacturer User record in MongoDB → gives us their name / cert / idProof
 *  3. Optionally try to fetch the manufacturer's IPFS cert hash from blockchain (Sepolia)
 *  4. Return everything to the frontend
 *
 * This no longer depends on a local Hardhat node (localhost:8545).
 */
export const getCertificatesForProduct = async (req, res) => {
    try {
        const { productId } = req.params;
        console.log('=== CERTIFICATE REQUEST ===');
        console.log('Product ID:', productId);

        // ── 1. Look up the Product in MongoDB ─────────────────────────────────────
        const Product = (await import('../models/Product.js')).default;

        // productId might be numeric or a formatted string; try numeric first
        const numericId = parseInt(productId, 10);
        let product = null;

        if (!isNaN(numericId)) {
            product = await Product.findOne({ productId: numericId }).lean();
        }

        // ── 2. Determine manufacturer address ─────────────────────────────────────
        //    Fallback: try to read the blockchain only if we have an RPC URL configured.
        let manufacturerAddress = product?.manufacturerAddress || null;

        if (!manufacturerAddress) {
            // Try blockchain as fallback (requires ALCHEMY_RPC_URL or RPC_URL env var)
            const rpcUrl = process.env.ALCHEMY_RPC_URL || process.env.RPC_URL || null;
            if (rpcUrl) {
                try {
                    const { ethers } = await import('ethers');
                    const fs = await import('fs');
                    const path = await import('path');
                    const { fileURLToPath } = await import('url');
                    const { dirname } = await import('path');

                    const __filename = fileURLToPath(import.meta.url);
                    const __dirname = dirname(__filename);
                    const projectRoot = path.join(__dirname, '..', '..');
                    const contractAddressPath = path.join(projectRoot, 'frontend', 'src', 'contract-address.json');
                    const contractABIPath = path.join(projectRoot, 'frontend', 'src', 'SupplyChain.json');

                    const addressData = JSON.parse(fs.readFileSync(contractAddressPath, 'utf8'));
                    const abiData = JSON.parse(fs.readFileSync(contractABIPath, 'utf8'));

                    const provider = new ethers.JsonRpcProvider(rpcUrl);
                    const contract = new ethers.Contract(addressData.address, abiData.abi, provider);

                    const history = await contract.getHistory(numericId);
                    if (history && history.length > 0) {
                        manufacturerAddress = history[0].actor.toLowerCase();
                        console.log('Manufacturer address from blockchain history:', manufacturerAddress);
                    }
                } catch (blockchainErr) {
                    console.warn('Blockchain fallback failed for manufacturerAddress:', blockchainErr.message);
                }
            } else {
                console.warn('No RPC_URL configured — cannot look up manufacturer from blockchain.');
            }
        }

        if (!manufacturerAddress) {
            return res.status(404).json({
                success: false,
                message: 'Could not determine manufacturer for this product. Product may not be registered in the database.'
            });
        }

        // ── 3. Look up the Manufacturer User in MongoDB ───────────────────────────
        let manufacturer = await User.findOne({
            walletAddress: { $regex: new RegExp(`^${manufacturerAddress}$`, 'i') }
        }).select('name email role walletAddress certificate idProof').lean();

        if (!manufacturer) {
            console.warn('Manufacturer user not found for address:', manufacturerAddress);
            // Still continue — we can still return the product certificate
        }

        // ── 4. Build the manufacturer certificate entry ────────────────────────────
        const certificateData = manufacturer
            ? {
                name: manufacturer.name,
                email: manufacturer.email,
                role: manufacturer.role,
                walletAddress: manufacturer.walletAddress,
                hasCertificate: !!manufacturer.certificate,
                hasIdProof: !!manufacturer.idProof
            }
            : {
                name: 'Unknown Manufacturer',
                email: '',
                role: 'manufacturer',
                walletAddress: manufacturerAddress,
                hasCertificate: false,
                hasIdProof: false
            };

        // ── 5. Try to get manufacturer IPFS cert hash from blockchain ──────────────
        //    Use Sepolia RPC URL from env, fall back gracefully.
        const rpcUrl = process.env.ALCHEMY_RPC_URL || process.env.RPC_URL || null;
        if (rpcUrl && manufacturer?.certificate) {
            try {
                const { ethers } = await import('ethers');
                const fs = await import('fs');
                const path = await import('path');
                const { fileURLToPath } = await import('url');
                const { dirname } = await import('path');

                const __filename = fileURLToPath(import.meta.url);
                const __dirname = dirname(__filename);
                const projectRoot = path.join(__dirname, '..', '..');
                const contractAddressPath = path.join(projectRoot, 'frontend', 'src', 'contract-address.json');
                const contractABIPath = path.join(projectRoot, 'frontend', 'src', 'SupplyChain.json');

                const addressData = JSON.parse(fs.readFileSync(contractAddressPath, 'utf8'));
                const abiData = JSON.parse(fs.readFileSync(contractABIPath, 'utf8'));

                const provider = new ethers.JsonRpcProvider(rpcUrl);
                const contract = new ethers.Contract(addressData.address, abiData.abi, provider);

                const ipfsHash = await contract.getUserCertificate(manufacturerAddress);
                if (ipfsHash && ipfsHash.trim() !== '') {
                    console.log('IPFS hash found for manufacturer:', ipfsHash);
                    certificateData.hasCertificate = true;
                    certificateData.certificate = {
                        filename: manufacturer.certificate?.filename || 'manufacturer-certificate.pdf',
                        uploadedAt: manufacturer.certificate?.uploadedAt,
                        ipfsHash,
                        url: `https://gateway.pinata.cloud/ipfs/${ipfsHash}`
                    };
                } else {
                    throw new Error('No IPFS hash on chain');
                }
            } catch (ipfsErr) {
                console.warn('Could not fetch IPFS cert hash:', ipfsErr.message);
                // Fallback: serve the locally stored manufacturer certificate
                if (manufacturer?.certificate?.filename) {
                    certificateData.hasCertificate = true;
                    certificateData.certificate = {
                        filename: manufacturer.certificate.filename,
                        uploadedAt: manufacturer.certificate.uploadedAt,
                        url: `/uploads/${manufacturer.certificate.filename}`
                    };
                }
            }
        } else if (manufacturer?.certificate?.filename) {
            // No RPC configured → fall back to local file path
            certificateData.hasCertificate = true;
            certificateData.certificate = {
                filename: manufacturer.certificate.filename,
                uploadedAt: manufacturer.certificate.uploadedAt,
                url: `/uploads/${manufacturer.certificate.filename}`
            };
        }

        // ID proof (always from MongoDB — no IPFS for this)
        if (manufacturer?.idProof?.filename) {
            certificateData.hasIdProof = true;
            certificateData.idProof = {
                filename: manufacturer.idProof.filename,
                uploadedAt: manufacturer.idProof.uploadedAt,
                url: `/uploads/${manufacturer.idProof.filename}`
            };
        }

        // ── 6. Product certificate (uploaded by manufacturer when creating product) ─
        //    PRIMARY source: MongoDB Product record
        //    FALLBACK: blockchain productCertificate field
        let productCertResponse = null;

        if (product?.productCertificate?.filename) {
            // ✅ Preferred: from MongoDB — always available in production
            productCertResponse = {
                filename: product.productCertificate.filename,
                uploadedAt: product.productCertificate.uploadedAt,
                url: `/uploads/product-certificates/${product.productCertificate.filename}`
            };
            console.log('✅ Product certificate found in MongoDB:', product.productCertificate.filename);
        } else if (rpcUrl) {
            // Fallback: try to read from blockchain productCertificate field
            try {
                const { ethers } = await import('ethers');
                const fs = await import('fs');
                const path = await import('path');
                const { fileURLToPath } = await import('url');
                const { dirname } = await import('path');

                const __filename = fileURLToPath(import.meta.url);
                const __dirname = dirname(__filename);
                const projectRoot = path.join(__dirname, '..', '..');
                const contractAddressPath = path.join(projectRoot, 'frontend', 'src', 'contract-address.json');
                const contractABIPath = path.join(projectRoot, 'frontend', 'src', 'SupplyChain.json');

                const addressData = JSON.parse(fs.readFileSync(contractAddressPath, 'utf8'));
                const abiData = JSON.parse(fs.readFileSync(contractABIPath, 'utf8'));

                const provider = new ethers.JsonRpcProvider(rpcUrl);
                const contract = new ethers.Contract(addressData.address, abiData.abi, provider);

                const blockchainProduct = await contract.getProduct(numericId);
                const onChainCert = blockchainProduct.productCertificate || '';
                if (onChainCert && onChainCert.trim() !== '') {
                    productCertResponse = {
                        filename: onChainCert,
                        url: `/uploads/product-certificates/${onChainCert}`
                    };
                    console.log('✅ Product certificate found on blockchain:', onChainCert);
                }
            } catch (certErr) {
                console.warn('Could not fetch product certificate from blockchain:', certErr.message);
            }
        }

        if (!productCertResponse) {
            console.log('⚠️ No product certificate found for product:', productId);
        }

        // ── 7. Send the response ──────────────────────────────────────────────────
        const response = {
            success: true,
            productId,
            certificates: manufacturer ? [certificateData] : [],
            manufacturer: certificateData
        };

        if (productCertResponse) {
            response.productCertificate = productCertResponse;
        }

        console.log('Sending certificate response for product:', productId);
        return res.json(response);

    } catch (error) {
        console.error('=== CERTIFICATE ERROR ===');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve certificates',
            error: error.message
        });
    }
};

/**
 * @route   GET /api/certificates/file/:filename
 * @desc    Serve certificate file
 * @access  Public
 */
export const getCertificateFile = async (req, res) => {
    try {
        const fs = await import('fs');
        const path = await import('path');

        const { filename } = req.params;
        const uploadsDir = process.env.UPLOAD_PATH || './uploads';
        const filePath = path.join(uploadsDir, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'Certificate file not found'
            });
        }

        res.sendFile(path.resolve(filePath));

    } catch (error) {
        console.error('Get certificate file error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve certificate file',
            error: error.message
        });
    }
};
