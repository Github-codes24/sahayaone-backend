import { logger } from '../../utils/logger.util.js';

export class SesProvider {
  constructor(config) {
    this.config = config;
  }

  async send(options) {
    logger.info(`EMAIL CLIENT: AWS SES dispatch triggered (Simulated)`, {
      to: options.to,
      subject: options.subject
    });
    return { success: true, messageId: `ses-msg-${Date.now()}` };
  }
}
