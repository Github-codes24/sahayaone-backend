import { SocietyReceiptController } from '../../receipts/shared/receipt.controller.js';
import { creditReceiptService } from '../services/credit-receipt.service.js';

export const creditReceiptController = new SocietyReceiptController(creditReceiptService, 'credit-receipts');
