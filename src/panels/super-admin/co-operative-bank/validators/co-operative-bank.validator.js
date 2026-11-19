import Joi from 'joi';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

// List Co-operative Banks validator
export const listCooperativeBanksSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().allow('').optional(),
    status: Joi.string().trim().uppercase().valid('PENDING', 'ON_VERIFICATION', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE', 'BLOCKED').optional(),
    sortBy: Joi.string().trim().optional(),
    sortOrder: Joi.string().trim().valid('asc', 'desc', 'ASC', 'DESC').optional()
  })
};

export const getCooperativeBankSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      'any.required': 'Bank ID is required',
      'string.pattern.base': 'Invalid Bank ID format'
    })
  })
};

export const addCreditSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      'any.required': 'Bank ID is required',
      'string.pattern.base': 'Invalid Bank ID format'
    })
  }),
  body: Joi.object({
    quantity: Joi.number().greater(0).optional(),
    quentity: Joi.number().greater(0).optional(),
    creditAmount: Joi.number().greater(0).optional(),
    amount: Joi.number().greater(0).optional(),
    credit: Joi.number().greater(0).optional(),
    type: Joi.string().trim().uppercase().valid('EMI', 'VERIFICATION', 'EMI_CARD', 'VERIFICATION_CREDIT').optional()
  }).or('quantity', 'quentity', 'creditAmount', 'amount', 'credit')
};

export const createCooperativeBankSchema = {
  body: Joi.object({
    bankName: Joi.string().trim().optional(),
    name: Joi.string().trim().optional(),
    authorizedPerson: Joi.string().trim().optional(),
    ubo: Joi.string().trim().optional(),
    email: Joi.string().trim().email({ tlds: { allow: false } }).required().messages({
      'any.required': 'Email is required',
      'string.email': 'Must be a valid email address'
    }),
    alternateEmail: Joi.string().trim().email({ tlds: { allow: false } }).allow('', null).optional(),
    mailIdAlternate: Joi.string().trim().email({ tlds: { allow: false } }).allow('', null).optional(),
    phoneNumber: Joi.string().trim().required().messages({
      'any.required': 'Phone Number is required'
    }),
    phone: Joi.string().trim().optional(),
    credit: Joi.number().min(0).default(0).optional(),
    password: Joi.string().trim().min(6).allow('', null).optional(),
    code: Joi.string().trim().uppercase().optional(),

    // Bank Account Details
    accountBankName: Joi.string().trim().allow('', null).optional(),
    bankAccountName: Joi.string().trim().allow('', null).optional(),
    bankDetailsBankName: Joi.string().trim().allow('', null).optional(),
    accountNumber: Joi.string().trim().allow('', null).optional(),
    ifsc: Joi.string().trim().allow('', null).optional(),
    ifscCode: Joi.string().trim().allow('', null).optional(),
    accountHolderName: Joi.string().trim().allow('', null).optional(),
    accountHolder: Joi.string().trim().allow('', null).optional(),
    bankAccountDetails: Joi.object().optional(),
    bankDetails: Joi.object().optional(),

    // Features / Modules
    features: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).optional(),
    modules: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).optional(),

    // Pricing
    emiCardQuantity: Joi.number().min(0).optional(),
    verificationCreditQuantity: Joi.number().min(0).optional(),
    emiCardPrice: Joi.number().min(0).optional(),
    verificationCreditPrice: Joi.number().min(0).optional(),
    totalAmount: Joi.number().min(0).optional(),
    cgst: Joi.number().min(0).optional(),
    sgst: Joi.number().min(0).optional(),
    totalPayableAmount: Joi.number().min(0).optional(),

    // Payment & Status
    paymentMethod: Joi.string().trim().allow(null, '').optional(),
    paymentStatus: Joi.string().trim().uppercase().valid('PENDING', 'SUCCESS', 'FAILED').allow(null, '').optional(),
    transactionId: Joi.string().trim().allow(null, '').optional(),
    paymentGatewayTransactionId: Joi.string().trim().allow(null, '').optional(),
    status: Joi.string().trim().uppercase().valid('PENDING', 'ON_VERIFICATION', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE', 'BLOCKED').default('PENDING').optional(),

    // Onboarding & Creator attribution
    createdBy: Joi.string().regex(objectIdRegex).allow(null, '').optional(),
    creatorId: Joi.string().regex(objectIdRegex).allow(null, '').optional(),
    onboardedBy: Joi.string().regex(objectIdRegex).allow(null, '').optional(),
    onboardedById: Joi.string().regex(objectIdRegex).allow(null, '').optional(),
    onboardingTeamMemberId: Joi.string().regex(objectIdRegex).allow(null, '').optional()
  })
    .or('bankName', 'name')
    .or('authorizedPerson', 'ubo')
};

