import { Router } from 'express';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { resolveSocietyContext } from '../../middlewares/society-context.middleware.js';
import { requireSocietyPermission } from '../../middlewares/society-permission.middleware.js';
import { SOCIETY_PERMISSIONS } from '../../../../constants/society-permission.constant.js';
import { kycVerificationController } from '../controllers/kyc-verification.controller.js';
import {
  initiateKycSchema,
  completeKycSchema,
  kycRefIdSchema,
  downloadDocSchema,
  kycHistoryQuerySchema
} from '../validators/kyc-verification.validator.js';

const router = Router();

router.use(rbacMiddleware.requireAuth, resolveSocietyContext);

// Initiate DigiLocker KYC Session (Requires 'kyc.create' permission)
router.post(
  '/initiate',
  requireSocietyPermission(SOCIETY_PERMISSIONS.KYC.CREATE),
  validateRequest(initiateKycSchema),
  kycVerificationController.initiate
);

// Complete DigiLocker KYC Session (Requires 'kyc.create' permission)
router.post(
  '/complete',
  requireSocietyPermission(SOCIETY_PERMISSIONS.KYC.CREATE),
  validateRequest(completeKycSchema),
  kycVerificationController.complete
);

// Get KYC Verification History (Requires 'kyc.view' permission)
router.get(
  '/history',
  requireSocietyPermission(SOCIETY_PERMISSIONS.KYC.VIEW),
  validateRequest(kycHistoryQuerySchema),
  kycVerificationController.getHistory
);

// Get KYC Report by Ref ID (Requires 'kyc.view' permission)
router.get(
  '/report/:refid',
  requireSocietyPermission(SOCIETY_PERMISSIONS.KYC.VIEW),
  validateRequest(kycRefIdSchema),
  kycVerificationController.getReport
);

// Download KYC PDF Report (Requires 'kyc.view' permission)
router.get(
  '/report/:refid/download-pdf/:documentType',
  requireSocietyPermission(SOCIETY_PERMISSIONS.KYC.VIEW),
  validateRequest(downloadDocSchema),
  kycVerificationController.downloadPdfDocument
);

export default router;
