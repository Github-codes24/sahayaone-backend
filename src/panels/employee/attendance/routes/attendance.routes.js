import { Router } from 'express';
import { attendanceController } from '../controllers/attendance.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import {
  punchInSchema,
  punchOutSchema,
  leaveSchema,
  reportQuerySchema
} from '../validators/attendance.validator.js';

const router = Router();

// Secure all attendance operations
router.use(rbacMiddleware.requireAuth);

router.get('/today', attendanceController.getTodayAttendance);
router.get('/history', attendanceController.getAttendanceHistory);
router.post('/punch-in', validateRequest(punchInSchema), attendanceController.punchIn);
router.post('/punch-out', validateRequest(punchOutSchema), attendanceController.punchOut);
router.get('/report', validateRequest(reportQuerySchema), attendanceController.getMonthlyReport);
router.post('/leave', validateRequest(leaveSchema), attendanceController.applyLeave);

export default router;
