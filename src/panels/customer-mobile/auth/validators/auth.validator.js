import Joi from 'joi';

const phoneRegex = /^(\+91|91|0)?[6-9]\d{9}$/; // Standard 10-digit Indian mobile numbers check (with optional country code)
const otpRegex = /^\d{6}$/;
const mpinRegex = /^\d{4}$/;

export const verifyMobileSchema = {
  body: Joi.object({
    phoneNumber: Joi.string().pattern(phoneRegex).required().messages({
      'string.pattern.base': 'Phone number must be a valid 10-digit mobile number'
    })
  }).unknown(true)
};

export const verifyOtpSchema = {
  body: Joi.object({
    phoneNumber: Joi.string().pattern(phoneRegex).required(),
    otp: Joi.string().pattern(otpRegex).required().messages({
      'string.pattern.base': 'OTP must be a valid 6-digit numeric code'
    })
  }).unknown(true)
};

export const registerMpinSchema = {
  body: Joi.object({
    mpin: Joi.string().pattern(mpinRegex).optional().messages({
      'string.pattern.base': 'MPIN must be a 4-digit security code'
    }),
    newMpin: Joi.string().pattern(mpinRegex).optional().messages({
      'string.pattern.base': 'MPIN must be a 4-digit security code'
    }),
    confirmMpin: Joi.string().pattern(mpinRegex).optional(),
    phoneNumber: Joi.string().pattern(phoneRegex).optional(),
    tempToken: Joi.string().optional(),
    token: Joi.string().optional(),
    accessToken: Joi.string().optional(),
    otp: Joi.string().optional()
  }).or('mpin', 'newMpin').unknown(true)
};

export const loginMpinSchema = {
  body: Joi.object({
    phoneNumber: Joi.string().pattern(phoneRegex).required(),
    mpin: Joi.string().pattern(mpinRegex).required().messages({
      'string.pattern.base': 'MPIN must be a 4-digit security code'
    })
  }).unknown(true)
};

export const resendOtpSchema = verifyMobileSchema;
export const forgotMpinSchema = verifyMobileSchema;
export const verifyResetOtpSchema = verifyOtpSchema;
export const resetMpinSchema = registerMpinSchema;

export const refreshSessionSchema = {
  body: Joi.object({
    refreshToken: Joi.string().required().messages({
      'any.required': 'Refresh token is required to refresh session'
    })
  }).unknown(true)
};
