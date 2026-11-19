import { Router } from 'express';
import { modelsController } from '../controllers/models.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { uploadSingleImage } from '../../../../middlewares/upload.middleware.js';
import { createModelSchema, updateModelSchema } from '../validators/models.validator.js';

const router = Router();

router.use(rbacMiddleware.requireAuth);
router.use(rbacMiddleware.requireRoles(['SUPER_ADMIN', 'SUB_ADMIN']));

router.get('/', rbacMiddleware.requirePermission('products:view_only'), modelsController.listModels);
router.get('/:id', rbacMiddleware.requirePermission('products:view_only'), modelsController.getModelById);

router.post(
  '/',
  rbacMiddleware.requirePermission('products:create'),
  uploadSingleImage('image'),
  validateRequest(createModelSchema),
  modelsController.createModel
);

router.put(
  '/:id',
  rbacMiddleware.requirePermission('products:edit'),
  uploadSingleImage('image'),
  validateRequest(updateModelSchema),
  modelsController.updateModel
);

router.delete('/:id', rbacMiddleware.requirePermission('products:delete'), modelsController.deleteModel);

export default router;
