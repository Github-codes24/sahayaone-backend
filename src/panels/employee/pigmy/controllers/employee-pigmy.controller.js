import { BaseController } from '../../../../common/base.controller.js';
import { employeePigmyService } from '../services/employee-pigmy.service.js';

export class EmployeePigmyController extends BaseController {
  constructor() {
    super();
    this.onboardPigmyCustomer = this.catchAsync(this.onboardPigmyCustomer.bind(this));
    this.listPigmyCustomers = this.catchAsync(this.listPigmyCustomers.bind(this));
    this.getPigmyCustomerDetails = this.catchAsync(this.getPigmyCustomerDetails.bind(this));
    this.getActiveSchemes = this.catchAsync(this.getActiveSchemes.bind(this));
    this.approvePigmyCustomer = this.catchAsync(this.approvePigmyCustomer.bind(this));
    this.rejectPigmyCustomer = this.catchAsync(this.rejectPigmyCustomer.bind(this));
  }

  /**
   * 1. Onboard Pigmy Deposit Customer (Normal Person or Merchant)
   * POST /api/v1/employee/pigmy-customers/onboard
   */
  async onboardPigmyCustomer(req, res, next) {
    const result = await employeePigmyService.onboardPigmyCustomer(req.user, req.body, req.files);
    return this.sendResponse(res, 201, result.pigmyCustomer, result.message);
  }

  /**
   * 2. List Active SIP Schemes for the Executive's Bank
   * GET /api/v1/employee/pigmy-customers/schemes
   */
  async getActiveSchemes(req, res, next) {
    const result = await employeePigmyService.getActiveSchemes(req.user, req.query);
    return this.sendResponse(res, 200, result, 'Active SIP schemes retrieved successfully.');
  }

  /**
   * 3. List Executive Pigmy Customers (Scoped to Executive's own onboardings)
   * GET /api/v1/employee/pigmy-customers
   */
  async listPigmyCustomers(req, res, next) {
    const result = await employeePigmyService.listPigmyCustomers(req.user, req.query);
    return this.sendResponse(res, 200, result.items, 'Pigmy customer leads list retrieved successfully.', {
      pagination: result.pagination,
      stats: result.stats
    });
  }

  /**
   * 4. Get Single Pigmy Customer Details by ID
   * GET /api/v1/employee/pigmy-customers/:id
   */
  async getPigmyCustomerDetails(req, res, next) {
    const { id } = req.params;
    const result = await employeePigmyService.getPigmyCustomerDetails(req.user, id);
    return this.sendResponse(res, 200, result, 'Pigmy customer details retrieved successfully.');
  }

  /**
   * 5. Approve Pigmy Customer (Branch Manager / Society Admin / Authorized Staff)
   * POST /api/v1/employee/pigmy-customers/:id/approve
   */
  async approvePigmyCustomer(req, res, next) {
    const { id } = req.params;
    const result = await employeePigmyService.approvePigmyCustomer(req.user, id, req.body);
    return this.sendResponse(res, 200, result.pigmyCustomer, result.message);
  }

  /**
   * 6. Reject Pigmy Customer (Branch Manager / Society Admin / Authorized Staff)
   * POST /api/v1/employee/pigmy-customers/:id/reject
   */
  async rejectPigmyCustomer(req, res, next) {
    const { id } = req.params;
    const result = await employeePigmyService.rejectPigmyCustomer(req.user, id, req.body);
    return this.sendResponse(res, 200, result.pigmyCustomer, result.message);
  }
}

export const employeePigmyController = new EmployeePigmyController();
