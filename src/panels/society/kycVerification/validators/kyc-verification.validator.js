import Joi from 'joi';

const aadhaarRegex = /^([xX\d]{12}|[xX\d]{4}[-\s]?[xX\d]{4}[-\s]?[xX\d]{4})$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

export const initiateKycSchema = {
  body: Joi.object({
    documentType: Joi.string().trim().uppercase().valid('AADHAAR', 'PAN').required().messages({
      'any.only': 'documentType must be either AADHAAR or PAN',
      'any.required': 'documentType is required'
    }),
    idNumber: Joi.string().trim().required().custom((value, helpers) => {
      const parent = helpers.state.ancestors[0];
      if (parent.documentType === 'AADHAAR' && !aadhaarRegex.test(value)) {
        return helpers.message('Invalid Aadhaar number format. Must be 12 digits or masked (e.g. xxxxxxxx7383).');
      }
      if (parent.documentType === 'PAN' && !panRegex.test(value.toUpperCase())) {
        return helpers.message('Invalid PAN card number format. (e.g. ABCDE1234F)');
      }
      return value;
    }).messages({
      'any.required': 'idNumber is required'
    }),
    consent: Joi.boolean().default(true).messages({
      'boolean.base': 'consent must be a boolean'
    }),
    redirectUrl: Joi.string().uri().required().messages({
      'string.uri': 'redirectUrl must be a valid URL',
      'any.required': 'redirectUrl is required'
    })
  })
};

export const completeKycSchema = {
  body: Joi.object({
    refid: Joi.string().required().messages({
      'any.required': 'refid is required'
    })
  })
};

export const kycRefIdSchema = {
  params: Joi.object({
    refid: Joi.string().required().messages({
      'any.required': 'refid is required in params'
    })
  })
};

export const downloadDocSchema = {
  params: Joi.object({
    refid: Joi.string().required().messages({
      'any.required': 'refid is required in params'
    }),
    documentType: Joi.string().trim().uppercase().valid('AADHAAR', 'PAN').required().messages({
      'any.only': 'documentType must be either AADHAAR or PAN',
      'any.required': 'documentType is required'
    })
  })
};

export const kycHistoryQuerySchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().allow('').optional(),
    requestById: Joi.string().trim().hex().length(24).optional().messages({
      'string.hex': 'requestById must be a valid 24-character hex ObjectId',
      'string.length': 'requestById must be a valid 24-character hex ObjectId'
    }),
    createdBy: Joi.string().trim().hex().length(24).optional().messages({
      'string.hex': 'createdBy must be a valid 24-character hex ObjectId',
      'string.length': 'createdBy must be a valid 24-character hex ObjectId'
    }),
    documentType: Joi.string().trim().uppercase().valid('AADHAAR', 'PAN').optional(),
    status: Joi.string().valid('INITIATED', 'VERIFIED', 'FAILED', 'EXPIRED').optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional()
  })
};

