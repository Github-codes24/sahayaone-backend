import mongoose from 'mongoose';
import softDeletePlugin from '../database/plugins/soft-delete.plugin.js';

const punchDetailSchema = new mongoose.Schema(
  {
    time: { type: Date, default: null },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    address: { type: String, default: '', trim: true },
    city: { type: String, default: '', trim: true },
    state: { type: String, default: '', trim: true },
    pincode: { type: String, default: '', trim: true }
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SocietyEmployee',
      default: null,
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
    branchName: {
      type: String,
      default: '',
      trim: true,
      index: true
    },
    appType: {
      type: String,
      enum: ['EXECUTIVE_APP', 'ONBOARDING_APP'],
      default: 'EXECUTIVE_APP',
      index: true
    },
    date: {
      type: Date,
      required: true,
      index: true
    },
    dateString: {
      type: String, // Format: YYYY-MM-DD
      required: true,
      index: true
    },
    punchIn: {
      type: punchDetailSchema,
      default: () => ({})
    },
    punchOut: {
      type: punchDetailSchema,
      default: () => ({})
    },
    city: {
      type: String,
      default: '',
      trim: true,
      index: true
    },
    state: {
      type: String,
      default: '',
      trim: true,
      index: true
    },
    pincode: {
      type: String,
      default: '',
      trim: true,
      index: true
    },
    status: {
      type: String,
      enum: ['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'LATE_PRESENT', 'EARLY_LEAVE', 'ON_DUTY'],
      default: 'ABSENT',
      index: true
    },
    isLate: {
      type: Boolean,
      default: false
    },
    lateMinutes: {
      type: Number,
      default: 0
    },
    lateFineAmount: {
      type: Number,
      default: 0
    },
    isEarlyLeave: {
      type: Boolean,
      default: false
    },
    earlyMinutes: {
      type: Number,
      default: 0
    },
    workingMinutes: {
      type: Number,
      default: 0
    },
    overtimeMinutes: {
      type: Number,
      default: 0
    },
    remarks: {
      type: String,
      default: '',
      trim: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

attendanceSchema.index({ userId: 1, dateString: 1, appType: 1 }, { unique: true });
attendanceSchema.index({ appType: 1, dateString: 1 });
attendanceSchema.index({ bankId: 1, dateString: 1 });
attendanceSchema.index({ branchId: 1, dateString: 1 });
attendanceSchema.index({ city: 1, dateString: 1 });
attendanceSchema.index({ state: 1, dateString: 1 });

attendanceSchema.plugin(softDeletePlugin);

export const Attendance = mongoose.model('Attendance', attendanceSchema);
