import mongoose from 'mongoose';
import softDeletePlugin from '../database/plugins/soft-delete.plugin.js';

const pigmyCustomerSchema = new mongoose.Schema(
  {
    pigmyCustomerCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true
    },
    code: {
      type: String,
      trim: true,
      index: true
    },
    accountNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true
    },
    bankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bank',
      required: false,
      index: true
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: false,
      index: true
    },
    bankName: {
      type: String,
      trim: true,
      default: null
    },
    branchName: {
      type: String,
      trim: true,
      default: null
    },
    customerType: {
      type: String,
      enum: ['INDIVIDUAL', 'MERCHANT'],
      default: 'INDIVIDUAL',
      index: true
    },
    isMerchant: {
      type: Boolean,
      default: false,
      index: true
    },
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    ownerName: {
      type: String,
      trim: true
    },
    primaryPhoneNumber: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    phoneNumber: {
      type: String,
      trim: true,
      index: true
    },
    secondaryPhoneNumber: {
      type: String,
      trim: true,
      default: null
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
      index: true
    },
    dob: {
      type: String,
      default: null
    },
    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'OTHER', ''],
      default: ''
    },
    address: {
      type: String,
      required: true,
      trim: true
    },
    residenceAddress: {
      type: String,
      trim: true
    },
    aadhaarNumber: {
      type: String,
      trim: true,
      default: null
    },
    ownerAadhaarNumber: {
      type: String,
      trim: true,
      default: null
    },
    ownerAadharNumber: {
      type: String,
      trim: true,
      default: null
    },
    panNumber: {
      type: String,
      uppercase: true,
      trim: true,
      default: null
    },
    ownerPanNumber: {
      type: String,
      uppercase: true,
      trim: true,
      default: null
    },

    // Savings Account Selection Option (EXISTING vs CREATE_NEW)
    savingsAccountOption: {
      type: String,
      enum: ['EXISTING', 'CREATE_NEW'],
      default: 'EXISTING',
      index: true
    },
    hasSavingsAccount: {
      type: Boolean,
      default: true
    },
    existingSavingsAccountNumber: {
      type: String,
      trim: true,
      default: null
    },
    newSavingsAccountRequested: {
      type: Boolean,
      default: false
    },

    // Internal Society Bank Account Details (Credit Destination)
    societyAccount: {
      societyAccountNumber: { type: String, trim: true, default: null },
      ifscCode: { type: String, uppercase: true, trim: true, default: '' },
      accountHolderName: { type: String, trim: true, default: '' },
      bankBranchName: { type: String, trim: true, default: '' }
    },

    // Customer Bank Account Details (Used for e-NACH Auto-Debit Mandate)
    bankAccountDetails: {
      accountHolderName: { type: String, trim: true, default: null },
      accountNumber: { type: String, trim: true, default: null },
      ifscCode: { type: String, uppercase: true, trim: true, default: null },
      bankName: { type: String, trim: true, default: null },
      branchName: { type: String, trim: true, default: null },
      accountType: { type: String, enum: ['SAVINGS', 'CURRENT'], default: 'SAVINGS' }
    },

    // Auto-Debit e-NACH Mandate Details
    mandateDetails: {
      mandateId: { type: String, default: null },
      mandateStatus: {
        type: String,
        enum: ['PENDING_SETUP', 'PENDING_APPROVAL', 'INITIATED', 'ACTIVE', 'FAILED', 'CANCELLED'],
        default: 'PENDING_SETUP',
        index: true
      },
      autoDebitAmount: { type: Number, default: 100 },
      autoDebitFrequency: { type: String, enum: ['DAILY', 'WEEKLY', 'MONTHLY'], default: 'DAILY' },
      mandateStartDate: { type: Date, default: null },
      mandateEndDate: { type: Date, default: null }
    },

    // SIP Scheme Linkage & Configuration
    schemeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Scheme',
      default: null,
      index: true
    },
    schemeCode: {
      type: String,
      trim: true,
      default: null,
      index: true
    },
    schemeName: {
      type: String,
      trim: true,
      default: null
    },
    interestRate: {
      type: Number,
      default: 0,
      min: 0
    },
    isCustomAmount: {
      type: Boolean,
      default: false
    },
    maturityAmount: {
      type: Number,
      default: 0
    },

    // Deposit Scheme Tenure (1, 3, 6, or 12 Months)
    tenureMonths: {
      type: Number,
      enum: [1, 3, 6, 12],
      default: 12,
      index: true
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date,
      default: null
    },

    // Optional Merchant Details for Pigmy Merchant Customers
    shopName: {
      type: String,
      trim: true,
      default: null
    },
    shopAddress: {
      type: String,
      trim: true,
      default: null
    },
    businessProofType: {
      type: String,
      enum: ['GST', 'SHOP_LICENSE', 'UDYAM', 'TRADE_LICENSE', 'OTHER', 'NONE', ''],
      default: ''
    },
    businessProofNumber: {
      type: String,
      uppercase: true,
      trim: true,
      default: null
    },
    gstinNumber: {
      type: String,
      uppercase: true,
      trim: true,
      default: null
    },

    // Pigmy Scheme Deposit Configuration
    dailyDepositAmount: {
      type: Number,
      default: 100
    },
    depositFrequency: {
      type: String,
      enum: ['DAILY', 'WEEKLY', 'MONTHLY'],
      default: 'DAILY'
    },

    // Document Photo File URLs
    documents: {
      ownerAadhaar: { type: String, default: null },
      ownerAadhaarKey: { type: String, default: null },
      ownerPan: { type: String, default: null },
      ownerPanKey: { type: String, default: null },
      businessProof: { type: String, default: null },
      businessProofKey: { type: String, default: null },
      shopPhoto: { type: String, default: null },
      shopPhotoKey: { type: String, default: null },
      profilePhoto: { type: String, default: null },
      profilePhotoKey: { type: String, default: null }
    },
    aadhaarImage: { type: String, default: null },
    panImage: { type: String, default: null },
    businessProofImage: { type: String, default: null },
    shopPhoto: { type: String, default: null },
    profilePhoto: { type: String, default: null },

    // Agreements & e-Sign PDFs (1 or 2 PDFs depending on savings account option)
    agreements: {
      requiredPdfCount: { type: Number, default: 1 },
      pigmyAgreementPdfUrl: { type: String, default: null },
      pigmyAgreementDocId: { type: String, default: null },
      pigmyAgreementStatus: {
        type: String,
        enum: ['PENDING', 'GENERATED', 'ESIGNED', 'REJECTED'],
        default: 'PENDING'
      },
      savingsAccountPdfUrl: { type: String, default: null },
      savingsAccountDocId: { type: String, default: null },
      savingsAccountStatus: {
        type: String,
        enum: ['PENDING', 'GENERATED', 'ESIGNED', 'REJECTED', 'NOT_APPLICABLE'],
        default: 'NOT_APPLICABLE'
      },
      signedAt: { type: Date, default: null },
      eSignTxnId: { type: String, default: null }
    },

    approvalStatus: {
      type: String,
      enum: ['PENDING_BRANCH_APPROVAL', 'APPROVED', 'REJECTED'],
      default: 'PENDING_BRANCH_APPROVAL',
      index: true
    },
    rejectionReason: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'BLOCKED'],
      default: 'INACTIVE',
      index: true
    },
    onboardedBy: {
      id: { type: mongoose.Schema.Types.Mixed, default: null },
      userId: { type: mongoose.Schema.Types.Mixed, default: null },
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      role: { type: String, default: '' }
    },
    approvedAt: {
      type: Date,
      default: null
    },
    rejectedAt: {
      type: Date,
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
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

pigmyCustomerSchema.plugin(softDeletePlugin);

export const PigmyCustomer = mongoose.models.PigmyCustomer || mongoose.model('PigmyCustomer', pigmyCustomerSchema);

// Alias PigmyCustomerProfile for backwards compatibility with dynamic refPath
if (!mongoose.models.PigmyCustomerProfile) {
  mongoose.model('PigmyCustomerProfile', pigmyCustomerSchema);
}
