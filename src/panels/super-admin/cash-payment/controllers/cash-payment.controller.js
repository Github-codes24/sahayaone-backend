import { BaseController } from '../../../../common/base.controller.js';
import { cashPaymentService } from '../services/cash-payment.service.js';

export class CashPaymentController extends BaseController {
  constructor() {
    super();
    this.list = this.catchAsync(this.list.bind(this));
    this.getById = this.catchAsync(this.getById.bind(this));
    this.submitCash = this.catchAsync(this.submitCash.bind(this));
  }

  async list(req, res, next) {
    const result = await cashPaymentService.listCashPayments(req.query);
    return this.sendPaginated(res, result.items, result.meta, 'Cash Payments list retrieved successfully.');
  }

  async getById(req, res, next) {
    const result = await cashPaymentService.getCashPaymentDetails(req.params.id, req.query);
    return this.sendResponse(res, 200, result, 'Cash Payment details retrieved successfully.');
  }

  async submitCash(req, res, next) {
    const submitterId = req.user?.id || null;
    const result = await cashPaymentService.submitCash(req.params.id, req.body, submitterId);
    return this.sendCreated(res, result, 'Cash submitted successfully.');
  }
}

export const cashPaymentController = new CashPaymentController();
