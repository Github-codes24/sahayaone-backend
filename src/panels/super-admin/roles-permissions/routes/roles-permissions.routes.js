import { Router } from 'express';
import { rolesPermissionsController } from '../controllers/roles-permissions.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { createSubAdminSchema, updateSubAdminSchema } from '../validators/roles-permissions.validator.js';

const router = Router();

// Secure all endpoints for Super-Admin access only
router.use(rbacMiddleware.requireAuth);
router.use(rbacMiddleware.requireRoles(['SUPER_ADMIN']));

// Define CRUD routes for roles and permissions (Sub-Admins)
router.get('/', rolesPermissionsController.listSubAdmins);
router.get('/permissions', rolesPermissionsController.getPermissions);
router.get('/:id', rolesPermissionsController.getSubAdminById);
router.post('/', validateRequest(createSubAdminSchema), rolesPermissionsController.createSubAdmin);
router.put('/:id', validateRequest(updateSubAdminSchema), rolesPermissionsController.updateSubAdmin);
router.delete('/:id', rolesPermissionsController.deleteSubAdmin);

export default router;
