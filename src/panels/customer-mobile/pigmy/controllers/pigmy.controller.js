import { BaseController } from '../../../../common/base.controller.js';
import { customerPigmyService } from '../services/pigmy.service.js';

export class CustomerPigmyController extends BaseController {
  constructor() {
    super();
    this.listAccounts = this.catchAsync(this.listAccounts.bind(this));
    this.getAccountDetails = this.catchAsync(this.getAccountDetails.bind(this));
  }

  /**
   * Retrieves all pigmy accounts for logged-in customer across all banks
   */
  async listAccounts(req, res, next) {
    const customerId = req.user.id || req.user._id || req.user.userId;
    const result = await customerPigmyService.getPigmyAccounts(customerId, req.query);
    return this.sendResponse(res, 200, result, 'Pigmy accounts and dashboard summary retrieved successfully.');
  }

  /**
   * Retrieves single pigmy account details
   */
  async getAccountDetails(req, res, next) {
    const customerId = req.user.id || req.user._id || req.user.userId;
    const { id } = req.params;
    const account = await customerPigmyService.getPigmyAccountDetails(customerId, id);
    return this.sendResponse(res, 200, account, 'Pigmy account details retrieved successfully.');
  }
}

export const customerPigmyController = new CustomerPigmyController();
