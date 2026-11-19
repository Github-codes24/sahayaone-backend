import mongoose from 'mongoose';
import softDeletePlugin from '../database/plugins/soft-delete.plugin.js';

const customerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    phoneNumber: {
      type: String,
      trim: true,
      index: true
    },
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    profileImage: {
      type: String,
      default: null,
      trim: true
    },
    profileImageKey: {
      type: String,
      default: null,
      trim: true
    },
    panNumber: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true
    },
    aadhaarNumber: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      trim: true
    },
    kycStatus: {
      type: String,
      enum: ['PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED'],
      default: 'PENDING',
      index: true
    },
    creditScore: {
      type: Number,
      default: null
    },
    customerUniqueId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true
    },
    residentialPincode: {
      type: String,
      trim: true
    },
    livePhoto: {
      type: String,
      trim: true,
      default: null
    },
    livePhotoKey: {
      type: String,
      trim: true,
      default: null
    },
    lastCibilCheckDate: {
      type: Date,
      default: null
    },
    cibilStatus: {
      type: String,
      enum: ['APPROVED', 'REJECTED', 'PENDING'],
      default: 'PENDING',
      index: true
    },
    onboardingStage: {
      type: String,
      enum: ['OTP_VERIFIED', 'KYC_DONE', 'FORM_PENDING', 'COMPLETED'],
      default: 'OTP_VERIFIED',
      index: true
    },
    cibilReportUrl: {
      type: String,
      default: null,
      trim: true
    },
    cibilFetchedAt: {
      type: Date,
      default: null
    },
    rawKycData: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    rawCibilData: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'OTHER'],
      trim: true
    },
    dob: {
      type: Date
    },
    avatar: {
      type: String,
      trim: true,
      default: null
    },
    avatarKey: {
      type: String,
      trim: true,
      default: null
    },
    panImage: {
      type: String,
      trim: true
    },
    panImageKey: {
      type: String,
      trim: true
    },
    aadhaarImage: {
      type: String,
      trim: true
    },
    aadhaarImageKey: {
      type: String,
      trim: true
    },
    currentPinCode: {
      type: String,
      trim: true
    },
    activeAddress: {
      addressLine: { type: String, trim: true },
      pinCode: { type: String, trim: true }
    },
    addressHistory: [
      {
        addressLine: { type: String, required: true, trim: true },
        pinCode: { type: String, required: true, trim: true },
        verifiedAt: { type: Date, default: Date.now }
      }
    ],
    bankDetails: [
      {
        accountNumber: { type: String, trim: true },
        ifscCode: { type: String, trim: true, uppercase: true },
        bankName: { type: String, trim: true },
        branchName: { type: String, trim: true },
        isPrimary: { type: Boolean, default: false }
      }
    ],
    deviceFingerprint: {
      deviceId: { type: String },
      os: { type: String },
      osVersion: { type: String },
      appVersion: { type: String },
      lastActiveIp: { type: String }
    },
    onboardingSource: {
      type: String,
      enum: ['SELF', 'EXECUTIVE', 'MERCHANT', 'SUPER_ADMIN', 'SOCIETY'],
      default: 'SELF',
      index: true
    },
    createdByExecutiveId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
      default: null
    },
    createdByMerchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
      default: null
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MerchantProfile',
      required: false,
      index: true,
      default: null
    },
    createdById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
      default: null
    },
    onboardedBy: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

customerProfileSchema.plugin(softDeletePlugin);

export const CustomerProfile = mongoose.model('CustomerProfile', customerProfileSchema);
