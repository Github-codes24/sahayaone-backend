import { Router } from 'express';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { superAdminAttendanceController } from '../controllers/super-admin-attendance.controller.js';
import {
  punchInSchema,
  punchOutSchema,
  leaveSchema,
  reportQuerySchema,
  monthlyAttendanceSheetQuerySchema
} from '../../../employee/attendance/validators/attendance.validator.js';

const router = Router();

// Secure all Super Admin attendance operations with RBAC Auth
router.use(rbacMiddleware.requireAuth);

// Get today's attendance snapshot & status for logged-in super admin user
router.get('/today', superAdminAttendanceController.getTodayAttendance);

// Punch-In from Super Admin Panel
router.post('/punch-in', validateRequest(punchInSchema), superAdminAttendanceController.punchIn);

// Punch-Out from Super Admin Panel
router.post('/punch-out', validateRequest(punchOutSchema), superAdminAttendanceController.punchOut);

// Get monthly attendance summary report
router.get('/report', validateRequest(reportQuerySchema), superAdminAttendanceController.getMonthlyReport);

// Get all admin monthly attendance sheet/data (showing ONLY admin users)
router.get('/sheet', validateRequest(monthlyAttendanceSheetQuerySchema, 'query'), superAdminAttendanceController.getMonthlyAttendanceSheet);
router.get('/monthly-sheet', validateRequest(monthlyAttendanceSheetQuerySchema, 'query'), superAdminAttendanceController.getMonthlyAttendanceSheet);
router.get('/monthly-data', validateRequest(monthlyAttendanceSheetQuerySchema, 'query'), superAdminAttendanceController.getMonthlyAttendanceSheet);

// Get all admin yearly attendance matrix data (JAN to DEC present days & avg attendance %)
router.get('/yearly-matrix', validateRequest(monthlyAttendanceSheetQuerySchema, 'query'), superAdminAttendanceController.getYearlyAttendanceMatrix);
router.get('/matrix', validateRequest(monthlyAttendanceSheetQuerySchema, 'query'), superAdminAttendanceController.getYearlyAttendanceMatrix);
router.get('/yearly-data', validateRequest(monthlyAttendanceSheetQuerySchema, 'query'), superAdminAttendanceController.getYearlyAttendanceMatrix);

// Get single admin person monthly and yearly attendance report
router.get('/single-report', superAdminAttendanceController.getSinglePersonAttendanceReport);
router.get('/user/:id/report', superAdminAttendanceController.getSinglePersonAttendanceReport);
router.get('/user-report', superAdminAttendanceController.getSinglePersonAttendanceReport);

// Get detailed date-wise attendance history logs
router.get('/history', superAdminAttendanceController.getAttendanceHistory);

// Submit leave request from Super Admin Panel
router.post('/leave', validateRequest(leaveSchema), superAdminAttendanceController.applyLeave);

export default router;
