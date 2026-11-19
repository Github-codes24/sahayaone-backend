import { Router } from 'express';
import { superAdminAuthController } from '../controllers/auth.controller.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import {
  loginSchema,
  forgotPasswordSchema,
  verifyOtpSchema,
  resetPasswordSchema,
  refreshSessionSchema
} from '../validators/auth.validator.js';

const router = Router();

// Route: GET /api/v1/super-admin/auth/roles (Public)
router.get('/roles', superAdminAuthController.getRoles);

// Route: POST /api/v1/super-admin/auth/login
router.post('/login', validateRequest(loginSchema), superAdminAuthController.login);

// Route: POST /api/v1/super-admin/auth/forgot-password
router.post('/forgot-password', validateRequest(forgotPasswordSchema), superAdminAuthController.forgotPassword);

// Route: POST /api/v1/super-admin/auth/resend-otp
router.post('/resend-otp', validateRequest(forgotPasswordSchema), superAdminAuthController.resendOtp);

// Route: POST /api/v1/super-admin/auth/verify-otp
router.post('/verify-otp', validateRequest(verifyOtpSchema), superAdminAuthController.verifyOtp);

// Route: POST /api/v1/super-admin/auth/reset-password
router.post('/reset-password', validateRequest(resetPasswordSchema), superAdminAuthController.resetPassword);

// Route: POST /api/v1/super-admin/auth/refresh
router.post('/refresh', validateRequest(refreshSessionSchema), superAdminAuthController.refresh);

// Route: POST /api/v1/super-admin/auth/logout
router.post('/logout', superAdminAuthController.logout);

export default router;
