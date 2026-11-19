import mongoose from 'mongoose';

const { Schema } = mongoose;

const auditLogSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    action: {
        type: String,
        required: true,
    },
    entityType: {
        type: String,
        required: true,
    },
    entityId: {
        type: Schema.Types.ObjectId,
        required: true,
        refPath: 'entityType',
    },
    oldValue: {
        type: Schema.Types.Mixed,
    },
    newValue: {
        type: Schema.Types.Mixed,
    },
    remarks: {
        type: String,
        trim: true,
        default: '',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;