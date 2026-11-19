import { Router } from 'express';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { resolveSocietyContext } from '../../middlewares/society-context.middleware.js';
import { requireSocietyPermission } from '../../middlewares/society-permission.middleware.js';
import { attendanceReportController } from '../controllers/attendance-report.controller.js';
import {
  attendanceFilterQuerySchema,
  attendanceReportQuerySchema
} from '../validators/attendance-report.validator.js';

const router = Router();
router.use(rbacMiddleware.requireAuth, resolveSocietyContext);
router.get('/filters', requireSocietyPermission('attendance.view'), validateRequest(attendanceFilterQuerySchema), attendanceReportController.getFilters);

router.get('/single-person', requireSocietyPermission('attendance.view'), attendanceReportController.getSinglePersonReport);
router.get('/employee/:id', requireSocietyPermission('attendance.view'), attendanceReportController.getSinglePersonReport);

router.get('/', requireSocietyPermission('attendance.view'), validateRequest(attendanceReportQuerySchema), attendanceReportController.getReport);

export default router;
