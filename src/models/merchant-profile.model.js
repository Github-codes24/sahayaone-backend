import mongoose from "mongoose";
import softDeletePlugin from "../database/plugins/soft-delete.plugin.js";

const merchantProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    bankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bank",
      default: null,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
      index: true,
    },
    merchantCode: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
    },
    shopName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    ownerName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    primaryPhoneNumber: {
      type: String,
      trim: true,
    },
    secondaryPhoneNumber: {
      type: String,
      trim: true,
      default: null,
    },
    shopAddress: {
      type: String,
      trim: true,
      default: null,
    },
    aadhaarNumber: {
      type: String,
      trim: true,
      default: null,
    },
    panNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    gstinNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    businessProofType: {
      type: String,
      enum: ["GST", "SHOP_LICENSE", null],
      default: null,
    },
    businessProofNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
    bankDetails: {
      accountHolderName: { type: String, trim: true, default: null },
      accountNumber: { type: String, trim: true, default: null },
      ifscCode: { type: String, trim: true, uppercase: true, default: null },
      bankName: { type: String, trim: true, default: null },
      branchName: { type: String, trim: true, default: null },
      accountType: {
        type: String,
        enum: ["SAVINGS", "CURRENT", "CC", "OD", null],
        default: "CURRENT",
      },
    },
    societyAccount: {
      societyAccountNumber: { type: String, trim: true, default: null },
      ifscCode: { type: String, uppercase: true, trim: true, default: "" },
      accountHolderName: { type: String, trim: true, default: "" },
      bankBranchName: { type: String, trim: true, default: "" },
    },
    documents: {
      ownerAadhaar: { type: String, default: null },
      ownerAadhaarKey: { type: String, default: null },
      ownerPan: { type: String, default: null },
      ownerPanKey: { type: String, default: null },
      businessProof: { type: String, default: null },
      businessProofKey: { type: String, default: null },
      shopPhoto: { type: String, default: null },
      shopPhotoKey: { type: String, default: null },
      shopRegistrationCertificate: { type: String, default: null },
      shopRegistrationCertificateKey: { type: String, default: null },
      gstCertificate: { type: String, default: null },
      gstCertificateKey: { type: String, default: null },
    },
    approvalStatus: {
      type: String,
      enum: ["PENDING_BRANCH_APPROVAL", "APPROVED", "REJECTED"],
      default: "PENDING_BRANCH_APPROVAL",
      index: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: null,
    },
    onboardedBy: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      name: { type: String, default: null },
      phone: { type: String, default: null },
      role: { type: String, default: null },
    },
    approvedAt: { type: Date, default: null },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rejectedAt: { type: Date, default: null },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "BLOCKED"],
      default: "INACTIVE",
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

merchantProfileSchema.plugin(softDeletePlugin);
merchantProfileSchema.index({ bankId: 1, branchId: 1 });
merchantProfileSchema.index(
  { userId: 1, bankId: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
merchantProfileSchema.index(
  { phoneNumber: 1, bankId: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

export const MerchantProfile = mongoose.model(
  "MerchantProfile",
  merchantProfileSchema,
);
