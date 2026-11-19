import { Router } from 'express';
import { employeePigmyController } from '../controllers/employee-pigmy.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { uploadMerchantDocuments } from '../../../../middlewares/upload.middleware.js';
import {
  onboardPigmyCustomerSchema,
  listPigmyCustomersSchema
} from '../validators/employee-pigmy.validator.js';

const router = Router();

// Secure all Executive Pigmy Customer endpoints
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
  'MANAGER',
  'FIELD_EXECUTIVE',
  'COLLECTION_EXECUTIVE',
  'PIGMY_AGENT'
]);

// 1. Onboard New Pigmy Customer (Supports Individual & Merchant, multipart file uploads)
router.post(
  '/onboard',
  allowedRoles,
  uploadMerchantDocuments,
  validateRequest(onboardPigmyCustomerSchema),
  employeePigmyController.onboardPigmyCustomer
);

router.post(
  '/',
  allowedRoles,
  uploadMerchantDocuments,
  validateRequest(onboardPigmyCustomerSchema),
  employeePigmyController.onboardPigmyCustomer
);

// 2. List Executive Pigmy Customers (Scoped to Executive's own onboardings with date, status, search, and type filters)
router.get(
  '/',
  allowedRoles,
  validateRequest(listPigmyCustomersSchema, 'query'),
  employeePigmyController.listPigmyCustomers
);

// 3. Get Active SIP Schemes for the Executive's Assigned Bank
router.get(
  '/schemes',
  allowedRoles,
  employeePigmyController.getActiveSchemes
);

// 4. Branch Approval & Rejection for Pigmy Customer
router.post(
  '/:id/approve',
  allowedRoles,
  employeePigmyController.approvePigmyCustomer
);

router.post(
  '/:id/reject',
  allowedRoles,
  employeePigmyController.rejectPigmyCustomer
);

// 5. View Single Pigmy Customer Full Details (Scoped to Executive's own onboarding)
router.get(
  '/:id',
  allowedRoles,
  employeePigmyController.getPigmyCustomerDetails
);

export default router;
