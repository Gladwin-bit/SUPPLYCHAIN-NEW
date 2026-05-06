import express from 'express';
import { sendHandoverKeyEmail, sendBatchHandoverKeyEmail } from '../services/emailService.js';

const router = express.Router();

/**
 * @route   POST /api/email/send-handover-key
 * @desc    Send handover key to intended recipient via email
 * @access  Public (called from frontend after blockchain transaction)
 */
router.post('/send-handover-key', async (req, res) => {
    try {
        const { recipientEmail, productId, productName, handoverKey } = req.body;

        // Validate required fields
        if (!recipientEmail || !productId || !handoverKey) {
            return res.status(400).json({
                success: false,
                message: 'recipientEmail, productId, and handoverKey are required'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(recipientEmail)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email address format'
            });
        }

        // Check email config is set
        if (!process.env.BREVO_API_KEY && !process.env.EMAIL_USER) {
            console.error('Email credentials (BREVO_API_KEY or EMAIL_USER) not configured in environment');
            return res.status(500).json({
                success: false,
                message: 'Email service is not configured on the server'
            });
        }

        await sendHandoverKeyEmail(recipientEmail, productId, productName, handoverKey);

        res.json({
            success: true,
            message: `Handover key email sent successfully to ${recipientEmail}`
        });

    } catch (error) {
        console.error('Send handover key email error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send handover key email',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/email/send-batch-handover-key
 * @desc    Send batch handover key to intended recipient via email
 * @access  Public (called from frontend after blockchain transaction)
 */
router.post('/send-batch-handover-key', async (req, res) => {
    try {
        const { recipientEmail, batchId, handoverKey } = req.body;

        // Validate required fields
        if (!recipientEmail || !batchId || !handoverKey) {
            return res.status(400).json({
                success: false,
                message: 'recipientEmail, batchId, and handoverKey are required'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(recipientEmail)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email address format'
            });
        }

        // Check email config is set
        if (!process.env.BREVO_API_KEY && !process.env.EMAIL_USER) {
            console.error('Email credentials (BREVO_API_KEY or EMAIL_USER) not configured in environment');
            return res.status(500).json({
                success: false,
                message: 'Email service is not configured on the server'
            });
        }

        await sendBatchHandoverKeyEmail(recipientEmail, batchId, handoverKey);

        res.json({
            success: true,
            message: `Batch handover key email sent successfully to ${recipientEmail}`
        });

    } catch (error) {
        console.error('Send batch handover key email error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send batch handover key email',
            error: error.message
        });
    }
});

export default router;
