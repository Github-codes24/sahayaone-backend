import { Router } from "express";
import { creditReportController } from '../controllers/cibilScore.controller.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { resolveSocietyContext } from '../../middlewares/society-context.middleware.js';
import { requireSocietyPermission } from '../../middlewares/society-permission.middleware.js';
import {
    checkCibilScoreSchema,
    cibilHistoryQuerySchema,
    cibilReportIdSchema
} from '../validators/cibilScore.validator.js';

const router = Router();

router.use(rbacMiddleware.requireAuth, resolveSocietyContext);

// Check / Generate CIBIL Score Report (Requires 'credit_score.create' permission)
router.post(
    '/',
    requireSocietyPermission('credit_score.create'),
    validateRequest(checkCibilScoreSchema),
    creditReportController.checkCreditScore
);

// Get CIBIL Score Report History (Requires 'credit_score.view' permission)
router.get(
    '/',
    requireSocietyPermission('credit_score.view'),
    validateRequest(cibilHistoryQuerySchema),
    creditReportController.getHistory
);

// Get CIBIL Score Report Detail by ID or requestId (Requires 'credit_score.view' permission)
router.get(
    '/:id',
    requireSocietyPermission('credit_score.view'),
    validateRequest(cibilReportIdSchema),
    creditReportController.getById
);

export default router;