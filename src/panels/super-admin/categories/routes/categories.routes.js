import { Router } from 'express';
import { categoriesController } from '../controllers/categories.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { uploadSingleImage } from '../../../../middlewares/upload.middleware.js';
import { createCategorySchema, updateCategorySchema } from '../validators/categories.validator.js';

const router = Router();

router.use(rbacMiddleware.requireAuth);
router.use(rbacMiddleware.requireRoles(['SUPER_ADMIN', 'SUB_ADMIN']));

router.get('/dropdown', rbacMiddleware.requirePermission('categories:view_only'), categoriesController.listCategoriesDropdown);

router.get('/', rbacMiddleware.requirePermission('categories:view_only'), categoriesController.listCategories);
router.get('/:id', rbacMiddleware.requirePermission('categories:view_only'), categoriesController.getCategoryById);

router.post(
  '/',
  rbacMiddleware.requirePermission('categories:create'),
  uploadSingleImage('image'),
  validateRequest(createCategorySchema),
  categoriesController.createCategory
);

router.put(
  '/:id',
  rbacMiddleware.requirePermission('categories:edit'),
  uploadSingleImage('image'),
  validateRequest(updateCategorySchema),
  categoriesController.updateCategory
);

router.delete('/:id', rbacMiddleware.requirePermission('categories:delete'), categoriesController.deleteCategory);

export default router;
