import mongoose from 'mongoose';
import softDeletePlugin from '../database/plugins/soft-delete.plugin.js';

const cardCreditPurchaseSchema = new mongoose.Schema(
  {
    bankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bank',
      required: true,
      index: true
    },
    purchaseType: {
      type: String,
      enum: ['EMI_CARD', 'VERIFICATION_CREDIT', 'BOTH'],
      required: true
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
    emiRate: {
      type: Number,
      default: 0,
      min: 0
    },
    verificationRate: {
      type: Number,
      default: 0,
      min: 0
    },
    emiAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    verificationAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    subtotal: {
      type: Number,
      default: 0,
      min: 0
    },
    cgst: {
      type: Number,
      default: 0,
      min: 0
    },
    sgst: {
      type: Number,
      default: 0,
      min: 0
    },
    total: {
      type: Number,
      default: 0,
      min: 0
    },
    paymentMethod: {
      type: String,
      default: 'RAZORPAY'
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED'],
      default: 'PENDING',
      index: true
    },
    paymentGateway: {
      type: String,
      default: 'RAZORPAY'
    },
    paymentOrderId: {
      type: String,
      default: null,
      index: true
    },
    paymentTransactionId: {
      type: String,
      default: null,
      index: true
    },
    invoiceNumber: {
      type: String,
      default: null
    },
    paymentLink: {
      type: String,
      default: null
    },
    paymentLinkId: {
      type: String,
      default: null,
      index: true
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

cardCreditPurchaseSchema.plugin(softDeletePlugin);

export const CardCreditPurchase = mongoose.model('CardCreditPurchase', cardCreditPurchaseSchema);
