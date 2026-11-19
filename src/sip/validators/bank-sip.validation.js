import Joi from "joi";

export const createBankSIPSchema = Joi.object({
  customerId: Joi.string()
    .hex()
    .length(24)
    .required()
    .messages({
      "string.length": "Invalid customer ID format",
      "any.required": "Customer ID is required",
    }),

  accountId: Joi.string()
    .hex()
    .length(24)
    .required()
    .messages({
      "string.length": "Invalid account ID format",
      "any.required": "Account ID is required",
    }),

  schemeId: Joi.string()
    .hex()
    .length(24)
    .required()
    .messages({
      "string.length": "Invalid scheme ID format",
      "any.required": "Scheme ID is required",
    }),

  branchId: Joi.string()
    .hex()
    .length(24)
    .optional()
    .allow(null, "")
    .messages({
      "string.length": "Invalid branch ID format",
    }),

  frequency: Joi.string()
    .valid("DAILY")
    .default("DAILY")
    .optional(),

  durationMonths: Joi.number()
    .valid(1, 3, 6, 12)
    .required()
    .messages({
      "any.only": "Duration must be 1, 3, 6, or 12 months",
      "any.required": "Duration in months is required",
    }),

  amount: Joi.number()
    .integer()
    .min(100)
    .required()
    .messages({
      "number.min": "SIP amount must be at least 100",
      "any.required": "SIP amount is required",
    }),
});

export const createSIPSchema = createBankSIPSchema;
