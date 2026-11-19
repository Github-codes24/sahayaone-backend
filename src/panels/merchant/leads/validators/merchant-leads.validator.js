import Joi from 'joi';

export const sendLookupOtpSchema = {
  body: Joi.object({
    phoneNumber: Joi.string()
      .pattern(/^[0-9]{10}$/)
      .required()
      .messages({
        'string.pattern.base': 'Phone number must be an active 10-digit mobile number.',
        'any.required': 'Phone number is required for customer lookup.'
      })
  })
};

export const verifyLookupOtpSchema = {
  body: Joi.object({
    phoneNumber: Joi.string()
      .pattern(/^[0-9]{10}$/)
      .required()
      .messages({
        'string.pattern.base': 'Phone number must be an active 10-digit mobile number.',
        'any.required': 'Phone number is required.'
      }),
    otp: Joi.string()
      .length(6)
      .required()
      .messages({
        'string.length': 'Verification OTP code must be exactly 6 digits.',
        'any.required': 'Verification OTP is required.'
      })
  })
};

export const onboardSchema = {
  body: Joi.object({
    fullName: Joi.string().trim().min(2).max(100).required().messages({
      'any.required': 'Customer full name is required.'
    }),
    gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER').required().messages({
      'any.required': 'Gender is required.'
    }),
    dob: Joi.string().isoDate().required().messages({
      'any.required': 'Date of birth is required in ISO format (YYYY-MM-DD).'
    }),
    phoneNumber: Joi.string().pattern(/^[0-9]{10}$/).required().messages({
      'string.pattern.base': 'Phone number must be a 10-digit numeric string.'
    }),
    panNumber: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).required().messages({
      'string.pattern.base': 'Invalid PAN format. Must match standard 10-character alphanumeric PAN format.'
    }),
    panImage: Joi.string().optional().messages({
      'any.required': 'PAN image is required.'
    }),
    aadhaarNumber: Joi.string().pattern(/^[0-9]{12}$/).required().messages({
      'string.pattern.base': 'Aadhaar must be a 12-digit numeric identity code.'
    }),
    aadhaarImage: Joi.string().optional().messages({
      'any.required': 'Aadhaar document image is required.'
    }),
    currentPinCode: Joi.string().pattern(/^[0-9]{6}$/).required().messages({
      'string.pattern.base': 'Current residential PIN code must be a 6-digit postal index code.'
    })
  })
};

export const verifyAadhaarSchema = {
  body: Joi.object({
    phoneNumber: Joi.string().pattern(/^[0-9]{10}$/).required().messages({
      'string.pattern.base': 'Phone number must be a 10-digit mobile number.'
    }),
    transactionId: Joi.string().required().messages({
      'any.required': 'Verification transaction ID is required.'
    }),
    otp: Joi.string().length(6).required().messages({
      'string.length': 'Aadhaar verification OTP must be 6 digits.',
      'any.required': 'Aadhaar verification OTP is required.'
    })
  })
};

export const confirmOnboardSchema = {
  body: Joi.object({
    fullName: Joi.string().trim().min(2).max(100).required(),
    gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER').required(),
    dob: Joi.string().isoDate().required(),
    phoneNumber: Joi.string().pattern(/^[0-9]{10}$/).required(),
    panNumber: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).required(),
    panImage: Joi.string().optional(),
    aadhaarNumber: Joi.string().pattern(/^[0-9]{12}$/).required(),
    aadhaarImage: Joi.string().optional(),
    currentPinCode: Joi.string().pattern(/^[0-9]{6}$/).required(),
    addressLine: Joi.string().trim().min(5).max(250).required().messages({
      'any.required': 'Detailed residential address line is required.'
    }),
    pinCode: Joi.string().pattern(/^[0-9]{6}$/).required().messages({
      'string.pattern.base': 'Postal PIN code must be a 6-digit number.'
    })
  })
};

export const createLeadSchema = {
  body: Joi.object({
    customerId: Joi.string().hex().length(24).required().messages({
      'string.hex': 'Customer ID must be a valid 24-character hexadecimal ObjectId.',
      'any.required': 'Customer ID is required.'
    }),
    variantId: Joi.string().hex().length(24).required().messages({
      'string.hex': 'Product Variant ID must be a valid 24-character hexadecimal ObjectId.',
      'any.required': 'Variant ID is required.'
    })
  })
};

export const listLeadsQuerySchema = {
  query: Joi.object({
    status: Joi.string().trim().optional(),
    search: Joi.string().trim().optional(),
    state: Joi.string().trim().optional(),
    city: Joi.string().trim().optional(),
    startDate: Joi.string().trim().optional(),
    endDate: Joi.string().trim().optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional()
  }).unknown(true)
};
