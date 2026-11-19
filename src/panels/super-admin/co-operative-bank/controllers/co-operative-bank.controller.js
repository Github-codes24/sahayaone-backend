import { BaseController } from '../../../../common/base.controller.js';
import { cooperativeBankService } from '../services/co-operative-bank.service.js';

export class CooperativeBankController extends BaseController {
  constructor() {
    super();
    this.list = this.catchAsync(this.list.bind(this));
    this.getById = this.catchAsync(this.getById.bind(this));
    this.create = this.catchAsync(this.create.bind(this));
    this.update = this.catchAsync(this.update.bind(this));
    this.delete = this.catchAsync(this.delete.bind(this));
    this.permanentDelete = this.catchAsync(this.permanentDelete.bind(this));
    this.dropdown = this.catchAsync(this.dropdown.bind(this));
    this.addCredit = this.catchAsync(this.addCredit.bind(this));
    this.updateStatus = this.catchAsync(this.updateStatus.bind(this));
    this.verifyCashOtp = this.catchAsync(this.verifyCashOtp.bind(this));
    this.resendCashOtp = this.catchAsync(this.resendCashOtp.bind(this));
    this.verifyOnlinePayment = this.catchAsync(this.verifyOnlinePayment.bind(this));
    this.paymentWebhook = this.catchAsync(this.paymentWebhook.bind(this));
    this.calculateEmiCardPrice = this.catchAsync(this.calculateEmiCardPrice.bind(this));
    this.calculateVerificationCreditPrice = this.catchAsync(this.calculateVerificationCreditPrice.bind(this));
    this.calculatePrice = this.catchAsync(this.calculatePrice.bind(this));
    this.changePassword = this.catchAsync(this.changePassword.bind(this));
    this.stats = this.catchAsync(this.stats.bind(this));

  }

  async list(req, res, next) {
    const result = await cooperativeBankService.listCooperativeBanks(req.query);
    return this.sendPaginated(res, result.items, result.meta, 'Co-operative Banks list retrieved successfully.');
  }

  async getById(req, res, next) {
    const result = await cooperativeBankService.getCooperativeBankById(req.params.id);
    return this.sendResponse(res, 200, result, 'Co-operative Bank details retrieved successfully.');
  }

  async create(req, res, next) {
    const creatorId = req.user?.id || req.user?.userId || req.user?._id || req.body?.createdBy || req.body?.creatorId || null;
    const result = await cooperativeBankService.createCooperativeBank(req.body, req.files || {}, creatorId);
    return this.sendCreated(res, result, 'Co-operative Bank created successfully.');
  }

  async update(req, res, next) {
    const updaterId = req.user?.id || req.user?.userId || req.user?._id || null;
    const result = await cooperativeBankService.updateCooperativeBank(req.params.id, req.body, req.files || {}, updaterId);
    return this.sendResponse(res, 200, result, 'Co-operative Bank updated successfully.');
  }

  async delete(req, res, next) {
    const deleterId = req.user?.id || req.user?.userId || req.user?._id || null;
    const isPermanent = req.query?.permanent === 'true' || req.query?.force === 'true' || req.query?.hard === 'true';

    if (isPermanent) {
      const result = await cooperativeBankService.permanentDeleteCooperativeBank(req.params.id, deleterId);
      return this.sendResponse(res, 200, result, 'Co-operative Bank permanently deleted from database.');
    }

    await cooperativeBankService.deleteCooperativeBank(req.params.id, deleterId);
    return this.sendResponse(res, 200, null, 'Co-operative Bank deleted successfully.');
  }

  async permanentDelete(req, res, next) {
    const deleterId = req.user?.id || req.user?.userId || req.user?._id || null;
    const result = await cooperativeBankService.permanentDeleteCooperativeBank(req.params.id, deleterId);
    return this.sendResponse(res, 200, result, 'Co-operative Bank permanently deleted from database.');
  }

