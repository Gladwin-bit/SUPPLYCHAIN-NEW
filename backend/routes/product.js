import express from 'express';
import multer from 'multer';
import ipfsService from '../services/ipfsService.js';

const router = express.Router();

// Memory storage — no local disk writes, works on Railway/cloud
const memStorage = multer.memoryStorage();
const uploadCertificate = multer({
    storage: memStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF and image files are allowed'));
        }
    }
});

/**
 * @route   POST /api/products/upload-certificate
 * @desc    Upload product certificate to IPFS via Pinata
 * @access  Private
 */
router.post('/upload-certificate', uploadCertificate.single('certificate'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        // Upload buffer directly to IPFS (no disk needed)
        const { ipfsHash, ipfsUrl, isMock } = await ipfsService.uploadFile(req.file);

        res.json({
            success: true,
            filename: ipfsHash,      // IPFS CID stored in MongoDB as 'filename'
            path: ipfsUrl,           // Full gateway URL stored as 'path'
            url: ipfsUrl,
            ipfsHash,
            isMock: isMock || false,
            message: 'Certificate uploaded to IPFS successfully'
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ success: false, message: 'Failed to upload certificate', error: error.message });
    }
});

/**
 * @route   POST /api/products/upload-materials-metadata
 * @desc    Store materials metadata JSON inline (no filesystem - cloud safe)
 * @access  Private
 */
