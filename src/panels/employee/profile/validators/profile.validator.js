import Joi from 'joi';

export const changePasswordSchema = {
  body: Joi.object({
    oldPassword: Joi.string().required().messages({
      'any.required': 'Old password is required.'
    }),
    newPassword: Joi.string().min(6).required().messages({
      'string.min': 'New password must contain at least 6 characters.'
    }),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
      'any.only': 'Confirm password must match the new password.'
    })
  })
};

export const updateLocationSchema = {
  body: Joi.object({
    latitude: Joi.number().min(-90).max(90).required().messages({
      'number.base': 'Latitude must be a valid number.',
      'number.min': 'Latitude must be between -90 and 90.',
      'number.max': 'Latitude must be between -90 and 90.',
      'any.required': 'Latitude is required.'
    }),
    longitude: Joi.number().min(-180).max(180).required().messages({
      'number.base': 'Longitude must be a valid number.',
      'number.min': 'Longitude must be between -180 and 180.',
      'number.max': 'Longitude must be between -180 and 180.',
      'any.required': 'Longitude is required.'
    }),
    address: Joi.string().trim().max(500).allow('', null).optional()
  }).unknown(true)
};
