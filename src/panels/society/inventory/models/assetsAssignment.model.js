import mongoose from 'mongoose';

const { Schema } = mongoose;

const assetsAssignmentSchema = new Schema(
    {
        assetId: {
            type: Schema.Types.ObjectId,
            ref: 'Asset',
            required: true,
        },
        employeeId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        branchId: {
            type: Schema.Types.ObjectId,
            ref: 'Branch',
            required: true,
        },
        assignedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        assignedAt: {
            type: Date,
            required: true,
        },
        condition: {
            type: String,
        },
        remarks: {
            type: String,
            trim: true,
            default: '',
        },
        returnedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

export const AssetsAssignment = mongoose.models.AssetsAssignment || mongoose.model('AssetsAssignment', assetsAssignmentSchema);
export default AssetsAssignment;