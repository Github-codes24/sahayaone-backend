import Joi from "joi";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const stringOrArray = Joi.alternatives().try(
  Joi.string().trim(),
  Joi.array().items(Joi.string().trim()),
);

export const listMerchantsSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().allow("", null),
    status: Joi.string()
      .valid(
        "ACTIVE",
        "INACTIVE",
        "BLOCKED",
        "PENDING_BRANCH_APPROVAL",
        "APPROVED",
        "REJECTED",
        "PENDING",
        "all",
        "ALL",
        "active",
        "inactive",
        "blocked",
        "pending_branch_approval",
        "approved",
        "rejected",
        "pending",
      )
      .allow("", null),
    approvalStatus: Joi.string()
      .valid(
        "PENDING_BRANCH_APPROVAL",
        "APPROVED",
        "REJECTED",
        "PENDING",
        "ACTIVE",
        "INACTIVE",
        "BLOCKED",
        "all",
        "ALL",
        "pending_branch_approval",
        "approved",
        "rejected",
        "pending",
        "active",
        "inactive",
        "blocked",
      )
      .allow("", null),
    branchId: Joi.string().pattern(objectIdRegex).allow("", null),
    branchIds: stringOrArray.optional(),
    city: Joi.string().trim().allow("", null),
    cities: stringOrArray.optional(),
    state: Joi.string().trim().allow("", null),
    states: stringOrArray.optional(),
    date: Joi.alternatives().try(Joi.date(), Joi.string().trim()).optional().allow("", null),
    dateFrom: Joi.alternatives().try(Joi.date(), Joi.string().trim()).optional().allow("", null),
    dateTo: Joi.alternatives().try(Joi.date(), Joi.string().trim()).optional().allow("", null),
    startDate: Joi.alternatives().try(Joi.date(), Joi.string().trim()).optional().allow("", null),
    endDate: Joi.alternatives().try(Joi.date(), Joi.string().trim()).optional().allow("", null),
    fromDate: Joi.alternatives().try(Joi.date(), Joi.string().trim()).optional().allow("", null),
    toDate: Joi.alternatives().try(Joi.date(), Joi.string().trim()).optional().allow("", null),
    createdFrom: Joi.alternatives().try(Joi.date(), Joi.string().trim()).optional().allow("", null),
    createdTo: Joi.alternatives().try(Joi.date(), Joi.string().trim()).optional().allow("", null),
    from: Joi.alternatives().try(Joi.date(), Joi.string().trim()).optional().allow("", null),
    to: Joi.alternatives().try(Joi.date(), Joi.string().trim()).optional().allow("", null),
    createdBy: Joi.string().pattern(objectIdRegex).optional().allow("", null),
    onboardedBy: Joi.string().pattern(objectIdRegex).optional().allow("", null),
    isDeleted: Joi.alternatives()
      .try(Joi.boolean(), Joi.string().valid("true", "false", "all", "ALL"))
      .optional(),
    includeDeleted: Joi.boolean().optional(),
    sortBy: Joi.string().trim().default("createdAt"),
    sortOrder: Joi.string().valid("asc", "desc", "ASC", "DESC").default("desc"),
  }),
};

export const getMerchantSchema = {
  params: Joi.object({
    id: Joi.string().pattern(objectIdRegex).required().messages({
      "string.pattern.base": "Invalid Merchant ID format.",
      "any.required": "Merchant ID is required.",
    }),
  }),
};

