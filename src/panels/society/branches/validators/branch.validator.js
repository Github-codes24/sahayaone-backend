import Joi from "joi";

// Helper Regex
const timeHHMMRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
const dayEnum = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

// Joi Subschemas for HR Sections
export const personalDetailsSchema = Joi.object({
  profileImage: Joi.string().trim().optional().allow("", null),
  profileImageKey: Joi.string().trim().optional().allow("", null),
  fullName: Joi.string().trim().optional(),
  firstName: Joi.string().trim().optional().allow("", null),
  lastName: Joi.string().trim().optional().allow("", null),
  gender: Joi.string().valid("MALE", "FEMALE", "OTHER").optional(),
  dateOfBirth: Joi.date().iso().optional().allow(null),
  dob: Joi.date().iso().optional().allow(null),
  phoneNumber: Joi.string().trim().optional(),
  email: Joi.string().email().trim().lowercase().optional(),
  address: Joi.string().trim().optional().allow(""),
  bloodGroup: Joi.string().trim().optional().allow("", null),
  dutyHours: Joi.string().trim().optional().allow("", null),
  weeklyOff: Joi.string().trim().optional().allow("", null),
  validity: Joi.date().iso().optional().allow(null),
  officeAddress: Joi.string().trim().optional().allow("", null),
  department: Joi.string().trim().optional().allow("", null),
});

export const jobDetailsSchema = Joi.object({
  designation: Joi.string().trim().optional(),
  department: Joi.string().trim().optional().allow("", null),
  state: Joi.string().trim().optional().allow(""),
  salary: Joi.number().min(0).optional(),
  joiningDate: Joi.date().iso().optional(),
  probationPeriodMonths: Joi.number().min(0).optional(),
});

export const shiftSettingsSchema = Joi.object({
  punchInTime: Joi.string().trim().optional().allow("", null),
  punchOutTime: Joi.string().trim().optional().allow("", null),
  weeklyOff: Joi.object({
    day: Joi.string().optional().allow("", null),
    payable: Joi.boolean().optional(),
    variable: Joi.boolean().optional(),
    secondWeeklyOff: Joi.boolean().optional(),
    secondWeeklyOffDay: Joi.string().optional().allow("", null),
  }).optional(),
  weeklyOffDay: Joi.string().optional().allow("", null),
  weeklyOffPayable: Joi.boolean().optional(),
  variableWeeklyOff: Joi.boolean().optional(),
  secondWeeklyOff: Joi.boolean().optional(),
  secondWeeklyOffDay: Joi.string().optional().allow("", null),
  lateAllowedMinutes: Joi.number().min(0).optional(),
  lateAllowed: Joi.number().min(0).optional(),
  lateAllowedAsPerShift: Joi.boolean().optional(),
  lateAsPerShift: Joi.boolean().optional(),
  earlyAllowedMinutes: Joi.number().min(0).optional(),
  earlyAllowed: Joi.number().min(0).optional(),
  earlyAllowedAsPerShift: Joi.boolean().optional(),
  earlyAsPerShift: Joi.boolean().optional(),
  halfDayMinutes: Joi.number().min(0).optional(),
  halfDay: Joi.number().min(0).optional(),
  halfDayAsPerShift: Joi.boolean().optional(),
  fullDayMinutes: Joi.number().min(0).optional(),
  fullDay: Joi.number().min(0).optional(),
  fullDayAsPerShift: Joi.boolean().optional(),
});

export const attendanceSettingsSchema = Joi.object({
  punchType: Joi.string().valid("SINGLE", "DOUBLE", "MULTIPLE").optional(),
  noOutPunchAction: Joi.string()
    .valid("MARK_ABSENT", "MARK_HALF_DAY", "AUTO_OUT_PUNCH", "NO_ACTION")
    .optional(),
  presentOnWeeklyOffHolidayAction: Joi.string()
    .valid("COMP_OFF", "EXTRA_PAY", "REGULAR_ATTENDANCE", "NO_ACTION")
    .optional(),
  lateCut: Joi.object({
    allowedDays: Joi.number().min(0).optional(),
    action: Joi.string().trim().optional(),
    enabled: Joi.boolean().optional(),
    lateCutAllowed: Joi.boolean().optional(),
    extraLateCutDeduction: Joi.boolean().optional(),
    additionalLateCutInLeaveBalance: Joi.boolean().optional(),
  }).optional(),
  lunchAndEarlyGoing: Joi.object({
    lunchAllowedMinutes: Joi.number().min(0).optional(),
    lunchAsPerShift: Joi.boolean().optional(),
    lunchAllowed: Joi.boolean().optional(),
    earlyGoingAllowed: Joi.boolean().optional(),
  }).optional(),
  overtime: Joi.object({
    allowed: Joi.boolean().optional(),
    overtimeAllowed: Joi.boolean().optional(),
    customOT: Joi.boolean().optional(),
    beforeOT: Joi.boolean().optional(),
    gracePeriodMinutes: Joi.number().min(0).optional(),
    oneDayOTHrs: Joi.number().min(0).optional(),
    asPerShift: Joi.boolean().optional(),
    otAsPerShift: Joi.boolean().optional(),
    considerAsCompOff: Joi.boolean().optional(),
    considerOTAsCOFF: Joi.boolean().optional(),
  }).optional(),
});

