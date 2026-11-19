import mongoose from 'mongoose';

const { Schema } = mongoose;

const requestSchema = new Schema(
    {
        societyId: {
            type: Schema.Types.ObjectId,
            ref: 'Bank',
            required: true,
            index: true,
        },
        employeeId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        branchId: {
            type: Schema.Types.ObjectId,
            ref: 'Branch',
            required: true,
            index: true,
        },
        status: {
            type: String,
            enum: ['PENDING', 'APPROVED', 'REJECTED', 'FULFILLED', 'CANCELLED'],
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

export const Request = mongoose.models.Request || mongoose.model('Request', requestSchema);
export default Request;