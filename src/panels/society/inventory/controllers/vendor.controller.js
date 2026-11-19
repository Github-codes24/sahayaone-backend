import { BaseController } from '../../../../common/base.controller.js';
import { vendorService } from '../services/vendor.service.js';

export class VendorController extends BaseController {
  constructor() {
    super();
    for (const method of ['createVendor', 'getVendorById', 'updateVendor', 'deleteVendor', 'listVendors']) {
      this[method] = this[method].bind(this);
    }
  }

  async createVendor(req, res, next) {
    try {
      const vendor = await vendorService.createVendor(req.society, req.body);
      return this.sendCreated(res, vendor, 'Vendor registered successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getVendorById(req, res, next) {
    try {
      const vendor = await vendorService.getVendorById(req.society, req.params.id);
      return this.sendSuccess(res, vendor, 'Vendor retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async updateVendor(req, res, next) {
    try {
      const vendor = await vendorService.updateVendor(req.society, req.params.id, req.body);
      return this.sendSuccess(res, vendor, 'Vendor updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  async deleteVendor(req, res, next) {
    try {
      const result = await vendorService.deleteVendor(req.society, req.params.id);
      return this.sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async listVendors(req, res, next) {
    try {
      const result = await vendorService.listVendors(req.society, req.query);
      return this.sendPaginated(res, result.items, result.meta, 'Vendors retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }
}

export const vendorController = new VendorController();

