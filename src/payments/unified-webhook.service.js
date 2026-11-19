import mongoose from "mongoose";
import { CardCreditPurchase } from "../models/card-credit-purchase.model.js";
import { Bank } from "../models/bank.model.js";
import { cardsCreditService } from "../panels/society/cards-credit/services/cards-credit.service.js";
import { bankOnboardingService } from "../panels/onboarding/bank/services/bank-onboarding.service.js";
import { cooperativeBankService } from "../panels/super-admin/co-operative-bank/services/co-operative-bank.service.js";
import { RazorpayHelper } from "../utils/razorpay.helper.js";
import { logger } from "../utils/logger.util.js";
import { ApiError } from "../common/api.error.js";

export class UnifiedWebhookService {
  /**
   * Unified Webhook Router Service
   *
   * Receives incoming Razorpay Webhook notifications and dynamically routes them to:
   * 1. Cards & Credit Purchase Service (CardCreditPurchase collection)
   * 2. Bank Onboarding / Super-Admin Bank Creation Service (Bank collection)
   */
  async handleUnifiedWebhook(headers, body, rawBody) {
    // 1. Verify Razorpay webhook signature hash
    const isValidSignature = razorpayHelper.verifyWebhookSignature(headers, rawBody || body);
    if (!isValidSignature) {
      logger.warn('UNIFIED WEBHOOK WARN: Webhook signature hash verification failed.');
      throw ApiError.badRequest('Invalid Razorpay webhook signature hash.');
    }

    const payload = typeof body === 'object' && body !== null ? body : {};

    // 2. Extract all potential transaction & link identifiers from payload
    const payment = payload.payload?.payment?.entity;
    const order = payload.payload?.order?.entity;
    const paymentLink = payload.payload?.payment_link?.entity;

    const candidateIds = [
      paymentLink?.id,
      paymentLink?.reference_id,
      order?.receipt,
      body.paymentLinkId,
      body.razorpay_order_id,
      body.orderId,
      body.paymentOrderId,
      body.gatewayOrderId,
      order?.id,
      payment?.order_id,
      payment?.id,
      body.razorpay_payment_id,
      body.transactionId,
      body.txnid,
      body.txnId
    ].filter((id) => typeof id === 'string' && id.trim().length > 0);

    const primaryOrderId = candidateIds[0] || '';
    const bankIdInPayload = body.bankId || payload.bankId || '';

    logger.info(`UNIFIED WEBHOOK RECEIVER: Extracted candidate references [${candidateIds.join(', ')}] from event [${payload.event || 'direct'}]`);

    // 3. Step A: Check CardCreditPurchase model
    if (candidateIds.length > 0) {
      const cardPurchase = await CardCreditPurchase.findOne({
        $or: [
          { paymentOrderId: { $in: candidateIds } },
          { paymentLinkId: { $in: candidateIds } },
          { paymentTransactionId: { $in: candidateIds } }
        ]
      });

      if (cardPurchase) {
        logger.info(`UNIFIED WEBHOOK MATCH: Found Cards & Credit purchase record [${cardPurchase._id}]. Delegating to CardsCreditService.`);
        return await cardsCreditService.handlePaymentWebhook(headers, body, rawBody);
      }
    }

    // 4. Step B: Check Bank model (Bank Onboarding & Super Admin Bank Creation)
    const bankFilter = [];
    if (candidateIds.length > 0) {
      bankFilter.push({ paymentLinkId: { $in: candidateIds } });
      bankFilter.push({ paymentGatewayOrderId: { $in: candidateIds } });
      bankFilter.push({ paymentGatewayTransactionId: { $in: candidateIds } });
    }
    if (bankIdInPayload && mongoose.Types.ObjectId.isValid(bankIdInPayload)) {
      bankFilter.push({ _id: bankIdInPayload });
    }

    if (bankFilter.length > 0) {
      const bank = await Bank.findOne({ $or: bankFilter });
      if (bank) {
        logger.info(`UNIFIED WEBHOOK MATCH: Found Bank record [${bank.name}] (${bank._id}). Delegating to CooperativeBankService.`);
        try {
          return await cooperativeBankService.handlePaymentWebhook(headers, body, rawBody);
        } catch (coopErr) {
          logger.warn(`UNIFIED WEBHOOK DELEGATION: CooperativeBankService delegated to BankOnboardingService (${coopErr.message}).`);
          return await bankOnboardingService.handlePaymentWebhook(headers, body, rawBody);
        }
      }
    }

    // 5. Fallback: If not matched directly by candidate IDs, try handlers safely
    logger.warn(`UNIFIED WEBHOOK UNRESOLVED: Could not pre-match candidate IDs [${candidateIds.join(', ')}] to a specific model. Executing fallback handlers.`);

    try {
      return await cardsCreditService.handlePaymentWebhook(headers, body, rawBody);
    } catch (errCards) {
      try {
        return await cooperativeBankService.handlePaymentWebhook(headers, body, rawBody);
      } catch (errCoop) {
        try {
          return await bankOnboardingService.handlePaymentWebhook(headers, body, rawBody);
        } catch (errBank) {
          throw ApiError.notFound(`No matching Bank Onboarding or Cards/Credit purchase record found for order references [${candidateIds.join(', ') || primaryOrderId}].`);
        }
      }
    }
  }
}

export const unifiedWebhookService = new UnifiedWebhookService();
