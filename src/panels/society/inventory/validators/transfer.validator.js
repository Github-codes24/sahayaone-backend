import Joi from 'joi';

const mongoId = Joi.string().hex().length(24);

export const createTransferSchema = {
  body: Joi.object({
    fromLocationType: Joi.string().valid('CentralInventory', 'Branch').required(),
    fromLocationId: mongoId.required(),
    toLocationType: Joi.string().valid('CentralInventory', 'Branch').required(),
    toLocationId: mongoId.required(),
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

export const transferListSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    status: Joi.string().valid('PENDING', 'APPROVED', 'DISPATCHED', 'RECEIVED').optional(),
    fromLocationId: mongoId.optional(),
    toLocationId: mongoId.optional(),
    sortBy: Joi.string().valid('createdAt', 'status').default('createdAt'),
    sortOrder: Joi.string().lowercase().valid('asc', 'desc').default('desc')
  })
};

export const transferIdParamSchema = {
  params: Joi.object({
    id: mongoId.required()
  })
};

export const approveRejectTransferSchema = {
  params: Joi.object({
    id: mongoId.required()
  }),
  body: Joi.object({
    remarks: Joi.string().trim().max(500).allow('').optional()
  })
};

export const dispatchTransferSchema = {
  params: Joi.object({
    id: mongoId.required()
  }),
  body: Joi.object({
    assetTagsMapping: Joi.array()
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

export const receiveTransferSchema = {
  params: Joi.object({
    id: mongoId.required()
  }),
  body: Joi.object({
    remarks: Joi.string().trim().max(500).allow('').optional()
  })
};
