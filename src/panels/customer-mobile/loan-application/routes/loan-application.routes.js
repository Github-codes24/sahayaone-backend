import { Router } from 'express';
import { customerLoanApplicationController } from '../controllers/loan-application.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import {
  createApplicationSchema,
  submitPersonalDetailsSchema,
  verifyOtpSchema
} from '../validators/loan-application.validator.js';

const router = Router();

// Protect all application endpoints
router.use(rbacMiddleware.requireAuth);

router.post('/', validateRequest(createApplicationSchema), customerLoanApplicationController.createApplication);

router.post(
  '/:id/personal-details',
  validateRequest(submitPersonalDetailsSchema),
  customerLoanApplicationController.submitPersonalDetails
);

router.post(
  '/:id/verify-aadhaar-otp',
  validateRequest(verifyOtpSchema),
  customerLoanApplicationController.verifyAadhaarOtp
);

router.post('/:id/trigger-address-otp', customerLoanApplicationController.triggerAddressOtp);

router.post(
  '/:id/verify-address-otp',
  validateRequest(verifyOtpSchema),
  customerLoanApplicationController.verifyAddressOtp
);

router.post('/:id/submit', customerLoanApplicationController.submitApplication);

export default router;