export const createMerchantSchema = {
  body: Joi.object({
    shopName: Joi.string().trim().required().messages({
      "any.required": "Shop Name is required.",
      "string.empty": "Shop Name cannot be empty.",
    }),
    ownerName: Joi.string().trim().allow("", null),
    shopOwnerName: Joi.string().trim().allow("", null),
    email: Joi.string().email().trim().required().messages({
      "any.required": "Email address is required.",
      "string.email": "Please provide a valid email address.",
    }),
    phoneNumber: Joi.string().trim().allow("", null),
    phone: Joi.string().trim().allow("", null),
    aadhaarNumber: Joi.string().trim().allow("", null),
    ownerAadharNumber: Joi.string().trim().allow("", null),
    ownerAadhaarNumber: Joi.string().trim().allow("", null),
    panNumber: Joi.string().trim().allow("", null),
    ownerPanNumber: Joi.string().trim().allow("", null),
    gstinNumber: Joi.string().trim().allow("", null),
    gstin: Joi.string().trim().allow("", null),
    branchId: Joi.string().pattern(objectIdRegex).allow("", null),
    status: Joi.string()
      .valid("ACTIVE", "INACTIVE", "BLOCKED", "active", "inactive", "blocked")
      .default("ACTIVE"),
    password: Joi.string().min(6).allow("", null),

    // Bank account details (Co-operative bank standards)
    bankDetails: Joi.object({
      accountHolderName: Joi.string().trim().optional(),
      accountNumber: Joi.string().trim().optional(),
      societyAccountNumber: Joi.string().trim().optional(),
      ifscCode: Joi.string().trim().uppercase().optional(),
      bankName: Joi.string().trim().optional(),
      branchName: Joi.string().trim().optional(),
      bankBranchName: Joi.string().trim().optional(),
      accountType: Joi.string()
        .valid(
          "SAVINGS",
          "CURRENT",
          "CC",
          "OD",
          "savings",
          "current",
          "cc",
          "od",
        )
        .optional(),
    }).optional(),

    societyAccount: Joi.object({
      accountHolderName: Joi.string().trim().optional(),
      accountNumber: Joi.string().trim().optional(),
      societyAccountNumber: Joi.string().trim().optional(),
      ifscCode: Joi.string().trim().uppercase().optional(),
      bankName: Joi.string().trim().optional(),
      branchName: Joi.string().trim().optional(),
      bankBranchName: Joi.string().trim().optional(),
      accountType: Joi.string()
        .valid(
          "SAVINGS",
          "CURRENT",
          "CC",
          "OD",
          "savings",
          "current",
          "cc",
          "od",
        )
        .optional(),
    }).optional(),

    societyBankAccount: Joi.object({
      accountHolderName: Joi.string().trim().optional(),
      accountNumber: Joi.string().trim().optional(),
      societyAccountNumber: Joi.string().trim().optional(),
      ifscCode: Joi.string().trim().uppercase().optional(),
      bankName: Joi.string().trim().optional(),
      branchName: Joi.string().trim().optional(),
      bankBranchName: Joi.string().trim().optional(),
      accountType: Joi.string()
        .valid(
          "SAVINGS",
          "CURRENT",
          "CC",
          "OD",
          "savings",
          "current",
          "cc",
          "od",
        )
        .optional(),
    }).optional(),

    accountHolderName: Joi.string().trim().optional(),
    accountNumber: Joi.string().trim().optional(),
    societyAccountNumber: Joi.string().trim().optional(),
    ifscCode: Joi.string().trim().uppercase().optional(),
    bankName: Joi.string().trim().optional(),
    branchName: Joi.string().trim().optional(),
    bankBranchName: Joi.string().trim().optional(),
    accountType: Joi.string()
      .valid("SAVINGS", "CURRENT", "CC", "OD", "savings", "current", "cc", "od")
      .optional(),
  })
    .or("ownerName", "shopOwnerName")
    .or("phoneNumber", "phone")
    .messages({
      "object.missing": "Shop Owner Name and Phone Number are required.",
    }),
};

