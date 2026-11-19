import { Router } from 'express';
import { productsController } from '../controllers/products.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { uploadSingleImage } from '../../../../middlewares/upload.middleware.js';
import { createProductSchema, updateProductSchema } from '../validators/products.validator.js';

const router = Router();

router.use(rbacMiddleware.requireAuth);
router.use(rbacMiddleware.requireRoles(['SUPER_ADMIN', 'SUB_ADMIN']));

router.get('/dropdown', rbacMiddleware.requirePermission('products:view_only'), productsController.listProductsDropdown);

router.get('/', rbacMiddleware.requirePermission('products:view_only'), productsController.listProducts);
router.get('/:id', rbacMiddleware.requirePermission('products:view_only'), productsController.getProductById);

router.post(
  '/',
  rbacMiddleware.requirePermission('products:create'),
  uploadSingleImage('image'),
  validateRequest(createProductSchema),
  productsController.createProduct
);

router.put(
  '/:id',
  rbacMiddleware.requirePermission('products:edit'),
  uploadSingleImage('image'),
  validateRequest(updateProductSchema),
  productsController.updateProduct
);

router.delete('/:id', rbacMiddleware.requirePermission('products:delete'), productsController.deleteProduct);

export default router;
