import mongoose from 'mongoose';

const { Schema } = mongoose;

const subcategorySchema = new Schema(
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

// Ensure code is unique per category (not globally, not just per society)
subcategorySchema.index({ categoryId: 1, code: 1 }, { unique: true });

export const Subcategory = mongoose.models.Subcategory || mongoose.model('Subcategory', subcategorySchema);
export default Subcategory;