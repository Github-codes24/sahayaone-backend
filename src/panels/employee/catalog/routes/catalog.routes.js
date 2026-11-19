import { Router } from 'express';
import { employeeCatalogController } from '../controllers/catalog.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';

const router = Router();

// Secure all catalog endpoints
router.use(rbacMiddleware.requireAuth);

router.get('/services', employeeCatalogController.getCatalogServices);
router.get('/categories', employeeCatalogController.getCatalogCategories);
router.get('/brands', employeeCatalogController.getCatalogBrands);
router.get('/products', employeeCatalogController.getCatalogProducts);
router.get('/products/:id/variants', employeeCatalogController.getCatalogVariants);

export default router;
