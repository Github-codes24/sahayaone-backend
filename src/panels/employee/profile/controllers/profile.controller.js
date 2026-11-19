import { BaseController } from '../../../../common/base.controller.js';
import { employeeProfileService } from '../services/profile.service.js';

export class EmployeeProfileController extends BaseController {
  constructor() {
    super();
    this.getProfile = this.catchAsync(this.getProfile.bind(this));
    this.changePassword = this.catchAsync(this.changePassword.bind(this));
    this.updateLocation = this.catchAsync(this.updateLocation.bind(this));
  }

  async getProfile(req, res, next) {
    const result = await employeeProfileService.getProfile(req.user.id);
    return this.sendResponse(res, 200, result, 'Employee profile successfully retrieved.');
  }

  async changePassword(req, res, next) {
    const { oldPassword, newPassword } = req.body;
    const result = await employeeProfileService.changePassword(req.user.id, oldPassword, newPassword);
    return this.sendResponse(res, 200, result, result.message);
  }

  async updateLocation(req, res, next) {
    const { latitude, longitude, address } = req.body;
    const result = await employeeProfileService.updateLocation(req.user.id, latitude, longitude, address || '');
    return this.sendResponse(res, 200, result, result.message);
  }
}

export const employeeProfileController = new EmployeeProfileController();
