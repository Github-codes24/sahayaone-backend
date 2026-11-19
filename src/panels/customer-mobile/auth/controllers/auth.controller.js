import { BaseController } from '../../../../common/base.controller.js';
import { customerMobileAuthService } from '../services/auth.service.js';
import { jwtConfig } from '../../../../config/jwt.config.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';
import { User } from '../../../../models/user.model.js';

export class CustomerMobileAuthController extends BaseController {
  constructor() {
    super();
    this.verifyMobile = this.catchAsync(this.verifyMobile.bind(this));
    this.resendOtp = this.catchAsync(this.resendOtp.bind(this));
    this.verifyOtp = this.catchAsync(this.verifyOtp.bind(this));
    this.registerMpin = this.catchAsync(this.registerMpin.bind(this));
    this.loginMpin = this.catchAsync(this.loginMpin.bind(this));
    this.forgotMpin = this.catchAsync(this.forgotMpin.bind(this));
    this.verifyResetOtp = this.catchAsync(this.verifyResetOtp.bind(this));
    this.resetMpin = this.catchAsync(this.resetMpin.bind(this));
    this.refresh = this.catchAsync(this.refresh.bind(this));
    this.logout = this.catchAsync(this.logout.bind(this));
  }

  /**
   * Check if customer mobile exists, sends OTP (Dev mock)
   */
  async verifyMobile(req, res, next) {
    const { phoneNumber } = req.body;
    const result = await customerMobileAuthService.verifyMobile(phoneNumber);
    return this.sendResponse(res, 200, result, result.message);
  }

  /**
   * Resends verification OTP, invalidating the previous active OTP
   */
  async resendOtp(req, res, next) {
    const { phoneNumber } = req.body;
    const result = await customerMobileAuthService.resendOtp(phoneNumber);
    return this.sendResponse(res, 200, result, result.message);
  }

  /**
   * Verifies mobile OTP code and triggers temporary transition tokens if needed
   */
  async verifyOtp(req, res, next) {
    const { phoneNumber, otp } = req.body;
    const result = await customerMobileAuthService.verifyOtp(phoneNumber, otp);
    return this.sendResponse(res, 200, result, result.message);
  }

  /**
   * Registers/Sets a fresh MPIN passcode. Requires Auth validation token or verified phone.
   */
  async registerMpin(req, res, next) {
    const mpin = req.body.mpin || req.body.newMpin;
    let userId = null;

    if (req.body.phoneNumber) {
      const cleanPhone = String(req.body.phoneNumber).replace(/\D/g, '').slice(-10);
      const user = await User.findOne({
        $or: [
          { phoneNumber: cleanPhone },
          { phoneNumber: `+91${cleanPhone}` },
          { phoneNumber: `91${cleanPhone}` }
        ],
        isDeleted: { $ne: true }
      });
      if (user) userId = user._id;
    }

    if (!userId) {
      userId = req.user?.id || req.user?.userId;
    }

    if (!userId) {
      throw ApiError.unauthorized('User identity not found. Please authenticate via OTP first.');
    }

    const result = await customerMobileAuthService.registerMpin(userId, mpin, req.body.phoneNumber);

    // Save refresh session cookie
    if (result.refreshToken) {
      res.cookie('refresh_token', result.refreshToken, jwtConfig.cookieOptions);
    }

    return this.sendResponse(res, 200, {
      user: result.user,
      profile: result.profile || result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      token: result.accessToken
    }, 'MPIN configured successfully. Session initialized.');
  }

  /**
   * Core Customer login using 4-digit MPIN passcode
   */
  async loginMpin(req, res, next) {
    const { phoneNumber, mpin } = req.body;

    const result = await customerMobileAuthService.authenticateCustomerMpin(phoneNumber, mpin);

    if (result.refreshToken) {
      res.cookie('refresh_token', result.refreshToken, jwtConfig.cookieOptions);
    }

    return this.sendResponse(res, 200, {
      user: result.user,
      profile: result.profile || result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      token: result.accessToken
    }, 'Authentication successful. Customer session initialized.');
  }

  /**
   * Requests OTP code to recover/reset MPIN
   */
  async forgotMpin(req, res, next) {
    const { phoneNumber } = req.body;
    const result = await customerMobileAuthService.forgotMpin(phoneNumber);
    return this.sendResponse(res, 200, result, result.message);
  }

  /**
   * Verifies verification code for resetting MPIN and issues reset transition token
   */
  async verifyResetOtp(req, res, next) {
    const { phoneNumber, otp } = req.body;
    const result = await customerMobileAuthService.verifyResetOtp(phoneNumber, otp);
    return this.sendResponse(res, 200, result, result.message);
  }

  /**
   * Resets customer MPIN using the verified reset transition token
   */
  async resetMpin(req, res, next) {
    const mpin = req.body.mpin || req.body.newMpin;
    let userId = req.user?.id || req.user?.userId;

    if (!userId && req.body.phoneNumber) {
      const cleanPhone = String(req.body.phoneNumber).replace(/\D/g, '').slice(-10);
      const user = await User.findOne({
        $or: [{ phoneNumber: cleanPhone }, { phoneNumber: `+91${cleanPhone}` }],
        isDeleted: { $ne: true }
      });
      if (user) userId = user._id;
    }

    if (!userId) {
      throw ApiError.unauthorized('User identity not found. Please verify OTP first.');
    }

    const result = await customerMobileAuthService.resetMpin(userId, mpin, req.body.phoneNumber);

    if (result.refreshToken) {
      res.cookie('refresh_token', result.refreshToken, jwtConfig.cookieOptions);
    }

    return this.sendResponse(res, 200, {
      user: result.user,
      profile: result.profile || result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      token: result.accessToken
    }, 'Your MPIN has been updated successfully. You can now log in using your new MPIN.');
  }

  /**
   * Refreshes access and refresh tokens (accepts cookie fallback or body payload)
   */
  async refresh(req, res, next) {
    let refreshToken = req.body.refreshToken;

    if (!refreshToken && req.headers.cookie) {
      const match = req.headers.cookie.match(/refresh_token=([^;]+)/);
      if (match) refreshToken = match[1];
    }

    const result = await customerMobileAuthService.refreshSession(refreshToken);

    if (result.refreshToken) {
      res.cookie('refresh_token', result.refreshToken, jwtConfig.cookieOptions);
    }

    return this.sendResponse(res, 200, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      token: result.accessToken
    }, 'Session refreshed successfully.');
  }

  /**
   * Clears the customer session
   */
  async logout(req, res, next) {
    res.clearCookie('refresh_token', jwtConfig.cookieOptions);
    return this.sendResponse(res, 200, null, 'Logged out successfully.');
  }
}

export const customerMobileAuthController = new CustomerMobileAuthController();
