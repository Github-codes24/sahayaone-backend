import Joi from 'joi';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const panRegex = /^[A-Z]{5}\d{4}[A-Z]{1}$/;
const aadhaarRegex = /^([xX\d]{12}|[xX\d]{4}[-\s]?[xX\d]{4}[-\s]?[xX\d]{4})$/;
const pinCodeRegex = /^\d{6}$/;
const otpRegex = /^\d{6}$/;

const cleanPhone = (value, helpers) => {
  if (!value) return value;
  const digits = String(value).replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) {
    return helpers.message('Mobile number must be a valid 10-digit phone number.');
  }
  return digits;
};

const parseLeadDob = (value, helpers) => {
  if (value === undefined || value === null || value === '') return value;
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Support DD-MM-YYYY or DD/MM/YYYY (e.g. 25-05-2000, 10/05/2000)
    const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      const year = parseInt(dmyMatch[3], 10);
      const date = new Date(year, month, day);
      if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
        return date;
      }
    }

    // Support YYYY-MM-DD or YYYY/MM/DD (e.g. 2000-05-25, 2000/05/25)
    const ymdMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      const month = parseInt(ymdMatch[2], 10) - 1;
      const day = parseInt(ymdMatch[3], 10);
      const date = new Date(year, month, day);
      if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
        return date;
      }
    }

    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  return helpers.message('dob must be a valid date (accepted formats: DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD).');
};

export const sendLookupOtpSchema = {
  body: Joi.object({
    phoneNumber: Joi.string().custom(cleanPhone).required().messages({
      'any.required': 'phoneNumber is required'
    }),
    type: Joi.string().trim().uppercase().valid('LOAN', 'MERCHANT', 'PIGMY').optional(),
    productType: Joi.string().trim().uppercase().valid('LOAN', 'MERCHANT', 'PIGMY').optional()
  }).unknown(true)
};

export const verifyLookupOtpSchema = {
  body: Joi.object({
    phoneNumber: Joi.string().custom(cleanPhone).required().messages({
      'any.required': 'phoneNumber is required'
    }),
    otp: Joi.string().trim().required().messages({
      'any.required': 'otp is required',
      'string.empty': 'otp cannot be empty'
    }),
    type: Joi.string().trim().uppercase().valid('LOAN', 'MERCHANT', 'PIGMY').optional(),
    productType: Joi.string().trim().uppercase().valid('LOAN', 'MERCHANT', 'PIGMY').optional()
  }).unknown(true)
};

export const digiLockerKycAndCibilCheckSchema = {
  body: Joi.object({
    phoneNumber: Joi.string().custom(cleanPhone).required().messages({
      'any.required': 'phoneNumber is required'
    }),
    aadhaarNumber: Joi.string().trim().pattern(aadhaarRegex).required().messages({
      'any.required': 'aadhaarNumber is required'
    }),
    panNumber: Joi.string().trim().uppercase().pattern(panRegex).required().messages({
      'any.required': 'panNumber is required'
    }),
    refid: Joi.string().trim().optional().allow('', null),
    type: Joi.string().trim().uppercase().valid('LOAN', 'MERCHANT', 'PIGMY').optional(),
    productType: Joi.string().trim().uppercase().valid('LOAN', 'MERCHANT', 'PIGMY').optional(),
    redirectUrl: Joi.string().trim().optional().allow('', null),
    redirect_url: Joi.string().trim().optional().allow('', null),
    callbackUrl: Joi.string().trim().optional().allow('', null),
    digilockerToken: Joi.string().trim().optional().allow('', null)
  }).unknown(true)
};

export const submitCustomerOnboardingSchema = {
  body: Joi.object({
    phoneNumber: Joi.string().custom(cleanPhone).required().messages({
      'any.required': 'phoneNumber is required'
    }),
    type: Joi.string().trim().uppercase().valid('LOAN', 'MERCHANT', 'PIGMY').optional(),
    productType: Joi.string().trim().uppercase().valid('LOAN', 'MERCHANT', 'PIGMY').optional(),
    fullName: Joi.string().trim().min(2).optional(),
    gender: Joi.string().trim().uppercase().valid('MALE', 'FEMALE', 'OTHER').optional(),
    dob: Joi.any().custom(parseLeadDob).optional().allow('', null),
    panNumber: Joi.string().trim().uppercase().pattern(panRegex).optional(),
    aadhaarNumber: Joi.string().trim().pattern(aadhaarRegex).optional(),
    address: Joi.string().trim().optional().allow('', null),
    residentialPincode: Joi.string().trim().pattern(pinCodeRegex).optional().allow('', null),
    panImage: Joi.string().trim().optional().allow('', null),
    aadhaarImage: Joi.string().trim().optional().allow('', null),
    livePhoto: Joi.string().trim().optional().allow('', null)
  }).unknown(true)
};

export const onboardSchema = {
  body: Joi.object({
    fullName: Joi.string().trim().min(3).required().messages({
      'string.min': 'Full name must contain at least 3 letters.'
    }),
    gender: Joi.string().trim().uppercase().valid('MALE', 'FEMALE', 'OTHER').required(),
    dob: Joi.any().custom(parseLeadDob).required().messages({
      'any.required': 'Date of birth is required.'
    }),
    phoneNumber: Joi.string().trim().length(10).pattern(/^\d+$/).required().messages({
      'string.length': 'Mobile number must be exactly 10 digits.',
      'string.pattern.base': 'Mobile number must contain only digits.'
    }),
    panNumber: Joi.string().trim().uppercase().pattern(panRegex).required().messages({
      'string.pattern.base': 'Please enter a valid 10-character PAN number.'
    }),
    panImage: Joi.string().optional().allow('', null),
    aadhaarNumber: Joi.string().trim().pattern(aadhaarRegex).required().messages({
      'string.pattern.base': 'Please enter a valid 12-digit or masked Aadhaar number.'
    }),
    aadhaarImage: Joi.string().optional().allow('', null),
    currentPinCode: Joi.string().trim().pattern(pinCodeRegex).optional().allow('', null)
  }).unknown(true)
};