export const updateMerchantSchema = {
  params: Joi.object({
    id: Joi.string().pattern(objectIdRegex).required(),
  }),
  body: Joi.object({
    shopName: Joi.string().trim().optional(),
    ownerName: Joi.string().trim().optional().allow("", null),
    shopOwnerName: Joi.string().trim().optional().allow("", null),
    email: Joi.string().email().trim().optional(),
    phoneNumber: Joi.string().trim().optional().allow("", null),
    phone: Joi.string().trim().optional().allow("", null),
    aadhaarNumber: Joi.string().trim().optional().allow("", null),
    ownerAadharNumber: Joi.string().trim().optional().allow("", null),
    ownerAadhaarNumber: Joi.string().trim().optional().allow("", null),
    panNumber: Joi.string().trim().optional().allow("", null),
    ownerPanNumber: Joi.string().trim().optional().allow("", null),
    gstinNumber: Joi.string().trim().optional().allow("", null),
    gstin: Joi.string().trim().optional().allow("", null),
    branchId: Joi.string().pattern(objectIdRegex).optional().allow("", null),
    status: Joi.string()
      .valid("ACTIVE", "INACTIVE", "BLOCKED", "active", "inactive", "blocked")
      .optional(),
    password: Joi.string().min(6).optional().allow("", null),

    // Bank details update fields
    bankDetails: Joi.object({
      accountHolderName: Joi.string().trim().optional().allow("", null),
      accountNumber: Joi.string().trim().optional().allow("", null),
      ifscCode: Joi.string().trim().uppercase().optional().allow("", null),
      bankName: Joi.string().trim().optional().allow("", null),
      branchName: Joi.string().trim().optional().allow("", null),
      accountType: Joi.string()
        .valid(
          "SAVINGS",
          "CURRENT",
          "CC",
          "OD",
          "savings",
          "current",
          "cc",
          "od",
        )
        .optional()
        .allow("", null),
    }).optional(),

    accountHolderName: Joi.string().trim().optional().allow("", null),
    accountNumber: Joi.string().trim().optional().allow("", null),
    ifscCode: Joi.string().trim().uppercase().optional().allow("", null),
    bankName: Joi.string().trim().optional().allow("", null),
    branchName: Joi.string().trim().optional().allow("", null),
    accountType: Joi.string()
      .valid("SAVINGS", "CURRENT", "CC", "OD", "savings", "current", "cc", "od")
      .optional()
      .allow("", null),
  }),
};

export const approveMerchantSchema = {
  body: Joi.object({
    remarks: Joi.string().trim().allow("", null).optional(),
  }).unknown(true),
};

export const rejectMerchantSchema = {
  body: Joi.object({
    reason: Joi.string().trim().required().messages({
      "any.required":
        "Rejection reason (reason) is required to reject Merchant application.",
      "string.empty": "Rejection reason cannot be empty.",
    }),
    rejectionReason: Joi.string().trim().optional(),
    remarks: Joi.string().trim().optional(),
  }).unknown(true),
};

export const linkBankMerchantSchema = {
  body: Joi.object({
    merchantId: Joi.string().trim().allow("", null).optional(),
    customerId: Joi.string().trim().allow("", null).optional(),
    userId: Joi.string().trim().allow("", null).optional(),
    id: Joi.string().trim().allow("", null).optional(),
    phoneNumber: Joi.string().trim().allow("", null).optional(),
    accountNumber: Joi.string().trim().allow("", null).optional(),
    societyAccountNumber: Joi.string().trim().allow("", null).optional(),
    accountHolderName: Joi.string().trim().allow("", null).optional(),
    ifscCode: Joi.string().trim().uppercase().allow("", null).optional(),
    bankName: Joi.string().trim().allow("", null).optional(),
    branchName: Joi.string().trim().allow("", null).optional(),
    bankBranchName: Joi.string().trim().allow("", null).optional(),
    accountType: Joi.string()
      .valid("SAVINGS", "CURRENT", "CC", "OD", "savings", "current", "cc", "od", "")
      .allow("", null)
      .optional(),
    pincode: Joi.string().trim().allow("", null).optional(),
  }).unknown(true),
};

