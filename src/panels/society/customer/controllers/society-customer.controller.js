import { BaseController } from '../../../../common/base.controller.js';
import { societyCustomerService } from '../services/society-customer.service.js';
import { OnboardingEngineService } from '../../../employee/onboarding/services/onboarding-engine.service.js';

export class SocietyCustomerController extends BaseController {
  constructor() {
    super();
    this.listCustomers = this.catchAsync(this.listCustomers.bind(this));
    this.getCustomerById = this.catchAsync(this.getCustomerById.bind(this));
    this.listCustomersDropdown = this.catchAsync(this.listCustomersDropdown.bind(this));
    this.linkSocietyAccount = this.catchAsync(this.linkSocietyAccount.bind(this));
  }

  /**
   * 1. Unified Paginated List of Society Customers & Merchants
   * GET /api/v1/society/customers
   */
  async listCustomers(req, res, next) {
    const userContext = req.user || req.society || {};
    const result = await societyCustomerService.listCustomers(userContext, req.query);
    return this.sendResponse(res, 200, result, 'Society customer & merchant list retrieved successfully.');
  }

  /**
   * 2. Detailed Member View (Customer / Merchant)
   * GET /api/v1/society/customers/:id
   */
  async getCustomerById(req, res, next) {
    const { id } = req.params;
    const { type } = req.query;
    const userContext = req.user || req.society || {};
    const result = await societyCustomerService.getCustomerById(userContext, id, type);
    return this.sendResponse(res, 200, result, 'Customer details retrieved successfully.');
  }

  /**
   * 3. Active Customers & Merchants Selection Dropdown List
   * GET /api/v1/society/customers/dropdown
   */
  async listCustomersDropdown(req, res, next) {
    const userContext = req.user || req.society || {};
    const result = await societyCustomerService.listCustomersDropdown(userContext, req.query);
    return this.sendResponse(res, 200, result, 'Customer dropdown list retrieved successfully.');
  }

  /**
   * 4. Link Society Account to Customer / Member
   * POST /api/v1/society/customers/:id/society-account
   * POST /api/v1/society/customers/link-society-account
   */
  async linkSocietyAccount(req, res, next) {
    const targetId = req.params.id || req.body.customerId || req.body.userId || req.body.id;
    const userContext = req.user || req.society || {};
    const result = await OnboardingEngineService.linkSocietyAccount({
      ...req.body,
      customerId: targetId,
      bankId: req.body.bankId || userContext.bankId,
      branchId: req.body.branchId || userContext.branchId,
      authorizedUser: userContext
    });
    return this.sendResponse(res, 200, result, result.message);
  }
}

export const societyCustomerController = new SocietyCustomerController();
