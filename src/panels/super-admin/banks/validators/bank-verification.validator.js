import Joi from 'joi';

export const verifyBankSchema = Joi.object({
  status: Joi.string().valid('APPROVED', 'REJECTED').required(),
  remarks: Joi.string().trim().when('status', {
    is: 'REJECTED',
    then: Joi.required().messages({
      'any.required': 'Remarks are mandatory when rejecting a bank application.',
      'string.empty': 'Remarks cannot be empty when rejecting a bank application.'
    }),
    otherwise: Joi.optional().allow('', null)
  }),
  rejectionRemarks: Joi.string().trim().optional().allow('', null),
  rejectionReason: Joi.string().trim().optional().allow('', null)
});

export const allotCreditsSchema = Joi.object({
  cardQuantity: Joi.number().integer().min(0).optional().default(0),
  verificationCredit: Joi.number().integer().min(0).optional().default(0)
});
