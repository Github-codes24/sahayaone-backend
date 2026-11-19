import { BaseController } from '../../../../common/base.controller.js';
import { branchService } from '../services/branch.service.js';

export class BranchController extends BaseController {
  constructor() {
    super();
    this.createBranch = this.createBranch.bind(this);
    this.getBranches = this.getBranches.bind(this);
    this.getDropdown = this.getDropdown.bind(this);
    this.getCitiesAndStates = this.getCitiesAndStates.bind(this);
    this.getBranchById = this.getBranchById.bind(this);
    this.updateBranch = this.updateBranch.bind(this);
    this.deleteBranch = this.deleteBranch.bind(this);
    this.getBranchManager = this.getBranchManager.bind(this);
    this.updateBranchManager = this.updateBranchManager.bind(this);

    // Section Specific Handlers
    this.updatePersonalDetails = this.updatePersonalDetails.bind(this);
    this.updateJobDetails = this.updateJobDetails.bind(this);
    this.updateShiftSettings = this.updateShiftSettings.bind(this);
    this.updateAttendanceSettings = this.updateAttendanceSettings.bind(this);
    this.updateWoffHoffSettings = this.updateWoffHoffSettings.bind(this);
    this.updateKraSettings = this.updateKraSettings.bind(this);
  }

  /**
   * POST /api/v1/society/branches
   * Bank Owner creates a Branch + Branch Manager with optional full HR details
   */
  async createBranch(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const creatorId = req.user.id;
      const result = await branchService.createBranchAndManager(bankId, req.body, creatorId);
      return this.sendCreated(res, result, 'Branch and Branch Manager created successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/society/branches
   * Get all branches for the authenticated bank
   */
  async getBranches(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const branchIdFilter = req.society.branchId || null; // If branch manager, filter only their assigned branch
      const result = await branchService.listBranches(bankId, req.query, branchIdFilter);
      return this.sendResponse(res, 200, result, 'Branches retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/society/branches/dropdown
   * Get list of branch ID and branch name for dropdown selections
   */
  async getDropdown(req, res, next) {
    try {
      const result = await branchService.listBranchesDropdown(req.society);
      return this.sendSuccess(res, result, 'Branch list retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/society/branches/available-locations
   * Get dropdown list of available cities and states from active branches
   */
  async getCitiesAndStates(req, res, next) {
    try {
      const result = await branchService.getAvailableCitiesAndStates(req.society);
      return this.sendSuccess(res, result, 'Available branch cities and states retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/society/branches/:id
   */
  async getBranchById(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const branchId = req.params.id;
      const result = await branchService.getBranchById(bankId, branchId);
      return this.sendSuccess(res, result, 'Branch details retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/society/branches/:id
   */
  async updateBranch(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const branchId = req.params.id;
      const updaterId = req.user.id;
      const result = await branchService.updateBranch(bankId, branchId, req.body, updaterId);
      return this.sendSuccess(res, result, 'Branch details updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/society/branches/:id
   */
  async deleteBranch(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const branchId = req.params.id;
      const deleterId = req.user.id;
      const result = await branchService.deleteBranch(bankId, branchId, deleterId);
      return this.sendSuccess(res, result, 'Branch deactivated successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/society/branches/:id/manager
   * Returns full Manager profile including all 6 HR sections
   */
  async getBranchManager(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const branchId = req.params.id;
      const result = await branchService.getBranchManager(bankId, branchId);
      return this.sendSuccess(res, result, 'Branch Manager details retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/society/branches/:id/manager
   * Multi-section or root profile update
   */
  async updateBranchManager(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const branchId = req.params.id;
      const updaterId = req.user.id;
      const result = await branchService.updateBranchManager(bankId, branchId, req.body, updaterId);
      return this.sendSuccess(res, result, 'Branch Manager details updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/society/branches/:id/manager/personal-details
   */
  async updatePersonalDetails(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const branchId = req.params.id;
      const updaterId = req.user.id;
      const result = await branchService.updatePersonalDetails(bankId, branchId, req.body, updaterId);
      return this.sendSuccess(res, result, 'Personal details updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/society/branches/:id/manager/job-details
   */
  async updateJobDetails(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const branchId = req.params.id;
      const updaterId = req.user.id;
      const result = await branchService.updateJobDetails(bankId, branchId, req.body, updaterId);
      return this.sendSuccess(res, result, 'Job details updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/society/branches/:id/manager/shift-settings
   */
  async updateShiftSettings(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const branchId = req.params.id;
      const updaterId = req.user.id;
      const result = await branchService.updateShiftSettings(bankId, branchId, req.body, updaterId);
      return this.sendSuccess(res, result, 'Shift settings updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/society/branches/:id/manager/attendance-settings
   */
  async updateAttendanceSettings(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const branchId = req.params.id;
      const updaterId = req.user.id;
      const result = await branchService.updateAttendanceSettings(bankId, branchId, req.body, updaterId);
      return this.sendSuccess(res, result, 'Attendance settings updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/society/branches/:id/manager/woff-hoff-settings
   */
  async updateWoffHoffSettings(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const branchId = req.params.id;
      const updaterId = req.user.id;
      const result = await branchService.updateWoffHoffSettings(bankId, branchId, req.body, updaterId);
      return this.sendSuccess(res, result, 'WOFF / HOFF settings updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/society/branches/:id/manager/kra-settings
   */
  async updateKraSettings(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const branchId = req.params.id;
      const updaterId = req.user.id;
      const result = await branchService.updateKraSettings(bankId, branchId, req.body, updaterId);
      return this.sendSuccess(res, result, 'KRA settings updated successfully.');
    } catch (error) {
      next(error);
    }
  }
}

export const branchController = new BranchController();
