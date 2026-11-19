import { BaseController } from '../../../../common/base.controller.js';
import { merchantService } from '../services/merchant.service.js';

export class MerchantController extends BaseController {
  constructor() {
    super();
    this.list = this.catchAsync(this.list.bind(this));
    this.getById = this.catchAsync(this.getById.bind(this));
    this.create = this.catchAsync(this.create.bind(this));
    this.update = this.catchAsync(this.update.bind(this));
    this.delete = this.catchAsync(this.delete.bind(this));
    this.dropdown = this.catchAsync(this.dropdown.bind(this));
  }

  async list(req, res, next) {
    const result = await merchantService.listMerchants(req.query);
    return this.sendPaginated(res, result.items, result.meta, 'Merchants list retrieved successfully.');
  }

  async getById(req, res, next) {
    const result = await merchantService.getMerchantById(req.params.id);
    return this.sendResponse(res, 200, result, 'Merchant details retrieved successfully.');
  }

  async create(req, res, next) {
    const creatorId = req.user?.id || null;
    const result = await merchantService.createMerchant(req.body, req.files || {}, creatorId);
    return this.sendCreated(res, result, 'Merchant created successfully.');
  }

  async update(req, res, next) {
    const updaterId = req.user?.id || null;
    const result = await merchantService.updateMerchant(req.params.id, req.body, req.files || {}, updaterId);
    return this.sendResponse(res, 200, result, 'Merchant updated successfully.');
  }

  async delete(req, res, next) {
    const deleterId = req.user?.id || null;
    await merchantService.deleteMerchant(req.params.id, deleterId);
    return this.sendResponse(res, 200, null, 'Merchant deleted successfully.');
  }

  async dropdown(req, res, next) {
    const result = await merchantService.listMerchantsDropdown();
    return this.sendResponse(res, 200, result, 'Merchants dropdown list retrieved successfully.');
  }
}

export const merchantController = new MerchantController();
