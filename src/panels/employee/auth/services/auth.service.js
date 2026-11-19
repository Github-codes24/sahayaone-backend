import { User } from '../../../../models/user.model.js';
import { cryptoUtil } from '../../../../utils/crypto.util.js';
import { jwtUtil } from '../../../../utils/jwt.util.js';
import { generateOtp } from '../../../../utils/otp.util.js';
import { mailer } from '../../../../emails/mailer.util.js';
import { smsManager } from '../../../../sms/sms.manager.js';
import { ApiError } from '../../../../common/api.error.js';
import { UserRole } from '../../../../constants/user-role.constant.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';
import { dateUtil } from '../../../../utils/date.util.js';
import { logger } from '../../../../utils/logger.util.js';
import { envConfig } from '../../../../config/env.config.js';
import { smsConfig } from '../../../../config/sms.config.js';
import { emailConfig } from '../../../../config/email.config.js';
import { panelControlConfig } from '../../../../config/panel-control.config.js';

export class EmployeeAuthService {
  /**
   * Helper to verify if user has employee permissions
   */
  isEmployee(role) {
    const allowedRoles = [
      UserRole.EMPLOYEE,
      UserRole.BRANCH_MANAGER,
      UserRole.REGIONAL_MANAGER,
      UserRole.HO_ADMIN,
      UserRole.SALES_AGENT,
      UserRole.RECOVERY_AGENT,
      UserRole.COLLECTION_AGENT,
      UserRole.LOAN_EXECUTIVE,
      UserRole.COLLECTION_EXECUTIVE
    ];
    return allowedRoles.includes(role);
  }

