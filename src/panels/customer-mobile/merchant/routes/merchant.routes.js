import { Router } from 'express';
import { customerMerchantController } from '../controllers/merchant.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';

const router = Router();

// Require customer authentication
router.use(rbacMiddleware.requireAuth);

router.get('/profile', customerMerchantController.getProfile);
router.get('/', customerMerchantController.getProfile);
router.get('/shops/:id', customerMerchantController.getShopDetails);
router.get('/summary', customerMerchantController.getSummary);
router.get('/:id', customerMerchantController.getShopDetails);

export default router;
