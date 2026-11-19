import { BaseController } from '../../../../common/base.controller.js';
import { centralStockService } from '../services/central-stock.service.js';

export class CentralStockController extends BaseController {
  constructor() {
    super();
    for (const method of [
      'createCentralInventory',
      'getCentralInventoryById',
      'updateCentralInventory',
      'deleteCentralInventory',
      'listCentralInventories',
      'receiveStock'
    ]) {
      this[method] = this[method].bind(this);
    }
  }

  async createCentralInventory(req, res, next) {
    try {
      const warehouse = await centralStockService.createCentralInventory(req.society, req.body);
      return this.sendCreated(res, warehouse, 'Central inventory warehouse created successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getCentralInventoryById(req, res, next) {
    try {
      const warehouse = await centralStockService.getCentralInventoryById(req.society, req.params.id);
      return this.sendSuccess(res, warehouse, 'Central inventory warehouse retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async updateCentralInventory(req, res, next) {
    try {
      const warehouse = await centralStockService.updateCentralInventory(req.society, req.params.id, req.body);
      return this.sendSuccess(res, warehouse, 'Central inventory warehouse updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  async deleteCentralInventory(req, res, next) {
    try {
      const result = await centralStockService.deleteCentralInventory(req.society, req.params.id);
      return this.sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async listCentralInventories(req, res, next) {
    try {
      const result = await centralStockService.listCentralInventories(req.society, req.query);
      return this.sendPaginated(res, result.items, result.meta, 'Central inventory locations retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async receiveStock(req, res, next) {
    try {
      const result = await centralStockService.receiveStock(req.society, req.body, req.user.id);
      return this.sendCreated(res, result, 'Stock received into central inventory successfully.');
    } catch (error) {
      next(error);
    }
  }
}

export const centralStockController = new CentralStockController();

