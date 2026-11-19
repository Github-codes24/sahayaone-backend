import { Router } from 'express';
import { societyAuthController } from '../controllers/society-auth.controller.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { resolveSocietyContext } from '../../middlewares/society-context.middleware.js';
import {
  societyLoginSchema,
  refreshSessionSchema,
  forgotPasswordSchema,
  verifyOtpSchema,
  resetPasswordSchema
} from '../validators/society-auth.validator.js';

const router = Router();

// 1. Society Login (Role + Email + Password)
router.post('/login', validateRequest(societyLoginSchema), societyAuthController.login);

// 2. Request OTP for Forgot Password (by registered Email)`
router.post('/forgot-password', validateRequest(forgotPasswordSchema), societyAuthController.forgotPassword);
router.post('/request-otp', validateRequest(forgotPasswordSchema), societyAuthController.forgotPassword);
router.post('/send-otp', validateRequest(forgotPasswordSchema), societyAuthController.forgotPassword);

// 3. Verify OTP code
router.post('/verify-otp', validateRequest(verifyOtpSchema), societyAuthController.verifyOtp);

// 4. Resend OTP code
router.post('/resend-otp', validateRequest(forgotPasswordSchema), societyAuthController.resendOtp);

// 5. Reset Password
router.post('/reset-password', validateRequest(resetPasswordSchema), societyAuthController.resetPassword);

// 6. Refresh JWT session
router.post('/refresh', validateRequest(refreshSessionSchema), societyAuthController.refresh);

// 7. Logout
router.post('/logout', societyAuthController.logout);

// 8. Authenticated context lookup
router.get('/me', rbacMiddleware.requireAuth, resolveSocietyContext, societyAuthController.getProfile);

// 9. Public / Context lookup for available system & database roles
router.get('/roles', societyAuthController.getRoles);

export default router;


