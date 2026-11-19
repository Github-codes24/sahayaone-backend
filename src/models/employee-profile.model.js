import mongoose from 'mongoose';
import softDeletePlugin from '../database/plugins/soft-delete.plugin.js';

const employeeProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    employeeId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'OTHER'],
      required: false,
      default: 'FEMALE'
    },
    dob: {
      type: Date,
      required: false
    },
    profileImage: {
      type: String,
      default: null
    },
    dutyHours: {
      type: String,
      default: '10:00 to 19:00'
    },
    weeklyOff: {
      type: String,
      default: 'Saturday & Sunday'
    },
    bloodGroup: {
      type: String,
      default: 'B+'
    },
    validity: {
      type: Date,
      required: false
    },
    officeAddress: {
      type: String,
      default: '2nd floor, Abc building, Nagpur, Maharashtra'
    },
    state: {
      type: String,
      default: 'Maharashtra'
    },
    designation: {
      type: String,
      required: true,
      trim: true
    },
    department: {
      type: String,
      required: true,
      trim: true
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: false
    },
    reportingManagerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false
    },
    joiningDate: {
      type: Date,
      required: true
    },
    exitDate: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

employeeProfileSchema.plugin(softDeletePlugin);

export const EmployeeProfile = mongoose.model('EmployeeProfile', employeeProfileSchema);
