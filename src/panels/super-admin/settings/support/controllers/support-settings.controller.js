import { BaseController } from '../../../../../common/base.controller.js';
import { supportSettingsService } from '../services/support-settings.service.js';

export class SupportSettingsController extends BaseController {
  constructor() {
    super();
    this.getSupportSettings = this.catchAsync(this.getSupportSettings.bind(this));
    this.updateSupportSettings = this.catchAsync(this.updateSupportSettings.bind(this));
  }

  async getSupportSettings(req, res, next) {
    const result = await supportSettingsService.getSupportSettings();
    return this.sendResponse(res, 200, result, 'Support settings retrieved successfully.');
  }

  async updateSupportSettings(req, res, next) {
    const updaterId = req.user?.id || null;
    const result = await supportSettingsService.updateSupportSettings(req.body, updaterId);
    return this.sendResponse(res, 200, result, 'Support settings updated successfully.');
  }
}

export const supportSettingsController = new SupportSettingsController();
