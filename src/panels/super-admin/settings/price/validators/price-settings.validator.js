import Joi from 'joi';

export const updatePriceSettingSchema = {
  body: Joi.object({
    emiCardPriceForBank: Joi.number().min(0).optional().messages({
      'number.min': 'EMI Card Price For Bank cannot be negative'
    }),
    emiCardPrice: Joi.number().min(0).optional(),
    EMI_CARD_CHARGES: Joi.number().min(0).optional(),
    EMI_CARD_PRICE: Joi.number().min(0).optional(),

    emiCardMinPurchaseQuantity: Joi.number().min(1).optional().messages({
      'number.min': 'EMI Card Minimum Purchase Quantity must be at least 1'
    }),
    minEmiCardLimit: Joi.number().min(1).optional(),
    minCardQuantity: Joi.number().min(1).optional(),
    MIN_EMI_CARD_LIMIT: Joi.number().min(1).optional(),

    verificationCreditPriceForBank: Joi.number().min(0).optional().messages({
      'number.min': 'Verification Credit Price For Bank cannot be negative'
    }),
    verificationCreditPrice: Joi.number().min(0).optional(),
    VERIFICATION_CREDIT_PRICE: Joi.number().min(0).optional(),

    verificationCreditMinPurchaseQuantity: Joi.number().min(1).optional().messages({
      'number.min': 'Verification Credit Minimum Purchase Quantity must be at least 1'
    }),
    minVerificationCreditLimit: Joi.number().min(1).optional(),
    minVerificationCredit: Joi.number().min(1).optional(),
    MIN_VERIFICATION_CREDIT_LIMIT: Joi.number().min(1).optional()
  })
};
