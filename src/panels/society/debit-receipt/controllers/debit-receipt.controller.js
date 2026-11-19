import { SocietyReceiptController } from '../../receipts/shared/receipt.controller.js';
import { debitReceiptService } from '../services/debit-receipt.service.js';

export const debitReceiptController = new SocietyReceiptController(debitReceiptService, 'debit-receipts');
