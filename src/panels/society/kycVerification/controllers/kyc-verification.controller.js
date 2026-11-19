import { BaseController } from '../../../../common/base.controller.js';
import { kycVerificationService } from '../services/kyc-verification.service.js';
import { kycPdfService } from '../services/kyc-pdf.service.js';
import { ApiError } from '../../../../common/api.error.js';

export class KycVerificationController extends BaseController {
  constructor() {
    super();
    for (const method of ['initiate', 'complete', 'getReport', 'downloadPdfDocument', 'getHistory']) {
      this[method] = this[method].bind(this);
    }
  }

  /**
   * Helper to resolve userId from various request contexts (auth middleware and context middleware).
   */
  _resolveUserId(req) {
    return req.society?.userId || req.user?.id || req.user?.userId || null;
  }

  /**
   * GET /history
   */
  async getHistory(req, res, next) {
    try {
      console.log('\n[KYC Controller] GET /api/v1/society/kyc-verification/history');
      console.log('[KYC Controller] Query Params:', JSON.stringify(req.query));
      const societyId = req.society?.bankId || null;
      const result = await kycVerificationService.getHistory({
        societyId,
        query: req.query
      });
      return this.sendResponse(res, 200, result, 'KYC verification history retrieved successfully.');
    } catch (error) {
      console.error('[KYC Controller Error] getHistory failed:', error.message);
      next(error);
    }
  }

  /**
   * POST /initiate
   */
  async initiate(req, res, next) {
    try {
      console.log('\n[KYC Controller] POST /api/v1/society/kyc-verification/initiate');
      console.log('[KYC Controller] Request Body:', JSON.stringify(req.body, null, 2));
      const userId = this._resolveUserId(req);
      const societyId = req.society?.bankId || null;
      const requestById = req.user?.id || req.user?.userId || null;

      if (!societyId) {
        throw ApiError.forbidden('No Society context resolved for this request.');
      }

      if (!requestById) {
        throw ApiError.unauthorized('No authenticated user context found for requestById.');
      }

      const result = await kycVerificationService.initiateSession(
        { ...req.body, requestById },
        userId,
        societyId
      );
      console.log('[KYC Controller] Initiate Response:', JSON.stringify(result, null, 2));
      return this.sendCreated(res, result, 'DigiLocker KYC session initiated successfully.');
    } catch (error) {
      console.error('[KYC Controller Error] initiate failed:', error.message);
      next(error);
    }
  }

  /**
   * POST /complete
   */
  async complete(req, res, next) {
    try {
      console.log('\n[KYC Controller] POST /api/v1/society/kyc-verification/complete');
      console.log('[KYC Controller] Request Body:', JSON.stringify(req.body, null, 2));
      const userId = this._resolveUserId(req);
      const result = await kycVerificationService.completeVerification(req.body.refid, userId);
      console.log('[KYC Controller] Complete Response:', JSON.stringify(result, null, 2));
      return this.sendResponse(res, 200, result, 'DigiLocker KYC verification completed successfully.');
    } catch (error) {
      console.error('[KYC Controller Error] complete failed:', error.message);
      next(error);
    }
  }

  /**
   * GET /report/:refid
   */
  async getReport(req, res, next) {
    try {
      console.log(`\n[KYC Controller] GET /api/v1/society/kyc-verification/report/${req.params.refid}`);
      const userId = this._resolveUserId(req);
      const result = await kycVerificationService.getReportByRefId(req.params.refid, userId);
      console.log('[KYC Controller] Report Response status:', result?.status);
      return this.sendResponse(res, 200, result, 'KYC verification report retrieved successfully.');
    } catch (error) {
      console.error('[KYC Controller Error] getReport failed:', error.message);
      next(error);
    }
  }

  /**
   * GET /report/:refid/download-pdf/:documentType
   */
  async downloadPdfDocument(req, res, next) {
    try {
      const { refid, documentType } = req.params;
      console.log(`\n[KYC Controller] GET /api/v1/society/kyc-verification/report/${refid}/download-pdf/${documentType}`);
      const userId = this._resolveUserId(req);

      const record = await kycVerificationService.getReportByRefId(refid, userId);

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
      console.error('[KYC Controller Error] downloadPdfDocument failed:', error.message);
      next(error);
    }
  }
}

export const kycVerificationController = new KycVerificationController();

