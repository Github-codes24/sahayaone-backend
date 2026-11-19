import Joi from 'joi';

// Helper for multi-select arrays or comma-separated strings
const stringOrArray = Joi.alternatives().try(
  Joi.array().items(Joi.string().trim()),
  Joi.string().trim().custom((value, helpers) => {
    if (!value) return [];
    return value.split(',').map(s => s.trim());
  })
);

export const createDailyWorkReportSchema = {
  body: Joi.object({
  employeeId: Joi.string().hex().length(24).required().messages({
    'any.required': 'Employee ID is required.'
  }),
  date: Joi.date().iso().required().messages({
    'any.required': 'Report date is required.'
  }),
  product: Joi.string().trim().required().messages({
    'any.required': 'Product name is required.'
  }),
  amount: Joi.number().min(0).required().messages({
    'any.required': 'Achievement amount is required.'
  }),
  remarks: Joi.string().trim().optional().allow('', null)
})
};

export const queryDailyWorkReportSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().optional().allow('', null),
    designations: stringOrArray.optional(),
    states: stringOrArray.optional(),
    branchId: Joi.string().hex().length(24).optional().allow('', null),
    branchIds: stringOrArray.optional(),
    sourceModule: Joi.string().trim().optional().allow('', null),
    date: Joi.date().iso().optional().allow('', null),
    dateFrom: Joi.date().iso().optional().allow('', null),
    dateTo: Joi.date().iso().optional().allow('', null),
    startDate: Joi.date().iso().optional().allow('', null),
    endDate: Joi.date().iso().optional().allow('', null)
  })
};

export const offerLetterSchema = {
  body: Joi.object({
    employeeId: Joi.string().hex().length(24).required().messages({
      'any.required': 'Employee ID is required.'
    }),
    state: Joi.string().trim().optional().allow('', null),
    branchId: Joi.string().hex().length(24).optional().allow('', null),
    designation: Joi.string().trim().optional().allow('', null),
    department: Joi.string().trim().optional().allow('', null),
    salary: Joi.number().min(0).optional().allow(null),
    reportingManager: Joi.string().trim().optional().allow('', null),
    placeOfPosting: Joi.string().trim().optional().allow('', null),
    employmentType: Joi.string().trim().optional().allow('', null),
    signatoryName: Joi.string().trim().optional().allow('', null),
    signatoryDesignation: Joi.string().trim().optional().allow('', null),
    bankLogo: Joi.string().trim().optional().allow('', null)
  })
};

export const confirmationLetterSchema = {
  body: Joi.object({
    employeeId: Joi.string().hex().length(24).required().messages({
      'any.required': 'Employee ID is required.'
    }),
    state: Joi.string().trim().optional().allow('', null),
    branchId: Joi.string().hex().length(24).optional().allow('', null),
    designation: Joi.string().trim().optional().allow('', null),
    department: Joi.string().trim().optional().allow('', null),
    confirmationDate: Joi.date().iso().optional().allow('', null),
    dateOfJoining: Joi.date().iso().optional().allow('', null),
    probationEndDate: Joi.date().iso().optional().allow('', null),
    offerLetterDate: Joi.date().iso().optional().allow('', null),
    noticePeriodDays: Joi.number().min(1).optional().allow(null),
    signatoryName: Joi.string().trim().optional().allow('', null),
    signatoryDesignation: Joi.string().trim().optional().allow('', null),
    bankLogo: Joi.string().trim().optional().allow('', null)
  })
};

export const performanceLetterSchema = {
  body: Joi.object({
    employeeId: Joi.string().hex().length(24).required().messages({
      'any.required': 'Employee ID is required.'
    }),
    state: Joi.string().trim().optional().allow('', null),
    branchId: Joi.string().hex().length(24).optional().allow('', null),
    designation: Joi.string().trim().optional().allow('', null),
    department: Joi.string().trim().optional().allow('', null),
    reviewPeriod: Joi.string().trim().optional().allow('', null),
    overallRating: Joi.string().trim().optional().allow('', null),
    ratingLabel: Joi.string().trim().optional().allow('', null),
    managerComments: Joi.string().trim().optional().allow('', null),
    letterText: Joi.string().trim().optional().allow('', null),
    kras: Joi.array().items(
      Joi.object({
        kra: Joi.string().trim().required(),
        target: Joi.string().trim().optional().allow('', null),
        achievement: Joi.string().trim().optional().allow('', null),
        rating: Joi.string().trim().optional().allow('', null)
      })
    ).optional(),
    signatoryName: Joi.string().trim().optional().allow('', null),
    signatoryDesignation: Joi.string().trim().optional().allow('', null),
    bankLogo: Joi.string().trim().optional().allow('', null)
  })
};

