import { Router } from 'express';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { resolveSocietyContext } from '../../middlewares/society-context.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { societyPigmyController } from '../controllers/society-pigmy.controller.js';
import {
  addSocietyAccountSchema,
  approvePigmyCustomerSchema,
  rejectPigmyCustomerSchema,
  listSocietyPigmyCustomersSchema
} from '../validators/society-pigmy.validator.js';

const router = Router();

// Secure all Society Pigmy Customer endpoints with authentication & isolated society tenant context
router.use(rbacMiddleware.requireAuth, resolveSocietyContext);

// Allowed Roles: Bank Owner, Branch Manager, and QC Employee of the branch
const allowedPigmyRoles = rbacMiddleware.requireRoles([
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
  'EMPLOYEE',
  'BRANCH_STAFF'
]);

// 1. List Pigmy Customer Leads for Society Panel (Scoped by Bank and Branch)
router.get(
  '/',
  allowedPigmyRoles,
  validateRequest(listSocietyPigmyCustomersSchema, 'query'),
  societyPigmyController.listPigmyCustomers
);

// 2. Add / Link Society Bank Account Details (Credit Destination Account Number)
router.post(
  '/society-account',
  allowedPigmyRoles,
  validateRequest(addSocietyAccountSchema),
  societyPigmyController.addSocietyAccount
);

router.post(
  '/:id/society-account',
  allowedPigmyRoles,
  validateRequest(addSocietyAccountSchema),
  societyPigmyController.addSocietyAccount
);

// 3. Branch Approval (Checks that Customer Society Account Number exists)
router.post(
  '/:id/approve',
  allowedPigmyRoles,
  validateRequest(approvePigmyCustomerSchema),
  societyPigmyController.approvePigmyCustomer
);

// 4. Branch Rejection
router.post(
  '/:id/reject',
  allowedPigmyRoles,
  validateRequest(rejectPigmyCustomerSchema),
  societyPigmyController.rejectPigmyCustomer
);

// 5. View Single Pigmy Customer Full Details (Branch Scoped)
router.get(
  '/:id',
  allowedPigmyRoles,
  societyPigmyController.getPigmyCustomerDetails
);

export default router;
