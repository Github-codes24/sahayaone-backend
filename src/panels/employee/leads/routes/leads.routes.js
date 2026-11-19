import { Router } from 'express';
import { leadsController } from '../controllers/leads.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import {
  onboardSchema,
  verifyAadhaarSchema,
  confirmOnboardSchema,
  createLeadSchema,
  sendLookupOtpSchema,
  verifyLookupOtpSchema,
  digiLockerKycAndCibilCheckSchema,
  submitCustomerOnboardingSchema,
  productDetailsSchema,
  emiSlabsSchema,
  calculateLoanSchema
} from '../validators/leads.validator.js';

const router = Router();

// Public Webview Route for Razorpay e-NACH Mandate Authorization (No Bearer Token required for browser/webview)
router.get('/mandate-checkout', leadsController.renderMandateCheckoutPage);

// Secure all executive leads endpoints with Employee authentication
router.use(rbacMiddleware.requireAuth);

// Roles allowed to view leads list and lead details (Loan Executives, Branch Staff, Branch Managers, Bank Admins, Bank Owners)
const allowedLeadViewing = rbacMiddleware.requireRoles([
  'EMPLOYEE',
  'LOAN_EXECUTIVE',
  'COLLECTION_EXECUTIVE',
  'SUPER_ADMIN',
  'BRANCH_MANAGER',
  'BRANCH_STAFF',
  'SOCIETY_ADMIN',
  'BANK_ADMIN',
  'BANK_OWNER',
  'BANK_HEAD',
  'HEAD',
  'AUTHORIZED_PERSON',
  'BANK_AUTHORIZED_PERSON',
  'ADMIN',
  'OWNER',
  'CHAIRMAN',
  'DIRECTOR',
  'CREDIT_MANAGER',
  'RISK_MANAGER',
  'MANAGER',
  'HO_ADMIN',
  'REGIONAL_MANAGER',
  'ONBOARDING_TEAM',
  'QUALITY_CHECK',
  'QC'
]);

// Roles allowed to onboard customers, approve/reject, and create leads
const allowedLeadCreation = rbacMiddleware.requireRoles([
  'EMPLOYEE',
  'LOAN_EXECUTIVE',
  'SUPER_ADMIN',
  'BRANCH_MANAGER',
  'BRANCH_STAFF',
  'SOCIETY_ADMIN',
  'BANK_ADMIN',
  'BANK_OWNER',
  'BANK_HEAD',
  'HEAD',
  'AUTHORIZED_PERSON',
  'BANK_AUTHORIZED_PERSON',
  'ADMIN',
  'OWNER',
  'CHAIRMAN',
  'DIRECTOR',
  'CREDIT_MANAGER',
  'RISK_MANAGER',
  'MANAGER',
  'HO_ADMIN',
  'REGIONAL_MANAGER',
  'ONBOARDING_TEAM',
  'QUALITY_CHECK',
  'QC'
]);

// 1. Leads Listing
router.get('/', allowedLeadViewing, leadsController.listLeads);

// 1.1 Onboarding & Executive Banners Endpoint (supports ?bannerType=Top Slider&portalType=...)
router.get('/banners', allowedLeadViewing, leadsController.getBanners);

// 2. Customer Lookup & DigiLocker Onboarding Endpoints
router.post('/send-lookup-otp', allowedLeadCreation, validateRequest(sendLookupOtpSchema), leadsController.sendLookupOtp);
router.post('/verify-lookup-otp', allowedLeadCreation, validateRequest(verifyLookupOtpSchema), leadsController.verifyLookupOtp);



import multer from 'multer';
import { storageManager } from '../../../../storage/storage.manager.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf', 'application/octet-stream'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WEBP, and PDF document files are supported.'), false);
    }
  }
});