export const promotionLetterSchema = {
  body: Joi.object({
    employeeId: Joi.string().hex().length(24).required().messages({
      'any.required': 'Employee ID is required.'
    }),
    newRole: Joi.string().trim().optional().allow('', null),
    promotedToDesignation: Joi.string().trim().optional().allow('', null),
    newDesignation: Joi.string().trim().optional().allow('', null),
    designation: Joi.string().trim().optional().allow('', null),
    state: Joi.string().trim().optional().allow('', null),
    branchId: Joi.string().hex().length(24).optional().allow('', null),
    currentDesignation: Joi.string().trim().optional().allow('', null),
    department: Joi.string().trim().optional().allow('', null),
    reportingManager: Joi.string().trim().optional().allow('', null),
    location: Joi.string().trim().optional().allow('', null),
    promotionDate: Joi.date().iso().optional().allow('', null),
    effectiveDate: Joi.date().iso().optional().allow('', null),
    revisedCtc: Joi.number().min(0).optional().allow(null),
    amount: Joi.number().min(0).optional().allow(null),
    salary: Joi.number().min(0).optional().allow(null),
    responsibilitiesSummary: Joi.string().trim().optional().allow('', null),
    signatoryName: Joi.string().trim().optional().allow('', null),
    signatoryDesignation: Joi.string().trim().optional().allow('', null),
    bankLogo: Joi.string().trim().optional().allow('', null)
  })
};

export const transferLetterSchema = {
  body: Joi.object({
    employeeId: Joi.string().hex().length(24).optional().allow('', null),
    id: Joi.string().hex().length(24).optional().allow('', null),
    transferToBranchId: Joi.string().hex().length(24).optional().allow('', null),
    branchId: Joi.string().hex().length(24).optional().allow('', null),
    targetBranchId: Joi.string().hex().length(24).optional().allow('', null),
    state: Joi.string().trim().optional().allow('', null),
    designation: Joi.string().trim().optional().allow('', null),
    transferDate: Joi.date().iso().optional().allow('', null),
    effectiveDate: Joi.date().iso().optional().allow('', null),
    reportingDate: Joi.date().iso().optional().allow('', null),
    newReportingManager: Joi.string().trim().optional().allow('', null),
    handoverTo: Joi.string().trim().optional().allow('', null),
    signatoryName: Joi.string().trim().optional().allow('', null),
    signatoryDesignation: Joi.string().trim().optional().allow('', null),
    bankLogo: Joi.string().trim().optional().allow('', null)
  })
    .or('employeeId', 'id')
    .messages({
      'object.missing': 'Employee ID (or id) is required.'
    })
};

