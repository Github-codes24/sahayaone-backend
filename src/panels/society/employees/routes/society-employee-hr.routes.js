import { Router } from 'express';
import { societyEmployeeHrController } from '../controllers/society-employee-hr.controller.js';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { requireBankOwner, requireHrOrBankOwnerOrManager } from '../../middlewares/society-context.middleware.js';
import { uploadSingleImage } from '../../../../middlewares/upload.middleware.js';
import {
  createDailyWorkReportSchema,
  queryDailyWorkReportSchema,
  offerLetterSchema,
  confirmationLetterSchema,
  performanceLetterSchema,
  promotionLetterSchema,
  transferLetterSchema,
  salarySlipSchema,
  salaryIncrementSchema,
  queryKpaReportSchema,
  queryKpaDetailSchema,
  createKpaTargetSchema,
  updateKpaTargetSchema,
  upsertProductIncentiveSchema,
  queryImportantDatesSchema,
  queryEmployeeBreakdownSchema,
  terminationLetterSchema,
  queryLetterHistorySchema,
  sendLetterEmailSchema
} from '../validators/society-employee-hr.validator.js';

const router = Router();

// Employee Breakdown Statistics & List
router.get(
  '/breakdown',
  validateRequest(queryEmployeeBreakdownSchema, 'query'),
  societyEmployeeHrController.getEmployeeBreakdown
);

router.get(
  '/employee-breakdown',
  validateRequest(queryEmployeeBreakdownSchema, 'query'),
  societyEmployeeHrController.getEmployeeBreakdown
);

// Daily Work Report
router.post(
  '/work-reports',
  validateRequest(createDailyWorkReportSchema),
  societyEmployeeHrController.createDailyWorkReport
);

router.get(
  '/work-reports',
  validateRequest(queryDailyWorkReportSchema, 'query'),
  societyEmployeeHrController.listDailyWorkReports
);

router.get(
  '/work-reports/export',
  validateRequest(queryDailyWorkReportSchema, 'query'),
  societyEmployeeHrController.exportDailyWorkReports
);

// KPA Reports
router.get(
  '/kpa-reports/export',
  validateRequest(queryKpaReportSchema, 'query'),
  societyEmployeeHrController.exportKpaReports
);

router.get(
  '/kpa-reports',
  validateRequest(queryKpaReportSchema, 'query'),
  societyEmployeeHrController.listKpaReports
);

router.get(
  '/:id/kpa-reports/detail',
  validateRequest(queryKpaDetailSchema, 'query'),
  societyEmployeeHrController.getKpaReportDetail
);

router.post(
  '/kpa-targets',
  validateRequest(createKpaTargetSchema),
  societyEmployeeHrController.addKpaTarget
);

router.post(
  '/:id/kpa-targets',
  validateRequest(createKpaTargetSchema),
  societyEmployeeHrController.addKpaTarget
);

router.put(
  '/kpa-targets',
  validateRequest(updateKpaTargetSchema),
  societyEmployeeHrController.updateKpaTarget
);

router.put(
  '/:id/kpa-targets',
  validateRequest(updateKpaTargetSchema),
  societyEmployeeHrController.updateKpaTarget
);

// Universal Product Incentives
router.get(
  '/product-incentives',
  societyEmployeeHrController.getProductIncentives
);

router.post(
  '/product-incentives',
  validateRequest(upsertProductIncentiveSchema),
  societyEmployeeHrController.upsertProductIncentive
);

router.put(
  '/product-incentives',
  validateRequest(upsertProductIncentiveSchema),
  societyEmployeeHrController.upsertProductIncentive
);

// Important Dates
router.get(
  '/important-dates',
  validateRequest(queryImportantDatesSchema, 'query'),
  societyEmployeeHrController.listImportantDates
);

// PDF Letters & Payroll Document Generation (Bank Owners, Branch Managers & HR)
router.post(
  '/letters/offer',
  requireHrOrBankOwnerOrManager,
  validateRequest(offerLetterSchema),
  societyEmployeeHrController.generateOfferLetter
);

router.post(
  '/letters/confirmation',
  requireHrOrBankOwnerOrManager,
  validateRequest(confirmationLetterSchema),
  societyEmployeeHrController.generateConfirmationLetter
);

router.post(
  '/letters/performance',
  requireHrOrBankOwnerOrManager,
  validateRequest(performanceLetterSchema),
  societyEmployeeHrController.generatePerformanceLetter
);

router.post(
  '/letters/promotion',
  requireHrOrBankOwnerOrManager,
  validateRequest(promotionLetterSchema),
  societyEmployeeHrController.generatePromotionLetter
);

router.post(
  '/letters/transfer',
  requireHrOrBankOwnerOrManager,
  validateRequest(transferLetterSchema),
  societyEmployeeHrController.generateTransferLetter
);

router.post(
  '/letters/salary-slip',
  requireHrOrBankOwnerOrManager,
  validateRequest(salarySlipSchema),
  societyEmployeeHrController.generateSalarySlip
);

router.post(
  '/letters/salary-increment',
  requireHrOrBankOwnerOrManager,
  validateRequest(salaryIncrementSchema),
  societyEmployeeHrController.generateSalaryIncrement
);

router.post(
  '/letters/termination',
  requireHrOrBankOwnerOrManager,
  validateRequest(terminationLetterSchema),
  societyEmployeeHrController.generateTerminationLetter
);

// Employee Letter History Logs
router.get(
  '/letters/history',
  requireHrOrBankOwnerOrManager,
  validateRequest(queryLetterHistorySchema, 'query'),
  societyEmployeeHrController.listLetterHistory
);

router.get(
  '/letter-history',
  requireHrOrBankOwnerOrManager,
  validateRequest(queryLetterHistorySchema, 'query'),
  societyEmployeeHrController.listLetterHistory
);

// Send MSG91 Email Notification for Employee Letters
router.post(
  '/letters/send-email',
  requireHrOrBankOwnerOrManager,
  validateRequest(sendLetterEmailSchema),
  societyEmployeeHrController.sendLetterEmail
);

// Bank Official Signature & Signatory Settings (Bank Owner / HR / Manager)
router.patch(
  '/bank/signature',
  requireHrOrBankOwnerOrManager,
  uploadSingleImage('signature'),
  societyEmployeeHrController.updateBankSignature
);

router.post(
  '/bank/signature',
  requireHrOrBankOwnerOrManager,
  uploadSingleImage('signature'),
  societyEmployeeHrController.updateBankSignature
);

router.get(
  '/bank/signature',
  requireHrOrBankOwnerOrManager,
  societyEmployeeHrController.getBankSignature
);

export default router;
