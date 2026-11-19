import mongoose from "mongoose";
import softDeletePlugin from "../database/plugins/soft-delete.plugin.js";

const cashCollectionSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    onboardingTeamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OnboardingTeam",
    },

    bankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bank",
      index: true
    },

    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      index: true
    },

    loanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Loan",
      index: true
    },

    amountCollected: {
      type: Number,
      required: true,
      min: 0,
    },

    collectionType: {
      type: String,
      enum: ["DOWN_PAYMENT", "EMI_COLLECTION", "MANUAL"],
      default: "MANUAL"
    },

    description: {
      type: String,
      default: null
    },

    collectionDate: {
      type: Date,
      default: Date.now,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

cashCollectionSchema.plugin(softDeletePlugin);

export const CashCollection = mongoose.model(
  "CashCollection",
  cashCollectionSchema
);