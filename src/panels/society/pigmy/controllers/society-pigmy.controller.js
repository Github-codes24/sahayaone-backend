import { BaseController } from '../../../../common/base.controller.js';
import { societyPigmyService } from '../services/society-pigmy.service.js';

export class SocietyPigmyController extends BaseController {
  constructor() {
    super();
    this.listPigmyCustomers = this.catchAsync(this.listPigmyCustomers.bind(this));
    this.getPigmyCustomerDetails = this.catchAsync(this.getPigmyCustomerDetails.bind(this));
    this.approvePigmyCustomer = this.catchAsync(this.approvePigmyCustomer.bind(this));
    this.rejectPigmyCustomer = this.catchAsync(this.rejectPigmyCustomer.bind(this));
    this.addSocietyAccount = this.catchAsync(this.addSocietyAccount.bind(this));
  }

  /**
   * 1. View Single Pigmy Customer Details (Society Panel)
   * GET /api/v1/society/pigmy-customers/:id
   */
  async getPigmyCustomerDetails(req, res, next) {
    const { id } = req.params;
    const userContext = req.user || req.society || {};
    const result = await societyPigmyService.getPigmyCustomerDetails(userContext, id);
    return this.sendResponse(res, 200, result, 'Pigmy customer details retrieved successfully.');
  }

  /**
   * 2. Approve Pigmy Customer (Checks for Society Account Number existence)
   * POST /api/v1/society/pigmy-customers/:id/approve
   */
  async approvePigmyCustomer(req, res, next) {
    const { id } = req.params;
    const userContext = req.user || req.society || {};
    const result = await societyPigmyService.approvePigmyCustomer(userContext, id, req.body);
    return this.sendResponse(res, 200, result.pigmyCustomer, result.message);
  }

  /**
   * 3. Reject Pigmy Customer
   * POST /api/v1/society/pigmy-customers/:id/reject
   */
  async rejectPigmyCustomer(req, res, next) {
    const { id } = req.params;
    const userContext = req.user || req.society || {};
    const result = await societyPigmyService.rejectPigmyCustomer(userContext, id, req.body);
    return this.sendResponse(res, 200, result.pigmyCustomer, result.message);
  }

  /**
   * 4. Add / Link Society Account Numbers and Details
   * POST /api/v1/society/pigmy-customers/:id/society-account
   * POST /api/v1/society/pigmy-customers/society-account
   */
  async addSocietyAccount(req, res, next) {
    const targetId = req.params.id || req.body.pigmyCustomerId || req.body.customerId || req.body.id;
    const userContext = req.user || req.society || {};
    const result = await societyPigmyService.addSocietyAccount(userContext, targetId, req.body);
    return this.sendResponse(res, 200, result.pigmyCustomer, result.message, { societyAccount: result.societyAccount });
  }

  /**
   * 5. List Executive/Society Pigmy Customers with Branch Scoping
   * GET /api/v1/society/pigmy-customers
   */
  async listPigmyCustomers(req, res, next) {
    const userContext = req.user || req.society || {};
    const result = await societyPigmyService.listPigmyCustomers(userContext, req.query);
    return this.sendResponse(res, 200, result.items, 'Pigmy customer leads list retrieved successfully.', {
      pagination: result.pagination,
      stats: result.stats
    });
  }
}

export const societyPigmyController = new SocietyPigmyController();
