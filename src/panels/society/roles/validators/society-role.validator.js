import Joi from "joi";
import { ALL_SOCIETY_PERMISSIONS } from "../../../../constants/society-permission.constant.js";
import { PREDEFINED_ROLE_CODES } from "../../../../constants/society-role.constant.js";

export const createRoleSchema = {
  body: Joi.object({
    code: Joi.string()
      .trim()
      .uppercase()
      .valid(...PREDEFINED_ROLE_CODES)
      .optional()
      .messages({
        "any.only": `Role code must be one of the predefined roles: ${PREDEFINED_ROLE_CODES.join(", ")}`,
      }),
    name: Joi.string().trim().optional(),
    description: Joi.string().trim().optional().allow(""),
    permissions: Joi.array()
      .items(
        Joi.string()
          .valid(...ALL_SOCIETY_PERMISSIONS)
          .messages({
            "any.only": "Invalid or unrecognized permission key.",
          }),
      )
      .optional(),
    status: Joi.string()
      .valid("ACTIVE", "INACTIVE")
      .optional()
      .default("ACTIVE"),
  }),
};

export const updateRoleSchema = {
  body: Joi.object({
    name: Joi.string().trim().optional(),
    code: Joi.string()
      .trim()
      .uppercase()
      .valid(...PREDEFINED_ROLE_CODES)
      .optional(),
    description: Joi.string().trim().optional().allow(""),
    permissions: Joi.array()
      .items(
        Joi.string()
          .valid(...ALL_SOCIETY_PERMISSIONS)
          .messages({
            "any.only": "Invalid or unrecognized permission key.",
          }),
      )
      .optional(),
    status: Joi.string().valid("ACTIVE", "INACTIVE").optional(),
  }),
};

export const roleQuerySchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().optional().allow(""),
    status: Joi.string()
      .valid("ACTIVE", "INACTIVE", "ALL")
      .optional()
      .allow(""),
    sortBy: Joi.string().trim().optional().default("createdAt"),
    sortOrder: Joi.string()
      .valid("asc", "desc", "ASC", "DESC")
      .optional()
      .default("desc"),
  }),
};
