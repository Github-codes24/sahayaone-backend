import crypto from "crypto";
import axios from "axios";
import { envConfig } from "../config/env.config.js";
import { logger } from "./logger.util.js";
import {Bank} from "../models/bank.model.js"

export class RazorpayHelper {
  constructor() {
    this.keyId = process.env.RAZORPAY_KEY_ID || "";
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || "";
    this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
    this.clientId = process.env.RAZORPAY_CLIENT_ID || "";
    this.clientSecret = process.env.RAZORPAY_CLIENT_SECRET || "";
    this.redirectUri = process.env.RAZORPAY_REDIRECT_URI || "";
    this.baseUrl = "https://api.razorpay.com/v1";
    this.authUrl = "https://auth.razorpay.com";
  }

  /**
   * Generates Basic Auth header string for Razorpay REST APIs
   */
  getAuthHeader() {
    return Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");
  }

  /**
   * Dynamic Auth Header:
   * - If `bank` is passed (B2C): Uses Bank's OAuth Bearer Token (with auto-refresh)
   * - If `bank` is null (B2B): Uses Sahayaone Master Basic Auth
   */
  async getRequestHeaders(bank = null) {
    if (bank) {
      if (!bank.razorpay?.isConnected || !bank.razorpay?.accessToken) {
        throw new Error(
          `Cooperative Bank [${bank.name}] has not connected their Razorpay account yet.`,
        );
      }

      let accessToken = bank.razorpay.accessToken;

      // Auto-refresh token if expiring in less than 5 minutes
      const isExpiring =
        bank.razorpay.tokenExpiresAt &&
        new Date(bank.razorpay.tokenExpiresAt).getTime() - Date.now() < 5 * 60 * 1000;

      if (isExpiring && bank.razorpay.refreshToken) {
        logger.info(`RAZORPAY OAUTH: Auto-refreshing token for Bank [${bank.name}]`);
        const refreshed = await this.refreshOAuthToken(bank.razorpay.refreshToken);
        accessToken = refreshed.accessToken;

        bank.razorpay.accessToken = refreshed.accessToken;
        bank.razorpay.refreshToken = refreshed.refreshToken;
        bank.razorpay.publicToken = refreshed.publicToken || bank.razorpay.publicToken;
        bank.razorpay.tokenExpiresAt = refreshed.tokenExpiresAt;
        if (typeof bank.save === "function") {
          await bank.save();
        }
      }

      return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      };
    }

    // Default B2B Master Auth
    return {
      "Content-Type": "application/json",
      Authorization: `Basic ${this.getAuthHeader()}`,
    };
  }

  // =========================================================================
  // OAUTH 2.0 HANDSHAKE METHODS (For Bank Dashboard "Connect to Razorpay")
  // =========================================================================

  createOAuthState(bankId) {
    const payload = `${bankId}:${Date.now()}`;
    const signature = crypto
      .createHmac("sha256", this.keySecret || "sahayaone_oauth_secret")
      .update(payload)
      .digest("hex");
    return Buffer.from(`${payload}:${signature}`).toString("base64url");
  }

  verifyOAuthState(stateString) {
    try {
      const decoded = Buffer.from(stateString, "base64url").toString("utf8");
      const [bankId, timestamp, signature] = decoded.split(":");
      if (!bankId || !timestamp || !signature) return null;

      // State valid for 15 minutes
      if (Date.now() - Number(timestamp) > 15 * 60 * 1000) return null;

      const expectedSig = crypto
        .createHmac("sha256", this.keySecret || "sahayaone_oauth_secret")
        .update(`${bankId}:${timestamp}`)
        .digest("hex");

      return expectedSig === signature ? bankId : null;
    } catch {
      return null;
    }
  }

  getOAuthAuthorizeUrl(bankId) {
    if (!this.clientId || !this.redirectUri) {
      throw new Error(
        "RAZORPAY_CLIENT_ID and RAZORPAY_REDIRECT_URI must be set in .env",
      );
    }

    const state = this.createOAuthState(bankId);
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: "read_write",
      state,
    });

    return `${this.authUrl}/authorize?${params.toString()}`;
  }

