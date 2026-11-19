import { Router } from 'express';
import { branchController } from '../controllers/branch.controller.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { resolveSocietyContext } from '../../middlewares/society-context.middleware.js';
import { requireSocietyPermission } from '../../middlewares/society-permission.middleware.js';
import {
  createBranchSchema,
  updateBranchSchema,
  updateBranchManagerSchema,
  branchQuerySchema,
  updatePersonalDetailsSchema,
  updateJobDetailsSchema,
  updateShiftSettingsSchema,
  updateAttendanceSettingsSchema,
  updateWoffHoffSettingsSchema,
  updateKraSettingsSchema
} from '../validators/branch.validator.js';

const router = Router();

// Apply Authentication and Society Context globally across all branch endpoints
router.use(rbacMiddleware.requireAuth, resolveSocietyContext);

// 1. Create Branch + Branch Manager
router.post('/', requireSocietyPermission('branch.create'), validateRequest(createBranchSchema), branchController.createBranch);

// 2. List all branches for authenticated Bank (or assigned branch for Branch Manager)
router.get('/', requireSocietyPermission('branch.view'), validateRequest(branchQuerySchema, 'query'), branchController.getBranches);

// 2b. Lightweight Branch Dropdown (returns branch ID and branch name)
router.get('/dropdown', requireSocietyPermission('branch.view'), branchController.getDropdown);

// 2c. Available Cities and States Dropdown for filter UI
router.get('/available-locations', requireSocietyPermission('branch.view'), branchController.getCitiesAndStates);
router.get('/cities-states', requireSocietyPermission('branch.view'), branchController.getCitiesAndStates);
router.get('/locations', requireSocietyPermission('branch.view'), branchController.getCitiesAndStates);

// 3. Get single Branch details
router.get('/:id', requireSocietyPermission('branch.view'), branchController.getBranchById);

// 4. Update Branch details
router.put('/:id', requireSocietyPermission('branch.update'), validateRequest(updateBranchSchema), branchController.updateBranch);

// 5. Deactivate / Soft Delete Branch
router.delete('/:id', requireSocietyPermission('branch.delete'), branchController.deleteBranch);

// 6. Get Branch Manager details for a branch (returns all 6 HR tabs)
router.get('/:id/manager', requireSocietyPermission('branch.view'), branchController.getBranchManager);

// 7. Complete / multi-section update for Branch Manager
router.put(
  '/:id/manager',
  requireSocietyPermission('branch.update'),
  validateRequest(updateBranchManagerSchema),
  branchController.updateBranchManager
);

// 8. Tab-specific section updates
router.patch(
  '/:id/manager/personal-details',
  requireSocietyPermission('branch.update'),
  validateRequest(updatePersonalDetailsSchema),
  branchController.updatePersonalDetails
);

router.patch(
  '/:id/manager/job-details',
  requireSocietyPermission('branch.update'),
  validateRequest(updateJobDetailsSchema),
  branchController.updateJobDetails
);

router.patch(
  '/:id/manager/shift-settings',
  requireSocietyPermission('branch.update'),
  validateRequest(updateShiftSettingsSchema),
  branchController.updateShiftSettings
);

router.patch(
  '/:id/manager/attendance-settings',
  requireSocietyPermission('branch.update'),
  validateRequest(updateAttendanceSettingsSchema),
  branchController.updateAttendanceSettings
);

router.patch(
  '/:id/manager/woff-hoff-settings',
  requireSocietyPermission('branch.update'),
  validateRequest(updateWoffHoffSettingsSchema),
  branchController.updateWoffHoffSettings
);
 
router.patch(
  '/:id/manager/kra-settings',
  requireSocietyPermission('branch.update'),
  validateRequest(updateKraSettingsSchema),
  branchController.updateKraSettings
);

export default router;