const customerDocUpload = upload.fields([
  { name: 'panImage', maxCount: 1 },
  { name: 'panCardUrl', maxCount: 1 },
  { name: 'panCardImage', maxCount: 1 },
  { name: 'pan', maxCount: 1 },
  { name: 'aadhaarImage', maxCount: 1 },
  { name: 'aadhaarCardUrl', maxCount: 1 },
  { name: 'aadhaarCardImage', maxCount: 1 },
  { name: 'aadhaar', maxCount: 1 },
  { name: 'signatureImage', maxCount: 1 },
  { name: 'digitalSignature', maxCount: 1 },
  { name: 'signature', maxCount: 1 },
  { name: 'livePhoto', maxCount: 1 },
  { name: 'photo', maxCount: 1 },
  { name: 'productPhoto', maxCount: 1 },
  { name: 'image', maxCount: 1 },
  { name: 'imeiPhoto', maxCount: 1 },
  { name: 'imeiBarcodePhoto', maxCount: 1 },
  { name: 'barcodePhoto', maxCount: 1 }
]);

const parseCustomerDocs = (req, res, next) => {
  customerDocUpload(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return next(new Error(`File upload error: ${err.message}`));
      }
      return next(err);
    }

    if (req.files) {
      try {
        const panFile = (req.files.panImage && req.files.panImage[0]) ||
                       (req.files.panCardUrl && req.files.panCardUrl[0]) ||
                       (req.files.panCardImage && req.files.panCardImage[0]) ||
                       (req.files.pan && req.files.pan[0]);

        const aadhaarFile = (req.files.aadhaarImage && req.files.aadhaarImage[0]) ||
                           (req.files.aadhaarCardUrl && req.files.aadhaarCardUrl[0]) ||
                           (req.files.aadhaarCardImage && req.files.aadhaarCardImage[0]) ||
                           (req.files.aadhaar && req.files.aadhaar[0]);

        const sigFile = (req.files.signatureImage && req.files.signatureImage[0]) ||
                        (req.files.digitalSignature && req.files.digitalSignature[0]) ||
                        (req.files.signature && req.files.signature[0]);

        const livePhotoFile = (req.files.livePhoto && req.files.livePhoto[0]) ||
                             (req.files.photo && req.files.photo[0]);

        const productPhotoFile = (req.files.productPhoto && req.files.productPhoto[0]) ||
                                 (req.files.image && req.files.image[0]);

        const imeiPhotoFile = (req.files.imeiPhoto && req.files.imeiPhoto[0]) ||
                              (req.files.imeiBarcodePhoto && req.files.imeiBarcodePhoto[0]) ||
                              (req.files.barcodePhoto && req.files.barcodePhoto[0]);

        if (panFile) {
          const uploadRes = await storageManager.uploadFile(panFile, 'customers');
          req.body.panImage = uploadRes.fileUrl || uploadRes.url;
        }

        if (aadhaarFile) {
          const uploadRes = await storageManager.uploadFile(aadhaarFile, 'customers');
          req.body.aadhaarImage = uploadRes.fileUrl || uploadRes.url;
        }

        if (sigFile) {
          const uploadRes = await storageManager.uploadFile(sigFile, 'customers');
          req.body.signatureImage = uploadRes.fileUrl || uploadRes.url;
        }

        if (livePhotoFile) {
          const uploadRes = await storageManager.uploadFile(livePhotoFile, 'customers');
          req.body.livePhoto = uploadRes.fileUrl || uploadRes.url;
        }

        if (productPhotoFile) {
          const uploadRes = await storageManager.uploadFile(productPhotoFile, 'products');
          req.body.productPhoto = uploadRes.fileUrl || uploadRes.url;
        }

        if (imeiPhotoFile) {
          const uploadRes = await storageManager.uploadFile(imeiPhotoFile, 'products');
          req.body.imeiPhoto = uploadRes.fileUrl || uploadRes.url;
        }
      } catch (uploadErr) {
        return next(uploadErr);
      }
    }

    next();
  });
};

// 3. Executive 3-Step Customer Onboarding Endpoints
router.post('/digilocker-kyc-cibil-check', allowedLeadCreation, validateRequest(digiLockerKycAndCibilCheckSchema), leadsController.digiLockerKycAndCibilCheck);
router.post('/submit-customer-onboarding', allowedLeadCreation, parseCustomerDocs, validateRequest(submitCustomerOnboardingSchema), leadsController.submitCustomerOnboarding);

