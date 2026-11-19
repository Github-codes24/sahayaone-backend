import { Router } from 'express';
import { customerProfileController } from '../controllers/profile.controller.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { uploadSingleImage } from '../../../../middlewares/upload.middleware.js';
import { updateProfileSchema } from '../validators/profile.validator.js';

const router = Router();

// Require authenticated session
router.use(rbacMiddleware.requireAuth);

// GET profile details
router.get('/', customerProfileController.getSelf);
router.get('/profile', customerProfileController.getSelf);
router.get('/me', customerProfileController.getSelf);

// PUT profile details (supports both avatar upload and email update)
router.put('/', uploadSingleImage('avatar'), validateRequest(updateProfileSchema), customerProfileController.updateSelf);
router.put('/update', uploadSingleImage('avatar'), validateRequest(updateProfileSchema), customerProfileController.updateSelf);

export default router;
