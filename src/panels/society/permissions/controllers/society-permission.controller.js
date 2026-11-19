import { BaseController } from '../../../../common/base.controller.js';
import { societyPermissionService } from '../services/society-permission.service.js';

export class SocietyPermissionController extends BaseController {
  constructor() {
    super();
    this.getPermissions = this.getPermissions.bind(this);
  }

  /**
   * GET /api/v1/society/permissions
   * Retrieves list of system permission modules and keys for UI rendering
   */
  async getPermissions(req, res, next) {
    try {
      const result = await societyPermissionService.getAvailablePermissions();
      return this.sendSuccess(res, result, 'Available permissions retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }
}

export const societyPermissionController = new SocietyPermissionController();
