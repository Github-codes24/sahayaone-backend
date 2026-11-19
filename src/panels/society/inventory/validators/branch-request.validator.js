import Joi from 'joi';

const mongoId = Joi.string().hex().length(24);

export const createBranchRequestSchema = {
  body: Joi.object({
    branchId: mongoId.optional(),
    remarks: Joi.string().trim().max(500).allow('').default(''),
    items: Joi.array()
      .items(
        Joi.object({
          itemMasterId: mongoId.required(),
          quantity: Joi.number().integer().min(1).required()
        })
      )
      .min(1)
      .required()
  })
};

export const branchRequestListSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    status: Joi.string().valid('PENDING', 'APPROVED', 'REJECTED', 'FULFILLED', 'CANCELLED').optional(),
    branchId: mongoId.optional(),
    employeeId: mongoId.optional(),
    sortBy: Joi.string().valid('createdAt', 'status').default('createdAt'),
    sortOrder: Joi.string().lowercase().valid('asc', 'desc').default('desc')
  })
};

export const branchRequestIdParamSchema = {
  params: Joi.object({
    id: mongoId.required()
  })
};

export const approveRejectRequestSchema = {
  params: Joi.object({
    id: mongoId.required()
  }),
  body: Joi.object({
    remarks: Joi.string().trim().max(500).allow('').optional()
  })
};

export const cancelBranchRequestSchema = {
  params: Joi.object({
    id: mongoId.required()
  }),
  body: Joi.object({
    remarks: Joi.string().trim().max(500).allow('').optional()
  })
};

export const fulfillRequestSchema = {
  params: Joi.object({
    id: mongoId.required()
  }),
  body: Joi.object({
    assetTagMapping: Joi.array()
      .items(
        Joi.object({
          itemMasterId: mongoId.required(),
          assetTags: Joi.array().items(Joi.string().trim().uppercase().required()).min(1).required()
        })
      )
      .optional(),
    remarks: Joi.string().trim().max(500).allow('').optional()
  })
};

export const directIssueSchema = {
  body: Joi.object({
    branchId: mongoId.optional(),
    employeeId: mongoId.required(),
    itemMasterId: mongoId.required(),
    quantity: Joi.number().integer().min(1).required(),
    assetTags: Joi.array().items(Joi.string().trim().uppercase().required()).optional(),
    remarks: Joi.string().trim().max(500).allow('').optional()
  })
};
