import { Router } from "express";
import { cashPaymentController } from "../controllers/cashPayment.controller.js";
import { validateRequest } from "../../../../middlewares/request-validator.middleware.js";
import { rbacMiddleware } from "../../../../middlewares/rbac.middleware.js";
import { resolveSocietyContext } from "../../middlewares/society-context.middleware.js";
import { requireSocietyPermission } from "../../middlewares/society-permission.middleware.js";

import {
  listCashPaymentsSchema,
  getCashPaymentDetailsSchema,
  submitCashSchema,
} from "../validators/cashPayment.validator.js";

const router = Router();

/**
 * Authentication + Society Context
 * (same pattern as branches/employees/roles — resolves bankId/branchId/permissions
 * fresh from the DB per-request; Bank Owner gets implicit full access)
 */
router.use(rbacMiddleware.requireAuth, resolveSocietyContext);

/**
 * GET
 * List Employees
 */
router.get(
  "/",
  requireSocietyPermission("cash_payment.view"),
  validateRequest(listCashPaymentsSchema),
  cashPaymentController.list,
);

/**
 * GET
 * List Available States and Cities
 */
router.get(
  "/locations",
  requireSocietyPermission("cash_payment.view"),
  cashPaymentController.getLocations,
);

router.get(
  "/cities-states",
  requireSocietyPermission("cash_payment.view"),
  cashPaymentController.getLocations,
);

/**
 * GET
 * Employee Details
 */
router.get(
  "/:id",
  requireSocietyPermission("cash_payment.view"),
  validateRequest(getCashPaymentDetailsSchema),
  cashPaymentController.getById,
);


/**
 * POST
 * Submit Cash
 */
router.post(
  "/:id/submit-cash",
  requireSocietyPermission("cash_payment.create"),
  validateRequest(submitCashSchema),
  cashPaymentController.submitCash,
);

export default router;
