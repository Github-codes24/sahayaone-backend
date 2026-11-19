import mongoose from 'mongoose';

const { Schema } = mongoose;

const transferItemSchema = new Schema(
    {
        transferId: {
            type: Schema.Types.ObjectId,
            ref: 'Transfer',
            required: true,
            index: true,
        },
        itemMasterId: {
            type: Schema.Types.ObjectId,
            ref: 'InventoryItems',
            required: true,
            index: true,
        },
        quantity: {
            type: Number,
            required: true,
            min: 0,
        },
    },
    {
        timestamps: true,
    }
);

// Prevent the same item being added twice to one transfer
transferItemSchema.index({ transferId: 1, itemMasterId: 1 }, { unique: true });

export const TransferItem = mongoose.models.TransferItem || mongoose.model('TransferItem', transferItemSchema);
export default TransferItem;