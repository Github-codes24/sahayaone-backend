import crypto from "crypto";
import axios from "axios";
import { BasePaymentProvider } from "./base-payment.provider.js";
import { envConfig } from "../../../config/env.config.js";
import { logger } from "../../../utils/logger.util.js";

export class RazorpayPaymentProvider extends BasePaymentProvider {
  constructor() {
    super();
    this.keyId = process.env.RAZORPAY_KEY_ID || "";
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || "";
    this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
  }

  async createOrderAPI(bankId, amountInPaise, currency, authHeader) {
    const response = await axios.post(
      "https://api.razorpay.com/v1/orders",
      {
        amount: amountInPaise,
        currency,
        receipt: `rcpt_${bankId}_${Date.now().toString().slice(-6)}`,
        notes: { bankId },
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${authHeader}`,
        },
      },
    );

    return {
      orderId: response.data.id,
      status: response.data.status,
      rawResponse: response.data,
    };
  }

  async createOrder(bankId, amount, currency = "INR", customerInfo = {}) {
    const authHeader = Buffer.from(`${this.keyId}:${this.keySecret}`).toString(
      "base64",
    );
    const isTestMode = this.keyId && this.keyId.startsWith("rzp_test_");

    let finalAmount = amount;
    if (isTestMode && amount >= 5000) {
      logger.info(
        `RAZORPAY ORDER: Sandbox test key detected and amount ₹${amount} >= 5000. Setting test payment amount to ₹10.`,
      );
      finalAmount = 10;
    }
    const amountInPaise = Math.round(finalAmount * 100);

    try {
      // 1. Try with the computed amount first
      const orderRes = await this.createOrderAPI(
        bankId,
        amountInPaise,
        currency,
        authHeader,
      );
      return {
        ...orderRes,
        keyId: this.keyId,
        amountInPaise,
        currency,
      };
    } catch (err) {
      const errorMsg = err.response?.data?.error?.description || "";
      const isLimitError =
        errorMsg.toLowerCase().includes("exceeds maximum amount") ||
        errorMsg.toLowerCase().includes("amount exceeds");

      if (isLimitError && isTestMode) {
        // 2. If it's a test key and limit is exceeded, fallback to ₹10 standard order
        logger.warn(
          `RAZORPAY ORDER: Original amount ₹${amount} exceeds sandbox limit. Retrying with ₹10 fallback order.`,
        );
        const fallbackAmountInPaise = 1000; // ₹10
        const orderRes = await this.createOrderAPI(
          bankId,
          fallbackAmountInPaise,
          currency,
          authHeader,
        );
        return {
          ...orderRes,
          keyId: this.keyId,
          amountInPaise: fallbackAmountInPaise,
          currency,
        };
      }

      if (err.response) {
        logger.error("Razorpay Payment Link API Failure:", err.response.data);
        throw new Error(
          `Razorpay API Error: ${err.response.data.error?.description || JSON.stringify(err.response.data)}`,
        );
      }
      throw err;
    }
  }

  async verifyWebhook(headers, rawBody) {
    const signature = headers["x-razorpay-signature"];

    // If webhook secret is not configured in development, bypass signature check
    if (!this.webhookSecret && process.env.NODE_ENV !== "production") {
      logger.warn(
        "RAZORPAY WEBHOOK: RAZORPAY_WEBHOOK_SECRET is not configured in environment. Bypassing signature check.",
      );
    } else {
      if (!signature) {
        throw new Error("Razorpay webhook signature header not found.");
      }

      const expectedSignature = crypto
        .createHmac("sha256", this.webhookSecret)
        .update(rawBody)
        .digest("hex");

      if (signature !== expectedSignature) {
        throw new Error("Razorpay webhook signature verification failed.");
      }
    }

    const payload = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;

    let orderId = "";
    let transactionId = "";
    let bankId = "";
    let amount = 0;
    let success = false;

    // Handle both payment link webhooks and standard order payments
    if (payload.event === "payment_link.paid") {
      const paymentLinkObj = payload.payload.payment_link.entity;
      orderId = paymentLinkObj.id; // plink_xxxxxx
      bankId = paymentLinkObj.notes?.bankId;
      amount = paymentLinkObj.amount / 100;

      const paymentObj = payload.payload.payment?.entity;
      if (paymentObj) {
        transactionId = paymentObj.id;
      }
      success = paymentLinkObj.status === "paid";
    } else {
      const payment = payload.payload.payment?.entity;
      const order = payload.payload.order?.entity;

      orderId =
        order?.id || payment?.order_id || payment?.payment_link_id || "";
      transactionId = payment?.id || "";
      bankId = order?.notes?.bankId || payment?.notes?.bankId || "";
      amount = (order?.amount || payment?.amount || 0) / 100;
      success =
        payload.event === "order.paid" ||
        order?.status === "paid" ||
        payment?.status === "captured";
    }

    return {
      success,
      bankId,
      gatewayOrderId: orderId,
      transactionId,
      amount,
    };
  }
}
