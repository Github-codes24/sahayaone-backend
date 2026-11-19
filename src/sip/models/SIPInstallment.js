import mongoose from "mongoose";

const sipInstallmentSchema = new mongoose.Schema(
  {
    sipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SIP",
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    schemeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Scheme",
      required: true,
      index: true,
    },

    installmentNumber: {
      type: Number,
      required: true,
      min: 1,
    },

    amount: {
      type: Number,
      required: true,
      min: 1,
    },

    dueDate: {
      type: Date,
      required: true,
      index: true,
    },

    paymentId: {
      type: String,
      default: null,
      index: true,
    },

    mandateId: {
      type: String,
      default: null,
    },

    paymentStatus: {
      type: String,
      enum: [
        "PENDING",
        "PROCESSING",
        "SUCCESS",
        "FAILED",
      ],
      default: "PENDING",
    },

    investmentStatus: {
      type: String,
      enum: [
        "PENDING",
        "PROCESSING",
        "SUCCESS",
        "FAILED",
      ],
      default: "PENDING",
    },

    retryCount: {
      type: Number,
      default: 0,
    },

    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/*
 * Prevent duplicate installments for the same SIP.
 */
sipInstallmentSchema.index(
  {
    sipId: 1,
    installmentNumber: 1,
  },
  {
    unique: true,
  }
);

const SIPInstallment = mongoose.model(
  "SIPInstallment",
  sipInstallmentSchema
);

export default SIPInstallment;