// 4. Legacy Onboarding Steps
router.post('/onboard', allowedLeadCreation, parseCustomerDocs, validateRequest(onboardSchema), leadsController.onboardCustomerRequest);
router.post('/verify-aadhaar', allowedLeadCreation, validateRequest(verifyAadhaarSchema), leadsController.verifyAadhaarOtp);
router.post('/confirm-onboard', allowedLeadCreation, parseCustomerDocs, validateRequest(confirmOnboardSchema), leadsController.confirmOnboard);

// 5. DigiLocker KYC & CIBIL Direct Endpoints
router.post('/digilocker/initiate', allowedLeadCreation, leadsController.initiateDigiLockerKyc);
router.post('/digilocker/verify', allowedLeadCreation, leadsController.verifyDigiLockerKyc);
router.post('/cibil/check', allowedLeadCreation, leadsController.checkCibilScore);

// 6. Screen 1: New Loan Flow - Eligible Merchants & Product Selection
router.get('/eligible-merchants', allowedLeadCreation, leadsController.getEligibleMerchants);
router.post('/product-details', allowedLeadCreation, parseCustomerDocs, validateRequest(productDetailsSchema), leadsController.submitProductDetails);

// 7. Screen 2: New Loan Flow - EMI Slabs & Loan Calculation (Supports BOTH GET and POST methods)
router.get('/emi-slabs', allowedLeadCreation, leadsController.getEmiSlabs);
router.post('/emi-slabs', allowedLeadCreation, validateRequest(emiSlabsSchema), leadsController.getEmiSlabs);
router.get('/slabs', allowedLeadCreation, leadsController.getEmiSlabs);
router.post('/slabs', allowedLeadCreation, validateRequest(emiSlabsSchema), leadsController.getEmiSlabs);

router.get('/calculate-loan', allowedLeadCreation, leadsController.calculateLoanDetails);
router.post('/calculate-loan', allowedLeadCreation, validateRequest(calculateLoanSchema), leadsController.calculateLoanDetails);
router.get('/calculate', allowedLeadCreation, leadsController.calculateLoanDetails);
router.post('/calculate', allowedLeadCreation, validateRequest(calculateLoanSchema), leadsController.calculateLoanDetails);

// 7. Legacy Lead Creation Action
router.post('/create', allowedLeadCreation, validateRequest(createLeadSchema), leadsController.createLead);

// 8. Screen 3: Bank Details, Razorpay e-NACH Mandate & Draft Recovery Endpoints
router.post('/initiate-mandate', allowedLeadCreation, leadsController.initiateMandate);
router.post('/verify-mandate', allowedLeadCreation, leadsController.verifyMandate);
router.post('/submit-application', allowedLeadCreation, parseCustomerDocs, leadsController.submitLoanApplicationWithMandate);
router.get('/resume-draft/:identifier', allowedLeadCreation, leadsController.resumeDraftLead);
router.get('/status/resume-draft/:identifier', allowedLeadCreation, leadsController.resumeDraftLead);
router.get('/status/:id', allowedLeadViewing, leadsController.getLeadStatus);

// 9. Post-Approval Aadhaar e-Sign Endpoints
router.post('/initiate-esign', allowedLeadCreation, leadsController.initiateAadhaarEsign);
router.post('/status/initiate-esign', allowedLeadCreation, leadsController.initiateAadhaarEsign);
router.post('/verify-esign', allowedLeadCreation, leadsController.verifyAadhaarEsign);
router.post('/status/verify-esign', allowedLeadCreation, leadsController.verifyAadhaarEsign);

// 10. Branch Lead Systems (Customer System & Merchant System) Endpoints
router.get('/customer-system', allowedLeadViewing, leadsController.listCustomerSystemLeads);
router.get('/merchant-system', allowedLeadViewing, leadsController.listMerchantSystemLeads);
router.get('/branch-settlements', allowedLeadViewing, leadsController.listBranchSettlementLeads);

// 11. Branch Action Endpoints (Manual Approve, Manual Reject, Merchant Settlement)
router.post('/:id/approve', allowedLeadCreation, leadsController.approveCustomerLead);
router.post('/:id/reject', allowedLeadCreation, leadsController.rejectCustomerLead);
router.post('/:id/settle-merchant', allowedLeadCreation, leadsController.settleMerchantLoan);

// 12. Lead Details by ID (Must be declared after all static endpoints)
router.get('/:id', allowedLeadViewing, leadsController.getLeadDetails);

export default router;
