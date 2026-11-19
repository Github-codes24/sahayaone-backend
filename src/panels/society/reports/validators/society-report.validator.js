import Joi from 'joi';

export const REPORT_TYPES = Object.freeze({
  CREDIT_RECEIPTS: 'CREDIT_RECEIPTS',
  DEBIT_RECEIPTS: 'DEBIT_RECEIPTS',
  TRANSFER_CONTRA_RECEIPTS: 'TRANSFER_CONTRA_RECEIPTS',
  CASH_PAYMENTS: 'CASH_PAYMENTS',
  BRANCH_FINANCIAL_SUMMARY: 'BRANCH_FINANCIAL_SUMMARY',
  LEADS_AND_LOANS: 'LEADS_AND_LOANS',
  CIBIL_ASSESSMENT_AUDIT: 'CIBIL_ASSESSMENT_AUDIT',
  ATTENDANCE_SUMMARY: 'ATTENDANCE_SUMMARY',
  STAFF_DIRECTORY: 'STAFF_DIRECTORY',
  DAILY_WORK_REPORT: 'DAILY_WORK_REPORT',
  CARDS_CREDIT_USAGE: 'CARDS_CREDIT_USAGE',
  MERCHANT_SUMMARY: 'MERCHANT_SUMMARY'
});

export const validReportTypes = Object.values(REPORT_TYPES);

export const reportCatalogSchema = {
  query: Joi.object({
    category: Joi.string().trim().optional().allow('')
  })
};

export const getReportSchema = {
  params: Joi.object({
    reportType: Joi.string()
      .uppercase()
      .valid(...validReportTypes)
      .required()
      .messages({
        'any.only': `Invalid report type. Must be one of: ${validReportTypes.join(', ')}`
      })
  }),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(500).default(10),
    search: Joi.string().trim().allow('').default(''),
    status: Joi.string().trim().uppercase().optional().allow(''),
    glHead: Joi.string().trim().optional().allow(''),
    branchId: Joi.string().hex().length(24).optional().allow('', null),
    employeeId: Joi.string().hex().length(24).optional().allow('', null),
    dateFrom: Joi.date().iso().optional().allow('', null),
    dateTo: Joi.date().iso().optional().allow('', null),
    startDate: Joi.date().iso().optional().allow('', null),
    endDate: Joi.date().iso().optional().allow('', null),
    receiptType: Joi.string().trim().uppercase().valid('TRANSFER', 'CONTRA', 'ALL').optional().allow(''),
    city: Joi.string().trim().allow('', null).optional(),
    state: Joi.string().trim().allow('', null).optional(),
    sortBy: Joi.string().trim().default('createdAt'),
    sortOrder: Joi.string().lowercase().valid('asc', 'desc').default('desc')
  })
};

export const exportReportSchema = {
  params: Joi.object({
    reportType: Joi.string()
      .uppercase()
      .valid(...validReportTypes)
      .required()
  }),
  query: Joi.object({
    search: Joi.string().trim().allow('').default(''),
    status: Joi.string().trim().uppercase().optional().allow(''),
    glHead: Joi.string().trim().optional().allow(''),
    branchId: Joi.string().hex().length(24).optional().allow('', null),
    employeeId: Joi.string().hex().length(24).optional().allow('', null),
    dateFrom: Joi.date().iso().optional().allow('', null),
    dateTo: Joi.date().iso().optional().allow('', null),
    startDate: Joi.date().iso().optional().allow('', null),
    endDate: Joi.date().iso().optional().allow('', null),
    receiptType: Joi.string().trim().uppercase().valid('TRANSFER', 'CONTRA', 'ALL').optional().allow(''),
    city: Joi.string().trim().allow('', null).optional(),
    state: Joi.string().trim().allow('', null).optional(),
    format: Joi.string().trim().lowercase().valid('csv', 'pdf').default('csv').optional()
  })
};
