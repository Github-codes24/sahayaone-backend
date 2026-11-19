import { createReceiptRouter } from '../../receipts/shared/create-receipt-router.js';
import { transferReceiptController } from '../controllers/transfer-receipt.controller.js';

export default createReceiptRouter(transferReceiptController);
