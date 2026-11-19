import mongoose from 'mongoose';

const { Schema } = mongoose;

const stockAdjustmentSchema = new Schema(
    {
        societyId: {
            type: Schema.Types.ObjectId,
            ref: 'Bank',
            required: true,
            index: true,
        },
        branchId: {
            type: Schema.Types.ObjectId,
            ref: 'Branch',
            required: true,
            index: true,
        },
        itemMasterId: {
            type: Schema.Types.ObjectId,
            ref: 'InventoryItems',
            required: true,
            index: true,
        },
        assetId: {
            type: Schema.Types.ObjectId,
            ref: 'Asset',
            default: null,
        },
        locationType: {
            type: String,
            enum: ['CentralInventory', 'Branch'],
            required: true,
        },
        locationId: {
            type: Schema.Types.ObjectId,
            required: true,
            refPath: 'locationType',
        },
        adjustmentType: {
            type: String,
            enum: ['INCREASE', 'DECREASE'],
            required: true,
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
        },
        reason: {
            type: String,
            enum: ['DAMAGE', 'LOST', 'AUDIT_DISCREPANCY', 'RECOVERY', 'EXPIRED'],
            required: true,
        },
        status: {
            type: String,
            enum: ['PENDING', 'APPROVED', 'REJECTED'],
            default: 'PENDING',
            index: true,
        },
        requestedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        approvedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        remarks: {
            type: String,
            trim: true,
            default: '',
        },
    },
    {
        timestamps: true,
    }
);

export const StockAdjustment =
    mongoose.models.StockAdjustment || mongoose.model('StockAdjustment', stockAdjustmentSchema);
export default StockAdjustment;
