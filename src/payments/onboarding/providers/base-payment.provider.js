export class BasePaymentProvider {
  /**
   * Creates a payment order/session at the gateway.
   * @param {string} bankId
   * @param {number} amount - Total amount in INR.
   * @param {string} currency - e.g. 'INR', 'USD'
   * @returns {Promise<{ orderId: string, paymentLink?: string, status: string, rawResponse: any }>}
   */
  async createOrder(bankId, amount, currency = 'INR') {
    throw new Error('Method "createOrder" must be implemented by payment provider.');
  }

  /**
   * Validates the webhook signature and returns the payment transaction status.
   * @param {any} headers - HTTP request headers.
   * @param {string|Buffer} rawBody - Raw request body for HMAC verification.
   * @returns {Promise<{ success: boolean, bankId?: string, gatewayOrderId: string, transactionId: string, amount: number }>}
   */
  async verifyWebhook(headers, rawBody) {
    throw new Error('Method "verifyWebhook" must be implemented by payment provider.');
  }
}
