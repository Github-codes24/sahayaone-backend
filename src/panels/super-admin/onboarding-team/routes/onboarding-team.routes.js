import { Router } from 'express';
import { onboardingTeamController } from '../controllers/onboarding-team.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { uploadSingleImage } from '../../../../middlewares/upload.middleware.js';
import {
  listOnboardingTeamSchema,
  getOnboardingTeamSchema,
  createOnboardingTeamSchema,
  updateOnboardingTeamSchema
} from '../validators/onboarding-team.validator.js';

const router = Router();

// Authentication and role authorization middleware
router.use(rbacMiddleware.requireAuth);
router.use(rbacMiddleware.requireRoles(['SUPER_ADMIN', 'SUB_ADMIN', 'HO_ADMIN', 'EMPLOYEE']));

// Get filter dropdown options (OnboardingTeam Types)
router.get(
  '/filters',
  rbacMiddleware.requirePermission('onboarding_team:view_only'),
  onboardingTeamController.getFilterDropdowns
);

// List Onboarding Team members with multi-select filters and pagination
router.get(
  '/',
  rbacMiddleware.requirePermission('onboarding_team:view_only'),
  validateRequest(listOnboardingTeamSchema),
  onboardingTeamController.list
);

// Get single Onboarding Team member details (Personal Details, Job Details, Shift & Woff, Attendance & WOFF/HOFF Sandwich Rules)
router.get(
  '/:id',
  rbacMiddleware.requirePermission('onboarding_team:view_only'),
  validateRequest(getOnboardingTeamSchema),
  onboardingTeamController.getById
);

// Create new Onboarding Team member (with profile image upload)
router.post(
  '/',
  rbacMiddleware.requirePermission('onboarding_team:create'),
  uploadSingleImage('profileImage'),
  validateRequest(createOnboardingTeamSchema),
  onboardingTeamController.create
);

// Update existing Onboarding Team member
router.put(
  '/:id',
  rbacMiddleware.requirePermission('onboarding_team:edit'),
  uploadSingleImage('profileImage'),
  validateRequest(updateOnboardingTeamSchema),
  onboardingTeamController.update
);

// Soft delete Onboarding Team member
router.delete(
  '/:id',
  rbacMiddleware.requirePermission('onboarding_team:delete'),
  validateRequest(getOnboardingTeamSchema),
  onboardingTeamController.delete
);

export default router;
