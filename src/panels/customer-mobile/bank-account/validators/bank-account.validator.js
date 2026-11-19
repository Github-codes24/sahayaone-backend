import Joi from 'joi';

export const createBankAccountSchema = {
  body: Joi.object({
    bankName: Joi.string().required().trim().messages({
      'any.required': 'Bank name is required.'
    }),
    accountNumber: Joi.string().min(9).max(18).regex(/^\d+$/).required().trim().messages({
      'any.required': 'Account number is required.',
      'string.pattern.base': 'Account number must contain digits only.',
      'string.min': 'Account number must be at least 9 digits long.',
      'string.max': 'Account number cannot exceed 18 digits.'
    }),
    ifsc: Joi.string().uppercase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/).required().trim().messages({
      'any.required': 'IFSC code is required.',
      'string.pattern.base': 'Invalid IFSC code format (e.g. SBIN0001234).'
    }),
    accountHolder: Joi.string().required().trim().messages({
      'any.required': 'Account holder name is required.'
    })
  })
};

export const updateBankAccountSchema = {
  body: Joi.object({
    bankName: Joi.string().optional().trim(),
    accountNumber: Joi.string().min(9).max(18).regex(/^\d+$/).optional().trim().messages({
      'string.pattern.base': 'Account number must contain digits only.'
    }),
    ifsc: Joi.string().uppercase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/).optional().trim().messages({
      'string.pattern.base': 'Invalid IFSC code format (e.g. SBIN0001234).'
    }),
    accountHolder: Joi.string().optional().trim()
  })
};
