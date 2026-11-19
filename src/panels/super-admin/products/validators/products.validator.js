import Joi from 'joi';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createProductSchema = {
  body: Joi.object({
    name: Joi.string().trim().required().messages({
      'any.required': 'Product Name is required',
      'string.empty': 'Product Name cannot be empty'
    }),
    brandId: Joi.string().regex(objectIdRegex).required().messages({
      'any.required': 'Brand ID is required',
      'string.pattern.base': 'Invalid Brand ID format'
    }),
    category: Joi.string().trim().required().messages({
      'any.required': 'Category is required',
      'string.empty': 'Category cannot be empty'
    })
  })
};

export const updateProductSchema = {
  body: Joi.object({
    name: Joi.string().trim().optional(),
    brandId: Joi.string().regex(objectIdRegex).optional().messages({
      'string.pattern.base': 'Invalid Brand ID format'
    }),
    category: Joi.string().trim().optional()
  })
};
