import crypto from 'crypto';

/**
 * Cryptographically generates a secure OTP of custom length and character configuration
 * @param {Number} length - Code length (default: 6)
 * @param {Object} options - Options containing character settings
 */
export function generateOtp(length = 6, options = { numericOnly: true }) {
  const digits = '0123456789';
  const alphanumeric = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const pool = options.numericOnly ? digits : alphanumeric;
  
  let otp = '';
  const poolLength = pool.length;

  for (let i = 0; i < length; i++) {
    // Generate secure random integers to index our pool
    const randomIndex = crypto.randomInt(0, poolLength);
    otp += pool[randomIndex];
  }

  return otp;
}
