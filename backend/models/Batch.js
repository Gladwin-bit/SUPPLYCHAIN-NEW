import mongoose from 'mongoose';

// Enhanced schema for comprehensive bulk registration management
const batchSchema = new mongoose.Schema({
    // Blockchain identifiers
    batchId: {
        type: Number,
        required: true,
        unique: true,
        index: true
    },
    formattedBatchId: {
        type: String, // e.g., "A", "B", "AA"
        index: true
    },

    // Batch metadata
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ""
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },

    // Manufacturing details
    loomLocation: {
        type: String,
        required: true
    },
    weaveDate: {
        type: Date,
        required: true
    },
    manufacturer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    manufacturerAddress: {
        type: String,
        required: true,
        lowercase: true,
        index: true
    },

    // Product details array - comprehensive details for each product in batch
    products: [{
        index: {
            type: Number,
            required: true
        },
        productId: {
            type: Number,
            required: true
        },
        formattedProductId: {
            type: String // e.g., "A1", "A2", "B1"
        },
        name: {
            type: String,
            required: true
        },
        consumerSecret: {
            type: String,
            required: true
        },
        consumerSecretHash: {
            type: String,
            required: true
        },
        status: {
            type: String,
            enum: ['created', 'in_transit', 'delivered', 'claimed', 'verified'],
            default: 'created'
        }
    }],

    // Certificate information
    certificate: {
        filename: {
            type: String,
            required: true
        },
        path: {
            type: String,
            required: true
        },
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    },

    // Handover key management
    currentHandoverKey: {
        type: String,
        required: true
    },
    handoverHistory: [{
        key: String,
        fromAddress: String,
        toAddress: String,
        transferredAt: {
            type: Date,
            default: Date.now
        },
        location: String
    }],

    // Waybill information
    waybill: {
        isGenerated: {
            type: Boolean,
            default: false
        },
        generatedAt: {
            type: Date
        },
        qrPayload: {
            type: String // JSON string of waybill data
        },
        downloadCount: {
            type: Number,
            default: 0
        }
    },

    // Email tracking
    emailNotifications: [{
        recipientEmail: String,
        sentAt: {
            type: Date,
            default: Date.now
        },
        type: {
            type: String,
            enum: ['waybill', 'certificate', 'completion']
        },
        status: {
            type: String,
            enum: ['pending', 'sent', 'failed'],
            default: 'pending'
        }
    }],

    // Status and tracking
    status: {
        type: String,
        enum: ['created', 'in_production', 'ready_for_shipment', 'in_transit', 'delivered', 'completed'],
        default: 'created'
    },
    isActive: {
        type: Boolean,
        default: true
    },

    // Blockchain information
    blockchainTxHash: {
        type: String,
        required: true,
        index: true
    },
    blockNumber: {
        type: Number
    },
    gasUsed: {
        type: String
    },

    // Analytics and metrics
    metrics: {
        totalScans: {
            type: Number,
            default: 0
        },
        verificationCount: {
            type: Number,
            default: 0
        },
        lastActivity: {
            type: Date,
            default: Date.now
        }
    }
}, {
    timestamps: true,
    // Add virtual for product count
    virtuals: true,
    // Include virtuals in JSON output
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for better query performance
batchSchema.index({ manufacturer: 1, createdAt: -1 });
batchSchema.index({ manufacturerAddress: 1, status: 1 });
batchSchema.index({ 'products.productId': 1 });
batchSchema.index({ blockchainTxHash: 1 });
batchSchema.index({ status: 1, isActive: 1 });

// Virtual for product IDs array (for backward compatibility)
batchSchema.virtual('productIds').get(function() {
    return this.products ? this.products.map(p => p.productId) : [];
});

// Instance methods
batchSchema.methods.addProduct = function(productData) {
    this.products.push(productData);
    this.quantity = this.products.length;
};

batchSchema.methods.updateProductStatus = function(productId, status) {
    const product = this.products.find(p => p.productId === productId);
    if (product) {
        product.status = status;
        this.metrics.lastActivity = new Date();
    }
};

batchSchema.methods.generateWaybill = function() {
    if (!this.waybill.isGenerated) {
        this.waybill.isGenerated = true;
        this.waybill.generatedAt = new Date();
        this.waybill.qrPayload = JSON.stringify({
            type: "BATCH_WAYBILL",
            batchId: this.batchId,
            formattedBatchId: this.formattedBatchId,
            handoverKey: this.currentHandoverKey,
            senderAddress: this.manufacturerAddress,
            batchName: this.name,
            productCount: this.quantity,
            issuedAt: new Date().toISOString()
        });
    }
    return this.waybill.qrPayload;
};

// Static methods
batchSchema.statics.findByFormattedId = function(formattedId) {
    return this.findOne({ formattedBatchId: formattedId });
};

batchSchema.statics.findActiveByManufacturer = function(manufacturerAddress) {
    return this.find({
        manufacturerAddress: manufacturerAddress.toLowerCase(),
        isActive: true
    }).sort({ createdAt: -1 });
};

const Batch = mongoose.model('Batch', batchSchema);
export default Batch;
