import { BaseController } from '../../../../common/base.controller.js';
import { merchantKycVerificationService } from '../services/merchant-kyc-verification.service.js';
import { kycPdfService } from '../../../society/kycVerification/services/kyc-pdf.service.js';
import { ApiError } from '../../../../common/api.error.js';

export class MerchantKycVerificationController extends BaseController {
  constructor() {
    super();
    for (const method of ['initiate', 'complete', 'getReport', 'downloadPdfDocument', 'getHistory']) {
      this[method] = this[method].bind(this);
    }
  }

  /**
   * POST /api/v1/merchant/kyc-verification/initiate
   */
  async initiate(req, res, next) {
    try {
      const result = await merchantKycVerificationService.initiateSession(req.body, req.user);
      return this.sendCreated(res, result, 'DigiLocker KYC session initiated successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/merchant/kyc-verification/complete
   */
  async complete(req, res, next) {
    try {
      const result = await merchantKycVerificationService.completeVerification(req.body.refid, req.user);
      return this.sendResponse(res, 200, result, 'DigiLocker KYC verification completed successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/merchant/kyc-verification/history
   */
  async getHistory(req, res, next) {
    try {
      const result = await merchantKycVerificationService.getHistory(req.user, req.query);
      return this.sendResponse(res, 200, result, 'KYC verification history retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/merchant/kyc-verification/report/:refid
   */
  async getReport(req, res, next) {
    try {
      const result = await merchantKycVerificationService.getReportByRefId(req.params.refid);
      return this.sendResponse(res, 200, result, 'KYC verification report retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/merchant/kyc-verification/report/:refid/download-pdf/:documentType
   */
  async downloadPdfDocument(req, res, next) {
    try {
      const { refid, documentType } = req.params;
      const record = await merchantKycVerificationService.getReportByRefId(refid);

      if (record.status !== 'VERIFIED') {
        throw ApiError.badRequest('PDF report can only be generated for successfully verified sessions.');
      }

      const normalizedDocType = String(documentType).toUpperCase();
      const details = record.personalDetails || {};
      const hasDoc = normalizedDocType === 'AADHAAR' ? details.aadhaarVerified : details.panVerified;

      if (!hasDoc) {
        throw ApiError.notFound(`Verified details for ${normalizedDocType} are not available in this session.`);
      }

      const doc = await kycPdfService.generateVerificationPdf(record, normalizedDocType);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="kyc_verification_${refid}.pdf"`);
      return doc.pipe(res);
    } catch (error) {
      next(error);
    }
  }
}

export const merchantKycVerificationController = new MerchantKycVerificationController();
