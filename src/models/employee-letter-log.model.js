import mongoose from 'mongoose';
import softDeletePlugin from '../database/plugins/soft-delete.plugin.js';

const employeeLetterLogSchema = new mongoose.Schema(
  {
    bankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bank',
      required: true,
      index: true
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
      index: true
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SocietyEmployee',
      required: true,
      index: true
    },
    referenceNumber: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    employeeName: {
      type: String,
      required: true,
      trim: true
    },
    employeeEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    documentType: {
      type: String,
      required: true,
      trim: true
    },
    documentTypeCode: {
      type: String,
      required: true,
      enum: [
        'OFFER_LETTER',
        'CONFIRMATION_LETTER',
        'PERFORMANCE_LETTER',
        'PROMOTION_LETTER',
        'TRANSFER_LETTER',
        'SALARY_SLIP',
        'SALARY_INCREMENT',
        'TERMINATION_LETTER'
      ],
      index: true
    },
    issuedDate: {
      type: Date,
      default: Date.now,
      index: true
    },
    detailsSummary: {
      type: String,
      default: '',
      trim: true
    },
    fileUrl: {
      type: String,
      default: null
    },
    fileKey: {
      type: String,
      default: null
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({})
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

employeeLetterLogSchema.index({ bankId: 1, branchId: 1 });
employeeLetterLogSchema.index({ bankId: 1, employeeId: 1 });
employeeLetterLogSchema.index({ bankId: 1, documentTypeCode: 1 });
employeeLetterLogSchema.plugin(softDeletePlugin);

export const EmployeeLetterLog = mongoose.model('EmployeeLetterLog', employeeLetterLogSchema);
