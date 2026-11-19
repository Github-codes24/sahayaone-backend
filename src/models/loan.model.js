import mongoose from 'mongoose';
import softDeletePlugin from '../database/plugins/soft-delete.plugin.js';
import { Variant } from './variant.model.js';

const emiInstallmentSchema = new mongoose.Schema({
  monthName: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['PAID', 'DUE', 'UPCOMING'],
    default: 'UPCOMING'
  },
  paidAt: {
    type: Date,
    default: null
  }
});

const loanSchema = new mongoose.Schema(
  {
    applicationId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Variant',
      required: false,
      default: null,
      index: true
    },
    status: {
      type: String,
      enum: ['NEW', 'PENDING', 'PENDING_APPROVAL', 'APPROVED', 'PENDING_DOWN_PAYMENT', 'ACTIVE', 'COMPLETED', 'REJECTED', 'CANCELLED', 'EXPIRED'],
      default: 'NEW',
      index: true
    },
    currentStep: {
      type: String,
      enum: [
        'PRODUCT_DETAILS',
        'SLABS',
        'CALCULATE',
        'LOAN_CALCULATED',
        'BANK_ACCOUNT',
        'SIGNATURE_OTP',
        'CHOOSE_PAYMENT',
        'PENDING_APPROVAL',
        'READY_FOR_DISBURSAL',
        'COMPLETED',
        'LOOKUP'
      ],
      default: 'PRODUCT_DETAILS',
      index: true
    },
    paymentMethod: {
      type: String,
      enum: ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'NET_BANKING', 'NETBANKING', 'ONLINE'],
      default: null
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED'],
      default: null
    },
    paymentTransactionId: {
      type: String,
      default: null
    },
    downPaymentPaidAt: {
      type: Date,
      default: null
    },
    disbursedAt: {
      type: Date,
      default: null
    },
    productPrice: {
      type: Number,
      default: 0
    },
    emiCardCharges: {
      type: Number,
      default: 1500
    },
    membershipFee: {
      type: Number,
      default: 110
    },
    processingFees: {
      type: Number,
      default: 1200
    },
    totalAmount: {
      type: Number,
      default: 0
    },
    downPayment: {
      type: Number,
      default: 0
    },
    totalLoanAmount: {
      type: Number,
      default: 0
    },
    interestAmount: {
      type: Number,
      default: 0
    },
    dbd: {
      type: Number,
      default: 0
    },
    insuranceAmount: {
      type: Number,
      default: 0
    },
    totalPayableAmount: {
      type: Number,
      default: 0
    },
    emiAmount: {
      type: Number,
      default: 0
    },
    tenureMonths: {
      type: Number,
      default: 0
    },
    paidEmisCount: {
      type: Number,
      default: 0
    },
    outstandingAmount: {
      type: Number,
      default: 0
    },
    nextEmiDueDate: {
      type: Date,
      default: null
    },
    nocKey: {
      type: String,
      default: null
    },
    schedule: [emiInstallmentSchema],
    assignedEmployeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true
    },
    assignedBankId: {
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
    state: {
      type: String,
      trim: true,
      default: null
    },
    createdByExecutiveId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true
    },
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MerchantProfile',
      required: false,
      index: true
    },
    createdByMerchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true
    },
    sourceType: {
      type: String,
      enum: ['EXECUTIVE', 'MERCHANT', 'SOCIETY', 'DIRECT', 'SUPER_ADMIN'],
      default: 'EXECUTIVE',
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    createdByDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    disbursedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    disbursedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    disbursedByDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    digitalSignature: {
      type: String,
      default: null
    },
    emiSetupByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    downPaymentVerifiedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    repaymentBankAccount: {
      bankName: { type: String, default: null },
      accountNumber: { type: String, default: null },
      ifsc: { type: String, default: null },
      accountHolder: { type: String, default: null }
    },
    productDetails: {
      brandName: { type: String, trim: true, default: null },
      modelName: { type: String, trim: true, default: null },
      imeiNumber: { type: String, trim: true, default: null },
      productPhoto: { type: String, default: null },
      imeiPhoto: { type: String, default: null },
      merchantName: { type: String, trim: true, default: null }
    },
    mandateDetails: {
      mandateId: { type: String, default: null },
      tokenId: { type: String, default: null },
      authType: { type: String, enum: ['NETBANKING', 'NET_BANKING', 'DEBIT_CARD', 'UPI', 'EMANDATE', 'MOCK'], default: null },
      maxAmount: { type: Number, default: 15000 },
      status: { type: String, enum: ['PENDING', 'ACTIVE', 'REJECTED', 'FAILED'], default: 'PENDING' },
      initiatedAt: { type: Date, default: null },
      verifiedAt: { type: Date, default: null }
    },
    antiTamperingChecksum: {
      type: String,
      default: null
    },
    termsAccepted: {
      accepted: { type: Boolean, default: false },
      acceptedAt: { type: Date, default: null },
      ipAddress: { type: String, default: null }
    },
    approvalTimer: {
      approvalStatus: { type: String, enum: ['PENDING_APPROVAL', 'APPROVED', 'AUTO_APPROVED', 'REJECTED'], default: 'PENDING_APPROVAL' },
      timerExpiresAt: { type: Date, default: null },
      approvedAt: { type: Date, default: null },
      autoApproved: { type: Boolean, default: false },
      approvedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
    },
    pdfDocuments: {
      loanAgreementPdfUrl: { type: String, default: null },
      societyAccountOpeningPdfUrl: { type: String, default: null },
      kfsSignedDocumentPdfUrl: { type: String, default: null },
      generatedAt: { type: Date, default: null }
    },
    esignDetails: {
      provider: { type: String, default: 'SPRINTVERIFY' },
      txnId: { type: String, default: null },
      status: { type: String, enum: ['PENDING', 'INITIATED', 'SIGNED', 'FAILED'], default: 'PENDING' },
      signedAt: { type: Date, default: null },
      signedPdfUrl: { type: String, default: null }
    },
    draftMetadata: {
      lastSavedStep: { type: String, default: 'LOOKUP' },
      lastSavedAt: { type: Date, default: Date.now },
      expiresAt: { type: Date, default: null },
      isExpired: { type: Boolean, default: false }
    },
    merchantSettlement: {
      settlementStatus: {
        type: String,
        enum: ['PENDING_BRANCH_PAYMENT', 'SETTLED_BY_BRANCH', 'REJECTED'],
        default: 'PENDING_BRANCH_PAYMENT',
        index: true
      },
      settlementAmount: { type: Number, default: 0 },
      netDisbursalAmount: { type: Number, default: 0 },
      settledAt: { type: Date, default: null },
      settledByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
      bankId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', default: null },
      paymentTxnRef: { type: String, default: null },
      remarks: { type: String, default: null }
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

loanSchema.plugin(softDeletePlugin);

export const Loan = mongoose.model('Loan', loanSchema);
