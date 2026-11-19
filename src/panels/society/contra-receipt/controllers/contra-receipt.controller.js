import { SocietyReceiptController } from '../../receipts/shared/receipt.controller.js';
import { contraReceiptService } from '../services/contra-receipt.service.js';

export const contraReceiptController = new SocietyReceiptController(contraReceiptService, 'contra-receipts');
