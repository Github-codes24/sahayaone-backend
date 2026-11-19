import axios from 'axios';
import { BasePaymentProvider } from './base-payment.provider.js';

export class PaypalPaymentProvider extends BasePaymentProvider {
  constructor() {
    super();
    this.clientId = process.env.PAYPAL_CLIENT_ID || '';
    this.clientSecret = process.env.STRIPE_CLIENT_SECRET || process.env.PAYPAL_CLIENT_SECRET || '';
    this.webhookId = process.env.PAYPAL_WEBHOOK_ID || '';
    this.baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://api-m.paypal.com' 
      : 'https://api-m.sandbox.paypal.com';
  }

  async getAccessToken() {
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const response = await axios.post(
      `${this.baseUrl}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${auth}`
        }
      }
    );
    return response.data.access_token;
  }

  async createOrder(bankId, amount, currency = 'USD') {
    const token = await this.getAccessToken();
    
    // For PayPal, we convert INR to USD mock or use USD as default since PayPal doesn't support INR directly
    const value = currency === 'INR' ? (amount / 83.5).toFixed(2) : amount.toFixed(2);
    const currencyCode = currency === 'INR' ? 'USD' : currency;

    const response = await axios.post(
      `${this.baseUrl}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: currencyCode,
              value
            },
            custom_id: bankId,
            description: `Sahayaone Cooperative Bank Onboarding Fee: ${bankId}`
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
    );

    const approveLink = response.data.links?.find(l => l.rel === 'approve')?.href;

    return {
      orderId: response.data.id,
      paymentLink: approveLink || `https://www.sandbox.paypal.com/checkoutnow?token=${response.data.id}`,
      status: response.data.status,
      rawResponse: response.data
    };
  }

  async verifyWebhook(headers, rawBody) {
    const token = await this.getAccessToken();
    const payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;

    // Call PayPal's own verification endpoint to avoid complex parsing of certs
    const verificationResponse = await axios.post(
      `${this.baseUrl}/v1/notifications/verify-webhook-signature`,
      {
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: this.webhookId,
        webhook_event: payload
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (verificationResponse.data.verification_status !== 'SUCCESS') {
      throw new Error('PayPal webhook signature verification failed.');
    }

    const purchaseUnit = payload.resource.purchase_units?.[0];
    const bankId = purchaseUnit?.custom_id;
    const orderId = payload.resource.id;
    const transactionId = payload.resource.purchase_units?.[0]?.payments?.captures?.[0]?.id || orderId;
    const amount = Number(purchaseUnit?.amount?.value || 0);

    const success = payload.event_type === 'CHECKOUT.ORDER.APPROVED' || payload.event_type === 'PAYMENT.CAPTURE.COMPLETED';

    return {
      success,
      bankId,
      gatewayOrderId: orderId,
      transactionId,
      amount
    };
  }
}
