import { Router } from 'express';
import { employeeAuthController } from '../controllers/auth.controller.js';
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

// Multi-step Executive Login endpoints
router.post('/login-request', validateRequest(loginRequestSchema), employeeAuthController.loginRequest);
router.post('/verify-login-otp', validateRequest(verifyLoginOtpSchema), employeeAuthController.verifyLoginOtp);
router.post('/login-password', validateRequest(loginPasswordSchema), employeeAuthController.loginPassword);

// Executive Password Recovery endpoints
router.post('/forgot-password', validateRequest(forgotPasswordSchema), employeeAuthController.forgotPassword);
router.post('/verify-recovery-otp', validateRequest(verifyRecoveryOtpSchema), employeeAuthController.verifyRecoveryOtp);
router.post('/reset-password', validateRequest(resetPasswordSchema), employeeAuthController.resetPassword);

// Session endpoints
router.post('/refresh', validateRequest(refreshSessionSchema), employeeAuthController.refresh);
router.post('/logout', employeeAuthController.logout);


export default router;
