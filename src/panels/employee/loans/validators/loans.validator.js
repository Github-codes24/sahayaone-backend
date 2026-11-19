import Joi from 'joi';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const setupEmiSchema = {
  body: Joi.object({
    productPrice: Joi.number().positive().required(),
    tenureMonths: Joi.number().integer().positive().required(),
    interestPercentage: Joi.number().min(0).max(100).optional(),
    purchaseEmiCard: Joi.boolean().required(),
    purchaseInsurance: Joi.boolean().required(),
    emiCardNumber: Joi.string().allow('').optional(),
    downPayment: Joi.number().min(0).optional(),
    otp: Joi.string().required().messages({
      'any.required': 'Disbursal OTP is required.'
    }),
    signature: Joi.string().required().messages({
      'any.required': 'Digital signature image is required.'
    })
  })
};

export const calculateEmiSchema = {
  body: Joi.object({
    productPrice: Joi.number().positive().required(),
    tenureMonths: Joi.number().integer().positive().required(),
    interestPercentage: Joi.number().min(0).max(100).optional(),
    purchaseEmiCard: Joi.boolean().optional(),
    purchaseInsurance: Joi.boolean().optional(),
    downPayment: Joi.number().min(0).optional(),
    customerId: Joi.string().pattern(objectIdRegex).optional()
  })
};

export const bankAccountSchema = {
  body: Joi.object({
    bankAccountId: Joi.string().pattern(objectIdRegex).optional(),
    bankName: Joi.string().when('bankAccountId', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required()
    }).messages({ 'any.required': 'Bank name is required.' }),
    accountNumber: Joi.string().pattern(/^\d{9,18}$/).when('bankAccountId', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required()
    }).messages({
      'any.required': 'Account number is required.',
      'string.pattern.base': 'Account number must be between 9 and 18 digits.'
    }),
    ifsc: Joi.string().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/i).when('bankAccountId', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required()
    }).messages({
      'any.required': 'IFSC code is required.',
      'string.pattern.base': 'Invalid IFSC code format (e.g. SBIN0001234).'
    }),
    accountHolder: Joi.string().min(3).when('bankAccountId', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required()
    }).messages({
      'any.required': 'Account holder name is required.',
      'string.min': 'Account holder name must be at least 3 characters long.'
    })
  })
};

export const initiateEmiCollectionSchema = {
  body: Joi.object({
    installmentIds: Joi.array()
      .items(Joi.string().pattern(objectIdRegex).message('Invalid installment ID format.'))
      .min(1)
      .required(),
    paymentMethod: Joi.string().trim().uppercase().valid('CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'NET_BANKING', 'NETBANKING', 'ONLINE').required().messages({
      'any.required': 'Payment method is required.',
      'any.only': 'Invalid payment method. Must be CASH, UPI, CARD, BANK_TRANSFER, NET_BANKING, or ONLINE.'
    })
  })
};

export const verifyEmiCollectionSchema = {
  body: Joi.object({
    installmentIds: Joi.array()
      .items(Joi.string().pattern(objectIdRegex).message('Invalid installment ID format.'))
      .min(1)
      .required(),
    paymentMethod: Joi.string().trim().uppercase().valid('CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'NET_BANKING', 'NETBANKING', 'ONLINE').required(),
    otp: Joi.string().length(6).optional().messages({
      'string.length': 'OTP must be exactly 6 digits.'
    }),
    paymentStatus: Joi.string().valid('SUCCESS', 'PENDING', 'FAILED').optional()
  })
};

export const getEligibleSlabsSchema = {
  query: Joi.object({
    productPrice: Joi.number().positive().required().messages({
      'any.required': 'Product price is required to calculate eligible EMI slabs.'
    })
  })
};

export const initiateDownPaymentSchema = {
  body: Joi.object({
    paymentMethod: Joi.string().trim().uppercase().valid('CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'NET_BANKING', 'NETBANKING', 'ONLINE').required().messages({
      'any.required': 'Payment method is required.',
      'any.only': 'Invalid payment method. Must be CASH, UPI, CARD, BANK_TRANSFER, NET_BANKING, or ONLINE.'
    })
  })
};

export const verifyDownPaymentSchema = {
  body: Joi.object({
    otp: Joi.string().length(6).optional().messages({
      'string.length': 'Confirmation OTP code must be exactly 6 characters.'
    }),
    paymentStatus: Joi.string().valid('SUCCESS', 'PENDING', 'FAILED').optional().messages({
      'any.only': 'Invalid payment verification status. Must be SUCCESS, PENDING, or FAILED.'
    })
  })
};
