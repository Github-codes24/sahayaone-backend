import mongoose from 'mongoose';
import softDeletePlugin from '../database/plugins/soft-delete.plugin.js';

const cardCreditUsageSchema = new mongoose.Schema(
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
      required: true,
      index: true
    },
    loanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Loan',
      default: null,
      index: true
    },
    verificationId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    type: {
      type: String,
      enum: ['EMI_CARD', 'VERIFICATION_CREDIT'],
      required: true,
      index: true
    },
    purpose: {
      type: String,
      enum: ['NEW_PURCHASE', 'RENEWAL', 'VERIFICATION'],
      default: 'NEW_PURCHASE',
      index: true
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1
    },
    balanceBefore: {
      type: Number,
      default: 0
    },
    balanceAfter: {
      type: Number,
      default: 0
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

cardCreditUsageSchema.plugin(softDeletePlugin);

export const CardCreditUsage = mongoose.model('CardCreditUsage', cardCreditUsageSchema);
