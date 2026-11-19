import { Router } from 'express';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { resolveSocietyContext } from '../../middlewares/society-context.middleware.js';
import { requireSocietyPermission } from '../../middlewares/society-permission.middleware.js';
import { societyReportController } from '../controllers/society-report.controller.js';
import {
  reportCatalogSchema,
  getReportSchema,
  exportReportSchema
} from '../validators/society-report.validator.js';

const router = Router();

// Protect all report routes with auth and isolated society tenant context
router.use(rbacMiddleware.requireAuth, resolveSocietyContext);

// 1. Catalog of all available reports
router.get(
  '/catalog',
  requireSocietyPermission('report.view'),
  validateRequest(reportCatalogSchema),
  societyReportController.getCatalog
);

// 2. Export specific report to CSV
router.get(
  '/:reportType/export',
  requireSocietyPermission('report.export'),
  validateRequest(exportReportSchema),
  societyReportController.exportReport
);

// 3. View/Generate specific report with date range filtering and pagination
router.get(
  '/:reportType',
  requireSocietyPermission('report.view'),
  validateRequest(getReportSchema),
  societyReportController.getReport
);

export default router;
