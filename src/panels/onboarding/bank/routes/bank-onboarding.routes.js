import { Router } from 'express';
import { bankOnboardingController } from '../controllers/bank-onboarding.controller.js';
import { unifiedWebhookController } from '../../../../payments/unified-webhook.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import {
  saveGeneralInfoSchema,
  updateGeneralInfoSchema,
  uploadDocumentsSchema,
  calculatePricingSchema,
  initiatePaymentSchema,
  verifyPaymentSchema,
  createBranchSchema,
  allocateCreditsSchema,
  saveBankAccountSchema,
  saveFeaturesSchema
} from '../validators/bank-onboarding.validator.js';

const router = Router();

// Webhook route - uses Unified Router (signature verified inside handler, supports both Bank Onboarding & Cards/Credit)
router.post('/webhooks/payment', unifiedWebhookController.handleWebhook);

// Mock Checkout page simulator (unauthenticated sandbox UI)
router.get('/mock-checkout/:id', bankOnboardingController.renderMockCheckout);

// Payment callback redirect landing page (unauthenticated)
router.get('/payment-callback', bankOnboardingController.renderPaymentCallback);

// Secure all onboarding endpoints
router.use(rbacMiddleware.requireAuth);

router.get('/banners', bankOnboardingController.getBanners);
router.get('/stats', bankOnboardingController.getDashboardStats);
router.get('/', bankOnboardingController.listBanks);
router.post('/general-info', validateRequest(saveGeneralInfoSchema), bankOnboardingController.saveGeneralInfo);
router.put('/:id', validateRequest(updateGeneralInfoSchema), bankOnboardingController.updateGeneralInfo);
router.post('/:id/documents', validateRequest(uploadDocumentsSchema), bankOnboardingController.uploadDocuments);
router.post('/:id/bank-account', validateRequest(saveBankAccountSchema), bankOnboardingController.saveBankAccount);
router.put('/:id/bank-account', validateRequest(saveBankAccountSchema), bankOnboardingController.saveBankAccount);
router.post('/:id/features', validateRequest(saveFeaturesSchema), bankOnboardingController.saveFeatures);
router.put('/:id/features', validateRequest(saveFeaturesSchema), bankOnboardingController.saveFeatures);
router.post('/:id/pricing', validateRequest(calculatePricingSchema), bankOnboardingController.calculatePricing);
router.post('/:id/payment/initiate', validateRequest(initiatePaymentSchema), bankOnboardingController.initiatePayment);
router.post('/:id/payment/verify', validateRequest(verifyPaymentSchema), bankOnboardingController.verifyPayment);
router.post('/:id/resubmit', bankOnboardingController.resubmitForVerification);
router.get('/:id', bankOnboardingController.getBankDetails);

// Branch and Credit allocation routes
router.post('/:id/branches', validateRequest(createBranchSchema), bankOnboardingController.createBranch);
router.post('/:id/branches/:branchId/allocate', validateRequest(allocateCreditsSchema), bankOnboardingController.allocateCredits);
router.get('/:id/branches', bankOnboardingController.listBranches);
router.get('/:id/credit-logs', bankOnboardingController.getCreditLogs);

export default router;
