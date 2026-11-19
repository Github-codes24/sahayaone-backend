import mongoose from 'mongoose';
import softDeletePlugin from '../database/plugins/soft-delete.plugin.js';

const loanApplicationSchema = new mongoose.Schema(
  {
    applicationId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    selectedVariants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Variant',
        required: true
      }
    ],
    status: {
      type: String,
      enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'],
      default: 'DRAFT',
      index: true
    },
    submittedAt: {
      type: Date
    },
    kycDetailsAtSubmit: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

loanApplicationSchema.plugin(softDeletePlugin);

export const LoanApplication = mongoose.model('LoanApplication', loanApplicationSchema);
