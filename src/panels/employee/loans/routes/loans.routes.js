import { Router } from 'express';
import { employeeLoansController } from '../controllers/loans.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { setupEmiSchema, initiateEmiCollectionSchema, verifyEmiCollectionSchema, calculateEmiSchema, bankAccountSchema, getEligibleSlabsSchema, initiateDownPaymentSchema, verifyDownPaymentSchema } from '../validators/loans.validator.js';

const router = Router();

// Unauthenticated webhook endpoint
router.post('/webhooks/payment', employeeLoansController.handlePaymentWebhook);

// Secure all active loan endpoints (Merchants CANNOT provide loans or setup EMIs)
router.use(rbacMiddleware.requireAuth);

const allowedAll = rbacMiddleware.requireRoles(['EMPLOYEE', 'LOAN_EXECUTIVE', 'COLLECTION_EXECUTIVE', 'SUPER_ADMIN', 'BRANCH_MANAGER', 'SOCIETY_ADMIN', 'BANK_OWNER']);
const allowedFull = rbacMiddleware.requireRoles(['EMPLOYEE', 'LOAN_EXECUTIVE', 'SUPER_ADMIN', 'BRANCH_MANAGER', 'SOCIETY_ADMIN', 'BANK_OWNER']);

router.get('/', allowedAll, employeeLoansController.listLoans);
router.get('/slabs', allowedFull, employeeLoansController.getEligibleSlabs);
router.post('/slabs', allowedFull, employeeLoansController.getEligibleSlabs);
router.get('/calculate', allowedFull, employeeLoansController.calculateEmi);
router.post('/calculate', allowedFull, employeeLoansController.calculateEmi);
router.post('/:id/send-disbursal-otp', allowedFull, employeeLoansController.sendDisbursalOtp);
router.post('/:id/setup-emi', allowedFull, validateRequest(setupEmiSchema), employeeLoansController.setupEmi);
router.post('/:id/bank-account', allowedFull, validateRequest(bankAccountSchema), employeeLoansController.addBankAccount);
router.post('/:id/payment/initiate', allowedFull, validateRequest(initiateDownPaymentSchema), employeeLoansController.initiateDownPayment);
router.post('/:id/payment/verify', allowedFull, validateRequest(verifyDownPaymentSchema), employeeLoansController.verifyDownPayment);
router.get('/:id/documents/agreement', allowedFull, employeeLoansController.getAgreement);
router.get('/:id/documents/account-form', allowedFull, employeeLoansController.getAccountForm);
router.get('/:id/documents/membership-form', allowedFull, employeeLoansController.getMembershipForm);
router.get('/:id/collect-emi/schedule', allowedAll, employeeLoansController.getEmiCollectionSchedule);
router.get('/:id', allowedAll, employeeLoansController.getLoanDetails);
router.get('/:id/emi-card', allowedAll, employeeLoansController.getEmiCardDetails);
router.post('/:id/collect-emi/initiate', allowedAll, validateRequest(initiateEmiCollectionSchema), employeeLoansController.initiateEmiCollection);
router.post('/:id/collect-emi/verify', allowedAll, validateRequest(verifyEmiCollectionSchema), employeeLoansController.verifyEmiCollection);

export default router;
