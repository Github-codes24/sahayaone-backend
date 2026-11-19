import { BaseController } from "../../../../common/base.controller.js";
import { cardsCreditService } from "../services/cards-credit.service.js";
import { cooperativeBankService } from "../../../super-admin/co-operative-bank/services/co-operative-bank.service.js";

export class CardsCreditController extends BaseController {
  constructor() {
    super();
    this.purchase = this.purchase.bind(this);
    this.paymentWebhook = this.paymentWebhook.bind(this);
    this.getPaymentStatus = this.getPaymentStatus.bind(this);
    this.getDashboard = this.getDashboard.bind(this);
    this.getHistory = this.getHistory.bind(this);
    this.transfer = this.transfer.bind(this);
    this.getTransferHistory = this.getTransferHistory.bind(this);
    this.getPurchaseHistory = this.getPurchaseHistory.bind(this);
    this.getBranchWallet = this.getBranchWallet.bind(this);
    this.consume = this.consume.bind(this);
    this.calculateEmiCardPrice = this.calculateEmiCardPrice.bind(this);
    this.calculateVerificationCreditPrice =
      this.calculateVerificationCreditPrice.bind(this);
    this.calculatePrice = this.calculatePrice.bind(this);
    this.getMerchantCreditRequests = this.getMerchantCreditRequests.bind(this);
    this.updateMerchantCreditRequestStatus =
      this.updateMerchantCreditRequestStatus.bind(this);
  }

  /**
   * POST /cards-credit/purchase
   * Society Owner purchases EMI Cards / Verification Credits / Both
   */
  async purchase(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const userId = req.user.id;
      const result = await cardsCreditService.initiatePurchase(
        bankId,
        req.body,
        userId,
      );
      return this.sendSuccess(
        res,
        result,
        "Purchase initiated successfully. Please complete payment.",
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /cards-credit/payment/verify
   * Verify Razorpay payment signature from frontend checkout SDK
   */
  async verifyPayment(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const userId = req.user.id;
      const result = await cardsCreditService.verifyPayment(
        bankId,
        req.body,
        userId,
      );
      return this.sendSuccess(res, result, "Payment verified successfully.");
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /cards-credit/payment-webhook
   * Razorpay payment webhook handler
   */
  async paymentWebhook(req, res, next) {
    try {
      const result = await cardsCreditService.handlePaymentWebhook(
        req.headers,
        req.body,
        req.rawBody,
      );
      return this.sendSuccess(res, result, "Webhook processed successfully.");
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /cards-credit/payment-status/:orderId
   * Check payment status by order ID
   */
  async getPaymentStatus(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const orderId = req.params.orderId;
      const result = await cardsCreditService.getPaymentStatus(bankId, orderId);
      return this.sendSuccess(
        res,
        result,
        "Payment status retrieved successfully.",
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /cards-credit/dashboard
   * Retrieves Bank wallet dashboard stats & recent activities
   */
  async getDashboard(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const result = await cardsCreditService.getDashboardStats(bankId);
      return this.sendSuccess(
        res,
        result,
        "Dashboard statistics retrieved successfully.",
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /cards-credit/history
   * Overall credit movement history
   */
  async getHistory(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const result = await cardsCreditService.getOverallHistory(
        bankId,
        req.query,
      );
      return this.sendPaginated(
        res,
        result.items,
        result.meta,
        "Overall credit history retrieved successfully.",
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /cards-credit/transfer
   * Transfer EMI cards / Verification credits from Bank to Branch
   */
  async transfer(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const userId = req.user.id;
      const result = await cardsCreditService.transferToBranch(
        bankId,
        req.body,
        userId,
      );
      return this.sendSuccess(
        res,
        result,
        "Credit stock transferred to branch successfully.",
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /cards-credit/transfer-history
   * Paginated, searchable, filterable transfer history
   */
  async getTransferHistory(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const result = await cardsCreditService.getTransferHistory(
        bankId,
        req.query,
      );
      return this.sendPaginated(
        res,
        result.items,
        result.meta,
        "Transfer history retrieved successfully.",
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /cards-credit/purchase-history
   * Paginated, searchable, filterable purchase history
   */
  async getPurchaseHistory(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const result = await cardsCreditService.getPurchaseHistory(
        bankId,
        req.query,
      );
      return this.sendPaginated(
        res,
        result.items,
        result.meta,
        "Purchase history retrieved successfully.",
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /cards-credit/branch-wallet/:branchId
   * Retrieve branch wallet balance & recent transactions
   */
  async getBranchWallet(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const branchId = req.params.branchId;
      const result = await cardsCreditService.getBranchWallet(bankId, branchId);
      return this.sendSuccess(
        res,
        result,
        "Branch wallet details retrieved successfully.",
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /cards-credit/consume
   * Consume card stock or verification credit at branch level
   */
  async consume(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const userId = req.user.id;
      const result = await cardsCreditService.consumeCredit(
        bankId,
        req.body,
        userId,
      );
      return this.sendSuccess(res, result, "Credit consumed successfully.");
    } catch (error) {
      next(error);
    }
  }

  /**
   * Price calculation endpoints delegating to cooperativeBankService
   */
  async calculateEmiCardPrice(req, res, next) {
    try {
      const result = await cooperativeBankService.calculateEmiCardPrice(
        req.body,
      );
      return this.sendSuccess(
        res,
        result,
        "EMI card total price calculated successfully.",
      );
    } catch (error) {
      next(error);
    }
  }

  async calculateVerificationCreditPrice(req, res, next) {
    try {
      const result =
        await cooperativeBankService.calculateVerificationCreditPrice(req.body);
      return this.sendSuccess(
        res,
        result,
        "Verification credit total price calculated successfully.",
      );
    } catch (error) {
      next(error);
    }
  }

  async calculatePrice(req, res, next) {
    try {
      const result = await cooperativeBankService.calculateCombinedPrice(
        req.body,
      );
      return this.sendSuccess(
        res,
        result,
        "Total pricing calculated successfully.",
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /cards-credit/merchant-requests
   * Retrieve merchant credit requests for bank/society
   */
  async getMerchantCreditRequests(req, res, next) {
    try {
      const bankId = req.society?.bankId || req.query.bankId || req.user?.bankId;
      const result = await cardsCreditService.getMerchantCreditRequests(
        bankId,
        req.query,
      );
      return this.sendPaginated(
        res,
        result.items,
        result.meta,
        "Merchant credit requests retrieved successfully.",
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /cards-credit/merchant-requests/:id/status
   * Approve or Reject merchant credit request
   */
  async updateMerchantCreditRequestStatus(req, res, next) {
    try {
      const bankId = req.society?.bankId || req.query.bankId || req.user?.bankId;
      const requestId = req.params.id;
      const userId = req.user?.id || req.user?._id || req.society?.id || null;
      const result = await cardsCreditService.updateMerchantCreditRequestStatus(
        bankId,
        requestId,
        req.body,
        userId,
      );
      return this.sendSuccess(
        res,
        result,
        `Merchant credit request ${result.status.toLowerCase()} successfully.`,
      );
    } catch (error) {
      next(error);
    }
  }
}

export const cardsCreditController = new CardsCreditController();
