import axios from 'axios';
import https from 'https';
import { logger } from '../../utils/logger.util.js';
import { ApiError } from '../../common/api.error.js';

export class Msg91Provider {
  constructor(config = {}) {
    this.authKey = config.authKey;
    this.templateId = config.templateId || null;
    
    // Dedicated HTTPS Agent with no socket reuse to avoid ECONNRESET from edge servers
    this.httpsAgent = new https.Agent({
      keepAlive: false,
      rejectUnauthorized: true
    });
  }

  /**
   * Helper to format phone number to include Indian country code prefix (91)
   */
  formatNumber(phoneNumber) {
    if (!phoneNumber) return '';
    let clean = String(phoneNumber).replace(/\D/g, '');
    if (clean.length === 10) {
      return `91${clean}`;
    }
    return clean;
  }

  /**
   * Robust HTTP requester with automatic retries on transient network socket errors
   */
  async executeFlowRequest(payload, maxRetries = 2) {
    const url = 'https://control.msg91.com/api/v5/flow';
    const headers = {
      'authkey': this.authKey,
      'Content-Type': 'application/json'
    };

    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const response = await axios.post(url, payload, {
          headers,
          timeout: 10000,
          httpsAgent: this.httpsAgent
        });

        if (response.data?.type === 'success') {
          return response.data;
        } else {
          throw new Error(response.data?.message || 'MSG91 delivery request failed.');
        }
      } catch (err) {
        lastError = err;
        const isTransient = err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK';
        
        if (isTransient && attempt <= maxRetries) {
          logger.warn(`MSG91 GATEWAY: Transient socket error [${err.code || err.message}]. Retrying (attempt ${attempt}/${maxRetries})...`);
          await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
          continue;
        }
        break;
      }
    }

    throw lastError;
  }

  /**
   * Dispatches OTP using MSG91 SendOTP API (https://control.msg91.com/api/v5/otp)
   */
  async sendOtp(phoneNumber, otp, templateId = null, extraVariables = {}) {
    const formattedPhone = this.formatNumber(phoneNumber);
    const targetTemplateId = templateId || this.templateId;

    if (!targetTemplateId) {
      logger.error(`MSG91 ERROR: Missing template ID for OTP delivery to ${formattedPhone}`);
      throw ApiError.badRequest('MSG91 template ID is missing. An explicit template ID is required.');
    }

    if (!this.authKey) {
      logger.warn(`MSG91 INTEGRATION: authKey is missing. Mocking OTP delivery to ${formattedPhone} [OTP: ${otp}]`);
      return { success: true, provider: 'MSG91_MOCK', messageId: 'msg91_mock_otp_success' };
    }

    try {
      const url = 'https://control.msg91.com/api/v5/otp';
      const payload = {
        template_id: targetTemplateId,
        mobile: formattedPhone,
        otp: String(otp),
        expiry: String(extraVariables.expiry || '10'),
        otp_expiry: String(extraVariables.expiry || '10'),
        ...extraVariables
      };

      const headers = {
        'authkey': this.authKey,
        'Content-Type': 'application/json'
      };

      logger.info(`MSG91 OTP DISPATCH: Sending OTP [${otp}] to ${formattedPhone} via Template [${targetTemplateId}] using /api/v5/otp...`);
      
      let responseData = null;
      let lastError = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await axios.post(url, payload, {
            headers,
            timeout: 10000,
            httpsAgent: this.httpsAgent
          });

          if (response.data?.type === 'success' || response.status === 200) {
            responseData = response.data;
            break;
          } else {
            throw new Error(response.data?.message || 'MSG91 OTP delivery failed.');
          }
        } catch (err) {
          lastError = err;
          const isTransient = err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK';
          if (isTransient && attempt < 3) {
            logger.warn(`MSG91 GATEWAY: Transient error [${err.code || err.message}]. Retrying /otp (attempt ${attempt}/2)...`);
            await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
            continue;
          }
          break;
        }
      }

      if (!responseData && lastError) {
        throw lastError;
      }

      const msgId = responseData?.request_id || responseData?.message || 'success';
      logger.info(`MSG91 OTP SUCCESS: Delivered OTP to ${formattedPhone}, messageId [${msgId}]`);
      return { success: true, provider: 'MSG91', messageId: msgId };
    } catch (err) {
      logger.error(`MSG91 GATEWAY EXCEPTION: Failed sending OTP via /api/v5/otp: ${err.message}`);
      throw err;
    }
  }

  /**
   * Dispatches custom SMS notifications using MSG91 Flow API
   */
  async sendSms(phoneNumber, variables = {}, templateId = null) {
    const formattedPhone = this.formatNumber(phoneNumber);
    const targetTemplateId = templateId || this.templateId;

    if (!targetTemplateId) {
      logger.error(`MSG91 ERROR: Missing template ID for SMS delivery to ${formattedPhone}`);
      throw ApiError.badRequest('MSG91 template ID is missing. An explicit template ID is required.');
    }

    if (!this.authKey) {
      logger.warn(`MSG91 INTEGRATION: authKey is missing. Mocking SMS to ${formattedPhone}`);
      return { success: true, provider: 'MSG91_MOCK', messageId: 'msg91_mock_sms_success' };
    }

    const vars = typeof variables === 'string'
      ? { message: variables, var1: variables, VAR1: variables }
      : variables;

    try {
      const payload = {
        template_id: targetTemplateId,
        short_url: '0',
        recipients: [
          {
            mobiles: formattedPhone,
            ...vars
          }
        ]
      };

      logger.info(`MSG91 SMS DISPATCH: Sending SMS to ${formattedPhone} via Template [${targetTemplateId}]...`);
      const responseData = await this.executeFlowRequest(payload);

      return { success: true, provider: 'MSG91', messageId: responseData?.message || 'success' };
    } catch (err) {
      logger.error(`MSG91 GATEWAY EXCEPTION: Failed dispatching SMS: ${err.message}`);
      throw err;
    }
  }
}
