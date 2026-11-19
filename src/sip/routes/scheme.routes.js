import express from "express";

import { rbacMiddleware } from "../../middlewares/rbac.middleware.js";

import {
  resolveSocietyContext
} from '../../panels/society/middlewares/society-context.middleware.js';

import {requireSipBankOwner} from "../middleware/sip-permission.middleware.js";

import {
  createSchemeController,
  getActiveSchemesController,
  getSchemeByIdController,
  updateSchemeController,
  updateSchemeStatusController,
} from "../controllers/scheme.controller.js";

const router = express.Router();


// ==========================================
// CREATE SCHEME
// POST /api/sip/schemes
// ==========================================

router.post(
  "/",
  rbacMiddleware.requireAuth,
  resolveSocietyContext,
  requireSipBankOwner,
  createSchemeController
);


// ==========================================
// GET ACTIVE SCHEMES
// GET /api/sip/schemes
// ==========================================

router.get(
  "/",
  // rbacMiddleware.requireAuth,
  // resolveSocietyContext,
  // requireSipBankOwner,
  getActiveSchemesController
);

// ==========================================
// GET SCHEME BY ID
// GET /api/sip/schemes/:id
// ==========================================

router.get(
  "/:id",
  // rbacMiddleware.requireAuth,
  // resolveSocietyContext,
  // requireSipBankOwner,
  getSchemeByIdController
);


// ==========================================
// UPDATE SCHEME
// PUT /api/sip/schemes/:id
// ==========================================

router.put(
  "/:id",
  rbacMiddleware.requireAuth,
  resolveSocietyContext,
  requireSipBankOwner,
  updateSchemeController
);


// ==========================================
// UPDATE SCHEME STATUS
// PATCH /api/sip/schemes/:id/status
// ==========================================

router.patch(
  "/:id/status",
  rbacMiddleware.requireAuth,
  resolveSocietyContext,
  requireSipBankOwner,
  updateSchemeStatusController
);


export default router;