// backend/routes/batch.js
// Specialized endpoints for enhanced batch management
import express from 'express';
import QRCode from 'qrcode';
import { encryptForQR } from '../utils/qrEncryption.js';

const router = express.Router();

/**
 * @route   GET /api/batch/:batchId
 * @desc    Get comprehensive batch details
 * @access  Public
 */
router.get('/:batchId', async (req, res) => {
    try {
        const { batchId } = req.params;
        const { formatted } = req.query; // Support formatted ID lookup

        const Batch = (await import('../models/Batch.js')).default;

        let batch;
        if (formatted === 'true' || isNaN(batchId)) {
            // Look up by formatted ID (e.g., "A", "B")
            batch = await Batch.findByFormattedId(batchId).populate('manufacturer', 'name email');
        } else {
            // Look up by numeric ID
            batch = await Batch.findOne({ batchId: parseInt(batchId) }).populate('manufacturer', 'name email');
        }

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: `Batch ${batchId} not found`
            });
        }

        res.json({
            success: true,
            batch: {
                batchId: batch.batchId,
                formattedBatchId: batch.formattedBatchId,
                name: batch.name,
                description: batch.description,
                quantity: batch.quantity,
                loomLocation: batch.loomLocation,
                weaveDate: batch.weaveDate,
                manufacturer: batch.manufacturer,
                manufacturerAddress: batch.manufacturerAddress,
                products: batch.products.map(p => ({
                    index: p.index,
                    productId: p.productId,
                    formattedProductId: p.formattedProductId,
                    name: p.name,
                    status: p.status
                    // Note: consumerSecret is not exposed for security
                })),
                certificate: batch.certificate,
                status: batch.status,
                isActive: batch.isActive,
                waybill: {
                    isGenerated: batch.waybill.isGenerated,
                    generatedAt: batch.waybill.generatedAt,
                    downloadCount: batch.waybill.downloadCount
                },
                metrics: batch.metrics,
                createdAt: batch.createdAt,
                updatedAt: batch.updatedAt
            }
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
 * @route   GET /api/batch/:batchId/waybill
 * @desc    Generate and download waybill for batch
 * @access  Public
 */
router.get('/:batchId/waybill', async (req, res) => {
    try {
        const { batchId } = req.params;
        const { format } = req.query; // 'qr', 'json', or 'download'

        const Batch = (await import('../models/Batch.js')).default;

        const batch = await Batch.findOne({
            $or: [
                { batchId: parseInt(batchId) || 0 },
                { formattedBatchId: batchId }
            ]
        });

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: `Batch ${batchId} not found`
            });
        }

        // Generate waybill if not already generated
        const waybillPayload = batch.generateWaybill();

        // Increment download counter
        batch.waybill.downloadCount += 1;
        await batch.save();

        if (format === 'qr') {
            // Return QR code as PNG image (encrypted payload)
            const encryptedPayload = encryptForQR(waybillPayload);
            const qrCodeDataURL = await QRCode.toDataURL(encryptedPayload, {
                width: 300,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });

            const base64Data = qrCodeDataURL.replace(/^data:image\/png;base64,/, '');
            const imgBuffer = Buffer.from(base64Data, 'base64');

            res.set({
                'Content-Type': 'image/png',
                'Content-Disposition': `attachment; filename="waybill-${batch.formattedBatchId || batchId}-qr.png"`
            });

            return res.send(imgBuffer);

        } else if (format === 'json') {
            // Return waybill data as JSON
            res.json({
                success: true,
                waybill: {
                    batchId: batch.batchId,
                    formattedBatchId: batch.formattedBatchId,
                    payload: waybillPayload,
                    isGenerated: batch.waybill.isGenerated,
                    downloadCount: batch.waybill.downloadCount,
                    generatedAt: batch.waybill.generatedAt
                }
            });

        } else {
            // Default: Return comprehensive waybill info
            const waybillData = JSON.parse(waybillPayload);

            res.json({
                success: true,
                waybill: {
                    ...waybillData,
                    metadata: {
                        downloadCount: batch.waybill.downloadCount,
                        isGenerated: batch.waybill.isGenerated,
                        generatedAt: batch.waybill.generatedAt
                    }
                }
            });
        }

    } catch (error) {
        console.error('Waybill generation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate waybill',
            error: error.message
        });
    }
});

