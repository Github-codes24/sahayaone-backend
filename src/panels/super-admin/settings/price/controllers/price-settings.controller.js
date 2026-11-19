import { BaseController } from '../../../../../common/base.controller.js';
import { priceSettingsService } from '../services/price-settings.service.js';

export class PriceSettingsController extends BaseController {
  constructor() {
    super();
    this.getPriceSettings = this.catchAsync(this.getPriceSettings.bind(this));
    this.updatePriceSettings = this.catchAsync(this.updatePriceSettings.bind(this));
  }

  async getPriceSettings(req, res, next) {
    const result = await priceSettingsService.getPriceSettings();
    return this.sendResponse(res, 200, result, 'Price settings retrieved successfully.');
  }

  async updatePriceSettings(req, res, next) {
    const updaterId = req.user?.id || null;
    const result = await priceSettingsService.updatePriceSettings(req.body, updaterId);
    return this.sendResponse(res, 200, result, 'Price settings updated successfully.');
  }
}

export const priceSettingsController = new PriceSettingsController();
