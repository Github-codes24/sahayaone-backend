import { MockPaymentProvider } from './providers/mock-payment.provider.js';
import { RazorpayPaymentProvider } from './providers/razorpay-payment.provider.js';
import { StripePaymentProvider } from './providers/stripe-payment.provider.js';
import { PaypalPaymentProvider } from './providers/paypal-payment.provider.js';
import { panelControlConfig } from '../../config/panel-control.config.js';

export class OnboardingPaymentFactory {
  constructor() {
    this.providers = {
      MOCK: new MockPaymentProvider(),
      RAZORPAY: new RazorpayPaymentProvider(),
      STRIPE: new StripePaymentProvider(),
      PAYPAL: new PaypalPaymentProvider()
    };
  }

  /**
   * Resolves the active payment provider based on environmental settings
   * @returns {import('./providers/base-payment.provider.js').BasePaymentProvider}
   */
  getProvider() {
    // If PAYMENT configuration mode is TEST, always enforce the Mock provider
    if (panelControlConfig.ONBOARDING_PANEL.PAYMENT === 'TEST') {
      return this.providers.MOCK;
    }

    return this.providers.RAZORPAY;
  }
}

export const onboardingPaymentFactory = new OnboardingPaymentFactory();
