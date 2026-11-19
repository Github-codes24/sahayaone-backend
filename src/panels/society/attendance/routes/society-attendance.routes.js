import { Router } from 'express';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { resolveSocietyContext } from '../../middlewares/society-context.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { societyAttendanceController } from '../controllers/society-attendance.controller.js';
import {
  punchInSchema,
  punchOutSchema,
  leaveSchema,
  reportQuerySchema,
  monthlyAttendanceSheetQuerySchema
} from '../../../employee/attendance/validators/attendance.validator.js';

const router = Router();

// Secure all society attendance operations with Auth and Society Tenant Context
router.use(rbacMiddleware.requireAuth, resolveSocietyContext);

// Get today's attendance snapshot & status for logged-in society employee / user
router.get('/today', societyAttendanceController.getTodayAttendance);

// Punch-In from Society Panel
router.post('/punch-in', validateRequest(punchInSchema), societyAttendanceController.punchIn);

// Punch-Out from Society Panel
router.post('/punch-out', validateRequest(punchOutSchema), societyAttendanceController.punchOut);

// Get monthly attendance summary report
router.get('/report', validateRequest(reportQuerySchema), societyAttendanceController.getMonthlyReport);

// Get all employee monthly attendance sheet/data (with branch filter for bank owner, city/state filter, search, & pagination)
router.get('/sheet', validateRequest(monthlyAttendanceSheetQuerySchema, 'query'), societyAttendanceController.getMonthlyAttendanceSheet);
router.get('/monthly-sheet', validateRequest(monthlyAttendanceSheetQuerySchema, 'query'), societyAttendanceController.getMonthlyAttendanceSheet);
router.get('/monthly-data', validateRequest(monthlyAttendanceSheetQuerySchema, 'query'), societyAttendanceController.getMonthlyAttendanceSheet);

// Get all employee yearly attendance matrix data (JAN to DEC present days & avg attendance %)
router.get('/yearly-matrix', validateRequest(monthlyAttendanceSheetQuerySchema, 'query'), societyAttendanceController.getYearlyAttendanceMatrix);
router.get('/matrix', validateRequest(monthlyAttendanceSheetQuerySchema, 'query'), societyAttendanceController.getYearlyAttendanceMatrix);
router.get('/yearly-data', validateRequest(monthlyAttendanceSheetQuerySchema, 'query'), societyAttendanceController.getYearlyAttendanceMatrix);

// Get single person monthly and yearly attendance report (with punch locations and 12-month summary matrix)
router.get('/single-report', societyAttendanceController.getSinglePersonAttendanceReport);
router.get('/employee/:id/report', societyAttendanceController.getSinglePersonAttendanceReport);
router.get('/employee-report', societyAttendanceController.getSinglePersonAttendanceReport);

// Get detailed date-wise attendance history logs with filters (automatic role hierarchy for Bank Owner, Branch Manager, Employee)
router.get('/history', societyAttendanceController.getAttendanceHistory);

// Submit leave request from Society Panel
router.post('/leave', validateRequest(leaveSchema), societyAttendanceController.applyLeave);

export default router;
