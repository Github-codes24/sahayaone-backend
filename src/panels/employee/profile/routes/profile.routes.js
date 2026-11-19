import { Router } from 'express';
import { employeeProfileController } from '../controllers/profile.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { changePasswordSchema, updateLocationSchema } from '../validators/profile.validator.js';

const router = Router();

// Secure all profile operations
router.use(rbacMiddleware.requireAuth);

router.get('/', employeeProfileController.getProfile);
router.post('/change-password', validateRequest(changePasswordSchema), employeeProfileController.changePassword);
router.post('/location', validateRequest(updateLocationSchema), employeeProfileController.updateLocation);

export default router;
