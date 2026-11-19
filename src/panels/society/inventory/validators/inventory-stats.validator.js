import Joi from 'joi';

const mongoId = Joi.string().hex().length(24);

export const centralStatsQuerySchema = {
  query: Joi.object({
    centralInventoryId: mongoId.optional(),
    period: Joi.string().valid('7d', '30d', '90d', 'all').default('30d')
  })
};

export const branchStatsQuerySchema = {
  query: Joi.object({
    branchId: mongoId.optional(),
    period: Joi.string().valid('7d', '30d', '90d', 'all').default('30d')
  })
};

export const overallStatsQuerySchema = {
  query: Joi.object({
    period: Joi.string().valid('7d', '30d', '90d', 'all').default('30d')
  })
};
