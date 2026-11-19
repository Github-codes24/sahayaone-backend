import { BasePaymentProvider } from './base-payment.provider.js';

export class MockPaymentProvider extends BasePaymentProvider {
  async createOrder(bankId, amount, currency = 'INR') {
    const orderId = `order_mock_${Math.floor(100000 + Math.random() * 900000)}`;
    const checkoutLink = `http://localhost:5000/api/v1/onboarding/banks/mock-checkout/${bankId}?orderId=${orderId}&amount=${amount}`;
    
    return {
      orderId,
      keyId: 'mock_key_123',
      amountInPaise: Math.round(amount * 100),
      currency,
      paymentLink: checkoutLink,
      status: 'created',
      rawResponse: { provider: 'MOCK', amount, currency, bankId }
    };
  }

  async verifyWebhook(headers, rawBody) {
    // In Mock, we simply check a local header pass to verify signature integrity
    const signature = headers['x-mock-signature'];
    if (signature !== 'mock_secret_signature_key') {
      throw new Error('Invalid mock signature header.');
    }

    const payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    const { bankId, gatewayOrderId, transactionId, status, amount } = payload;

    return {
      success: status === 'SUCCESS',
      bankId,
      gatewayOrderId,
      transactionId,
      amount
    };
  }
}
