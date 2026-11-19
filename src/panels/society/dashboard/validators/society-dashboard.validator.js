import Joi from 'joi';

const stringOrArray = Joi.alternatives().try(
  Joi.array().items(Joi.string().trim()),
  Joi.string().trim().custom((value, helpers) => {
    if (!value) return [];
    return value.split(',').map(s => s.trim());
  })
);

export const getDashboardStatsSchema = {
  query: Joi.object({
    timeFilter: Joi.string().trim().optional().allow(''),
    branchId: Joi.string().hex().length(24).optional().allow('', null),
    branchIds: stringOrArray.optional(),
    dateFrom: Joi.date().iso().optional().allow('', null),
    dateTo: Joi.date().iso().optional().allow('', null),
    year: Joi.number().integer().min(2000).max(2100).optional(),
    month: Joi.number().integer().min(1).max(12).optional()
  })
};

export const getRevenueChartSchema = {
  query: Joi.object({
    year: Joi.number().integer().min(2000).max(2100).optional(),
    timeFilter: Joi.string().trim().optional().allow(''),
    branchId: Joi.string().hex().length(24).optional().allow('', null),
    branchIds: stringOrArray.optional(),
    dateFrom: Joi.date().iso().optional().allow('', null),
    dateTo: Joi.date().iso().optional().allow('', null)
  })
};

export const getLoanDistributedChartSchema = {
  query: Joi.object({
    timeFilter: Joi.string().trim().optional().allow(''),
    branchId: Joi.string().hex().length(24).optional().allow('', null),
    branchIds: stringOrArray.optional(),
    dateFrom: Joi.date().iso().optional().allow('', null),
    dateTo: Joi.date().iso().optional().allow('', null)
  })
};

export const getServicesStatsSchema = {
  query: Joi.object({
    timeFilter: Joi.string().trim().optional().allow(''),
    branchId: Joi.string().hex().length(24).optional().allow('', null),
    branchIds: stringOrArray.optional(),
    dateFrom: Joi.date().iso().optional().allow('', null),
    dateTo: Joi.date().iso().optional().allow('', null)
  })
};
