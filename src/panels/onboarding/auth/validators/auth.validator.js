import Joi from 'joi';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^(\+91|91|0)?[6-9]\d{9}$/;
const otpRegex = /^\d{6}$/;

const loginIdSchema = Joi.string().trim().required().custom((value, helpers) => {
  const isEmail = emailRegex.test(value);
  const isPhone = phoneRegex.test(value.replace(/[\s-]/g, ''));
  
  if (!isEmail && !isPhone) {
    return helpers.message('Login identifier must be a valid email or phone number.');
  }
  return value.trim();
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
      'string.pattern.base': 'OTP code must be a 6-digit numeric verification code.'
    })
  })
};

export const loginPasswordSchema = {
  body: Joi.object({
    loginId: loginIdSchema,
    password: Joi.string().min(6).required().messages({
      'string.min': 'Password must contain at least 6 characters.'
    })
  })
};

export const forgotPasswordSchema = {
  body: Joi.object({
    loginId: Joi.string().trim().pattern(emailRegex).required().messages({
      'string.pattern.base': 'Forgot password is only supported via registered email identifier.'
    })
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
