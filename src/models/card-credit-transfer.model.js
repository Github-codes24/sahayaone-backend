import mongoose from 'mongoose';
import softDeletePlugin from '../database/plugins/soft-delete.plugin.js';

const cardCreditTransferSchema = new mongoose.Schema(
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
    emiQuantity: {
      type: Number,
      default: 0,
      min: 0
    },
    verificationQuantity: {
      type: Number,
      default: 0,
      min: 0
    },
    balanceBefore: {
      availableEmiCards: { type: Number, default: 0 },
      availableVerificationCredits: { type: Number, default: 0 }
    },
    balanceAfter: {
      availableEmiCards: { type: Number, default: 0 },
      availableVerificationCredits: { type: Number, default: 0 }
    },
    remarks: {
      type: String,
      default: ''
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

cardCreditTransferSchema.plugin(softDeletePlugin);

export const CardCreditTransfer = mongoose.model('CardCreditTransfer', cardCreditTransferSchema);
