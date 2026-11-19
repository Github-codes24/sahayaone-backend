import Joi from 'joi';

const editableFields = {
  name: Joi.string().trim().max(150),
  glHead: Joi.string().trim().max(50),
  glHeadName: Joi.string().trim().max(150),
  accountNumber: Joi.string().trim().max(50),
  amount: Joi.number().min(0).optional().default(0),
  date: Joi.date().iso(),
  status: Joi.string().uppercase().valid('NEW', 'PENDING', 'APPROVED', 'REJECTED'),
  image: Joi.string().trim().allow('', null).optional(),
  branchId: Joi.string().hex().length(24).optional().allow('', null)
};

export const createReceiptSchema = {
  body: Joi.object({
    name: editableFields.name.required(),
    glHead: editableFields.glHead.required(),
    glHeadName: editableFields.glHeadName.required(),
    accountNumber: editableFields.accountNumber.required(),
    amount: editableFields.amount,
    date: editableFields.date.required(),
    status: editableFields.status.optional().default('PENDING'),
    image: editableFields.image,
    branchId: editableFields.branchId
  })
};


export const updateReceiptSchema = {
  body: Joi.object({
    name: editableFields.name.optional(),
    glHead: editableFields.glHead.optional(),
    glHeadName: editableFields.glHeadName.optional(),
    accountNumber: editableFields.accountNumber.optional(),
    amount: editableFields.amount,
    date: editableFields.date.optional(),
    image: editableFields.image,
    branchId: editableFields.branchId
  })
};

export const rejectReceiptSchema = {
  params: Joi.object({
    id: Joi.string().hex().length(24).required()
  }),
  body: Joi.object({
    rejectionReason: Joi.string().trim().optional(),
    reason: Joi.string().trim().optional(),
    remarks: Joi.string().trim().optional()
  }).or('rejectionReason', 'reason', 'remarks').messages({
    'object.missing': 'Rejection reason is required when rejecting a receipt.'
  })
};



export const receiptListSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().allow('').default(''),
    status: Joi.string().uppercase().valid('NEW', 'PENDING', 'APPROVED', 'REJECTED').optional(),

    branchId: Joi.string().hex().length(24).optional().allow(''),
    dateFrom: Joi.date().iso().optional().allow('', null),
    dateTo: Joi.date().iso().optional().allow('', null),
    startDate: Joi.date().iso().optional().allow('', null),
    endDate: Joi.date().iso().optional().allow('', null),
    city: Joi.string().trim().allow('', null).optional(),
    state: Joi.string().trim().allow('', null).optional(),
    sortBy: Joi.string().valid('receiptNo', 'name', 'glHead', 'glHeadName', 'accountNumber', 'amount', 'date', 'status', 'createdAt').default('createdAt'),
    sortOrder: Joi.string().lowercase().valid('asc', 'desc').default('desc')
  })
};


export const receiptIdSchema = {
  params: Joi.object({
    id: Joi.string().hex().length(24).required()
  })
};
