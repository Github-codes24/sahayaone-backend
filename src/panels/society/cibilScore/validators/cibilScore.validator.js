import Joi from 'joi';

const parseDate = (value, helpers) => {
    if (value instanceof Date && !isNaN(value.getTime())) {
        return value;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (dmyMatch) {
            const day = parseInt(dmyMatch[1], 10);
            const month = parseInt(dmyMatch[2], 10) - 1;
            const year = parseInt(dmyMatch[3], 10);
            const date = new Date(year, month, day);
            if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
                return date;
            }
        }
        const date = new Date(trimmed);
        if (!isNaN(date.getTime())) {
            return date;
        }
    }
    return helpers.error('date.base');
};

export const checkCibilScoreSchema = {
    body: Joi.object({
        fullName: Joi.string().trim().required().messages({
            'string.empty': 'Full name is required.'
        }),
        dob: Joi.any().custom(parseDate).required().messages({
            'any.required': 'Date of birth is required.',
            'date.base': 'dob must be a valid date (accepted formats: DD/MM/YYYY, YYYY-MM-DD).'
        }),
        pan: Joi.string().trim().uppercase().required().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]$/).messages({
            'string.empty': 'PAN is required.',
            'string.pattern.base': 'Invalid PAN format (Expected: ABCDE1234F)'
        }),
        mobileNumber: Joi.string().trim().required().pattern(/^[6-9]\d{9}$/).messages({
            'string.empty': 'Mobile number is required.',
            'any.required': 'Mobile number is required.',
            'string.pattern.base': 'Invalid mobile number format. Must be a valid 10-digit Indian phone number starting with 6-9.'
        })
    })
};

export const cibilHistoryQuerySchema = {
    query: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(10),
        search: Joi.string().trim().allow('').optional(),
        status: Joi.string().valid('pending', 'processing', 'completed', 'failed').optional(),
        startDate: Joi.date().iso().optional(),
        endDate: Joi.date().iso().optional()
    })
};

export const cibilReportIdSchema = {
    params: Joi.object({
        id: Joi.string().trim().required().messages({
            'string.empty': 'Report ID is required.'
        })
    })
};

