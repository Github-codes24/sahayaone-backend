import Joi from 'joi';

export const getDashboardOverviewSchema = {
  query: Joi.object({
    timeFilter: Joi.string()
      .trim()
      .valid('Today', 'Weekly', 'Monthly', 'Yearly', 'TODAY', 'WEEKLY', 'MONTHLY', 'YEARLY')
      .default('Today')
      .optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional()
  })
};
