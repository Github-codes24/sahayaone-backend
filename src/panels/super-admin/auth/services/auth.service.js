import { Admin } from '../../../../models/admin.model.js';
import { cryptoUtil } from '../../../../utils/crypto.util.js';
import { jwtUtil } from '../../../../utils/jwt.util.js';
import { generateOtp } from '../../../../utils/otp.util.js';
import { mailer } from '../../../../emails/mailer.util.js';
import { ApiError } from '../../../../common/api.error.js';
import { UserRole } from '../../../../constants/user-role.constant.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';
import { dateUtil } from '../../../../utils/date.util.js';
import { logger } from '../../../../utils/logger.util.js';
import { envConfig } from '../../../../config/env.config.js';
import { UserType } from '../../../../constants/user-role.constant.js';

export class SuperAdminAuthService {
  /**
   * Fetches all active roles allowed to log in via admin panel
   */
  async getRoles() {
    return [
      { name: 'Super Admin', value: 'SUPER_ADMIN' },
      { name: 'Sub Admin', value: 'SUB_ADMIN' }
    ];
  }

  /**
   * Processes authentication query for Super Admin & Sub-Admin portal
   * @param {Object} credentials - { email, password }
   */
  async authenticateAdmin(credentials) {
    const { email, password, role } = credentials;

    // 1. Identify Admin strictly by email
    const admin = await Admin.findOne({ email });

    // 2. Safeguard credentials (generic error to prevent account enumeration)
    if (!admin) {
      throw ApiError.badRequest('Invalid email or password..', ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    // 3. Prevent Customers/Partners/regular Employees from logging in through Admin portal
    const allowedRoles = [UserRole.SUPER_ADMIN, UserRole.SUB_ADMIN];
    if (!allowedRoles.includes(admin.role)) {
      throw ApiError.forbidden('Access Denied. Administrator or Sub-Admin privileges required.', ErrorCode.AUTH_FORBIDDEN);
    }

    // 4. Verify selected role matches admin's actual role
    const selectedRoleNormalized = role?.toUpperCase().replace(/[\s_]+/g, '_');
    const adminRoleNormalized = admin.role?.toUpperCase().replace(/[\s_]+/g, '_');
    
    let isRoleMatched = false;
    if (selectedRoleNormalized === 'SUB_ADMIN' && adminRoleNormalized === 'SUB_ADMIN') {
      isRoleMatched = true;
    } else if ((selectedRoleNormalized === 'ADMIN' || selectedRoleNormalized === 'SUPER_ADMIN') && adminRoleNormalized === 'SUPER_ADMIN') {
      isRoleMatched = true;
    }

    if (!isRoleMatched) {
      throw ApiError.forbidden('Access Denied. Selected role does not match your account profile.', ErrorCode.AUTH_FORBIDDEN);
    }

    // 4. Verify password cryptographically
    const isPasswordValid = await cryptoUtil.compare(password, admin.passwordHash);
    if (!isPasswordValid) {
      throw ApiError.badRequest('Invalid email or password.', ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    // 5. Assert status constraints
    if (admin.status !== 'ACTIVE') {
      throw ApiError.forbidden(`Your account is currently locked or suspended [Status: ${admin.status}].`, ErrorCode.AUTH_SESSION_EXPIRED);
    }

    // 6. Generate dynamic permissions based on role
    const permissions = admin.role === UserRole.SUPER_ADMIN ? ['ALL_PERMISSIONS'] : (admin.permissions || []);

    // 7. Generate Session JWT payloads
    const payload = {
      userId: admin._id,
      email: admin.email,
      role: admin.role,
      userType: UserType.ADMIN,
      permissions
    };

    const accessToken = jwtUtil.signAccess(payload);
    const refreshToken = jwtUtil.signRefresh(payload);

    admin.lastLoginAt = new Date();
    await admin.save();

    return {
      user: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        phoneNumber: admin.phoneNumber,
        role: admin.role,
        userType: UserType.ADMIN,
        status: admin.status,
        permissions,
        avatar: admin.avatar || null
      },
      permissions,
      accessToken,
      refreshToken
    };
  }

  /**
   * Generates and dispatches a dynamic OTP for admin/sub-admin password resets
   * @param {String} email - Recipient email
   * @param {Number} expirationMinutes - Expiration window in minutes
   */
  async sendForgotPasswordOtp(email, expirationMinutes) {
    const admin = await Admin.findOne({ email });

    // Safeguard database
    if (!admin) {
      logger.warn(`FORGOT PWD: Attempted admin reset on non-existent account: ${email}`);
      return { success: true, message: "We've sent a 6-digit verification code to your email if it exists in our system. Please check your inbox." };
    }

    // Generate 6-digit numeric OTP
    const rawOtp = generateOtp(6, { numericOnly: true });
    
    // Hash the OTP before saving to database
    admin.resetOtp = await cryptoUtil.hash(rawOtp);
    admin.resetOtpExpires = dateUtil.addMinutes(new Date(), expirationMinutes);
    admin.resetVerifiedAt = null; // Invalidate any previous verifications
    await admin.save();

    logger.info(`FORGOT PWD: OTP generated for admin ${email} -> [${rawOtp}] valid for ${expirationMinutes} mins.`);

    // Styled HTML mail template
    const htmlTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="cid:sahayaone_logo_cid" alt="Sahayaone Logo" style="max-width: 150px; height: auto;" />
        </div>
        <h2 style="color: #2b6cb0; text-align: center;">Admin Password Reset Request</h2>
        <p>Hello,</p>
        <p>We received a request to reset your password for your Sahayaone ERP administrator account. Use the following verification OTP code to proceed:</p>
        <div style="background-color: #f7fafc; padding: 15px; text-align: center; border-radius: 4px; margin: 20px 0;">
          <span style="font-size: 28px; font-weight: bold; letter-spacing: 5px; color: #2d3748;">{{otp}}</span>
        </div>
        <p style="color: #718096; font-size: 14px;">This OTP code is valid for <strong>{{expires}} minutes</strong>. Please do not share this code with anyone.</p>
        <p style="margin-top: 30px; font-size: 12px; color: #a0aec0; text-align: center; border-top: 1px solid #edf2f7; padding-top: 20px;">
          &copy; 2026 Sahayaone ERP. This is an automated security notice.
        </p>
      </div>
    `;

    const transparentLogoBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    let mailResult = null;
    let mailError = null;
    try {
      mailResult = await mailer.sendMail({
        to: email,
        subject: 'Admin Password Reset Verification Code - Sahayaone ERP',
        html: htmlTemplate,
        variables: {
          otp: rawOtp,
          expires: expirationMinutes
        },
        attachments: [
          {
            filename: 'logo.png',
            content: transparentLogoBuffer,
            cid: 'sahayaone_logo_cid'
          }
        ]
      });
    } catch (err) {
      mailError = err;
      logger.error(`FORGOT PWD: Email dispatch failed: ${err.message}`);
      
      // In production, we throw the email sending error.
      if (envConfig.nodeEnv !== 'development') {
        throw ApiError.internal('Failed to send verification code. Please contact support.', ErrorCode.EMAIL_SEND_FAILED);
      }
    }

    return {
      success: true,
      message: mailError 
        ? "We've generated a 6-digit verification code. (Email dispatch failed, but you can see the OTP below in development mode)."
        : "We've sent a 6-digit verification code to your email. Please check your inbox (and spam folder) to reset your password.",
      ...(envConfig.nodeEnv === 'development' ? { otp: rawOtp, previewUrl: mailResult?.previewUrl || null } : {})
    };
  }

  /**
   * Verifies reset OTP and stores verification timestamp
   */
  async verifyOtp(email, otp) {
    const admin = await Admin.findOne({ email });
    if (!admin || !admin.resetOtp) {
      throw ApiError.badRequest('Invalid request. Please trigger forgot password first.', ErrorCode.OTP_INVALID);
    }

    if (dateUtil.isExpired(admin.resetOtpExpires)) {
      throw ApiError.badRequest('The verification OTP has expired. Please request a new one.', ErrorCode.OTP_EXPIRED);
    }

    const isOtpValid = await cryptoUtil.compare(otp, admin.resetOtp);
    if (!isOtpValid) {
      throw ApiError.badRequest('The verification OTP is incorrect.', ErrorCode.OTP_INVALID);
    }

    admin.resetVerifiedAt = new Date();
    admin.resetOtp = null;
    admin.resetOtpExpires = null;
    await admin.save();

    logger.info(`FORGOT PWD: OTP successfully verified for admin ${email}`);

    return {
      success: true,
      message: "Code verified successfully! You can now choose your new password."
    };
  }

  /**
   * Resets password strictly if performed within the verification window
   */
  async resetPassword(email, newPassword, resetWindowMinutes) {
    const admin = await Admin.findOne({ email });
    if (!admin || !admin.resetVerifiedAt) {
      throw ApiError.badRequest('Unauthorized access. Validate verification OTP first.', ErrorCode.AUTH_UNAUTHORIZED);
    }

    const minutesElapsed = (new Date() - admin.resetVerifiedAt) / 60000;
    if (minutesElapsed > resetWindowMinutes) {
      admin.resetVerifiedAt = null;
      await admin.save();
      throw ApiError.badRequest('Password reset window expired. Please request a new OTP.', ErrorCode.AUTH_SESSION_EXPIRED);
    }

    admin.passwordHash = await cryptoUtil.hash(newPassword);
    admin.resetVerifiedAt = null;
    await admin.save();

    logger.info(`FORGOT PWD: Password reset complete for admin ${email}`);

    return {
      success: true,
      message: "Your password has been changed successfully! You can now log in using your new password."
    };
  }

  /**
   * Refreshes access and refresh tokens using a valid refresh token signature
   */
  async refreshSession(token) {
    if (!token) {
      throw ApiError.unauthorized('Session expired or invalid token. Please log in again.', ErrorCode.AUTH_SESSION_EXPIRED);
    }

    const decoded = jwtUtil.verifyRefresh(token);
    if (!decoded) {
      throw ApiError.unauthorized('Session expired or invalid token. Please log in again.', ErrorCode.AUTH_SESSION_EXPIRED);
    }

    const admin = await Admin.findById(decoded.userId);
    if (!admin) {
      throw ApiError.unauthorized('Session expired or invalid token. Please log in again.', ErrorCode.AUTH_SESSION_EXPIRED);
    }

    if (admin.status !== 'ACTIVE') {
      throw ApiError.forbidden(`Your account is currently locked or suspended [Status: ${admin.status}].`, ErrorCode.AUTH_SESSION_EXPIRED);
    }

    const permissions = admin.role === UserRole.SUPER_ADMIN ? ['ALL_PERMISSIONS'] : (admin.permissions || []);

    const payload = {
      userId: admin._id,
      email: admin.email,
      role: admin.role,
      userType: UserType.ADMIN,
      permissions
    };

    const accessToken = jwtUtil.signAccess(payload);
    const refreshToken = jwtUtil.signRefresh(payload);

    return {
      accessToken,
      refreshToken
    };
  }
}

export const superAdminAuthService = new SuperAdminAuthService();
