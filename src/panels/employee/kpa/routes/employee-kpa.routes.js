import { Router } from 'express';
import { employeeKpaController } from '../controllers/employee-kpa.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';

const router = Router();

// Secure all endpoints under this router for employee panel authenticated users
router.use(rbacMiddleware.requireAuth);

// GET /api/v1/employee/kpa - Get logged in employee's KPA progress detail
router.get('/kpa', employeeKpaController.getMyKpaReportDetail);
router.get('/kpa-reports/detail', employeeKpaController.getMyKpaReportDetail);

// GET & POST /api/v1/employee/work-reports
router.get('/work-reports', employeeKpaController.getMyDailyWorkReports);
router.post('/work-reports', employeeKpaController.createMyDailyWorkReport);

export default router;
