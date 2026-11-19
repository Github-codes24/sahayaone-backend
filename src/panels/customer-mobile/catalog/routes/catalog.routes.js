import { Router } from 'express';
import { customerCatalogController } from '../controllers/catalog.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';

const router = Router();

// Apply auth middleware to protect all catalog endpoints
router.use(rbacMiddleware.requireAuth);

router.get('/banners', customerCatalogController.getBanners);
router.get('/services', customerCatalogController.getServices);
router.get('/loan-categories', customerCatalogController.getLoanCategories);
router.get('/brands', customerCatalogController.getBrands);
router.get('/products', customerCatalogController.getProducts);
router.get('/products/:id/variants', customerCatalogController.getProductVariants);
router.get('/search', customerCatalogController.search);

export default router;
