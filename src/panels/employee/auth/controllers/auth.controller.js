import { BaseController } from '../../../../common/base.controller.js';
import { employeeAuthService } from '../services/auth.service.js';
import { jwtConfig } from '../../../../config/jwt.config.js';

export class EmployeeAuthController extends BaseController {
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

  /**
   * Initiates a login session and dispatches verification OTP
   */
  async loginRequest(req, res, next) {
    const { loginId } = req.body;
    const result = await employeeAuthService.loginRequest(loginId);
    return this.sendResponse(res, 200, {
      method: result.method,
      ...(result.otp ? { otp: result.otp } : {})
    }, result.message);
  }

  /**
   * Confirms login OTP and issues dynamic session tokens
   */
  async verifyLoginOtp(req, res, next) {
    const { loginId, otp } = req.body;
    const result = await employeeAuthService.verifyLoginOtp(loginId, otp);

    res.cookie('refresh_token', result.refreshToken, jwtConfig.cookieOptions);

    return this.sendResponse(res, 200, {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    }, result.message);
  }

  /**
   * Authenticates password credentials and issues session tokens
   */
  async loginPassword(req, res, next) {
    const { loginId, password } = req.body;
    const result = await employeeAuthService.loginPassword(loginId, password);

    res.cookie('refresh_token', result.refreshToken, jwtConfig.cookieOptions);

    return this.sendResponse(res, 200, {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    }, 'Authentication successful. Executive session initialized.');
  }


  /**
   * Triggers forgot password OTP delivery
   */
  async forgotPassword(req, res, next) {
    const { loginId } = req.body;
    const result = await employeeAuthService.sendForgotPasswordOtp(loginId);
    return this.sendResponse(res, 200, {
      ...(result.otp ? { otp: result.otp } : {})
    }, result.message);
  }

  /**
   * Confirms recovery OTP and issues password reset token
   */
  async verifyRecoveryOtp(req, res, next) {
    const { loginId, otp } = req.body;
    const result = await employeeAuthService.verifyRecoveryOtp(loginId, otp);
    return this.sendResponse(res, 200, {
      recoveryToken: result.recoveryToken
    }, result.message);
  }

  /**
   * Resets password to new credentials using recovery token
   */
  async resetPassword(req, res, next) {
    const { password, recoveryToken } = req.body;
    const result = await employeeAuthService.resetPassword(password, recoveryToken);
    return this.sendResponse(res, 200, null, result.message);
  }

  /**
   * Refreshes the employee session and sets a sliding refresh cookie
   */
  async refresh(req, res, next) {
    let refreshToken = req.body.refreshToken;

    if (!refreshToken && req.headers.cookie) {
      const match = req.headers.cookie.match(/refresh_token=([^;]+)/);
      if (match) refreshToken = match[1];
    }

    const result = await employeeAuthService.refreshSession(refreshToken);

    res.cookie('refresh_token', result.refreshToken, jwtConfig.cookieOptions);

    return this.sendResponse(res, 200, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    }, 'Session refreshed successfully.');
  }


  /**
   * Destroys the employee session and clears the HTTPOnly cookie
   */
  async logout(req, res, next) {
    res.clearCookie('refresh_token', jwtConfig.cookieOptions);
    return this.sendResponse(res, 200, null, 'Logged out successfully.');
  }
}

export const employeeAuthController = new EmployeeAuthController();