export const verifyAadhaarSchema = {
  body: Joi.object({
    phoneNumber: Joi.string().trim().length(10).required(),
    transactionId: Joi.string().trim().required(),
    otp: Joi.string().trim().pattern(otpRegex).required().messages({
      'string.pattern.base': 'Verification code must be a 6-digit numeric OTP.'
    })
  }).unknown(true)
};

export const confirmOnboardSchema = {
  body: Joi.object({
    firstName: Joi.string().trim().min(1).optional(),
    lastName: Joi.string().trim().optional().allow(''),
    fullName: Joi.string().trim().min(2).optional(),
    gender: Joi.string().trim().uppercase().valid('MALE', 'FEMALE', 'OTHER').required().messages({
      'any.required': 'gender is required',
      'any.only': 'gender must be one of [MALE, FEMALE, OTHER]'
    }),
    dob: Joi.any().custom(parseLeadDob).required().messages({
      'any.required': 'dob is required'
    }),
    phoneNumber: Joi.string().trim().length(10).required().messages({
      'string.length': 'phoneNumber length must be 10 characters long'
    }),
    panNumber: Joi.string().trim().uppercase().pattern(panRegex).required().messages({
      'string.pattern.base': 'panNumber fails to match required pattern (e.g. ABCDE1234F)'
    }),
    panImage: Joi.string().optional().allow('', null),
    aadhaarNumber: Joi.string().trim().pattern(aadhaarRegex).required().messages({
      'string.pattern.base': 'aadhaarNumber fails to match required pattern (12 digits or masked e.g. xxxxxxxx7383)'
    }),
    aadhaarImage: Joi.string().optional().allow('', null),
    currentPinCode: Joi.string().trim().pattern(pinCodeRegex).optional().allow('', null),
    addressLine: Joi.string().trim().required().messages({
      'any.required': 'addressLine is required'
    }),
    pinCode: Joi.string().trim().pattern(pinCodeRegex).required().messages({
      'string.pattern.base': 'pinCode fails to match required pattern (6 digits)'
    })
  }).or('fullName', 'firstName').unknown(true)
};

export const createLeadSchema = {
  body: Joi.object({
    customerId: Joi.string().pattern(objectIdRegex).required().messages({
      'string.pattern.base': 'Invalid customer user ID.'
    }),
    variantId: Joi.string().pattern(objectIdRegex).required().messages({
      'string.pattern.base': 'Invalid variant ID.'
    })
  })
};

export const productDetailsSchema = {
  body: Joi.object({
    phoneNumber: Joi.string().custom(cleanPhone).required().messages({
      'any.required': 'phoneNumber is required'
    }),
    merchantId: Joi.string().pattern(objectIdRegex).required().messages({
      'any.required': 'merchantId is required',
      'string.pattern.base': 'Invalid merchantId format'
    }),
    brandName: Joi.string().trim().required().messages({
      'any.required': 'brandName is required',
      'string.empty': 'brandName cannot be empty'
    }),
    modelName: Joi.string().trim().required().messages({
      'any.required': 'modelName is required',
      'string.empty': 'modelName cannot be empty'
    }),
    imeiNumber: Joi.string().trim().required().messages({
      'any.required': 'imeiNumber is required',
      'string.empty': 'imeiNumber cannot be empty'
    }),
    productPhoto: Joi.string().trim().required().messages({
      'any.required': 'productPhoto is required',
      'string.empty': 'productPhoto cannot be empty'
    }),
    imeiPhoto: Joi.string().trim().required().messages({
      'any.required': 'imeiPhoto is required',
      'string.empty': 'imeiPhoto cannot be empty'
    }),
    customerId: Joi.string().pattern(objectIdRegex).optional().allow('', null)
  }).unknown(true)
};

export const emiSlabsSchema = {
  body: Joi.object({
    productPrice: Joi.number().positive().required().messages({
      'any.required': 'productPrice is required',
      'number.positive': 'productPrice must be greater than 0'
    }),
    loanId: Joi.string().trim().optional().allow('', null),
    applicationId: Joi.string().trim().optional().allow('', null),
    purchaseEmiCard: Joi.boolean().optional().default(true),
    purchaseInsurance: Joi.boolean().optional().default(false)
  }).unknown(true)
};

export const calculateLoanSchema = {
  body: Joi.object({
    productPrice: Joi.number().positive().required().messages({
      'any.required': 'productPrice is required',
      'number.positive': 'productPrice must be greater than 0'
    }),
    tenureMonths: Joi.number().integer().positive().required().messages({
      'any.required': 'tenureMonths is required'
    }),
    loanId: Joi.string().trim().pattern(objectIdRegex).optional().allow('', null).messages({
      'string.pattern.base': 'Invalid loanId format'
    }),
    applicationId: Joi.string().trim().optional().allow('', null),
    purchaseEmiCard: Joi.boolean().optional().default(true),
    purchaseInsurance: Joi.boolean().optional().default(false)
  }).unknown(true)
};
