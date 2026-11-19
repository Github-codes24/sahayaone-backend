import { Router } from 'express';
import { merchantCatalogController } from '../controllers/merchant-catalog.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';

const router = Router();

// Strict Auth: Require Token and ONLY Merchant or Vendor role
router.use(rbacMiddleware.requireAuth);
router.use(rbacMiddleware.requireRoles(['MERCHANT', 'VENDOR']));

// 7. GET CATALOG BRANDS
router.get('/brands', merchantCatalogController.getCatalogBrands);

// 8. GET CATALOG PRODUCTS
router.get('/products', merchantCatalogController.getCatalogProducts);

// 9. GET CATALOG PRODUCT VARIANTS
router.get('/products/:id/variants', merchantCatalogController.getCatalogVariants);

export default router;
