import mongoose from 'mongoose';
import softDeletePlugin from '../database/plugins/soft-delete.plugin.js';

const societyCustomerLinkSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    customerId: {
      type: String,
      required: true,
      index: true
    },
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
    societyAccountNumber: {
      type: String,
      default: null
    },
    ifscCode: {
      type: String,
      default: ''
    },
    accountHolderName: {
      type: String,
      default: ''
    },
    bankBranchName: {
      type: String,
      default: ''
    },
    pincode: {
      type: String,
      default: ''
    },
    aadhaarPicUrl: {
      type: String,
      default: ''
    },
    panPicUrl: {
      type: String,
      default: ''
    },
    livePicUrl: {
      type: String,
      default: ''
    },
    firstOnboardedAt: {
      type: Date,
      default: Date.now
    },
    lastKycDate: {
      type: Date,
      default: Date.now
    },
    kycStatus: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'EXPIRED', 'REJECTED'],
      default: 'VERIFIED'
    },
    lastCibilScore: {
      type: Number,
      default: null
    },
    lastCibilDate: {
      type: Date,
      default: null
    },
    onboardedProducts: [
      {
        type: String,
        enum: ['LOAN', 'MERCHANT', 'PIGMY']
      }
    ],
    onboardedByExecutive: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      role: { type: String, default: '' }
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

societyCustomerLinkSchema.index({ userId: 1, bankId: 1 }, { unique: true });
societyCustomerLinkSchema.plugin(softDeletePlugin);

export const SocietyCustomerLink = mongoose.model('SocietyCustomerLink', societyCustomerLinkSchema);
