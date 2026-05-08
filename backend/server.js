import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Import routes
import authRoutes from './routes/auth.js';
import certificateRoutes from './routes/certificate.js';
import productRoutes from './routes/product.js';
import batchRoutes from './routes/batch.js';
import signatureRoutes from './routes/signature.js';
import emailRoutes from './routes/email.js';
import reportRoutes from './routes/report.js';
import verifyRoutes from './routes/verify.js';

// Load environment variables
dotenv.config();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Express app
const app = express();

// Middleware
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5000',
    process.env.FRONTEND_URL,
    'https://kasargod-sarees.vercel.app'
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (Postman, mobile apps, server-to-server)
        if (!origin) return callback(null, true);
        // Allow any vercel.app subdomain (handles preview deployments)
        if (origin.endsWith('.vercel.app')) return callback(null, true);
        // Allow explicitly listed origins
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically (for development)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/products', productRoutes);
app.use('/api/batch', batchRoutes);
app.use('/api/signature', signatureRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/verify', verifyRoutes);

// Health check route
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Supply Chain Backend API is running',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);

    // Multer errors
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File too large. Maximum size is 5MB.'
            });
        }
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }

    // Custom file filter errors
    if (err.message && err.message.includes('files are allowed')) {
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }

    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// MongoDB connection
const resolveMongoUri = () => {
    const primary = process.env.MONGODB_URI?.trim();
    const atlas = process.env.MONGODB_ATLAS_URI?.trim();
    const forceCloud = process.env.FORCE_CLOUD_DB === 'true';

    // Prefer explicit Atlas URI when cloud mode is requested.
    if (forceCloud && atlas) return atlas;

    // Primary URI can still be used when cloud mode is not forced.
    if (primary && (!forceCloud || !primary.includes('localhost'))) return primary;

    // If primary points to localhost but Atlas URI exists, auto-promote to Atlas.
    if (primary?.includes('localhost') && atlas) return atlas;

    if (forceCloud) {
        throw new Error('FORCE_CLOUD_DB=true but no cloud MongoDB URI found. Set MONGODB_ATLAS_URI.');
    }

    if (!primary && atlas) return atlas;
    if (!primary) throw new Error('MongoDB URI missing. Set MONGODB_URI or MONGODB_ATLAS_URI.');

    return primary;
};

const connectDB = async () => {
    try {
        const mongoUri = resolveMongoUri();
        const conn = await mongoose.connect(mongoUri, {
            // These options are no longer needed in Mongoose 6+
            // but keeping them for compatibility
        });

        const isCloud = conn.connection.host && !conn.connection.host.includes('localhost');
        console.log(`✅ MongoDB Connected: ${conn.connection.host} (${isCloud ? 'cloud' : 'local'})`);
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    await connectDB();

    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📡 API available at http://localhost:${PORT}/api`);
        console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
    });
};

startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Rejection:', err);
    process.exit(1);
});
