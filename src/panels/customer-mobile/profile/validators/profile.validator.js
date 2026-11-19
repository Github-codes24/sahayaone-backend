import Joi from 'joi';

export const updateProfileSchema = {
  body: Joi.object({
    email: Joi.string().email().optional().trim().lowercase()
  }).unknown(true)
};
