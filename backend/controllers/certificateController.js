import User from '../models/User.js';
import Product from '../models/Product.js';

/**
 * @route   GET /api/certificates/:productId
 * @desc    Get manufacturer + product certificates for a given product
 * @access  Public
 *
 * Strategy: Read from MongoDB only (no local blockchain RPC needed on Railway).
 * - Manufacturer certificate IPFS URL is stored in User.certificate.path
 * - Product certificate IPFS URL is stored in Product.productCertificate.path
 */
export const getCertificatesForProduct = async (req, res) => {
    try {
        const { productId } = req.params;
        console.log('=== CERTIFICATE REQUEST ===');
        console.log('Product ID:', productId);

        // ── 1. Look up the product in MongoDB ──────────────────────────────
        const numericId = parseInt(productId, 10);
        const product = await Product.findOne({ productId: isNaN(numericId) ? productId : numericId });

        if (!product) {
            console.log('Product not found in DB for id:', productId);
            return res.status(404).json({
                success: false,
                message: 'Product not found in database'
            });
        }

        const manufacturerAddress = product.manufacturerAddress?.toLowerCase();
        console.log('Manufacturer address:', manufacturerAddress);

        // ── 2. Find manufacturer in User collection ─────────────────────────
        const manufacturer = await User.findOne({
            walletAddress: { $regex: new RegExp(`^${manufacturerAddress}$`, 'i') }
        }).select('name email role walletAddress certificate idProof');

        if (!manufacturer) {
            console.log('Manufacturer not found in database for address:', manufacturerAddress);
            return res.status(404).json({
                success: false,
                message: 'Manufacturer not found in the system',
                debug: { searchedAddress: manufacturerAddress }
            });
        }

        console.log('Manufacturer found:', manufacturer.name);

        // ── 3. Build manufacturer certificate entry ─────────────────────────
        const certData = {
            name: manufacturer.name,
            email: manufacturer.email,
            role: manufacturer.role,
            walletAddress: manufacturer.walletAddress,
            hasCertificate: false,
            hasIdProof: false
        };

        if (manufacturer.certificate) {
            certData.hasCertificate = true;

            let certUrl = manufacturer.certificate.path;
            
            // If the path doesn't start with http, and we have an ipfsHash, rebuild it
            if (certUrl && !certUrl.startsWith('http') && manufacturer.certificate.ipfsHash) {
                certUrl = `https://gateway.pinata.cloud/ipfs/${manufacturer.certificate.ipfsHash}`;
            } else if (!certUrl && manufacturer.certificate.ipfsHash) {
                certUrl = `https://gateway.pinata.cloud/ipfs/${manufacturer.certificate.ipfsHash}`;
            }

            certData.certificate = {
                filename: manufacturer.certificate.filename || 'certificate',
                uploadedAt: manufacturer.certificate.uploadedAt,
                url: certUrl,
                ipfsHash: manufacturer.certificate.ipfsHash
            };

            console.log('✅ Manufacturer cert URL:', certUrl);
        }

        // idProof is stored locally — skip on Railway (ephemeral FS)
        // Do not expose idProof URL in production; omit hasIdProof
        certData.hasIdProof = false;

        // ── 4. Build product certificate entry ─────────────────────────────
        let productCertificate = null;

        if (product.productCertificate) {
            let productCertUrl = null;
            const pcPath = product.productCertificate.path;
            const pcFilename = product.productCertificate.filename;

            // Use the stored path directly if it's already a full URL (IPFS gateway)
            if (pcPath && pcPath.startsWith('http')) {
                productCertUrl = pcPath;
            } 
            // If it's a legacy local path but we have an IPFS hash in the filename
            else if (pcFilename && (pcFilename.startsWith('Qm') || pcFilename.startsWith('baf'))) {
                productCertUrl = `https://gateway.pinata.cloud/ipfs/${pcFilename}`;
            }

            if (productCertUrl) {
                productCertificate = {
                    filename: pcFilename || 'product-certificate',
                    url: productCertUrl
                };
                console.log('✅ Product cert URL:', productCertUrl);
            }
        }

        // ── 5. Send response ───────────────────────────────────────────────
        const response = {
            success: true,
            productId,
            certificates: [certData],
            manufacturer: certData
        };

        if (productCertificate) {
            response.productCertificate = productCertificate;
        } else {
            console.log('⚠️ No IPFS product certificate found for this product');
        }

        console.log('Sending certificate response for:', manufacturer.name);
        res.json(response);

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
 * @desc    Serve certificate file (legacy local — not used in production)
 * @access  Public
 */
export const getCertificateFile = async (req, res) => {
    res.status(410).json({
        success: false,
        message: 'Local file serving is not available in production. Certificates are served via IPFS.'
    });
};
