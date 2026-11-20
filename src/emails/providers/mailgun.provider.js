import { logger } from '../../utils/logger.util.js';

export class MailgunProvider {
  constructor(config) {
    this.config = config;
  }
//asca
  async send(options) {
    logger.info(`EMAIL CLIENT: Mailgun API dispatch triggered (Simulated)`, {
      to: options.to,
      subject: options.subject
    });
    return { success: true, messageId: `mg-msg-${Date.now()}` };
  }
}
