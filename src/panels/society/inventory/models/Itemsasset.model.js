import mongoose from 'mongoose';

const { Schema } = mongoose;

const assetSchema = new Schema(
    {
        societyId: {
            type: Schema.Types.ObjectId,
            ref: 'Bank',
            required: true,
            index: true,
        },
        itemMasterId: {
            type: Schema.Types.ObjectId,
            ref: 'InventoryItems',
            required: true,
            index: true,
        },
        assetTag: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
        },
        serialNumber: {
            type: String,
            trim: true,
            default: '',
        },
        currentLocationType: {
            type: String,
            enum: ['CentralInventory', 'Branch', 'User'], // adjust to your actual location types
            required: true,
        },
        currentLocationId: {
            type: Schema.Types.ObjectId,
            required: true,
            refPath: 'currentLocationType',
        },
        currentEmployeeId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        condition: {
            type: String,
            enum: ['new', 'good', 'fair', 'damaged', 'scrapped'],
            default: 'new',
        },
        status: {
            type: String,
            enum: ['active', 'in_repair', 'retired', 'lost'],
            default: 'active',
        },
        purchaseDate: {
            type: Date,
        },
        purchasePrice: {
            type: Number,
            min: 0,
        },
        vendorId: {
            type: Schema.Types.ObjectId,
            ref: 'Vendor',
            index: true,
        },
        warrantyStartDate: {
            type: Date,
        },
        warrantyEndDate: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

// Ensure assetTag is unique per society
assetSchema.index({ societyId: 1, assetTag: 1 }, { unique: true });

// Serial number unique per society too (if present)
assetSchema.index(
    { societyId: 1, serialNumber: 1 },
    { unique: true, partialFilterExpression: { serialNumber: { $exists: true, $ne: '' } } }
);

export const Asset = mongoose.models.Asset || mongoose.model('Asset', assetSchema);
export default Asset;