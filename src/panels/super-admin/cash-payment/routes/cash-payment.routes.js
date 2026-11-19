import { Router } from 'express';
import { cashPaymentController } from '../controllers/cash-payment.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import {
  listCashPaymentsSchema,
  getCashPaymentDetailsSchema,
  submitCashSchema
} from '../validators/cash-payment.validator.js';


const router = Router();

// Authentication and role authorization middleware
router.use(rbacMiddleware.requireAuth);
router.use(rbacMiddleware.requireRoles(['SUPER_ADMIN', 'SUB_ADMIN', 'HO_ADMIN', 'EMPLOYEE']));

// List Cash Payments overview table (Employee Name, Designation, Cash Collection/Submitted/Pending stats)
router.get(
  '/',
  rbacMiddleware.requirePermission('cash_payment:view_only'),
  validateRequest(listCashPaymentsSchema),
  cashPaymentController.list
);

// Get single Employee Cash Payment details (Summary Cards & Cash Submit History with date range filtering)
router.get(
  '/:id',
  rbacMiddleware.requirePermission('cash_payment:view_only'),
  validateRequest(getCashPaymentDetailsSchema),
  cashPaymentController.getById
);

// Submit Cash entry for employee (Submit Cash Modal - Image 4)
router.post(
  '/:id/submit-cash',
  rbacMiddleware.requirePermission('cash_payment:create'),
  validateRequest(submitCashSchema),
  cashPaymentController.submitCash
);

router.put(
  '/:id/submit-cash',
  rbacMiddleware.requirePermission('cash_payment:edit'),
  validateRequest(submitCashSchema),
  cashPaymentController.submitCash
);

export default router;
