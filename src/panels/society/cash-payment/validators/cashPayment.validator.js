import Joi from "joi";

export const listCashPaymentsSchema = {
  query: Joi.object({
    page: Joi.number().default(1),
    limit: Joi.number().default(10),
    search: Joi.string().allow(""),
    branchId: Joi.string().hex().length(24).optional().allow(""),
    branchIds: Joi.alternatives().try(
      Joi.array().items(Joi.string().hex().length(24)),
      Joi.string()
    ).optional(),
    startDate: Joi.date().iso().optional().allow(""),
    endDate: Joi.date().iso().optional().allow(""),
    fromDate: Joi.date().iso().optional().allow(""),
    toDate: Joi.date().iso().optional().allow(""),
    dateFrom: Joi.date().iso().optional().allow(""),
    dateTo: Joi.date().iso().optional().allow(""),
    city: Joi.string().allow(""),
    state: Joi.string().allow("")
  })
};


export const getCashPaymentDetailsSchema = {
  params: Joi.object({
    id: Joi.string().required(),
  }),

  query: Joi.object({
    page: Joi.number().default(1),
    limit: Joi.number().default(10),
    fromDate: Joi.string().allow(""),
    toDate: Joi.string().allow(""),
  }),
};

export const submitCashSchema = {
  params: Joi.object({
    id: Joi.string().required(),
  }),

  body: Joi.object({
    date: Joi.date().required(),
    amountSubmitted: Joi.number().required(),
    remarks: Joi.string().allow(""),
  }),
};
