import { Router } from 'express';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { merchantVerificationCreditsController } from '../controllers/merchant-verification-credits.controller.js';
import {
  requestCreditsSchema,
  listRequestsSchema
} from '../validators/merchant-verification-credits.validator.js';

const router = Router();

// Strict Auth: Require Token and ONLY Merchant or Vendor role
router.use(rbacMiddleware.requireAuth);
router.use(rbacMiddleware.requireRoles(['MERCHANT', 'VENDOR']));

// 0. Get available verification credit balance for merchant's assigned branch
router.get('/', merchantVerificationCreditsController.getCreditBalance);
router.get('/balance', merchantVerificationCreditsController.getCreditBalance);
router.get('/available', merchantVerificationCreditsController.getCreditBalance);

// 1. Submit request for verification credits to associated bank
router.post(
  '/request',
  validateRequest(requestCreditsSchema),
  merchantVerificationCreditsController.requestCredits
);

// 2. Get history of merchant verification credit requests
router.get(
  '/requests',
  validateRequest(listRequestsSchema, 'query'),
  merchantVerificationCreditsController.getRequestHistory
);

router.get(
  '/request-history',
  validateRequest(listRequestsSchema, 'query'),
  merchantVerificationCreditsController.getRequestHistory
);

export default router;
