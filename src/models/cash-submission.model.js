import mongoose from 'mongoose';
import softDeletePlugin from '../database/plugins/soft-delete.plugin.js';

const cashSubmissionSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true
    },
    onboardingTeamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OnboardingTeam',
      required: false,
      index: true
    },
    employeeName: {
      type: String,
      required: true,
      trim: true
    },
    date: {
      type: Date,
      required: true,
      default: Date.now
    },
    amountSubmitted: {
      type: Number,
      required: true,
      min: 0
    },
    bankIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bank'
      }
    ],
    paymentMode: {
      type: String,
      enum: ['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE'],
      default: 'CASH'
    },
    receiptNumber: {
      type: String,
      trim: true,
      default: ''
    },
    receiptUrl: {
      type: String,
      default: null
    },
    remarks: {
      type: String,
      trim: true,
      default: ''
    },
    status: {
      type: String,
      enum: ['SUBMITTED', 'VERIFIED', 'REJECTED'],
      default: 'VERIFIED',
      index: true
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    verifiedAt: {
      type: Date,
      default: null
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

cashSubmissionSchema.plugin(softDeletePlugin);

export const CashSubmission = mongoose.model('CashSubmission', cashSubmissionSchema);
