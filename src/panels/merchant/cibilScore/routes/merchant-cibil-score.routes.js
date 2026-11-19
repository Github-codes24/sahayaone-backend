import { Router } from 'express';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { merchantCibilScoreController } from '../controllers/merchant-cibil-score.controller.js';
import {
    checkCibilScoreSchema,
    cibilHistoryQuerySchema,
    cibilReportIdSchema
} from '../validators/merchant-cibil-score.validator.js';

const router = Router();

// Strict Auth: Require Token and ONLY Merchant or Vendor role
router.use(rbacMiddleware.requireAuth);
router.use(rbacMiddleware.requireRoles(['MERCHANT', 'VENDOR']));

// 1. Check / Generate CIBIL Score Report
router.post(
    '/',
    validateRequest(checkCibilScoreSchema),
    merchantCibilScoreController.checkCreditScore
);

// 2. Get CIBIL Score Report History
router.get(
    '/',
    validateRequest(cibilHistoryQuerySchema),
    merchantCibilScoreController.getHistory
);

// 3. Get CIBIL Score Report Detail by ID
router.get(
    '/:id',
    validateRequest(cibilReportIdSchema),
    merchantCibilScoreController.getById
);

export default router;