router.post('/upload-materials-metadata', (req, res) => {
    try {
        const { productName, materials } = req.body;

        if (!materials) {
            return res.status(400).json({
                success: false,
                message: 'Materials data is required'
            });
        }

        // Store metadata inline (returned as JSON, saved by caller in MongoDB)
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const filename = `materials-${uniqueSuffix}.json`;

        const metadata = {
            productName: productName || 'Untitled',
            uploadDate: new Date().toISOString(),
            ...materials
        };

        res.json({
            success: true,
            filename,
            metadata, // caller should persist this in MongoDB
            message: 'Materials metadata processed successfully'
        });
    } catch (error) {
        console.error('Materials metadata error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process materials metadata',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/products/certificate/:publicId(*)
 * @desc    Redirect to Cloudinary URL for the certificate
 * @access  Public
 */
router.get('/certificate/:publicId(*)', async (req, res) => {
    try {
        const { publicId } = req.params;

        // If it's already a full URL, redirect directly
        if (publicId.startsWith('http')) {
            return res.redirect(publicId);
        }

        // Build Cloudinary URL from public_id
        const { cloudinary } = await import('../config/cloudinary.js');
        const url = cloudinary.url(publicId, { secure: true, resource_type: 'auto' });
        res.redirect(url);
    } catch (error) {
        console.error('Get certificate error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve certificate',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/products/bulk-register
 * @desc    Create comprehensive batch record with all product details in the Batch collection
 * @access  Private
 */
router.post('/bulk-register', async (req, res) => {
    try {
        const {
            batchId,
            formattedBatchId,
            batchName,
            description,
            loomLocation,
            weaveDate,
            products: productsToRegister,
            manufacturerAddress,
            certificateFilename,
            certificatePath,
            txHash,
            blockNumber,
            gasUsed
        } = req.body;

        // Enhanced validation
        if (!batchId || !batchName || !productsToRegister || !Array.isArray(productsToRegister) ||
            productsToRegister.length === 0 || !manufacturerAddress || !certificateFilename || !txHash) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: batchId, batchName, products, manufacturerAddress, certificateFilename, txHash'
            });
        }

        const User = (await import('../models/User.js')).default;
        const Batch = (await import('../models/Batch.js')).default;

        // Find manufacturer
        const manufacturer = await User.findOne({
            walletAddress: { $regex: new RegExp(`^${manufacturerAddress}$`, 'i') }
        });

        if (!manufacturer) {
            return res.status(404).json({
                success: false,
                message: 'Manufacturer not found'
            });
        }

        // Parse weave date
        const parsedWeaveDate = weaveDate
            ? (typeof weaveDate === 'number' || /^\d+$/.test(weaveDate)
                ? new Date(Number(weaveDate) * 1000)
                : new Date(weaveDate))
            : new Date();

        // Extract shared handover key
        const sharedHandoverKey = productsToRegister[0]?.handoverKey || null;
        if (!sharedHandoverKey) {
            return res.status(400).json({
                success: false,
                message: 'Handover key is required for batch registration'
            });
        }

        // Process products for batch storage
        const batchProducts = productsToRegister.map((p, index) => ({
            index: index,
            productId: parseInt(p.productId),
            formattedProductId: p.formattedProductId || `#${p.productId}`,
            name: p.name,
            consumerSecret: p.consumerSecret || '', // Store the actual secret for waybill generation
            consumerSecretHash: p.consumerSecretHash,
            status: 'created'
        }));

        // Create comprehensive batch record
        const batchData = {
            batchId: parseInt(batchId),
            formattedBatchId: formattedBatchId || `#${batchId}`,
            name: batchName,
            description: description || '',
            quantity: productsToRegister.length,
            loomLocation: loomLocation || 'Not Specified',
            weaveDate: parsedWeaveDate,
            manufacturer: manufacturer._id,
            manufacturerAddress: manufacturerAddress.toLowerCase(),
            products: batchProducts,
            certificate: {
                filename: certificateFilename,
                path: certificatePath || `uploads/product-certificates/${certificateFilename}`,
                uploadedAt: new Date()
            },
            currentHandoverKey: sharedHandoverKey,
            handoverHistory: [{
                key: sharedHandoverKey,
                fromAddress: manufacturerAddress.toLowerCase(),
                toAddress: null, // Will be set when first transfer occurs
                transferredAt: new Date(),
                location: loomLocation
            }],
            waybill: {
                isGenerated: false,
                downloadCount: 0
            },
            status: 'created',
            isActive: true,
            blockchainTxHash: txHash,
            blockNumber: blockNumber || null,
            gasUsed: gasUsed || null,
            metrics: {
                totalScans: 0,
                verificationCount: 0,
                lastActivity: new Date()
            }
        };

        // Create or update batch record
        const batch = await Batch.findOneAndUpdate(
            { batchId: parseInt(batchId) },
            { $set: batchData },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Generate waybill data
        const waybillPayload = batch.generateWaybill();
        await batch.save();

        // Also keep minimal Product records for backward compatibility (optional)
        const Product = (await import('../models/Product.js')).default;
        const createdProducts = [];

        for (const p of productsToRegister) {
            const product = await Product.findOneAndUpdate(
                { productId: parseInt(p.productId) },
                {
                    $set: {
                        name: p.name,
                        description: description || '',
                        manufacturer: manufacturer._id,
                        manufacturerAddress: manufacturerAddress.toLowerCase(),
                        loomLocation,
                        weaveDate: parsedWeaveDate,
                        consumerSecretHash: p.consumerSecretHash,
                        currentHandoverKey: sharedHandoverKey,
                        productCertificate: {
                            filename: certificateFilename,
                            path: certificatePath || `uploads/product-certificates/${certificateFilename}`,
                            uploadedAt: new Date()
                        },
                        blockchainTxHash: txHash
                    }
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            createdProducts.push({
                id: product.productId,
                name: product.name,
                formattedId: p.formattedProductId || `#${p.productId}`
            });
        }

        // Response with comprehensive batch information
        res.json({
            success: true,
            message: `Batch "${batchName}" with ${batchProducts.length} products registered successfully`,
            batch: {
                batchId: batch.batchId,
                formattedBatchId: batch.formattedBatchId,
                name: batch.name,
                quantity: batch.quantity,
                status: batch.status,
                waybillGenerated: batch.waybill.isGenerated
            },
            products: createdProducts,
            waybill: {
                payload: waybillPayload,
                isGenerated: batch.waybill.isGenerated
            },
            txHash
        });

    } catch (error) {
        console.error('Enhanced bulk registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to register batch',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/products/batch/:batchId
 * @desc    Get details for an entire batch
 * @access  Public
 */
router.get('/batch/:batchId', async (req, res) => {
    try {
        const { batchId } = req.params;
        const Batch = (await import('../models/Batch.js')).default;

        const batch = await Batch.findOne({ batchId: parseInt(batchId) })
            .populate('manufacturer', 'name email walletAddress');

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: 'Batch not found in database'
            });
        }

        res.json({
            success: true,
            batch
        });
    } catch (error) {
        console.error('Get batch details error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve batch details',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/products/batch/:batchId/handover-key
 * @desc    Get the current handover key for an entire batch
 * @access  Public
 */
router.get('/batch/:batchId/handover-key', async (req, res) => {
    try {
        const { batchId } = req.params;
        const Batch = (await import('../models/Batch.js')).default;
        const batch = await Batch.findOne({ batchId: parseInt(batchId) });

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: 'Batch not found'
            });
        }

        res.json({
            success: true,
            handoverKey: batch.currentHandoverKey,
            batchId: batch.batchId
        });
    } catch (error) {
        console.error('Get batch handover key error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get batch handover key',
            error: error.message
        });
    }
});

/**
 * @route   PUT /api/products/batch/:batchId/handover-key
 * @desc    Update the current handover key for an entire batch
 * @access  Public
 */
router.put('/batch/:batchId/handover-key', async (req, res) => {
    try {
        const { batchId } = req.params;
        const { handoverKey } = req.body;

        if (!handoverKey) {
            return res.status(400).json({
                success: false,
                message: 'Handover key is required'
            });
        }

        const Batch = (await import('../models/Batch.js')).default;
        const batch = await Batch.findOneAndUpdate(
            { batchId: parseInt(batchId) },
            { currentHandoverKey: handoverKey },
            { new: true }
        );

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: 'Batch not found'
            });
        }

        res.json({
            success: true,
            message: 'Batch handover key updated successfully',
            batchId: batch.batchId
        });
    } catch (error) {
        console.error('Update batch handover key error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update batch handover key',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/products/register
 * @desc    Save product to database after blockchain creation
 * @access  Private
 */
router.post('/register', async (req, res) => {
    try {
        const { productId, name, manufacturerAddress, consumerSecretHash, certificateFilename, certificatePath, txHash, loomLocation, weaveDate } = req.body;

        // Validate required fields
        if (!productId || !name || !manufacturerAddress || !certificateFilename) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Import Product model
        const Product = (await import('../models/Product.js')).default;
        const User = (await import('../models/User.js')).default;

        // Find manufacturer by wallet address
        const manufacturer = await User.findOne({
            walletAddress: { $regex: new RegExp(`^${manufacturerAddress}$`, 'i') }
        });

        if (!manufacturer) {
            return res.status(404).json({
                success: false,
                message: 'Manufacturer not found in database'
            });
        }

        const numericId = parseInt(productId);

        // Upsert: if this productId already exists (e.g. after contract redeploy resets counter),
        // overwrite it with the new registration rather than failing with a duplicate key error.
        const product = await Product.findOneAndUpdate(
            { productId: numericId },
            {
                $set: {
                    productId: numericId,
                    name,
                    description: req.body.description || "",
                    manufacturer: manufacturer._id,
                    manufacturerAddress: manufacturerAddress.toLowerCase(),
                    loomLocation: loomLocation || "Not Specified",
                    weaveDate: weaveDate || new Date(),
                    consumerSecretHash,
                    currentHandoverKey: req.body.currentHandoverKey || null,
                    productCertificate: {
                        filename: certificateFilename,
                        path: certificatePath || `uploads/product-certificates/${certificateFilename}`,
                        uploadedAt: new Date()
                    },
                    blockchainTxHash: txHash,
                    createdAt: new Date()
                }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        console.log('Product saved to database:', product.productId, '-', product.name);

        res.json({
            success: true,
            message: 'Product registered in database',
            product: {
                id: product.productId,
                name: product.name,
                manufacturer: manufacturer.name
            }
        });

    } catch (error) {
        console.error('Product registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to register product',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/products/by-manufacturer/:address
 * @desc    List all products registered by a manufacturer (from MongoDB)
 *          Handles both new (embedded products array) and old (productIds array) batch formats
 * @access  Public
 */
router.get('/by-manufacturer/:address', async (req, res) => {
    try {
        const { address } = req.params;

        const Product = (await import('../models/Product.js')).default;
        const Batch = (await import('../models/Batch.js')).default;

        const addrLower = address.toLowerCase();

        // Fetch all batches for this manufacturer
        const batches = await Batch.find({ manufacturerAddress: { $regex: new RegExp(`^${address}$`, 'i') } })
            .sort({ createdAt: -1 })
            .lean(); // use lean for raw objects

        // Build a set of all product IDs that belong to any batch
        const batchProductIdSet = new Set();
        const batchByProductId = {}; // productId -> batch

        for (const batch of batches) {
            // Handle NEW schema: products is an embedded array
            if (batch.products && batch.products.length > 0) {
                for (const bp of batch.products) {
                    batchProductIdSet.add(bp.productId);
                    batchByProductId[bp.productId] = batch;
                }
            }
            // Handle OLD schema: productIds is a flat array of numbers
            // (field may be named productIds from old Batch model virtual)
            const legacyIds = batch.productIds || [];
            for (const pid of legacyIds) {
                const numPid = Number(pid);
                if (!batchProductIdSet.has(numPid)) {
                    batchProductIdSet.add(numPid);
                    batchByProductId[numPid] = batch;
                }
            }
        }

        // Fetch all products for this manufacturer
        const allProducts = await Product.find({
            manufacturerAddress: { $regex: new RegExp(`^${address}$`, 'i') }
        }).sort({ createdAt: -1 })
          .select('productId name loomLocation weaveDate blockchainTxHash createdAt')
          .lean();

        // Separate single products from batch products
        const singleList = [];
        const bulkByBatchId = {}; // batchId -> {batch, items[]}

        for (const p of allProducts) {
            if (batchProductIdSet.has(p.productId)) {
                // This product belongs to a batch
                const batch = batchByProductId[p.productId];
                const bid = batch.batchId;

                if (!bulkByBatchId[bid]) {
                    bulkByBatchId[bid] = { batch, items: [] };
                }

                // Find formattedProductId from embedded products array if available
                const embeddedProduct = (batch.products || []).find(bp => bp.productId === p.productId);
                bulkByBatchId[bid].items.push({
                    productId: p.productId,
                    formattedProductId: embeddedProduct?.formattedProductId || `#${p.productId}`,
                    name: p.name,
                    loomLocation: p.loomLocation,
                    weaveDate: p.weaveDate,
                    txHash: p.blockchainTxHash,
                    registeredAt: p.createdAt,
                    type: 'bulk',
                    batchId: bid,
                    formattedBatchId: batch.formattedBatchId || `#${bid}`,
                    batchName: batch.name
                });
            } else {
                singleList.push({
                    productId: p.productId,
                    name: p.name,
                    loomLocation: p.loomLocation,
                    weaveDate: p.weaveDate,
                    txHash: p.blockchainTxHash,
                    registeredAt: p.createdAt,
                    type: 'single'
                });
            }
        }

        // Build bulk product flat list (for products array in response)
        const bulkList = Object.values(bulkByBatchId).flatMap(({ items }) => items);

        // Build batch summary list (for batches array in response)
        const batchSummaries = Object.values(bulkByBatchId).map(({ batch, items }) => ({
            batchId: batch.batchId,
            formattedBatchId: batch.formattedBatchId || `#${batch.batchId}`,
            name: batch.name || items[0]?.batchName || `Batch #${batch.batchId}`,
            quantity: items.length,
            status: batch.status || 'created',
            loomLocation: batch.loomLocation || items[0]?.loomLocation || '—',
            weaveDate: batch.weaveDate || items[0]?.weaveDate || null,
            items: items.map(i => ({
                productId: i.productId,
                formattedProductId: i.formattedProductId,
                name: i.name
            })),
            registeredAt: batch.createdAt
        }));

        // Add any batches that have no matching Product records (empty/failed batches)
        for (const batch of batches) {
            if (!bulkByBatchId[batch.batchId]) {
                batchSummaries.push({
                    batchId: batch.batchId,
                    formattedBatchId: batch.formattedBatchId || `#${batch.batchId}`,
                    name: batch.name || `Batch #${batch.batchId}`,
                    quantity: batch.quantity || 0,
                    status: batch.status || 'created',
                    loomLocation: batch.loomLocation || '—',
                    weaveDate: batch.weaveDate || null,
                    items: [],
                    registeredAt: batch.createdAt
                });
            }
        }

        // Combine and sort all flat products
        const allFlat = [...singleList, ...bulkList];
        allFlat.sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt));

        res.json({
            success: true,
            products: allFlat,
            count: allFlat.length,
            batches: batchSummaries.sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt))
        });
    } catch (error) {
        console.error('List products by manufacturer error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to list products',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/products/:productId
 * @desc    Get product details from database
 * @access  Public
 */
router.get('/:productId', async (req, res) => {
    try {
        const { productId } = req.params;

        const Product = (await import('../models/Product.js')).default;

        const product = await Product.findOne({ productId: parseInt(productId) })
            .populate('manufacturer', 'name email walletAddress');

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found in database'
            });
        }

        res.json({
            success: true,
            product: {
                id: product.productId,
                name: product.name,
                manufacturer: product.manufacturer,
                manufacturerAddress: product.manufacturerAddress,
                loomLocation: product.loomLocation,
                weaveDate: product.weaveDate,
                blockchainTxHash: product.blockchainTxHash || null,
                materialsMetadataFilename: product.materialsMetadataFilename || null,
                certificate: {
                    filename: product.productCertificate?.filename,
                    url: `/uploads/product-certificates/${product.productCertificate?.filename}`,
                    uploadedAt: product.productCertificate?.uploadedAt
                },
                createdAt: product.createdAt
            }
        });

    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve product',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/products/:id/handover-key
 * @desc    Get the current handover key for a product
 * @access  Public
 */
router.get('/:id/handover-key', async (req, res) => {
    try {
        const { id } = req.params;
        const Product = (await import('../models/Product.js')).default;
        const product = await Product.findOne({ productId: parseInt(id) });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.json({
            success: true,
            handoverKey: product.currentHandoverKey,
            productId: product.productId
        });
    } catch (error) {
        console.error('Get handover key error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get handover key',
            error: error.message
        });
    }
});

/**
 * @route   PUT /api/products/:id/handover-key
 * @desc    Update the current handover key for a product
 * @access  Public
 */
router.put('/:id/handover-key', async (req, res) => {
    try {
        const { id } = req.params;
        const { handoverKey } = req.body;

        if (!handoverKey) {
            return res.status(400).json({
                success: false,
                message: 'Handover key is required'
            });
        }

        const Product = (await import('../models/Product.js')).default;
        const product = await Product.findOneAndUpdate(
            { productId: parseInt(id) },
            { currentHandoverKey: handoverKey },
            { new: true }
        );

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }

        res.json({
            success: true,
            message: 'Handover key updated successfully',
            productId: product.productId
        });
    } catch (error) {
        console.error('Update handover key error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update handover key',
            error: error.message
        });
    }
});

export default router;