export const updateCooperativeBankSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      'any.required': 'Bank ID is required',
      'string.pattern.base': 'Invalid Bank ID format'
    })
  }),
  body: Joi.object({
    bankName: Joi.string().trim().optional(),
    name: Joi.string().trim().optional(),
    authorizedPerson: Joi.string().trim().optional(),
    ubo: Joi.string().trim().optional(),
    email: Joi.string().trim().email({ tlds: { allow: false } }).optional(),
    alternateEmail: Joi.string().trim().email({ tlds: { allow: false } }).allow('', null).optional(),
    mailIdAlternate: Joi.string().trim().email({ tlds: { allow: false } }).allow('', null).optional(),
    phoneNumber: Joi.string().trim().optional(),
    phone: Joi.string().trim().optional(),
    credit: Joi.number().min(0).optional(),
    password: Joi.string().trim().min(6).allow('', null).optional(),
    newPassword: Joi.string().trim().min(6).allow('', null).optional(),
    code: Joi.string().trim().uppercase().optional(),

    // Bank Account Details
    accountBankName: Joi.string().trim().allow('', null).optional(),
    bankAccountName: Joi.string().trim().allow('', null).optional(),
    bankDetailsBankName: Joi.string().trim().allow('', null).optional(),
    accountNumber: Joi.string().trim().allow('', null).optional(),
    ifsc: Joi.string().trim().allow('', null).optional(),
    ifscCode: Joi.string().trim().allow('', null).optional(),
    accountHolderName: Joi.string().trim().allow('', null).optional(),
    accountHolder: Joi.string().trim().allow('', null).optional(),
    bankAccountDetails: Joi.object().optional(),
    bankDetails: Joi.object().optional(),

    // Features / Modules
    features: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).optional(),
    modules: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).optional(),

    // Pricing
    emiCardQuantity: Joi.number().min(0).optional(),
    verificationCreditQuantity: Joi.number().min(0).optional(),
    emiCardPrice: Joi.number().min(0).optional(),
    verificationCreditPrice: Joi.number().min(0).optional(),
    totalAmount: Joi.number().min(0).optional(),
    cgst: Joi.number().min(0).optional(),
    sgst: Joi.number().min(0).optional(),
    totalPayableAmount: Joi.number().min(0).optional(),

    // Payment & Status
    paymentMethod: Joi.string().trim().allow(null, '').optional(),
    paymentStatus: Joi.string().trim().uppercase().valid('PENDING', 'SUCCESS', 'FAILED').allow(null, '').optional(),
    transactionId: Joi.string().trim().allow(null, '').optional(),
    paymentGatewayTransactionId: Joi.string().trim().allow(null, '').optional(),
    status: Joi.string().trim().uppercase().valid('PENDING', 'ON_VERIFICATION', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE', 'BLOCKED').optional(),

    // Onboarding & Creator attribution
    createdBy: Joi.string().regex(objectIdRegex).allow(null, '').optional(),
    creatorId: Joi.string().regex(objectIdRegex).allow(null, '').optional(),
    onboardedBy: Joi.string().regex(objectIdRegex).allow(null, '').optional(),
    onboardedById: Joi.string().regex(objectIdRegex).allow(null, '').optional(),
    onboardingTeamMemberId: Joi.string().regex(objectIdRegex).allow(null, '').optional()
  })
};

