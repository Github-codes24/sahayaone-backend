import { User } from '../../../../models/user.model.js';
import { OnboardingTeam } from '../../../../models/onboarding-team.model.js';
import { cryptoUtil } from '../../../../utils/crypto.util.js';
import { jwtUtil } from '../../../../utils/jwt.util.js';
import { ApiError } from '../../../../common/api.error.js';
import { UserRole, UserType } from '../../../../constants/user-role.constant.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';
import { logger } from '../../../../utils/logger.util.js';
import { generateOtp } from '../../../../utils/otp.util.js';
import { envConfig } from '../../../../config/env.config.js';
import { smsManager } from '../../../../sms/sms.manager.js';
import { smsConfig } from '../../../../config/sms.config.js';
import { emailConfig } from '../../../../config/email.config.js';
import { panelControlConfig } from '../../../../config/panel-control.config.js';
import { mailer } from '../../../../emails/mailer.util.js';

export class OnboardingAuthService {
  /**
   * Helper: Resolves Onboarding user across User and OnboardingTeam collections,
   * normalizing phone numbers, country codes (+91), spaces, and email casing.
   */
  async findOnboardingUser(loginId) {
    const rawId = String(loginId || '').trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawId);
    const cleanPhone = rawId.replace(/\D/g, '').slice(-10);

    let user = null;
    let member = null;

    if (isEmail) {
      user = await User.findOne({
        email: rawId.toLowerCase(),
        role: UserRole.ONBOARDING_TEAM
      });
      if (!user) {
        member = await OnboardingTeam.findOne({
          email: rawId.toLowerCase(),
          isDeleted: { $ne: true }
        });
        if (member && member.userId) {
          user = await User.findById(member.userId);
        }
      }
    } else {
      user = await User.findOne({
        $or: [
          { phoneNumber: cleanPhone },
          { phoneNumber: rawId },
          { phoneNumber: `+91${cleanPhone}` },
          { phoneNumber: `91${cleanPhone}` }
        ],
        role: UserRole.ONBOARDING_TEAM
      });

      if (!user) {
        member = await OnboardingTeam.findOne({
          $or: [
            { phone: cleanPhone },
            { phone: rawId },
            { phone: `+91${cleanPhone}` },
            { phone: `91${cleanPhone}` }
          ],
          isDeleted: { $ne: true }
        });
        if (member && member.userId) {
          user = await User.findById(member.userId);
        }
      }
    }

    // Sync fullName if missing on User document but present on OnboardingTeam
    if (user && (!user.fullName || user.fullName.trim() === '')) {
      if (!member) {
        member = await OnboardingTeam.findOne({ userId: user._id, isDeleted: { $ne: true } });
      }
      if (member?.fullName) {
        user.fullName = member.fullName;
        await user.save().catch(() => {});
      }
    }

