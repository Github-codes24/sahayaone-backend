import { Router } from 'express';
import { supportSettingsController } from '../controllers/support-settings.controller.js';
import { rbacMiddleware } from '../../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../../middlewares/request-validator.middleware.js';
import { updateSupportSettingSchema } from '../validators/support-settings.validator.js';

const router = Router();

router.use(rbacMiddleware.requireAuth);
router.use(rbacMiddleware.requireRoles(['SUPER_ADMIN', 'SUB_ADMIN']));

router.get('/', rbacMiddleware.requirePermission('settings:view_only'), supportSettingsController.getSupportSettings);

router.put(
  '/',
  rbacMiddleware.requirePermission('settings:edit'),
  validateRequest(updateSupportSettingSchema),
  supportSettingsController.updateSupportSettings
);

export default router;
