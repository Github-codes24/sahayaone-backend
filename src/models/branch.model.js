import mongoose from "mongoose";
import softDeletePlugin from "../database/plugins/soft-delete.plugin.js";

const branchSchema = new mongoose.Schema(
  {
    bankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bank",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    branchManagerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BranchManager",
      default: null,
      index: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },
    phoneNumber: {
      type: String,
      trim: true,
      default: null,
    },
    state: {
      type: String,
      trim: true,
      default: null,
    },
    address: {
      addressLine1: { type: String, default: "" },
      addressLine2: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      district: { type: String, default: "" },
      pincode: { type: String, default: "" },
      country: { type: String, default: "India" },
    },
    cardStock: {
      type: Number,
      default: 0,
    },
    verificationCredits: {
      type: Number,
      default: 0,
    },
    totalEmiCards: {
      type: Number,
      default: 0,
    },
    availableEmiCards: {
      type: Number,
      default: 0,
    },
    totalVerificationCredits: {
      type: Number,
      default: 0,
    },
    availableVerificationCredits: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
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

branchSchema.plugin(softDeletePlugin);

export const Branch = mongoose.model("Branch", branchSchema);
