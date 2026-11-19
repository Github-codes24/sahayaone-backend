import Joi from 'joi';

const inventoryFields = {
  assets: Joi.string().trim().max(150),
  quantity: Joi.number().integer().min(0)
};

export const createInventorySchema = {
  body: Joi.object({
    assets: inventoryFields.assets.required(),
    quantity: inventoryFields.quantity.required()
  })
};

export const updateInventorySchema = {
  body: Joi.object({
    assets: inventoryFields.assets.optional(),
    quantity: inventoryFields.quantity.optional()
  }).min(1)
};

export const inventoryListSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().allow('').default(''),
    minQuantity: Joi.number().integer().min(0).optional(),
    maxQuantity: Joi.number().integer().min(0).optional(),
    sortBy: Joi.string().valid('assets', 'quantity', 'createdAt').default('createdAt'),
    sortOrder: Joi.string().lowercase().valid('asc', 'desc').default('desc')
  }).custom((value, helpers) => {
    if (value.minQuantity !== undefined && value.maxQuantity !== undefined && value.minQuantity > value.maxQuantity) {
      return helpers.error('any.invalid');
    }
    return value;
  }, 'quantity range validation')
};

export const inventoryIdSchema = {
  params: Joi.object({
    id: Joi.string().hex().length(24).required()
  })
};
