import Joi from 'joi';

export const createSubAdminSchema = {
  body: Joi.object({
    name: Joi.string().trim().required().messages({
      'any.required': 'Sub-Admin name is required',
      'string.empty': 'Sub-Admin name cannot be empty'
    }),
    email: Joi.string().email().lowercase().trim().required().messages({
      'any.required': 'Email is required',
      'string.email': 'Please provide a valid email address'
    }),
    phoneNumber: Joi.string().trim().required().messages({
      'any.required': 'Phone number is required'
    }),
    password: Joi.string().min(6).required().messages({
      'any.required': 'Password is required',
      'string.min': 'Password must be at least 6 characters long'
    }),
    permissions: Joi.array().items(Joi.string()).required().messages({
      'any.required': 'Permissions array is required'
    })
  })
};

export const updateSubAdminSchema = {
  body: Joi.object({
    name: Joi.string().trim().optional(),
    email: Joi.string().email().lowercase().trim().optional(),
    phoneNumber: Joi.string().trim().optional(),
    password: Joi.string().min(6).optional(),
    permissions: Joi.array().items(Joi.string()).optional(),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'BLOCKED').optional().messages({
      'any.only': 'Status must be ACTIVE, INACTIVE, or BLOCKED'
    })
  })
};
