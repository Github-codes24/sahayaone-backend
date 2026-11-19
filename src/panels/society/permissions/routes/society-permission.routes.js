import { Router } from 'express';
import { societyPermissionController } from '../controllers/society-permission.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { resolveSocietyContext } from '../../middlewares/society-context.middleware.js';

const router = Router();

// Authentication and Context Resolution Required
router.use(rbacMiddleware.requireAuth, resolveSocietyContext);

// GET /api/v1/society/permissions
router.get('/', societyPermissionController.getPermissions);

export default router;