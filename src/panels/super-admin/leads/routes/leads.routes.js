import { Router } from 'express';
import { superAdminLeadsController } from '../controllers/leads.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import {
  listLeadsSchema,
  getLeadSchema,
  assignLeadSchema,
  assignBankSchema
} from '../validators/leads.validator.js';

const router = Router();

// Authentication and role authorization middleware
router.use(rbacMiddleware.requireAuth);
router.use(rbacMiddleware.requireRoles(['SUPER_ADMIN', 'SUB_ADMIN', 'HO_ADMIN', 'EMPLOYEE']));

// Get filter dropdown options for filter modal (Statuses, States, Branches, Employees, Cooperative Banks)
router.get(
  '/filters',
  rbacMiddleware.requirePermission('leads:view_only'),
  superAdminLeadsController.getFilterDropdowns
);

// List leads with filters (Status, Date range, State, Branch, Search) and pagination
router.get(
  '/',
  rbacMiddleware.requirePermission('leads:view_only'),
  validateRequest(listLeadsSchema),
  superAdminLeadsController.listLeads
);

// Get single lead details with General Info, Identity Docs & Address sections
router.get(
  '/:id',
  rbacMiddleware.requirePermission('leads:view_only'),
  validateRequest(getLeadSchema),
  superAdminLeadsController.getLeadById
);

// Assign lead to an executive/employee
router.put(
  '/:id/assign',
  rbacMiddleware.requirePermission('leads:edit'),
  validateRequest(assignLeadSchema),
  superAdminLeadsController.assignLead
);

router.post(
  '/:id/assign',
  rbacMiddleware.requirePermission('leads:edit'),
  validateRequest(assignLeadSchema),
  superAdminLeadsController.assignLead
);

// Assign lead to a Cooperative Bank (Assign to Bank modal)
router.put(
  '/:id/assign-bank',
  rbacMiddleware.requirePermission('leads:edit'),
  validateRequest(assignBankSchema),
  superAdminLeadsController.assignBank
);

router.post(
  '/:id/assign-bank',
  rbacMiddleware.requirePermission('leads:edit'),
  validateRequest(assignBankSchema),
  superAdminLeadsController.assignBank
);

export default router;
