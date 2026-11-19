
import Joi from 'joi';

export const saveGeneralInfoSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100).required(),
  ubo: Joi.string().trim().min(3).max(100).required(),
  phoneNumber: Joi.string().pattern(/^[0-9]{10}$/).required()
    .messages({ 'string.pattern.base': 'Phone number must be a valid 10-digit mobile number.' }),
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  alternateEmail: Joi.string().email({ tlds: { allow: false } }).allow('').optional(),
  password: Joi.string().min(6).required(),
  logo: Joi.string().trim().allow(null, '').optional()
});

export const uploadDocumentsSchema = Joi.object({
  registrationCertificate: Joi.string().trim().optional(),
  companyPan: Joi.string().trim().optional(),
  boardResolution: Joi.string().trim().optional(),
  gstDeclaration: Joi.string().trim().optional(),
  directorKyc: Joi.string().trim().optional(),
  cancelledCheque: Joi.string().trim().optional()
});

export const calculatePricingSchema = Joi.object({
  cardQuantity: Joi.number().integer().min(1).required()
    .messages({ 'number.min': 'EMI Card quantity must be at least 1.' }),
  verificationCredit: Joi.number().integer().min(1).required()
    .messages({ 'number.min': 'Verification Credit quantity must be at least 1.' })
});

export const initiatePaymentSchema = Joi.object({
  paymentMethod: Joi.string().trim().uppercase().valid('CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'ONLINE', 'NET_BANKING', 'NETBANKING', 'WALLET', 'EMANDATE').required(),
  transactionId: Joi.string().trim().optional().allow('', null),
  referenceId: Joi.string().trim().optional().allow('', null),
  utrNumber: Joi.string().trim().optional().allow('', null),
  proofUrl: Joi.string().trim().optional().allow('', null)
});

export const verifyPaymentSchema = Joi.object({
  otp: Joi.string().pattern(/^[0-9]{6}$/).optional()
    .messages({ 'string.pattern.base': 'OTP must be a valid 6-digit code.' }),
  paymentStatus: Joi.string().valid('SUCCESS', 'FAILED', 'PENDING').optional(),
  paymentMethod: Joi.string().trim().uppercase().valid('CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'ONLINE', 'NET_BANKING', 'NETBANKING', 'WALLET', 'EMANDATE').optional(),
  razorpay_order_id: Joi.string().optional().allow('', null),
  razorpay_payment_id: Joi.string().optional().allow('', null),
  razorpay_signature: Joi.string().optional().allow('', null),
  paymentGatewayTransactionId: Joi.string().optional().allow('', null),
  transactionId: Joi.string().optional().allow('', null),
  referenceId: Joi.string().optional().allow('', null),
  utrNumber: Joi.string().optional().allow('', null),
  bankReferenceId: Joi.string().optional().allow('', null),
  proofUrl: Joi.string().optional().allow('', null)
});

export const createBranchSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100).required(),
  code: Joi.string().trim().min(3).max(20).required(),
  cardStock: Joi.number().integer().min(0).optional().default(0),
  verificationCredits: Joi.number().integer().min(0).optional().default(0)
});

export const allocateCreditsSchema = Joi.object({
  cardStock: Joi.number().integer().min(0).optional().default(0),
  verificationCredits: Joi.number().integer().min(0).optional().default(0)
});

export const updateGeneralInfoSchema = Joi.object({
  name: Joi.string().trim().min(3).max(100).optional(),
  ubo: Joi.string().trim().min(3).max(100).optional(),
  phoneNumber: Joi.string().pattern(/^[0-9]{10}$/).optional()
    .messages({ 'string.pattern.base': 'Phone number must be a valid 10-digit mobile number.' }),
  email: Joi.string().email({ tlds: { allow: false } }).optional(),
  alternateEmail: Joi.string().email({ tlds: { allow: false } }).allow('').optional(),
  password: Joi.string().min(6).optional(),
  logo: Joi.string().trim().allow(null, '').optional()
});

export const saveBankAccountSchema = Joi.object({
  bankName: Joi.string().trim().required().messages({ 'any.required': 'Bank name is required.' }),
  accountNumber: Joi.string().trim().required().messages({ 'any.required': 'Account number is required.' }),
  ifsc: Joi.string().trim().required().messages({ 'any.required': 'IFSC is required.' }),
  accountHolder: Joi.string().trim().required().messages({ 'any.required': 'Account holder name is required.' })
});

export const saveFeaturesSchema = Joi.object({
  features: Joi.array().items(
    Joi.string().valid(
      'HR_MANAGEMENT',
      'LOAN_MANAGEMENT',
      'INVENTORY_MANAGEMENT',
      'RECEIPT_MANAGEMENT',
      'VERIFICATION_SERVICE',
      'UPI_AUTOPAY',
      'E_NACH',
      'WHATSAPP_BANKING',
      'BIOMETRIC_INTEGRATION',
      'PAPERLESS_E_KYC'
    ).required()
  ).min(1).required().messages({
    'array.min': 'Please select at least one feature.',
    'any.required': 'Features list is required.'
  })
});
