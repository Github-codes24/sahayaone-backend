import Joi from 'joi';

const mongoId = Joi.string().hex().length(24);

export const centralInventoryIdSchema = {
  params: Joi.object({
    id: mongoId.required()
  })
};

export const createCentralInventorySchema = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(150).required(),
    code: Joi.string().trim().uppercase().min(2).max(50).required(),
    address: Joi.string().trim().max(500).allow('').optional(),
    managerId: mongoId.required()
  })
};

export const updateCentralInventorySchema = {
  params: Joi.object({
    id: mongoId.required()
  }),
  body: Joi.object({
    name: Joi.string().trim().min(2).max(150).optional(),
    code: Joi.string().trim().uppercase().min(2).max(50).optional(),
    address: Joi.string().trim().max(500).allow('').optional(),
    managerId: mongoId.optional(),
    status: Joi.string().valid('active', 'inactive').optional()
  }).min(1)
};


export const centralInventoryListSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().allow('').default(''),
    status: Joi.string().valid('active', 'inactive').optional(),
    sortBy: Joi.string().valid('name', 'code', 'createdAt').default('createdAt'),
    sortOrder: Joi.string().lowercase().valid('asc', 'desc').default('desc')
  })
};

export const receiveStockSchema = {
  body: Joi.object({
    centralInventoryId: mongoId.required(),
    itemMasterId: mongoId.required(),
    quantity: Joi.number().integer().min(1).required(),
    vendorId: mongoId.allow(null).optional(),
    assetTags: Joi.array().items(Joi.string().trim().uppercase().required()).optional(),
    serialNumbers: Joi.array().items(Joi.string().trim().required()).optional(),
    remarks: Joi.string().trim().max(500).allow('').optional()
  })
};
