import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
    productId: {
        type: Number,
        required: true,
        index: true
    },
    reporterName: {
        type: String,
        required: true,
        trim: true
    },
    reporterContact: {
        type: String,
        required: true,
        trim: true
    },
    issueType: {
        type: String,
        required: true,
        enum: ['possible_counterfeit', 'code_already_used', 'product_damaged', 'wrong_product', 'other']
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    purchaseLocation: {
        type: String,
        trim: true,
        default: ''
    },
    purchaseDate: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['open', 'under_review', 'resolved', 'dismissed'],
        default: 'open'
    },
    // Metadata from blockchain at time of report
    productName: { type: String, default: '' },
    productState: { type: String, default: '' },
    claimedBy: { type: String, default: '' },        // name of original claimant
    claimedAt: { type: String, default: '' },         // timestamp of original claim
}, {
    timestamps: true
});

reportSchema.index({ productId: 1, createdAt: -1 });

const Report = mongoose.model('Report', reportSchema);
export default Report;
