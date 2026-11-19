import { BaseController } from '../../../../common/base.controller.js';
import { inventoryService } from '../services/inventory.service.js';

export class InventoryController extends BaseController {
  constructor() {
    super();
    for (const method of ['list', 'create', 'update', 'remove', 'exportCsv']) this[method] = this[method].bind(this);
  }

  async list(req, res, next) {
    try {
      const result = await inventoryService.list(req.society, req.query);
      return this.sendPaginated(res, result.items, result.meta, 'Inventory retrieved successfully.');
    } catch (error) { next(error); }
  }

  async create(req, res, next) {
    try {
      const result = await inventoryService.create(req.society, req.body, req.user.id);
      return this.sendCreated(res, result, 'Inventory added successfully.');
    } catch (error) { next(error); }
  }

  async update(req, res, next) {
    try {
      const result = await inventoryService.update(req.society, req.params.id, req.body, req.user.id);
      return this.sendResponse(res, 200, result, 'Inventory updated successfully.');
    } catch (error) { next(error); }
  }

  async remove(req, res, next) {
    try {
      const result = await inventoryService.remove(req.society, req.params.id, req.user.id);
      return this.sendResponse(res, 200, result, 'Inventory deleted successfully.');
    } catch (error) { next(error); }
  }

  async exportCsv(req, res, next) {
    try {
      const csv = await inventoryService.exportCsv(req.society, req.query);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="inventory.csv"');
      return res.status(200).send(csv);
    } catch (error) { next(error); }
  }
}

export const inventoryController = new InventoryController();
