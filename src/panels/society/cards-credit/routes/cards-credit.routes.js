import { Router } from "express";
import { cardsCreditController } from "../controllers/cards-credit.controller.js";
import { unifiedWebhookController } from "../../../../payments/unified-webhook.controller.js";
import { validateRequest } from "../../../../middlewares/request-validator.middleware.js";
import { rbacMiddleware } from "../../../../middlewares/rbac.middleware.js";
import {
  resolveSocietyContext,
  requireBankOwner,
} from "../../middlewares/society-context.middleware.js";
import {
  purchaseSchema,
  transferSchema,
  consumeSchema,
  cardsCreditQuerySchema,
  updateMerchantCreditRequestStatusSchema,
} from "../validators/cards-credit.validator.js";
import {
  calculateEmiCardPriceSchema,
  calculateVerificationCreditPriceSchema,
  calculatePriceSchema,
} from "../../../super-admin/co-operative-bank/validators/co-operative-bank.validator.js";

const router = Router();

// 1. Razorpay Webhook Endpoint (Uses Unified Router for both Bank Onboarding & Cards/Credit)
// router.post("/webhooks/payment", unifiedWebhookController.handleWebhook);
router.post("/payment-webhook", unifiedWebhookController.handleWebhook);

// Apply User Auth, Tenant Resolution & Bank Owner restriction across all remaining endpoints
router.use(rbacMiddleware.requireAuth, resolveSocietyContext, requireBankOwner);

// Price Calculation Endpoints (Reads rates from Settings / PriceSettings database collections)
router.post(
  "/calculate-emi-card-price",
  validateRequest(calculateEmiCardPriceSchema),
  cardsCreditController.calculateEmiCardPrice,
);
router.post(
  "/price/emi-card",
  validateRequest(calculateEmiCardPriceSchema),
  cardsCreditController.calculateEmiCardPrice,
);

router.post(
  "/calculate-verification-credit-price",
  validateRequest(calculateVerificationCreditPriceSchema),
  cardsCreditController.calculateVerificationCreditPrice,
);
router.post(
  "/price/verification-credit",
  validateRequest(calculateVerificationCreditPriceSchema),
  cardsCreditController.calculateVerificationCreditPrice,
);

router.post(
  "/calculate-price",
  validateRequest(calculatePriceSchema),
  cardsCreditController.calculatePrice,
);
router.post(
  "/price/calculate",
  validateRequest(calculatePriceSchema),
  cardsCreditController.calculatePrice,
);

// 2. Initiate Purchase & Payment Verification (Matching bank-onboarding payment process)
router.post(
  "/purchase",
  validateRequest(purchaseSchema),
  cardsCreditController.purchase,
);
router.post(
  "/payment/initiate",
  validateRequest(purchaseSchema),
  cardsCreditController.purchase,
);
router.post("/payment/verify", cardsCreditController.verifyPayment);

// 3. Payment Status Check
router.get("/payment-status/:orderId", cardsCreditController.getPaymentStatus);

// 4. Bank Dashboard Summary
router.get("/dashboard", cardsCreditController.getDashboard);

// 5. Overall History
router.get(
  "/history",
  validateRequest(cardsCreditQuerySchema, "query"),
  cardsCreditController.getHistory,
);

// 6. Transfer Stock to Branch (Bank Owner Only)
router.post(
  "/transfer",
  validateRequest(transferSchema),
  cardsCreditController.transfer,
);

// 7. Transfer History List
router.get(
  "/transfer-history",
  validateRequest(cardsCreditQuerySchema, "query"),
  cardsCreditController.getTransferHistory,
);

// 8. Purchase History List
router.get(
  "/purchase-history",
  validateRequest(cardsCreditQuerySchema, "query"),
  cardsCreditController.getPurchaseHistory,
);

// 9. Branch Wallet Details
router.get("/branch-wallet/:branchId", cardsCreditController.getBranchWallet);

// 10. Consume Credit / Stock
router.post(
  "/consume",
  validateRequest(consumeSchema),
  cardsCreditController.consume,
);

// 11. Merchant Credit Requests for Society Panel
router.get(
  "/merchant-requests",
  validateRequest(cardsCreditQuerySchema, "query"),
  cardsCreditController.getMerchantCreditRequests,
);

router.patch(
  "/merchant-requests/:id/status",
  validateRequest(updateMerchantCreditRequestStatusSchema),
  cardsCreditController.updateMerchantCreditRequestStatus,
);

export default router;
