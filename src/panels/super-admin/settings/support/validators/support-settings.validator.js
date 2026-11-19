import Joi from 'joi';

const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

export const updateSupportSettingSchema = {
  body: Joi.object({
    customerSupportNumber: Joi.string().trim().optional(),
    customerSupportNumberTimeFrom: Joi.string().regex(timeRegex).optional().messages({
      'string.pattern.base': 'customerSupportNumberTimeFrom must be in HH:mm format (e.g. 10:00)'
    }),
    customerSupportNumberTimeTo: Joi.string().regex(timeRegex).optional().messages({
      'string.pattern.base': 'customerSupportNumberTimeTo must be in HH:mm format (e.g. 20:00)'
    }),
    bankSupportNumber: Joi.string().trim().optional(),
    bankSupportNumberTimeFrom: Joi.string().regex(timeRegex).optional().messages({
      'string.pattern.base': 'bankSupportNumberTimeFrom must be in HH:mm format (e.g. 10:00)'
    }),
    bankSupportNumberTimeTo: Joi.string().regex(timeRegex).optional().messages({
      'string.pattern.base': 'bankSupportNumberTimeTo must be in HH:mm format (e.g. 20:00)'
    }),
    customerSupportEmail: Joi.string().email().trim().optional().messages({
      'string.email': 'customerSupportEmail must be a valid email address'
    }),
    customerSupportEmailTimeFrom: Joi.string().regex(timeRegex).optional().messages({
      'string.pattern.base': 'customerSupportEmailTimeFrom must be in HH:mm format (e.g. 10:00)'
    }),
    customerSupportEmailTimeTo: Joi.string().regex(timeRegex).optional().messages({
      'string.pattern.base': 'customerSupportEmailTimeTo must be in HH:mm format (e.g. 20:00)'
    }),
    bankSupportEmail: Joi.string().email().trim().optional().messages({
      'string.email': 'bankSupportEmail must be a valid email address'
    }),
    bankSupportEmailTimeFrom: Joi.string().regex(timeRegex).optional().messages({
      'string.pattern.base': 'bankSupportEmailTimeFrom must be in HH:mm format (e.g. 10:00)'
    }),
    bankSupportEmailTimeTo: Joi.string().regex(timeRegex).optional().messages({
      'string.pattern.base': 'bankSupportEmailTimeTo must be in HH:mm format (e.g. 20:00)'
    })
  })
};
