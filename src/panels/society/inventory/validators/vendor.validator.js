import Joi from 'joi';

const mongoId = Joi.string().hex().length(24);

export const createVendorSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(150).required(),
    code: Joi.string().trim().uppercase().min(2).max(50).required(),
    contactPerson: Joi.string().trim().max(100).allow('').optional(),
    phone: Joi.string().trim().max(20).allow('').optional(),
    email: Joi.string().trim().lowercase().email().allow('').optional(),
    address: Joi.string().trim().max(500).allow('').optional(),
    gstNumber: Joi.string().trim().uppercase().max(25).allow('').optional()
  })
};

export const vendorListSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().allow('').default(''),
    status: Joi.string().valid('active', 'inactive').optional(),
    sortBy: Joi.string().valid('name', 'code', 'createdAt').default('createdAt'),
    sortOrder: Joi.string().lowercase().valid('asc', 'desc').default('desc')
  })
};

export const vendorIdSchema = {
  params: Joi.object({
    id: mongoId.required()
  })
};

export const updateVendorSchema = {
  params: Joi.object({
    id: mongoId.required()
  }),
  body: Joi.object({
    name: Joi.string().trim().min(2).max(150).optional(),
    code: Joi.string().trim().uppercase().min(2).max(50).optional(),
    contactPerson: Joi.string().trim().max(100).allow('').optional(),
    phone: Joi.string().trim().max(20).allow('').optional(),
    email: Joi.string().trim().lowercase().email().allow('').optional(),
    address: Joi.string().trim().max(500).allow('').optional(),
    gstNumber: Joi.string().trim().uppercase().max(25).allow('').optional(),
    status: Joi.string().valid('active', 'inactive').optional()
  }).min(1)
};

