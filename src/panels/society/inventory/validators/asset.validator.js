import Joi from 'joi';

const mongoId = Joi.string().hex().length(24);

export const createAssetSchema = {
  body: Joi.object({
    itemMasterId: mongoId.required(),
    assetTag: Joi.string().trim().uppercase().required(),
    serialNumber: Joi.string().trim().allow('').default(''),
    currentLocationType: Joi.string().valid('CentralInventory', 'Branch').default('Branch'),
    currentLocationId: mongoId.optional(),
    branchId: mongoId.optional(),
    centralInventoryId: mongoId.optional(),
    condition: Joi.string().valid('new', 'good', 'fair').default('new'),
    purchasePrice: Joi.number().min(0).optional(),
    purchaseDate: Joi.date().iso().optional(),
    vendorId: mongoId.optional(),
    warrantyStartDate: Joi.date().iso().optional(),
    warrantyEndDate: Joi.date().iso().optional(),
    remarks: Joi.string().trim().max(500).allow('').optional()
  })
};

export const assetListSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    currentLocationType: Joi.string().valid('CentralInventory', 'Branch', 'User').optional(),
    currentLocationId: mongoId.optional(),
    branchId: mongoId.optional(),
    currentEmployeeId: mongoId.optional(),
    itemMasterId: mongoId.optional(),
    status: Joi.string().valid('active', 'in_repair', 'retired', 'lost').optional(),
    condition: Joi.string().valid('new', 'good', 'fair', 'damaged', 'scrapped').optional(),
    search: Joi.string().trim().allow('').default(''),
    sortBy: Joi.string().valid('assetTag', 'serialNumber', 'status', 'condition', 'createdAt').default('createdAt'),
    sortOrder: Joi.string().lowercase().valid('asc', 'desc').default('desc')
  })
};

export const assetIdParamSchema = {
  params: Joi.object({
    id: mongoId.required()
  })
};

export const assignAssetSchema = {
  body: Joi.object({
    assetId: mongoId.required(),
    employeeId: mongoId.required(),
    branchId: mongoId.optional(),
    condition: Joi.string().valid('new', 'good', 'fair').default('good'),
    remarks: Joi.string().trim().max(500).allow('').optional()
  })
};

export const returnAssetSchema = {
  params: Joi.object({
    id: mongoId.required()
  }),
  body: Joi.object({
    condition: Joi.string().valid('new', 'good', 'fair', 'damaged').required(),
    remarks: Joi.string().trim().max(500).allow('').optional()
  })
};

export const reportDamageSchema = {
  params: Joi.object({
    id: mongoId.required()
  }),
  body: Joi.object({
    remarks: Joi.string().trim().max(500).required()
  })
};

export const repairCompleteSchema = {
  params: Joi.object({
    id: mongoId.required()
  }),
  body: Joi.object({
    condition: Joi.string().valid('good', 'fair').default('good'),
    remarks: Joi.string().trim().max(500).allow('').optional()
  })
};

export const requestDisposalSchema = {
  params: Joi.object({
    id: mongoId.required()
  }),
  body: Joi.object({
    remarks: Joi.string().trim().max(500).required()
  })
};

export const approveDisposalSchema = {
  params: Joi.object({
    id: mongoId.required()
  }),
  body: Joi.object({
    remarks: Joi.string().trim().max(500).allow('').optional()
  })
};

export const reportLostSchema = {
  params: Joi.object({
    id: mongoId.required()
  }),
  body: Joi.object({
    remarks: Joi.string().trim().max(500).required()
  })
};

export const recoverAssetSchema = {
  params: Joi.object({
    id: mongoId.required()
  }),
  body: Joi.object({
    condition: Joi.string().valid('good', 'fair', 'damaged').default('good'),
    remarks: Joi.string().trim().max(500).allow('').optional()
  })
};
