import Joi from 'joi';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const panRegex = /^[A-Z]{5}\d{4}[A-Z]{1}$/;
const aadhaarRegex = /^([xX\d]{12}|[xX\d]{4}[-\s]?[xX\d]{4}[-\s]?[xX\d]{4})$/;
const pinCodeRegex = /^\d{6}$/;
const otpRegex = /^\d{6}$/;

export const createApplicationSchema = {
  body: Joi.object({
    variantIds: Joi.array()
      .items(Joi.string().pattern(objectIdRegex).message('Invalid variant ID structure.'))
      .min(1)
      .required()
      .messages({
        'array.min': 'Select at least one product to begin.'
      })
  })
};

export const submitPersonalDetailsSchema = {
  body: Joi.object({
    fullName: Joi.string().trim().min(3).required().messages({
      'string.min': 'Full name must contain at least 3 letters.'
    }),
    gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER').required(),
    dob: Joi.date().raw().required().messages({
      'any.required': 'Date of birth is required.'
    }),
    panNumber: Joi.string().uppercase().pattern(panRegex).required().messages({
      'string.pattern.base': 'Please enter a valid 10-character PAN number.'
    }),
    aadhaarNumber: Joi.string().pattern(aadhaarRegex).required().messages({
      'string.pattern.base': 'Please enter a valid 12-digit or masked Aadhaar number.'
    }),
    currentPinCode: Joi.string().pattern(pinCodeRegex).required().messages({
      'string.pattern.base': 'Please enter a valid 6-digit PIN code.'
    }),
    panImage: Joi.string().required().messages({
      'any.required': 'Please upload PAN card image.'
    }),
    aadhaarImage: Joi.string().required().messages({
      'any.required': 'Please upload Aadhaar card image.'
    }),
    extraDetails: Joi.object().optional()
  })
};

export const verifyOtpSchema = {
  body: Joi.object({
    transactionId: Joi.string().trim().required(),
    otp: Joi.string().pattern(otpRegex).required().messages({
      'string.pattern.base': 'Verification code must be a 6-digit numeric OTP.'
    })
  })
};
