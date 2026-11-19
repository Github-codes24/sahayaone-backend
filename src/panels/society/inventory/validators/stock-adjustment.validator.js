import Joi from 'joi';

const mongoId = Joi.string().hex().length(24);

export const createStockAdjustmentSchema = {
  body: Joi.object({
    branchId: mongoId.optional(),
    itemMasterId: mongoId.required(),
    assetId: mongoId.allow(null).optional(),
    locationType: Joi.string().valid('CentralInventory', 'Branch').default('Branch'),
    locationId: mongoId.optional(),
    adjustmentType: Joi.string().valid('INCREASE', 'DECREASE').required(),
    quantity: Joi.number().integer().min(1).required(),
    reason: Joi.string().valid('DAMAGE', 'LOST', 'AUDIT_DISCREPANCY', 'RECOVERY', 'EXPIRED').required(),
    remarks: Joi.string().trim().max(500).allow('').optional()
  })
};

export const stockAdjustmentListSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    branchId: mongoId.optional(),
    status: Joi.string().valid('PENDING', 'APPROVED', 'REJECTED').optional(),
    reason: Joi.string().valid('DAMAGE', 'LOST', 'AUDIT_DISCREPANCY', 'RECOVERY', 'EXPIRED').optional(),
    adjustmentType: Joi.string().valid('INCREASE', 'DECREASE').optional(),
    sortBy: Joi.string().valid('createdAt', 'status', 'quantity').default('createdAt'),
    sortOrder: Joi.string().lowercase().valid('asc', 'desc').default('desc')
  })
};

export const stockAdjustmentIdParamSchema = {
  params: Joi.object({
    id: mongoId.required()
  })
};

export const approveRejectAdjustmentSchema = {
  params: Joi.object({
    id: mongoId.required()
  }),
  body: Joi.object({
    remarks: Joi.string().trim().max(500).allow('').optional()
  })
};

export const updateStockAdjustmentSchema = {
  params: Joi.object({
    id: mongoId.required()
  }),
  body: Joi.object({
    quantity: Joi.number().integer().min(1).optional(),
    adjustmentType: Joi.string().valid('INCREASE', 'DECREASE').optional(),
    reason: Joi.string().valid('DAMAGE', 'LOST', 'AUDIT_DISCREPANCY', 'RECOVERY', 'EXPIRED').optional(),
    assetId: mongoId.allow(null).optional(),
    remarks: Joi.string().trim().max(500).allow('').optional()
  }).min(1)
};

