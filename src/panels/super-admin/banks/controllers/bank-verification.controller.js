import { BaseController } from '../../../../common/base.controller.js';
import { bankVerificationService } from '../services/bank-verification.service.js';

export class BankVerificationController extends BaseController {
  constructor() {
    super();
    this.verifyBank = this.catchAsync(this.verifyBank.bind(this));
    this.allotCredits = this.catchAsync(this.allotCredits.bind(this));
  }

  async verifyBank(req, res, next) {
    const { id } = req.params;
    const updaterId = req.user?.id || null;
    const result = await bankVerificationService.verifyBank(id, req.body, updaterId);
    return this.sendResponse(res, 200, result, 'Bank onboarding verification action completed successfully.');
  }

  async allotCredits(req, res, next) {
    const { id } = req.params;
    const result = await bankVerificationService.allotCredits(id, req.body);
    return this.sendResponse(res, 200, result, 'Credits successfully alloted to the cooperative bank by Super Admin.');
  }
}

export const bankVerificationController = new BankVerificationController();
