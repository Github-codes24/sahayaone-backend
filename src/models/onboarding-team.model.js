import mongoose from 'mongoose';
import softDeletePlugin from '../database/plugins/soft-delete.plugin.js';

const onboardingTeamSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true
    },
    bankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bank',
      default: null,
      index: true
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
      index: true
    },
    profileImage: {
      type: String,
      default: null
    },
    profileImageKey: {
      type: String,
      default: null
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'OTHER', 'Male', 'Female', 'Other'],
      default: 'Male'
    },
    dob: {
      type: Date,
      default: null
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    address: {
      type: String,
      trim: true,
      default: ''
    },
    // Job Details
    onboardingTeamType: {
      type: String,
      enum: ['Regional OnboardingTeam', 'Branch OnboardingTeam', 'Collection OnboardingTeam'],
      required: true,
      default: 'Regional OnboardingTeam',
      index: true
    },
    salary: {
      type: Number,
      default: 0
    },
    joiningDate: {
      type: Date,
      default: Date.now
    },
    // Shift & Woff
    shiftInTime: { type: String, default: '10:00' },
    shiftOutTime: { type: String, default: '21:00' },
    weeklyOffDays: { type: [String], default: ['Saturday', 'Sunday'] },
    isWeeklyOffPayable: { type: Boolean, default: true },
    isVariableWeeklyOff: { type: Boolean, default: true },
    isSecondWeeklyOff: { type: Boolean, default: true },

    // Other Details
    lateAllowedMins: { type: Number, default: 15 },
    earlyAllowedMins: { type: Number, default: 15 },
    halfDayMins: { type: Number, default: 240 },
    fullDayMins: { type: Number, default: 480 },

    // Attendance Rules
    shiftType: { type: String, default: 'Double' },
    noOutPunchAction: { type: String, default: 'Mark Half Day' },
    presentOnWoHolidayAction: { type: String, default: 'Mark as COFF' },
    lateCutAllowedDays: { type: Number, default: 3 },
    lateCutAction: { type: String, default: 'Half Day' },
    isLateCutAllowed: { type: Boolean, default: true },
    isExtraLateCutDeduction: { type: Boolean, default: true },
    isAdditionalLateCutInLeaveBalance: { type: Boolean, default: true },

    // Lunch & Early Going Rules
    lunchAllowedMins: { type: Number, default: 15 },
    isLunchAllowed: { type: Boolean, default: true },
    isEarlyGoingAllowed: { type: Boolean, default: true },

    // Overtime Rules
    isOvertimeAllowed: { type: Boolean, default: true },
    isCustomOT: { type: Boolean, default: true },
    isBeforeOT: { type: Boolean, default: true },
    otGracePeriodMins: { type: Number, default: 5 },
    ot1DayHrs: { type: Number, default: 4 },
    isOTAsPerShift: { type: Boolean, default: true },
    isConsiderOTAsCOFF: { type: Boolean, default: true },

    // WOFF & HOFF Sandwich Rules
    sandwichWeeklyOff: {
      absentBeforeWO: { type: Boolean, default: true },
      absentAfterWO: { type: Boolean, default: true },
      absentBeforeOrAfterWO: { type: Boolean, default: true },
      addWorkingHrsOnWODay: { type: Boolean, default: true },
      lateDeductionNotAppliedOnWOIfPresent: { type: Boolean, default: true }
    },
    sandwichHolidays: {
      absentBeforeHoliday: { type: Boolean, default: true },
      absentAfterHoliday: { type: Boolean, default: true },
      absentBeforeAndAfterHoliday: { type: Boolean, default: true },
      addWorkingHoursOnHolidayDay: { type: Boolean, default: true },
      lateDeductionNotAppliedOnHolidayIfPresent: { type: Boolean, default: true }
    },
    leaveBetweenHolidayOrWO: {
      considerWOInLeaveApp: { type: Boolean, default: true },
      considerHolidayInLeaveApp: { type: Boolean, default: true },
      absentWoLeaveWoAbsent: { type: Boolean, default: true },
      leaveWoAbsentWoAbsent: { type: Boolean, default: true },
      absentHolidayLeaveHolidayAbsent: { type: Boolean, default: true },
      leaveHolidayAbsentHolidayAbsent: { type: Boolean, default: true }
    },

    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'BLOCKED'],
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
    versionKey: false,
    strictPopulate: false
  }
);

onboardingTeamSchema.plugin(softDeletePlugin);

export const OnboardingTeam = mongoose.model('OnboardingTeam', onboardingTeamSchema);
