import { Router } from 'express';
import { employeeDashboardController } from '../controllers/dashboard.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';

const router = Router();

// Secure all endpoints under this router
router.use(rbacMiddleware.requireAuth);
router.use(rbacMiddleware.requireRoles([
  'EMPLOYEE',
  'LOAN_EXECUTIVE',
  'COLLECTION_EXECUTIVE',
  'SUPER_ADMIN',
  'BRANCH_MANAGER',
  'SOCIETY_ADMIN',
  'BANK_OWNER',
  'VENDOR',
  'MERCHANT'
]));

// GET /api/v1/employee/dashboard/banners (Retrieves executive banners, optional ?bannerType=Top Slider)
router.get('/banners', employeeDashboardController.getBanners);

// GET /api/v1/employee/dashboard/business-cards (and aliases: /overview, /cards, /business-summary, /portfolio)
router.get('/business-cards', employeeDashboardController.getBusinessCards);
router.get('/overview', employeeDashboardController.getBusinessCards);
router.get('/cards', employeeDashboardController.getBusinessCards);
router.get('/business-summary', employeeDashboardController.getBusinessCards);
router.get('/portfolio', employeeDashboardController.getBusinessCards);

// GET /api/v1/employee/dashboard/stats (Also includes businessCards directly)
router.get('/stats', employeeDashboardController.getStats);

export default router;
