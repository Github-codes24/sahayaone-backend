import { BaseController } from '../../../../common/base.controller.js';
import { societyAuthService } from '../services/society-auth.service.js';
import { jwtConfig } from '../../../../config/jwt.config.js';

export class SocietyAuthController extends BaseController {
  constructor() {
    super();
    this.login = this.login.bind(this);
    this.refresh = this.refresh.bind(this);
    this.logout = this.logout.bind(this);
    this.getProfile = this.getProfile.bind(this);
    this.getRoles = this.getRoles.bind(this);
    this.forgotPassword = this.forgotPassword.bind(this);
    this.verifyOtp = this.verifyOtp.bind(this);
    this.resetPassword = this.resetPassword.bind(this);
    this.resendOtp = this.resendOtp.bind(this);
  }

  /**
   * POST /api/v1/society/auth/login
   */
  async login(req, res, next) {
    try {
      const { role, email, password } = req.body;
      const result = await societyAuthService.login({ role, email, password });

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
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/society/auth/refresh
   */
  async refresh(req, res, next) {
    try {
      const cookieHeader = req.headers.cookie || '';
      const getCookie = (name) => {
        const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
        return match ? decodeURIComponent(match[1]) : null;
      };

      const refreshToken =
        req.body.refreshToken ||
        getCookie('refresh_token') ||
        getCookie('refreshToken') ||
        getCookie('access_token') ||
        getCookie('token');

      const tokens = await societyAuthService.refresh(refreshToken);

      const { accessToken, refreshToken: newRefreshToken } = tokens || {};

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

      return this.sendSuccess(res, tokens, 'Session refreshed successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/society/auth/logout
   */
  async logout(req, res, next) {
    try {
      const { maxAge, ...clearOptions } = jwtConfig.cookieOptions;
      res.clearCookie('refresh_token', clearOptions);
      res.clearCookie('access_token', clearOptions);
      res.clearCookie('token', clearOptions);
      return this.sendSuccess(res, null, 'Logged out successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/society/auth/me
   */
  async getProfile(req, res, next) {
    try {
      return this.sendSuccess(res, {
        user: req.user,
        society: req.society
      }, 'Profile retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/society/auth/roles
   * Retrieves all available system and database roles
   */
  async getRoles(req, res, next) {
    try {
      const bankId = req.query.bankId || req.society?.bankId || null;
      const roles = await societyAuthService.getAvailableRoles(bankId);
      return this.sendSuccess(res, roles, 'Available roles retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/society/auth/forgot-password
   */
  async forgotPassword(req, res, next) {
    try {
      const result = await societyAuthService.forgotPassword(req.body);
      return this.sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/society/auth/verify-otp
   */
  async verifyOtp(req, res, next) {
    try {
      const result = await societyAuthService.verifyOtp(req.body);
      return this.sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/society/auth/reset-password
   */
  async resetPassword(req, res, next) {
    try {
      const result = await societyAuthService.resetPassword(req.body);
      return this.sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/society/auth/resend-otp
   */
  async resendOtp(req, res, next) {
    try {
      const result = await societyAuthService.resendOtp(req.body);
      return this.sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }
}

export const societyAuthController = new SocietyAuthController();
