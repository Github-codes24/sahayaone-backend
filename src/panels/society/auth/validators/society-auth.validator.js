import Joi from 'joi';

export const societyLoginSchema = {
  body: Joi.object({
    role: Joi.string()
      .trim()
      .optional()
      .allow('', null),
    email: Joi.string()
      .email({ tlds: { allow: false } })
      .trim()
      .lowercase()
      .required()
      .messages({
        'string.email': 'Please provide a valid email address.',
        'string.empty': 'Email is required.',
        'any.required': 'Email is required.'
      }),
    password: Joi.string()
      .required()
      .messages({
        'string.empty': 'Password is required.',
        'any.required': 'Password is required.'
      })
  })
};

export const refreshSessionSchema = {
  body: Joi.object({
    refreshToken: Joi.string().optional()
  })
};

export const forgotPasswordSchema = {
  body: Joi.object({
    email: Joi.string()
      .email({ tlds: { allow: false } })
      .trim()
      .lowercase()
      .required()
      .messages({
        'string.email': 'Please enter a valid email address.',
        'string.empty': 'Email is required.',
        'any.required': 'Email is required.'
      })
  })
};

export const verifyOtpSchema = {
  body: Joi.object({
    email: Joi.string()
      .email({ tlds: { allow: false } })
      .trim()
      .lowercase()
      .required()
      .messages({
        'string.email': 'Please enter a valid email address.',
        'any.required': 'Email is required.'
      }),
    otp: Joi.string()
      .length(6)
      .pattern(/^\d{6}$/)
      .required()
      .messages({
        'any.required': '6-digit OTP is required.',
        'string.length': 'OTP must be exactly 6 digits.',
        'string.pattern.base': 'OTP must contain only numbers.'
      })
  })
};

export const resetPasswordSchema = {
  body: Joi.object({
    email: Joi.string()
      .email({ tlds: { allow: false } })
      .trim()
      .lowercase()
      .required()
      .messages({
        'string.email': 'Please enter a valid email address.',
        'any.required': 'Email is required.'
      }),
    resetToken: Joi.string()
      .required()
      .messages({
        'any.required': 'Reset token is required. Please verify OTP first.'
      }),
    password: Joi.string()
      .min(6)
      .required()
      .messages({
        'any.required': 'New password is required.',
        'string.min': 'Password must be at least 6 characters long.'
      }),
    confirmPassword: Joi.string()
      .valid(Joi.ref('password'))
      .required()
      .messages({
        'any.required': 'Confirm password is required.',
        'any.only': 'Confirm password must match the new password.'
      })
  })
};
