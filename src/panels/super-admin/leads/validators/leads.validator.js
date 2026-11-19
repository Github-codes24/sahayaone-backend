import Joi from 'joi';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const listLeadsSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().allow('').optional(),
    status: Joi.alternatives().try(
      Joi.string().trim(),
      Joi.array().items(Joi.string().trim())
    ).optional(),
    state: Joi.alternatives().try(
      Joi.string().trim(),
      Joi.array().items(Joi.string().trim())
    ).optional(),
    branchId: Joi.alternatives().try(
      Joi.string().trim(),
      Joi.array().items(Joi.string().trim())
    ).optional(),
    branch: Joi.alternatives().try(
      Joi.string().trim(),
      Joi.array().items(Joi.string().trim())
    ).optional(),
    fromDate: Joi.string().trim().allow('').optional(),
    toDate: Joi.string().trim().allow('').optional(),
    sortBy: Joi.string().trim().optional(),
    sortOrder: Joi.string().trim().valid('asc', 'desc', 'ASC', 'DESC').optional()
  })
};

export const getLeadSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      'any.required': 'Lead ID is required',
      'string.pattern.base': 'Invalid Lead ID format'
    })
  })
};

export const assignLeadSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      'any.required': 'Lead ID is required',
      'string.pattern.base': 'Invalid Lead ID format'
    })
  }),
  body: Joi.object({
    employeeId: Joi.string().regex(objectIdRegex).required().messages({
      'any.required': 'Employee ID is required for assignment',
      'string.pattern.base': 'Invalid Employee ID format'
    })
  })
};

export const assignBankSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      'any.required': 'Lead ID is required',
      'string.pattern.base': 'Invalid Lead ID format'
    })
  }),
  body: Joi.object({
    bankId: Joi.string().regex(objectIdRegex).required().messages({
      'any.required': 'Cooperative Bank ID is required for assignment',
      'string.pattern.base': 'Invalid Bank ID format'
    })
  })
};
