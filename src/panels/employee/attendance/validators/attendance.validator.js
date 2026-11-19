import Joi from 'joi';

const latSchema = Joi.alternatives().try(
  Joi.number().min(-90).max(90),
  Joi.string().trim().custom((val, helpers) => {
    const num = Number(val);
    if (isNaN(num) || num < -90 || num > 90) {
      return helpers.error('number.base');
    }
    return num;
  })
);

const lngSchema = Joi.alternatives().try(
  Joi.number().min(-180).max(180),
  Joi.string().trim().custom((val, helpers) => {
    const num = Number(val);
    if (isNaN(num) || num < -180 || num > 180) {
      return helpers.error('number.base');
    }
    return num;
  })
);

export const punchInSchema = {
  body: Joi.object({
    latitude: latSchema.optional(),
    latitute: latSchema.optional(),
    lat: latSchema.optional(),
    longitude: lngSchema.optional(),
    langitute: lngSchema.optional(),
    lng: lngSchema.optional(),
    address: Joi.string().trim().max(500).allow('', null).optional(),
    location: Joi.object().optional()
  }).unknown(true)
};

export const punchOutSchema = {
  body: Joi.object({
    latitude: latSchema.optional(),
    latitute: latSchema.optional(),
    lat: latSchema.optional(),
    longitude: lngSchema.optional(),
    langitute: lngSchema.optional(),
    lng: lngSchema.optional(),
    address: Joi.string().trim().max(500).allow('', null).optional(),
    location: Joi.object().optional()
  }).unknown(true)
};

export const leaveSchema = {
  body: Joi.object({
    leaveType: Joi.string()
      .valid('CASUAL_LEAVE', 'SICK_LEAVE', 'EARNED_LEAVE', 'MATERNITY_LEAVE', 'PATERNITY_LEAVE', 'UNPAID_LEAVE', 'CASUAL', 'SICK', 'EARNED', 'MATERNITY', 'PATERNITY', 'UNPAID')
      .default('CASUAL_LEAVE'),
    startDate: Joi.date().iso().required().messages({
      'any.required': 'Start date is required.'
    }),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).required().messages({
      'date.min': 'End date must be equal to or after start date.',
      'any.required': 'End date is required.'
    }),
    reason: Joi.string().trim().min(3).max(500).required().messages({
      'string.min': 'Reason must contain at least 3 characters.',
      'any.required': 'Reason for leave is required.'
    })
  }).unknown(true)
};

export const reportQuerySchema = {
  query: Joi.object({
    month: Joi.number().integer().min(1).max(12).optional(),
    year: Joi.number().integer().min(2020).max(2035).optional()
  }).unknown(true)
};

const stringOrArray = Joi.alternatives().try(
  Joi.array().items(Joi.string().trim()),
  Joi.string().trim().custom((value) => {
    if (!value) return [];
    return value.split(',').map((s) => s.trim());
  })
);

export const monthlyAttendanceSheetQuerySchema = {
  query: Joi.object({
    month: Joi.number().integer().min(1).max(12).optional(),
    year: Joi.number().integer().min(2020).max(2035).optional(),
    date: Joi.date().iso().optional().allow('', null),
    branchId: Joi.string().hex().length(24).optional().allow('', null),
    branchIds: stringOrArray.optional(),
    city: stringOrArray.optional(),
    cities: stringOrArray.optional(),
    state: stringOrArray.optional(),
    states: stringOrArray.optional(),
    search: Joi.string().trim().optional().allow('', null),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10)
  }).unknown(true)
};
