import mongoose from 'mongoose';
import softDeletePlugin from '../database/plugins/soft-delete.plugin.js';

const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      required: true,
      index: true
    },
    phoneNumber: {
      type: String,
      trim: true,
      unique: true,
      required: true,
      index: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    avatar: {
      type: String,
      default: null
    },
    role: {
      type: String,
      enum: ['SUPER_ADMIN', 'SUB_ADMIN'],
      required: true,
      default: 'SUB_ADMIN'
    },
    permissions: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'BLOCKED'],
      default: 'ACTIVE',
      index: true
    },
    lastLoginAt: {
      type: Date,
      default: null
    },
    resetOtp: {
      type: String,
      default: null
    },
    resetOtpExpires: {
      type: Date,
      default: null
    },
    resetVerifiedAt: {
      type: Date,
      default: null
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

adminSchema.plugin(softDeletePlugin);

adminSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.resetOtp;
    delete ret.resetOtpExpires;
    delete ret.resetVerifiedAt;
    return ret;
  }
});

export const Admin = mongoose.model('Admin', adminSchema);
