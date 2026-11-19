import Joi from 'joi';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const listCashPaymentsSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().allow('').optional(),
    designation: Joi.string().trim().optional(),
    sortBy: Joi.string().trim().optional(),
    sortOrder: Joi.string().trim().valid('asc', 'desc', 'ASC', 'DESC').optional()
  })
};

export const getCashPaymentDetailsSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      'any.required': 'Employee ID is required',
      'string.pattern.base': 'Invalid Employee ID format'
    })
  }),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    fromDate: Joi.string().trim().allow('').optional(),
    toDate: Joi.string().trim().allow('').optional()
  })
};

export const submitCashSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      'any.required': 'Employee ID is required',
      'string.pattern.base': 'Invalid Employee ID format'
    })
  }),
  body: Joi.object({
    date: Joi.string().trim().required().messages({
      'any.required': 'Date is required'
    }),
    amount: Joi.number().greater(0).optional(),
    amountSubmitted: Joi.number().greater(0).optional(),
    bankIds: Joi.array().items(Joi.string().regex(objectIdRegex)).optional(),
    paymentMode: Joi.string().valid('CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE').default('CASH'),
    receiptNumber: Joi.string().trim().allow('').optional(),
    receiptUrl: Joi.string().trim().allow('').optional(),
    remarks: Joi.string().trim().allow('').optional()
  }).or('amount', 'amountSubmitted')
};
