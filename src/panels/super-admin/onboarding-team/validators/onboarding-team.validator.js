import Joi from 'joi';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const listOnboardingTeamSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().allow('').optional(),
    onboardingTeamType: Joi.alternatives().try(
      Joi.string().trim(),
      Joi.array().items(Joi.string().trim())
    ).optional(),
    status: Joi.string().trim().uppercase().valid('ACTIVE', 'INACTIVE', 'BLOCKED').optional(),
    sortBy: Joi.string().trim().optional(),
    sortOrder: Joi.string().trim().valid('asc', 'desc', 'ASC', 'DESC').optional()
  })
};

export const getOnboardingTeamSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      'any.required': 'Onboarding Team Member ID is required',
      'string.pattern.base': 'Invalid Member ID format'
    })
  })
};

export const createOnboardingTeamSchema = {
  body: Joi.object({
    fullName: Joi.string().trim().required().messages({
      'any.required': 'Full Name is required'
    }),
    gender: Joi.string().trim().valid('Male', 'Female', 'Other', 'MALE', 'FEMALE', 'OTHER').default('Male').optional(),
    dob: Joi.string().trim().allow('', null).optional(),
    dateOfBirth: Joi.string().trim().allow('', null).optional(),
    phone: Joi.string().trim().required().messages({
      'any.required': 'Phone number is required'
    }),
    phoneNumber: Joi.string().trim().optional(),
    email: Joi.string().trim().email().required().messages({
      'any.required': 'Email address is required',
      'string.email': 'Must be a valid email'
    }),
    password: Joi.string().trim().min(6).allow('', null).optional(),
    address: Joi.string().trim().allow('', null).optional(),
    onboardingTeamType: Joi.string().trim().valid(
      'Regional OnboardingTeam',
      'Branch OnboardingTeam',
      'Collection OnboardingTeam'
    ).default('Regional OnboardingTeam').optional(),
    salary: Joi.number().min(0).optional(),
    joiningDate: Joi.string().trim().allow('', null).optional(),

    // Shift & Woff
    shiftInTime: Joi.string().trim().optional(),
    shiftOutTime: Joi.string().trim().optional(),
    weeklyOffDays: Joi.array().items(Joi.string()).optional(),
    isWeeklyOffPayable: Joi.boolean().optional(),
    isVariableWeeklyOff: Joi.boolean().optional(),
    isSecondWeeklyOff: Joi.boolean().optional(),

    // Other Details
    lateAllowedMins: Joi.number().optional(),
    earlyAllowedMins: Joi.number().optional(),
    halfDayMins: Joi.number().optional(),
    fullDayMins: Joi.number().optional(),

    // Attendance Rules
    shiftType: Joi.string().trim().optional(),
    noOutPunchAction: Joi.string().trim().optional(),
    presentOnWoHolidayAction: Joi.string().trim().optional(),
    lateCutAllowedDays: Joi.number().optional(),
    lateCutAction: Joi.string().trim().optional(),
    isLateCutAllowed: Joi.boolean().optional(),
    isExtraLateCutDeduction: Joi.boolean().optional(),
    isAdditionalLateCutInLeaveBalance: Joi.boolean().optional(),

    // Lunch & Early Going
    lunchAllowedMins: Joi.number().optional(),
    isLunchAllowed: Joi.boolean().optional(),
    isEarlyGoingAllowed: Joi.boolean().optional(),

    // Overtime Rules
    isOvertimeAllowed: Joi.boolean().optional(),
    isCustomOT: Joi.boolean().optional(),
    isBeforeOT: Joi.boolean().optional(),
    otGracePeriodMins: Joi.number().optional(),
    ot1DayHrs: Joi.number().optional(),
    isOTAsPerShift: Joi.boolean().optional(),
    isConsiderOTAsCOFF: Joi.boolean().optional(),

    // Sandwich Rules
    sandwichWeeklyOff: Joi.object().optional(),
    sandwichHolidays: Joi.object().optional(),
    leaveBetweenHolidayOrWO: Joi.object().optional(),

    // Section Objects
    personalDetails: Joi.object().optional(),
    jobDetails: Joi.object().optional(),
    shiftAndWoff: Joi.object().optional(),
    otherDetails: Joi.object().optional(),
    attendance: Joi.object().optional(),
    lunchAndEarlyGoing: Joi.object().optional(),
    overtime: Joi.object().optional(),
    woffAndHoff: Joi.object().optional(),

    status: Joi.string().trim().uppercase().valid('ACTIVE', 'INACTIVE', 'BLOCKED').default('ACTIVE').optional()
  })
};

