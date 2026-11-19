import { BaseController } from '../../../../common/base.controller.js';
import { employeeMerchantService } from '../services/employee-merchant.service.js';

export class EmployeeMerchantController extends BaseController {
  constructor() {
    super();
    this.onboardMerchant = this.catchAsync(this.onboardMerchant.bind(this));
    this.listMerchants = this.catchAsync(this.listMerchants.bind(this));
    this.getMerchantDetails = this.catchAsync(this.getMerchantDetails.bind(this));
  }

  async onboardMerchant(req, res, next) {
    const result = await employeeMerchantService.onboardMerchant(
      req.user,
      req.body,
      req.files || {}
    );
    return this.sendCreated(res, result.merchant, result.message);
  }

  async listMerchants(req, res, next) {
    const result = await employeeMerchantService.listMerchants(req.user, req.query);
    return this.sendPaginated(
      res,
      result.items,
      result.pagination,
      'Merchant leads list retrieved successfully.',
      { stats: result.stats }
    );
  }

  async getMerchantDetails(req, res, next) {
    const { id } = req.params;
    const result = await employeeMerchantService.getMerchantDetails(req.user, id);
    return this.sendResponse(res, 200, result, 'Merchant details retrieved successfully.');
  }
}

export const employeeMerchantController = new EmployeeMerchantController();
