import mongoose from 'mongoose';
import softDeletePlugin from '../../../../database/plugins/soft-delete.plugin.js';

const societyReceiptSchema = new mongoose.Schema(
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
    receiptType: {
      type: String,
      enum: ['CREDIT', 'DEBIT', 'TRANSFER', 'CONTRA'],
      required: true,
      index: true
    },
    receiptNo: {
      type: String,
      required: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    glHead: {
      type: String,
      required: true,
      trim: true
    },
    glHeadName: {
      type: String,
      required: true,
      trim: true
    },
    accountNumber: {
      type: String,
      required: true,
      trim: true
    },
    date: {
      type: Date,
      required: true,
      index: true
    },
    amount: {
      type: Number,
      default: 0,
      min: 0
    },

    status: {
      type: String,
      enum: ['NEW', 'PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true
    },

    image: {
      type: String,
      default: null,
      trim: true
    },
    imageKey: {
      type: String,
      default: null,
      trim: true
    },
    rejectionReason: {
      type: String,
      default: null,
      trim: true
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    approvedAt: {
      type: Date,
      default: null
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    rejectedAt: {
      type: Date,
      default: null
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    updatedBy: {
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

societyReceiptSchema.index({ bankId: 1, receiptType: 1, receiptNo: 1 }, { unique: true });
societyReceiptSchema.index({ bankId: 1, branchId: 1, receiptType: 1, createdAt: -1 });
societyReceiptSchema.plugin(softDeletePlugin);

export const SocietyReceipt =
  mongoose.models.SocietyReceipt || mongoose.model('SocietyReceipt', societyReceiptSchema);
