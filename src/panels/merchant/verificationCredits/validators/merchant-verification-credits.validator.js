import Joi from 'joi';

export const requestCreditsSchema = {
  body: Joi.object({
    creditQuantity: Joi.number().integer().min(1).required().messages({
      'number.base': 'creditQuantity must be a number',
      'number.min': 'creditQuantity must be at least 1',
      'any.required': 'creditQuantity is required'
    }),
    notes: Joi.string().trim().max(1000).allow('').optional()
  })
};

export const listRequestsSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    status: Joi.string().trim().uppercase().valid('PENDING', 'APPROVED', 'REJECTED', 'ALL').optional(),
    search: Joi.string().trim().allow('').optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional()
  })
};
