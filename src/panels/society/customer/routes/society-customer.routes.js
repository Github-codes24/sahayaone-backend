import { Router } from 'express';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { resolveSocietyContext } from '../../middlewares/society-context.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { societyCustomerController } from '../controllers/society-customer.controller.js';
import {
  listCustomersSchema,
  getCustomerSchema
} from '../validators/society-customer.validator.js';

const router = Router();

// Secure all Society Customer endpoints with authentication & multi-tenant context
router.use(rbacMiddleware.requireAuth, resolveSocietyContext);

// Allowed Roles: Bank Owner, Branch Manager, QC Employee, Receipt Executive, Bank Receipt Manager, and Customer Support Executive
const allowedCustomerRoles = rbacMiddleware.requireRoles([
  'SUPER_ADMIN',
  'SOCIETY_ADMIN',
  'BANK_ADMIN',
  'BANK_OWNER',
  'OWNER',
  'CHAIRMAN',
  'ADMIN',
  'BRANCH_MANAGER',
  'MANAGER',
  'QC_EMPLOYEE',
  'QC_OFFICER',
  'QUALITY_CHECK',
  'QUALITY_CHECKER',
  'RECEIPT_MANAGEMENT_EXECUTIVE',
  'RECEIPT_EXECUTIVE',
  'BANK_RECEIPT_MANAGER',
  'RECEIPT_MANAGER',
  'CUSTOMER_SUPPORT_EXECUTIVE',
  'SUPPORT_EXECUTIVE',
  'CUSTOMER_SUPPORT',
  'EMPLOYEE',
  'BRANCH_STAFF'
]);

// 1. Dropdown Selection List of Active Customers & Merchants
router.get(
  '/dropdown',
  allowedCustomerRoles,
  societyCustomerController.listCustomersDropdown
);

// 2. Paginated List of Society Customers & Merchants (with Search, Type, Date Filters, & Aggregates)
router.get(
  '/',
  allowedCustomerRoles,
  validateRequest(listCustomersSchema, 'query'),
  societyCustomerController.listCustomers
);

// 3. View Detailed Member Profile (Customer / Merchant with Loans, Pigmy, Creator, EMI Card, Bank Account)
router.get(
  '/:id',
  allowedCustomerRoles,
  validateRequest(getCustomerSchema),
  societyCustomerController.getCustomerById
);

// 4. Link Society Account to Customer / Member (Society Panel API)
router.post(
  '/link-society-account',
  allowedCustomerRoles,
  societyCustomerController.linkSocietyAccount
);

router.post(
  '/:id/society-account',
  allowedCustomerRoles,
  societyCustomerController.linkSocietyAccount
);

export default router;