async exchangeOAuthToken(code) {
    // Bina NODE_ENV check ke - agar code 'mock_' se shuru ho toh turant dummy token de do
    if (code && code.startsWith("mock_")) {
      const accountId = code.replace("mock_code_", "acc_") || "acc_bank101";
      
      return {
        success: true,
        accountId: accountId,
        accessToken: "mock_access_token_" + Date.now(),
        refreshToken: "mock_refresh_token_" + Date.now(),
        tokenExpiresAt: new Date(Date.now() + 86400000), // 1 day
      };
    }

    // Real API call for actual production
    try {
      const response = await axios.post("https://auth.razorpay.com/token", {
        client_id: process.env.RAZORPAY_CLIENT_ID,
        client_secret: process.env.RAZORPAY_CLIENT_SECRET,
        code: code,
        grant_type: "authorization_code",
      });
      return response.data;
    } catch (error) {
      throw new Error(`Razorpay OAuth Error: ${error.message}`);
    }
  }
  
  async refreshOAuthToken(refreshToken) {
    const response = await axios.post(
      `${this.authUrl}/token`,
      {
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      },
      { headers: { "Content-Type": "application/json" } },
    );

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      publicToken: response.data.public_token,
      tokenExpiresAt: new Date(
        Date.now() + (response.data.expires_in || 7776000) * 1000,
      ),
    };
  }

  /**
   * Verifies standard Razorpay Checkout response signature
   * Formula: HmacSHA256(order_id + "|" + razorpay_payment_id, key_secret)
   */
  verifyPaymentSignature({
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  }) {
    if (!razorpay_signature) return false;

    if (
      envConfig.nodeEnv === "development" &&
      razorpay_signature === "MOCK_RAZORPAY_SIGNATURE"
    ) {
      return true;
    }

    if (!this.keySecret) {
      logger.warn(
        "RAZORPAY HELPER: RAZORPAY_KEY_SECRET is not configured in environment.",
      );
      return envConfig.nodeEnv === "development";
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", this.keySecret)
      .update(body)
      .digest("hex");

    return expectedSignature.toLowerCase() === razorpay_signature.toLowerCase();
  }

  /**
   * Verifies Razorpay Webhook signature header
   * Header: x-razorpay-signature
   * Formula: HmacSHA256(rawBody, webhookSecret)
   */
  verifyWebhookSignature(headers, rawBody) {
    const signature =
      headers["x-razorpay-signature"] || headers["X-Razorpay-Signature"];

    if (!signature) {
      if (envConfig.nodeEnv === "development") {
        logger.warn(
          "RAZORPAY WEBHOOK: Missing x-razorpay-signature header in development. Bypassing check.",
        );
        return true;
      }
      return false;
    }

    if (
      envConfig.nodeEnv === "development" &&
      signature === "MOCK_RAZORPAY_SIGNATURE"
    ) {
      return true;
    }

    if (!this.webhookSecret) {
      if (envConfig.nodeEnv === "development") {
        logger.warn(
          "RAZORPAY WEBHOOK: RAZORPAY_WEBHOOK_SECRET is not configured in environment. Bypassing check.",
        );
        return true;
      }
      return false;
    }

    const bodyString =
      typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody);
    const expectedSignature = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(bodyString)
      .digest("hex");

    return expectedSignature.toLowerCase() === signature.toLowerCase();
  }

   
  