    return { user, isEmail, rawId, cleanPhone };
  }

  /**
   * Identifies login path (phone or email) and dispatches OTP code for mobile users
   */
  async loginRequest(loginId) {
    const { user, isEmail, cleanPhone } = await this.findOnboardingUser(loginId);

    if (!user) {
      throw ApiError.badRequest('Invalid login identifier. User does not exist or lacks authorization.', ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    if (user.status !== 'ACTIVE') {
      throw ApiError.forbidden(`Your account is currently locked or suspended [Status: ${user.status}].`, ErrorCode.AUTH_FORBIDDEN);
    }

    if (!isEmail) {
      // Mobile Flow: Dispatches 6-digit OTP code
      const isLiveOtp = panelControlConfig.ONBOARDING_PANEL.OTP === 'LIVE';
      const otp = isLiveOtp ? generateOtp(6, { numericOnly: true }) : '123456';
      const expirationMinutes = envConfig.otpExpirationMinutes || 5;

      user.tempOtp = otp;
      user.tempOtpExpires = new Date(Date.now() + expirationMinutes * 60 * 1000);
      await user.save();

      const phoneToUse = user.phoneNumber || cleanPhone;
      if (isLiveOtp && phoneToUse) {
        await smsManager.sendOtp(
          phoneToUse,
          otp,
          smsConfig.templates.ONBOARDING_LOGIN_OTP.templateId,
          { expiry: String(expirationMinutes), var1: otp, var2: String(expirationMinutes) }
        );
      }

      logger.info(`ONBOARDING AUTH: Login OTP code [${otp}] generated for phone: ${phoneToUse} (OTP Mode: ${panelControlConfig.ONBOARDING_PANEL.OTP})`);

      return {
        method: 'OTP',
        message: 'Verification code successfully dispatched to your mobile number.',
        ...(!isLiveOtp ? { otp } : {})
      };
    }

    // Email Flow: Prompt for password entry
    return {
      method: 'PASSWORD',
      message: 'Please enter your password to complete login.'
    };
  }

  /**
   * Verifies mobile OTP and issues active session tokens
   */
  async verifyLoginOtp(loginId, otp) {
    const { user } = await this.findOnboardingUser(loginId);

    if (!user) {
      throw ApiError.badRequest('Authorization records not found.', ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    if (user.status !== 'ACTIVE') {
      throw ApiError.forbidden(`Your account is currently locked or suspended [Status: ${user.status}].`, ErrorCode.AUTH_FORBIDDEN);
    }

    const isDevMock = otp === '123456' && envConfig.nodeEnv === 'development';
    const isLiveValid = user.tempOtp && user.tempOtp === otp && user.tempOtpExpires > new Date();

    if (!isDevMock && !isLiveValid) {
      throw ApiError.badRequest('The verification code is incorrect or has expired.', ErrorCode.OTP_INVALID);
    }

    user.tempOtp = null;
    user.tempOtpExpires = null;
    user.lastLoginAt = new Date();
    await user.save();

    const payload = {
      userId: user._id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      userType: user.userType,
      permissions: user.permissions || []
    };

    const accessToken = jwtUtil.signAccess(payload);
    const refreshToken = jwtUtil.signRefresh(payload);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        fullName: user.fullName || '',
        role: user.role,
        userType: user.userType,
        status: user.status
      },
      message: 'Authentication successful. Onboarding session initialized.'
    };
  }

  /**
   * Validates password credentials and issues session tokens for email logins
   */
  async loginPassword(loginId, password) {
    const { user } = await this.findOnboardingUser(loginId);

    if (!user) {
      throw ApiError.badRequest('Invalid email or password credentials.', ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    if (user.status !== 'ACTIVE') {
      throw ApiError.forbidden(`Your account is currently locked or suspended [Status: ${user.status}].`, ErrorCode.AUTH_FORBIDDEN);
    }

    const isPasswordValid = await cryptoUtil.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw ApiError.badRequest('Invalid email or password credentials.', ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    user.lastLoginAt = new Date();
    await user.save();

    const payload = {
      userId: user._id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      userType: user.userType,
      permissions: user.permissions || []
    };

    const accessToken = jwtUtil.signAccess(payload);
    const refreshToken = jwtUtil.signRefresh(payload);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        userType: user.userType,
        status: user.status
      }
    };
  }

  /**
   * Dispatches verification OTP code for password recovery
   */
  async sendForgotPasswordOtp(loginId) {
    const { user } = await this.findOnboardingUser(loginId);

    if (!user) {
      throw ApiError.notFound('Account not found with this identifier.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (user.status !== 'ACTIVE') {
      throw ApiError.forbidden('Your account is inactive.', ErrorCode.AUTH_FORBIDDEN);
    }

    const isLiveOtp = panelControlConfig.ONBOARDING_PANEL.OTP === 'LIVE';
    const isLiveEmail = panelControlConfig.ONBOARDING_PANEL.EMAIL === 'LIVE';
    const otp = isLiveOtp ? generateOtp(6) : '123456';
    user.tempOtp = otp;
    user.tempOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes validity
    await user.save();

    logger.info(`ONBOARDING AUTH: Recovery OTP code [${otp}] generated for: ${user.email || user.phoneNumber} (OTP Mode: ${panelControlConfig.ONBOARDING_PANEL.OTP})`);

    if (isLiveEmail && user.email) {
      try {
        await mailer.sendMail({
          to: user.email,
          subject: emailConfig.templates.ONBOARDING_FORGOT_PASSWORD_OTP.subject,
          templateId: emailConfig.templates.ONBOARDING_FORGOT_PASSWORD_OTP.templateId,
          variables: { otp },
          html: `
            <h3>Password Recovery Code</h3>
            <p>Please enter the following one-time recovery code to authorize password changes on your onboarding executive account:</p>
            <h2>${otp}</h2>
            <p>This code is valid for 10 minutes. If you did not make this request, please contact administrator immediately at 8080494923 or email info@sahayaone.com.</p>
          `
        });
      } catch (mailError) {
        logger.error(`ONBOARDING AUTH EXCEPTION: Email dispatch failed: ${mailError.message}`);
        throw ApiError.internal('Failed to send verification email. Please check your connection or try again later.');
      }
    }

    return {
      success: true,
      message: 'Recovery code successfully dispatched.',
      ...(!isLiveOtp ? { otp } : {})
    };
  }

  /**
   * Confirms recovery OTP code and issues a temporary password reset token
   */
  async verifyRecoveryOtp(loginId, otp) {
    const { user } = await this.findOnboardingUser(loginId);

    if (!user) {
      throw ApiError.notFound('Account records not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const isDevMock = otp === '123456' && envConfig.nodeEnv === 'development';
    const isLiveValid = user.tempOtp && user.tempOtp === otp && user.tempOtpExpires > new Date();

    if (!isDevMock && !isLiveValid) {
      throw ApiError.badRequest('The verification code is incorrect or expired.', ErrorCode.OTP_INVALID);
    }

    user.tempOtp = null;
    user.tempOtpExpires = null;
    await user.save();

    const recoveryToken = jwtUtil.signAccess({
      userId: user._id,
      role: user.role,
      userType: user.userType,
      purpose: 'PASSWORD_RESET'
    });

    return {
      recoveryToken,
      message: 'OTP verified successfully. You can now reset your password.'
    };
  }

  /**
   * Resets password credentials using a valid reset recovery token
   */
  async resetPassword(newPassword, recoveryToken) {
    let decoded;
    try {
      decoded = jwtUtil.verifyAccess(recoveryToken);
    } catch (err) {
      throw ApiError.badRequest('The recovery token is invalid or expired.', ErrorCode.AUTH_SESSION_EXPIRED);
    }

    if (decoded.purpose !== 'PASSWORD_RESET') {
      throw ApiError.badRequest('Invalid recovery token purpose.', ErrorCode.AUTH_SESSION_EXPIRED);
    }

    const user = await User.findOne({
      _id: decoded.userId,
      role: UserRole.ONBOARDING_TEAM
    });

    if (!user) {
      throw ApiError.notFound('Account identity not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    user.passwordHash = await cryptoUtil.hash(newPassword);
    await user.save();

    // Send confirmation email alert
    if (user.email) {
      mailer.sendMail({
        to: user.email,
        subject: emailConfig.templates.ONBOARDING_PASSWORD_RESET_SUCCESS.subject,
        templateId: emailConfig.templates.ONBOARDING_PASSWORD_RESET_SUCCESS.templateId,
        variables: { email: user.email },
        html: `
          <h3>Security Alert - Password Reset Complete</h3>
          <p>Dear Executive,</p>
          <p>This is to confirm that the password for your Onboarding Team Account (<strong>${user.email}</strong>) has been successfully reset.</p>
          <p>If you did not authorize this password reset, please contact the HO Admin team immediately at 8080494923 or email info@sahayaone.com.</p>
        `
      }).catch(err => {
        logger.warn(`ONBOARDING AUTH: Password reset confirmation email dispatch warning: ${err.message}`);
      });
    }

    return {
      success: true,
      message: 'Your password has been changed successfully! You can now log in using your new password.'
    };
  }

  /**
   * Renews access and refresh token sessions
   */
  async refreshSession(token) {
    if (!token) {
      throw ApiError.unauthorized('Session refresh token is required.', ErrorCode.AUTH_UNAUTHORIZED);
    }

    let decoded;
    try {
      decoded = jwtUtil.verifyRefresh(token);
    } catch (err) {
      throw ApiError.unauthorized('Session expired. Please log in again.', ErrorCode.AUTH_SESSION_EXPIRED);
    }

    const user = await User.findOne({
      _id: decoded.userId,
      role: UserRole.ONBOARDING_TEAM
    });

    if (!user || user.status !== 'ACTIVE') {
      throw ApiError.unauthorized('Access denied. Account is suspended or deactivated.', ErrorCode.AUTH_SESSION_EXPIRED);
    }

    const payload = {
      userId: user._id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: user.role,
      userType: user.userType,
      permissions: user.permissions || []
    };

    const accessToken = jwtUtil.signAccess(payload);
    const refreshToken = jwtUtil.signRefresh(payload);

    return {
      accessToken,
      refreshToken
    };
  }
}

export const onboardingAuthService = new OnboardingAuthService();
