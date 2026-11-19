import { Router } from 'express';
import societyLeadRouter from './leads/index.js';
import attendanceReportRouter from './attendance-report/index.js';
import inventoryRouter from './inventory/index.js';
import creditReceiptRouter from './credit-receipt/index.js';
import debitReceiptRouter from './debit-receipt/index.js';
import transferReceiptRouter from './transfer-receipt/index.js';
import contraReceiptRouter from './contra-receipt/index.js';
import cardsCreditRouter from './cards-credit/index.js';
import societyKycVerificationRouter from './kycVerification/index.js';
import societyDashboardRouter from './dashboard/index.js';
import societyMerchantRouter from './merchant/index.js';
import societyReportRouter from './reports/index.js';
import societyAttendanceRouter from './attendance/index.js';
import societyPigmyRouter from './pigmy/index.js';
import societyCustomerRouter from './customer/routes/society-customer.routes.js';

const router = Router();

router.use('/dashboard', societyDashboardRouter);
router.use('/reports', societyReportRouter);
router.use('/attendance-report', attendanceReportRouter);
router.use('/attendance', societyAttendanceRouter);
router.use('/leads', societyLeadRouter);
router.use('/pigmy-customers', societyPigmyRouter);
router.use('/pigmy', societyPigmyRouter);
router.use('/customers', societyCustomerRouter);
router.use('/customer', societyCustomerRouter);
router.use('/inventory', inventoryRouter);
router.use('/credit-receipts', creditReceiptRouter);
router.use('/debit-receipts', debitReceiptRouter);
router.use('/transfer-receipts', transferReceiptRouter);
router.use('/contra-receipts', contraReceiptRouter);
router.use('/cards-credit', cardsCreditRouter);
router.use('/kyc-verification', societyKycVerificationRouter);
router.use('/merchant', societyMerchantRouter);
router.use('/merchants', societyMerchantRouter);

export default router;
