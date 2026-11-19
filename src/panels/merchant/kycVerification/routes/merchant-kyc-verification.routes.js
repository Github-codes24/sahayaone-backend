import { Router } from 'express';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { merchantKycVerificationController } from '../controllers/merchant-kyc-verification.controller.js';
import {
  initiateKycSchema,
  completeKycSchema,
  kycRefIdSchema,
  downloadDocSchema,
  kycHistoryQuerySchema
} from '../validators/merchant-kyc-verification.validator.js';

const router = Router();

// Strict Auth: Require Token and ONLY Merchant or Vendor role
router.use(rbacMiddleware.requireAuth);
router.use(rbacMiddleware.requireRoles(['MERCHANT', 'VENDOR']));

// 1. Initiate DigiLocker KYC Session
router.post(
  '/initiate',
  validateRequest(initiateKycSchema),
  merchantKycVerificationController.initiate
);

// 2. Complete DigiLocker KYC Session
router.post(
  '/complete',
  validateRequest(completeKycSchema),
  merchantKycVerificationController.complete
);

// 3. Get KYC Verification History for Merchant
router.get(
  '/history',
  validateRequest(kycHistoryQuerySchema),
  merchantKycVerificationController.getHistory
);

// 4. Get KYC Report by Ref ID
router.get(
  '/report/:refid',
  validateRequest(kycRefIdSchema),
  merchantKycVerificationController.getReport
);

// 5. Download KYC PDF Report
router.get(
  '/report/:refid/download-pdf/:documentType',
  validateRequest(downloadDocSchema),
  merchantKycVerificationController.downloadPdfDocument
);

export default router;
