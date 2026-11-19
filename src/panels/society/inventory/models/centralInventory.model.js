import mongoose from 'mongoose';

const { Schema } = mongoose;

const centralInventorySchema = new Schema(
    {
        societyId: {
            type: Schema.Types.ObjectId,
            ref: 'Bank',
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        code: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
        },
        address: {
            type: String,
            trim: true,
            default: '',
        },
        managerId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        status: {
            type: String,
            enum: ['active', 'inactive'],
            default: 'active',
        },
    },
    {
        timestamps: true,
    }
);

// Ensure code is unique per society
centralInventorySchema.index({ societyId: 1, code: 1 }, { unique: true });

export const CentralInventory = mongoose.models.CentralInventory || mongoose.model('CentralInventory', centralInventorySchema);
export default CentralInventory;