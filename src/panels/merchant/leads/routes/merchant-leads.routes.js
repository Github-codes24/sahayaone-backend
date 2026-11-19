import { Router } from 'express';
import multer from 'multer';
import { merchantLeadsController } from '../controllers/merchant-leads.controller.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import {
  sendLookupOtpSchema,
  verifyLookupOtpSchema,
  onboardSchema,
  verifyAadhaarSchema,
  confirmOnboardSchema,
  createLeadSchema,
  listLeadsQuerySchema
} from '../validators/merchant-leads.validator.js';

const router = Router();

import { storageManager } from '../../../../storage/storage.manager.js';

// Multer setup for PAN & Aadhaar document file uploads (multipart/form-data)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
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
  { name: 'signature', maxCount: 1 }
]);

// Middleware: Parse multipart form-data and upload files directly to S3/Cloudinary (same strategy as Super Admin)
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
      } catch (uploadErr) {
        return next(uploadErr);
      }
    }

    next();
  });
};

// Strict Auth: Require Token and ONLY Merchant or Vendor role
router.use(rbacMiddleware.requireAuth);
router.use(rbacMiddleware.requireRoles(['MERCHANT', 'VENDOR']));

// 1. GET ALL LEADS ADDED BY THIS MERCHANT
router.get('/', validateRequest(listLeadsQuerySchema), merchantLeadsController.listLeads);

// 2. SEND PHONE VERIFICATION OTP CODE (LOOKUP)
router.post('/send-lookup-otp', validateRequest(sendLookupOtpSchema), merchantLeadsController.sendLookupOtp);

// 3. SUBMIT PHONE VERIFICATION OTP (LOOKUP)
router.post('/verify-lookup-otp', validateRequest(verifyLookupOtpSchema), merchantLeadsController.verifyLookupOtp);

// 4. INITIATE ONBOARDING (Aadhaar OTP Dispatch) — supports both JSON and multipart/form-data
router.post('/onboard', parseCustomerDocs, validateRequest(onboardSchema), merchantLeadsController.onboardCustomerRequest);

// 5. VERIFY AADHAAR OTP
router.post('/verify-aadhaar', validateRequest(verifyAadhaarSchema), merchantLeadsController.verifyAadhaarOtp);

// 6. CONFIRM ONBOARDING — supports both JSON and multipart/form-data
router.post('/confirm-onboard', parseCustomerDocs, validateRequest(confirmOnboardSchema), merchantLeadsController.confirmOnboard);

// 10. CREATE DRAFT LEAD APPLICATION
router.post('/create', validateRequest(createLeadSchema), merchantLeadsController.createLead);

// 11. GET SINGLE LEAD DETAILS
router.get('/:id', merchantLeadsController.getLeadDetails);

export default router;
