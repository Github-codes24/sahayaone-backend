import { Router } from 'express';
import { brandsController } from '../controllers/brands.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { uploadSingleImage } from '../../../../middlewares/upload.middleware.js';
import { createBrandSchema, updateBrandSchema } from '../validators/brands.validator.js';

const router = Router();

router.use(rbacMiddleware.requireAuth);
router.use(rbacMiddleware.requireRoles(['SUPER_ADMIN', 'SUB_ADMIN']));

router.get('/dropdown', rbacMiddleware.requirePermission('brands:view_only'), brandsController.listBrandsDropdown);

router.get('/', rbacMiddleware.requirePermission('brands:view_only'), brandsController.listBrands);
router.get('/:id', rbacMiddleware.requirePermission('brands:view_only'), brandsController.getBrandById);

router.post(
  '/',
  rbacMiddleware.requirePermission('brands:create'),
  uploadSingleImage('image'),
  validateRequest(createBrandSchema),
  brandsController.createBrand
);

router.put(
  '/:id',
  rbacMiddleware.requirePermission('brands:edit'),
  uploadSingleImage('image'),
  validateRequest(updateBrandSchema),
  brandsController.updateBrand
);

router.delete('/:id', rbacMiddleware.requirePermission('brands:delete'), brandsController.deleteBrand);

export default router;
