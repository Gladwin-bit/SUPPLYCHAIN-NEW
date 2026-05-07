import express from 'express';
import Report from '../models/Report.js';

const router = express.Router();

// POST /api/reports  — file a new issue report
router.post('/', async (req, res) => {
    try {
        const {
            productId,
            reporterName,
            reporterContact,
            issueType,
            description,
            purchaseLocation,
            purchaseDate,
            productName,
            productState,
            claimedBy,
            claimedAt
        } = req.body;

        if (!productId || !reporterName || !reporterContact || !issueType || !description) {
            return res.status(400).json({ success: false, error: 'Missing required fields: productId, reporterName, reporterContact, issueType, description' });
        }

        const validTypes = ['possible_counterfeit', 'code_already_used', 'product_damaged', 'wrong_product', 'other'];
        if (!validTypes.includes(issueType)) {
            return res.status(400).json({ success: false, error: 'Invalid issueType' });
        }

        const report = await Report.create({
            productId,
            reporterName: String(reporterName).slice(0, 100),
            reporterContact: String(reporterContact).slice(0, 100),
            issueType,
            description: String(description).slice(0, 1000),
            purchaseLocation: purchaseLocation ? String(purchaseLocation).slice(0, 200) : '',
            purchaseDate: purchaseDate ? String(purchaseDate).slice(0, 50) : '',
            productName: productName || '',
            productState: productState || '',
            claimedBy: claimedBy || '',
            claimedAt: claimedAt || ''
        });

        res.status(201).json({ success: true, reportId: report._id, createdAt: report.createdAt });
    } catch (err) {
        console.error('[Reports] POST /api/reports error:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// GET /api/reports  — list all reports (admin use)
router.get('/', async (req, res) => {
    try {
        const { productId, status, limit = 50, skip = 0 } = req.query;
        const filter = {};
        if (productId) filter.productId = Number(productId);
        if (status) filter.status = status;

        const reports = await Report.find(filter)
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip(Number(skip))
            .lean();

        res.json({ success: true, count: reports.length, reports });
    } catch (err) {
        console.error('[Reports] GET /api/reports error:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// GET /api/reports/count  — get number of open reports
router.get('/count', async (req, res) => {
    try {
        const openCount = await Report.countDocuments({ status: 'open' });
        res.json({ success: true, openCount });
    } catch (err) {
        console.error('[Reports] GET /api/reports/count error:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// PATCH /api/reports/:id/status  — update report status
router.patch('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, resolvedNote } = req.body;

        const validStatuses = ['open', 'under_review', 'resolved', 'dismissed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status value' });
        }

        const update = { status };
        if (status === 'resolved' || status === 'dismissed') {
            update.resolvedAt = new Date();
            if (resolvedNote) update.resolvedNote = resolvedNote;
        }

        const report = await Report.findByIdAndUpdate(id, update, { new: true });
        if (!report) return res.status(404).json({ success: false, error: 'Report not found' });

        res.json({ success: true, report });
    } catch (err) {
        console.error('[Reports] PATCH /api/reports/:id/status error:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

export default router;
