import express from "express";
import { rbacMiddleware } from "../../middlewares/rbac.middleware.js";
import {
  getCustomerSIPsController,
  getSIPByIdController,
} from "../controllers/sip.controller.js";

const router = express.Router();

// ==========================================
// GET CUSTOMER SIPS
// GET /api/v1/sip/my-sips
// ==========================================
router.get(
  "/my-sips",
  rbacMiddleware.requireAuth,
  getCustomerSIPsController
);

// ==========================================
// GET SIP DETAILS BY ID
// GET /api/v1/sip/:id
// ==========================================
router.get(
  "/:id",
  rbacMiddleware.requireAuth,
  getSIPByIdController
);

export default router;
