import Joi from 'joi';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const listMerchantsSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().allow('').optional(),
    status: Joi.string().trim().uppercase().valid('ACTIVE', 'INACTIVE', 'BLOCKED').optional(),
    sortBy: Joi.string().trim().optional(),
    sortOrder: Joi.string().trim().valid('asc', 'desc', 'ASC', 'DESC').optional()
  })
};

export const getMerchantSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      'any.required': 'Merchant ID is required',
      'string.pattern.base': 'Invalid Merchant ID format'
    })
  })
};

export const createMerchantSchema = {
  body: Joi.object({
    shopName: Joi.string().trim().required().messages({
      'any.required': 'Shop Name is required'
    }),
    ownerName: Joi.string().trim().optional(),
    shopOwnerName: Joi.string().trim().optional(),
    email: Joi.string().trim().email().required().messages({
      'any.required': 'Email is required',
      'string.email': 'Must be a valid email address'
    }),
    phoneNumber: Joi.string().trim().required().messages({
      'any.required': 'Phone Number is required'
    }),
    phone: Joi.string().trim().optional(),
    aadhaarNumber: Joi.string().trim().allow('').optional(),
    ownerAadharNumber: Joi.string().trim().allow('').optional(),
    ownerAadhaarNumber: Joi.string().trim().allow('').optional(),
    panNumber: Joi.string().trim().allow('').optional(),
    ownerPanNumber: Joi.string().trim().allow('').optional(),
    gstinNumber: Joi.string().trim().allow('').optional(),
    gstin: Joi.string().trim().allow('').optional(),
    password: Joi.string().trim().min(6).allow('').optional(),
    status: Joi.string().trim().uppercase().valid('ACTIVE', 'INACTIVE', 'BLOCKED').default('ACTIVE').optional()
  }).or('ownerName', 'shopOwnerName')
};

export const updateMerchantSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      'any.required': 'Merchant ID is required',
      'string.pattern.base': 'Invalid Merchant ID format'
    })
  }),
  body: Joi.object({
    shopName: Joi.string().trim().optional(),
    ownerName: Joi.string().trim().optional(),
    shopOwnerName: Joi.string().trim().optional(),
    email: Joi.string().trim().email().optional(),
    phoneNumber: Joi.string().trim().optional(),
    phone: Joi.string().trim().optional(),
    aadhaarNumber: Joi.string().trim().allow('').optional(),
    ownerAadharNumber: Joi.string().trim().allow('').optional(),
    ownerAadhaarNumber: Joi.string().trim().allow('').optional(),
    panNumber: Joi.string().trim().allow('').optional(),
    ownerPanNumber: Joi.string().trim().allow('').optional(),
    gstinNumber: Joi.string().trim().allow('').optional(),
    gstin: Joi.string().trim().allow('').optional(),
    password: Joi.string().trim().min(6).allow('').optional(),
    status: Joi.string().trim().uppercase().valid('ACTIVE', 'INACTIVE', 'BLOCKED').optional()
  })
};