export const woffHoffSettingsSchema = Joi.object({
  weeklyOffRules: Joi.object({
    absentBefore: Joi.boolean().optional(),
    absentAfter: Joi.boolean().optional(),
    absentBeforeOrAfter: Joi.boolean().optional(),
    addWorkingHours: Joi.boolean().optional(),
    ignoreLateDeductionIfPresent: Joi.boolean().optional(),
    lwp: Joi.boolean().optional(),
  }).optional(),
  holidayRules: Joi.object({
    absentBefore: Joi.boolean().optional(),
    absentAfter: Joi.boolean().optional(),
    absentBeforeAndAfter: Joi.boolean().optional(),
    addWorkingHours: Joi.boolean().optional(),
    ignoreLateDeductionIfPresent: Joi.boolean().optional(),
    lwp: Joi.boolean().optional(),
  }).optional(),
  leaveBridgeRules: Joi.object({
    considerWeeklyOffInLeave: Joi.boolean().optional(),
    considerHolidayInLeave: Joi.boolean().optional(),
    absentWeeklyOffLeaveMarksWeeklyOffAbsent: Joi.boolean().optional(),
    leaveWeeklyOffAbsentMarksWeeklyOffAbsent: Joi.boolean().optional(),
    absentHolidayLeaveMarksHolidayAbsent: Joi.boolean().optional(),
    leaveHolidayAbsentMarksHolidayAbsent: Joi.boolean().optional(),
  }).optional(),
  leaveSettings: Joi.object({
    leaveEncashmentAllowed: Joi.boolean().optional(),
    leaveInCash: Joi.boolean().optional(),
    carryForwardAllowed: Joi.boolean().optional(),
    leaveCarryForward: Joi.boolean().optional(),
  }).optional(),
});

export const kraTargetItemSchema = Joi.object({
  product: Joi.string().trim().optional().allow("", null),
  productName: Joi.string().trim().optional().allow("", null),
  productId: Joi.string().hex().length(24).optional().allow(null, ""),
  targetType: Joi.string()
    .valid("AMOUNT", "COUNT")
    .optional()
    .default("AMOUNT"),
  targetValue: Joi.number().min(0).optional(),
  target: Joi.number().min(0).optional(),
  incentiveType: Joi.string()
    .valid("PRODUCT", "QUANTITY", "PERCENTAGE", "PER_UNIT", "NONE")
    .optional()
    .default("NONE"),
  incentiveValue: Joi.number().min(0).optional().default(0),
});

export const kraSettingsSchema = Joi.object({
  year: Joi.number().integer().min(2000).max(2100).optional(),
  targets: Joi.array().items(kraTargetItemSchema).optional(),
});

