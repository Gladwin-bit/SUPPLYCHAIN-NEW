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

export default router;
