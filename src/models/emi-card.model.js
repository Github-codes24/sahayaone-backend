import mongoose from 'mongoose';
import softDeletePlugin from '../database/plugins/soft-delete.plugin.js';
import { Bank } from './bank.model.js';
import { Branch } from './branch.model.js';

const emiCardSchema = new mongoose.Schema(
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
      required: true,
      index: true
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      unique: true,
      sparse: true,
      index: true
    },
    cardNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    cardHolderName: {
      type: String,
      required: true,
      trim: true
    },
    validThru: {
      type: String,
      required: true,
      trim: true
    },
    cvv: {
      type: String,
      required: true,
      trim: true
    },
    cardLimit: {
      type: Number,
      required: true
    },
    availableLimit: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'BLOCKED', 'EXPIRED'],
      default: 'ACTIVE',
      index: true
    },
    allotmentStatus: {
      type: String,
      enum: ['UNASSIGNED', 'DISTRIBUTED_TO_BRANCH', 'ALLOTTED'],
      default: 'UNASSIGNED',
      index: true
    },
    allottedAt: {
      type: Date,
      default: null
    },
    renewalHistory: [
      {
        renewedAt: {
          type: Date,
          default: Date.now
        },
        previousValidThru: {
          type: String,
          required: true
        },
        newValidThru: {
          type: String,
          required: true
        },
        renewedByUserId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null
        },
        loanId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Loan',
          default: null
        },
        branchId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Branch',
          default: null
        },
        bankId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Bank',
          default: null
        },
        fee: {
          type: Number,
          default: 499
        }
      }
    ]
  },
  {
    timestamps: true,
    versionKey: false
  }
);

emiCardSchema.plugin(softDeletePlugin);

export const EmiCard = mongoose.model('EmiCard', emiCardSchema);
