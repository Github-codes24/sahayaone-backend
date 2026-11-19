import crypto from 'crypto';
import { envConfig } from '../config/env.config.js';
import { logger } from './logger.util.js';

export class EasebuzzHelper {
  constructor() {
    this.key = process.env.EASEBUZZ_MERCHANT_KEY || process.env.EASEBUZZ_KEY || process.env.EASYBUZZ_KEY || 'EASEBUZZ_MOCK_KEY';
    this.salt = process.env.EASEBUZZ_MERCHANT_SALT || process.env.EASEBUZZ_SALT || process.env.EASYBUZZ_SALT || 'EASEBUZZ_MOCK_SALT';
    this.env = process.env.EASEBUZZ_ENV || process.env.EASYBUZZ_ENV || 'test'; // 'test' or 'prod'
    this.baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://pay.easebuzz.in/payment/initiateLink'
      : 'https://testpay.easebuzz.in/payment/initiateLink';
  }

  /**
   * Generates SHA-512 Hash for Easebuzz payment initiation request
   * Formula: sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5|udf6|udf7|udf8|udf9|udf10|salt)
   */
  generateInitiateHash(params) {
    const { txnid, amount, productinfo, firstname, email, udf1 = '', udf2 = '', udf3 = '', udf4 = '', udf5 = '', udf6 = '', udf7 = '', udf8 = '', udf9 = '', udf10 = '' } = params;
    const amountFormatted = parseFloat(amount).toFixed(2);
    const hashString = `${this.key}|${txnid}|${amountFormatted}|${productinfo}|${firstname}|${email}|${udf1}|${udf2}|${udf3}|${udf4}|${udf5}|${udf6}|${udf7}|${udf8}|${udf9}|${udf10}|${this.salt}`;
    
    return crypto.createHash('sha512').update(hashString).digest('hex');
  }

  /**
   * Verifies SHA-512 Hash for Easebuzz payment webhook/response
   * Formula: sha512(salt|status|udf10|udf9|udf8|udf7|udf6|udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
   */
  verifyResponseHash(payload) {
    const {
      status,
      txnid,
      amount,
      productinfo = '',
      firstname = '',
      email = '',
      udf1 = '',
      udf2 = '',
      udf3 = '',
      udf4 = '',
      udf5 = '',
      udf6 = '',
      udf7 = '',
      udf8 = '',
      udf9 = '',
      udf10 = '',
      hash
    } = payload;

    if (!hash) return false;

    // In development mode, allow mock hash validation if hash equals 'MOCK_EASEBUZZ_HASH' or 'MOCK_EASYBUZZ_HASH'
    if (envConfig.nodeEnv === 'development' && (hash === 'MOCK_EASEBUZZ_HASH' || hash === 'MOCK_EASYBUZZ_HASH')) {
      return true;
    }

    const amountFormatted = parseFloat(amount).toFixed(2);
    const hashString = `${this.salt}|${status}|${udf10}|${udf9}|${udf8}|${udf7}|${udf6}|${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${amountFormatted}|${txnid}|${this.key}`;
    const calculatedHash = crypto.createHash('sha512').update(hashString).digest('hex');

    return calculatedHash.toLowerCase() === hash.toLowerCase();
  }

  /**
   * Initiates payment order and constructs payment checkout URL
   */
  async createPaymentOrder(orderData) {
    const { txnid, amount, productinfo, firstname, email, phone } = orderData;

    const hash = this.generateInitiateHash({
      txnid,
      amount,
      productinfo,
      firstname,
      email
    });

    const paymentLink = `${this.baseUrl}?txnid=${txnid}&key=${this.key}&hash=${hash}`;

    logger.info(`EASEBUZZ PAYMENT: Created order [${txnid}] for amount [₹${amount}]`);

    return {
      success: true,
      paymentGateway: 'EASEBUZZ',
      orderId: txnid,
      key: this.key,
      hash,
      amount,
      paymentLink,
      checkoutUrl: paymentLink
    };
  }
}

export const easebuzzHelper = new EasebuzzHelper();
export const EasyBuzzHelper = EasebuzzHelper;
export const easybuzzHelper = easebuzzHelper;
