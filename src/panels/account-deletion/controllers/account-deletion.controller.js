import { BaseController } from '../../../common/base.controller.js';
import { accountDeletionService } from '../services/account-deletion.service.js';

export class AccountDeletionController extends BaseController {
  constructor() {
    super();
    this.requestOtp = this.catchAsync(this.requestOtp.bind(this));
    this.verifyAndDelete = this.catchAsync(this.verifyAndDelete.bind(this));
  }

  async requestOtp(req, res, next) {
    const { accountType, phoneNumber } = req.body;
    const result = await accountDeletionService.requestOtp(accountType, phoneNumber);
    return this.sendResponse(res, 200, result, result.message);
  }

  async verifyAndDelete(req, res, next) {
    const { accountType, phoneNumber, otp } = req.body;
    const result = await accountDeletionService.verifyAndDelete(accountType, phoneNumber, otp);
    return this.sendResponse(res, 200, result, result.message);
  }
}

export const accountDeletionController = new AccountDeletionController();
