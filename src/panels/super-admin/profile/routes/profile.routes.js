import { Router } from 'express';
import multer from 'multer';
import { superAdminProfileController } from '../controllers/profile.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { ApiError } from '../../../../common/api.error.js';
import { UserRole } from '../../../../constants/user-role.constant.js';
import {
  updateProfileSchema,
  changePasswordSchema,
  adminResetUserPasswordSchema
} from '../validators/profile.validator.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const uploadAvatarMiddleware = (req, res, next) => {
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'profileImage', maxCount: 1 },
    { name: 'file', maxCount: 1 },
    { name: 'image', maxCount: 1 }
  ])(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return next(ApiError.badRequest(`Avatar upload error: ${err.message}`));
      }
      return next(ApiError.badRequest(err.message));
    }
    next();
  });
};

const router = Router();

// Require authentication for all profile endpoints
router.use(rbacMiddleware.requireAuth);

// 1. Get Profile Details
router.get('/', superAdminProfileController.getProfile);

// 2. Update Profile Details & Avatar
router.put('/', uploadAvatarMiddleware, validateRequest(updateProfileSchema), superAdminProfileController.updateProfile);

// 3. Change Own Password ("Security" Tab)
router.post('/change-password', validateRequest(changePasswordSchema), superAdminProfileController.changePassword);

// 4. Super Admin Reset Password for Sub-Admin / Target User Account by ID
router.post(
  '/reset-user-password/:id',
  rbacMiddleware.requireRoles([UserRole.SUPER_ADMIN]),
  validateRequest(adminResetUserPasswordSchema),
  superAdminProfileController.resetUserPassword
);

export default router;
