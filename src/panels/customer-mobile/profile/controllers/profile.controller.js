import { BaseController } from '../../../../common/base.controller.js';
import { customerProfileService } from '../services/profile.service.js';

export class CustomerProfileController extends BaseController {
  constructor() {
    super();
    this.getSelf = this.catchAsync(this.getSelf.bind(this));
    this.updateSelf = this.catchAsync(this.updateSelf.bind(this));
  }

  async getSelf(req, res, next) {
    const userId = req.user.id;
    const profile = await customerProfileService.getProfile(userId);
    return this.sendResponse(res, 200, profile, 'Profile details retrieved successfully.');
  }

  async updateSelf(req, res, next) {
    const userId = req.user.id;
    const file = req.file; // Parse multer uploaded file
    const profile = await customerProfileService.updateProfile(userId, req.body, file);
    return this.sendResponse(res, 200, profile, 'Profile successfully updated.');
  }
}

export const customerProfileController = new CustomerProfileController();
