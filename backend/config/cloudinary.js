import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

// Configure Cloudinary with credentials from env vars
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Storage for product certificates (PDF + images)
const certificateStorage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
        const isPdf = file.mimetype === 'application/pdf';
        return {
            folder: 'kasaragod-sarees/product-certificates',
            resource_type: isPdf ? 'raw' : 'image',
            allowed_formats: ['pdf', 'png', 'jpg', 'jpeg'],
            public_id: `product-cert-${Date.now()}-${Math.round(Math.random() * 1e9)}`
        };
    }
});

// Storage for ID proof documents (user registration)
const idProofStorage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
        const isPdf = file.mimetype === 'application/pdf';
        return {
            folder: 'kasaragod-sarees/id-proofs',
            resource_type: isPdf ? 'raw' : 'image',
            allowed_formats: ['pdf', 'png', 'jpg', 'jpeg'],
            public_id: `id-proof-${Date.now()}-${Math.round(Math.random() * 1e9)}`
        };
    }
});

// File filter for certificates and documents
const fileFilter = (req, file, cb) => {
    const allowedMimes = ['application/pdf', 'image/png', 'image/jpg', 'image/jpeg'];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only PDF and image files (PNG, JPG) are allowed'), false);
    }
};

// Multer upload instances
export const uploadCertificate = multer({
    storage: certificateStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter
});

export const uploadIdProof = multer({
    storage: idProofStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter
});

export { cloudinary };
