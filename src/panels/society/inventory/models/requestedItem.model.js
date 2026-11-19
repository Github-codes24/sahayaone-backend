import mongoose from 'mongoose';

const { Schema } = mongoose;

const requestItemSchema = new Schema(
    {
        requestId: {
            type: Schema.Types.ObjectId,
            ref: 'Request',
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
        status: {
            type: String,
            enum: ['PENDING', 'APPROVED', 'REJECTED', 'FULFILLED', 'CANCELLED'],
            default: 'PENDING',
        },
    },
    {
        timestamps: true,
    }
);

// Prevent the same item being added twice to one request
requestItemSchema.index({ requestId: 1, itemMasterId: 1 }, { unique: true });

export const RequestItem = mongoose.models.RequestItem || mongoose.model('RequestItem', requestItemSchema);
export default RequestItem;