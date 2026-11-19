import { Router } from 'express';
import { merchantController } from '../controllers/merchant.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { uploadMerchantDocuments } from '../../../../middlewares/upload.middleware.js';
import {
  listMerchantsSchema,
  getMerchantSchema,
  createMerchantSchema,
  updateMerchantSchema
} from '../validators/merchant.validator.js';

const router = Router();

// Authentication and role authorization middleware
router.use(rbacMiddleware.requireAuth);
router.use(rbacMiddleware.requireRoles(['SUPER_ADMIN', 'SUB_ADMIN', 'HO_ADMIN', 'EMPLOYEE']));

// Active Merchants dropdown list
router.get(
  '/dropdown',
  rbacMiddleware.requirePermission('merchant:view_only'),
  merchantController.dropdown
);

// List Merchants (with search, status filtering, and pagination)
router.get(
  '/',
  rbacMiddleware.requirePermission('merchant:view_only'),
  validateRequest(listMerchantsSchema),
  merchantController.list
);

// Get single Merchant details (Shop info, Owner info, Tax IDs & Documents)
router.get(
  '/:id',
  rbacMiddleware.requirePermission('merchant:view_only'),
  validateRequest(getMerchantSchema),
  merchantController.getById
);

// Create new Merchant (supports document file uploads: ownerAadhaar, ownerPan, shopRegistrationCertificate, gstCertificate)
router.post(
  '/',
  rbacMiddleware.requirePermission('merchant:create'),
  uploadMerchantDocuments,
  validateRequest(createMerchantSchema),
  merchantController.create
);

// Update existing Merchant (supports document file uploads)
router.put(
  '/:id',
  rbacMiddleware.requirePermission('merchant:edit'),
  uploadMerchantDocuments,
  validateRequest(updateMerchantSchema),
  merchantController.update
);

// Soft delete Merchant
router.delete(
  '/:id',
  rbacMiddleware.requirePermission('merchant:delete'),
  validateRequest(getMerchantSchema),
  merchantController.delete
);

export default router;
