/**
 * Universal Indian Timezone (IST - Asia/Kolkata, UTC+05:30) Date Utility
 * Ensures consistent date and time handling, formatting, and querying across all environments.
 */

export const INDIAN_TIMEZONE = process.env.TIMEZONE || process.env.TZ || 'Asia/Kolkata';

// Formatter for YYYY-MM-DD in IST (using en-CA locale which outputs ISO date format)
const istDateStringFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: INDIAN_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

// Formatter for 12-Hour format in IST (e.g., "09:30 AM")
const istTime12HFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: INDIAN_TIMEZONE,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true
});

// Formatter for 24-Hour format in IST (e.g., "09:30", "18:45")
const istTime24HFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: INDIAN_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

// Formatter for Indian Date format DD/MM/YYYY
const istDateIndianFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: INDIAN_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
});

// Formatter for Indian Date & Time format DD/MM/YYYY, hh:mm AM/PM
const istDateTimeIndianFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: INDIAN_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true
});

/**
 * Formats any date into YYYY-MM-DD string in Indian Standard Time (Asia/Kolkata)
 * @param {Date|string|number} [date=new Date()]
 * @returns {string} e.g. "2026-09-07"
 */
export const formatDateString = (date = new Date()) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return istDateStringFormatter.format(d);
};

/**
 * Formats any date into 12-Hour AM/PM string in Indian Standard Time (Asia/Kolkata)
 * @param {Date|string|number} date
 * @returns {string|null} e.g. "09:30 AM" or null if invalid
 */
export const formatTime12H = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return istTime12HFormatter.format(d);
};

/**
 * Formats any date into 24-Hour HH:mm string in Indian Standard Time (Asia/Kolkata)
 * @param {Date|string|number} date
 * @returns {string|null} e.g. "09:30", "18:45"
 */
export const formatTime24H = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return istTime24HFormatter.format(d);
};

/**
 * Formats any date into DD/MM/YYYY string in Indian Standard Time (Asia/Kolkata)
 * @param {Date|string|number} [date=new Date()]
 * @returns {string} e.g. "07/09/2026"
 */
export const formatDateIndian = (date = new Date()) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return istDateIndianFormatter.format(d);
};

/**
 * Formats any date into DD/MM/YYYY, hh:mm AM/PM in Indian Standard Time (Asia/Kolkata)
 * @param {Date|string|number} [date=new Date()]
 * @returns {string} e.g. "07/09/2026, 9:30 AM"
 */
export const formatDateTimeIndian = (date = new Date()) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return istDateTimeIndianFormatter.format(d);
};

/**
 * Returns exact start (00:00:00.000 IST) and end (23:59:59.999 IST) Date objects
 * for MongoDB queries targeting a specific day in Indian Standard Time.
 * @param {Date|string|number} [dateInput=new Date()]
 * @returns {{ start: Date, end: Date, dateString: string }}
 */
export const getISTDayRange = (dateInput = new Date()) => {
  const dateStr = formatDateString(dateInput);
  const start = new Date(`${dateStr}T00:00:00.000+05:30`);
  const end = new Date(`${dateStr}T23:59:59.999+05:30`);
  return { start, end, dateString: dateStr };
};

/**
 * Returns exact start and end Date objects for an entire month in IST
 * @param {Date|string|number} [dateInput=new Date()]
 * @returns {{ start: Date, end: Date, monthString: string }}
 */
export const getISTMonthRange = (dateInput = new Date()) => {
  const dateStr = formatDateString(dateInput);
  const [year, month] = dateStr.split('-');
  const start = new Date(`${year}-${month}-01T00:00:00.000+05:30`);
  
  // Calculate next month in IST
  const nextMonthYear = Number(month) === 12 ? Number(year) + 1 : Number(year);
  const nextMonthNum = Number(month) === 12 ? 1 : Number(month) + 1;
  const nextMonthStr = String(nextMonthNum).padStart(2, '0');
  const end = new Date(new Date(`${nextMonthYear}-${nextMonthStr}-01T00:00:00.000+05:30`).getTime() - 1);

  return { start, end, monthString: `${year}-${month}` };
};

/**
 * Returns exact start and end Date objects for an entire year in IST
 * @param {Date|string|number} [dateInput=new Date()]
 * @returns {{ start: Date, end: Date, yearString: string }}
 */
export const getISTYearRange = (dateInput = new Date()) => {
  const dateStr = formatDateString(dateInput);
  const [year] = dateStr.split('-');
  const start = new Date(`${year}-01-01T00:00:00.000+05:30`);
  const end = new Date(`${Number(year) + 1}-01-01T00:00:00.000+05:30`);
  return { start, end: new Date(end.getTime() - 1), yearString: year };
};

/**
 * Backward compatibility object for legacy imports (e.g. auth services)
 */
export const dateUtil = {
  now: () => new Date(),

  addMinutes: (date, minutes) => {
    return new Date(date.getTime() + minutes * 60000);
  },

  isExpired: (expiryDate) => {
    return new Date() > new Date(expiryDate);
  },

  toISOString: (date) => {
    if (!date) return null;
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d.toISOString();
  },

  formatDateString,
  formatTime12H,
  formatTime24H,
  formatDateIndian,
  formatDateTimeIndian,
  getISTDayRange,
  getISTMonthRange,
  getISTYearRange,
  INDIAN_TIMEZONE
};

export default dateUtil;

