import { BaseController } from '../common/base.controller.js';
import { unifiedWebhookService } from './unified-webhook.service.js';

export class UnifiedWebhookController extends BaseController {
  constructor() {
    super();
    this.handleWebhook = this.handleWebhook.bind(this);
  }

  /**
   * Unified Webhook Endpoint Handler
   */
  async handleWebhook(req, res, next) {
    try {
      const result = await unifiedWebhookService.handleUnifiedWebhook(req.headers, req.body, req.rawBody);
      return this.sendSuccess(res, result, 'Webhook processed successfully.');
    } catch (error) {
      next(error);
    }
  }
}

export const unifiedWebhookController = new UnifiedWebhookController();
