import { BaseController } from '../../../../common/base.controller.js';
import { superAdminAuthService } from '../services/auth.service.js';
import { jwtConfig } from '../../../../config/jwt.config.js';

export class SuperAdminAuthController extends BaseController {
  constructor() {
    super();
    this.getRoles = this.catchAsync(this.getRoles.bind(this));
    this.login = this.catchAsync(this.login.bind(this));
    this.logout = this.catchAsync(this.logout.bind(this));
    this.forgotPassword = this.catchAsync(this.forgotPassword.bind(this));
    this.resendOtp = this.catchAsync(this.resendOtp.bind(this));
    this.verifyOtp = this.catchAsync(this.verifyOtp.bind(this));
    this.resetPassword = this.catchAsync(this.resetPassword.bind(this));
    this.refresh = this.catchAsync(this.refresh.bind(this));
  }

  /**
   * Fetches all active roles allowed to log in via admin panel
   */
  async getRoles(req, res, next) {
    const roles = await superAdminAuthService.getRoles();
    return this.sendResponse(res, 200, roles, 'Active admin roles list retrieved successfully.');
  }

  /**
   * HTTP Handler for Admin and Sub-Admin logins
   */
  async login(req, res, next) {
    const { email, password, role } = req.body;

    const result = await superAdminAuthService.authenticateAdmin({
      email,
      password,
      role
    });

    res.cookie('refresh_token', result.refreshToken, jwtConfig.cookieOptions);

    return this.sendResponse(res, 200, {
      user: result.user,
      permissions: result.permissions,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    }, 'Authentication successful. Session initialized.');
  }

  /**
   * Triggers generation and dispatch of verification OTP for admin password reset
   */
  async forgotPassword(req, res, next) {
    const { email } = req.body;
    const expirationMinutes = parseInt(process.env.OTP_EXPIRATION_MINUTES || '5', 10);
    
    const result = await superAdminAuthService.sendForgotPasswordOtp(email, expirationMinutes);
    const responseData = result.otp ? { otp: result.otp, previewUrl: result.previewUrl } : null;
    return this.sendResponse(res, 200, responseData, result.message);
  }

  /**
   * Resends verification OTP, invalidating the previous active OTP
   */
  async resendOtp(req, res, next) {
    const { email } = req.body;
    const expirationMinutes = parseInt(process.env.OTP_EXPIRATION_MINUTES || '5', 10);
    
    const result = await superAdminAuthService.sendForgotPasswordOtp(email, expirationMinutes);
    const responseData = result.otp ? { otp: result.otp, previewUrl: result.previewUrl } : null;
    return this.sendResponse(res, 200, responseData, "We've sent a new verification code to your email address. Please check your inbox.");
  }

  /**
   * Verifies the 6-digit verification OTP
   */
  async verifyOtp(req, res, next) {
    const { email, otp } = req.body;
    const result = await superAdminAuthService.verifyOtp(email, otp);
    return this.sendResponse(res, 200, null, result.message);
  }

  /**
   * Resets password to new credentials after OTP verification
   */
  async resetPassword(req, res, next) {
    const { email, password, confirmPassword } = req.body;
    const resetWindowMinutes = 10;

    const result = await superAdminAuthService.resetPassword(email, password, resetWindowMinutes);
    return this.sendResponse(res, 200, null, result.message);
  }

  /**
   * HTTP Handler for logging out and clearing session cookies
   */
  async logout(req, res, next) {
    const { maxAge, ...clearOptions } = jwtConfig.cookieOptions;
    res.clearCookie('refresh_token', clearOptions);
    return this.sendResponse(res, 200, null, 'Logout successful. Session terminated.');
  }

  /**
   * Refreshes the admin session and sets a sliding refresh cookie
   */
  async refresh(req, res, next) {
    let refreshToken = req.body?.refreshToken || req.body?.token || req.cookies?.refresh_token || req.headers['x-refresh-token'];

    if (!refreshToken && req.headers.cookie) {
      const match = req.headers.cookie.match(/refresh_token=([^;]+)/);
      if (match) refreshToken = match[1];
    }

    const result = await superAdminAuthService.refreshSession(refreshToken);

    res.cookie('refresh_token', result.refreshToken, jwtConfig.cookieOptions);

    return this.sendResponse(res, 200, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    }, 'Session refreshed successfully.');
  }
}

export const superAdminAuthController = new SuperAdminAuthController();
