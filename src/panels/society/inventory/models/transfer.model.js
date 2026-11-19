import mongoose from 'mongoose';

const { Schema } = mongoose;

const transferSchema = new Schema(
    {
        societyId: {
            type: Schema.Types.ObjectId,
            ref: 'Bank',
            required: true,
            index: true,
        },
        fromLocationType: {
            type: String,
            enum: ['CentralInventory', 'Branch'],
            required: true,
        },
        fromLocationId: {
            type: Schema.Types.ObjectId,
            required: true,
            refPath: 'fromLocationType',
        },
        toLocationType: {
            type: String,
            enum: ['CentralInventory', 'Branch'],
            required: true,
        },
        toLocationId: {
            type: Schema.Types.ObjectId,
            required: true,
            refPath: 'toLocationType',
        },
        requestedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        status: {
            type: String,
            enum: ['PENDING', 'APPROVED', 'DISPATCHED', 'RECEIVED'],
            default: 'PENDING',
            index: true,
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

export const Transfer = mongoose.models.Transfer || mongoose.model('Transfer', transferSchema);
export default Transfer;