import mongoose, { model } from 'mongoose';
import { randomUUID } from 'crypto';
import softDeletePlugin from '../database/plugins/soft-delete.plugin.js';
const { Schema } = mongoose;
const { ObjectId } = Schema.Types;

const creditReportRequestSchema = new Schema(
    {
        requestId: {
            type: String,
            required: true,
            unique: true,
            default: () => randomUUID(),
        },

        fullName: {
            type: String,
            required: true,
            trim: true,
        },

        dob: {
            type: Date,
            required: true,
        },
        pan: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
            match: [/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN format'],
        },

        mobileNumber: {
            type: String,
            trim: true,
            match: [/^[6-9]\d{9}$/, 'Invalid mobile number format'],
        },

        status: {
            type: String,
            enum: ['pending', 'processing', 'completed', 'failed'],
            default: 'pending',
            index: true,
        },

        // Raw bureau response — large and sensitive, so it's left out of
        // normal queries. Opt in with .select('+reportJson') when needed.
        reportJson: {
            type: Schema.Types.Mixed,
            default: null,
            select: false,
        },

        pdfUrl: {
            type: String,
            default: null,
        },

        pdfPublicId: {
            type: String,
            default: null,
        },

        // Society (bank/NBFC) that initiated this credit-report request.
        // Sourced from req.society.bankId set by resolveSocietyContext middleware.
        societyId: {
            type: ObjectId,
            ref: 'Bank',
            default: null,
            index: true,
        },

        // Internal user who triggered the request (req.user.id)
        requestedBy: {
            type: ObjectId,
            ref: 'User',
            default: null,
            index: true,
        },

        createdAt: {
            type: Date,
            default: Date.now,
            index: true,
        },
    },
    {
        timestamps: true,
        versionKey: false
    }
);

creditReportRequestSchema.plugin(softDeletePlugin);

// PAN history lookups ("latest requests for this PAN") + plain PAN filters
creditReportRequestSchema.index({ pan: 1, createdAt: -1 });

// Society-scoped PAN lookups — most common access pattern for the society panel
creditReportRequestSchema.index({ societyId: 1, pan: 1, createdAt: -1 });

export const CreditReportRequest = model('CreditReportRequest', creditReportRequestSchema);