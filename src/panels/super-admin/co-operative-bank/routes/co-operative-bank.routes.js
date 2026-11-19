import { Router } from 'express';
import { cooperativeBankController } from '../controllers/co-operative-bank.controller.js';
import { unifiedWebhookController } from '../../../../payments/unified-webhook.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { uploadBankDocuments } from '../../../../middlewares/upload.middleware.js';
import {
  listCooperativeBanksSchema,
  getCooperativeBankSchema,
  createCooperativeBankSchema,
  updateCooperativeBankSchema,
  addCreditSchema,
  updateStatusSchema,
  verifyCashOtpSchema,
  resendCashOtpSchema,
  verifyOnlinePaymentSchema,
  calculateEmiCardPriceSchema,
  calculateVerificationCreditPriceSchema,
  calculatePriceSchema,
  changeBankPasswordSchema
} from '../validators/co-operative-bank.validator.js';

const router = Router();

// 1. Razorpay Webhook Endpoint (Uses Unified Router for both Bank Onboarding, Cards/Credit & Co-operative Bank)
router.post('/payment-webhook', unifiedWebhookController.handleWebhook);
router.post('/webhooks/payment', unifiedWebhookController.handleWebhook);

// Authentication middleware
router.use(rbacMiddleware.requireAuth);

// Price Calculation Endpoints (Reads rates from Settings / PriceSettings database collections - Accessible across Super Admin and Society Panels)
router.post(
  '/calculate-emi-card-price',
  validateRequest(calculateEmiCardPriceSchema),
  cooperativeBankController.calculateEmiCardPrice
);
router.post(
  '/price/emi-card',
  validateRequest(calculateEmiCardPriceSchema),
  cooperativeBankController.calculateEmiCardPrice
);

router.post(
  '/calculate-verification-credit-price',
  validateRequest(calculateVerificationCreditPriceSchema),
  cooperativeBankController.calculateVerificationCreditPrice
);
router.post(
  '/price/verification-credit',
  validateRequest(calculateVerificationCreditPriceSchema),
  cooperativeBankController.calculateVerificationCreditPrice
);

router.post(
  '/calculate-price',
  validateRequest(calculatePriceSchema),
  cooperativeBankController.calculatePrice
);
router.post(
  '/price/calculate',
  validateRequest(calculatePriceSchema),
  cooperativeBankController.calculatePrice
);

// Role authorization middleware for super-admin management routes
router.use(rbacMiddleware.requireRoles(['SUPER_ADMIN', 'SUB_ADMIN', 'HO_ADMIN', 'EMPLOYEE']));

// Active Co-operative Banks dropdown list
router.get(
  '/dropdown',
  rbacMiddleware.requirePermission('co_operative_bank:view_only'),
  cooperativeBankController.dropdown
);

// Get overview stats for Co-operative Bank summary cards
router.get(
  '/stats',
  rbacMiddleware.requirePermission('co_operative_bank:view_only'),
  cooperativeBankController.stats
);


// List Co-operative Banks (with search, status filtering, and pagination)
router.get(
  '/',
  rbacMiddleware.requirePermission('co_operative_bank:view_only'),
  validateRequest(listCooperativeBanksSchema),
  cooperativeBankController.list
);

// Verify Cash Payment OTP (dispatched via MSG91)
router.post(
  '/verify-cash-otp',
  validateRequest(verifyCashOtpSchema),
  cooperativeBankController.verifyCashOtp
);

router.post(
  '/:id/verify-cash-otp',
  validateRequest(verifyCashOtpSchema),
  cooperativeBankController.verifyCashOtp
);

// Resend Cash Payment OTP via MSG91
router.post(
  '/resend-cash-otp',
  validateRequest(resendCashOtpSchema),
  cooperativeBankController.resendCashOtp
);

router.post(
  '/:id/resend-cash-otp',
  validateRequest(resendCashOtpSchema),
  cooperativeBankController.resendCashOtp
);

// Verify Online Payment (Razorpay confirmation)
router.post(
  '/verify-online-payment',
  validateRequest(verifyOnlinePaymentSchema),
  cooperativeBankController.verifyOnlinePayment
);

router.post(
  '/:id/verify-online-payment',
  validateRequest(verifyOnlinePaymentSchema),
  cooperativeBankController.verifyOnlinePayment
);

// Add Credit to Bank (+ Add Credit button on View page)
router.post(
  '/:id/add-credit',
  rbacMiddleware.requirePermission('co_operative_bank:edit'),
  validateRequest(addCreditSchema),
  cooperativeBankController.addCredit
);

router.put(
  '/:id/add-credit',
  rbacMiddleware.requirePermission('co_operative_bank:edit'),
  validateRequest(addCreditSchema),
  cooperativeBankController.addCredit
);

// Get single Co-operative Bank details (with General Info, Pricing/Credits breakdown & Uploaded Documents)
router.get(
  '/:id',
  rbacMiddleware.requirePermission('co_operative_bank:view_only'),
  validateRequest(getCooperativeBankSchema),
  cooperativeBankController.getById
);

// Create new Co-operative Bank (supports document file uploads: logo, regCert, pan, boardResolution, gst, directorKyc)
router.post(
  '/',
  rbacMiddleware.requirePermission('co_operative_bank:create'),
  uploadBankDocuments,
  validateRequest(createCooperativeBankSchema),
  cooperativeBankController.create
);

// Update existing Co-operative Bank (supports document file uploads via PUT or PATCH)
router.put(
  '/:id',
  rbacMiddleware.requirePermission('co_operative_bank:edit'),
  uploadBankDocuments,
  validateRequest(updateCooperativeBankSchema),
  cooperativeBankController.update
);

router.patch(
  '/:id',
  rbacMiddleware.requirePermission('co_operative_bank:edit'),
  uploadBankDocuments,
  validateRequest(updateCooperativeBankSchema),
  cooperativeBankController.update
);

// Change password for Co-operative Bank (PATCH method only)
router.patch(
  '/:id/change-password',
  rbacMiddleware.requirePermission('co_operative_bank:edit'),
  validateRequest(changeBankPasswordSchema),
  cooperativeBankController.changePassword
);

router.patch(
  '/change-password',
  rbacMiddleware.requirePermission('co_operative_bank:edit'),
  validateRequest(changeBankPasswordSchema),
  cooperativeBankController.changePassword
);

// Soft delete Co-operative Bank (or Permanent delete if ?permanent=true)
router.delete(
  '/:id',
  rbacMiddleware.requirePermission('co_operative_bank:delete'),
  validateRequest(getCooperativeBankSchema),
  cooperativeBankController.delete
);

// Permanent / Hard delete Co-operative Bank
router.delete(
  '/:id/permanent',
  rbacMiddleware.requirePermission('co_operative_bank:delete'),
  validateRequest(getCooperativeBankSchema),
  cooperativeBankController.permanentDelete
);

router.delete(
  '/:id/hard-delete',
  rbacMiddleware.requirePermission('co_operative_bank:delete'),
  validateRequest(getCooperativeBankSchema),
  cooperativeBankController.permanentDelete
);

// Update status of Co-operative Bank (Approve / Reject)
router.patch(
  '/:id/status',
  rbacMiddleware.requirePermission('co_operative_bank:edit'),
  validateRequest(updateStatusSchema),
  cooperativeBankController.updateStatus
);

export default router;


