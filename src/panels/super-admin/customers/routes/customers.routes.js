import { Router } from 'express';
import { customersController } from '../controllers/customers.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { uploadSingleImage } from '../../../../middlewares/upload.middleware.js';
import {
  listCustomersSchema,
  getCustomerSchema,
  createCustomerSchema,
  updateCustomerSchema,
  getCustomerLoansSchema,
  getSingleLoanSchema
} from '../validators/customers.validator.js';

const router = Router();

// Authentication and role authorization middleware
router.use(rbacMiddleware.requireAuth);
router.use(rbacMiddleware.requireRoles(['SUPER_ADMIN', 'SUB_ADMIN', 'HO_ADMIN', 'EMPLOYEE']));

// List customers (with search, pagination, gender & status filtering)
router.get(
  '/',
  rbacMiddleware.requirePermission('customers:view_only'),
  validateRequest(listCustomersSchema),
  customersController.listCustomers
);

// Get customer loans list with top summary card & tab status filtering (New, Active, Completed, Rejected)
router.get(
  '/:id/loans',
  rbacMiddleware.requirePermission('customers:view_only'),
  validateRequest(getCustomerLoansSchema),
  customersController.getCustomerLoans
);

// Get single customer loan details with full EMI schedule and NOC info
router.get(
  '/:id/loans/:loanId',
  rbacMiddleware.requirePermission('customers:view_only'),
  validateRequest(getSingleLoanSchema),
  customersController.getSingleLoan
);

// Get single customer by ID
router.get(
  '/:id',
  rbacMiddleware.requirePermission('customers:view_only'),
  validateRequest(getCustomerSchema),
  customersController.getCustomerById
);

// Create new customer (supports profile image upload)
router.post(
  '/',
  rbacMiddleware.requirePermission('customers:create'),
  uploadSingleImage('profileImage'),
  validateRequest(createCustomerSchema),
  customersController.createCustomer
);

// Update existing customer (supports profile image update)
router.put(
  '/:id',
  rbacMiddleware.requirePermission('customers:edit'),
  uploadSingleImage('profileImage'),
  validateRequest(updateCustomerSchema),
  customersController.updateCustomer
);

// Soft delete customer
router.delete(
  '/:id',
  rbacMiddleware.requirePermission('customers:delete'),
  validateRequest(getCustomerSchema),
  customersController.deleteCustomer
);

export default router;
