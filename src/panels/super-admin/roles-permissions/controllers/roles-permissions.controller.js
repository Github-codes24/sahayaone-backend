import { BaseController } from '../../../../common/base.controller.js';
import { rolesPermissionsService } from '../services/roles-permissions.service.js';

export class RolesPermissionsController extends BaseController {
  constructor() {
    super();
    this.listSubAdmins = this.catchAsync(this.listSubAdmins.bind(this));
    this.getSubAdminById = this.catchAsync(this.getSubAdminById.bind(this));
    this.createSubAdmin = this.catchAsync(this.createSubAdmin.bind(this));
    this.updateSubAdmin = this.catchAsync(this.updateSubAdmin.bind(this));
    this.deleteSubAdmin = this.catchAsync(this.deleteSubAdmin.bind(this));
    this.getPermissions = this.catchAsync(this.getPermissions.bind(this));
  }

  /**
   * HTTP Handler to retrieve list of Sub-Admins
   */
  async listSubAdmins(req, res, next) {
    const result = await rolesPermissionsService.listSubAdmins(req.query);
    return this.sendPaginated(res, result.items, result.meta, 'Sub-Admins list retrieved successfully.');
  }

  /**
   * HTTP Handler to retrieve details of a specific Sub-Admin
   */
  async getSubAdminById(req, res, next) {
    const result = await rolesPermissionsService.getSubAdminById(req.params.id);
    return this.sendResponse(res, 200, result, 'Sub-Admin details retrieved successfully.');
  }

  /**
   * HTTP Handler to create a new Sub-Admin
   */
  async createSubAdmin(req, res, next) {
    const creatorId = req.user?.id || null;
    const result = await rolesPermissionsService.createSubAdmin(req.body, creatorId);
    return this.sendCreated(res, result, 'Sub-Admin account created successfully.');
  }

  /**
   * HTTP Handler to update a Sub-Admin
   */
  async updateSubAdmin(req, res, next) {
    const updaterId = req.user?.id || null;
    const result = await rolesPermissionsService.updateSubAdmin(req.params.id, req.body, updaterId);
    return this.sendResponse(res, 200, result, 'Sub-Admin account updated successfully.');
  }

  /**
   * HTTP Handler to delete a Sub-Admin
   */
  async deleteSubAdmin(req, res, next) {
    const deleterId = req.user?.id || null;
    await rolesPermissionsService.deleteSubAdmin(req.params.id, deleterId);
    return this.sendResponse(res, 200, null, 'Sub-Admin account deleted successfully.');
  }

  /**
   * HTTP Handler to retrieve list of checkbox permissions grouped by module
   */
  async getPermissions(req, res, next) {
    const result = await rolesPermissionsService.getAvailablePermissions();
    return this.sendResponse(res, 200, result, 'Available system permissions list retrieved successfully.');
  }
}

export const rolesPermissionsController = new RolesPermissionsController();
