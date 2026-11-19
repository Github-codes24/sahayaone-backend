import { createReceiptRouter } from '../../receipts/shared/create-receipt-router.js';
import { debitReceiptController } from '../controllers/debit-receipt.controller.js';

export default createReceiptRouter(debitReceiptController);