export const updateOnboardingTeamSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      'any.required': 'Onboarding Team Member ID is required',
      'string.pattern.base': 'Invalid Member ID format'
    })
  }),
  body: Joi.object({
    fullName: Joi.string().trim().optional(),
    gender: Joi.string().trim().optional(),
    dob: Joi.string().trim().allow('', null).optional(),
    dateOfBirth: Joi.string().trim().allow('', null).optional(),
    phone: Joi.string().trim().optional(),
    phoneNumber: Joi.string().trim().optional(),
    email: Joi.string().trim().email().optional(),
    password: Joi.string().trim().min(6).allow('', null).optional(),
    address: Joi.string().trim().allow('', null).optional(),
    onboardingTeamType: Joi.string().trim().optional(),
    salary: Joi.number().min(0).optional(),
    joiningDate: Joi.string().trim().allow('', null).optional(),

    // Shift & Woff
    shiftInTime: Joi.string().trim().optional(),
    shiftOutTime: Joi.string().trim().optional(),
    weeklyOffDays: Joi.array().items(Joi.string()).optional(),
    isWeeklyOffPayable: Joi.boolean().optional(),
    isVariableWeeklyOff: Joi.boolean().optional(),
    isSecondWeeklyOff: Joi.boolean().optional(),

    // Other Details
    lateAllowedMins: Joi.number().optional(),
    earlyAllowedMins: Joi.number().optional(),
    halfDayMins: Joi.number().optional(),
    fullDayMins: Joi.number().optional(),

    // Attendance Rules
    shiftType: Joi.string().trim().optional(),
    noOutPunchAction: Joi.string().trim().optional(),
    presentOnWoHolidayAction: Joi.string().trim().optional(),
    lateCutAllowedDays: Joi.number().optional(),
    lateCutAction: Joi.string().trim().optional(),
    isLateCutAllowed: Joi.boolean().optional(),
    isExtraLateCutDeduction: Joi.boolean().optional(),
    isAdditionalLateCutInLeaveBalance: Joi.boolean().optional(),

    // Lunch & Early Going
    lunchAllowedMins: Joi.number().optional(),
    isLunchAllowed: Joi.boolean().optional(),
    isEarlyGoingAllowed: Joi.boolean().optional(),

    // Overtime Rules
    isOvertimeAllowed: Joi.boolean().optional(),
    isCustomOT: Joi.boolean().optional(),
    isBeforeOT: Joi.boolean().optional(),
    otGracePeriodMins: Joi.number().optional(),
    ot1DayHrs: Joi.number().optional(),
    isOTAsPerShift: Joi.boolean().optional(),
    isConsiderOTAsCOFF: Joi.boolean().optional(),

    // Sandwich Rules
    sandwichWeeklyOff: Joi.object().optional(),
    sandwichHolidays: Joi.object().optional(),
    leaveBetweenHolidayOrWO: Joi.object().optional(),

    // Section Objects
    personalDetails: Joi.object().optional(),
    jobDetails: Joi.object().optional(),
    shiftAndWoff: Joi.object().optional(),
    otherDetails: Joi.object().optional(),
    attendance: Joi.object().optional(),
    lunchAndEarlyGoing: Joi.object().optional(),
    overtime: Joi.object().optional(),
    woffAndHoff: Joi.object().optional(),

    status: Joi.string().trim().uppercase().valid('ACTIVE', 'INACTIVE', 'BLOCKED').optional()
  })
};
