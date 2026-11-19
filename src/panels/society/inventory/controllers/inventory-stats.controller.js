import { BaseController } from '../../../../common/base.controller.js';
import { inventoryStatsService } from '../services/inventory-stats.service.js';

export class InventoryStatsController extends BaseController {
  constructor() {
    super();
    for (const method of ['getCentralStats', 'getBranchStats', 'getOverallStats']) {
      this[method] = this[method].bind(this);
    }
  }

  async getCentralStats(req, res, next) {
    try {
      const stats = await inventoryStatsService.getCentralInventoryStats(req.society, req.query);
      return this.sendSuccess(res, stats, 'Central inventory statistics retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getBranchStats(req, res, next) {
    try {
      const stats = await inventoryStatsService.getBranchInventoryStats(req.society, req.query);
      return this.sendSuccess(res, stats, 'Branch inventory statistics retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getOverallStats(req, res, next) {
    try {
      const stats = await inventoryStatsService.getOverallInventoryStats(req.society);
      return this.sendSuccess(res, stats, 'Overall society inventory statistics retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }
}

export const inventoryStatsController = new InventoryStatsController();
