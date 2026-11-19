import mongoose from 'mongoose';

const supportSettingSchema = new mongoose.Schema(
  {
    customerSupportNumber: {
      type: String,
      required: true,
      trim: true,
      default: '1800 265 014'
    },
    customerSupportNumberTimeFrom: {
      type: String,
      required: true,
      trim: true,
      default: '10:00'
    },
    customerSupportNumberTimeTo: {
      type: String,
      required: true,
      trim: true,
      default: '20:00'
    },
    bankSupportNumber: {
      type: String,
      required: true,
      trim: true,
      default: '1800 265 014'
    },
    bankSupportNumberTimeFrom: {
      type: String,
      required: true,
      trim: true,
      default: '10:00'
    },
    bankSupportNumberTimeTo: {
      type: String,
      required: true,
      trim: true,
      default: '20:00'
    },
    customerSupportEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      default: 'contact@sahayaone.com'
    },
    customerSupportEmailTimeFrom: {
      type: String,
      required: true,
      trim: true,
      default: '10:00'
    },
    customerSupportEmailTimeTo: {
      type: String,
      required: true,
      trim: true,
      default: '20:00'
    },
    bankSupportEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      default: 'contact@sahayaone.com'
    },
    bankSupportEmailTimeFrom: {
      type: String,
      required: true,
      trim: true,
      default: '10:00'
    },
    bankSupportEmailTimeTo: {
      type: String,
      required: true,
      trim: true,
      default: '20:00'
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

export const SupportSetting = mongoose.model('SupportSetting', supportSettingSchema);
