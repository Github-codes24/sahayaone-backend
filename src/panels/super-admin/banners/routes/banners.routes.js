import { Router } from 'express';
import { bannersController } from '../controllers/banners.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { uploadSingleImage } from '../../../../middlewares/upload.middleware.js';
import { createBannerSchema, updateBannerSchema } from '../validators/banners.validator.js';

const router = Router();

// Secure all endpoints for logged-in Admin access (Super-Admin / Sub-Admin)
router.use(rbacMiddleware.requireAuth);
router.use(rbacMiddleware.requireRoles(['SUPER_ADMIN', 'SUB_ADMIN']));

// Define CRUD routes for Banners with permission checks
router.get('/', rbacMiddleware.requirePermission('banner_management:view_only'), bannersController.listBanners);
router.get('/:id', rbacMiddleware.requirePermission('banner_management:view_only'), bannersController.getBannerById);

router.post(
  '/',
  rbacMiddleware.requirePermission('banner_management:create'),
  uploadSingleImage('image'),
  validateRequest(createBannerSchema),
  bannersController.createBanner
);

router.put(
  '/:id',
  rbacMiddleware.requirePermission('banner_management:edit'),
  uploadSingleImage('image'),
  validateRequest(updateBannerSchema),
  bannersController.updateBanner
);

router.delete('/:id', rbacMiddleware.requirePermission('banner_management:delete'), bannersController.deleteBanner);

export default router;
