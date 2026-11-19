import { BaseController } from '../../../../common/base.controller.js';
import { superAdminDashboardService } from '../services/dashboard.service.js';

export class SuperAdminDashboardController extends BaseController {
  constructor() {
    super();
    this.getOverview = this.catchAsync(this.getOverview.bind(this));
  }

  async getOverview(req, res, next) {
    const result = await superAdminDashboardService.getDashboardOverview(req.query);
    return this.sendResponse(res, 200, result, 'Dashboard overview data retrieved successfully.');
  }
}

export const superAdminDashboardController = new SuperAdminDashboardController();
