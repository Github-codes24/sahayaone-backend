import { Router } from "express";
import { societyRoleController } from "../controllers/society-role.controller.js";
import { validateRequest } from "../../../../middlewares/request-validator.middleware.js";
import { rbacMiddleware } from "../../../../middlewares/rbac.middleware.js";
import { resolveSocietyContext } from "../../middlewares/society-context.middleware.js";
import { requireSocietyPermission } from "../../middlewares/society-permission.middleware.js";
import {
  createRoleSchema,
  updateRoleSchema,
  roleQuerySchema,
} from "../validators/society-role.validator.js";

const router = Router();

// Apply Authentication and Context Resolution globally across all role endpoints
router.use(rbacMiddleware.requireAuth, resolveSocietyContext);

// Society Roles Management (Protected by Society Permission Middleware)
router.post(
  "/",
  requireSocietyPermission("role.create"),
  validateRequest(createRoleSchema),
  societyRoleController.createRole,
);
router.get(
  "/",
  requireSocietyPermission("role.view"),
  validateRequest(roleQuerySchema, "query"),
  societyRoleController.getRoles,
);
router.get(
  "/:id",
  requireSocietyPermission("role.view"),
  societyRoleController.getRoleById,
);
router.put(
  "/:id",
  requireSocietyPermission("role.update"),
  validateRequest(updateRoleSchema),
  societyRoleController.updateRole,
);
router.delete(
  "/:id",
  requireSocietyPermission("role.delete"),
  societyRoleController.deleteRole,
);

export default router;
