import mongoose from 'mongoose';
import softDeletePlugin from '../database/plugins/soft-delete.plugin.js';
import { UserRole, UserType } from '../constants/user-role.constant.js';
import './pigmy-customer.model.js';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      sparse: true,
      index: true
    },
    phoneNumber: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      index: true
    },
    passwordHash: {
      type: String,
      default: null
    },
    mpinHash: {
      type: String,
      default: null
    },
    fullName: {
      type: String,
      default: ''
    },
    role: {
      type: String,
      required: true,
      default: UserRole.EMPLOYEE
    },
    permissions: {
      type: [String],
      default: []
    },
    userType: {
      type: String,
      enum: Object.values(UserType),
      required: true
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'BLOCKED', 'PENDING_KYC', 'PENDING', 'REJECTED'],
      default: 'ACTIVE',
      index: true
    },
    profileId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      refPath: 'profileModel'
    },
    profileModel: {
      type: String,
      required: false,
      enum: ['EmployeeProfile', 'CustomerProfile', 'MerchantProfile', 'PigmyCustomer', 'PigmyCustomerProfile', 'BranchManager', 'Bank', 'SocietyEmployee']
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
    tempOtp: {
      type: String,
      default: null
    },
    tempOtpExpires: {
      type: Date,
      default: null
    },
    tempDownPaymentOtp: {
      type: String,
      default: null
    },
    tempDownPaymentOtpExpires: {
      type: Date,
      default: null
    },
    tempEmiOtp: {
      type: String,
      default: null
    },
    tempEmiOtpExpires: {
      type: Date,
      default: null
    },
    tempEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: null
    },
    tempEmailOtp: {
      type: String,
      default: null
    },
    tempEmailOtpExpires: {
      type: Date,
      default: null
    },
    onboardingSource: {
      type: String,
      enum: ['SELF', 'EXECUTIVE', 'EXECUTIVE_APP', 'MERCHANT', 'SUPER_ADMIN', 'SOCIETY'],
      default: 'SELF',
      index: true
    },
    onboardedBy: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0]
      },
      address: {
        type: String,
        default: ''
      },
      lastUpdatedAt: {
        type: Date,
        default: null
      }
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

userSchema.index({ location: '2dsphere' });

userSchema.plugin(softDeletePlugin);

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.mpinHash;
    return ret;
  }
});

export const User = mongoose.model('User', userSchema);
