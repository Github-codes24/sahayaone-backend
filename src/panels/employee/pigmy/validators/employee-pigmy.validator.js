import Joi from 'joi';

export const onboardPigmyCustomerSchema = {
  body: Joi.object({
    customerId: Joi.string().trim().allow('', null).optional(),
    customerUniqueId: Joi.string().trim().allow('', null).optional(),
    userId: Joi.string().trim().allow('', null).optional(),
    fullName: Joi.string().trim().allow('', null).optional(),
    ownerName: Joi.string().trim().allow('', null).optional(),
    primaryPhoneNumber: Joi.string().trim().pattern(/^[0-9]{10}$/).allow('', null).optional(),
    phoneNumber: Joi.string().trim().pattern(/^[0-9]{10}$/).allow('', null).optional(),
    secondaryPhoneNumber: Joi.string().trim().pattern(/^[0-9]{10}$/).allow('', null).optional(),
    email: Joi.string().trim().email().lowercase().allow('', null).optional(),
    dob: Joi.string().trim().allow('', null).optional(),
    gender: Joi.string().trim().uppercase().valid('MALE', 'FEMALE', 'OTHER', '').allow('', null).optional(),
    address: Joi.string().trim().allow('', null).optional(),
    residenceAddress: Joi.string().trim().allow('', null).optional(),
    aadhaarNumber: Joi.string().trim().pattern(/^[0-9]{12}$/).allow('', null).optional(),
    panNumber: Joi.string().trim().uppercase().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).allow('', null).optional(),

    // Savings Account Option (EXISTING vs CREATE_NEW)
    savingsAccountOption: Joi.any().custom((value, helpers) => {
      if (!value) return 'EXISTING';
      const clean = String(value).replace(/[\r\n'"]/g, '').trim().toUpperCase();
      if (['NEW', 'CREATE_NEW', 'NEW_ACCOUNT'].includes(clean)) return 'CREATE_NEW';
      return 'EXISTING';
    }).optional().default('EXISTING'),
    hasSavingsAccount: Joi.any().optional(),
    existingSavingsAccountNumber: Joi.string().trim().allow('', null).optional(),

    // Customer Bank Account Details for Auto-Debit Mandate
    bankAccountId: Joi.string().trim().allow('', null).optional(),
    accountHolderName: Joi.string().trim().allow('', null).optional(),
    bankAccountNumber: Joi.string().trim().allow('', null).optional(),
    accountNumber: Joi.string().trim().allow('', null).optional(),
    ifscCode: Joi.string().trim().uppercase().allow('', null).optional(),
    bankName: Joi.string().trim().allow('', null).optional(),
    bankBranchName: Joi.string().trim().allow('', null).optional(),
    accountType: Joi.string().trim().uppercase().valid('SAVINGS', 'CURRENT').optional().default('SAVINGS'),

    // Deposit Scheme Tenure (1, 3, 6, 12 Months)
    tenureMonths: Joi.number().valid(1, 3, 6, 12).optional().default(12).messages({
      'any.only': 'Tenure must be 1, 3, 6, or 12 months.'
    }),

    // SIP Scheme Linkage
    schemeId: Joi.string().trim().allow('', null).optional(),
    schemeCode: Joi.string().trim().allow('', null).optional(),
    schemeName: Joi.string().trim().allow('', null).optional(),
    interestRate: Joi.number().min(0).allow('', null).optional(),
    isCustomAmount: Joi.any().custom((value) => {
      if (value === undefined || value === null || value === '') return false;
      const strVal = String(value).replace(/[\r\n'"]/g, '').trim().toLowerCase();
      if (['true', '1', 'yes'].includes(strVal) || value === true || value === 1) return true;
      return false;
    }).optional().default(false),

    // Auto-Debit Deposit Configuration
    dailyDepositAmount: Joi.number().min(10).optional().default(100),
    autoDebitAmount: Joi.number().min(10).optional(),
    depositFrequency: Joi.string().uppercase().valid('DAILY', 'WEEKLY', 'MONTHLY').optional().default('DAILY'),

    // Flexible Pigmy Customer Type & Merchant Option
    isMerchant: Joi.any().custom((value, helpers) => {
      if (value === undefined || value === null || value === '') return false;
      const strVal = String(value).replace(/[\r\n'"]/g, '').trim().toLowerCase();
      if (['true', '1', 'yes'].includes(strVal) || value === true || value === 1) return true;
      return false;
    }).optional(),

    customerType: Joi.any().custom((value, helpers) => {
      if (!value) return 'INDIVIDUAL';
      const clean = String(value).replace(/[\r\n'"]/g, '').trim().toUpperCase();
      if (['MERCHANT', 'VENDOR'].includes(clean)) return 'MERCHANT';
      return 'INDIVIDUAL';
    }).optional(),

    // Optional Merchant Details (Used when isMerchant = true)
    shopName: Joi.string().trim().allow('', null).optional(),
    shopAddress: Joi.string().trim().allow('', null).optional(),
    businessProofType: Joi.any().custom((value, helpers) => {
      if (!value) return '';
      const clean = String(value).replace(/[\r\n'"]/g, '').trim().toUpperCase();
      if (['GST', 'SHOP_LICENSE', 'UDYAM', 'TRADE_LICENSE', 'OTHER', 'NONE'].includes(clean)) return clean;
      return clean || '';
    }).optional(),
    businessProofNumber: Joi.string().trim().uppercase().allow('', null).optional(),

    password: Joi.string().min(6).allow('', null).optional(),
    termsAccepted: Joi.any().custom((value, helpers) => {
      if (value === undefined || value === null || value === '') return true;
      const strVal = String(value).replace(/[\r\n'"]/g, '').trim().toLowerCase();
      if (['true', '1', 'yes'].includes(strVal) || value === true || value === 1) return true;
      return helpers.error('any.only');
    }).optional().messages({
      'any.only': 'You must accept terms and conditions to onboard Pigmy Customer.'
    }),
    branchId: Joi.string().trim().allow('', null).optional(),
    bankId: Joi.string().trim().allow('', null).optional()
  }).unknown(true)
};

export const listPigmyCustomersSchema = {
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
    branchId: Joi.string().trim().allow('', null).optional()
  })
};
