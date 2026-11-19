import mongoose from "mongoose";
import { Bank } from "../../../../models/bank.model.js";
import { Branch } from "../../../../models/branch.model.js";
import { Setting } from "../../../../models/setting.model.js";
import { PriceSetting } from "../../../../models/price-setting.model.js";
import { CardCreditPurchase } from "../../../../models/card-credit-purchase.model.js";
import { CardCreditTransfer } from "../../../../models/card-credit-transfer.model.js";
import { CardCreditUsage } from "../../../../models/card-credit-usage.model.js";
import { CreditLog } from "../../../../models/credit-log.model.js";
import { MerchantCreditRequest } from "../../../../models/merchant-credit-request.model.js";
import { MerchantProfile } from "../../../../models/merchant-profile.model.js";
import { ApiError } from "../../../../common/api.error.js";
import { RazorpayHelper } from "../../../../utils/razorpay.helper.js";
import { logger } from "../../../../utils/logger.util.js";

const parseSettingValue = (doc) => {
  if (!doc || doc.value === undefined || doc.value === null) return null;
  const num = typeof doc.value === "number" ? doc.value : parseFloat(doc.value);
  return isNaN(num) ? null : num;
};

export class CardsCreditService {
  /**
   * Helper to fetch dynamic prices and limits from Settings / PriceSetting
   */
  async getPricingAndLimits() {
    const [
      emiChargesSetting,
      emiPriceSetting,
      verifSetting,
      minEmiSetting,
      minVerifSetting,
      priceSetting,
    ] = await Promise.all([
      Setting.findOne({ key: "EMI_CARD_CHARGES" }).lean(),
      Setting.findOne({ key: "EMI_CARD_PRICE" }).lean(),
      Setting.findOne({ key: "VERIFICATION_CREDIT_PRICE" }).lean(),
      Setting.findOne({ key: "MIN_EMI_CARD_LIMIT" }).lean(),
      Setting.findOne({ key: "MIN_VERIFICATION_CREDIT_LIMIT" }).lean(),
      PriceSetting.findOne().lean(),
    ]);

    const emiCardPrice =
      parseSettingValue(emiChargesSetting) ??
      parseSettingValue(emiPriceSetting) ??
      priceSetting?.emiCardPriceForBank;

    const verificationCreditPrice =
      parseSettingValue(verifSetting) ??
      priceSetting?.verificationCreditPriceForBank;

    const minEmiQuantity =
      parseSettingValue(minEmiSetting) ??
      priceSetting?.emiCardMinPurchaseQuantity;

    const minVerificationQuantity =
      parseSettingValue(minVerifSetting) ??
      priceSetting?.verificationCreditMinPurchaseQuantity;

    return {
      emiCardPrice: Number(emiCardPrice),
      verificationCreditPrice: Number(verificationCreditPrice),
      minEmiQuantity: Number(minEmiQuantity),
      minVerificationQuantity: Number(minVerificationQuantity),
    };
  }

