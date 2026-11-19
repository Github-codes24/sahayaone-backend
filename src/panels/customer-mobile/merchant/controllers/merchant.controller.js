import { BaseController } from '../../../../common/base.controller.js';
import { customerMerchantService } from '../services/merchant.service.js';

export class CustomerMerchantController extends BaseController {
  constructor() {
    super();
    this.getProfile = this.catchAsync(this.getProfile.bind(this));
    this.getShopDetails = this.catchAsync(this.getShopDetails.bind(this));
    this.getSummary = this.catchAsync(this.getSummary.bind(this));
  }

  /**
   * Retrieves merchant shop profile(s) for logged-in customer
   */
  async getProfile(req, res, next) {
    const customerId = req.user.id || req.user._id || req.user.userId;
    const result = await customerMerchantService.getMerchantProfile(customerId);
    return this.sendResponse(res, 200, result, 'Merchant profile retrieved successfully.');
  }

  /**
   * Retrieves specific merchant shop details
   */
  async getShopDetails(req, res, next) {
    const customerId = req.user.id || req.user._id || req.user.userId;
    const { id } = req.params;
    const result = await customerMerchantService.getShopDetails(customerId, id);
    return this.sendResponse(res, 200, result, 'Merchant shop details retrieved successfully.');
  }

  /**
   * Retrieves merchant activity summary (merchant pigmy & loans)
   */
  async getSummary(req, res, next) {
    const customerId = req.user.id || req.user._id || req.user.userId;
    const result = await customerMerchantService.getMerchantSummary(customerId);
    return this.sendResponse(res, 200, result, 'Merchant summary retrieved successfully.');
  }
}

export const customerMerchantController = new CustomerMerchantController();