/**
 * @route   PUT /api/batch/:batchId/status
 * @desc    Update batch status
 * @access  Private (Auth required)
 */
router.put('/:batchId/status', async (req, res) => {
    try {
        const { batchId } = req.params;
        const { status, location, remarks } = req.body;

        const validStatuses = ['created', 'in_production', 'ready_for_shipment', 'in_transit', 'delivered', 'completed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Valid statuses: ${validStatuses.join(', ')}`
            });
        }

        const Batch = (await import('../models/Batch.js')).default;

        const batch = await Batch.findOne({
            $or: [
                { batchId: parseInt(batchId) || 0 },
                { formattedBatchId: batchId }
            ]
        });

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: `Batch ${batchId} not found`
            });
        }

        // Update status and metrics
        batch.status = status;
        batch.metrics.lastActivity = new Date();

        // Add to handover history if location provided
        if (location) {
            batch.handoverHistory.push({
                key: batch.currentHandoverKey,
                fromAddress: batch.manufacturerAddress,
                toAddress: null, // Would be set in actual transfer
                transferredAt: new Date(),
                location: location
            });
        }

        await batch.save();

        res.json({
            success: true,
            message: `Batch ${batch.formattedBatchId || batch.batchId} status updated to ${status}`,
            batch: {
                batchId: batch.batchId,
                formattedBatchId: batch.formattedBatchId,
                status: batch.status,
                lastActivity: batch.metrics.lastActivity
            }
        });

    } catch (error) {
        console.error('Update batch status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update batch status',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/batch/manufacturer/:address
 * @desc    Get all batches for a manufacturer
 * @access  Public
 */
router.get('/manufacturer/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const { page = 1, limit = 10, status } = req.query;

        const Batch = (await import('../models/Batch.js')).default;

        const query = { manufacturerAddress: address.toLowerCase() };
        if (status) {
            query.status = status;
        }

        const batches = await Batch.find(query)
            .populate('manufacturer', 'name email')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Batch.countDocuments(query);

        res.json({
            success: true,
            batches: batches.map(batch => ({
                batchId: batch.batchId,
                formattedBatchId: batch.formattedBatchId,
                name: batch.name,
                quantity: batch.quantity,
                status: batch.status,
                loomLocation: batch.loomLocation,
                weaveDate: batch.weaveDate,
                createdAt: batch.createdAt,
                waybillGenerated: batch.waybill.isGenerated
            })),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Get manufacturer batches error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve manufacturer batches',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/batch/:batchId/analytics
 * @desc    Get batch analytics and metrics
 * @access  Public
 */
router.get('/:batchId/analytics', async (req, res) => {
    try {
        const { batchId } = req.params;

        const Batch = (await import('../models/Batch.js')).default;

        const batch = await Batch.findOne({
            $or: [
                { batchId: parseInt(batchId) || 0 },
                { formattedBatchId: batchId }
            ]
        });

        if (!batch) {
            return res.status(404).json({
                success: false,
                message: `Batch ${batchId} not found`
            });
        }

        // Product status distribution
        const statusDistribution = batch.products.reduce((acc, product) => {
            acc[product.status] = (acc[product.status] || 0) + 1;
            return acc;
        }, {});

        res.json({
            success: true,
            analytics: {
                batchId: batch.batchId,
                formattedBatchId: batch.formattedBatchId,
                overview: {
                    totalProducts: batch.quantity,
                    status: batch.status,
                    isActive: batch.isActive,
                    daysOld: Math.floor((new Date() - batch.createdAt) / (1000 * 60 * 60 * 24))
                },
                products: {
                    statusDistribution,
                    completionRate: (statusDistribution.verified || 0) / batch.quantity * 100
                },
                waybill: {
                    isGenerated: batch.waybill.isGenerated,
                    downloadCount: batch.waybill.downloadCount,
                    generatedAt: batch.waybill.generatedAt
                },
                metrics: batch.metrics,
                handoverHistory: batch.handoverHistory.map(h => ({
                    transferredAt: h.transferredAt,
                    location: h.location,
                    fromAddress: h.fromAddress,
                    toAddress: h.toAddress
                }))
            }
        });

    } catch (error) {
        console.error('Get batch analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve batch analytics',
            error: error.message
        });
    }
});

export default router;