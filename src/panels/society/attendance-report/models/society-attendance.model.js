import mongoose from 'mongoose';
import softDeletePlugin from '../../../../database/plugins/soft-delete.plugin.js';

const societyAttendanceSchema = new mongoose.Schema(
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
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    employeeType: {
      type: String,
      enum: ['SOCIETY_EMPLOYEE', 'BRANCH_MANAGER'],
      required: true,
      index: true
    },
    date: {
      type: Date,
      required: true,
      index: true
    },
    punchIn: {
      type: Date,
      default: null
    },
    punchOut: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: ['P', 'L', 'A'],
      required: true,
      default: 'A',
      index: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

societyAttendanceSchema.index(
  { bankId: 1, branchId: 1, employeeType: 1, employeeId: 1, date: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
societyAttendanceSchema.plugin(softDeletePlugin);

export const SocietyAttendance =
  mongoose.models.SocietyAttendance || mongoose.model('SocietyAttendance', societyAttendanceSchema);
