import { Router } from 'express';
import multer from 'multer';
import { societyProfileController,
         handleRazorpayOAuthCallback,
         getRazorpayConnectionStatus,
         initiateRazorpayConnect
 } from '../controllers/society-profile.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { resolveSocietyContext } from '../../middlewares/society-context.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { ApiError } from '../../../../common/api.error.js';
import {
  updateSocietyProfileSchema,
  changeSocietyPasswordSchema
} from '../validators/society-profile.validator.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const uploadProfileAvatarMiddleware = (req, res, next) => {
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

// Apply auth middleware to all profile routes
router.use(rbacMiddleware.requireAuth);

// GET /api/v1/society/profile
router.get('/', resolveSocietyContext, societyProfileController.getProfile);

// PUT /api/v1/society/profile (supports JSON body, base64 avatar, or multipart/form-data image upload)
router.put('/', resolveSocietyContext, uploadProfileAvatarMiddleware, validateRequest(updateSocietyProfileSchema), societyProfileController.updateProfile);

// PATCH /api/v1/society/profile (supports JSON body, base64 avatar, or multipart/form-data image upload)
router.patch('/', resolveSocietyContext, uploadProfileAvatarMiddleware, validateRequest(updateSocietyProfileSchema), societyProfileController.updateProfile);

// POST /api/v1/society/profile/change-password
router.post('/change-password', validateRequest(changeSocietyPasswordSchema), societyProfileController.changePassword);

// PUT /api/v1/society/profile/change-password
router.put('/change-password', validateRequest(changeSocietyPasswordSchema), societyProfileController.changePassword);




// Public Callback Route (No Auth Middleware)
router.get('/razorpay/callback', handleRazorpayOAuthCallback);

// Protected Bank Dashboard Routes (With your existing auth middleware)
router.get('/razorpay/status',  getRazorpayConnectionStatus);
router.get('/razorpay/connect',  initiateRazorpayConnect);
export default router;

