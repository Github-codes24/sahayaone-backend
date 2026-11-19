import { Router } from 'express';
import { superAdminDashboardController } from '../controllers/dashboard.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { getDashboardOverviewSchema } from '../validators/dashboard.validator.js';

const router = Router();

// Authentication and role authorization middleware
router.use(rbacMiddleware.requireAuth);
router.use(rbacMiddleware.requireRoles(['SUPER_ADMIN', 'SUB_ADMIN', 'HO_ADMIN', 'EMPLOYEE']));

// Get Super Admin Dashboard overview (KPI Cards, Total Revenue Chart, Loan Sales Chart, Sales Contribution Pie Chart, Last 5 Actions)
router.get(
  '/',
  rbacMiddleware.requirePermission('dashboard:view_only'),
  validateRequest(getDashboardOverviewSchema),
  superAdminDashboardController.getOverview
);

export default router;
