import { Router } from 'express';
import { accountDeletionController } from '../controllers/account-deletion.controller.js';
import { validateRequest } from '../../../middlewares/request-validator.middleware.js';
import { requestOtpSchema, verifyAndDeleteSchema } from '../validators/account-deletion.validator.js';

const router = Router();
//asd
/**
 * @route POST /api/v1/account-deletion/request-otp (or /api/v1/deletion/request-otp)
 * @desc Public unauthenticated endpoint to request account deletion OTP for Customer, Loan Executive, or Bank Onboarding
 * @access Public
 */
router.post(
  '/request-otp',
  validateRequest(requestOtpSchema),
  accountDeletionController.requestOtp
);

/**
 * @route POST /api/v1/account-deletion/verify-and-delete (or /api/v1/deletion/verify-and-delete)
 * @desc Public unauthenticated endpoint to verify OTP and complete account deletion
 * @access Public
 */
router.post(
  '/verify-and-delete',
  validateRequest(verifyAndDeleteSchema),
  accountDeletionController.verifyAndDelete
);

export default router;
