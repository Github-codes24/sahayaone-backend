import Joi from 'joi';

export const requestOtpSchema = {
  body: Joi.object({
    accountType: Joi.string()
      .trim()
      .uppercase()
      .valid('CUSTOMER', 'LOAN_EXECUTIVE', 'BANK_ONBOARDING', 'ONBOARDING')
      .required()
      .messages({
        'any.required': 'Account type is required.',
        'any.only': 'Account type must be CUSTOMER, LOAN_EXECUTIVE, or BANK_ONBOARDING.'
      }),
    phoneNumber: Joi.string()
      .trim()
      .pattern(/^[0-9]{10}$/)
      .required()
      .messages({
        'any.required': 'Registered Phone Number is required.',
        'string.pattern.base': 'Registered Phone Number must be a valid 10-digit number.'
      })
  })
};

export const verifyAndDeleteSchema = {
  body: Joi.object({
    accountType: Joi.string()
      .trim()
      .uppercase()
      .valid('CUSTOMER', 'LOAN_EXECUTIVE', 'BANK_ONBOARDING', 'ONBOARDING')
      .required()
      .messages({
        'any.required': 'Account type is required.',
        'any.only': 'Account type must be CUSTOMER, LOAN_EXECUTIVE, or BANK_ONBOARDING.'
      }),
    phoneNumber: Joi.string()
      .trim()
      .pattern(/^[0-9]{10}$/)
      .required()
      .messages({
        'any.required': 'Registered Phone Number is required.',
        'string.pattern.base': 'Registered Phone Number must be a valid 10-digit number.'
      }),
    otp: Joi.string()
      .trim()
      .required()
      .messages({
        'any.required': 'Verification OTP code is required.'
      })
  })
};
