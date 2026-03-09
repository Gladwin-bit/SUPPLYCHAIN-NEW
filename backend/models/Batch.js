import mongoose from 'mongoose';

const batchSchema = new mongoose.Schema({
    batchId: {
        type: Number,
        required: true,
        unique: true
    },
    productIds: [{
        type: Number
    }],
    manufacturer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    manufacturerAddress: {
        type: String,
        required: true,
        lowercase: true
    },
    currentHandoverKey: {
        type: String,
        default: null
    },
    blockchainTxHash: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Batch = mongoose.model('Batch', batchSchema);
export default Batch;
