import Joi from 'joi';

const mongoId = Joi.string().hex().length(24);

export const mongoIdParamSchema = {
  params: Joi.object({
    id: mongoId.required()
  })
};

// Category schemas
export const createCategorySchema = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    code: Joi.string().trim().uppercase().min(2).max(30).required(),
    description: Joi.string().trim().max(500).allow('').optional()
  })
};

export const categoryListSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().allow('').default(''),
    status: Joi.string().valid('active', 'inactive').optional(),
    sortBy: Joi.string().valid('name', 'code', 'createdAt').default('createdAt'),
    sortOrder: Joi.string().lowercase().valid('asc', 'desc').default('desc')
  })
};

export const updateCategorySchema = {
  params: Joi.object({
    id: mongoId.required()
  }),
  body: Joi.object({
    name: Joi.string().trim().min(2).max(100).optional(),
    code: Joi.string().trim().uppercase().min(2).max(30).optional(),
    description: Joi.string().trim().max(500).allow('').optional(),
    status: Joi.string().valid('active', 'inactive').optional()
  }).min(1)
};

// Subcategory schemas
export const createSubcategorySchema = {
  body: Joi.object({
    categoryId: mongoId.required(),
    name: Joi.string().trim().min(2).max(100).required(),
    code: Joi.string().trim().uppercase().min(2).max(30).required(),
    description: Joi.string().trim().max(500).allow('').optional()
  })
};

export const updateSubcategorySchema = {
  params: Joi.object({
    id: mongoId.required()
  }),
  body: Joi.object({
    categoryId: mongoId.optional(),
    name: Joi.string().trim().min(2).max(100).optional(),
    code: Joi.string().trim().uppercase().min(2).max(30).optional(),
    description: Joi.string().trim().max(500).allow('').optional(),
    status: Joi.string().valid('active', 'inactive').optional()
  }).min(1)
};

export const subcategoryListSchema = {
  query: Joi.object({
    categoryId: mongoId.optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().allow('').default(''),
    status: Joi.string().valid('active', 'inactive').optional(),
    sortBy: Joi.string().valid('name', 'code', 'createdAt').default('createdAt'),
    sortOrder: Joi.string().lowercase().valid('asc', 'desc').default('desc')
  })
};

// Inventory Item Master (Catalog SKU) schemas
export const createItemSchema = {
  body: Joi.object({
    categoryId: mongoId.required(),
    subcategoryId: mongoId.allow(null).optional(),
    name: Joi.string().trim().min(2).max(150).required(),
    code: Joi.string().trim().uppercase().min(2).max(50).required(),
    unit: Joi.string().trim().min(1).max(20).required(),
    brand: Joi.string().trim().max(100).allow('').optional(),
    model: Joi.string().trim().max(100).allow('').optional(),
    type: Joi.string().trim().max(50).allow('').optional(),
    isSerialized: Joi.boolean().default(false),
    description: Joi.string().trim().max(1000).allow('').optional()
  })
};

export const updateItemSchema = {
  params: Joi.object({
    id: mongoId.required()
  }),
  body: Joi.object({
    categoryId: mongoId.optional(),
    subcategoryId: mongoId.allow(null).optional(),
    name: Joi.string().trim().min(2).max(150).optional(),
    code: Joi.string().trim().uppercase().min(2).max(50).optional(),
    unit: Joi.string().trim().min(1).max(20).optional(),
    brand: Joi.string().trim().max(100).allow('').optional(),
    model: Joi.string().trim().max(100).allow('').optional(),
    type: Joi.string().trim().max(50).allow('').optional(),
    description: Joi.string().trim().max(1000).allow('').optional(),
    status: Joi.string().valid('active', 'inactive').optional()
  }).min(1)
};

export const itemListSchema = {
  query: Joi.object({
    categoryId: mongoId.optional(),
    subcategoryId: mongoId.optional(),
    isSerialized: Joi.boolean().optional(),
    search: Joi.string().trim().allow('').default(''),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    status: Joi.string().valid('active', 'inactive').optional(),
    sortBy: Joi.string().valid('name', 'code', 'createdAt').default('createdAt'),
    sortOrder: Joi.string().lowercase().valid('asc', 'desc').default('desc')
  })
};

