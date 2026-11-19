import Joi from 'joi';

export const purchaseSchema = Joi.object({
  purchaseType: Joi.string()
    .valid('EMI_CARD', 'VERIFICATION_CREDIT', 'BOTH')
    .required()
    .messages({
      'any.only': 'Purchase type must be EMI_CARD, VERIFICATION_CREDIT, or BOTH.',
      'any.required': 'Purchase type is required.'
    }),
  emiQuantity: Joi.number()
    .integer()
    .min(0)
    .default(0)
    .messages({
      'number.base': 'EMI card quantity must be a number.',
      'number.min': 'EMI card quantity cannot be negative.'
    }),
  verificationQuantity: Joi.number()
    .integer()
    .min(0)
    .default(0)
    .messages({
      'number.base': 'Verification credit quantity must be a number.',
      'number.min': 'Verification credit quantity cannot be negative.'
    })
}).custom((value, helpers) => {
  const emiQty = value.emiQuantity || 0;
  const verQty = value.verificationQuantity || 0;

  if (value.purchaseType === 'EMI_CARD' && emiQty <= 0) {
    return helpers.message({ custom: 'EMI Card quantity must be greater than 0 for EMI_CARD purchase.' });
  }
  if (value.purchaseType === 'VERIFICATION_CREDIT' && verQty <= 0) {
    return helpers.message({ custom: 'Verification Credit quantity must be greater than 0 for VERIFICATION_CREDIT purchase.' });
  }
  if (value.purchaseType === 'BOTH' && (emiQty <= 0 || verQty <= 0)) {
    return helpers.message({ custom: 'Both EMI Card and Verification Credit quantities must be greater than 0 for BOTH purchase.' });
  }
  return value;
});

export const transferSchema = Joi.object({
  branchId: Joi.string()
    .required()
    .regex(/^[0-9a-fA-F]{24}$/)
    .messages({
      'string.pattern.base': 'Branch ID must be a valid 24-character hex ObjectId string.',
      'any.required': 'Branch ID is required.'
    }),
  emiQuantity: Joi.number()
    .integer()
    .min(0)
    .default(0),
  verificationQuantity: Joi.number()
    .integer()
    .min(0)
    .default(0),
  remarks: Joi.string()
    .allow('')
    .max(500)
    .default('')
}).custom((value, helpers) => {
  const emiQty = value.emiQuantity || 0;
  const verQty = value.verificationQuantity || 0;

  if (emiQty <= 0 && verQty <= 0) {
    return helpers.message({ custom: 'Transfer quantity for EMI cards or Verification credits must be greater than 0.' });
  }
  return value;
});

export const consumeSchema = Joi.object({
  branchId: Joi.string()
    .required()
    .regex(/^[0-9a-fA-F]{24}$/)
    .messages({
      'string.pattern.base': 'Branch ID must be a valid 24-character hex ObjectId string.',
      'any.required': 'Branch ID is required.'
    }),
  type: Joi.string()
    .valid('EMI_CARD', 'VERIFICATION_CREDIT')
    .required()
    .messages({
      'any.only': 'Consumption type must be EMI_CARD or VERIFICATION_CREDIT.',
      'any.required': 'Consumption type is required.'
    }),
  quantity: Joi.number()
    .integer()
    .min(1)
    .default(1),
  loanId: Joi.string()
    .optional()
    .allow(null)
    .regex(/^[0-9a-fA-F]{24}$/),
  verificationId: Joi.string()
    .optional()
    .allow(null)
    .regex(/^[0-9a-fA-F]{24}$/)
});

export const cardsCreditQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().allow('').trim().default(''),
  sortBy: Joi.string().default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc', 'ASC', 'DESC').default('desc'),
  startDate: Joi.alternatives().try(Joi.date(), Joi.string().allow('')).optional(),
  endDate: Joi.alternatives().try(Joi.date(), Joi.string().allow('')).optional(),
  status: Joi.string().optional().allow(''),
  type: Joi.string().optional().allow(''),
  branchId: Joi.string().optional().allow(''),
  bankId: Joi.string().optional().allow('')
});

export const updateMerchantCreditRequestStatusSchema = Joi.object({
  status: Joi.string()
    .valid('APPROVED', 'REJECTED')
    .required()
    .messages({
      'any.only': 'Status must be APPROVED or REJECTED.',
      'any.required': 'Status is required.'
    }),
  approvedQuantity: Joi.number()
    .integer()
    .min(1)
    .optional(),
  responseRemarks: Joi.string()
    .allow('', null)
    .max(500)
    .optional()
});
