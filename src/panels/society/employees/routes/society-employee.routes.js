import { Router } from "express";
import { societyEmployeeController } from "../controllers/society-employee.controller.js";
import { validateRequest } from "../../../../middlewares/request-validator.middleware.js";
import { rbacMiddleware } from "../../../../middlewares/rbac.middleware.js";
import {
  resolveSocietyContext,
  requireHrOrBankOwnerOrManager,
} from "../../middlewares/society-context.middleware.js";
import { requireSocietyPermission } from "../../middlewares/society-permission.middleware.js";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  employeeQuerySchema,
  changeRoleSchema,
  changeBranchSchema,
  updatePersonalDetailsSchema,
  updateJobDetailsSchema,
  updateShiftSettingsSchema,
  updateAttendanceSettingsSchema,
  updateWoffHoffSettingsSchema,
  updateKraSettingsSchema,
} from "../validators/society-employee.validator.js";
import societyEmployeeHrRouter from "./society-employee-hr.routes.js";

const router = Router();

// Apply Authentication and Context Resolution globally across employee endpoints
router.use(rbacMiddleware.requireAuth, resolveSocietyContext);

// HR Sub-module routes
router.use("/hr", societyEmployeeHrRouter);

// 1. Create Employee
router.post(
  "/",
  requireSocietyPermission("employee.create"),
  validateRequest(createEmployeeSchema),
  societyEmployeeController.createEmployee,
);

// 2. List Employees for Bank/Branch
router.get(
  "/",
  requireSocietyPermission("employee.view"),
  validateRequest(employeeQuerySchema),
  societyEmployeeController.getEmployees,
);

// 2b. List Employees Location Coordinates (Latitude & Longitude) - Super Admin, Bank Owner, Branch Manager, HR
router.get(
  "/locations",
  requireHrOrBankOwnerOrManager,
  validateRequest(employeeQuerySchema),
  societyEmployeeController.getEmployeesLocations,
);
router.get(
  "/location",
  requireHrOrBankOwnerOrManager,
  validateRequest(employeeQuerySchema),
  societyEmployeeController.getEmployeesLocations,
);
router.get(
  "/location/:id",
  requireHrOrBankOwnerOrManager,
  societyEmployeeController.getEmployeeLocation,
);

// 3. Get single Employee details
router.get(
  "/:id",
  requireSocietyPermission("employee.view"),
  societyEmployeeController.getEmployeeById,
);

// 3b. Get single Employee Location Coordinates (Latitude & Longitude) - Super Admin, Bank Owner, Branch Manager, HR
router.get(
  "/:id/location",
  requireHrOrBankOwnerOrManager,
  societyEmployeeController.getEmployeeLocation,
);

// 4. Update complete Employee profile
router.put(
  "/:id",
  requireSocietyPermission("employee.update"),
  validateRequest(updateEmployeeSchema),
  societyEmployeeController.updateEmployee,
);

// 5. Deactivate / Soft Delete Employee
router.delete(
  "/:id",
  requireSocietyPermission("employee.delete"),
  societyEmployeeController.deleteEmployee,
);

// 5b. Restore Soft-Deleted Employee
router.patch(
  "/:id/restore",
  requireSocietyPermission("employee.update"),
  societyEmployeeController.restoreEmployee,
);
router.post(
  "/:id/restore",
  requireSocietyPermission("employee.update"),
  societyEmployeeController.restoreEmployee,
);

// 6. Role & Branch Transfers
router.patch(
  "/:id/role",
  requireSocietyPermission("employee.update"),
  validateRequest(changeRoleSchema),
  societyEmployeeController.changeRole,
);
router.patch(
  "/:id/branch",
  requireSocietyPermission("employee.update"),
  validateRequest(changeBranchSchema),
  societyEmployeeController.changeBranch,
);

// 7. HR Tab Section Updates
router.patch(
  "/:id/personal-details",
  requireSocietyPermission("employee.update"),
  validateRequest(updatePersonalDetailsSchema),
  societyEmployeeController.updatePersonalDetails,
);

router.patch(
  "/:id/job-details",
  requireSocietyPermission("employee.update"),
  validateRequest(updateJobDetailsSchema),
  societyEmployeeController.updateJobDetails,
);

router.patch(
  "/:id/shift-settings",
  requireSocietyPermission("employee.update"),
  validateRequest(updateShiftSettingsSchema),
  societyEmployeeController.updateShiftSettings,
);

router.patch(
  "/:id/attendance-settings",
  requireSocietyPermission("employee.update"),
  validateRequest(updateAttendanceSettingsSchema),
  societyEmployeeController.updateAttendanceSettings,
);

router.patch(
  "/:id/woff-hoff-settings",
  requireSocietyPermission("employee.update"),
  validateRequest(updateWoffHoffSettingsSchema),
  societyEmployeeController.updateWoffHoffSettings,
);

router.patch(
  "/:id/kra-settings",
  requireSocietyPermission("employee.update"),
  validateRequest(updateKraSettingsSchema),
  societyEmployeeController.updateKraSettings,
);

export default router;
