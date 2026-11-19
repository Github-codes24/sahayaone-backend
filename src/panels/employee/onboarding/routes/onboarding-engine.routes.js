import { Router } from 'express';
import { onboardingEngineController } from '../controllers/onboarding-engine.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';

const router = Router();

router.use(rbacMiddleware.requireAuth);

router.get('/check-status', onboardingEngineController.checkStatus);

// GET /api/v1/employee/onboarding/banners (Retrieves onboarding active banners)
router.get('/banners', onboardingEngineController.getBanners);

// Branch Authorized Staff links / updates Customer's Society Bank Account
router.post(
  '/link-society-account',
  rbacMiddleware.requireRoles([
    'BRANCH_MANAGER',
    'BRANCH_STAFF',
    'BANK_ADMIN',
    'SUPER_ADMIN',
    'EMPLOYEE'
  ]),
  onboardingEngineController.linkSocietyAccount
);

export default router;
