import { Router } from 'express';
import { priceSettingsController } from '../controllers/price-settings.controller.js';
import { rbacMiddleware } from '../../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../../middlewares/request-validator.middleware.js';
import { updatePriceSettingSchema } from '../validators/price-settings.validator.js';

const router = Router();

router.use(rbacMiddleware.requireAuth);
router.use(rbacMiddleware.requireRoles(['SUPER_ADMIN', 'SUB_ADMIN']));

router.get('/', rbacMiddleware.requirePermission('settings:view_only'), priceSettingsController.getPriceSettings);

router.put(
  '/',
  rbacMiddleware.requirePermission('settings:edit'),
  validateRequest(updatePriceSettingSchema),
  priceSettingsController.updatePriceSettings
);

export default router;
