import Joi from 'joi';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const listCustomersSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().allow('').optional(),
    gender: Joi.string().trim().uppercase().valid('MALE', 'FEMALE', 'OTHER').optional(),
    status: Joi.string().trim().uppercase().valid('ACTIVE', 'INACTIVE', 'BLOCKED', 'PENDING_KYC').optional(),
    bankId: Joi.string().regex(objectIdRegex).optional(),
    bank: Joi.string().trim().optional(),
    fromDate: Joi.string().trim().allow('').optional(),
    toDate: Joi.string().trim().allow('').optional(),
    startDate: Joi.string().trim().allow('').optional(),
    endDate: Joi.string().trim().allow('').optional(),
    createdFrom: Joi.string().trim().allow('').optional(),
    createdTo: Joi.string().trim().allow('').optional(),
    from: Joi.string().trim().allow('').optional(),
    to: Joi.string().trim().allow('').optional(),
    sortBy: Joi.string().trim().optional(),
    sortOrder: Joi.string().trim().valid('asc', 'desc', 'ASC', 'DESC').optional()
  })
};

export const getCustomerSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      'any.required': 'Customer ID is required',
      'string.pattern.base': 'Invalid Customer ID format'
    })
  })
};

export const getCustomerLoansSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      'any.required': 'Customer ID is required',
      'string.pattern.base': 'Invalid Customer ID format'
    })
  }),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    status: Joi.string().trim().uppercase().valid('ALL', 'NEW', 'ACTIVE', 'COMPLETED', 'REJECTED').default('ALL').optional(),
    search: Joi.string().trim().allow('').optional()
  })
};

export const getSingleLoanSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      'any.required': 'Customer ID is required',
      'string.pattern.base': 'Invalid Customer ID format'
    }),
    loanId: Joi.string().regex(objectIdRegex).required().messages({
      'any.required': 'Loan ID is required',
      'string.pattern.base': 'Invalid Loan ID format'
    })
  })
};

export const createCustomerSchema = {
  body: Joi.object({
    fullName: Joi.string().trim().optional(),
    firstName: Joi.string().trim().optional(),
    lastName: Joi.string().trim().optional(),
    gender: Joi.string().trim().uppercase().valid('MALE', 'FEMALE', 'OTHER').required().messages({
      'any.required': 'Gender is required',
      'any.only': 'Gender must be MALE, FEMALE, or OTHER'
    }),
    dob: Joi.string().trim().required().messages({
      'any.required': 'Date of Birth is required'
    }),
    dateOfBirth: Joi.string().trim().optional(),
    phone: Joi.string().trim().pattern(/^[0-9]{10}$/).optional(),
    phoneNumber: Joi.string().trim().pattern(/^[0-9]{10}$/).optional(),
    email: Joi.string().trim().email().allow('').optional(),
    address: Joi.string().trim().allow('').optional(),
    status: Joi.string().trim().uppercase().valid('ACTIVE', 'INACTIVE', 'BLOCKED', 'PENDING_KYC').optional()
  }).or('fullName', 'firstName').or('phone', 'phoneNumber')
};

export const updateCustomerSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      'any.required': 'Customer ID is required',
      'string.pattern.base': 'Invalid Customer ID format'
    })
  }),
  body: Joi.object({
    fullName: Joi.string().trim().optional(),
    firstName: Joi.string().trim().optional(),
    lastName: Joi.string().trim().optional(),
    gender: Joi.string().trim().uppercase().valid('MALE', 'FEMALE', 'OTHER').optional(),
    dob: Joi.string().trim().optional(),
    dateOfBirth: Joi.string().trim().optional(),
    phone: Joi.string().trim().pattern(/^[0-9]{10}$/).optional(),
    phoneNumber: Joi.string().trim().pattern(/^[0-9]{10}$/).optional(),
    email: Joi.string().trim().email().allow('').optional(),
    address: Joi.string().trim().allow('').optional(),
    status: Joi.string().trim().uppercase().valid('ACTIVE', 'INACTIVE', 'BLOCKED', 'PENDING_KYC').optional()
  })
};
