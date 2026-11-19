import Joi from 'joi';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const listNotificationsSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    type: Joi.string().trim().uppercase().valid('NEW_LEAD', 'LOAN_OVERDUE', 'LOAN_DUE_DATE', 'GENERAL', 'ALERT').optional(),
    isRead: Joi.boolean().optional(),
    sortBy: Joi.string().trim().optional(),
    sortOrder: Joi.string().trim().valid('asc', 'desc', 'ASC', 'DESC').optional()
  })
};

export const markAsReadSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      'any.required': 'Notification ID is required',
      'string.pattern.base': 'Invalid Notification ID format'
    })
  })
};

export const createNotificationSchema = {
  body: Joi.object({
    title: Joi.string().trim().required().messages({
      'any.required': 'Notification title is required'
    }),
    description: Joi.string().trim().required().messages({
      'any.required': 'Notification description is required'
    }),
    type: Joi.string().trim().uppercase().valid('NEW_LEAD', 'LOAN_OVERDUE', 'LOAN_DUE_DATE', 'GENERAL', 'ALERT').default('GENERAL').optional(),
    targetRole: Joi.string().trim().uppercase().valid('SUPER_ADMIN', 'SUB_ADMIN', 'HO_ADMIN', 'EMPLOYEE', 'CUSTOMER', 'VENDOR', 'ALL').default('SUPER_ADMIN').optional(),
    actionText: Joi.string().trim().default('Check Now').optional(),
    actionUrl: Joi.string().trim().optional(),
    icon: Joi.string().trim().optional(),
    iconColor: Joi.string().trim().optional()
  })
};
