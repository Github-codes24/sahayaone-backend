import { BaseController } from '../../../../common/base.controller.js';
import { societyDashboardService } from '../services/society-dashboard.service.js';

export class SocietyDashboardController extends BaseController {
  constructor() {
    super();
    this.getStats = this.catchAsync(this.getStats.bind(this));
    this.getRevenueChart = this.catchAsync(this.getRevenueChart.bind(this));
    this.getLoanDistributedChart = this.catchAsync(this.getLoanDistributedChart.bind(this));
    this.getServicesStats = this.catchAsync(this.getServicesStats.bind(this));
    this.getOverview = this.catchAsync(this.getOverview.bind(this));
  }

  /**
   * API 1: Get Dashboard Stats
   */
  async getStats(req, res, next) {
    const result = await societyDashboardService.getStats(req.society, req.query);
    return this.sendResponse(res, 200, result, 'Society dashboard stats retrieved successfully.');
  }

  /**
   * API 2: Get Revenue Chart Data (Graph 1)
   */
  async getRevenueChart(req, res, next) {
    const result = await societyDashboardService.getRevenueChart(req.society, req.query);
    return this.sendResponse(res, 200, result, 'Society dashboard total revenue chart retrieved successfully.');
  }

  /**
   * API 3: Get Loan Distributed Chart Data (Graph 2)
   */
  async getLoanDistributedChart(req, res, next) {
    const result = await societyDashboardService.getLoanDistributedChart(req.society, req.query);
    return this.sendResponse(res, 200, result, 'Society dashboard loan distributed chart retrieved successfully.');
  }

  /**
   * API 4: Get Services Stats
   */
  async getServicesStats(req, res, next) {
    const result = await societyDashboardService.getServicesStats(req.society, req.query);
    return this.sendResponse(res, 200, result, 'Society dashboard services stats retrieved successfully.');
  }

  /**
   * Consolidated Dashboard Overview
   */
  async getOverview(req, res, next) {
    const result = await societyDashboardService.getOverview(req.society, req.query);
    return this.sendResponse(res, 200, result, 'Society dashboard overview data retrieved successfully.');
  }
}

export const societyDashboardController = new SocietyDashboardController();
