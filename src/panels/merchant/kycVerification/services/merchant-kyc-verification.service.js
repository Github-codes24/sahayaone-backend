import { KycVerificationModel } from '../../../society/kycVerification/models/kyc-verification.model.js';
import {
  initiateDigiLockerSessionApi,
  generateAccessTokenApi,
  fetchIssuedFilesApi,
  downloadXmlDocumentApi,
  extractAccessToken,
  extractIssuedFiles,
  extractXmlData
} from '../../../society/kycVerification/utils/digilocker-client.util.js';
import {
  decodeBase64Xml,
  encodeXmlToBase64,
  parseAadhaarXml,
  parsePanXml
} from '../../../society/kycVerification/utils/xml-parser.util.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';
import { logger } from '../../../../utils/logger.util.js';
import { User } from '../../../../models/user.model.js';
import { MerchantProfile } from '../../../../models/merchant-profile.model.js';
import { Branch } from '../../../../models/branch.model.js';
import { CreditLog } from '../../../../models/credit-log.model.js';
import { CardCreditUsage } from '../../../../models/card-credit-usage.model.js';

const AADHAAR_DOCTYPES = ['AADHAAR', 'ADHAR'];
const PAN_DOCTYPES = ['PAN', 'PANCR'];

const maskId = (documentType, value) => {
  if (!value) return value;
  const v = String(value).trim();
  if (documentType === 'AADHAAR') {
    return v.length > 8 ? `${v.slice(0, 4)}XXXXXXXX` : 'XXXXXXXXXXXX';
  }
  return v.length > 4 ? `${v.slice(0, 2)}XXXXXX${v.slice(-2)}` : 'XXXXXXXXXX';
};

const getAuthorizationUrl = (res) => {
  const d = res?.data;
  if (typeof d === 'string') return d.startsWith('http') ? d : null;
  if (d && typeof d === 'object') {
    return d.authorization_url || d.authorizationUrl || d.auth_url || d.authUrl || d.url || null;
  }
  return null;
};

export class MerchantKycVerificationService {
  /**
   * Helper to resolve merchant profile and branch context
   */
  async getMerchantContext(merchantUser) {
    const userId = merchantUser?.id || merchantUser?._id || merchantUser?.userId;
    let merchant = null;
    if (merchantUser?.merchantId) {
      merchant = await MerchantProfile.findById(merchantUser.merchantId);
    }
    if (!merchant && userId) {
      merchant = await MerchantProfile.findOne({ userId, isDeleted: { $ne: true } });
    }
    const bankId = merchant?.bankId || merchantUser?.bankId || null;
    const branchId = merchant?.branchId || merchantUser?.branchId || null;

    let branch = null;
    if (branchId) {
      branch = await Branch.findById(branchId);
    }

    return { userId, merchant, bankId, branchId, branch };
  }