  /**
   * Initiates a login session by checking user existence and dispatching a 6-digit verification code for phone logins,
   * or indicating that email users must proceed with a password challenge.
   */
  async loginRequest(loginId) {
    const cleanId = loginId.trim().toLowerCase();
    
    // Find user by email or phone
    const user = await User.findOne({
      $or: [{ email: cleanId }, { phoneNumber: cleanId }]
    });

    if (!user) {
      throw ApiError.notFound('Employee account not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (!this.isEmployee(user.role)) {
      throw ApiError.forbidden('Access Denied. Employee profile permissions required.', ErrorCode.AUTH_FORBIDDEN);
    }

    if (user.status !== 'ACTIVE') {
      throw ApiError.forbidden(`Your account is currently inactive or suspended [Status: ${user.status}].`, ErrorCode.AUTH_SESSION_EXPIRED);
    }

    const isEmail = cleanId.includes('@');
    if (isEmail) {
      // For email, no OTP is sent for login. They proceed straight to password entry.
      return {
        success: true,
        method: "PASSWORD",
        message: "Please enter your password to complete login."
      };
    }

    // For phone numbers, generate and send a login OTP
    const isLiveOtp = panelControlConfig.EMPLOYEE_PANEL.OTP === 'LIVE';
    const otp = isLiveOtp ? generateOtp(6, { numericOnly: true }) : '123456';
    const expirationMinutes = envConfig.otpExpirationMinutes || 10;
    user.tempOtp = otp;
    user.tempOtpExpires = dateUtil.addMinutes(new Date(), expirationMinutes);
    await user.save();

    logger.info(`EMPLOYEE AUTH: Dispatching login OTP to phone ${cleanId} -> [${otp}] (OTP Mode: ${panelControlConfig.EMPLOYEE_PANEL.OTP})`);
    if (isLiveOtp) {
      await smsManager.sendOtp(
        user.phoneNumber,
        otp,
        smsConfig.templates.EMPLOYEE_LOGIN_OTP.templateId,
        { expiry: String(expirationMinutes), var1: otp, var2: String(expirationMinutes) }
      );
    }

    return {
      success: true,
      method: "OTP",
      message: "Verification code successfully dispatched to your mobile number.",
      ...(!isLiveOtp ? { otp } : {})
    };
  }

  /**
   * Validates the login OTP (Phone Login) and immediately initializes the session
   */
  async verifyLoginOtp(loginId, otp) {
    const cleanId = loginId.trim().toLowerCase();

    const user = await User.findOne({
      $or: [{ email: cleanId }, { phoneNumber: cleanId }]
    });

    if (!user) {
      throw ApiError.notFound('Employee account not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    // Validate OTP
    const isTestMock = otp === '123456' && panelControlConfig.EMPLOYEE_PANEL.OTP === 'TEST';
    const isLiveValid = user.tempOtp === otp && user.tempOtpExpires > new Date();

    if (!isTestMock && !isLiveValid) {
      throw ApiError.badRequest('The verification code is incorrect or has expired.', ErrorCode.OTP_INVALID);
    }

    // Clear temp OTP fields
    user.tempOtp = null;
    user.tempOtpExpires = null;
    await user.save();

    // Log user in immediately!
    const payload = {
      userId: user._id,
      email: user.email,
      role: user.role,
      userType: user.userType,
      permissions: ['LOAN_VIEW', 'LOAN_PROCESS', 'KYC_VIEW']
    };

    const accessToken = jwtUtil.signAccess(payload);
    const refreshToken = jwtUtil.signRefresh(payload);

    user.lastLoginAt = new Date();
    await user.save();

    return {
      success: true,
      user: {
        id: user._id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        userType: user.userType,
        status: user.status
      },
      accessToken,
      refreshToken,
      message: 'Authentication successful. Executive session initialized.'
    };
  }

  /**
   * Authenticates the email user with their password and issues session tokens
   */
  async loginPassword(loginId, password) {
    const cleanId = loginId.trim().toLowerCase();
    
    // Find user by email or phone
    const user = await User.findOne({
      $or: [{ email: cleanId }, { phoneNumber: cleanId }]
    });

    if (!user) {
      throw ApiError.notFound('Employee account not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (!this.isEmployee(user.role)) {
      throw ApiError.forbidden('Access Denied. Employee profile permissions required.', ErrorCode.AUTH_FORBIDDEN);
    }

    if (user.status !== 'ACTIVE') {
      throw ApiError.forbidden(`Your account is currently inactive or suspended [Status: ${user.status}].`, ErrorCode.AUTH_SESSION_EXPIRED);
    }

    // Check if password hash exists
    if (!user.passwordHash) {
      throw ApiError.badRequest('Password authentication not configured for this account. Please log in via Mobile OTP or contact support.', ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    const isPasswordValid = await cryptoUtil.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw ApiError.badRequest('Invalid password. Please try again.', ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    // Issue session tokens
    const payload = {
      userId: user._id,
      email: user.email,
      role: user.role,
      userType: user.userType,
      permissions: ['LOAN_VIEW', 'LOAN_PROCESS', 'KYC_VIEW']
    };

    const accessToken = jwtUtil.signAccess(payload);
    const refreshToken = jwtUtil.signRefresh(payload);

    user.lastLoginAt = new Date();
    await user.save();

    return {
      user: {
        id: user._id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        userType: user.userType,
        status: user.status
      },
      accessToken,
      refreshToken
    };
  }


  /**
   * Generates and dispatches a dynamic OTP for password resets
   */
  async sendForgotPasswordOtp(loginId) {
    const cleanId = loginId.trim().toLowerCase();
    const user = await User.findOne({
      $or: [{ email: cleanId }, { phoneNumber: cleanId }]
    });

    if (!user) {
      logger.warn(`FORGOT PWD: Attempted reset on non-existent employee: ${cleanId}`);
      return { success: true, message: "Verification recovery OTP code sent if the account exists." };
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      throw ApiError.forbidden('Forgot password recovery is disabled for administrator profiles.', ErrorCode.AUTH_FORBIDDEN);
    }

    const isLiveOtp = panelControlConfig.EMPLOYEE_PANEL.OTP === 'LIVE';
    const isLiveEmail = panelControlConfig.EMPLOYEE_PANEL.EMAIL === 'LIVE';
    const otp = isLiveOtp ? generateOtp(6, { numericOnly: true }) : '123456';
    user.resetOtp = await cryptoUtil.hash(otp); // Hash reset OTP for security
    user.resetOtpExpires = dateUtil.addMinutes(new Date(), 15);
    user.resetVerifiedAt = null;
    await user.save();

    const isEmail = cleanId.includes('@');
    if (isEmail) {
      logger.info(`FORGOT PWD: Dispatching OTP to email ${cleanId} -> [${otp}] (Email Mode: ${panelControlConfig.EMPLOYEE_PANEL.EMAIL})`);
      if (isLiveEmail) {
        try {
          await mailer.sendMail({
            to: cleanId,
            subject: emailConfig.templates.EMPLOYEE_FORGOT_PASSWORD_OTP.subject,
            templateId: emailConfig.templates.EMPLOYEE_FORGOT_PASSWORD_OTP.templateId,
            variables: { otp },
            html: `
              <h3>Sahayaone ERP - Password Reset Request</h3>
              <p>Please use the following verification OTP code to reset your account password:</p>
              <h2>${otp}</h2>
              <p>This code is valid for 15 minutes. If you did not request a password reset, please ignore this email. For any queries, contact support at 8080494923 or email info@sahayaone.com.</p>
            `
          });
        } catch (mailError) {
          logger.error(`EMPLOYEE AUTH EXCEPTION: Email dispatch failed: ${mailError.message}`);
          throw ApiError.internal('Failed to send verification email. Please check your connection or try again later.');
        }
      }
    } else {
      logger.info(`FORGOT PWD: Dispatching OTP to phone ${cleanId} -> [${otp}] (OTP Mode: ${panelControlConfig.EMPLOYEE_PANEL.OTP})`);
      if (isLiveOtp) {
        await smsManager.sendOtp(
          user.phoneNumber,
          otp,
          smsConfig.templates.EMPLOYEE_LOGIN_OTP.templateId,
          { expiry: '15', var1: otp, var2: '15' }
        );
      }
    }

    return {
      success: true,
      message: `Recovery code successfully dispatched to your registered ${isEmail ? 'email' : 'phone number'}.`,
      ...(!isLiveOtp ? { otp } : {})
    };
  }

  /**
   * Verifies recovery OTP and returns reset session token
   */
  async verifyRecoveryOtp(loginId, otp) {
    const cleanId = loginId.trim().toLowerCase();
    const user = await User.findOne({
      $or: [{ email: cleanId }, { phoneNumber: cleanId }]
    });

    if (!user || !user.resetOtp) {
      throw ApiError.badRequest('Invalid request. Please trigger forgot password first.', ErrorCode.OTP_INVALID);
    }

    if (dateUtil.isExpired(user.resetOtpExpires)) {
      throw ApiError.badRequest('The verification recovery OTP has expired. Please request a new one.', ErrorCode.OTP_EXPIRED);
    }

    // Check hashed resetOtp
    const isOtpValid = await cryptoUtil.compare(otp, user.resetOtp);
    const isTestMock = otp === '123456' && panelControlConfig.EMPLOYEE_PANEL.OTP === 'TEST';
    if (!isOtpValid && !isTestMock) {
      throw ApiError.badRequest('The verification OTP is incorrect.', ErrorCode.OTP_INVALID);
    }

    // Save state
    user.resetVerifiedAt = new Date();
    user.resetOtp = null;
    user.resetOtpExpires = null;
    await user.save();

    // Issue short-lived recovery token (10 mins validity)
    const recoveryToken = jwtUtil.signAccess({
      userId: user._id,
      purpose: 'EXECUTIVE_PASSWORD_RESET'
    });

    return {
      success: true,
      recoveryToken,
      message: 'OTP verified successfully. You can now reset your password.'
    };
  }

  /**
   * Resets password strictly if performed using a valid recovery token
   */
  async resetPassword(password, recoveryToken) {
    const decoded = jwtUtil.verifyAccess(recoveryToken);
    if (!decoded || decoded.purpose !== 'EXECUTIVE_PASSWORD_RESET') {
      throw ApiError.unauthorized('Invalid or expired password reset session token. Please verify OTP again.', ErrorCode.AUTH_UNAUTHORIZED);
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      throw ApiError.notFound('Employee account not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    // Hash and store new password credentials
    user.passwordHash = await cryptoUtil.hash(password);
    user.resetVerifiedAt = null;
    await user.save();

    logger.info(`FORGOT PWD: Password reset complete for user ID: ${user._id}`);

    // Send confirmation email alert
    if (user.email) {
      mailer.sendMail({
        to: user.email,
        subject: emailConfig.templates.EMPLOYEE_PASSWORD_RESET_SUCCESS.subject,
        templateId: emailConfig.templates.EMPLOYEE_PASSWORD_RESET_SUCCESS.templateId,
        variables: { email: user.email },
        html: `
          <h3>Password Reset Successful</h3>
          <p>Dear Employee,</p>
          <p>The password for your Sahayaone ERP account (<strong>${user.email}</strong>) has been successfully changed. You can now use your new password to log in.</p>
          <p>If you did not request this change, please immediately contact your branch manager or contact support at 8080494923 / info@sahayaone.com to secure your account.</p>
        `
      }).catch(err => {
        logger.warn(`EMPLOYEE AUTH: Password reset confirmation email dispatch warning: ${err.message}`);
      });
    }

    return {
      success: true,
      message: 'Your password has been changed successfully! You can now log in using your new password.'
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

    const user = await User.findById(decoded.userId);
    if (!user) {
      throw ApiError.unauthorized('Session expired or invalid token. Please log in again.', ErrorCode.AUTH_SESSION_EXPIRED);
    }

    if (user.status !== 'ACTIVE') {
      throw ApiError.forbidden(`Your account is currently locked or suspended [Status: ${user.status}].`, ErrorCode.AUTH_SESSION_EXPIRED);
    }

    const payload = {
      userId: user._id,
      email: user.email,
      role: user.role,
      userType: user.userType,
      permissions: ['LOAN_VIEW', 'LOAN_PROCESS', 'KYC_VIEW']
    };

    const accessToken = jwtUtil.signAccess(payload);
    const refreshToken = jwtUtil.signRefresh(payload);

    return {
      accessToken,
      refreshToken
    };
  }
}

export const employeeAuthService = new EmployeeAuthService();
