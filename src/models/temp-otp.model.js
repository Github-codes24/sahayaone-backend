import mongoose from 'mongoose';

const tempOtpSchema = new mongoose.Schema(
  {
    phoneNumber: {
      type: String,
      required: true,
      index: true
    },
    otp: {
      type: String,
      required: true
    },
    expiresAt: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// TTL index to automatically delete expired OTPs
tempOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TempOtp = mongoose.model('TempOtp', tempOtpSchema);
