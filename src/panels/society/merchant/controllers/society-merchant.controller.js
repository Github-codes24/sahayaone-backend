import { BaseController } from "../../../../common/base.controller.js";
import { societyMerchantService } from "../services/society-merchant.service.js";

export class SocietyMerchantController extends BaseController {
  constructor() {
    super();
    this.list = this.catchAsync(this.list.bind(this));
    this.getById = this.catchAsync(this.getById.bind(this));
    this.create = this.catchAsync(this.create.bind(this));
    this.update = this.catchAsync(this.update.bind(this));
    this.delete = this.catchAsync(this.delete.bind(this));
    this.restore = this.catchAsync(this.restore.bind(this));
    this.permanentDelete = this.catchAsync(this.permanentDelete.bind(this));
    this.dropdown = this.catchAsync(this.dropdown.bind(this));
    this.approve = this.catchAsync(this.approve.bind(this));
    this.reject = this.catchAsync(this.reject.bind(this));
    this.linkBankAccount = this.catchAsync(this.linkBankAccount.bind(this));
    this.addSocietyAccount = this.catchAsync(this.addSocietyAccount.bind(this));
  }

  async list(req, res, next) {
    const result = await societyMerchantService.listMerchants(
      req.society,
      req.query,
    );
    return this.sendResponse(
      res,
      200,
      result,
      "Merchants list retrieved successfully.",
    );
  }

  async getById(req, res, next) {
    const result = await societyMerchantService.getMerchantById(
      req.society,
      req.params.id,
    );
    return this.sendResponse(
      res,
      200,
      result,
      "Merchant details retrieved successfully.",
    );
  }

  async create(req, res, next) {
    const creatorId = req.user?.id || null;
    const result = await societyMerchantService.createMerchant(
      req.society,
      req.body,
      req.files || {},
      creatorId,
    );
    return this.sendCreated(res, result, "Merchant created successfully.");
  }

  async update(req, res, next) {
    const updaterId = req.user?.id || null;
    const result = await societyMerchantService.updateMerchant(
      req.society,
      req.params.id,
      req.body,
      req.files || {},
      updaterId,
    );
    return this.sendResponse(
      res,
      200,
      result,
      "Merchant updated successfully.",
    );
  }

  async delete(req, res, next) {
    const deleterId = req.user?.id || null;
    const result = await societyMerchantService.deleteMerchant(
      req.society,
      req.params.id,
      deleterId,
    );
    return this.sendResponse(
      res,
      200,
      result,
      "Merchant soft-deleted successfully.",
    );
  }

  async restore(req, res, next) {
    const restorerId = req.user?.id || null;
    const result = await societyMerchantService.restoreMerchant(
      req.society,
      req.params.id,
      restorerId,
    );
    return this.sendResponse(
      res,
      200,
      result,
      "Merchant profile restored successfully.",
    );
  }

  async permanentDelete(req, res, next) {
    const deleterId = req.user?.id || null;
    const result = await societyMerchantService.permanentDeleteMerchant(
      req.society,
      req.params.id,
      deleterId,
    );
    return this.sendResponse(
      res,
      200,
      result,
      "Merchant permanently deleted successfully.",
    );
  }

  async dropdown(req, res, next) {
    const result = await societyMerchantService.listMerchantsDropdown(
      req.society,
      req.query,
    );
    return this.sendResponse(
      res,
      200,
      result,
      "Merchants dropdown list retrieved successfully.",
    );
  }

  async approve(req, res, next) {
    const merchantId = req.params.id || req.body.merchantId || req.body.id;
    const approverUserId = req.user?.id || req.user?._id;
    const result = await societyMerchantService.approveMerchant(
      req.society,
      merchantId,
      approverUserId,
    );
    return this.sendResponse(res, 200, result, result.message);
  }

  async reject(req, res, next) {
    const merchantId = req.params.id || req.body.merchantId || req.body.id;
    const reason = req.body.reason || req.body.rejectionReason;
    const rejecterUserId = req.user?.id || req.user?._id;
    const result = await societyMerchantService.rejectMerchant(
      req.society,
      merchantId,
      reason,
      rejecterUserId,
    );
    return this.sendResponse(res, 200, result, result.message);
  }

  async linkBankAccount(req, res, next) {
    const targetId =
      req.params.id ||
      req.body.merchantId ||
      req.body.id ||
      req.body.customerId ||
      req.body.userId ||
      req.body.phoneNumber;
    const result = await societyMerchantService.linkBankAccount(
      req.society,
      targetId,
      req.body,
    );
    return this.sendResponse(res, 200, result.merchant, result.message, {
      societyAccount: result.societyAccount,
    });
  }

  async addSocietyAccount(req, res, next) {
    return this.linkBankAccount(req, res, next);
  }
}

export const societyMerchantController = new SocietyMerchantController();
