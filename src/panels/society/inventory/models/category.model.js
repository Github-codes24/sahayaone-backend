import mongoose from 'mongoose';

const { Schema } = mongoose;

const categorySchema = new Schema(
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
        timestamps: true, // auto-manages createdAt & updatedAt
    }
);

// Ensure code is unique per society (not globally)
categorySchema.index({ societyId: 1, code: 1 }, { unique: true });

export const Category = mongoose.models.InventoryCategory || mongoose.model('InventoryCategory', categorySchema);
export default Category;