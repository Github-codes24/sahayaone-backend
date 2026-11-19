import { BaseController } from '../../../../common/base.controller.js';
import { stockAdjustmentService } from '../services/stock-adjustment.service.js';

export class StockAdjustmentController extends BaseController {
  constructor() {
    super();
    for (const method of [
      'createStockAdjustment',
      'listStockAdjustments',
      'getAdjustmentById',
      'updateStockAdjustment',
      'deleteStockAdjustment',
      'approveAdjustment',
      'rejectAdjustment'
    ]) {
      this[method] = this[method].bind(this);
    }
  }

  async createStockAdjustment(req, res, next) {
    try {
      const adjustment = await stockAdjustmentService.createStockAdjustment(req.society, req.body);
      return this.sendCreated(res, adjustment, 'Stock adjustment request created successfully.');
    } catch (error) {
      next(error);
    }
  }

  async listStockAdjustments(req, res, next) {
    try {
      const result = await stockAdjustmentService.listStockAdjustments(req.society, req.query);
      return this.sendPaginated(res, result.items, result.meta, 'Stock adjustments retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getAdjustmentById(req, res, next) {
    try {
      const adjustment = await stockAdjustmentService.getAdjustmentById(req.society, req.params.id);
      return this.sendSuccess(res, adjustment, 'Stock adjustment details retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async updateStockAdjustment(req, res, next) {
    try {
      const adjustment = await stockAdjustmentService.updateStockAdjustment(req.society, req.params.id, req.body);
      return this.sendSuccess(res, adjustment, 'Stock adjustment updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  async deleteStockAdjustment(req, res, next) {
    try {
      const result = await stockAdjustmentService.deleteStockAdjustment(req.society, req.params.id);
      return this.sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async approveAdjustment(req, res, next) {
    try {
      const adjustment = await stockAdjustmentService.approveAdjustment(req.society, req.params.id, req.body);
      return this.sendSuccess(res, adjustment, 'Stock adjustment approved and applied successfully.');
    } catch (error) {
      next(error);
    }
  }

  async rejectAdjustment(req, res, next) {
    try {
      const adjustment = await stockAdjustmentService.rejectAdjustment(req.society, req.params.id, req.body);
      return this.sendSuccess(res, adjustment, 'Stock adjustment rejected successfully.');
    } catch (error) {
      next(error);
    }
  }
}

export const stockAdjustmentController = new StockAdjustmentController();

