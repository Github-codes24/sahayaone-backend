import mongoose from 'mongoose';

const kycVerificationSchema = new mongoose.Schema({
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  societyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bank',
    required: true,
    index: true
  },
  requestById: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  refid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  documentType: {
    type: String,
    enum: ['AADHAAR', 'PAN'],
    required: true
  },
  idNumber: {
    type: String,
    required: true
  },
  consent: {
    type: Boolean,
    default: true,
    required: true
  },
  status: {
    type: String,
    enum: ['INITIATED', 'VERIFIED', 'FAILED', 'EXPIRED'],
    default: 'INITIATED',
    index: true
  },
  authorizationUrl: {
    type: String
  },
  redirectUrl: {
    type: String
  },
  personalDetails: {
    fullName: String,
    gender: String,
    dob: String,
    fatherName: String,
    address: String,
    aadhaarVerified: { type: Boolean, default: false },
    panVerified: { type: Boolean, default: false },
    aadhaarStatus: { type: String, enum: ['VERIFIED', 'UNAVAILABLE', 'FAILED'], default: 'UNAVAILABLE' },
    panStatus: { type: String, enum: ['VERIFIED', 'UNAVAILABLE', 'FAILED'], default: 'UNAVAILABLE' },
    availableDocuments: [{ type: String }],
    unavailableDocuments: [{ type: String }],
    aadhaarNumber: String,
    panNumber: String
  },
  rawXmlBase64: {
    aadhaar: { type: String, default: null },
    pan: { type: String, default: null }
  },
  billingCode: {
    type: Number
  },
  lastError: {
    type: String,
    default: null
  },
  verifiedAt: {
    type: Date
  }
}, {
  timestamps: true
});

export const KycVerificationModel = mongoose.model('KycVerification', kycVerificationSchema);
