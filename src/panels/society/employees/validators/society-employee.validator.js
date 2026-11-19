import Joi from 'joi';
import {
  personalDetailsSchema,
  jobDetailsSchema,
  shiftSettingsSchema,
  attendanceSettingsSchema,
  woffHoffSettingsSchema,
  kraSettingsSchema
} from '../../branches/validators/branch.validator.js';

export const createEmployeeSchema = Joi.object({
  personalDetails: personalDetailsSchema.keys({
    password: Joi.string().min(6).optional()
  }).optional(),

  jobDetails: jobDetailsSchema.keys({
    roleId: Joi.string().hex().length(24).optional(),
    branchId: Joi.string().hex().length(24).optional()
  }).optional(),

  shiftSettings: shiftSettingsSchema.optional(),
  attendanceSettings: attendanceSettingsSchema.optional(),
  woffHoffSettings: woffHoffSettingsSchema.optional(),
  kraSettings: kraSettingsSchema.optional(),

  // Fallback flat / root parameters
  fullName: Joi.string().trim().optional(),
  firstName: Joi.string().trim().optional().allow('', null),
  lastName: Joi.string().trim().optional().allow('', null),
  email: Joi.string().email().trim().lowercase().optional(),
  phoneNumber: Joi.string().trim().optional(),
  password: Joi.string().min(6).optional(),
  roleId: Joi.string().hex().length(24).optional(),
  branchId: Joi.string().hex().length(24).optional(),
  employeeCode: Joi.string().trim().optional().allow('', null),
  gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER').optional(),
  dob: Joi.date().iso().optional().allow(null),
  dateOfBirth: Joi.date().iso().optional().allow(null),
  profileImage: Joi.string().trim().optional().allow('', null),
  dutyHours: Joi.string().trim().optional().allow('', null),
  weeklyOff: Joi.string().trim().optional().allow('', null),
  bloodGroup: Joi.string().trim().optional().allow('', null),
  validity: Joi.date().iso().optional().allow(null),
  officeAddress: Joi.string().trim().optional().allow('', null),
  address: Joi.string().trim().optional().allow('', null),
  state: Joi.string().trim().optional().allow('', null),
  designation: Joi.string().trim().optional().allow('', null),
  department: Joi.string().trim().optional().allow('', null),
  salary: Joi.number().min(0).optional(),
  joiningDate: Joi.date().iso().optional().allow(null)
});

export const updateEmployeeSchema = Joi.object({
  fullName: Joi.string().trim().optional(),
  firstName: Joi.string().trim().optional().allow('', null),
  lastName: Joi.string().trim().optional().allow('', null),
  email: Joi.string().email().trim().lowercase().optional(),
  phoneNumber: Joi.string().trim().optional(),
  password: Joi.string().min(6).optional().allow('', null),
  roleId: Joi.string().hex().length(24).optional(),
  branchId: Joi.string().hex().length(24).optional(),
  employeeCode: Joi.string().trim().optional().allow('', null),
  status: Joi.string().valid('ACTIVE', 'INACTIVE').optional(),
  gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER').optional(),
  dob: Joi.date().iso().optional().allow(null),
  dateOfBirth: Joi.date().iso().optional().allow(null),
  profileImage: Joi.string().trim().optional().allow('', null),
  dutyHours: Joi.string().trim().optional().allow('', null),
  weeklyOff: Joi.string().trim().optional().allow('', null),
  bloodGroup: Joi.string().trim().optional().allow('', null),
  validity: Joi.date().iso().optional().allow(null),
  officeAddress: Joi.string().trim().optional().allow('', null),
  address: Joi.string().trim().optional().allow('', null),
  state: Joi.string().trim().optional().allow('', null),
  designation: Joi.string().trim().optional().allow('', null),
  department: Joi.string().trim().optional().allow('', null),
  salary: Joi.number().min(0).optional(),
  joiningDate: Joi.date().iso().optional().allow(null),
  personalDetails: personalDetailsSchema.optional(),
  jobDetails: jobDetailsSchema.optional(),
  shiftSettings: shiftSettingsSchema.optional(),
  attendanceSettings: attendanceSettingsSchema.optional(),
  woffHoffSettings: woffHoffSettingsSchema.optional(),
  kraSettings: kraSettingsSchema.optional()
});

export const employeeQuerySchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().optional().allow(''),
    id: Joi.string().trim().optional().allow(''),
    employeeId: Joi.string().trim().optional().allow(''),
    employeeCode: Joi.string().trim().optional().allow(''),
    empId: Joi.string().trim().optional().allow(''),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'ALL', 'DELETED', 'active', 'inactive', 'all', 'deleted').optional().allow(''),
    branchId: Joi.string().hex().length(24).optional().allow(''),
    roleId: Joi.alternatives().try(
      Joi.string().hex().length(24).allow(''),
      Joi.string().trim().allow(''),
      Joi.array().items(Joi.string().trim())
    ).optional(),
    roleCode: Joi.string().trim().optional().allow(''),
    role: Joi.string().trim().optional().allow(''),
    roles: Joi.alternatives().try(
      Joi.string().trim().allow(''),
      Joi.array().items(Joi.string().trim())
    ).optional(),
    state: Joi.alternatives().try(Joi.string().trim().allow(''), Joi.array().items(Joi.string().trim())).optional(),
    city: Joi.alternatives().try(Joi.string().trim().allow(''), Joi.array().items(Joi.string().trim())).optional(),
    includeBranchManagers: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false', '1', '0')).optional().default(true),
    includeDeleted: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false', '1', '0')).optional().default(false),
    isDeleted: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false', '1', '0')).optional(),
    includeStats: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false', '1', '0')).optional().default(true),
    stats: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false', '1', '0')).optional(),
    sortBy: Joi.string().trim().optional().default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc', 'ASC', 'DESC').optional().default('desc')
  })
};

export const changeRoleSchema = Joi.object({
  roleId: Joi.string().hex().length(24).required().messages({
    'any.required': 'Target role ID is required.'
  })
});

export const changeBranchSchema = Joi.object({
  branchId: Joi.string().hex().length(24).required().messages({
    'any.required': 'Target branch ID is required.'
  })
});

export const updatePersonalDetailsSchema = personalDetailsSchema.keys({
  password: Joi.string().min(6).optional().allow('', null)
});
export const updateJobDetailsSchema = jobDetailsSchema.keys({
  roleId: Joi.string().hex().length(24).optional(),
  branchId: Joi.string().hex().length(24).optional()
});
export const updateShiftSettingsSchema = shiftSettingsSchema;
export const updateAttendanceSettingsSchema = attendanceSettingsSchema;
export const updateWoffHoffSettingsSchema = woffHoffSettingsSchema;
export const updateKraSettingsSchema = kraSettingsSchema;
