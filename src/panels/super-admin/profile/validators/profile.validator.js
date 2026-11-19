import Joi from 'joi';

export const updateProfileSchema = {
  body: Joi.object({
    name: Joi.string().trim().optional(),
    fullName: Joi.string().trim().optional(),
    email: Joi.string().email().lowercase().trim().optional(),
    phone: Joi.string().trim().optional(),
    phoneNumber: Joi.string().trim().optional(),
    avatar: Joi.string().allow('', null).optional(),
    profileImage: Joi.string().allow('', null).optional()
  })
};

export const changePasswordSchema = {
  body: Joi.object({
    currentPassword: Joi.string().optional(),
    oldPassword: Joi.string().optional(),
    newPassword: Joi.string().min(6).optional(),
    password: Joi.string().min(6).optional(),
    confirmPassword: Joi.string().optional()
  })
    .or('currentPassword', 'oldPassword')
    .or('newPassword', 'password')
};

export const adminResetUserPasswordSchema = {
  body: Joi.object({
    newPassword: Joi.string().min(6).optional(),
    password: Joi.string().min(6).optional(),
    confirmPassword: Joi.string().optional()
  }).or('newPassword', 'password')
};
