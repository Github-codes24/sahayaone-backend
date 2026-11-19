import { BaseController } from '../../../../common/base.controller.js';
import { customerLoanService } from '../services/loan.service.js';

export class CustomerLoanController extends BaseController {
  constructor() {
    super();
    this.list = this.catchAsync(this.list.bind(this));
    this.getDetails = this.catchAsync(this.getDetails.bind(this));
    this.payEmi = this.catchAsync(this.payEmi.bind(this));
    this.downloadNoc = this.catchAsync(this.downloadNoc.bind(this));
  }

  async list(req, res, next) {
    const customerId = req.user.id;
    const summary = await customerLoanService.getLoans(customerId);
    return this.sendResponse(res, 200, summary, 'Loans list and dashboard summary retrieved successfully.');
  }

  async getDetails(req, res, next) {
    const customerId = req.user.id;
    const { id } = req.params;
    const loan = await customerLoanService.getLoanDetails(customerId, id);
    return this.sendResponse(res, 200, loan, 'Loan details retrieved successfully.');
  }

  async payEmi(req, res, next) {
    const customerId = req.user.id;
    const { id } = req.params;
    const loan = await customerLoanService.payNextEmi(customerId, id);
    return this.sendResponse(res, 200, loan, 'EMI payment simulated successfully.');
  }

  async downloadNoc(req, res, next) {
    const customerId = req.user.id;
    const { id } = req.params;
    const buffer = await customerLoanService.generateMockNoc(customerId, id);
    
    // Set headers to download as attachment
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=NOC_Loan_${id}.pdf`);
    return res.send(buffer);
  }
}

export const customerLoanController = new CustomerLoanController();
