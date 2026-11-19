import { Router } from 'express';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { onboardingAttendanceController } from '../controllers/onboarding-attendance.controller.js';
import {
  punchInSchema,
  punchOutSchema,
  leaveSchema,
  reportQuerySchema,
  monthlyAttendanceSheetQuerySchema
} from '../../../employee/attendance/validators/attendance.validator.js';

const router = Router();

router.use(rbacMiddleware.requireAuth);

router.get('/today', onboardingAttendanceController.getTodayAttendance);
router.post('/punch-in', validateRequest(punchInSchema), onboardingAttendanceController.punchIn);
router.post('/punch-out', validateRequest(punchOutSchema), onboardingAttendanceController.punchOut);
router.get('/report', validateRequest(reportQuerySchema), onboardingAttendanceController.getMonthlyReport);

router.get('/sheet', validateRequest(monthlyAttendanceSheetQuerySchema, 'query'), onboardingAttendanceController.getMonthlyAttendanceSheet);
router.get('/monthly-sheet', validateRequest(monthlyAttendanceSheetQuerySchema, 'query'), onboardingAttendanceController.getMonthlyAttendanceSheet);
router.get('/monthly-data', validateRequest(monthlyAttendanceSheetQuerySchema, 'query'), onboardingAttendanceController.getMonthlyAttendanceSheet);

router.get('/yearly-matrix', validateRequest(monthlyAttendanceSheetQuerySchema, 'query'), onboardingAttendanceController.getYearlyAttendanceMatrix);
router.get('/matrix', validateRequest(monthlyAttendanceSheetQuerySchema, 'query'), onboardingAttendanceController.getYearlyAttendanceMatrix);
router.get('/yearly-data', validateRequest(monthlyAttendanceSheetQuerySchema, 'query'), onboardingAttendanceController.getYearlyAttendanceMatrix);

router.get('/single-report', onboardingAttendanceController.getSinglePersonAttendanceReport);
router.get('/user/:id/report', onboardingAttendanceController.getSinglePersonAttendanceReport);

router.get('/history', onboardingAttendanceController.getAttendanceHistory);
router.post('/leave', validateRequest(leaveSchema), onboardingAttendanceController.applyLeave);

export default router;
