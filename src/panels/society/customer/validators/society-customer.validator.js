import Joi from 'joi';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const stringOrArray = Joi.alternatives().try(
  Joi.string().trim(),
  Joi.array().items(Joi.string().trim())
);

export const listCustomersSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().allow('', null),
    type: Joi.string().valid('CUSTOMER', 'MERCHANT', 'ALL', 'customer', 'merchant', 'all').default('ALL'),
    status: Joi.string().trim().allow('', null),
    
    // Product & Pigmy / Loans filters
    product: Joi.string().valid('PIGMY', 'LOAN', 'BOTH', 'NONE', 'ALL', 'pigmy', 'loan', 'both', 'none', 'all').optional().allow('', null),
    hasPigmy: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false', '1', '0')).optional().allow('', null),
    hasLoans: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false', '1', '0')).optional().allow('', null),
    pigmyStatus: Joi.string().trim().optional().allow('', null),
    loanStatus: Joi.string().trim().optional().allow('', null),

    branchId: Joi.string().pattern(objectIdRegex).allow('', null),
    branchIds: stringOrArray.optional(),
    dateFrom: Joi.date().iso().optional().allow('', null),
    dateTo: Joi.date().iso().optional().allow('', null),
    startDate: Joi.date().iso().optional().allow('', null),
    endDate: Joi.date().iso().optional().allow('', null),
    isDeleted: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false', 'all', 'ALL')).optional(),
    sortBy: Joi.string().trim().default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc', 'ASC', 'DESC').default('desc')
  })
};

export const getCustomerSchema = {
  params: Joi.object({
    id: Joi.string().pattern(objectIdRegex).required().messages({
      'string.pattern.base': 'Invalid Member ID format.',
      'any.required': 'Member ID is required.'
    })
  }),
  query: Joi.object({
    type: Joi.string().valid('CUSTOMER', 'MERCHANT', 'customer', 'merchant').optional()
  })
};
