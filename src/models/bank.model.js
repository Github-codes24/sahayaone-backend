import mongoose from 'mongoose';
import softDeletePlugin from '../database/plugins/soft-delete.plugin.js';

const bankSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },
    logo: {
      type: String,
      default: null,
      trim: true
    },
    logoKey: {
      type: String,
      default: null,
      trim: true
    },
    signatureUrl: {
      type: String,
      default: null,
      trim: true
    },
    signatureKey: {
      type: String,
      default: null,
      trim: true
    },
    signatoryName: {
      type: String,
      default: 'Authorized Signatory',
      trim: true
    },
    signatoryDesignation: {
      type: String,
      default: 'Head - Human Resources',
      trim: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    alternateEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: null
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true
    },
    passwordHash: {
      type: String,
      default: null
    },
    credit: {
      type: Number,
      default: 0
    },
    ubo: {
      type: String,
      required: true,
      trim: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true
    },
    pricing: {
      emiCardQuantity: { type: Number, default: 110 },
      verificationCreditQuantity: { type: Number, default: 220 },
      emiCardPrice: { type: Number, default: 11000 },
      verificationCreditPrice: { type: Number, default: 11000 },
      totalAmount: { type: Number, default: 22000 },
      cgst: { type: Number, default: 0 },
      sgst: { type: Number, default: 0 },
      totalPayableAmount: { type: Number, default: 22000 }
    },
    documents: {
      registrationCertificate: { type: String, default: null },
      registrationCertificateKey: { type: String, default: null },
      companyPan: { type: String, default: null },
      companyPanKey: { type: String, default: null },
      boardResolution: { type: String, default: null },
      boardResolutionKey: { type: String, default: null },
      gstDeclaration: { type: String, default: null },
      gstDeclarationKey: { type: String, default: null },
      directorKyc: { type: String, default: null },
      directorKycKey: { type: String, default: null },
      cancelledCheque: { type: String, default: null },
      cancelledChequeKey: { type: String, default: null }
    },
    bankAccountDetails: {
      bankName: { type: String, default: null, trim: true },
      accountNumber: { type: String, default: null, trim: true, index: true },
      ifsc: { type: String, default: null, trim: true },
      accountHolder: { type: String, default: null, trim: true }
    },
    features: {
      type: [String],
      default: []
    },
    productIncentives: [
      {
        product: { type: String, required: true, trim: true },
        incentiveType: {
          type: String,
          enum: ['PRODUCT', 'QUANTITY', 'PERCENTAGE', 'PER_UNIT', 'NONE'],
          default: 'NONE'
        },
        incentiveValue: { type: Number, min: 0, default: 0 }
      }
    ],
    status: {
      type: String,
      enum: ['PENDING', 'ON_VERIFICATION', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE', 'BLOCKED'],
      default: 'PENDING',
      index: true
    },
    cardQuantity: {
      type: Number,
      default: 0
    },
    verificationCredit: {
      type: Number,
      default: 0
    },
    creditLimit: {
      type: Number,
      default: 0
    },
    paymentMethod: {
      type: String,
      enum: ['CASH', 'ONLINE', 'UPI', 'CARD', 'BANK_TRANSFER', 'NET_BANKING', 'NETBANKING', 'WALLET', 'EMANDATE'],
      default: null
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED'],
      default: null
    },
    totalEmiCards: {
      type: Number,
      default: 0
    },
    availableEmiCards: {
      type: Number,
      default: 0
    },
    totalVerificationCredits: {
      type: Number,
      default: 0
    },
    availableVerificationCredits: {
      type: Number,
      default: 0
    },
    totalAmountPaid: {
      type: Number,
      default: 0
    },
    cardRate: {
      type: Number,
      default: 0
    },
    verificationCreditRate: {
      type: Number,
      default: 0
    },
    cardAmount: {
      type: Number,
      default: 0
    },
    verificationCreditAmount: {
      type: Number,
      default: 0
    },
    subTotalAmount: {
      type: Number,
      default: 0
    },
    cgst: {
      type: Number,
      default: 0
    },
    sgst: {
      type: Number,
      default: 0
    },
    tempOtp: {
      type: String,
      default: null
    },
    tempOtpExpires: {
      type: Date,
      default: null
    },
    paymentGatewayOrderId: {
      type: String,
      default: null
    },
    paymentLinkId: {
      type: String,
      default: null,
      index: true
    },
    paymentLink: {
      type: String,
      default: null
    },
    paymentGatewayTransactionId: {
      type: String,
      default: null
    },
    rawPaymentResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    paymentHistory: [
      {
        orderId: { type: String, default: null },
        transactionId: { type: String, default: null },
        paymentMethod: { type: String, default: null },
        paymentStatus: { type: String, default: null },
        amount: { type: Number, default: 0 },
        source: { type: String, enum: ['API_INITIATE', 'API_VERIFY', 'WEBHOOK', 'CASH_OTP'], default: 'API_VERIFY' },
        rawPayload: { type: mongoose.Schema.Types.Mixed, default: null },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    onboardingTeamMemberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OnboardingTeam',
      default: null,
      index: true
    },
    cashCollectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    cashCollectedByTeamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OnboardingTeam',
      default: null,
      index: true
    },
    cashCollectedAt: {
      type: Date,
      default: null
    },
    cashSettledStatus: {
      type: String,
      enum: ['UNSETTLED', 'PARTIALLY_SETTLED', 'SETTLED'],
      default: null,
      index: true
    },
    cashSettledAmount: {
      type: Number,
      default: 0
    },
    cashPendingAmount: {
      type: Number,
      default: 0
    },
    cashSettlementHistory: [
      {
        submissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'CashSubmission' },
        amount: { type: Number, required: true },
        date: { type: Date, default: Date.now },
        settledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        remarks: { type: String, default: '' },
        receiptNumber: { type: String, default: '' }
      }
    ],
    remarks: {
      type: String,
      trim: true,
      default: null
    },
    rejectionRemarks: {
      type: String,
      trim: true,
      default: null
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: null
    },
    rejectedAt: {
      type: Date,
      default: null
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    verifiedAt: {
      type: Date,
      default: null
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    resubmittedAt: {
      type: Date,
      default: null
    },
    resubmissionNotes: {
      type: String,
      trim: true,
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
    },
    latitude: {
      type: Number,
      default: null
    },
    longitude: {
      type: Number,
      default: null
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: undefined
      }
    },
    onboardingAddress: {
      type: String,
      default: null
    },
    // === RAZORPAY OAUTH SUB-MERCHANT CONNECTION ===
    razorpay: {
      isConnected: {
        type: Boolean,
        default: false,
        index: true
      },
      accountId: {
        type: String, // e.g., "acc_P123456789"
        default: null,
        trim: true,
        index: true
      },
      publicToken: {
        type: String, // Sub-merchant public key for frontend checkout
        default: null,
        trim: true
      },
      accessToken: {
        type: String,
        default: null
      },
      refreshToken: {
        type: String,
        default: null
      },
      tokenExpiresAt: {
        type: Date,
        default: null
      },
      connectedAt: {
        type: Date,
        default: null
      }
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Pre-save hook to sanitize invalid GeoJSON location object before saving
bankSchema.pre('save', function (next) {
  if (this.location) {
    if (!this.location.coordinates || !Array.isArray(this.location.coordinates) || this.location.coordinates.length !== 2) {
      this.location = undefined;
    }
  }
  next();
});

bankSchema.plugin(softDeletePlugin);

bankSchema.index({ location: '2dsphere' }, { sparse: true });

export const Bank = mongoose.model('Bank', bankSchema);
