import { BaseController } from '../../../../common/base.controller.js';
import { customersService } from '../services/customers.service.js';

export class CustomersController extends BaseController {
  constructor() {
    super();
    this.listCustomers = this.catchAsync(this.listCustomers.bind(this));
    this.getCustomerById = this.catchAsync(this.getCustomerById.bind(this));
    this.createCustomer = this.catchAsync(this.createCustomer.bind(this));
    this.updateCustomer = this.catchAsync(this.updateCustomer.bind(this));
    this.deleteCustomer = this.catchAsync(this.deleteCustomer.bind(this));
    this.getCustomerLoans = this.catchAsync(this.getCustomerLoans.bind(this));
    this.getSingleLoan = this.catchAsync(this.getSingleLoan.bind(this));
  }

  async listCustomers(req, res, next) {
    const result = await customersService.listCustomers(req.query);
    return this.sendPaginated(res, result.items, result.meta, 'Customers list retrieved successfully.');
  }

  async getCustomerById(req, res, next) {
    const result = await customersService.getCustomerById(req.params.id);
    return this.sendResponse(res, 200, result, 'Customer details retrieved successfully.');
  }

  async createCustomer(req, res, next) {
    const creatorId = req.user?.id || null;
    const result = await customersService.createCustomer(req.body, req.file, creatorId);
    return this.sendCreated(res, result, 'Customer created successfully.');
  }

  async updateCustomer(req, res, next) {
    const updaterId = req.user?.id || null;
    const result = await customersService.updateCustomer(req.params.id, req.body, req.file, updaterId);
    return this.sendResponse(res, 200, result, 'Customer updated successfully.');
  }

  async deleteCustomer(req, res, next) {
    const deleterId = req.user?.id || null;
    await customersService.deleteCustomer(req.params.id, deleterId);
    return this.sendResponse(res, 200, null, 'Customer deleted successfully.');
  }

  async getCustomerLoans(req, res, next) {
    const result = await customersService.getCustomerLoans(req.params.id, req.query);
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Customer loans retrieved successfully.',
      summary: result.summary,
      data: result.items,
      meta: result.meta
    });
  }

  async getSingleLoan(req, res, next) {
    const result = await customersService.getSingleLoan(req.params.id, req.params.loanId);
    return this.sendResponse(res, 200, result, 'Loan details retrieved successfully.');
  }
}

export const customersController = new CustomersController();
