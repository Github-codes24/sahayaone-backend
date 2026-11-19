import { Router } from 'express';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { superAdminAttendanceReportController } from '../controllers/super-admin-attendance-report.controller.js';
import {
  attendanceFilterQuerySchema,
  attendanceReportQuerySchema
} from '../../../society/attendance-report/validators/attendance-report.validator.js';

const router = Router();

router.use(rbacMiddleware.requireAuth);

router.get('/filters', validateRequest(attendanceFilterQuerySchema), superAdminAttendanceReportController.getFilters);
router.get('/single-person', superAdminAttendanceReportController.getSinglePersonReport);
router.get('/user/:id', superAdminAttendanceReportController.getSinglePersonReport);
router.get('/', validateRequest(attendanceReportQuerySchema), superAdminAttendanceReportController.getReport);

export default router;