export const changeBankPasswordSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).optional()
  }),
  body: Joi.object({
    id: Joi.string().regex(objectIdRegex).optional(),
    bankId: Joi.string().regex(objectIdRegex).optional(),
    password: Joi.string().trim().min(6).optional().messages({
      'string.min': 'Password must be at least 6 characters long'
    }),
    newPassword: Joi.string().trim().min(6).optional().messages({
      'string.min': 'New password must be at least 6 characters long'
    }),
    confirmPassword: Joi.string().trim().min(6).optional()
  }).or('password', 'newPassword')
};

export const updateStatusSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      'any.required': 'Bank ID is required',
      'string.pattern.base': 'Invalid Bank ID format'
    })
  }),
  body: Joi.object({
    status: Joi.string().trim().uppercase().valid('PENDING', 'ON_VERIFICATION', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE', 'BLOCKED').required().messages({
      'any.required': 'Status is required'
    }),
    remarks: Joi.string().trim().when('status', {
      is: 'REJECTED',
      then: Joi.required().messages({
        'any.required': 'Remarks are mandatory when rejecting a bank onboarding request.',
        'string.empty': 'Remarks cannot be empty when rejecting a bank onboarding request.'
      }),
      otherwise: Joi.optional().allow('', null)
    }),
    rejectionRemarks: Joi.string().trim().optional().allow('', null),
    rejectionReason: Joi.string().trim().optional().allow('', null)
  })
};

export const verifyCashOtpSchema = {
  body: Joi.object({
    bankId: Joi.string().regex(objectIdRegex).optional(),
    id: Joi.string().regex(objectIdRegex).optional(),
    otp: Joi.string().trim().pattern(/^\d{6}$/).required().messages({
      'any.required': 'OTP is required',
      'string.pattern.base': 'OTP must be a 6-digit numeric code'
    })
  }).or('bankId', 'id')
};

export const resendCashOtpSchema = {
  body: Joi.object({
    bankId: Joi.string().regex(objectIdRegex).optional(),
    id: Joi.string().regex(objectIdRegex).optional()
  }).or('bankId', 'id')
};

export const verifyOnlinePaymentSchema = {
  body: Joi.object({
    bankId: Joi.string().regex(objectIdRegex).optional(),
    id: Joi.string().regex(objectIdRegex).optional(),
    razorpay_order_id: Joi.string().trim().optional(),
    razorpay_payment_id: Joi.string().trim().optional(),
    razorpay_signature: Joi.string().trim().optional(),
    transactionId: Joi.string().trim().optional(),
    paymentGatewayTransactionId: Joi.string().trim().optional()
  }).or('bankId', 'id')
};

export const calculateEmiCardPriceSchema = {
  body: Joi.object({
    quantity: Joi.number().integer().min(0).optional(),
    emiCardQuantity: Joi.number().integer().min(0).optional(),
    count: Joi.number().integer().min(0).optional()
  }).or('quantity', 'emiCardQuantity', 'count')
};

export const calculateVerificationCreditPriceSchema = {
  body: Joi.object({
    quantity: Joi.number().integer().min(0).optional(),
    verificationCreditQuantity: Joi.number().integer().min(0).optional(),
    count: Joi.number().integer().min(0).optional()
  }).or('quantity', 'verificationCreditQuantity', 'count')
};

export const calculatePriceSchema = {
  body: Joi.object({
    emiCardQuantity: Joi.number().integer().min(0).optional(),
    verificationCreditQuantity: Joi.number().integer().min(0).optional(),
    emiCardCount: Joi.number().integer().min(0).optional(),
    verificationCreditCount: Joi.number().integer().min(0).optional()
  })
};


