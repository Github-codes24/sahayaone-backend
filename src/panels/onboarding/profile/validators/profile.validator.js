import Joi from 'joi';

export const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
  confirmPassword: Joi.any().valid(Joi.ref('newPassword')).required()
    .messages({ 'any.only': 'Confirm password must match the new password.' })
});

export const updateLocationSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required()
    .messages({
      'number.base': 'Latitude must be a valid number.',
      'number.min': 'Latitude must be between -90 and 90.',
      'number.max': 'Latitude must be between -90 and 90.',
      'any.required': 'Latitude is required.'
    }),
  longitude: Joi.number().min(-180).max(180).required()
    .messages({
      'number.base': 'Longitude must be a valid number.',
      'number.min': 'Longitude must be between -180 and 180.',
      'number.max': 'Longitude must be between -180 and 180.',
      'any.required': 'Longitude is required.'
    }),
  address: Joi.string().trim().max(500).allow('', null).optional()
});

export const punchInSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required()
    .messages({
      'number.base': 'Latitude must be a valid number.',
      'any.required': 'Latitude location coordinate is required for punch-in.'
    }),
  longitude: Joi.number().min(-180).max(180).required()
    .messages({
      'number.base': 'Longitude must be a valid number.',
      'any.required': 'Longitude location coordinate is required for punch-in.'
    }),
  address: Joi.string().trim().max(500).allow('', null).optional()
});

export const punchOutSchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required()
    .messages({
      'number.base': 'Latitude must be a valid number.',
      'any.required': 'Latitude location coordinate is required for punch-out.'
    }),
  longitude: Joi.number().min(-180).max(180).required()
    .messages({
      'number.base': 'Longitude must be a valid number.',
      'any.required': 'Longitude location coordinate is required for punch-out.'
    }),
  address: Joi.string().trim().max(500).allow('', null).optional()
});

export const applyLeaveSchema = Joi.object({
  leaveType: Joi.string().valid('CASUAL_LEAVE', 'SICK_LEAVE', 'PAID_LEAVE', 'UNPAID_LEAVE', 'EMERGENCY_LEAVE').default('CASUAL_LEAVE'),
  startDate: Joi.string().isoDate().required()
    .messages({ 'any.required': 'Leave start date (ISO string) is required.' }),
  endDate: Joi.string().isoDate().required()
    .messages({ 'any.required': 'Leave end date (ISO string) is required.' }),
  reason: Joi.string().trim().max(500).allow('', null).optional()
});
