import mongoose from 'mongoose';
import { User } from './user.model.js';
import softDeletePlugin from '../database/plugins/soft-delete.plugin.js';

const creditLogSchema = new mongoose.Schema(
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
      required: false,
      default: null,
      index: true
    },
    type: {
      type: String,
      enum: ['EMI_CARD', 'VERIFICATION_CREDIT'],
      required: true
    },
    action: {
      type: String,
      enum: ['ALLOCATION', 'DEDUCTION', 'PURCHASE', 'ADMIN_ALLOTMENT', 'CREDIT'],
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      default: null
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      default: null
    },
    description: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

creditLogSchema.plugin(softDeletePlugin);

export const CreditLog = mongoose.model('CreditLog', creditLogSchema);
