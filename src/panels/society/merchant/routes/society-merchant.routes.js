import { Router } from "express";
import { societyMerchantController } from "../controllers/society-merchant.controller.js";
import { rbacMiddleware } from "../../../../middlewares/rbac.middleware.js";
import { resolveSocietyContext } from "../../middlewares/society-context.middleware.js";
import { requireSocietyPermission } from "../../middlewares/society-permission.middleware.js";
import { validateRequest } from "../../../../middlewares/request-validator.middleware.js";
import { uploadMerchantDocuments } from "../../../../middlewares/upload.middleware.js";
import {
  listMerchantsSchema,
  getMerchantSchema,
  createMerchantSchema,
  updateMerchantSchema,
  approveMerchantSchema,
  rejectMerchantSchema,
  linkBankMerchantSchema,
} from "../validators/society-merchant.validator.js";

const router = Router();

// Require authentication and resolve multi-tenant society context (bankId, branchId, permissions)
router.use(rbacMiddleware.requireAuth, resolveSocietyContext);

// Active Merchants dropdown list
router.get(
  "/dropdown",
  requireSocietyPermission("merchant.view"),
  societyMerchantController.dropdown,
);

// List Merchants (with search, status/deleted filtering, branch filter, location, and pagination)
router.get(
  "/",
  requireSocietyPermission("merchant.view"),
  validateRequest(listMerchantsSchema),
  societyMerchantController.list,
);

// Restore soft-deleted Merchant
router.patch(
  "/:id/restore",
  requireSocietyPermission("merchant.delete"),
  validateRequest(getMerchantSchema),
  societyMerchantController.restore,
);

router.put(
  "/:id/restore",
  requireSocietyPermission("merchant.delete"),
  validateRequest(getMerchantSchema),
  societyMerchantController.restore,
);

// Permanently (Hard) Delete Merchant
router.delete(
  "/:id/permanent",
  requireSocietyPermission("merchant.delete"),
  validateRequest(getMerchantSchema),
  societyMerchantController.permanentDelete,
);

// Get single Merchant details by ID
router.get(
  "/:id",
  requireSocietyPermission("merchant.view"),
  validateRequest(getMerchantSchema),
  societyMerchantController.getById,
);

// Create new Merchant associated with Bank Branch (supports document file uploads)
router.post(
  "/",
  requireSocietyPermission("merchant.create"),
  uploadMerchantDocuments,
  validateRequest(createMerchantSchema),
  societyMerchantController.create,
);

// Update existing Merchant (supports document file uploads)
router.put(
  "/:id",
  requireSocietyPermission("merchant.update"),
  uploadMerchantDocuments,
  validateRequest(updateMerchantSchema),
  societyMerchantController.update,
);

// Soft delete Merchant
router.delete(
  "/:id",
  requireSocietyPermission("merchant.delete"),
  validateRequest(getMerchantSchema),
  societyMerchantController.delete,
);

// Approve Merchant Onboarding (Branch Owner / Manager / QC) - Checks bank account completeness
router.post(
  "/:id/approve",
  requireSocietyPermission("merchant.update"),
  validateRequest(approveMerchantSchema),
  societyMerchantController.approve,
);
router.put(
  "/:id/approve",
  requireSocietyPermission("merchant.update"),
  validateRequest(approveMerchantSchema),
  societyMerchantController.approve,
);
router.patch(
  "/:id/approve",
  requireSocietyPermission("merchant.update"),
  validateRequest(approveMerchantSchema),
  societyMerchantController.approve,
);
router.post(
  "/approve",
  requireSocietyPermission("merchant.update"),
  validateRequest(approveMerchantSchema),
  societyMerchantController.approve,
);

// Reject Merchant Onboarding (Branch Owner / Manager / QC) - Requires mandatory rejection reason
router.post(
  "/:id/reject",
  requireSocietyPermission("merchant.update"),
  validateRequest(rejectMerchantSchema),
  societyMerchantController.reject,
);
router.put(
  "/:id/reject",
  requireSocietyPermission("merchant.update"),
  validateRequest(rejectMerchantSchema),
  societyMerchantController.reject,
);
router.patch(
  "/:id/reject",
  requireSocietyPermission("merchant.update"),
  validateRequest(rejectMerchantSchema),
  societyMerchantController.reject,
);
router.post(
  "/reject",
  requireSocietyPermission("merchant.update"),
  validateRequest(rejectMerchantSchema),
  societyMerchantController.reject,
);

// Link / Add Bank Account Details for Merchant (Same pattern as Pigmy API society-account)
router.post(
  "/society-account",
  requireSocietyPermission("merchant.update"),
  validateRequest(linkBankMerchantSchema),
  societyMerchantController.linkBankAccount,
);
router.post(
  "/:id/society-account",
  requireSocietyPermission("merchant.update"),
  validateRequest(linkBankMerchantSchema),
  societyMerchantController.linkBankAccount,
);
router.post(
  "/link-bank",
  requireSocietyPermission("merchant.update"),
  validateRequest(linkBankMerchantSchema),
  societyMerchantController.linkBankAccount,
);
router.post(
  "/:id/link-bank",
  requireSocietyPermission("merchant.update"),
  validateRequest(linkBankMerchantSchema),
  societyMerchantController.linkBankAccount,
);

export default router;