  /**
   * Initiate DigiLocker Session for Merchant
   */
  async initiateSession(data, merchantUser) {
    const { documentType, idNumber, redirectUrl, consent = true } = data;
    const { userId, merchant, bankId, branchId, branch } = await this.getMerchantContext(merchantUser);

    if (!userId) {
      throw ApiError.unauthorized('Merchant user identity missing.');
    }

    if (!bankId) {
      throw ApiError.forbidden('No associated Bank/Society context found for this merchant.');
    }

    // Credit Check: Ensure assigned branch has available verification credits
    if (branch) {
      const availCredits = branch.availableVerificationCredits ?? branch.verificationCredits ?? 0;
      if (availCredits <= 0) {
        throw ApiError.badRequest('No verification credits available in assigned branch. Please request credits from associated Bank/Society.');
      }
    }

    const normalizedType = String(documentType).toUpperCase();
    const normalizedId = String(idNumber).trim();

    logger.info('[MERCHANT KYC:INITIATE] Starting DigiLocker session for merchant', {
      userId,
      merchantId: merchant?._id,
      bankId,
      branchId,
      documentType: normalizedType
    });

    const refid = `KYC_M_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const apiResponse = await initiateDigiLockerSessionApi(refid, redirectUrl);
    const authorizationUrl = getAuthorizationUrl(apiResponse);

    if (!apiResponse?.success || !authorizationUrl) {
      const errorMsg = apiResponse?.message || 'Failed to initiate DigiLocker session';
      throw ApiError.badRequest(errorMsg, ErrorCode.UNEXPECTED_ERROR, apiResponse?.raw || null);
    }

    const kycRecord = await KycVerificationModel.create({
      createdBy: userId,
      societyId: bankId,
      requestById: userId,
      refid,
      documentType: normalizedType,
      idNumber: normalizedId,
      consent,
      status: 'INITIATED',
      authorizationUrl,
      redirectUrl
    });

    return {
      refid: kycRecord.refid,
      authorizationUrl: kycRecord.authorizationUrl,
      status: kycRecord.status
    };
  }

  /**
   * Complete DigiLocker Verification and Deduct 1 Credit from Branch
   */
  async completeVerification(refid, merchantUser) {
    const { userId, merchant, bankId, branchId, branch } = await this.getMerchantContext(merchantUser);

    const kycRecord = await KycVerificationModel.findOne({ refid });
    if (!kycRecord) {
      throw ApiError.notFound('KYC verification session not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (kycRecord.status === 'VERIFIED') {
      return {
        refid: kycRecord.refid,
        documentType: kycRecord.documentType,
        idNumber: kycRecord.idNumber,
        status: kycRecord.status,
        personalDetails: kycRecord.personalDetails,
        verifiedAt: kycRecord.verifiedAt
      };
    }

    // Verify branch credit balance prior to completing verification
    if (branch) {
      const availCredits = branch.availableVerificationCredits ?? branch.verificationCredits ?? 0;
      if (availCredits <= 0) {
        throw ApiError.badRequest('No verification credits available in branch stock. Please request credits from associated Bank/Society.');
      }
    }

    const tokenRes = await generateAccessTokenApi(refid);
    if (!tokenRes?.success) {
      await this._markFailed(kycRecord, tokenRes?.message || 'Access token generation failed');
      throw ApiError.badRequest(tokenRes?.message || 'Access token generation failed');
    }

    const filesRes = await fetchIssuedFilesApi(refid);
    if (!filesRes?.success) {
      await this._markFailed(kycRecord, filesRes?.message || 'Fetch issued files failed');
      throw ApiError.badRequest(filesRes?.message || 'Fetch issued files failed');
    }

    const issuedFiles = extractIssuedFiles(filesRes);
    const aadhaarDoc = issuedFiles.find(doc => AADHAAR_DOCTYPES.includes(String(doc?.doctype || '').toUpperCase()));
    const panDoc = issuedFiles.find(doc => PAN_DOCTYPES.includes(String(doc?.doctype || '').toUpperCase()));

    let personalDetails = {
      fullName: null,
      gender: null,
      dob: null,
      fatherName: null,
      address: null,
      aadhaarVerified: false,
      panVerified: false,
      aadhaarStatus: aadhaarDoc ? 'VERIFIED' : 'UNAVAILABLE',
      panStatus: panDoc ? 'VERIFIED' : 'UNAVAILABLE',
      aadhaarNumber: null,
      panNumber: null
    };

    let rawXmlBase64 = { aadhaar: null, pan: null };

    if (aadhaarDoc?.uri) {
      try {
        const xmlRes = await downloadXmlDocumentApi(refid, aadhaarDoc.uri);
        const base64Data = extractXmlData(xmlRes);
        if (base64Data) {
          rawXmlBase64.aadhaar = encodeXmlToBase64(base64Data);
          const decoded = decodeBase64Xml(base64Data);
          const parsed = parseAadhaarXml(decoded);
          if (parsed) {
            personalDetails.fullName = parsed.fullName || personalDetails.fullName;
            personalDetails.gender = parsed.gender || personalDetails.gender;
            personalDetails.dob = parsed.dob || personalDetails.dob;
            personalDetails.address = parsed.address || personalDetails.address;
            personalDetails.aadhaarNumber = parsed.aadhaarNumber || personalDetails.aadhaarNumber;
            personalDetails.aadhaarVerified = true;
            personalDetails.aadhaarStatus = 'VERIFIED';
          }
        }
      } catch (err) {
        logger.warn(`MERCHANT KYC: Aadhaar XML download notice: ${err.message}`);
      }
    }

    if (panDoc?.uri) {
      try {
        const xmlRes = await downloadXmlDocumentApi(refid, panDoc.uri);
        const base64Data = extractXmlData(xmlRes);
        if (base64Data) {
          rawXmlBase64.pan = base64Data;
          const decoded = decodeBase64Xml(base64Data);
          const parsed = parsePanXml(decoded);
          if (parsed) {
            personalDetails.fullName = personalDetails.fullName || parsed.fullName;
            personalDetails.panNumber = parsed.panNumber || personalDetails.panNumber;
            personalDetails.panVerified = true;
            personalDetails.panStatus = 'VERIFIED';
          }
        }
      } catch (err) {
        logger.warn(`MERCHANT KYC: PAN XML download notice: ${err.message}`);
      }
    }

    kycRecord.status = 'VERIFIED';
    kycRecord.verifiedAt = new Date();
    kycRecord.personalDetails = personalDetails;
    kycRecord.rawXmlBase64 = rawXmlBase64;
    await kycRecord.save();

    // Deduct 1 credit from Branch upon successful verification
    if (branch) {
      const balanceBefore = branch.availableVerificationCredits ?? branch.verificationCredits ?? 0;
      branch.verificationCredits = Math.max(0, (branch.verificationCredits || 0) - 1);
      branch.availableVerificationCredits = Math.max(0, balanceBefore - 1);
      await branch.save();

      await CreditLog.create({
        bankId: branch.bankId,
        branchId: branch._id,
        type: 'VERIFICATION_CREDIT',
        action: 'DEDUCTION',
        amount: 1,
        merchantId: merchant?._id || null,
        description: `Verification credit deducted for merchant (${merchant?.shopName || 'Merchant'}) DigiLocker KYC: ${personalDetails.fullName || 'Customer'}`
      });

      await CardCreditUsage.create({
        bankId: branch.bankId,
        branchId: branch._id,
        type: 'VERIFICATION_CREDIT',
        quantity: 1,
        balanceBefore,
        balanceAfter: branch.availableVerificationCredits,
        createdBy: userId
      });
    }

    return {
      refid: kycRecord.refid,
      documentType: kycRecord.documentType,
      idNumber: kycRecord.idNumber,
      status: kycRecord.status,
      personalDetails: kycRecord.personalDetails,
      verifiedAt: kycRecord.verifiedAt,
      creditDeducted: branch ? 1 : 0
    };
  }

  async getReportByRefId(refid) {
    const record = await KycVerificationModel.findOne({ refid });
    if (!record) {
      throw ApiError.notFound('KYC verification report not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }
    return record;
  }

  async getHistory(merchantUser, query = {}) {
    const { userId, merchant, bankId } = await this.getMerchantContext(merchantUser);

    const page = Math.max(1, parseInt(query.page || 1, 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || 10, 10)));
    const skip = (page - 1) * limit;

    const filter = {
      $or: [
        { createdBy: userId },
        { requestById: userId },
        ...(bankId ? [{ societyId: bankId }] : [])
      ]
    };

    if (query.documentType) {
      filter.documentType = String(query.documentType).toUpperCase();
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.search && query.search.trim()) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$and = [
        {
          $or: [
            { refid: searchRegex },
            { idNumber: searchRegex },
            { 'personalDetails.fullName': searchRegex }
          ]
        }
      ];
    }

    const [items, total] = await Promise.all([
      KycVerificationModel.find(filter)
        .select('-rawXmlBase64')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      KycVerificationModel.countDocuments(filter)
    ]);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  async _markFailed(record, message = null) {
    record.status = 'FAILED';
    record.verifiedAt = new Date();
    record.personalDetails = null;
    record.rawXmlBase64 = { aadhaar: null, pan: null };
    if (message) {
      record.lastError = String(message).slice(0, 500);
    }
    await record.save();
  }
}

export const merchantKycVerificationService = new MerchantKycVerificationService();
