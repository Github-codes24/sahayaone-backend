import { BaseController } from '../../../../common/base.controller.js';
import { merchantVerificationCreditsService } from '../services/merchant-verification-credits.service.js';

export class MerchantVerificationCreditsController extends BaseController {
  constructor() {
    super();
    this.requestCredits = this.catchAsync(this.requestCredits.bind(this));
    this.getRequestHistory = this.catchAsync(this.getRequestHistory.bind(this));
    this.getCreditBalance = this.catchAsync(this.getCreditBalance.bind(this));
  }

  /**
   * GET /api/v1/merchant/verification-credits/balance
   * GET /api/v1/merchant/verification-credits/available
   */
  async getCreditBalance(req, res) {
    const result = await merchantVerificationCreditsService.getCreditBalance(req.user);
    return this.sendResponse(res, 200, result, 'Merchant available verification credit balance retrieved successfully.');
  }

  /**
   * POST /api/v1/merchant/verification-credits/request
   */
  async requestCredits(req, res) {
    const result = await merchantVerificationCreditsService.requestCredits(req.body, req.user);
    return this.sendCreated(res, result, 'Verification credit request submitted successfully.');
  }

  /**
   * GET /api/v1/merchant/verification-credits/requests
   * GET /api/v1/merchant/verification-credits/request-history
   */
  async getRequestHistory(req, res) {
    const result = await merchantVerificationCreditsService.getRequestHistory(req.user, req.query);
    return this.sendResponse(res, 200, result, 'Verification credit request history retrieved successfully.');
  }
}

export const merchantVerificationCreditsController = new MerchantVerificationCreditsController();
