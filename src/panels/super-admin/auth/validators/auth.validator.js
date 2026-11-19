import Joi from 'joi';

const otpRegex = /^\d{6}$/;

export const loginSchema = {
  body: Joi.object({
    email: Joi.string().email().lowercase().trim().required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('ADMIN', 'SUPER_ADMIN', 'SUB_ADMIN', 'SUB ADMIN').insensitive().required().messages({
      'any.only': 'Role must be either Admin or Sub Admin',
      'any.required': 'Role selection is required'
    })
  })
};

export const forgotPasswordSchema = {
  body: Joi.object({
    email: Joi.string().email().lowercase().trim().required()
  })
};

export const verifyOtpSchema = {
  body: Joi.object({
    email: Joi.string().email().lowercase().trim().required(),
    otp: Joi.string().pattern(otpRegex).required().messages({
      'string.pattern.base': 'Verification code must be a 6-digit numeric OTP'
    })
  })
};

export const resetPasswordSchema = {
  body: Joi.object({
    email: Joi.string().email().lowercase().trim().required(),
    password: Joi.string().min(6).required(),
    confirmPassword: Joi.string().required().valid(Joi.ref('password')).messages({
      'any.only': 'Confirm password must match password'
    })
  })
};

export const refreshSessionSchema = {
  body: Joi.object({
    refreshToken: Joi.string().trim().optional(),
    token: Joi.string().trim().optional()
  })
};
