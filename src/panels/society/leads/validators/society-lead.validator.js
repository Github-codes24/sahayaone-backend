import Joi from 'joi';

export const leadListSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().allow('').default(''),
    status: Joi.string().uppercase().valid('NEW', 'PENDING_DOWN_PAYMENT', 'ACTIVE', 'COMPLETED', 'REJECTED', 'ALL', 'ALL LEADS').optional().allow('', null),
    branchId: Joi.string().hex().length(24).optional().allow('', null),
    branchIds: Joi.alternatives().try(
      Joi.array().items(Joi.string().hex().length(24)),
      Joi.string().trim()
    ).optional(),
    sourceType: Joi.string().uppercase().valid('EXECUTIVE', 'MERCHANT', 'SOCIETY', 'DIRECT', 'SUPER_ADMIN', 'ALL').optional().allow('', null),
    city: Joi.string().trim().optional().allow('', null),
    state: Joi.string().trim().optional().allow('', null),
    dateFrom: Joi.date().iso().optional().allow('', null),
    dateTo: Joi.date().iso().optional().allow('', null)
  })
};

export const leadIdSchema = {
  params: Joi.object({
    id: Joi.string().hex().length(24).required()
  })
};
