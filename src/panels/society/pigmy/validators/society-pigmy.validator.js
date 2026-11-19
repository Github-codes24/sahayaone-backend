import Joi from 'joi';

export const addSocietyAccountSchema = {
  body: Joi.object({
    pigmyCustomerId: Joi.string().trim().allow('', null).optional(),
    customerId: Joi.string().trim().allow('', null).optional(),
    userId: Joi.string().trim().allow('', null).optional(),
    phoneNumber: Joi.string().trim().allow('', null).optional(),
    societyAccountNumber: Joi.string().trim().required().messages({
      'any.required': 'societyAccountNumber is required to add or link society account.',
      'string.empty': 'societyAccountNumber cannot be empty.'
    }),
    ifscCode: Joi.string().trim().uppercase().allow('', null).optional(),
    accountHolderName: Joi.string().trim().allow('', null).optional(),
    bankBranchName: Joi.string().trim().allow('', null).optional(),
    pincode: Joi.string().trim().allow('', null).optional()
  }).unknown(true)
};

export const approvePigmyCustomerSchema = {
  body: Joi.object({
    remarks: Joi.string().trim().allow('', null).optional().default('Approved by Branch Manager')
  }).unknown(true)
};

export const rejectPigmyCustomerSchema = {
  body: Joi.object({
    reason: Joi.string().trim().required().messages({
      'any.required': 'Rejection reason (reason) is required to reject Pigmy Customer application.',
      'string.empty': 'Rejection reason cannot be empty.'
    }),
    rejectionReason: Joi.string().trim().optional(),
    remarks: Joi.string().trim().optional()
  }).unknown(true)
};

export const listSocietyPigmyCustomersSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().allow('', null).optional(),
    customerType: Joi.string().trim().uppercase().valid('INDIVIDUAL', 'MERCHANT', 'ALL', '').allow('', null).optional(),
    savingsAccountOption: Joi.string().trim().uppercase().valid('EXISTING', 'CREATE_NEW', 'ALL', '').allow('', null).optional(),
    approvalStatus: Joi.string().trim().uppercase().valid('PENDING_BRANCH_APPROVAL', 'APPROVED', 'REJECTED', 'ALL', '').allow('', null).optional(),
    status: Joi.string().trim().uppercase().valid('ACTIVE', 'INACTIVE', 'BLOCKED', 'ALL', '').allow('', null).optional(),
    startDate: Joi.string().trim().allow('', null).optional(),
    endDate: Joi.string().trim().allow('', null).optional(),
    fromDate: Joi.string().trim().allow('', null).optional(),
    toDate: Joi.string().trim().allow('', null).optional(),
    date: Joi.string().trim().allow('', null).optional(),
    sortBy: Joi.string().trim().default('createdAt'),
    sortOrder: Joi.string().trim().valid('asc', 'desc', '1', '-1').default('desc'),
    branchId: Joi.string().trim().allow('', null).optional(),
    type: Joi.string().trim().allow('', null).optional()
  }).unknown(true)
};
