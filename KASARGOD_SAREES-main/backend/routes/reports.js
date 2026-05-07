import express from 'express';
import Report from '../models/Report.js';

const router = express.Router();

// Logging middleware for this router
router.use((req, res, next) => {
    console.log(`[ReportsRouter] Incoming: ${req.method} ${req.url}`);
    next();
});

/**
 * @route   GET /api/reports/count
 * @desc    Get open report count (for badge)
 * @access  Public
 */
router.get('/count', async (req, res) => {
    try {
        const openCount = await Report.countDocuments({ status: 'open' });
        return res.json({ success: true, openCount });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   PATCH /api/reports/:id/status
 * @desc    Update report status
 * @access  Public
 */
router.patch('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, resolvedNote } = req.body;
        console.log(`[ReportsRouter] Updating report ${id} to status: ${status}`);

        const validStatuses = ['open', 'under_review', 'resolved', 'dismissed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status value' });
        }

        const update = { status };
        if (status === 'resolved' || status === 'dismissed') {
            update.resolvedAt = new Date();
            if (resolvedNote) update.resolvedNote = resolvedNote;
        }

        const report = await Report.findByIdAndUpdate(id, update, { new: true });
        if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

        return res.json({ success: true, report });
    } catch (err) {
        console.error('[ReportsRouter] Update report status error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   GET /api/reports
 * @desc    Get all reports (manufacturer dashboard)
 * @access  Public
 */
router.get('/', async (req, res) => {
    try {
        const { status, limit = 50, skip = 0 } = req.query;
        const filter = {};
        if (status) filter.status = status;

        const [reports, total] = await Promise.all([
            Report.find(filter)
                .sort({ createdAt: -1 })
                .skip(parseInt(skip))
                .limit(parseInt(limit))
                .lean(),
            Report.countDocuments(filter)
        ]);

        const openCount = await Report.countDocuments({ status: 'open' });

        return res.json({
            success: true,
            reports,
            total,
            openCount
        });
    } catch (err) {
        console.error('[ReportsRouter] Get reports error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   POST /api/reports
 * @desc    Customer submits an issue report
 * @access  Public
 */
router.post('/', async (req, res) => {
    try {
        const {
            productId,
            productName,
            productState,
            reporterName,
            reporterContact,
            issueType,
            description,
            purchaseLocation,
            claimedBy,
            claimedAt
        } = req.body;

        if (!productId || !reporterName?.trim() || !reporterContact?.trim() || !description?.trim()) {
            return res.status(400).json({
                success: false,
                message: 'productId, reporterName, reporterContact and description are required'
            });
        }

        const report = await Report.create({
            productId: parseInt(productId),
            productName: productName || '',
            productState: productState || '',
            reporterName: reporterName.trim(),
            reporterContact: reporterContact.trim(),
            issueType: issueType || 'other',
            description: description.trim(),
            purchaseLocation: purchaseLocation?.trim() || '',
            claimedBy: claimedBy || '',
            claimedAt: claimedAt || ''
        });

        console.log('[ReportsRouter] Report created:', report._id);

        return res.status(201).json({
            success: true,
            message: 'Report submitted successfully',
            reportId: report._id
        });
    } catch (err) {
        console.error('[ReportsRouter] Create report error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Diagnostic catch-all
router.all('*', (req, res) => {
    console.log(`[ReportsRouter] No match for: ${req.method} ${req.url}`);
    res.status(404).json({
        success: false,
        message: `Route ${req.url} not found in ReportsRouter`
    });
});

export default router;
