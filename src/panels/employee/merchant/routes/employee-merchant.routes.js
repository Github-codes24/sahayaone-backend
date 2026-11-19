import { Router } from 'express';
import { employeeMerchantController } from '../controllers/employee-merchant.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { uploadMerchantDocuments } from '../../../../middlewares/upload.middleware.js';
import {
  onboardMerchantSchema,
  listExecutiveMerchantsSchema,
  getMerchantByIdSchema
} from '../validators/employee-merchant.validator.js';

const router = Router();

// Secure all Executive merchant endpoints with Employee / Loan Executive authentication
router.use(rbacMiddleware.requireAuth);

const allowedRoles = rbacMiddleware.requireRoles([
  'EMPLOYEE',
  'LOAN_EXECUTIVE',
  'SUPER_ADMIN',
  'BRANCH_MANAGER',
  'BRANCH_STAFF',
  'BANK_ADMIN',
  'BANK_OWNER',
  'BANK_HEAD',
  'HEAD',
  'OWNER',
  'CHAIRMAN',
  'DIRECTOR',
  'SOCIETY_ADMIN',
  'ADMIN',
  'AUTHORIZED_PERSON',
  'BANK_AUTHORIZED_PERSON',
  'MANAGER'
]);

// 1. Onboard New Merchant Partner (supports multipart document uploads)
router.post(
  '/onboard',
  allowedRoles,
  uploadMerchantDocuments,
  validateRequest(onboardMerchantSchema),
  employeeMerchantController.onboardMerchant
);

// 2. List Merchants Onboarded by Executive / Branch (with pagination, search & stats)
router.get(
  '/',
  allowedRoles,
  validateRequest(listExecutiveMerchantsSchema),
  employeeMerchantController.listMerchants
);

// 3. View Single Merchant Full Details by ID
router.get(
  '/:id',
  allowedRoles,
  validateRequest(getMerchantByIdSchema),
  employeeMerchantController.getMerchantDetails
);

export default router;