export const salarySlipSchema = {
  body: Joi.object({
    employeeId: Joi.string().hex().length(24).optional().allow('', null),
    id: Joi.string().hex().length(24).optional().allow('', null),
    salaryDate: Joi.date().iso().optional().allow('', null),
    salaryMonth: Joi.string().trim().optional().allow('', null),
    date: Joi.date().iso().optional().allow('', null),
    fromMonth: Joi.string().trim().optional().allow('', null),
    toMonth: Joi.string().trim().optional().allow('', null),
    payDate: Joi.date().iso().optional().allow('', null),
    payPeriod: Joi.string().trim().optional().allow('', null),
    state: Joi.string().trim().optional().allow('', null),
    branchId: Joi.string().hex().length(24).optional().allow('', null),
    designation: Joi.string().trim().optional().allow('', null),
    grossSalary: Joi.number().min(0).optional().allow(null),
    accountNumber: Joi.string().trim().optional().allow('', null),
    pfUan: Joi.string().trim().optional().allow('', null),
    workingDays: Joi.number().min(0).optional().allow(null),
    presentDays: Joi.number().min(0).optional().allow(null),
    paidDays: Joi.number().min(0).optional().allow(null),
    lopDays: Joi.number().min(0).optional().allow(null),
    pfDeduction: Joi.number().min(0).optional().allow(null),
    professionalTax: Joi.number().min(0).optional().allow(null),
    tds: Joi.number().min(0).optional().allow(null),
    otherDeductions: Joi.number().min(0).optional().allow(null),
    employerPf: Joi.number().min(0).optional().allow(null),
    earnings: Joi.array().items(Joi.object({
      label: Joi.string().trim().optional().allow('', null),
      name: Joi.string().trim().optional().allow('', null),
      amount: Joi.number().min(0).required()
    })).optional(),
    deductions: Joi.array().items(Joi.object({
      label: Joi.string().trim().optional().allow('', null),
      name: Joi.string().trim().optional().allow('', null),
      amount: Joi.number().min(0).required()
    })).optional(),
    employerContributions: Joi.array().items(Joi.object({
      label: Joi.string().trim().optional().allow('', null),
      name: Joi.string().trim().optional().allow('', null),
      amount: Joi.number().min(0).required()
    })).optional(),
    signatoryName: Joi.string().trim().optional().allow('', null),
    signatoryDesignation: Joi.string().trim().optional().allow('', null),
    bankLogo: Joi.string().trim().optional().allow('', null)
  })
    .or('employeeId', 'id')
    .messages({
      'object.missing': 'Employee ID (or id) is required.'
    })
};

export const salaryIncrementSchema = {
  body: Joi.object({
    employeeId: Joi.string().hex().length(24).optional().allow('', null),
    id: Joi.string().hex().length(24).optional().allow('', null),
    state: Joi.string().trim().optional().allow('', null),
    branchId: Joi.string().hex().length(24).optional().allow('', null),
    designation: Joi.string().trim().optional().allow('', null),
    department: Joi.string().trim().optional().allow('', null),
    reviewPeriod: Joi.string().trim().optional().allow('', null),
    effectiveDate: Joi.date().iso().optional().allow('', null),
    fromMonth: Joi.string().trim().optional().allow('', null),
    incrementPercentage: Joi.number().min(0).optional().allow(null),
    incrementPercent: Joi.number().min(0).optional().allow(null),
    currentCtc: Joi.number().min(0).optional().allow(null),
    oldSalary: Joi.number().min(0).optional().allow(null),
    revisedCtc: Joi.number().min(0).optional().allow(null),
    newSalary: Joi.number().min(0).optional().allow(null),
    revisedAnnualCtc: Joi.number().min(0).optional().allow(null),
    signatoryName: Joi.string().trim().optional().allow('', null),
    signatoryDesignation: Joi.string().trim().optional().allow('', null),
    bankLogo: Joi.string().trim().optional().allow('', null)
  })
    .or('employeeId', 'id')
    .messages({
      'object.missing': 'Employee ID (or id) is required.'
    })
};

export const terminationLetterSchema = {
  body: Joi.object({
    employeeId: Joi.string().hex().length(24).required().messages({
      'any.required': 'Employee ID is required.'
    }),
    state: Joi.string().trim().optional().allow('', null),
    branchId: Joi.string().hex().length(24).optional().allow('', null),
    designation: Joi.string().trim().optional().allow('', null),
    terminationDate: Joi.date().iso().required().messages({
      'any.required': 'Termination date is required.'
    }),
    reason: Joi.string().trim().optional().allow('', null),
    noticePeriodDays: Joi.number().min(0).optional().allow(null)
  })
};

export const queryKpaReportSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().optional().allow('', null),
    designations: stringOrArray.optional(),
    states: stringOrArray.optional(),
    branchId: Joi.string().hex().length(24).optional().allow('', null),
    branchIds: stringOrArray.optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional()
  })
};

export const queryKpaDetailSchema = {
  query: Joi.object({
    year: Joi.number().integer().min(2000).max(2100).default(() => new Date().getFullYear()),
    product: Joi.string().trim().optional().allow('', null),
    branchId: Joi.string().hex().length(24).optional().allow('', null),
    branchIds: stringOrArray.optional()
  })
};

export const createKpaTargetSchema = {
  body: Joi.object({
    employeeId: Joi.string().hex().length(24).optional().allow('', null),
    id: Joi.string().hex().length(24).optional().allow('', null),
    year: Joi.number().integer().min(2000).max(2100).default(() => new Date().getFullYear()),
    product: Joi.string().trim().required().messages({
      'any.required': 'Target product name is required.'
    }),
    productId: Joi.string().hex().length(24).optional().allow('', null),
    targetType: Joi.string().valid('AMOUNT', 'COUNT').default('AMOUNT'),
    targetValue: Joi.number().min(0).required().messages({
      'any.required': 'Target value is required.'
    })
  })
};

