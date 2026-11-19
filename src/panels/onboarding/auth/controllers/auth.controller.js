import { BaseController } from '../../../../common/base.controller.js';
import { onboardingAuthService } from '../services/auth.service.js';
import { jwtConfig } from '../../../../config/jwt.config.js';

export class OnboardingAuthController extends BaseController {
  constructor() {
    super();
    this.loginRequest = this.catchAsync(this.loginRequest.bind(this));
    this.verifyLoginOtp = this.catchAsync(this.verifyLoginOtp.bind(this));
    this.loginPassword = this.catchAsync(this.loginPassword.bind(this));
    this.forgotPassword = this.catchAsync(this.forgotPassword.bind(this));
    this.verifyRecoveryOtp = this.catchAsync(this.verifyRecoveryOtp.bind(this));
    this.resetPassword = this.catchAsync(this.resetPassword.bind(this));
    this.refresh = this.catchAsync(this.refresh.bind(this));
    this.logout = this.catchAsync(this.logout.bind(this));
  }

  async loginRequest(req, res, next) {
    const { loginId } = req.body;
    const result = await onboardingAuthService.loginRequest(loginId);
    return this.sendResponse(res, 200, {
      method: result.method,
      ...(result.otp ? { otp: result.otp } : {})
    }, result.message);
  }

  async verifyLoginOtp(req, res, next) {
    const { loginId, otp } = req.body;
    const result = await onboardingAuthService.verifyLoginOtp(loginId, otp);

    res.cookie('refresh_token', result.refreshToken, jwtConfig.cookieOptions);

    return this.sendResponse(res, 200, {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    }, result.message);
  }

  async loginPassword(req, res, next) {
    const { loginId, password } = req.body;
    const result = await onboardingAuthService.loginPassword(loginId, password);

    res.cookie('refresh_token', result.refreshToken, jwtConfig.cookieOptions);

    return this.sendResponse(res, 200, {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    }, 'Authentication successful. Onboarding session initialized.');
  }

  async forgotPassword(req, res, next) {
    const { loginId } = req.body;
    const result = await onboardingAuthService.sendForgotPasswordOtp(loginId);
    return this.sendResponse(res, 200, {
      ...(result.otp ? { otp: result.otp } : {})
    }, result.message);
  }

  async verifyRecoveryOtp(req, res, next) {
    const { loginId, otp } = req.body;
    const result = await onboardingAuthService.verifyRecoveryOtp(loginId, otp);
    return this.sendResponse(res, 200, {
      recoveryToken: result.recoveryToken
    }, result.message);
  }

  async resetPassword(req, res, next) {
    const { password, recoveryToken } = req.body;
    const result = await onboardingAuthService.resetPassword(password, recoveryToken);
    return this.sendResponse(res, 200, null, result.message);
  }

  async refresh(req, res, next) {
    let refreshToken = req.body.refreshToken;

    if (!refreshToken && req.headers.cookie) {
      const match = req.headers.cookie.match(/refresh_token=([^;]+)/);
      if (match) refreshToken = match[1];
    }

    const result = await onboardingAuthService.refreshSession(refreshToken);

    res.cookie('refresh_token', result.refreshToken, jwtConfig.cookieOptions);

    return this.sendResponse(res, 200, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    }, 'Session refreshed successfully.');
  }

  async logout(req, res, next) {
    res.clearCookie('refresh_token', jwtConfig.cookieOptions);
    return this.sendResponse(res, 200, null, 'Logged out successfully.');
  }
}

export const onboardingAuthController = new OnboardingAuthController();