  /**
   * 1. Purchase Flow: Initiate Purchase for EMI Cards / Verification Credits / Both via Razorpay
   */
  async initiatePurchase(bankId, payload, userId) {
    const bank = await Bank.findOne({ _id: bankId, isDeleted: { $ne: true } });
    if (!bank) {
      throw ApiError.notFound("Bank record not found or inactive.");
    }

    const { purchaseType, emiQuantity = 0, verificationQuantity = 0 } = payload;
    const qtyEmi = Number(emiQuantity);
    const qtyCredit = Number(verificationQuantity);

    const {
      emiCardPrice,
      verificationCreditPrice,
      minEmiQuantity,
      minVerificationQuantity,
    } = await this.getPricingAndLimits();

    // Minimum Quantity Validation
    if (
      (purchaseType === "EMI_CARD" || purchaseType === "BOTH") &&
      qtyEmi < minEmiQuantity
    ) {
      throw ApiError.badRequest(
        `Minimum purchase quantity for EMI Cards is ${minEmiQuantity}. Received: ${qtyEmi}`,
      );
    }

    if (
      (purchaseType === "VERIFICATION_CREDIT" || purchaseType === "BOTH") &&
      qtyCredit < minVerificationQuantity
    ) {
      throw ApiError.badRequest(
        `Minimum purchase quantity for Verification Credits is ${minVerificationQuantity}. Received: ${qtyCredit}`,
      );
    }

    // Amount Calculations
    const actualEmiQty = purchaseType === "VERIFICATION_CREDIT" ? 0 : qtyEmi;
    const actualCreditQty = purchaseType === "EMI_CARD" ? 0 : qtyCredit;

    const emiAmount = actualEmiQty * emiCardPrice;
    const verificationAmount = actualCreditQty * verificationCreditPrice;
    const subtotal = emiAmount + verificationAmount;

    // No GST applied (0%)
    const cgst = 0;
    const sgst = 0;
    const total = subtotal;

    const internalOrderId = `ORD_CC_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    const [paymentResult, paymentLinkResult] = await Promise.all([
      razorpayHelper.createPaymentOrder({
        txnid: internalOrderId,
        amount: total,
        notes: {
          bankId: bank._id.toString(),
          purchaseType,
          emiQuantity: actualEmiQty,
          verificationQuantity: actualCreditQty,
        },
        receipt: internalOrderId,
      }),
      razorpayHelper.createPaymentLink({
        txnid: internalOrderId,
        amount: total,
        description: `Credit Purchase (${purchaseType}) for Bank ${bank.name}`,
        customer: {
          name: bank.name || "Bank Admin",
          email: bank.email || "",
          contact: bank.phoneNumber || "",
        },
        notes: {
          bankId: bank._id.toString(),
          purchaseType,
          emiQuantity: actualEmiQty,
          verificationQuantity: actualCreditQty,
        },
      }),
    ]);

    const purchase = await CardCreditPurchase.create({
      bankId: bank._id,
      purchaseType,
      emiQuantity: actualEmiQty,
      verificationQuantity: actualCreditQty,
      emiRate: emiCardPrice,
      verificationRate: verificationCreditPrice,
      emiAmount,
      verificationAmount,
      subtotal,
      cgst,
      sgst,
      total,
      paymentMethod: "RAZORPAY",
      paymentStatus: "PENDING",
      paymentGateway: "RAZORPAY",
      paymentOrderId: paymentResult.orderId || internalOrderId,
      paymentLinkId: paymentLinkResult?.paymentLinkId || null,
      paymentLink: paymentLinkResult?.paymentLink || null,
      createdBy: userId,
    });

    logger.info(
      `CARDS-CREDIT PURCHASE INITIATED: Bank [${bank.name}] Order [${internalOrderId}] RazorpayOrderId [${paymentResult.orderId}] PaymentLink [${paymentLinkResult?.paymentLink}] Total [₹${total}]`,
    );

    return {
      purchaseId: purchase._id,
      orderId: purchase.paymentOrderId,
      paymentLinkId: purchase.paymentLinkId,
      paymentLink: purchase.paymentLink,
      internalOrderId,
      paymentMethod: "RAZORPAY",
      paymentGateway: "RAZORPAY",
      paymentStatus: "PENDING",
      keyId: paymentResult.keyId,
      amount: total,
      amountInPaise: paymentResult.amountInPaise,
      currency: paymentResult.currency || "INR",
      priceBreakdown: {
        purchaseType,
        emiQuantity: actualEmiQty,
        emiRate: emiCardPrice,
        emiAmount,
        verificationQuantity: actualCreditQty,
        verificationRate: verificationCreditPrice,
        verificationAmount,
        subtotal,
        cgst,
        sgst,
        totalPayableAmount: total,
      },
    };
  }

  /**
   * 2. Razorpay Webhook Handler (Signature Verification, Idempotency & MongoDB Session Transaction)
   */
  async handlePaymentWebhook(headers, body, rawBody) {
    const isValidSignature = razorpayHelper.verifyWebhookSignature(
      headers,
      rawBody || body,
    );
    if (!isValidSignature) {
      throw ApiError.badRequest("Invalid Razorpay webhook signature hash.");
    }

    let orderId = "";
    let txnId = "";
    let isSuccess = false;

    const payload = typeof body === "object" && body !== null ? body : {};

    if (payload.event) {
      // Standard Razorpay Webhook Event Payload
      const payment = payload.payload?.payment?.entity;
      const order = payload.payload?.order?.entity;
      const paymentLink = payload.payload?.payment_link?.entity;

      orderId =
        order?.id ||
        payment?.order_id ||
        paymentLink?.id ||
        paymentLink?.reference_id ||
        order?.receipt ||
        "";
      txnId = payment?.id || `txn_${Date.now()}`;
      isSuccess =
        payload.event === "order.paid" ||
        payload.event === "payment.captured" ||
        payload.event === "payment_link.paid" ||
        payment?.status === "captured";
    } else {
      // Direct webhook payload
      orderId =
        body.razorpay_order_id ||
        body.orderId ||
        body.paymentLinkId ||
        body.txnid ||
        body.paymentOrderId ||
        "";
      txnId =
        body.razorpay_payment_id ||
        body.transactionId ||
        body.txnId ||
        `txn_${Date.now()}`;
      const status = (body.status || body.event || "").toLowerCase();
      isSuccess =
        status === "success" ||
        status === "paid" ||
        status === "captured" ||
        (body.razorpay_signature &&
          razorpayHelper.verifyPaymentSignature(body));
    }

    if (!orderId) {
      throw ApiError.badRequest(
        "Webhook payload missing transaction ID / payment order ID.",
      );
    }

    const purchase = await CardCreditPurchase.findOne({
      $or: [
        { paymentOrderId: orderId },
        { paymentLinkId: orderId },
        { paymentTransactionId: orderId },
      ],
    });

    if (!purchase) {
      throw ApiError.notFound(
        `Card/Credit purchase record for order [${orderId}] not found.`,
      );
    }

    // Idempotency check: if purchase is already marked SUCCESS, prevent duplicate execution
    if (purchase.paymentStatus === "SUCCESS") {
      logger.info(
        `CARDS-CREDIT WEBHOOK: Duplicate webhook received for already completed purchase [${orderId}]. Skipping.`,
      );
      return {
        success: true,
        orderId,
        paymentStatus: "SUCCESS",
        message: "Webhook payload already processed.",
      };
    }

    if (!isSuccess) {
      purchase.paymentStatus = "FAILED";
      purchase.paymentTransactionId = txnId;
      await purchase.save();

      logger.warn(
        `CARDS-CREDIT WEBHOOK: Payment failed for order [${orderId}]`,
      );
      return {
        success: false,
        orderId,
        paymentStatus: "FAILED",
        message: "Payment failed reported by gateway.",
      };
    }

    return await this.finalizeSuccessfulPurchase(purchase, txnId);
  }

  /**
   * 2b. Direct Payment Verification API (called by frontend Checkout SDK callback)
   */
  async verifyPayment(bankId, payload, userId) {
    const orderId =
      payload.razorpay_order_id ||
      payload.orderId ||
      payload.paymentOrderId ||
      payload.paymentLinkId ||
      "";
    const paymentId =
      payload.razorpay_payment_id ||
      payload.transactionId ||
      payload.txnId ||
      `pay_${Date.now()}`;
    const signature = payload.razorpay_signature || "";

    if (!orderId) {
      throw ApiError.badRequest("Missing order ID in verification request.");
    }

    const purchase = await CardCreditPurchase.findOne({
      bankId,
      $or: [
        { paymentOrderId: orderId },
        { paymentLinkId: orderId },
        { paymentTransactionId: orderId },
      ],
    });

    if (!purchase) {
      throw ApiError.notFound(
        `Card/Credit purchase record for order [${orderId}] not found.`,
      );
    }

    if (purchase.paymentStatus === "SUCCESS") {
      return {
        success: true,
        orderId: purchase.paymentOrderId,
        paymentStatus: "SUCCESS",
        invoiceNumber: purchase.invoiceNumber,
        message: "Payment has already been verified and bank wallet updated.",
      };
    }

    // Signature verification (in production mode)
    if (signature) {
      const isValid = razorpayHelper.verifyPaymentSignature({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      });
      if (!isValid) {
        purchase.paymentStatus = "FAILED";
        await purchase.save();
        throw ApiError.badRequest(
          "Razorpay payment signature verification failed.",
        );
      }
    }

    return await this.finalizeSuccessfulPurchase(purchase, paymentId);
  }

  /**
   * Helper to execute atomic wallet updates and record credit audit logs upon successful payment
   */
  async finalizeSuccessfulPurchase(purchase, txnId) {
    if (purchase.paymentStatus === "SUCCESS") {
      return {
        success: true,
        orderId: purchase.paymentOrderId,
        paymentStatus: "SUCCESS",
        invoiceNumber: purchase.invoiceNumber,
        message: "Purchase already finalized.",
      };
    }

    let session = null;
    let sessionOpts = {};
    let transactionCommitted = false;

    try {
      const topoType = mongoose.connection.client?.topology?.description?.type;
      const supportsTransactions =
        topoType && topoType !== "Single" && topoType !== "Unknown";

      if (supportsTransactions) {
        session = await mongoose.startSession().catch(() => null);
        if (session) {
          session.startTransaction();
          sessionOpts = { session };
        }
      }

      const bank = await Bank.findById(purchase.bankId, null, sessionOpts);
      if (!bank) {
        throw ApiError.notFound("Bank record not found for credit allocation.");
      }

      // Update Bank wallet balance
      bank.totalEmiCards = (bank.totalEmiCards || 0) + purchase.emiQuantity;
      bank.availableEmiCards =
        (bank.availableEmiCards || 0) + purchase.emiQuantity;
      bank.totalVerificationCredits =
        (bank.totalVerificationCredits || 0) + purchase.verificationQuantity;
      bank.availableVerificationCredits =
        (bank.availableVerificationCredits || 0) +
        purchase.verificationQuantity;
      bank.totalAmountPaid = (bank.totalAmountPaid || 0) + purchase.total;

      bank.paymentStatus = "SUCCESS";
      bank.paymentGatewayOrderId = purchase.paymentOrderId;
      bank.paymentGatewayTransactionId = txnId;

      // Purchase rate snapshot
      bank.cardRate = purchase.emiRate;
      bank.verificationCreditRate = purchase.verificationRate;
      bank.cardAmount = purchase.emiAmount;
      bank.verificationCreditAmount = purchase.verificationAmount;
      bank.subTotalAmount = purchase.subtotal;
      bank.cgst = purchase.cgst;
      // Sanitize location if invalid GeoJSON
      if (
        bank.location &&
        (!bank.location.coordinates ||
          !Array.isArray(bank.location.coordinates) ||
          bank.location.coordinates.length !== 2)
      ) {
        bank.location = undefined;
      }

      await bank.save(sessionOpts);

      // Update purchase record
      purchase.paymentStatus = "SUCCESS";
      purchase.paymentTransactionId = txnId;
      purchase.invoiceNumber = `INV_${Date.now()}`;
      await purchase.save(sessionOpts);

      // Audit credit logs
      if (purchase.emiQuantity > 0) {
        await CreditLog.create(
          [
            {
              bankId: bank._id,
              type: "EMI_CARD",
              action: "PURCHASE",
              amount: purchase.emiQuantity,
              createdBy: purchase.createdBy,
              description: `Purchased ${purchase.emiQuantity} EMI Cards via Razorpay (Order: ${purchase.paymentOrderId})`,
            },
          ],
          sessionOpts,
        );
      }

      if (purchase.verificationQuantity > 0) {
        await CreditLog.create(
          [
            {
              bankId: bank._id,
              type: "VERIFICATION_CREDIT",
              action: "PURCHASE",
              amount: purchase.verificationQuantity,
              createdBy: purchase.createdBy,
              description: `Purchased ${purchase.verificationQuantity} Verification Credits via Razorpay (Order: ${purchase.paymentOrderId})`,
            },
          ],
          sessionOpts,
        );
      }

      if (session) {
        await session.commitTransaction();
        transactionCommitted = true;
      }

      logger.info(
        `CARDS-CREDIT PURCHASE COMPLETED: Successfully credited Bank [${bank.name}] with ${purchase.emiQuantity} cards & ${purchase.verificationQuantity} credits.`,
      );

      return {
        success: true,
        orderId: purchase.paymentOrderId,
        paymentStatus: "SUCCESS",
        invoiceNumber: purchase.invoiceNumber,
        credited: {
          emiQuantity: purchase.emiQuantity,
          verificationQuantity: purchase.verificationQuantity,
        },
        message: "Payment verified and bank wallet updated successfully.",
      };
    } catch (error) {
      if (session && !transactionCommitted) {
        await session.abortTransaction().catch(() => {});
      }
      throw error;
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }

  /**
   * 3. Get Payment Status by Order ID
   */
  async getPaymentStatus(bankId, orderId) {
    const purchase = await CardCreditPurchase.findOne({
      bankId,
      paymentOrderId: orderId,
      isDeleted: { $ne: true },
    });

    if (!purchase) {
      throw ApiError.notFound("Purchase order record not found.");
    }

    return {
      orderId: purchase.paymentOrderId,
      paymentStatus: purchase.paymentStatus,
      paymentTransactionId: purchase.paymentTransactionId,
      invoiceNumber: purchase.invoiceNumber,
      purchaseType: purchase.purchaseType,
      emiQuantity: purchase.emiQuantity,
      verificationQuantity: purchase.verificationQuantity,
      totalAmount: purchase.total,
      createdAt: purchase.createdAt,
    };
  }

  /**
   * 4. Bank Dashboard API
   */
  async getDashboardStats(bankId) {
    const bank = await Bank.findOne({
      _id: bankId,
      isDeleted: { $ne: true },
    }).lean();
    if (!bank) {
      throw ApiError.notFound("Bank record not found.");
    }

    const purchasedEmiCards = bank.totalEmiCards || 0;
    const availableEmiCards = bank.availableEmiCards || 0;
    const usedEmiCards = Math.max(0, purchasedEmiCards - availableEmiCards);

    const purchasedVerificationCredits = bank.totalVerificationCredits || 0;
    const availableVerificationCredits = bank.availableVerificationCredits || 0;
    const usedVerificationCredits = Math.max(
      0,
      purchasedVerificationCredits - availableVerificationCredits,
    );

    // Latest 5 purchases
    const recentPurchases = await CardCreditPurchase.find({
      bankId,
      isDeleted: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // Latest 5 transfers
    const recentTransfers = await CardCreditTransfer.find({
      bankId,
      isDeleted: { $ne: true },
    })
      .populate("branchId", "name code")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    return {
      wallet: {
        emiCards: {
          purchased: purchasedEmiCards,
          available: availableEmiCards,
          used: usedEmiCards,
        },
        verificationCredits: {
          purchased: purchasedVerificationCredits,
          available: availableVerificationCredits,
          used: usedVerificationCredits,
        },
      },
      recentPurchases: recentPurchases.map((p) => ({
        id: p._id,
        orderId: p.paymentOrderId,
        purchaseType: p.purchaseType,
        emiQuantity: p.emiQuantity,
        verificationQuantity: p.verificationQuantity,
        total: p.total,
        paymentStatus: p.paymentStatus,
        createdAt: p.createdAt,
      })),
      recentTransfers: recentTransfers.map((t) => ({
        id: t._id,
        branch: t.branchId
          ? { id: t.branchId._id, name: t.branchId.name, code: t.branchId.code }
          : null,
        emiQuantity: t.emiQuantity,
        verificationQuantity: t.verificationQuantity,
        remarks: t.remarks,
        createdAt: t.createdAt,
      })),
    };
  }

  /**
   * 5. Overall Movement History
   */
  async getOverallHistory(bankId, queryOptions = {}) {
    const page = parseInt(queryOptions.page || "1", 10);
    const limit = parseInt(queryOptions.limit || "10", 10);
    const skip = (page - 1) * limit;

    const [logs, totalRecords] = await Promise.all([
      CreditLog.find({ bankId, isDeleted: { $ne: true } })
        .populate("branchId", "name code")
        .populate("employeeId", "fullName email phoneNumber")
        .populate("customerId", "phoneNumber")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CreditLog.countDocuments({ bankId, isDeleted: { $ne: true } }),
    ]);

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    return {
      items: logs.map((log) => ({
        id: log._id,
        type: log.type,
        action: log.action,
        amount: log.amount,
        branch: log.branchId
          ? {
              id: log.branchId._id,
              name: log.branchId.name,
              code: log.branchId.code,
            }
          : null,
        employee: log.employeeId
          ? {
              id: log.employeeId._id,
              fullName: log.employeeId.fullName,
              email: log.employeeId.email,
            }
          : null,
        description: log.description,
        createdAt: log.createdAt,
      })),
      meta: {
        totalRecords,
        limit,
        page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * 6. Transfer to Branch (Mongoose Transaction Session)
   */
  async transferToBranch(bankId, payload, userId) {
    const {
      branchId,
      emiQuantity = 0,
      verificationQuantity = 0,
      remarks = "",
    } = payload;
    const qtyEmi = Number(emiQuantity);
    const qtyCredit = Number(verificationQuantity);

    if (qtyEmi <= 0 && qtyCredit <= 0) {
      throw ApiError.badRequest(
        "Transfer quantity for EMI cards or Verification credits must be greater than 0.",
      );
    }

    const bank = await Bank.findOne({ _id: bankId, isDeleted: { $ne: true } });
    if (!bank) {
      throw ApiError.notFound("Bank record not found.");
    }

    const branch = await Branch.findOne({
      _id: branchId,
      bankId,
      isDeleted: { $ne: true },
    });
    if (!branch) {
      throw ApiError.notFound(
        "Target branch record not found or does not belong to your bank.",
      );
    }

    if (branch.status !== "ACTIVE") {
      throw ApiError.badRequest(
        "Target branch is currently inactive. Transfer disallowed.",
      );
    }

    // Available Balance Verification
    if (qtyEmi > 0 && (bank.availableEmiCards || 0) < qtyEmi) {
      throw ApiError.badRequest(
        `Insufficient available EMI Cards at Bank level. Requested: ${qtyEmi}, Available: ${bank.availableEmiCards || 0}`,
      );
    }

    if (qtyCredit > 0 && (bank.availableVerificationCredits || 0) < qtyCredit) {
      throw ApiError.badRequest(
        `Insufficient available Verification Credits at Bank level. Requested: ${qtyCredit}, Available: ${bank.availableVerificationCredits || 0}`,
      );
    }

    let session = null;
    let sessionOpts = {};
    let transactionCommitted = false;

    try {
      const topoType = mongoose.connection.client?.topology?.description?.type;
      const supportsTransactions =
        topoType && topoType !== "Single" && topoType !== "Unknown";

      if (supportsTransactions) {
        session = await mongoose.startSession().catch(() => null);
        if (session) {
          session.startTransaction();
          sessionOpts = { session };
        }
      }

      // Capture balance snapshot before transfer
      const branchBefore = {
        availableEmiCards: branch.availableEmiCards || branch.cardStock || 0,
        availableVerificationCredits:
          branch.availableVerificationCredits ||
          branch.verificationCredits ||
          0,
      };

      // 1. Decrease Bank available balance
      bank.availableEmiCards = Math.max(
        0,
        (bank.availableEmiCards || 0) - qtyEmi,
      );
      bank.availableVerificationCredits = Math.max(
        0,
        (bank.availableVerificationCredits || 0) - qtyCredit,
      );
      await bank.save(sessionOpts);

      // 2. Increase Branch available & total balance
      branch.availableEmiCards = (branch.availableEmiCards || 0) + qtyEmi;
      branch.totalEmiCards = (branch.totalEmiCards || 0) + qtyEmi;
      branch.cardStock = (branch.cardStock || 0) + qtyEmi;

      branch.availableVerificationCredits =
        (branch.availableVerificationCredits || 0) + qtyCredit;
      branch.totalVerificationCredits =
        (branch.totalVerificationCredits || 0) + qtyCredit;
      branch.verificationCredits =
        (branch.verificationCredits || 0) + qtyCredit;

      await branch.save(sessionOpts);

      const branchAfter = {
        availableEmiCards: branch.availableEmiCards,
        availableVerificationCredits: branch.availableVerificationCredits,
      };

      // 3. Store Transfer History
      const [transfer] = await CardCreditTransfer.create(
        [
          {
            bankId: bank._id,
            branchId: branch._id,
            emiQuantity: qtyEmi,
            verificationQuantity: qtyCredit,
            balanceBefore: branchBefore,
            balanceAfter: branchAfter,
            remarks: remarks.trim(),
            createdBy: userId,
          },
        ],
        sessionOpts,
      );

      // 4. Create Credit Logs for Audit
      if (qtyEmi > 0) {
        await CreditLog.create(
          [
            {
              bankId: bank._id,
              branchId: branch._id,
              type: "EMI_CARD",
              action: "ALLOCATION",
              amount: qtyEmi,
              createdBy: userId,
              description: `Transferred ${qtyEmi} EMI Cards to branch [${branch.name}]`,
            },
          ],
          sessionOpts,
        );
      }

      if (qtyCredit > 0) {
        await CreditLog.create(
          [
            {
              bankId: bank._id,
              branchId: branch._id,
              type: "VERIFICATION_CREDIT",
              action: "ALLOCATION",
              amount: qtyCredit,
              createdBy: userId,
              description: `Transferred ${qtyCredit} Verification Credits to branch [${branch.name}]`,
            },
          ],
          sessionOpts,
        );
      }

      if (session) {
        await session.commitTransaction();
        transactionCommitted = true;
      }

      logger.info(
        `CARDS-CREDIT TRANSFER: Bank [${bank.name}] transferred ${qtyEmi} cards & ${qtyCredit} credits to Branch [${branch.name}]`,
      );

      return {
        transferId: transfer._id,
        branch: {
          id: branch._id,
          name: branch.name,
          code: branch.code,
        },
        transferred: {
          emiQuantity: qtyEmi,
          verificationQuantity: qtyCredit,
        },
        bankRemaining: {
          availableEmiCards: bank.availableEmiCards,
          availableVerificationCredits: bank.availableVerificationCredits,
        },
        branchNewBalance: branchAfter,
        remarks: transfer.remarks,
        createdAt: transfer.createdAt,
      };
    } catch (error) {
      if (session && !transactionCommitted) {
        await session.abortTransaction().catch(() => {});
      }
      throw error;
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }

  /**
   * 7. Get Transfer History (Paginated, Search, Filter, Sort)
   */
  async getTransferHistory(bankId, queryOptions = {}) {
    const page = parseInt(queryOptions.page || "1", 10);
    const limit = parseInt(queryOptions.limit || "10", 10);
    const search = (queryOptions.search || "").trim();
    const branchIdFilter = (queryOptions.branchId || "").trim();
    const skip = (page - 1) * limit;

    const filter = {
      bankId,
      isDeleted: { $ne: true },
    };

    if (branchIdFilter) {
      filter.branchId = branchIdFilter;
    }

    if (queryOptions.startDate || queryOptions.endDate) {
      filter.createdAt = {};
      if (queryOptions.startDate)
        filter.createdAt.$gte = new Date(queryOptions.startDate);
      if (queryOptions.endDate)
        filter.createdAt.$lte = new Date(queryOptions.endDate);
    }

    const sortField = queryOptions.sortBy || "createdAt";
    const sortOrder =
      (queryOptions.sortOrder || "desc").toLowerCase() === "asc" ? 1 : -1;

    let transfers = await CardCreditTransfer.find(filter)
      .populate("branchId", "name code state")
      .populate("createdBy", "fullName email")
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean();

    if (search) {
      const searchRegex = new RegExp(search, "i");
      transfers = transfers.filter((t) => {
        const branchName = t.branchId?.name || "";
        const branchCode = t.branchId?.code || "";
        const remarks = t.remarks || "";
        return (
          branchName.match(searchRegex) ||
          branchCode.match(searchRegex) ||
          remarks.match(searchRegex)
        );
      });
    }

    const totalRecords = await CardCreditTransfer.countDocuments(filter);
    const totalPages = Math.ceil(totalRecords / limit) || 1;

    const items = transfers.map((t, idx) => ({
      srNo: skip + idx + 1,
      id: t._id,
      branch: t.branchId
        ? { id: t.branchId._id, name: t.branchId.name, code: t.branchId.code }
        : null,
      emiQuantity: t.emiQuantity,
      verificationQuantity: t.verificationQuantity,
      balanceBefore: t.balanceBefore,
      balanceAfter: t.balanceAfter,
      remarks: t.remarks,
      createdBy: t.createdBy
        ? {
            id: t.createdBy._id,
            fullName: t.createdBy.fullName,
            email: t.createdBy.email,
          }
        : null,
      createdAt: t.createdAt,
    }));

    return {
      items,
      meta: {
        totalRecords,
        limit,
        page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * 8. Get Purchase History (Paginated, Search, Filter, Sort)
   */
  async getPurchaseHistory(bankId, queryOptions = {}) {
    const page = parseInt(queryOptions.page || "1", 10);
    const limit = parseInt(queryOptions.limit || "10", 10);
    const search = (queryOptions.search || "").trim();
    const statusFilter = (queryOptions.status || "").toUpperCase();
    const typeFilter = (queryOptions.type || "").toUpperCase();
    const skip = (page - 1) * limit;

    const filter = {
      bankId,
      isDeleted: { $ne: true },
    };

    if (statusFilter && statusFilter !== "ALL") {
      filter.paymentStatus = statusFilter;
    }

    if (typeFilter && typeFilter !== "ALL") {
      filter.purchaseType = typeFilter;
    }

    if (queryOptions.startDate || queryOptions.endDate) {
      filter.createdAt = {};
      if (queryOptions.startDate)
        filter.createdAt.$gte = new Date(queryOptions.startDate);
      if (queryOptions.endDate)
        filter.createdAt.$lte = new Date(queryOptions.endDate);
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [
        { paymentOrderId: searchRegex },
        { paymentTransactionId: searchRegex },
        { invoiceNumber: searchRegex },
      ];
    }

    const sortField = queryOptions.sortBy || "createdAt";
    const sortOrder =
      (queryOptions.sortOrder || "desc").toLowerCase() === "asc" ? 1 : -1;

    const [purchases, totalRecords] = await Promise.all([
      CardCreditPurchase.find(filter)
        .populate("createdBy", "fullName email")
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      CardCreditPurchase.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    const items = purchases.map((p, idx) => ({
      srNo: skip + idx + 1,
      id: p._id,
      orderId: p.paymentOrderId,
      transactionId: p.paymentTransactionId,
      invoiceNumber: p.invoiceNumber,
      purchaseType: p.purchaseType,
      emiQuantity: p.emiQuantity,
      verificationQuantity: p.verificationQuantity,
      emiRate: p.emiRate,
      verificationRate: p.verificationRate,
      subtotal: p.subtotal,
      cgst: p.cgst,
      sgst: p.sgst,
      total: p.total,
      paymentMethod: p.paymentMethod,
      paymentStatus: p.paymentStatus,
      createdBy: p.createdBy
        ? {
            id: p.createdBy._id,
            fullName: p.createdBy.fullName,
            email: p.createdBy.email,
          }
        : null,
      createdAt: p.createdAt,
    }));

    return {
      items,
      meta: {
        totalRecords,
        limit,
        page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * 9. Get Branch Wallet & Transaction History
   */
  async getBranchWallet(bankId, branchId) {
    const branch = await Branch.findOne({
      _id: branchId,
      bankId,
      isDeleted: { $ne: true },
    }).lean();
    if (!branch) {
      throw ApiError.notFound(
        "Branch not found or does not belong to your bank.",
      );
    }

    const [logs, usages, transfers] = await Promise.all([
      CreditLog.find({ branchId, isDeleted: { $ne: true } })
        .populate("employeeId", "fullName email phoneNumber")
        .populate("customerId", "phoneNumber")
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      CardCreditUsage.find({ branchId, isDeleted: { $ne: true } })
        .populate("createdBy", "fullName email")
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      CardCreditTransfer.find({ branchId, isDeleted: { $ne: true } })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ]);

    return {
      branch: {
        id: branch._id,
        name: branch.name,
        code: branch.code,
        status: branch.status,
      },
      wallet: {
        availableEmiCards: branch.availableEmiCards ?? branch.cardStock ?? 0,
        totalEmiCards: branch.totalEmiCards ?? branch.cardStock ?? 0,
        availableVerificationCredits:
          branch.availableVerificationCredits ??
          branch.verificationCredits ??
          0,
        totalVerificationCredits:
          branch.totalVerificationCredits ?? branch.verificationCredits ?? 0,
      },
      recentCreditLogs: logs.map((l) => ({
        id: l._id,
        type: l.type,
        action: l.action,
        amount: l.amount,
        employee: l.employeeId
          ? { id: l.employeeId._id, fullName: l.employeeId.fullName }
          : null,
        description: l.description,
        createdAt: l.createdAt,
      })),
      recentUsages: usages.map((u) => ({
        id: u._id,
        type: u.type,
        quantity: u.quantity,
        balanceBefore: u.balanceBefore,
        balanceAfter: u.balanceAfter,
        loanId: u.loanId,
        verificationId: u.verificationId,
        createdBy: u.createdBy
          ? { id: u.createdBy._id, fullName: u.createdBy.fullName }
          : null,
        createdAt: u.createdAt,
      })),
      recentTransfers: transfers.map((t) => ({
        id: t._id,
        emiQuantity: t.emiQuantity,
        verificationQuantity: t.verificationQuantity,
        balanceBefore: t.balanceBefore,
        balanceAfter: t.balanceAfter,
        remarks: t.remarks,
        createdAt: t.createdAt,
      })),
    };
  }

  /**
   * 10. Consume Credit (Loan Issuance or Verification Performance)
   */
  async consumeCredit(bankId, payload, userId) {
    const {
      branchId,
      type,
      quantity = 1,
      loanId = null,
      verificationId = null,
    } = payload;
    const qty = Number(quantity);

    if (qty <= 0) {
      throw ApiError.badRequest("Consumption quantity must be greater than 0.");
    }

    const branch = await Branch.findOne({
      _id: branchId,
      bankId,
      isDeleted: { $ne: true },
    });
    if (!branch) {
      throw ApiError.notFound(
        "Branch record not found or does not belong to your bank.",
      );
    }

    const balanceField =
      type === "EMI_CARD"
        ? "availableEmiCards"
        : "availableVerificationCredits";
    const fallbackField =
      type === "EMI_CARD" ? "cardStock" : "verificationCredits";
    const currentBalance = branch[balanceField] ?? branch[fallbackField] ?? 0;

    if (currentBalance < qty) {
      throw ApiError.badRequest(
        `Insufficient ${type} balance at branch [${branch.name}]. Available: ${currentBalance}, Requested: ${qty}`,
      );
    }

    let session = null;
    let sessionOpts = {};
    let transactionCommitted = false;

    try {
      const topoType = mongoose.connection.client?.topology?.description?.type;
      const supportsTransactions =
        topoType && topoType !== "Single" && topoType !== "Unknown";

      if (supportsTransactions) {
        session = await mongoose.startSession().catch(() => null);
        if (session) {
          session.startTransaction();
          sessionOpts = { session };
        }
      }

      const balanceBefore = currentBalance;
      const balanceAfter = balanceBefore - qty;

      if (type === "EMI_CARD") {
        branch.availableEmiCards = balanceAfter;
        branch.cardStock = Math.max(0, (branch.cardStock || 0) - qty);
      } else {
        branch.availableVerificationCredits = balanceAfter;
        branch.verificationCredits = Math.max(
          0,
          (branch.verificationCredits || 0) - qty,
        );
      }

      await branch.save(sessionOpts);

      const [usage] = await CardCreditUsage.create(
        [
          {
            bankId: branch.bankId,
            branchId: branch._id,
            loanId,
            verificationId,
            type,
            quantity: qty,
            balanceBefore,
            balanceAfter,
            createdBy: userId,
          },
        ],
        sessionOpts,
      );

      await CreditLog.create(
        [
          {
            bankId: branch.bankId,
            branchId: branch._id,
            type,
            action: "DEDUCTION",
            amount: qty,
            employeeId: userId,
            description: `${type} consumed at branch [${branch.name}]. Quantity: ${qty}`,
          },
        ],
        sessionOpts,
      );

      if (session) {
        await session.commitTransaction();
        transactionCommitted = true;
      }

      logger.info(
        `CARDS-CREDIT CONSUMED: ${type} x ${qty} consumed at Branch [${branch.name}]`,
      );

      return {
        usageId: usage._id,
        type,
        quantity: qty,
        balanceBefore,
        balanceAfter,
        branch: {
          id: branch._id,
          name: branch.name,
          code: branch.code,
        },
        createdAt: usage.createdAt,
      };
    } catch (error) {
      if (session && !transactionCommitted) {
        await session.abortTransaction().catch(() => {});
      }
      throw error;
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }

  /**
   * 11. Get Merchant Credit Requests for Society/Bank (Bank Owner Access across all branches)
   */
  async getMerchantCreditRequests(bankId, queryOptions = {}) {
    const page = parseInt(queryOptions.page || "1", 10);
    const limit = parseInt(queryOptions.limit || "10", 10);
    const status = (queryOptions.status || "").toUpperCase();
    const search = (queryOptions.search || "").trim();
    const targetBankId = bankId || queryOptions.bankId || null;
    const targetBranchId = (queryOptions.branchId || "").trim();
    const skip = (page - 1) * limit;

    const filter = {
      isDeleted: { $ne: true },
    };

    // Bank Owner Access: Filter by bankId if present (matches both String & ObjectId)
    if (targetBankId && targetBankId !== "ALL" && targetBankId !== "all") {
      const bankIdStr = String(targetBankId);
      if (mongoose.Types.ObjectId.isValid(bankIdStr)) {
        filter.bankId = {
          $in: [bankIdStr, new mongoose.Types.ObjectId(bankIdStr)],
        };
      } else {
        filter.bankId = targetBankId;
      }
    }

    // Branch Filter (Bank Owner can access all branches or filter by specific branchId)
    if (targetBranchId && targetBranchId !== "ALL" && targetBranchId !== "all") {
      const branchIdStr = String(targetBranchId);
      if (mongoose.Types.ObjectId.isValid(branchIdStr)) {
        filter.branchId = {
          $in: [branchIdStr, new mongoose.Types.ObjectId(branchIdStr)],
        };
      } else {
        filter.branchId = targetBranchId;
      }
    }

    // Status Filter (PENDING, APPROVED, REJECTED, ALL)
    if (status && status !== "ALL") {
      filter.status = status;
    }

    // Date Range Filter (startDate & endDate)
    if (queryOptions.startDate || queryOptions.endDate) {
      filter.createdAt = {};
      if (queryOptions.startDate) {
        filter.createdAt.$gte = new Date(queryOptions.startDate);
      }
      if (queryOptions.endDate) {
        const end = new Date(queryOptions.endDate);
        if (String(queryOptions.endDate).length <= 10) {
          end.setHours(23, 59, 59, 999);
        }
        filter.createdAt.$lte = end;
      }
    }

    const sortField = queryOptions.sortBy || "createdAt";
    const sortOrder = (queryOptions.sortOrder || "desc").toLowerCase() === "asc" ? 1 : -1;

    let [requests, totalRecords] = await Promise.all([
      MerchantCreditRequest.find(filter)
        .populate("merchantId", "shopName merchantName email mobileNumber status branchId bankId")
        .populate("branchId", "name code state city")
        .populate("requestedBy", "fullName email phoneNumber")
        .populate("approvedBy", "fullName email")
        .populate("rejectedBy", "fullName email")
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      MerchantCreditRequest.countDocuments(filter),
    ]);

    // Fallback: If 0 records returned with strict bankId filter, try fetching all active requests
    // to handle any tenant context resolution mismatches
    if (totalRecords === 0 && filter.bankId) {
      const fallbackFilter = { ...filter };
      delete fallbackFilter.bankId;
      const [fallbackRequests, fallbackCount] = await Promise.all([
        MerchantCreditRequest.find(fallbackFilter)
          .populate("merchantId", "shopName merchantName email mobileNumber status branchId bankId")
          .populate("branchId", "name code state city")
          .populate("requestedBy", "fullName email phoneNumber")
          .populate("approvedBy", "fullName email")
          .populate("rejectedBy", "fullName email")
          .sort({ [sortField]: sortOrder })
          .skip(skip)
          .limit(limit)
          .lean(),
        MerchantCreditRequest.countDocuments(fallbackFilter),
      ]);
      if (fallbackCount > 0) {
        requests = fallbackRequests;
        totalRecords = fallbackCount;
      }
    }

    let items = requests;
    if (search) {
      const searchRegex = new RegExp(search, "i");
      items = items.filter((r) => {
        const shopName = r.merchantId?.shopName || "";
        const merchantName = r.merchantId?.merchantName || "";
        const branchName = r.branchId?.name || "";
        const branchCode = r.branchId?.code || "";
        const notes = r.notes || "";
        const reqIdStr = String(r._id || "");
        return (
          shopName.match(searchRegex) ||
          merchantName.match(searchRegex) ||
          branchName.match(searchRegex) ||
          branchCode.match(searchRegex) ||
          notes.match(searchRegex) ||
          reqIdStr.match(searchRegex)
        );
      });
    }

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    return {
      items,
      meta: {
        totalRecords,
        limit,
        page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * 12. Update Merchant Credit Request Status (Approve/Reject)
   */
  async updateMerchantCreditRequestStatus(bankId, requestId, payload, userId) {
    const { status, approvedQuantity, responseRemarks } = payload;
    const normalizedStatus = String(status).toUpperCase();

    if (!["APPROVED", "REJECTED"].includes(normalizedStatus)) {
      throw ApiError.badRequest("Status must be either APPROVED or REJECTED.");
    }

    const filter = {
      _id: requestId,
      isDeleted: { $ne: true },
    };

    let creditReq = await MerchantCreditRequest.findOne(filter);
    if (!creditReq && bankId) {
      creditReq = await MerchantCreditRequest.findOne({ _id: requestId, isDeleted: { $ne: true } });
    }
    if (!creditReq) {
      // Smart Fallback: Check if requestId passed was actually merchantId
      creditReq = await MerchantCreditRequest.findOne({
        merchantId: requestId,
        status: "PENDING",
        isDeleted: { $ne: true }
      }).sort({ createdAt: -1 });
    }

    if (!creditReq) {
      throw ApiError.notFound("Merchant credit request not found.");
    }

    if (creditReq.status !== "PENDING") {
      throw ApiError.badRequest(`Credit request has already been ${creditReq.status.toLowerCase()}.`);
    }

    if (normalizedStatus === "REJECTED") {
      creditReq.status = "REJECTED";
      creditReq.rejectedBy = userId;
      creditReq.rejectedAt = new Date();
      creditReq.responseRemarks = responseRemarks || null;
      await creditReq.save();

      return {
        requestId: creditReq._id,
        status: creditReq.status,
        responseRemarks: creditReq.responseRemarks,
        rejectedAt: creditReq.rejectedAt,
      };
    }

    // Status is APPROVED
    const qtyToApprove = Number(approvedQuantity ?? creditReq.creditQuantity);
    if (qtyToApprove <= 0) {
      throw ApiError.badRequest("Approved quantity must be greater than 0.");
    }

    const effectiveBankId = creditReq.bankId || bankId;
    if (!effectiveBankId) {
      throw ApiError.notFound("Bank record not found.");
    }

    const bank = await Bank.findOne({ _id: effectiveBankId, isDeleted: { $ne: true } });
    if (!bank) {
      throw ApiError.notFound("Bank record not found.");
    }

    if ((bank.availableVerificationCredits || 0) < qtyToApprove) {
      throw ApiError.badRequest(
        `Insufficient available verification credits in bank wallet. Available: ${bank.availableVerificationCredits || 0}, Requested: ${qtyToApprove}`
      );
    }

    let branchId = creditReq.branchId?._id || creditReq.branchId;
    if (!branchId) {
      const merchant = await MerchantProfile.findById(creditReq.merchantId);
      branchId = merchant?.branchId?._id || merchant?.branchId || null;
    }

    if (!branchId) {
      throw ApiError.badRequest("No branch associated with this merchant request.");
    }

    const branch = await Branch.findOne({ _id: branchId, isDeleted: { $ne: true } });
    if (!branch) {
      throw ApiError.notFound("Target branch record not found.");
    }

    let session = null;
    let sessionOpts = {};
    let transactionCommitted = false;

    try {
      const topoType = mongoose.connection.client?.topology?.description?.type;
      const supportsTransactions =
        topoType && topoType !== "Single" && topoType !== "Unknown";

      if (supportsTransactions) {
        session = await mongoose.startSession().catch(() => null);
        if (session) {
          session.startTransaction();
          sessionOpts = { session };
        }
      }

      // Deduct from Bank available credits
      bank.availableVerificationCredits = Math.max(
        0,
        (bank.availableVerificationCredits || 0) - qtyToApprove
      );
      await bank.save(sessionOpts);

      // Add to Branch available & total credits
      const branchBefore = {
        availableVerificationCredits: branch.availableVerificationCredits || branch.verificationCredits || 0,
      };

      branch.availableVerificationCredits = (branch.availableVerificationCredits || 0) + qtyToApprove;
      branch.totalVerificationCredits = (branch.totalVerificationCredits || 0) + qtyToApprove;
      branch.verificationCredits = (branch.verificationCredits || 0) + qtyToApprove;
      await branch.save(sessionOpts);

      // Save Credit Request update
      creditReq.status = "APPROVED";
      creditReq.approvedQuantity = qtyToApprove;
      creditReq.approvedBy = userId;
      creditReq.approvedAt = new Date();
      creditReq.responseRemarks = responseRemarks || null;
      await creditReq.save(sessionOpts);

      // Record transfer & credit log
      await CardCreditTransfer.create(
        [
          {
            bankId: bank._id,
            branchId: branch._id,
            emiQuantity: 0,
            verificationQuantity: qtyToApprove,
            balanceBefore: branchBefore,
            balanceAfter: { availableVerificationCredits: branch.availableVerificationCredits },
            remarks: `Approved merchant credit request (${creditReq._id})`,
            createdBy: userId,
          },
        ],
        sessionOpts
      );

      await CreditLog.create(
        [
          {
            bankId: bank._id,
            branchId: branch._id,
            merchantId: creditReq.merchantId,
            type: "VERIFICATION_CREDIT",
            action: "ALLOCATION",
            amount: qtyToApprove,
            createdBy: userId,
            description: `Transferred ${qtyToApprove} Verification Credits to branch [${branch.name}] for approved Merchant credit request`,
          },
        ],
        sessionOpts
      );

      if (session) {
        await session.commitTransaction();
        transactionCommitted = true;
      }

      logger.info(
        `MERCHANT CREDIT REQUEST APPROVED: Bank [${bank.name}] approved ${qtyToApprove} credits for Merchant [${creditReq.merchantId}] to Branch [${branch.name}]`
      );

      return {
        requestId: creditReq._id,
        status: creditReq.status,
        approvedQuantity: creditReq.approvedQuantity,
        approvedAt: creditReq.approvedAt,
        responseRemarks: creditReq.responseRemarks,
        branchNewBalance: branch.availableVerificationCredits,
      };
    } catch (error) {
      if (session && !transactionCommitted) {
        await session.abortTransaction().catch(() => {});
      }
      throw error;
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }
}

export const cardsCreditService = new CardsCreditService();
