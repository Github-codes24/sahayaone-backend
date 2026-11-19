import { createReceiptRouter } from '../../receipts/shared/create-receipt-router.js';
import { creditReceiptController } from '../controllers/credit-receipt.controller.js';

export default createReceiptRouter(creditReceiptController);
