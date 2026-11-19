import { BaseController } from '../../../../common/base.controller.js';
import { employeeDashboardService } from '../services/dashboard.service.js';

export class EmployeeDashboardController extends BaseController {
  constructor() {
    super();
    this.getStats = this.catchAsync(this.getStats.bind(this));
    this.getBusinessCards = this.catchAsync(this.getBusinessCards.bind(this));
    this.getBanners = this.catchAsync(this.getBanners.bind(this));
  }

  async getBanners(req, res, next) {
    const result = await employeeDashboardService.getBanners(req.query);
    return this.sendResponse(res, 200, result, 'Executive banners successfully retrieved.');
  }

  async getStats(req, res, next) {
    const result = await employeeDashboardService.getStats(req.user.id, req.user);
    return this.sendResponse(res, 200, result, 'Employee dashboard statistics successfully retrieved.');
  }

  async getBusinessCards(req, res, next) {
    const result = await employeeDashboardService.getBusinessCards(req.user.id, req.user);
    return this.sendResponse(res, 200, result, 'Executive business overview cards successfully retrieved.');
  }
}

export const employeeDashboardController = new EmployeeDashboardController();
