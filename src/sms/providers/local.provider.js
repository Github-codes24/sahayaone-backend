import { logger } from '../../utils/logger.util.js';

export class LocalSmsProvider {
  constructor(config) {
    this.config = config;
  }

  async sendOtp(phoneNumber, otp) {
    logger.info(`[LOCAL SMS] Simulated OTP delivery: ${otp} sent to ${phoneNumber}`);
    return { success: true, provider: 'LOCAL', messageId: 'local_mock_otp' };
  }

  async sendSms(phoneNumber, message) {
    logger.info(`[LOCAL SMS] Simulated SMS sent to ${phoneNumber}: "${message}"`);
    return { success: true, provider: 'LOCAL', messageId: 'local_mock_sms' };
  }
}
