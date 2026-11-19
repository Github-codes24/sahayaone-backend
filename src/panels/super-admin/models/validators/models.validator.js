import Joi from 'joi';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createModelSchema = {
  body: Joi.object({
    name: Joi.string().trim().required().messages({
      'any.required': 'Model Name is required',
      'string.empty': 'Model Name cannot be empty'
    }),
    description: Joi.string().trim().allow('').optional(),
    productId: Joi.string().regex(objectIdRegex).required().messages({
      'any.required': 'Product ID is required',
      'string.pattern.base': 'Invalid Product ID format'
    }),
    color: Joi.string().trim().optional(),
    storage: Joi.string().trim().optional(),
    warranty: Joi.string().trim().optional()
  })
};

export const updateModelSchema = {
  body: Joi.object({
    name: Joi.string().trim().optional(),
    description: Joi.string().trim().allow('').optional(),
    productId: Joi.string().regex(objectIdRegex).optional().messages({
      'string.pattern.base': 'Invalid Product ID format'
    }),
    color: Joi.string().trim().optional(),
    storage: Joi.string().trim().optional(),
    warranty: Joi.string().trim().optional()
  })
};
