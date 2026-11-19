import Joi from 'joi';

export const createCategorySchema = {
  body: Joi.object({
    name: Joi.string().trim().required().messages({
      'any.required': 'Category Name is required',
      'string.empty': 'Category Name cannot be empty'
    })
  })
};

export const updateCategorySchema = {
  body: Joi.object({
    name: Joi.string().trim().optional()
  })
};
