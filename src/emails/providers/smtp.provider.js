import nodemailer from 'nodemailer';
import { logger } from '../../utils/logger.util.js';

export class SmtpProvider {
  constructor(config) {
    this.config = config;
    this.transporter = null;
    this.init();
  }

  init() {
    this.transporter = nodemailer.createTransport({
      host: this.config.smtp.host,
      port: this.config.smtp.port,
      secure: this.config.smtp.secure,
      auth: this.config.smtp.auth.user ? this.config.smtp.auth : undefined,
      connectionTimeout: 5000, // 5s connection timeout
      greetingTimeout: 5000,   // 5s greeting timeout
      socketTimeout: 5000      // 5s socket timeout
    });
  }

  async send(options) {
    const mailOptions = {
      from: `"${this.config.fromName}" <${this.config.fromEmail}>`,
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments || []
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      const previewUrl = nodemailer.getTestMessageUrl(info);
      logger.info(`EMAIL CLIENT: SMTP mail dispatched. MessageID: ${info.messageId}`);
      if (previewUrl) {
        logger.info(`EMAIL CLIENT: Ethereal Mail Preview URL: ${previewUrl}`);
      }
      return { success: true, messageId: info.messageId, previewUrl: previewUrl || null };
    } catch (error) {
      logger.error(`EMAIL EXCEPTION: SMTP delivery failed: ${error.message}`);
      throw error;
    }
  }
}
