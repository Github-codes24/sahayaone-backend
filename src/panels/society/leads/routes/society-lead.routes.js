import { Router } from "express";
import { validateRequest } from "../../../../middlewares/request-validator.middleware.js";
import { rbacMiddleware } from "../../../../middlewares/rbac.middleware.js";
import { resolveSocietyContext } from "../../middlewares/society-context.middleware.js";
import { requireSocietyPermission } from "../../middlewares/society-permission.middleware.js";
import { societyLeadController } from "../controllers/society-lead.controller.js";
import {
  leadListSchema,
  leadIdSchema,
} from "../validators/society-lead.validator.js";

const router = Router();
router.use(rbacMiddleware.requireAuth, resolveSocietyContext);

router.get(
  "/export",
  requireSocietyPermission("lead.view"),
  validateRequest(leadListSchema),
  societyLeadController.exportCsv,
);

router.get(
  "/locations",
  requireSocietyPermission("lead.view"),
  societyLeadController.getLocations,
);

router.get(
  "/",
  requireSocietyPermission("lead.view"),
  validateRequest(leadListSchema),
  societyLeadController.list,
);

router.get(
  "/:id",
  requireSocietyPermission("lead.view"),
  validateRequest(leadIdSchema),
  societyLeadController.getById,
);

router.delete(
  "/:id",
  requireSocietyPermission("lead.delete"),
  validateRequest(leadIdSchema),
  societyLeadController.remove,
);

export default router;
