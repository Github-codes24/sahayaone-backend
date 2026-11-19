import Joi from 'joi';

const otpRegex = /^\d{6}$/;

const loginIdSchema = Joi.string()
  .required()
  .trim()
  .lowercase()
  .custom((value, helpers) => {
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    const isPhone = /^[6-9]\d{9}$/.test(value);
    
    if (!isEmail && !isPhone) {
      return helpers.message('Login identifier must be a valid Email address or 10-digit Mobile number.');
    }
    return value;
  });

export const loginRequestSchema = {
  body: Joi.object({
    loginId: loginIdSchema
  })
};

export const verifyLoginOtpSchema = {
  body: Joi.object({
    loginId: loginIdSchema,
    otp: Joi.string().pattern(otpRegex).required().messages({
      'string.pattern.base': 'OTP must be a 6-digit numeric verification code.'
    })
  })
};

export const loginPasswordSchema = {
  body: Joi.object({
    loginId: loginIdSchema,
    password: Joi.string().min(6).required().messages({
      'string.min': 'Password must be at least 6 characters long.'
    })
  })
};

export const forgotPasswordSchema = {
  body: Joi.object({
    loginId: loginIdSchema
  })
};

export const verifyRecoveryOtpSchema = {
  body: Joi.object({
    loginId: loginIdSchema,
    otp: Joi.string().pattern(otpRegex).required().messages({
      'string.pattern.base': 'OTP must be a 6-digit numeric recovery code.'
    })
  })
};

export const resetPasswordSchema = {
  body: Joi.object({
    password: Joi.string().min(6).required().messages({
      'string.min': 'New password must contain at least 6 characters.'
    }),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
      'any.only': 'Confirm password must match the new password.'
    }),
    recoveryToken: Joi.string().required().messages({
      'any.required': 'Recovery session token is required.'
    })
  })
};

export const refreshSessionSchema = {
  body: Joi.object({
    refreshToken: Joi.string().required().messages({
      'any.required': 'Refresh token is required to refresh session'
    })
  })
};

