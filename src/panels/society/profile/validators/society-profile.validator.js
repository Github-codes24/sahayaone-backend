import Joi from 'joi';

export const updateSocietyProfileSchema = {
  body: Joi.object({
    fullName: Joi.string().trim().min(2).max(100).optional(),
    name: Joi.string().trim().min(2).max(100).optional(),
    email: Joi.string().email().trim().lowercase().optional(),
    phoneNumber: Joi.string().trim().optional().allow('', null),
    phone: Joi.string().trim().optional().allow('', null),
    avatar: Joi.string().trim().optional().allow('', null),
    profileImage: Joi.string().trim().optional().allow('', null)
  })
};

export const changeSocietyPasswordSchema = {
  body: Joi.object({
    currentPassword: Joi.string().optional(),
    oldPassword: Joi.string().optional(),
    newPassword: Joi.string().min(6).required().messages({
      'string.min': 'New password must be at least 6 characters long.',
      'string.empty': 'New password is required.',
      'any.required': 'New password is required.'
    }),
    confirmPassword: Joi.string().optional().allow('', null)
  }).or('currentPassword', 'oldPassword').messages({
    'object.missing': 'Current password is required.'
  })
};
