import Joi from 'joi';

export const attendanceReportQuerySchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    state: Joi.string().trim().allow('').default(''),
    branchId: Joi.string().hex().length(24).allow('').default(''),
    search: Joi.string().trim().allow('').default(''),
    period: Joi.string().uppercase().valid('DAILY', 'MONTHLY', 'YEARLY').default('DAILY'),
    date: Joi.date().iso().default(() => new Date())
  })
};

export const attendanceFilterQuerySchema = {
  query: Joi.object({
    state: Joi.string().trim().allow('').default('')
  })
};
