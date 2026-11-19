import { SocietyReceiptController } from '../../receipts/shared/receipt.controller.js';
import { transferReceiptService } from '../services/transfer-receipt.service.js';

export const transferReceiptController = new SocietyReceiptController(transferReceiptService, 'transfer-receipts');
