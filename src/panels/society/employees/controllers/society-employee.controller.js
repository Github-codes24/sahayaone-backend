import { BaseController } from '../../../../common/base.controller.js';
import { societyEmployeeService } from '../services/society-employee.service.js';

export class SocietyEmployeeController extends BaseController {
  constructor() {
    super();
    this.createEmployee = this.createEmployee.bind(this);
    this.getEmployees = this.getEmployees.bind(this);
    this.getEmployeeById = this.getEmployeeById.bind(this);
    this.updateEmployee = this.updateEmployee.bind(this);
    this.deleteEmployee = this.deleteEmployee.bind(this);
    this.restoreEmployee = this.restoreEmployee.bind(this);
    this.changeRole = this.changeRole.bind(this);
    this.changeBranch = this.changeBranch.bind(this);

    // Employee Location Handlers (Latitude & Longitude)
    this.getEmployeesLocations = this.getEmployeesLocations.bind(this);
    this.getEmployeeLocation = this.getEmployeeLocation.bind(this);

    // HR Tab Section Handlers
    this.updatePersonalDetails = this.updatePersonalDetails.bind(this);
    this.updateJobDetails = this.updateJobDetails.bind(this);
    this.updateShiftSettings = this.updateShiftSettings.bind(this);
    this.updateAttendanceSettings = this.updateAttendanceSettings.bind(this);
    this.updateWoffHoffSettings = this.updateWoffHoffSettings.bind(this);
    this.updateKraSettings = this.updateKraSettings.bind(this);
  }

  /**
   * POST /api/v1/society/employees
   * Create new Employee (Bank Owner only)
   */
  async createEmployee(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const creatorId = req.user.id;
      const result = await societyEmployeeService.createEmployee(bankId, req.body, creatorId);
      return this.sendCreated(res, result, 'Employee created successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/society/employees
   * List Employees for authenticated Bank
   */
  async getEmployees(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const branchIdFilter = req.society.branchId || null;
      const isBankOwner = req.society.isBankOwner ?? false;
      const isBranchManager = req.society.isBranchManager ?? false;
      const result = await societyEmployeeService.listEmployees(bankId, req.query, branchIdFilter, isBankOwner, isBranchManager);
      const extraData = result.stats ? { stats: result.stats } : {};
      return this.sendPaginated(res, result.items, result.meta, 'Employees retrieved successfully.', extraData);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/society/employees/:id
   */
  async getEmployeeById(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const employeeId = req.params.id;
      const result = await societyEmployeeService.getEmployeeById(bankId, employeeId);
      return this.sendSuccess(res, result, 'Employee details retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/society/employees/:id
   */
  async updateEmployee(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const employeeId = req.params.id;
      const updaterId = req.user.id;
      const result = await societyEmployeeService.updateEmployee(bankId, employeeId, req.body, updaterId);
      return this.sendSuccess(res, result, 'Employee updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/society/employees/:id
   * Soft Delete or Permanent Hard Delete (?permanent=true or ?force=true)
   */
  async deleteEmployee(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const employeeId = req.params.id;
      const deleterId = req.user.id;
      const permanent = req.query.permanent === 'true' || req.query.force === 'true' || req.query.isPermanent === 'true';
      const result = await societyEmployeeService.deleteEmployee(bankId, employeeId, deleterId, permanent);
      const message = permanent ? 'Employee permanently deleted successfully.' : 'Employee deactivated successfully.';
      return this.sendSuccess(res, result, message);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/society/employees/:id/restore
   * Restore soft-deleted employee
   */
  async restoreEmployee(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const employeeId = req.params.id;
      const restorerId = req.user.id;
      const isBankOwner = req.society.isBankOwner ?? false;
      const isBranchManager = req.society.isBranchManager ?? false;
      const result = await societyEmployeeService.restoreEmployee(bankId, employeeId, restorerId, isBankOwner, isBranchManager);
      return this.sendSuccess(res, result, 'Employee restored successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/society/employees/:id/role
   */
  async changeRole(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const employeeId = req.params.id;
      const { roleId } = req.body;
      const updaterId = req.user.id;
      const result = await societyEmployeeService.changeRole(bankId, employeeId, roleId, updaterId);
      return this.sendSuccess(res, result, 'Employee role changed successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/society/employees/:id/branch
   */
  async changeBranch(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const employeeId = req.params.id;
      const { branchId } = req.body;
      const updaterId = req.user.id;
      const result = await societyEmployeeService.changeBranch(bankId, employeeId, branchId, updaterId);
      return this.sendSuccess(res, result, 'Employee branch changed successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/society/employees/:id/personal-details
   */
  async updatePersonalDetails(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const employeeId = req.params.id;
      const updaterId = req.user.id;
      const result = await societyEmployeeService.updatePersonalDetails(bankId, employeeId, req.body, updaterId);
      return this.sendSuccess(res, result, 'Personal details updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/society/employees/:id/job-details
   */
  async updateJobDetails(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const employeeId = req.params.id;
      const updaterId = req.user.id;
      const result = await societyEmployeeService.updateJobDetails(bankId, employeeId, req.body, updaterId);
      return this.sendSuccess(res, result, 'Job details updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/society/employees/:id/shift-settings
   */
  async updateShiftSettings(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const employeeId = req.params.id;
      const updaterId = req.user.id;
      const result = await societyEmployeeService.updateShiftSettings(bankId, employeeId, req.body, updaterId);
      return this.sendSuccess(res, result, 'Shift settings updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/society/employees/:id/attendance-settings
   */
  async updateAttendanceSettings(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const employeeId = req.params.id;
      const updaterId = req.user.id;
      const result = await societyEmployeeService.updateAttendanceSettings(bankId, employeeId, req.body, updaterId);
      return this.sendSuccess(res, result, 'Attendance settings updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/society/employees/:id/woff-hoff-settings
   */
  async updateWoffHoffSettings(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const employeeId = req.params.id;
      const updaterId = req.user.id;
      const result = await societyEmployeeService.updateWoffHoffSettings(bankId, employeeId, req.body, updaterId);
      return this.sendSuccess(res, result, 'WOFF / HOFF settings updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/society/employees/:id/kra-settings
   */
  async updateKraSettings(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const employeeId = req.params.id;
      const updaterId = req.user.id;
      const result = await societyEmployeeService.updateKraSettings(bankId, employeeId, req.body, updaterId);
      return this.sendSuccess(res, result, 'KRA settings updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/society/employees/locations
   * List location coordinates (Latitude & Longitude) for Employees
   */
  async getEmployeesLocations(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const branchIdFilter = req.society.branchId || null;
      const isBankOwner = req.society.isBankOwner ?? false;
      const isBranchManager = req.society.isBranchManager ?? false;
      const result = await societyEmployeeService.getEmployeesLocations(bankId, req.query, branchIdFilter, isBankOwner, isBranchManager);
      const extraData = result.stats ? { stats: result.stats } : {};
      return this.sendPaginated(res, result.items, result.meta, 'Employee locations retrieved successfully.', extraData);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/society/employees/:id/location
   * Get real-time location coordinates (Latitude & Longitude) for specific Employee
   */
  async getEmployeeLocation(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const employeeId = req.params.id;
      const result = await societyEmployeeService.getEmployeeLocation(bankId, employeeId);
      return this.sendSuccess(res, result, 'Employee location retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }
}

export const societyEmployeeController = new SocietyEmployeeController();

