import Joi from 'joi';

export const onboardMerchantSchema = {
  body: Joi.object({
    shopName: Joi.string().trim().required().messages({
      'any.required': 'Shop name is required.',
      'string.empty': 'Shop name cannot be empty.'
    }),
    ownerName: Joi.string().trim().required().messages({
      'any.required': 'Owner name is required.',
      'string.empty': 'Owner name cannot be empty.'
    }),
    primaryPhoneNumber: Joi.string().trim().pattern(/^[0-9]{10}$/).required().messages({
      'any.required': 'Primary contact number (10-digit mobile) is required.',
      'string.pattern.base': 'Primary contact number must be a valid 10-digit mobile number.'
    }),
    phoneNumber: Joi.string().trim().pattern(/^[0-9]{10}$/).optional(),
    secondaryPhoneNumber: Joi.string().trim().pattern(/^[0-9]{10}$/).allow('', null).optional(),
    email: Joi.string().trim().email().lowercase().required().messages({
      'any.required': 'Email address is required.',
      'string.email': 'Please provide a valid email address.'
    }),
    shopAddress: Joi.string().trim().required().messages({
      'any.required': 'Full shop address is required.',
      'string.empty': 'Shop address cannot be empty.'
    }),
    aadhaarNumber: Joi.string().trim().pattern(/^[0-9]{12}$/).required().messages({
      'any.required': 'Aadhaar number (12-digit) is required.',
      'string.pattern.base': 'Aadhaar number must be a 12-digit numeric string.'
    }),
    aadhaarImage: Joi.string().trim().allow('', null).optional(),
    panNumber: Joi.string().trim().uppercase().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).required().messages({
      'any.required': 'PAN number is required.',
      'string.pattern.base': 'PAN number must be a valid 10-character alphanumeric PAN string.'
    }),
    panImage: Joi.string().trim().allow('', null).optional(),
    businessProofType: Joi.any().custom((value, helpers) => {
      if (!value) return helpers.error('any.required');
      const cleaned = String(value).replace(/[\r\n'"]/g, '').trim().toUpperCase();
      if (['GST', 'SHOP_LICENSE'].includes(cleaned)) {
        return cleaned;
      }
      return helpers.error('any.only');
    }).required().messages({
      'any.required': 'Business proof type (GST or SHOP_LICENSE) is required.',
      'any.only': 'businessProofType must be one of [GST, SHOP_LICENSE]'
    }),
    businessProofNumber: Joi.string().trim().uppercase().required().messages({
      'any.required': 'GST number or Shop License number is required.'
    }),
    businessProofImage: Joi.string().trim().allow('', null).optional(),
    shopPhoto: Joi.string().trim().allow('', null).optional(),
    password: Joi.string().min(6).required().messages({
      'any.required': 'Password for merchant login panel is required.',
      'string.min': 'Password must be at least 6 characters long.'
    }),
    termsAccepted: Joi.any().custom((value, helpers) => {
      if (value === undefined || value === null || value === '') {
        return helpers.error('any.required');
      }
      const strVal = String(value).replace(/[\r\n'"]/g, '').trim().toLowerCase();
      if (['true', '1', 'yes'].includes(strVal) || value === true || value === 1) {
        return true;
      }
      return helpers.error('any.only');
    }).required().messages({
      'any.required': 'Terms and conditions must be accepted.',
      'any.only': 'You must accept the terms and conditions to onboard merchant.'
    }),
    branchId: Joi.string().trim().allow('', null).optional(),
    bankId: Joi.string().trim().allow('', null).optional(),
    ownerAadhaar: Joi.any().optional(),
    ownerPan: Joi.any().optional(),
    businessProof: Joi.any().optional()
  }).unknown(true)
};

export const listExecutiveMerchantsSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().allow('', null).optional(),
    approvalStatus: Joi.string().valid('PENDING_BRANCH_APPROVAL', 'APPROVED', 'REJECTED', 'ALL').optional(),
    branchId: Joi.string().trim().allow('', null).optional(),
    sortBy: Joi.string().default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc', '1', '-1').default('desc')
  })
};

export const getMerchantByIdSchema = {
  params: Joi.object({
    id: Joi.string().trim().required()
  })
};
