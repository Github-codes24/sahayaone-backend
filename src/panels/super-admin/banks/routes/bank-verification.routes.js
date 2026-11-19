import { Router } from 'express';
import { bankVerificationController } from '../controllers/bank-verification.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { verifyBankSchema, allotCreditsSchema } from '../validators/bank-verification.validator.js';

const router = Router();

// Secure all super-admin endpoints
router.use(rbacMiddleware.requireAuth);

router.post('/:id/verify', rbacMiddleware.requirePermission('bank_onboarding:verify'), validateRequest(verifyBankSchema), bankVerificationController.verifyBank);
router.post('/:id/allot-credits', rbacMiddleware.requirePermission('bank_onboarding:verify'), validateRequest(allotCreditsSchema), bankVerificationController.allotCredits);

export default router;