// Branch & Manager Creation Schema
const createBranchSchemaBody = Joi.object({
  branch: Joi.object({
    name: Joi.string().trim().required().messages({
      "string.empty": "Branch name is required.",
    }),
    code: Joi.string().trim().uppercase().required().messages({
      "string.empty": "Branch code is required.",
    }),
    email: Joi.string().email().trim().lowercase().optional().allow("", null),
    phoneNumber: Joi.string().trim().optional().allow("", null),
    state: Joi.string().trim().optional().allow("", null),
    address: Joi.object({
      addressLine1: Joi.string().trim().optional().allow(""),
      addressLine2: Joi.string().trim().optional().allow(""),
      city: Joi.string().trim().optional().allow(""),
      state: Joi.string().trim().optional().allow(""),
      district: Joi.string().trim().optional().allow(""),
      pincode: Joi.string().trim().optional().allow(""),
      country: Joi.string().trim().optional().allow(""),
    }).optional(),
    cardStock: Joi.number().min(0).optional().default(0),
    verificationCredits: Joi.number().min(0).optional().default(0),
  }).optional(),

  manager: Joi.object({
    fullName: Joi.string().trim().optional(),
    email: Joi.string().email().trim().lowercase().optional(),
    phoneNumber: Joi.string().trim().optional(),
    password: Joi.string().min(6).optional(),
    employeeCode: Joi.string().trim().optional().allow("", null),
    personalDetails: personalDetailsSchema.optional(),
    jobDetails: jobDetailsSchema.optional(),
    shiftSettings: shiftSettingsSchema.optional(),
    attendanceSettings: attendanceSettingsSchema.optional(),
    woffHoffSettings: woffHoffSettingsSchema.optional(),
    kraSettings: kraSettingsSchema.optional(),
  }).optional(),

  // Fallback flat parameters
  name: Joi.string().trim().optional(),
  code: Joi.string().trim().uppercase().optional(),
  email: Joi.string().email().trim().lowercase().optional().allow("", null),
  phoneNumber: Joi.string().trim().optional().allow("", null),
  state: Joi.string().trim().optional().allow("", null),
  address: Joi.object().optional(),
  cardStock: Joi.number().optional(),
  verificationCredits: Joi.number().optional(),
  managerName: Joi.string().trim().optional(),
  managerEmail: Joi.string().email().trim().lowercase().optional(),
  managerPhone: Joi.string().trim().optional(),
  managerPassword: Joi.string().min(6).optional(),
}).or("branch", "name");

export const createBranchSchema = { body: createBranchSchemaBody };

const updateBranchSchemaBody = Joi.object({
  name: Joi.string().trim().optional(),
  code: Joi.string().trim().uppercase().optional(),
  email: Joi.string().email().trim().lowercase().optional().allow("", null),
  phoneNumber: Joi.string().trim().optional().allow("", null),
  state: Joi.string().trim().optional().allow("", null),
  address: Joi.object().optional(),
  cardStock: Joi.number().min(0).optional(),
  verificationCredits: Joi.number().min(0).optional(),
  status: Joi.string().valid("ACTIVE", "INACTIVE").optional(),
});
export const updateBranchSchema = { body: updateBranchSchemaBody };

const updateBranchManagerSchemaBody = Joi.object({
  fullName: Joi.string().trim().optional(),
  email: Joi.string().email().trim().lowercase().optional(),
  phoneNumber: Joi.string().trim().optional(),
  password: Joi.string().min(6).optional().allow("", null),
  employeeCode: Joi.string().trim().optional().allow("", null),
  status: Joi.string().valid("ACTIVE", "INACTIVE").optional(),
  personalDetails: personalDetailsSchema.optional(),
  jobDetails: jobDetailsSchema.optional(),
  shiftSettings: shiftSettingsSchema.optional(),
  attendanceSettings: attendanceSettingsSchema.optional(),
  woffHoffSettings: woffHoffSettingsSchema.optional(),
  kraSettings: kraSettingsSchema.optional(),
});
export const updateBranchManagerSchema = {
  body: updateBranchManagerSchemaBody,
};

export const updatePersonalDetailsSchema = {
  body: personalDetailsSchema.keys({
    password: Joi.string().min(6).optional().allow("", null),
  }),
};
export const updateJobDetailsSchema = { body: jobDetailsSchema };
export const updateShiftSettingsSchema = { body: shiftSettingsSchema };
export const updateAttendanceSettingsSchema = {
  body: attendanceSettingsSchema,
};
export const updateWoffHoffSettingsSchema = { body: woffHoffSettingsSchema };
export const updateKraSettingsSchema = { body: kraSettingsSchema };

export const branchQuerySchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().optional().allow(""),
    status: Joi.string()
      .valid("ACTIVE", "INACTIVE", "ALL")
      .optional()
      .allow(""),
    state: Joi.string().trim().optional().allow(""),
    city: Joi.string().trim().optional().allow(""),
    sortBy: Joi.string().trim().optional().default("createdAt"),
    sortOrder: Joi.string()
      .valid("asc", "desc", "ASC", "DESC")
      .optional()
      .default("desc"),
  }),
};
