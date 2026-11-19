import { Router } from 'express';
import { unifiedWebhookController } from './unified-webhook.controller.js';

const router = Router();

// Unified Razorpay Webhook Routes (Unauthenticated Gateway Callbacks)
router.post('/payment', unifiedWebhookController.handleWebhook);
router.post('/razorpay', unifiedWebhookController.handleWebhook);
router.post('/', unifiedWebhookController.handleWebhook);

export default router;
