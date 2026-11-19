// import { Router } from "express";

// import {
//   createBankCustomerSIPController,
// } from "../controllers/bank-sip.controller.js";

// const router = Router();

// router.post(
//   "/",

//   createBankCustomerSIPController
// );

// export default router;





import express from "express";
import { rbacMiddleware } from "../../middlewares/rbac.middleware.js";
import { resolveSocietyContext } from "../../panels/society/middlewares/society-context.middleware.js";
import {
  createBankCustomerSIPController,
} from "../controllers/bank-sip.controller.js";

const router = express.Router();

// ==========================================
// CREATE CUSTOMER SIP (BANK EMPLOYEE)
// POST /api/v1/sip/bank
// ==========================================
router.post(
  "/",
  rbacMiddleware.requireAuth,
  resolveSocietyContext,
  createBankCustomerSIPController
);

export default router;