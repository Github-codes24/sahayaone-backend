import Joi from 'joi';
import { BannerPortalType } from '../../../../models/banner.model.js';

const validPortalTypes = Object.values(BannerPortalType);

export const createBannerSchema = {
  body: Joi.object({
    portalType: Joi.string()
      .trim()
      .uppercase()
      .valid(...validPortalTypes)
      .required()
      .messages({
        'any.required': 'Portal Type is required',
        'string.empty': 'Portal Type cannot be empty',
        'any.only': `Portal Type must be one of: ${validPortalTypes.join(', ')}`
      }),
    bannerType: Joi.string().trim().required().messages({
      'any.required': 'Banner Type is required',
      'string.empty': 'Banner Type cannot be empty'
    })
  })
};

export const updateBannerSchema = {
  body: Joi.object({
    portalType: Joi.string()
      .trim()
      .uppercase()
      .valid(...validPortalTypes)
      .optional()
      .messages({
        'any.only': `Portal Type must be one of: ${validPortalTypes.join(', ')}`
      }),
    bannerType: Joi.string().trim().optional(),
    status: Joi.string().valid('ACTIVE', 'INACTIVE').optional().messages({
      'any.only': 'Status must be ACTIVE or INACTIVE'
    })
  })
};
