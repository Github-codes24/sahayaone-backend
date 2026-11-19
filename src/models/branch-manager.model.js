import mongoose from 'mongoose';
import softDeletePlugin from '../database/plugins/soft-delete.plugin.js';

// Reusable Sub-schemas for HR Architecture (usable by BranchManager and EmployeeProfile)
export const personalDetailsSchema = new mongoose.Schema(
  {
    profileImage: { type: String, default: null },
    profileImageKey: { type: String, default: null },
    fullName: { type: String, trim: true },
    firstName: { type: String, trim: true, default: '' },
    lastName: { type: String, trim: true, default: '' },
    gender: { type: String, enum: ['MALE', 'FEMALE', 'OTHER'], default: 'MALE' },
    dateOfBirth: { type: Date, default: null },
    dob: { type: Date, default: null },
    phoneNumber: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    address: { type: String, default: '' },
    bloodGroup: { type: String, default: '' },
    dutyHours: { type: String, default: '' },
    weeklyOff: { type: String, default: '' },
    validity: { type: Date, default: null },
    officeAddress: { type: String, default: '' },
    department: { type: String, default: '' }
  },
  { _id: false }
);

export const jobDetailsSchema = new mongoose.Schema(
  {
    designation: { type: String, default: 'BRANCH_MANAGER', trim: true },
    department: { type: String, default: '', trim: true },
    state: { type: String, default: '' },
    salary: { type: Number, min: 0, default: 0 },
    joiningDate: { type: Date, default: Date.now },
    probationPeriodMonths: { type: Number, min: 0, default: 0 }
  },
  { _id: false }
);

export const shiftSettingsSchema = new mongoose.Schema(
  {
    punchInTime: { type: String, default: '09:30' },
    punchOutTime: { type: String, default: '18:30' },
    weeklyOff: {
      day: {
        type: String,
        enum: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
        default: 'SUNDAY'
      },
      payable: { type: Boolean, default: true },
      variable: { type: Boolean, default: false },
      secondWeeklyOff: { type: Boolean, default: false },
      secondWeeklyOffDay: {
        type: String,
        enum: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
        default: 'SATURDAY'
      }
    },
    lateAllowedMinutes: { type: Number, min: 0, default: 15 },
    lateAllowedAsPerShift: { type: Boolean, default: true },
    earlyAllowedMinutes: { type: Number, min: 0, default: 15 },
    earlyAllowedAsPerShift: { type: Boolean, default: false },
    halfDayMinutes: { type: Number, min: 0, default: 240 },
    halfDayAsPerShift: { type: Boolean, default: false },
    fullDayMinutes: { type: Number, min: 0, default: 480 },
    fullDayAsPerShift: { type: Boolean, default: false }
  },
  { _id: false }
);

export const attendanceSettingsSchema = new mongoose.Schema(
  {
    punchType: { type: String, enum: ['SINGLE', 'DOUBLE', 'MULTIPLE'], default: 'DOUBLE' },
    noOutPunchAction: {
      type: String,
      enum: ['MARK_ABSENT', 'MARK_HALF_DAY', 'AUTO_OUT_PUNCH', 'NO_ACTION'],
      default: 'MARK_ABSENT'
    },
    presentOnWeeklyOffHolidayAction: {
      type: String,
      enum: ['COMP_OFF', 'EXTRA_PAY', 'REGULAR_ATTENDANCE', 'NO_ACTION'],
      default: 'COMP_OFF'
    },
    lateCut: {
      allowedDays: { type: Number, min: 0, default: 3 },
      action: { type: String, default: 'DEDUCT_LEAVE' },
      enabled: { type: Boolean, default: false },
      extraLateCutDeduction: { type: Boolean, default: false },
      additionalLateCutInLeaveBalance: { type: Boolean, default: false }
    },
    lunchAndEarlyGoing: {
      lunchAllowedMinutes: { type: Number, min: 0, default: 0 },
      lunchAsPerShift: { type: Boolean, default: true },
      lunchAllowed: { type: Boolean, default: false },
      earlyGoingAllowed: { type: Boolean, default: false }
    },
    overtime: {
      allowed: { type: Boolean, default: false },
      customOT: { type: Boolean, default: false },
      beforeOT: { type: Boolean, default: false },
      gracePeriodMinutes: { type: Number, min: 0, default: 5 },
      oneDayOTHrs: { type: Number, min: 0, default: 4 },
      asPerShift: { type: Boolean, default: false },
      considerAsCompOff: { type: Boolean, default: false }
    }
  },
  { _id: false }
);

export const woffHoffSettingsSchema = new mongoose.Schema(
  {
    weeklyOffRules: {
      absentBefore: { type: Boolean, default: true },
      absentAfter: { type: Boolean, default: true },
      absentBeforeOrAfter: { type: Boolean, default: false },
      addWorkingHours: { type: Boolean, default: false },
      ignoreLateDeductionIfPresent: { type: Boolean, default: false },
      lwp: { type: Boolean, default: false }
    },
    holidayRules: {
      absentBefore: { type: Boolean, default: false },
      absentAfter: { type: Boolean, default: false },
      absentBeforeAndAfter: { type: Boolean, default: false },
      addWorkingHours: { type: Boolean, default: false },
      ignoreLateDeductionIfPresent: { type: Boolean, default: false },
      lwp: { type: Boolean, default: false }
    },
    leaveBridgeRules: {
      considerWeeklyOffInLeave: { type: Boolean, default: true },
      considerHolidayInLeave: { type: Boolean, default: true },
      absentWeeklyOffLeaveMarksWeeklyOffAbsent: { type: Boolean, default: true },
      leaveWeeklyOffAbsentMarksWeeklyOffAbsent: { type: Boolean, default: false },
      absentHolidayLeaveMarksHolidayAbsent: { type: Boolean, default: false },
      leaveHolidayAbsentMarksHolidayAbsent: { type: Boolean, default: false }
    },
    leaveSettings: {
      leaveEncashmentAllowed: { type: Boolean, default: false },
      carryForwardAllowed: { type: Boolean, default: true }
    }
  },
  { _id: false }
);

export const kraTargetSchema = new mongoose.Schema(
  {
    product: { type: String, required: true, trim: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    targetType: { type: String, enum: ['AMOUNT', 'COUNT'], default: 'AMOUNT' },
    targetValue: { type: Number, required: true, min: 0 },
    incentiveType: {
      type: String,
      enum: ['PRODUCT', 'QUANTITY', 'PERCENTAGE', 'PER_UNIT', 'NONE'],
      default: 'NONE'
    },
    incentiveValue: { type: Number, min: 0, default: 0 }
  },
  { _id: false }
);

export const kraSettingsSchema = new mongoose.Schema(
  {
    year: { type: Number, default: () => new Date().getFullYear() },
    targets: { type: [kraTargetSchema], default: [] }
  },
  { _id: false }
);

const branchManagerSchema = new mongoose.Schema(
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
      default: null,
      index: true
    },
    employeeCode: {

      type: String,
      trim: true,
      default: null
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
      default: 'BRANCH_MANAGER',
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

branchManagerSchema.pre('save', function (next) {
  // Sync root identity fields with personalDetails and jobDetails
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

branchManagerSchema.plugin(softDeletePlugin);

export const BranchManager = mongoose.model('BranchManager', branchManagerSchema);
