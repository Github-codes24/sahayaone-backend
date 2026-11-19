import { BaseController } from '../../../../common/base.controller.js';
import { OnboardingEngineService } from '../services/onboarding-engine.service.js';
import { ApiError } from '../../../../common/api.error.js';

export class OnboardingEngineController extends BaseController {
  constructor() {
    super();
    this.checkStatus = this.catchAsync(this.checkStatus.bind(this));
    this.linkSocietyAccount = this.catchAsync(this.linkSocietyAccount.bind(this));
    this.getBanners = this.catchAsync(this.getBanners.bind(this));
  }

  /**
   * Retrieves active banners for Onboarding App
   * GET /api/v1/employee/onboarding/banners
   */
  async getBanners(req, res, next) {
    const result = await OnboardingEngineService.getBanners(req.query);
    return this.sendResponse(res, 200, result, 'Onboarding banners retrieved successfully.');
  }

  /**
   * Pre-onboarding phone lookup API
   * GET /api/v1/employee/onboarding/check-status
   */
  async checkStatus(req, res, next) {
    const { phoneNumber, bankId, branchId, productType } = req.query;

    const targetBankId = bankId || req.user?.bankId;
    const targetBranchId = branchId || req.user?.branchId;

    if (!phoneNumber) {
      throw ApiError.badRequest('Query parameter [phoneNumber] is required.');
    }

    const lookupResult = await OnboardingEngineService.lookupCustomerByPhone({
      phoneNumber,
      bankId: targetBankId,
      branchId: targetBranchId,
      productType: productType || 'LOAN'
    });

    return this.sendResponse(res, 200, lookupResult, 'Customer onboarding status retrieved successfully.');
  }

  /**
   * Branch Authorized Person links / updates Society Bank Account details for a customer
   * POST /api/v1/employee/onboarding/link-society-account
   */
  async linkSocietyAccount(req, res, next) {
    const {
      phoneNumber,
      userId,
      customerId,
      loanId,
      pigmyCustomerId,
      merchantId,
      id,
      bankId,
      branchId,
      societyAccountNumber,
      ifscCode,
      accountHolderName,
      bankBranchName
    } = req.body;

    const result = await OnboardingEngineService.linkSocietyAccount({
      phoneNumber,
      userId,
      customerId,
      loanId,
      pigmyCustomerId,
      merchantId,
      id,
      bankId: bankId || req.user?.bankId,
      branchId: branchId || req.user?.branchId,
      societyAccountNumber,
      ifscCode,
      accountHolderName,
      bankBranchName,
      authorizedUser: req.user
    });

    return this.sendResponse(res, 200, result, result.message);
  }
}

export const onboardingEngineController = new OnboardingEngineController();
