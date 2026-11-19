import { BaseController } from '../../../../common/base.controller.js';
import { employeeLoansService } from '../services/loans.service.js';

export class EmployeeLoansController extends BaseController {
  constructor() {
    super();
    this.getEligibleSlabs = this.catchAsync(this.getEligibleSlabs.bind(this));
    this.listLoans = this.catchAsync(this.listLoans.bind(this));
    this.getLoanDetails = this.catchAsync(this.getLoanDetails.bind(this));
    this.calculateEmi = this.catchAsync(this.calculateEmi.bind(this));
    this.sendDisbursalOtp = this.catchAsync(this.sendDisbursalOtp.bind(this));
    this.setupEmi = this.catchAsync(this.setupEmi.bind(this));
    this.addBankAccount = this.catchAsync(this.addBankAccount.bind(this));
    this.getAgreement = this.catchAsync(this.getAgreement.bind(this));
    this.getAccountForm = this.catchAsync(this.getAccountForm.bind(this));
    this.getMembershipForm = this.catchAsync(this.getMembershipForm.bind(this));
    this.getEmiCollectionSchedule = this.catchAsync(this.getEmiCollectionSchedule.bind(this));
    this.initiateEmiCollection = this.catchAsync(this.initiateEmiCollection.bind(this));
    this.verifyEmiCollection = this.catchAsync(this.verifyEmiCollection.bind(this));
    this.initiateDownPayment = this.catchAsync(this.initiateDownPayment.bind(this));
    this.verifyDownPayment = this.catchAsync(this.verifyDownPayment.bind(this));
    this.handlePaymentWebhook = this.catchAsync(this.handlePaymentWebhook.bind(this));
    this.getEmiCardDetails = this.catchAsync(this.getEmiCardDetails.bind(this));
  }

  async getEligibleSlabs(req, res, next) {
    const productPrice = req.query.productPrice || req.body?.productPrice;
    const result = await employeeLoansService.getEligibleSlabs(productPrice, { ...req.query, ...req.body });
    return this.sendResponse(res, 200, result, 'Eligible EMI slabs retrieved successfully.');
  }

  async listLoans(req, res, next) {
    const { status, search, page, limit } = req.query;
    const userId = req.user?.id || req.user?._id;
    const result = await employeeLoansService.listLoans(userId, { status, search, page, limit });
    return this.sendPaginated(res, result.items, result.pagination, 'Loans retrieved successfully.');
  }

  async getLoanDetails(req, res, next) {
    const { id } = req.params;
    const result = await employeeLoansService.getLoanDetails(id, req.user.id);
    return this.sendResponse(res, 200, result, 'Loan details successfully retrieved.');
  }

  async calculateEmi(req, res, next) {
    const payload = { ...req.query, ...req.body };
    const result = await employeeLoansService.calculateLoan(payload, req.user.id);
    return this.sendResponse(res, 200, result, 'EMI breakdown options successfully calculated.');
  }

  async sendDisbursalOtp(req, res, next) {
    const { id } = req.params;
    const result = await employeeLoansService.sendDisbursalOtp(id, req.user.id);
    return this.sendResponse(res, 200, result, result.message);
  }

  async setupEmi(req, res, next) {
    const { id } = req.params;
    const result = await employeeLoansService.setupEmi(id, req.body, req.user.id);
    return this.sendResponse(res, 200, result, result.message);
  }

  async addBankAccount(req, res, next) {
    const { id } = req.params;
    const result = await employeeLoansService.addBankAccount(id, req.body, req.user.id);
    return this.sendResponse(res, 200, result, result.message);
  }

  async getAgreement(req, res, next) {
    const { id } = req.params;
    const result = await employeeLoansService.getAgreement(id);
    return this.sendResponse(res, 200, result, result.message);
  }

  async getAccountForm(req, res, next) {
    const { id } = req.params;
    const result = await employeeLoansService.getAccountForm(id);
    return this.sendResponse(res, 200, result, result.message);
  }

  async getMembershipForm(req, res, next) {
    const { id } = req.params;
    const result = await employeeLoansService.getMembershipForm(id);
    return this.sendResponse(res, 200, result, result.message);
  }

  async getEmiCollectionSchedule(req, res, next) {
    const { id } = req.params;
    const result = await employeeLoansService.getEmiCollectionSchedule(id, req.user.id);
    return this.sendResponse(res, 200, result, 'EMI collection schedule successfully retrieved.');
  }

  async initiateEmiCollection(req, res, next) {
    const { id } = req.params;
    const { installmentIds, paymentMethod } = req.body;
    const result = await employeeLoansService.initiateEmiCollection(id, installmentIds, paymentMethod, req.user.id);
    return this.sendResponse(res, 200, result, result.message);
  }

  async verifyEmiCollection(req, res, next) {
    const { id } = req.params;
    const { installmentIds, paymentMethod, otp, paymentStatus } = req.body;
    const result = await employeeLoansService.verifyEmiCollection(id, installmentIds, paymentMethod, { otp, paymentStatus }, req.user.id);
    return this.sendResponse(res, 200, result, result.message);
  }

  async initiateDownPayment(req, res, next) {
    const { id } = req.params;
    const { paymentMethod } = req.body;
    const result = await employeeLoansService.initiateDownPayment(id, paymentMethod, req.user.id);
    return this.sendResponse(res, 200, result, result.message);
  }

  async verifyDownPayment(req, res, next) {
    const { id } = req.params;
    const result = await employeeLoansService.verifyDownPayment(id, req.body, req.user.id);
    return this.sendResponse(res, 200, result, result.message);
  }

  async handlePaymentWebhook(req, res, next) {
    const result = await employeeLoansService.handlePaymentWebhook(req.headers, req.body);
    return this.sendResponse(res, 200, result, result.message);
  }

  async getEmiCardDetails(req, res, next) {
    const { id } = req.params;
    const result = await employeeLoansService.getEmiCardDetails(id, req.user.id);
    return this.sendResponse(res, 200, result, 'EMI Card details successfully retrieved.');
  }
}

export const employeeLoansController = new EmployeeLoansController();
