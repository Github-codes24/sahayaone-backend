import { emailConfig } from '../config/email.config.js';
import { Msg91EmailProvider } from './providers/msg91-email.provider.js';
import { logger } from '../utils/logger.util.js';

class Mailer {
  constructor() {
    this.provider = new Msg91EmailProvider(emailConfig);
    logger.info('EMAIL SERVICE: Active Email provider initialized as [MSG91]');
  }

  compileTemplate(htmlTemplate, variables = {}) {
    if (!htmlTemplate) return '';
    let output = htmlTemplate;
    for (const key of Object.keys(variables)) {
      const regex = new RegExp(`(?:##|{{)${key}(?:##|}})`, 'g');
      output = output.replace(regex, variables[key]);
    }
    return output;
  }

  /**
   * Dispatches email exclusively via MSG91
   * @param {Object} options - { to, name, subject, templateId, variables, html, cc, bcc, attachments }
   */
  async sendMail(options) {
    let htmlContent = options.html;
    
    if (options.variables && htmlContent) {
      htmlContent = this.compileTemplate(htmlContent, options.variables);
    }

    return this.provider.send({
      to: options.to,
      name: options.name || '',
      subject: options.subject,
      templateId: options.templateId || null,
      variables: options.variables || {},
      html: htmlContent,
      cc: options.cc,
      bcc: options.bcc,
      attachments: options.attachments
    });
  }
}

export const mailer = new Mailer();
