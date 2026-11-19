import { BaseController } from '../../../../common/base.controller.js';
import { superAdminProfileService } from '../services/profile.service.js';

export class SuperAdminProfileController extends BaseController {
  constructor() {
    super();
    this.getProfile = this.catchAsync(this.getProfile.bind(this));
    this.updateProfile = this.catchAsync(this.updateProfile.bind(this));
    this.changePassword = this.catchAsync(this.changePassword.bind(this));
    this.resetUserPassword = this.catchAsync(this.resetUserPassword.bind(this));
  }

  /**
   * GET /api/v1/super-admin/profile
   * Fetch authenticated admin profile details
   */
  async getProfile(req, res, next) {
    const adminId = req.user.userId || req.user.id || req.user._id;
    const result = await superAdminProfileService.getProfile(adminId);
    return this.sendResponse(res, 200, result, 'Super Admin profile retrieved successfully.');
  }

  /**
   * PUT / PATCH /api/v1/super-admin/profile
   * Update admin profile details & avatar photo
   */
  async updateProfile(req, res, next) {
    const adminId = req.user.userId || req.user.id || req.user._id;
    const result = await superAdminProfileService.updateProfile(adminId, req.body, req.files);
    return this.sendResponse(res, 200, result, 'Super Admin profile updated successfully.');
  }

  /**
   * POST / PUT /api/v1/super-admin/profile/change-password
   * Change password for logged in admin user
   */
  async changePassword(req, res, next) {
    const adminId = req.user.userId || req.user.id || req.user._id;
    const result = await superAdminProfileService.changePassword(adminId, req.body);
    return this.sendResponse(res, 200, result, result.message);
  }

  /**
   * POST /api/v1/super-admin/profile/users/:id/reset-password
   * Administrator resets password for a target sub-admin user
   */
  async resetUserPassword(req, res, next) {
    const targetUserId = req.params.id || req.params.userId || req.body.userId;
    const performerId = req.user.userId || req.user.id || req.user._id;
    const result = await superAdminProfileService.adminResetUserPassword(targetUserId, req.body, performerId);
    return this.sendResponse(res, 200, result, result.message);
  }
}

export const superAdminProfileController = new SuperAdminProfileController();
