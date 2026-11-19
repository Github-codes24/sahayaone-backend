import { smsConfig } from '../config/sms.config.js';
import { LocalSmsProvider } from './providers/local.provider.js';
import { Msg91Provider } from './providers/msg91.provider.js';
import { logger } from '../utils/logger.util.js';

class SmsManager {
  constructor() {
    this.provider = null;
    this.initProvider();
  }

  initProvider() {
    const activeProvider = (smsConfig.provider || 'MSG91').toUpperCase();

    switch (activeProvider) {
      case 'LOCAL':
        this.provider = new LocalSmsProvider();
        logger.info('SMS MANAGER: Active SMS provider initialized as [LOCAL]');
        break;
      case 'MSG91':
      default:
        this.provider = new Msg91Provider(smsConfig.msg91);
        logger.info('SMS MANAGER: Active SMS provider initialized as [MSG91]');
        break;
    }
  }

  /**
   * Dispatches verification OTP
   * @param {String} phoneNumber - Recipient number
   * @param {String} otp - 6 digit numeric code
   * @param {String} [templateId] - Optional MSG91 template ID override
   * @param {Object} [extraVariables] - Optional extra template variables
   */
  async sendOtp(phoneNumber, otp, templateId = null, extraVariables = {}) {
    return await this.provider.sendOtp(phoneNumber, otp, templateId, extraVariables);
  }

  /**
   * Dispatches general notification message / variables
   * @param {String} phoneNumber - Recipient number
   * @param {String|Object} messageOrVariables - Body text or variable payload
   * @param {String} [templateId] - Optional MSG91 template ID
   */
  async sendSms(phoneNumber, messageOrVariables, templateId = null) {
    return await this.provider.sendSms(phoneNumber, messageOrVariables, templateId);
  }
}

export const smsManager = new SmsManager();
