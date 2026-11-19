import mongoose from 'mongoose';

const { Schema } = mongoose;

const stockSchema = new Schema(
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
        quantity: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
        },
        reservedQuantity: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
        },
    },
    {
        timestamps: true,
    }
);

// One stock record per item per location
stockSchema.index({ itemMasterId: 1, locationType: 1, locationId: 1 }, { unique: true });

export const Stock = mongoose.models.Stock || mongoose.model('Stock', stockSchema);
export default Stock;