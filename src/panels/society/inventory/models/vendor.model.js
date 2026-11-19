import mongoose from 'mongoose';

const { Schema } = mongoose;

const vendorSchema = new Schema(
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
        contactPerson: {
            type: String,
            trim: true,
            default: '',
        },
        phone: {
            type: String,
            trim: true,
            default: '',
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
            default: '',
        },
        address: {
            type: String,
            trim: true,
            default: '',
        },
        gstNumber: {
            type: String,
            trim: true,
            uppercase: true,
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

// Ensure vendor code is unique per society
vendorSchema.index({ societyId: 1, code: 1 }, { unique: true });

// GST number, when present, should be unique per society too
vendorSchema.index(
    { societyId: 1, gstNumber: 1 },
    { unique: true, partialFilterExpression: { gstNumber: { $exists: true, $ne: '' } } }
);

export const Vendor = mongoose.models.Vendor || mongoose.model('Vendor', vendorSchema);
export default Vendor;