import mongoose from 'mongoose';

const { Schema } = mongoose;

const inventoryItemsSchema = new Schema(
    {
        societyId: {
            type: Schema.Types.ObjectId,
            ref: 'Bank',
            required: true,
            index: true,
        },
        categoryId: {
            type: Schema.Types.ObjectId,
            ref: 'InventoryCategory',
            required: true,
            index: true,
        },
        subcategoryId: {
            type: Schema.Types.ObjectId,
            ref: 'Subcategory',
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
        description: {
            type: String,
            trim: true,
            default: '',
        },
        type: {
            type: String,
            trim: true,
        },
        unit: {
            type: String,
            required: true,
            trim: true,
        },
        brand: {
            type: String,
            trim: true,
            default: '',
        },
        model: {
            type: String,
            trim: true,
            default: '',
        },
        isSerialized: {
            type: Boolean,
            default: false,
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
inventoryItemsSchema.index({ societyId: 1, code: 1 }, { unique: true });

export const InventoryItems = mongoose.models.InventoryItems || mongoose.model('InventoryItems', inventoryItemsSchema);
export default InventoryItems;