import { Router } from 'express';
import { merchantAuthController } from '../controllers/merchant-auth.controller.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import {
  merchantLoginSchema,
  merchantSwitchStoreSchema,
  merchantForgotPasswordSchema,
  merchantVerifyOtpSchema,
  merchantResetPasswordSchema,
  merchantChangePasswordSchema,
  merchantRefreshTokenSchema
} from '../validators/merchant-auth.validator.js';

const router = Router();

/**
 * @route   POST /api/v1/merchant/auth/login
 * @desc    Screen 1: Merchant login via Mobile Number (or Email) and Password
 * @access  Public
 */
router.post(
  '/login',
  validateRequest(merchantLoginSchema),
  merchantAuthController.login
);

/**
 * @route   POST /api/v1/merchant/auth/forgot-password
 * @desc    Screen 2: Send 6-digit OTP to merchant mobile for password recovery
 * @access  Public
 */
router.post(
  '/forgot-password',
  validateRequest(merchantForgotPasswordSchema),
  merchantAuthController.forgotPassword
);

// Aliases for requesting OTP
router.post(
  '/request-otp',
  validateRequest(merchantForgotPasswordSchema),
  merchantAuthController.forgotPassword
);

router.post(
  '/login-request',
  validateRequest(merchantForgotPasswordSchema),
  merchantAuthController.forgotPassword
);

/**
 * @route   POST /api/v1/merchant/auth/verify-otp
 * @desc    Screen 3: Verify 6-digit OTP and generate resetToken
 * @access  Public
 */
router.post(
  '/verify-otp',
  validateRequest(merchantVerifyOtpSchema),
  merchantAuthController.verifyOtp
);

/**
 * @route   POST /api/v1/merchant/auth/resend-otp
 * @desc    Screen 3 Link: Resend 6-digit OTP code to registered mobile
 * @access  Public
 */
router.post(
  '/resend-otp',
  validateRequest(merchantForgotPasswordSchema),
  merchantAuthController.resendOtp
);

/**
 * @route   POST /api/v1/merchant/auth/reset-password
 * @desc    Screen 4: Set new password after OTP verification
 * @access  Public
 */
router.post(
  '/reset-password',
  validateRequest(merchantResetPasswordSchema),
  merchantAuthController.resetPassword
);

/**
 * @route   GET /api/v1/merchant/auth/me
 * @desc    Get authenticated merchant profile and shop details
 * @access  Private (Merchant Partner)
 */
router.get(
  '/me',
  rbacMiddleware.requireAuth,
  merchantAuthController.getProfile
);

router.get(
  '/profile',
  rbacMiddleware.requireAuth,
  merchantAuthController.getProfile
);

/**
 * @route   POST /api/v1/merchant/auth/switch-store
 * @desc    Switch active store for merchant with multiple bank stores
 * @access  Private (Merchant Partner)
 */
router.post(
  '/switch-store',
  rbacMiddleware.requireAuth,
  validateRequest(merchantSwitchStoreSchema),
  merchantAuthController.switchStore
);

router.post(
  '/switch',
  rbacMiddleware.requireAuth,
  validateRequest(merchantSwitchStoreSchema),
  merchantAuthController.switchStore
);

/**
 * @route   POST /api/v1/merchant/auth/change-password
 * @desc    Change password for logged-in merchant
 * @access  Private (Merchant Partner)
 */
router.post(
  '/change-password',
  rbacMiddleware.requireAuth,
  validateRequest(merchantChangePasswordSchema),
  merchantAuthController.changePassword
);

/**
 * @route   POST /api/v1/merchant/auth/refresh
 * @desc    Refresh expired JWT access token (supports cookies & body)
 * @access  Public
 */
router.post(
  '/refresh',
  validateRequest(merchantRefreshTokenSchema),
  merchantAuthController.refreshToken
);

/**
 * @route   POST /api/v1/merchant/auth/logout
 * @desc    Logout merchant session and clear cookies
 * @access  Public
 */
router.post(
  '/logout',
  merchantAuthController.logout
);

export default router;