export const updateKpaTargetSchema = {
  body: Joi.object({
    employeeId: Joi.string().hex().length(24).optional().allow('', null),
    id: Joi.string().hex().length(24).optional().allow('', null),
    year: Joi.number().integer().min(2000).max(2100).optional().allow(null),
    product: Joi.string().trim().required().messages({
      'any.required': 'Target product name is required.'
    }),
    productId: Joi.string().hex().length(24).optional().allow('', null),
    targetType: Joi.string().valid('AMOUNT', 'COUNT').optional().allow('', null),
    targetValue: Joi.number().min(0).required().messages({
      'any.required': 'Target value is required.'
    })
  })
};

export const upsertProductIncentiveSchema = {
  body: Joi.object({
    product: Joi.string().trim().required().messages({
      'any.required': 'Product name is required.'
    }),
    incentiveType: Joi.string().valid('PRODUCT', 'QUANTITY', 'PERCENTAGE', 'PER_UNIT', 'NONE').default('NONE'),
    incentiveValue: Joi.number().min(0).default(0)
  })
};

export const queryImportantDatesSchema = {
  query: Joi.object({
    search: Joi.string().trim().optional().allow('', null),
    celebrationTypes: stringOrArray.optional(), // e.g. ["Birthday", "Work Anniversary", "Marriage Anniversary"]
    designation: Joi.string().trim().optional().allow('', null),
    state: Joi.string().trim().optional().allow('', null),
    branchId: Joi.string().hex().length(24).optional().allow('', null),
    branchIds: stringOrArray.optional(),
    date: Joi.date().iso().optional(),
    month: Joi.number().integer().min(1).max(12).optional()
  })
};

export const queryEmployeeBreakdownSchema = {
  query: Joi.object({
    search: Joi.string().trim().optional().allow('', null),
    employeeId: Joi.string().trim().optional().allow('', null),
    employeeCode: Joi.string().trim().optional().allow('', null),
    branchId: Joi.string().hex().length(24).optional().allow('', null),
    branchIds: stringOrArray.optional(),
    status: Joi.string().trim().optional().allow('', null),
    department: stringOrArray.optional(),
    designations: stringOrArray.optional(),
    states: stringOrArray.optional(),
    sortBy: Joi.string().trim().default('createdAt'),
    sortOrder: Joi.string().trim().valid('asc', 'desc', 'ASC', 'DESC').default('desc')
  })
};

export const queryLetterHistorySchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().optional().allow('', null),
    employeeId: Joi.string().trim().optional().allow('', null),
    id: Joi.string().trim().optional().allow('', null),
    branchId: Joi.string().trim().optional().allow('', null),
    branch: Joi.string().trim().optional().allow('', null),
    branchIds: stringOrArray.optional(),
    city: stringOrArray.optional(),
    state: stringOrArray.optional(),
    documentType: Joi.string().trim().optional().allow('', null),
    documentTypeCode: Joi.string().trim().optional().allow('', null),
    type: Joi.string().trim().optional().allow('', null),
    sortBy: Joi.string().trim().default('issuedDate'),
    sortOrder: Joi.string().trim().valid('asc', 'desc', 'ASC', 'DESC').default('desc')
  })
};

export const sendLetterEmailSchema = {
  body: Joi.object({
    logId: Joi.string().hex().length(24).optional().allow('', null),
    employeeId: Joi.string().hex().length(24).optional().allow('', null),
    documentTypeCode: Joi.string().trim().valid(
      'OFFER_LETTER',
      'CONFIRMATION_LETTER',
      'PERFORMANCE_LETTER',
      'PROMOTION_LETTER',
      'TRANSFER_LETTER',
      'SALARY_SLIP',
      'INCREMENT_LETTER',
      'SALARY_INCREMENT',
      'TERMINATION_LETTER'
    ).optional(),
    customEmail: Joi.string().email().optional().allow('', null),
    email: Joi.string().email().optional().allow('', null),
    variables: Joi.object().optional().default({})
  })
};