  async stats(req, res, next) {
    const result = await cooperativeBankService.getCooperativeBankStats();
    return this.sendResponse(res, 200, result, 'Co-operative Bank stats retrieved successfully.');
  }


  async dropdown(req, res, next) {
    const result = await cooperativeBankService.listCooperativeBanksDropdown();
    return this.sendResponse(res, 200, result, 'Co-operative Banks dropdown list retrieved successfully.');
  }

  async addCredit(req, res, next) {
    const adderId = req.user?.id || req.user?.userId || req.user?._id || null;
    const quantity = req.body.quantity ?? req.body.quentity ?? req.body.creditAmount ?? req.body.amount ?? req.body.credit;
    const type = req.body.type || 'EMI';
    const result = await cooperativeBankService.addCredit(req.params.id, quantity, type, adderId);
    return this.sendResponse(res, 200, result, 'Credit added successfully to Co-operative Bank.');
  }

  async updateStatus(req, res, next) {
    const updaterId = req.user?.id || req.user?.userId || req.user?._id || null;
    const { status, remarks, rejectionRemarks, rejectionReason } = req.body;
    const finalRemarks = remarks || rejectionRemarks || rejectionReason || null;
    const result = await cooperativeBankService.updateBankStatus(req.params.id, status, updaterId, finalRemarks);
    return this.sendResponse(res, 200, result, 'Co-operative Bank status updated successfully.');
  }

  async verifyCashOtp(req, res, next) {
    const payload = { ...req.body, bankId: req.params.id || req.body.bankId || req.body.id };
    const result = await cooperativeBankService.verifyCashOtp(payload);
    return this.sendResponse(res, 200, result, result.message);
  }

  async resendCashOtp(req, res, next) {
    const payload = { ...req.body, bankId: req.params.id || req.body.bankId || req.body.id };
    const result = await cooperativeBankService.resendCashOtp(payload);
    return this.sendResponse(res, 200, result, result.message);
  }

  async verifyOnlinePayment(req, res, next) {
    const payload = { ...req.body, bankId: req.params.id || req.body.bankId || req.body.id };
    const result = await cooperativeBankService.verifyOnlinePayment(payload);
    return this.sendResponse(res, 200, result, result.message);
  }

  async paymentWebhook(req, res, next) {
    const result = await cooperativeBankService.handlePaymentWebhook(req.headers, req.body, req.rawBody);
    return this.sendResponse(res, 200, result, 'Webhook processed successfully.');
  }

  /**
   * POST /api/v1/super-admin/co-operative-bank/calculate-emi-card-price
   */
  async calculateEmiCardPrice(req, res, next) {
    const result = await cooperativeBankService.calculateEmiCardPrice(req.body);
    return this.sendResponse(res, 200, result, 'EMI card total price calculated successfully.');
  }

  /**
   * POST /api/v1/super-admin/co-operative-bank/calculate-verification-credit-price
   */
  async calculateVerificationCreditPrice(req, res, next) {
    const result = await cooperativeBankService.calculateVerificationCreditPrice(req.body);
    return this.sendResponse(res, 200, result, 'Verification credit total price calculated successfully.');
  }

  /**
   * POST /api/v1/super-admin/co-operative-bank/calculate-price
   */
  async calculatePrice(req, res, next) {
    const result = await cooperativeBankService.calculateCombinedPrice(req.body);
    return this.sendResponse(res, 200, result, 'Total pricing calculated successfully.');
  }

  /**
   * PATCH /api/v1/super-admin/co-operative-bank/:id/change-password
   * PATCH /api/v1/super-admin/co-operative-bank/change-password
   */
  async changePassword(req, res, next) {
    const updaterId = req.user?.id || req.user?.userId || req.user?._id || null;
    const bankId = req.params.id || req.body.bankId || req.body.id;
    const result = await cooperativeBankService.changeBankPassword(bankId, req.body, updaterId);
    return this.sendResponse(res, 200, result, 'Co-operative Bank password changed successfully.');
  }
}

export const cooperativeBankController = new CooperativeBankController();
