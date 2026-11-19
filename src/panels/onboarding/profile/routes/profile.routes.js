import { Router } from 'express';
import { onboardingProfileController } from '../controllers/profile.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import {
  changePasswordSchema,
  updateLocationSchema,
  punchInSchema,
  punchOutSchema,
  applyLeaveSchema
} from '../validators/profile.validator.js';

const router = Router();

// Secure all profile endpoints
router.use(rbacMiddleware.requireAuth);

router.get('/', onboardingProfileController.getProfile);
router.get('/attendance/today', onboardingProfileController.getTodayAttendance);
router.post('/punch-in', validateRequest(punchInSchema), onboardingProfileController.punchIn);
router.post('/punch-out', validateRequest(punchOutSchema), onboardingProfileController.punchOut);
router.get('/attendance/monthly-report', onboardingProfileController.getMonthlyReport);
router.get('/attendance/history', onboardingProfileController.getAttendanceHistory);
router.post('/leave', validateRequest(applyLeaveSchema), onboardingProfileController.applyLeave);
router.post('/change-password', validateRequest(changePasswordSchema), onboardingProfileController.changePassword);
router.post('/location', validateRequest(updateLocationSchema), onboardingProfileController.updateLocation);

export default router;
