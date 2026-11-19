import { createReceiptRouter } from '../../receipts/shared/create-receipt-router.js';
import { contraReceiptController } from '../controllers/contra-receipt.controller.js';

export default createReceiptRouter(contraReceiptController);
