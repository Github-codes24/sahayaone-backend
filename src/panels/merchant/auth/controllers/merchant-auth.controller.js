import { BaseController } from '../../../../common/base.controller.js';
import { merchantAuthService } from '../services/merchant-auth.service.js';
import { jwtConfig } from '../../../../config/jwt.config.js';

export class MerchantAuthController extends BaseController {
  /**
   * POST /api/v1/merchant/auth/login
   * Web Portal: Sets HTTP-Only cookies (access_token, refresh_token, token) and returns payload
   */
  login = this.catchAsync(async (req, res) => {
    const result = await merchantAuthService.login(req.body);

    const { accessToken, refreshToken } = result.tokens || {};

    if (accessToken) {
      res.cookie('access_token', accessToken, jwtConfig.cookieOptions);
      res.cookie('token', accessToken, jwtConfig.cookieOptions);
      res.setHeader('Authorization', `Bearer ${accessToken}`);
      res.setHeader('X-Access-Token', accessToken);
    }

    if (refreshToken) {
      res.cookie('refresh_token', refreshToken, jwtConfig.cookieOptions);
      res.setHeader('X-Refresh-Token', refreshToken);
    }

    return this.sendSuccess(res, result, 'Login successful.');
  });

  /**
   * POST /api/v1/merchant/auth/forgot-password
   */
  forgotPassword = this.catchAsync(async (req, res) => {
    const result = await merchantAuthService.forgotPassword(req.body);
    return this.sendSuccess(res, result, result.message);
  });

  /**
   * POST /api/v1/merchant/auth/verify-otp
   */
  verifyOtp = this.catchAsync(async (req, res) => {
    const result = await merchantAuthService.verifyOtp(req.body);
    return this.sendSuccess(res, result, result.message);
  });

  /**
   * POST /api/v1/merchant/auth/reset-password
   */
  resetPassword = this.catchAsync(async (req, res) => {
    const result = await merchantAuthService.resetPassword(req.body);
    return this.sendSuccess(res, result, result.message);
  });

  /**
   * POST /api/v1/merchant/auth/resend-otp
   */
  resendOtp = this.catchAsync(async (req, res) => {
    const result = await merchantAuthService.resendOtp(req.body);
    return this.sendSuccess(res, result, result.message);
  });

  /**
   * GET /api/v1/merchant/auth/me (or /profile)
   */
  getProfile = this.catchAsync(async (req, res) => {
    const selectedMerchantId = req.query?.merchantId || req.header('x-merchant-id') || req.user?.merchantId || null;
    const result = await merchantAuthService.getProfile(req.user.userId || req.user.id, selectedMerchantId);
    return this.sendSuccess(res, result, 'Merchant profile retrieved successfully.');
  });

  /**
   * POST /api/v1/merchant/auth/switch-store
   */
  switchStore = this.catchAsync(async (req, res) => {
    const result = await merchantAuthService.switchStore(req.user.userId || req.user.id, req.body);

    const { accessToken, refreshToken } = result.tokens || {};
    if (accessToken) {
      res.cookie('access_token', accessToken, jwtConfig.cookieOptions);
      res.cookie('token', accessToken, jwtConfig.cookieOptions);
      res.setHeader('Authorization', `Bearer ${accessToken}`);
      res.setHeader('X-Access-Token', accessToken);
    }
    if (refreshToken) {
      res.cookie('refresh_token', refreshToken, jwtConfig.cookieOptions);
      res.setHeader('X-Refresh-Token', refreshToken);
    }

    return this.sendSuccess(res, result, result.message);
  });

  /**
   * POST /api/v1/merchant/auth/change-password
   */
  changePassword = this.catchAsync(async (req, res) => {
    const result = await merchantAuthService.changePassword(req.user.userId || req.user.id, req.body);
    return this.sendSuccess(res, result, result.message);
  });

  /**
   * POST /api/v1/merchant/auth/refresh
   */
  refreshToken = this.catchAsync(async (req, res) => {
    const cookieHeader = req.headers.cookie || '';
    const getCookie = (name) => {
      const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
      return match ? decodeURIComponent(match[1]) : null;
    };

    let reqToken = req.body?.refreshToken;
    if (reqToken === 'null' || reqToken === 'undefined' || reqToken === '' || (reqToken && reqToken.startsWith('{{'))) {
      reqToken = null;
    }

    const authHeader = req.header('Authorization') || req.header('authorization');
    let headerToken = null;
    if (authHeader) {
      headerToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : authHeader.trim();
      if (headerToken === 'null' || headerToken === 'undefined' || headerToken === '' || headerToken.startsWith('{{')) {
        headerToken = null;
      }
    }

    const token =
      reqToken ||
      getCookie('refresh_token') ||
      getCookie('refreshToken') ||
      headerToken ||
      getCookie('access_token') ||
      getCookie('token');

    const result = await merchantAuthService.refreshToken(token);

    const { accessToken, refreshToken: newRefreshToken } = result || {};

    if (accessToken) {
      res.cookie('access_token', accessToken, jwtConfig.cookieOptions);
      res.cookie('token', accessToken, jwtConfig.cookieOptions);
      res.setHeader('Authorization', `Bearer ${accessToken}`);
      res.setHeader('X-Access-Token', accessToken);
    }

    if (newRefreshToken) {
      res.cookie('refresh_token', newRefreshToken, jwtConfig.cookieOptions);
      res.setHeader('X-Refresh-Token', newRefreshToken);
    }

    return this.sendSuccess(res, result, 'Token refreshed successfully.');
  });

  /**
   * POST /api/v1/merchant/auth/logout
   * Web Portal: Clears all authentication cookies and terminates session
   */
  logout = this.catchAsync(async (req, res) => {
    const { maxAge, ...clearOptions } = jwtConfig.cookieOptions;
    res.clearCookie('refresh_token', clearOptions);
    res.clearCookie('access_token', clearOptions);
    res.clearCookie('token', clearOptions);
    res.clearCookie('refreshToken', clearOptions);

    const result = await merchantAuthService.logout(req.user?.userId || req.user?.id);
    return this.sendSuccess(res, result, 'Logged out successfully.');
  });
}

export const merchantAuthController = new MerchantAuthController();
