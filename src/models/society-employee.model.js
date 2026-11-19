import mongoose from 'mongoose';
import softDeletePlugin from '../database/plugins/soft-delete.plugin.js';
import {
  personalDetailsSchema,
  jobDetailsSchema,
  shiftSettingsSchema,
  attendanceSettingsSchema,
  woffHoffSettingsSchema,
  kraSettingsSchema
} from './branch-manager.model.js';

const societyEmployeeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
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
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SocietyRole',
      required: true,
      index: true
    },
    employeeCode: {
      type: String,
      required: true,
      trim: true
    },
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true
    },
    designation: {
      type: String,
      default: '',
      trim: true
    },
    department: {
      type: String,
      default: '',
      trim: true
    },
    dutyHours: {
      type: String,
      default: '',
      trim: true
    },
    weeklyOff: {
      type: String,
      default: '',
      trim: true
    },
    bloodGroup: {
      type: String,
      default: '',
      trim: true
    },
    validity: {
      type: Date,
      default: null
    },
    officeAddress: {
      type: String,
      default: '',
      trim: true
    },
    personalDetails: {
      type: personalDetailsSchema,
      default: () => ({})
    },
    jobDetails: {
      type: jobDetailsSchema,
      default: () => ({})
    },
    shiftSettings: {
      type: shiftSettingsSchema,
      default: () => ({})
    },
    attendanceSettings: {
      type: attendanceSettingsSchema,
      default: () => ({})
    },
    woffHoffSettings: {
      type: woffHoffSettingsSchema,
      default: () => ({})
    },
    kraSettings: {
      type: kraSettingsSchema,
      default: () => ({})
    },
    marriageAnniversaryDate: {
      type: Date,
      default: null
    },
    offerLetter: {
      url: { type: String, default: null },
      key: { type: String, default: null },
      referenceNumber: { type: String, default: null },
      generatedAt: { type: Date, default: null }
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true
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
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

societyEmployeeSchema.index({ bankId: 1, employeeCode: 1 });
societyEmployeeSchema.index({ bankId: 1, branchId: 1 });
societyEmployeeSchema.index({ bankId: 1, roleId: 1 });

societyEmployeeSchema.pre('save', function (next) {
  if (!this.personalDetails) this.personalDetails = {};
  if (!this.jobDetails) this.jobDetails = {};

  if (this.fullName && !this.personalDetails.fullName) {
    this.personalDetails.fullName = this.fullName;
  } else if (this.personalDetails.fullName) {
    this.fullName = this.personalDetails.fullName;
  }

  if (this.email && !this.personalDetails.email) {
    this.personalDetails.email = this.email;
  } else if (this.personalDetails.email) {
    this.email = this.personalDetails.email;
  }

  if (this.phoneNumber && !this.personalDetails.phoneNumber) {
    this.personalDetails.phoneNumber = this.phoneNumber;
  } else if (this.personalDetails.phoneNumber) {
    this.phoneNumber = this.personalDetails.phoneNumber;
  }

  if (this.designation && !this.jobDetails.designation) {
    this.jobDetails.designation = this.designation;
  } else if (this.jobDetails.designation) {
    this.designation = this.jobDetails.designation;
  }

  next();
});

societyEmployeeSchema.plugin(softDeletePlugin);

export const SocietyEmployee = mongoose.model('SocietyEmployee', societyEmployeeSchema);