// (ya pigmyCustomer ke case me: await Bank.findById(pigmyCustomer.bankId))
  /**
   * Creates a Razorpay Payment Order via Razorpay REST API
   */
  async createPaymentOrder(orderData) {
    const { txnid, amount, notes = {}, receipt , bank=null} = orderData;
    const amountInPaise = Math.round(amount * 100);
    const orderReceipt = receipt || txnid || `rcpt_${Date.now()}`;

    logger.info(
      `RAZORPAY ORDER INITIATE: Order [${orderReceipt}] for amount [₹${amount}] (${amountInPaise} paise)`,
    );

    // Development/Mock fallback if keys not configured
    if (!this.keyId || !this.keySecret) {
      if (envConfig.nodeEnv === "development") {
        logger.warn(
          "RAZORPAY HELPER: Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET. Returning mock Razorpay order response.",
        );
        const mockGatewayOrderId = `order_mock_${Date.now()}`;
        return {
          success: true,
          paymentGateway: "RAZORPAY",
          paymentMethod: "RAZORPAY",
          orderId: mockGatewayOrderId,
          receipt: orderReceipt,
          keyId: this.keyId || "rzp_test_mock",
          amount,
          amountInPaise,
          currency: "INR",
        };
      }
      throw new Error(
        "Razorpay API keys (RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET) are missing.",
      );
    }

    try {
      // 1. Dynamic headers lo (Agar bank pass hua toh OAuth Bearer token, warna Master Basic Auth)
      const headers = await this.getRequestHeaders(bank);

      const response = await axios.post(
        `${this.baseUrl}/orders`,
        {
          amount: amountInPaise,
          currency: "INR",
          receipt: orderReceipt,
          notes,
        },
        {
           headers 
        },
      );

      
      return {
        success: true,
        paymentGateway: "RAZORPAY",
        paymentMethod: "RAZORPAY",
        orderId: response.data.id,
        receipt: response.data.receipt,
        keyId: this.keyId,
        keyId: bank?.razorpay?.publicToken || this.keyId, // Bank ka public token ya master key
        amount,
        amountInPaise: response.data.amount,
        currency: response.data.currency || "INR",
        rawOrder: response.data,
      };
    } catch (err) {
      const errorMsg = err.response?.data?.error?.description || err.message;
      logger.error(
        "Razorpay Create Order API Failure:",
        err.response?.data || err.message,
      );

      // In development mode, if API request fails (e.g. sandbox amount limit), provide graceful fallback
      if (envConfig.nodeEnv === "development") {
        logger.warn(
          `RAZORPAY ORDER: API call failed (${errorMsg}). Fallback to mock order object for testing.`,
        );
        const fallbackGatewayOrderId = `order_fallback_${Date.now()}`;
        return {
          success: true,
          paymentGateway: "RAZORPAY",
          paymentMethod: "RAZORPAY",
          orderId: fallbackGatewayOrderId,
          receipt: orderReceipt,
          keyId: this.keyId,
          amount,
          amountInPaise,
          currency: "INR",
        };
      }

      throw new Error(`Razorpay API Error: ${errorMsg}`);
    }
  }

  /**
   * Creates a Razorpay Payment Link via Razorpay REST API
   */
  async createPaymentLink(linkData) {
    const { txnid, amount, description, customer = {}, notes = {} } = linkData;
    const amountInPaise = Math.round(amount * 100);
    const referenceId = txnid || `plink_${Date.now()}`;

    logger.info(
      `RAZORPAY PAYMENT LINK INITIATE: Ref [${referenceId}] for amount [₹${amount}]`,
    );

    // Development/Mock fallback if keys not configured
    if (!this.keyId || !this.keySecret) {
      if (envConfig.nodeEnv === "development") {
        logger.warn(
          "RAZORPAY HELPER: Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET. Returning mock Payment Link.",
        );
        const mockPlinkId = `plink_mock_${Date.now()}`;
        return {
          success: true,
          paymentGateway: "RAZORPAY",
          paymentMethod: "RAZORPAY",
          paymentLinkId: mockPlinkId,
          paymentLink: `https://rzp.io/i/mock_${Date.now()}`,
          referenceId,
          amount,
          amountInPaise,
          currency: "INR",
        };
      }
      throw new Error(
        "Razorpay API keys (RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET) are missing.",
      );
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/payment_links`,
        {
          amount: amountInPaise,
          currency: "INR",
          accept_partial: false,
          reference_id: referenceId,
          description: description || "Credit Purchase",
          customer: {
            name: customer.name || "Bank Customer",
            email: customer.email || "",
            contact: customer.contact || "",
          },
          notify: {
            sms: true,
            email: true,
          },
          notes,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${this.getAuthHeader()}`,
          },
        },
      );

      return {
        success: true,
        paymentGateway: "RAZORPAY",
        paymentMethod: "RAZORPAY",
        paymentLinkId: response.data.id,
        paymentLink: response.data.short_url || response.data.url,
        referenceId: response.data.reference_id,
        amount,
        amountInPaise: response.data.amount,
        currency: response.data.currency || "INR",
        rawLink: response.data,
      };
    } catch (err) {
      const errorMsg = err.response?.data?.error?.description || err.message;
      logger.error(
        "Razorpay Create Payment Link API Failure:",
        err.response?.data || err.message,
      );

      if (envConfig.nodeEnv === "development") {
        logger.warn(
          `RAZORPAY PAYMENT LINK: API call failed (${errorMsg}). Fallback to mock Payment Link for testing.`,
        );
        const fallbackPlinkId = `plink_fallback_${Date.now()}`;
        return {
          success: true,
          paymentGateway: "RAZORPAY",
          paymentMethod: "RAZORPAY",
          paymentLinkId: fallbackPlinkId,
          paymentLink: `https://rzp.io/i/fallback_${Date.now()}`,
          referenceId,
          amount,
          amountInPaise,
          currency: "INR",
        };
      }

      throw new Error(`Razorpay API Error: ${errorMsg}`);
    }
  }

  /**
   * Creates a Razorpay e-NACH / UPI Autopay Mandate Order via Razorpay REST API
   */
  async createMandateOrder(mandateData) {
    const { loanId, maxAmount = 15000, authType = 'NETBANKING', bankDetails = {}, customer = {} } = mandateData;
    const maxAmountPaise = Math.round(maxAmount * 100);

    const headers = await this.getRequestHeaders(bank);

    if (!this.keyId || !this.keySecret) {
      throw new Error('Razorpay API Keys (RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET) are not configured in .env file.');
    }

    try {
      let customerId = customer.razorpayCustomerId || customer.customerId;

      // Auto-create Razorpay Customer if not provided
      if (!customerId) {
        try {
          const custRes = await axios.post(
            `${this.baseUrl}/customers`,
            {
              name: customer.name || bankDetails.accountHolder || 'Sahayaone Customer',
              contact: customer.phone ? String(customer.phone).replace(/\D/g, '').slice(-10) : '9999999999',
              email: customer.email || 'customer@sahayaone.com',
              fail_existing: 0
            },
            {
              // headers: {
              //   'Content-Type': 'application/json',
              //   Authorization: `Basic ${this.getAuthHeader()}`
              // }
              headers
            }
          );
          customerId = custRes.data.id;
        } catch (custErr) {
          logger.warn(`Razorpay Customer creation warning: ${custErr.response?.data?.error?.description || custErr.message}`);
          customerId = custErr.response?.data?.error?.metadata?.customer_id || null;
        }
      }

      const receiptId = `rcpt_${String(loanId).slice(-10)}_${Date.now().toString(36)}`;

      const orderPayload = {
        amount: maxAmountPaise || 1500000,
        currency: 'INR',
        receipt: receiptId,
        ...(customerId ? { customer_id: customerId } : {}),
        notes: {
          loanId: String(loanId),
          auth_type: (authType || 'NETBANKING').toLowerCase(),
          bank: bankDetails.bankName || 'HDFC',
          account_number: bankDetails.accountNumber || '',
          ifsc: bankDetails.ifsc || '',
          account_holder: bankDetails.accountHolder || ''
        }
      };

      const response = await axios.post(
        `${this.baseUrl}/orders`,
        orderPayload,
        {
          // headers: {
          //   'Content-Type': 'application/json',
          //   Authorization: `Basic ${this.getAuthHeader()}`
          // }
          headers
        }
      );

      let razorpayMandateUrl = `https://checkout.razorpay.com/v1/checkout.html?key=${this.keyId}&order_id=${response.data.id}`;

      try {
        const linkRes = await axios.post(
          `${this.baseUrl}/payment_links`,
          {
            amount: maxAmountPaise || 1500000,
            currency: 'INR',
            accept_partial: false,
            reference_id: `ref_${String(loanId).slice(-10)}_${Date.now().toString(36)}`,
            description: 'Sahayaone e-NACH Mandate Registration',
            customer: {
              name: customer.name || bankDetails.accountHolder || 'Sahayaone Customer',
              contact: customer.phone ? String(customer.phone).replace(/\D/g, '').slice(-10) : '9999999999',
              email: customer.email || 'customer@sahayaone.com'
            },
            notes: {
              loanId: String(loanId),
              orderId: response.data.id
            }
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Basic ${this.getAuthHeader()}`
            }
          }
        );
        if (linkRes.data?.short_url) {
          razorpayMandateUrl = linkRes.data.short_url;
        }
      } catch (linkErr) {
        logger.warn(`Razorpay Payment Link creation warning: ${linkErr.response?.data?.error?.description || linkErr.message}`);
      }

      const hostUrl = mandateData.hostUrl || process.env.APP_BASE_URL || 'http://localhost:5000';

      return {
        success: true,
        mandateId: response.data.id,
        tokenId: response.data.id,
        razorpayMandateUrl,
        interactiveWebviewUrl: `${hostUrl}/api/v1/employee/leads/mandate-checkout?key=${this.keyId}&order_id=${response.data.id}`,
        rawOrder: response.data
      };
    } catch (err) {
      const errorMsg = err.response?.data?.error?.description || err.response?.data?.error?.reason || err.message;
      logger.error(`[Razorpay Mandate Order API Error]: ${errorMsg}`);
      throw new Error(`Razorpay Mandate API Error: ${errorMsg}`);
    }
  }
}

// export const razorpayHelper = new RazorpayHelper();
// export const RazorPayHelper = RazorpayHelper;
