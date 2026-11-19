import crypto from 'crypto';
import axios from 'axios';
import { BasePaymentProvider } from './base-payment.provider.js';

export class StripePaymentProvider extends BasePaymentProvider {
  constructor() {
    super();
    this.apiKey = process.env.STRIPE_API_KEY || '';
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  }

  async createOrder(bankId, amount, currency = 'INR') {
    // Stripe amount is in cents
    const amountInCents = Math.round(amount * 100);

    const response = await axios.post(
      'https://api.stripe.com/v1/payment_intents',
      new URLSearchParams({
        amount: String(amountInCents),
        currency: currency.toLowerCase(),
        'metadata[bankId]': bankId,
        description: `Sahayaone Bank Onboarding fee: ${bankId}`
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${this.apiKey}`
        }
      }
    );

    return {
      orderId: response.data.id,
      paymentLink: response.data.client_secret, // returns client secret for stripe checkout UI
      status: response.data.status,
      rawResponse: response.data
    };
  }

  async verifyWebhook(headers, rawBody) {
    const signatureHeader = headers['stripe-signature'];
    if (!signatureHeader) {
      throw new Error('Stripe signature header not found.');
    }

    // Parse stripe-signature: t=timestamp,v1=signature
    const parts = signatureHeader.split(',');
    const timestampPart = parts.find(p => p.startsWith('t='));
    const signaturePart = parts.find(p => p.startsWith('v1='));

    if (!timestampPart || !signaturePart) {
      throw new Error('Invalid Stripe signature header format.');
    }

    const timestamp = timestampPart.split('=')[1];
    const signature = signaturePart.split('=')[1];

    const signedPayload = `${timestamp}.${rawBody}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(signedPayload)
      .digest('hex');

    if (signature !== expectedSignature) {
      throw new Error('Stripe webhook signature verification failed.');
    }

    const payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    const paymentIntent = payload.data.object;
    const orderId = paymentIntent.id;
    const transactionId = paymentIntent.charges?.data?.[0]?.id || orderId;
    const bankId = paymentIntent.metadata?.bankId;
    const amount = paymentIntent.amount / 100; // convert cents to INR

    const success = payload.type === 'payment_intent.succeeded' || paymentIntent.status === 'succeeded';

    return {
      success,
      bankId,
      gatewayOrderId: orderId,
      transactionId,
      amount
    };
  }
}
