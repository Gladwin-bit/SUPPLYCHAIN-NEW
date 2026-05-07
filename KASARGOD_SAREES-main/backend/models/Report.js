import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
    productId: {
        type: Number,
        required: true,
        index: true
    },
    productName: { type: String, default: '' },
    productState: { type: String, default: '' },
    reporterName: { type: String, required: true, trim: true },
    reporterContact: { type: String, required: true, trim: true },
    issueType: {
        type: String,
        required: true,
        enum: ['code_already_used', 'possible_counterfeit', 'product_damaged', 'wrong_product', 'other'],
        default: 'other'
    },
    description: { type: String, required: true },
    purchaseLocation: { type: String, default: '' },
    claimedBy: { type: String, default: '' },
    claimedAt: { type: String, default: '' },
    status: {
        type: String,
        enum: ['open', 'under_review', 'resolved', 'dismissed'],
        default: 'open'
    },
    resolvedAt: { type: Date, default: null },
    resolvedNote: { type: String, default: '' }
}, { timestamps: true });

reportSchema.index({ createdAt: -1 });
reportSchema.index({ status: 1 });

const Report = mongoose.model('Report', reportSchema);
export default Report;
