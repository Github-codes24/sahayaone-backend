import Joi from 'joi';

export const createBrandSchema = {
  body: Joi.object({
    name: Joi.string().trim().required().messages({
      'any.required': 'Brand Name is required',
      'string.empty': 'Brand Name cannot be empty'
    }),
    category: Joi.string().trim().optional()
  })
};

export const updateBrandSchema = {
  body: Joi.object({
    name: Joi.string().trim().optional(),
    category: Joi.string().trim().optional()
  })
};
