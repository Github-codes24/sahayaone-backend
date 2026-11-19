import { Router } from 'express';
import { onboardingAuthController } from '../controllers/auth.controller.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import {
  loginRequestSchema,
  verifyLoginOtpSchema,
  loginPasswordSchema,
  forgotPasswordSchema,
  verifyRecoveryOtpSchema,
  resetPasswordSchema,
  refreshSessionSchema
} from '../validators/auth.validator.js';

const router = Router();

// Multi-step Onboarding Team Login endpoints
router.post('/login-request', validateRequest(loginRequestSchema), onboardingAuthController.loginRequest);
router.post('/verify-login-otp', validateRequest(verifyLoginOtpSchema), onboardingAuthController.verifyLoginOtp);
router.post('/login-password', validateRequest(loginPasswordSchema), onboardingAuthController.loginPassword);

// Onboarding Team Password Recovery endpoints
router.post('/forgot-password', validateRequest(forgotPasswordSchema), onboardingAuthController.forgotPassword);
router.post('/verify-recovery-otp', validateRequest(verifyRecoveryOtpSchema), onboardingAuthController.verifyRecoveryOtp);
router.post('/reset-password', validateRequest(resetPasswordSchema), onboardingAuthController.resetPassword);

// Session endpoints
router.post('/refresh', validateRequest(refreshSessionSchema), onboardingAuthController.refresh);
router.post('/logout', onboardingAuthController.logout);

export default router;
