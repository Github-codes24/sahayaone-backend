import mongoose from 'mongoose';
import softDeletePlugin from '../database/plugins/soft-delete.plugin.js';

const transactionSchema = new mongoose.Schema(
  {
    loanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Loan',
      required: true,
      index: true
    },
    installmentIds: {
      type: [mongoose.Schema.Types.ObjectId],
      required: true
    },
    paymentMethod: {
      type: String,
      enum: ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'NET_BANKING', 'NETBANKING', 'ONLINE'],
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED'],
      default: 'PENDING',
      index: true
    },
    type: {
      type: String,
      enum: ['DOWN_PAYMENT', 'EMI_COLLECTION'],
      default: 'EMI_COLLECTION',
      index: true
    },
    otp: {
      type: String,
      default: null
    },
    otpExpires: {
      type: Date,
      default: null
    },
    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    verifiedByUserId: {
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

transactionSchema.plugin(softDeletePlugin);

export const Transaction = mongoose.model('Transaction', transactionSchema);
