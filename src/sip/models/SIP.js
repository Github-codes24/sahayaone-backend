import mongoose from "mongoose";

const sipSchema = new mongoose.Schema(
  {
    // Customer who owns the SIP
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Customer's bank account used for SIP
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },

    // Bank scheme
    schemeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Scheme",
      required: true,
      index: true,
    },

    // Snapshot of scheme information
    schemeCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    schemeName: {
      type: String,
      required: true,
      trim: true,
    },

    // SIP amount per installment
    amount: {
      type: Number,
      required: true,
      min: 100,
    },

    // SIP frequency
    frequency: {
      type: String,
      enum: ["DAILY", "WEEKLY", "MONTHLY"],
      required: true,
    },

    // Customer selected duration
    durationMonths: {
      type: Number,
      enum: [1, 3, 6, 12],
      required: true,
    },

    // Taken from scheme
    interestRate: {
      type: Number,
      required: true,
      min: 0,
    },

    // SIP starts
    startDate: {
      type: Date,
      required: true,
    },

    // SIP maturity
    maturityDate: {
      type: Date,
      required: true,
    },

    // Next installment date
    nextDueDate: {
      type: Date,
      required: true,
    },

    // Number of installments
    totalInstallments: {
      type: Number,
      required: true,
      min: 1,
    },

    // Number already paid
    paidInstallments: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Total amount deposited
    totalInvested: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Interest earned so far
    totalInterestEarned: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Final maturity amount
    maturityAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Razorpay/AutoPay mandate
    mandateId: {
      type: String,
      default: null,
      trim: true,
    },

    // Bank that opened the SIP
    bankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bank",
      required: true,
      index: true,
    },

    // Branch where SIP was opened
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },
    // branchId: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Branch",
    //   default: null,
    //   index: true,
    // },

    // Employee who opened the SIP
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: [
        "PENDING",
        "ACTIVE",
        "PAUSED",
        "COMPLETED",
        "CANCELLED",
        "MATURED",
      ],
      default: "PENDING",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const SIP = mongoose.model("SIP", sipSchema);

export default SIP;