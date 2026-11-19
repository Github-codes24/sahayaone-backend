import Joi from 'joi';

export const merchantLoginSchema = {
  body: Joi.object({
    phoneNumber: Joi.string()
      .pattern(/^[6-9]\d{9}$/)
      .messages({
        'string.pattern.base': 'Please enter a valid 10-digit mobile number'
      }),
    email: Joi.string()
      .email()
      .trim()
      .lowercase()
      .messages({
        'string.email': 'Please enter a valid email address'
      }),
    loginId: Joi.string()
      .trim()
      .messages({
        'string.empty': 'Mobile number or email is required'
      }),
    password: Joi.string()
      .required()
      .messages({
        'any.required': 'Password is required',
        'string.empty': 'Password cannot be empty'
      }),
    merchantId: Joi.string().trim().optional(),
    storeId: Joi.string().trim().optional(),
    bankId: Joi.string().trim().optional()
  }).or('phoneNumber', 'email', 'loginId')
};

export const merchantSwitchStoreSchema = {
  body: Joi.object({
    merchantId: Joi.string().trim().optional(),
    storeId: Joi.string().trim().optional()
  }).or('merchantId', 'storeId')
};

export const merchantForgotPasswordSchema = {
  body: Joi.object({
    phoneNumber: Joi.string()
      .pattern(/^[6-9]\d{9}$/)
      .required()
      .messages({
        'any.required': 'Mobile number is required',
        'string.pattern.base': 'Please enter a valid 10-digit mobile number'
      })
  })
};

export const merchantVerifyOtpSchema = {
  body: Joi.object({
    phoneNumber: Joi.string()
      .pattern(/^[6-9]\d{9}$/)
      .required()
      .messages({
        'any.required': 'Mobile number is required',
        'string.pattern.base': 'Please enter a valid 10-digit mobile number'
      }),
    otp: Joi.string()
      .length(6)
      .pattern(/^\d{6}$/)
      .required()
      .messages({
        'any.required': '6-digit OTP is required',
        'string.length': 'OTP must be exactly 6 digits',
        'string.pattern.base': 'OTP must contain only numbers'
      })
  })
};

export const merchantResetPasswordSchema = {
  body: Joi.object({
    phoneNumber: Joi.string()
      .pattern(/^[6-9]\d{9}$/)
      .required()
      .messages({
        'any.required': 'Mobile number is required',
        'string.pattern.base': 'Please enter a valid 10-digit mobile number'
      }),
    resetToken: Joi.string()
      .required()
      .messages({
        'any.required': 'Reset token is required. Please verify OTP first.',
        'string.empty': 'Reset token cannot be empty'
      }),
    password: Joi.string()
      .min(6)
      .required()
      .messages({
        'any.required': 'New password is required',
        'string.min': 'Password must be at least 6 characters long'
      }),
    confirmPassword: Joi.string()
      .valid(Joi.ref('password'))
      .required()
      .messages({
        'any.required': 'Confirm password is required',
        'any.only': 'Confirm password must match the new password'
      })
  })
};

export const merchantChangePasswordSchema = {
  body: Joi.object({
    currentPassword: Joi.string()
      .required()
      .messages({
        'any.required': 'Current password is required'
      }),
    newPassword: Joi.string()
      .min(6)
      .required()
      .messages({
        'any.required': 'New password is required',
        'string.min': 'New password must be at least 6 characters long'
      }),
    confirmPassword: Joi.string()
      .valid(Joi.ref('newPassword'))
      .required()
      .messages({
        'any.required': 'Confirm password is required',
        'any.only': 'Confirm password must match the new password'
      })
  })
};

export const merchantRefreshTokenSchema = {
  body: Joi.object({
    refreshToken: Joi.string().optional()
  })
};
