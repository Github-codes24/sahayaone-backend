import { KycVerificationModel } from '../models/kyc-verification.model.js';
import {
  initiateDigiLockerSessionApi,
  generateAccessTokenApi,
  fetchIssuedFilesApi,
  downloadXmlDocumentApi,
  extractAccessToken,
  extractIssuedFiles,
  extractXmlData
} from '../utils/digilocker-client.util.js';
import {
  decodeBase64Xml,
  encodeXmlToBase64,
  parseAadhaarXml,
  parsePanXml
} from '../utils/xml-parser.util.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';
import { logger } from '../../../../utils/logger.util.js';
import { User } from '../../../../models/user.model.js';
import { CustomerProfile } from '../../../../models/customer-profile.model.js';
import { SocietyEmployee } from '../../../../models/society-employee.model.js';


const AADHAAR_DOCTYPES = ['AADHAAR', 'ADHAR'];
const PAN_DOCTYPES = ['PAN', 'PANCR'];

/**
 * Mask ID for secure logging.
 */
const maskId = (documentType, value) => {
  if (!value) return value;
  const v = String(value).trim();
  if (documentType === 'AADHAAR') {
    return v.length > 8 ? `${v.slice(0, 4)}XXXXXXXX` : 'XXXXXXXXXXXX';
  }
  return v.length > 4 ? `${v.slice(0, 2)}XXXXXX${v.slice(-2)}` : 'XXXXXXXXXX';
};

/**
 * Helper to validate if the input ID matches the parsed ID from DigiLocker XML.
 */
const matchIdNumbers = (documentType, inputId, parsedId) => {
  if (!inputId || !parsedId) return false;

  const cleanInput = String(inputId).replace(/[\s-]/g, '').toUpperCase();
  const cleanParsed = String(parsedId).replace(/[\s-]/g, '').toUpperCase();

  if (documentType === 'AADHAAR') {
    // If parsed is unmasked 12 digits, compare full string
    if (/^\d{12}$/.test(cleanParsed)) {
      return cleanParsed === cleanInput;
    }
    // If parsed is masked (e.g. XXXXXXXX1234), match last 4 digits
    return cleanParsed.slice(-4) === cleanInput.slice(-4);
  }

  if (documentType === 'PAN') {
    // If parsed is unmasked 10 alphanumeric characters, compare full string
    if (/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanParsed)) {
      return cleanParsed === cleanInput;
    }
    // If parsed is masked (e.g. XXXXXX1234F), match trailing characters
    return cleanParsed.slice(-4) === cleanInput.slice(-4);
  }

  return false;
};

/**
 * Extract Authorization URL from SprintVerify API Response.
 */
const getAuthorizationUrl = (res) => {
  const d = res?.data;
  if (typeof d === 'string') return d.startsWith('http') ? d : null;
  if (d && typeof d === 'object') {
    return d.authorization_url
      || d.authorizationUrl
      || d.auth_url
      || d.authUrl
      || d.url
      || null;
  }
  return null;
};

/**
 * Format personal details summary for logging.
 */
const extractVerificationSummary = (personalDetails) => ({
  fullName: Boolean(personalDetails.fullName),
  gender: Boolean(personalDetails.gender),
  dob: Boolean(personalDetails.dob),
  aadhaarVerified: personalDetails.aadhaarVerified,
  panVerified: personalDetails.panVerified,
  aadhaarStatus: personalDetails.aadhaarStatus,
  panStatus: personalDetails.panStatus
});

export class KycVerificationService {
  /**
   * Step 1: Initiate DigiLocker Verification Session
   */
  /**
   * Step 1: Initiate DigiLocker Verification Session
   */
  async initiateSession(data, userId, societyId) {
    const { documentType, idNumber, redirectUrl, consent = true, requestById } = data;
    const normalizedType = String(documentType).toUpperCase();
    const normalizedId = String(idNumber).trim();

    if (!userId) {
      throw ApiError.unauthorized('User identity missing. Cannot initiate KYC verification.');
    }

    if (!societyId) {
      throw ApiError.forbidden('Society context missing. Cannot initiate KYC verification.');
    }

    console.log('\n================================================================');
    console.log('[KYC SERVICE STEP 1] Initiating DigiLocker Session');
    console.log(`[KYC SERVICE STEP 1] User ID: ${userId} | Society ID: ${societyId} | Target User ID: ${requestById} | Document Type: ${normalizedType} | ID: ${maskId(normalizedType, normalizedId)}`);
    console.log('================================================================\n');

    logger.info('[KYC:INITIATE] Starting DigiLocker session', {
      userId,
      societyId,
      documentType: normalizedType,
      idNumber: maskId(normalizedType, normalizedId)
    });

    // Step 1.1: Check if there's an existing VERIFIED session for the same society + target user + document type + ID number
    const existing = await KycVerificationModel.findOne({
      societyId,
      requestById,
      documentType: normalizedType,
      idNumber: normalizedId,
      status: 'VERIFIED'
    });

    if (existing) {
      console.log(`[KYC SERVICE STEP 1] Existing verified KYC session found. RefID: ${existing.refid}`);
      logger.info('[KYC:INITIATE] Reusing existing verified KYC session', {
        userId,
        refid: existing.refid
      });
      return {
        alreadyVerified: true,
        refid: existing.refid,
        status: existing.status,
        personalDetails: existing.personalDetails
      };
    }

    // Step 1.2: Generate unique refid
    const refid = `KYC_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    console.log(`[KYC SERVICE STEP 1] Calling DigiLocker API 1: Initiate Session (/digilocker/initiate_session)`);
    console.log(`[KYC SERVICE STEP 1] Generated Unique Session RefID: ${refid}`);

    logger.info('[KYC:INITIATE] Requesting DigiLocker initiate_session API', { refid, userId });
    const apiResponse = await initiateDigiLockerSessionApi(refid, redirectUrl);
    const authorizationUrl = getAuthorizationUrl(apiResponse);

    if (!apiResponse?.success || !authorizationUrl) {
      const errorMsg = apiResponse?.message || 'Failed to initiate DigiLocker session';
      console.error(`[KYC SERVICE STEP 1 ERROR] Initiate session failed: ${errorMsg}`);
      logger.error('[KYC:INITIATE] initiate_session failed', {
        refid,
        statuscode: apiResponse?.statuscode,
        message: errorMsg
      });
      throw ApiError.badRequest(errorMsg, ErrorCode.UNEXPECTED_ERROR, apiResponse?.raw || null);
    }

    console.log(`[KYC SERVICE STEP 1 SUCCESS] DigiLocker Authorization URL: ${authorizationUrl}`);
    logger.info('[KYC:INITIATE] DigiLocker session initiated successfully', { refid, userId });

    // Step 1.3: Save session record to database
    const kycRecord = await KycVerificationModel.create({
      createdBy: userId,
      societyId,
      requestById,
      refid,
      documentType: normalizedType,
      idNumber: normalizedId,
      consent,
      status: 'INITIATED',
      authorizationUrl,
      redirectUrl
    });

    console.log(`[KYC SERVICE STEP 1 DB] Persistent record created with status: INITIATED (ID: ${kycRecord._id})`);

    return {
      refid: kycRecord.refid,
      authorizationUrl: kycRecord.authorizationUrl,
      status: kycRecord.status
    };
  }

  /**
   * Step 2: Complete DigiLocker Authentication & Parse XML Identity
   */
  async completeVerification(refid, userId) {
    console.log('\n================================================================');
    console.log(`[KYC SERVICE STEP 2] Completing DigiLocker Verification Workflow`);
    console.log(`[KYC SERVICE STEP 2] RefID: ${refid} | User ID: ${userId || 'N/A'}`);
    console.log('================================================================\n');

    logger.info('[KYC:COMPLETE] Finalizing KYC verification', { refid, userId });

    // Step 2.1: Locate session record by unique refid
    const kycRecord = await KycVerificationModel.findOne({ refid });

    if (!kycRecord) {
      console.error(`[KYC SERVICE STEP 2 ERROR] Record not found for RefID: ${refid}`);
      logger.warn('[KYC:COMPLETE] Verification session not found', { refid, userId });
      throw ApiError.notFound('KYC verification session not found', ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (kycRecord.status === 'VERIFIED') {
      console.log(`[KYC SERVICE STEP 2] Session already verified. Returning cached data.`);
      logger.info('[KYC:COMPLETE] Session already verified. Returning cached data.', { refid });
      return {
        refid: kycRecord.refid,
        documentType: kycRecord.documentType,
        idNumber: kycRecord.idNumber,
        status: kycRecord.status,
        personalDetails: kycRecord.personalDetails,
        verifiedAt: kycRecord.verifiedAt
      };
    }

    // Step 2.2: Generate Access Token (API 2 - POST /digilocker/access_token)
    let tokenRes;
    try {
      console.log('[KYC SERVICE STEP 2.2] Calling API 2: Generate Access Token (/digilocker/access_token)');
      logger.info('[KYC:COMPLETE] Step 1/4: Generating access token', { refid });
      tokenRes = await generateAccessTokenApi(refid);
    } catch (error) {
      console.error('[KYC SERVICE STEP 2.2 ERROR] Access token API failed:', error.message);
      await this._markFailed(kycRecord, error.message);
      throw error;
    }

    if (!tokenRes?.success) {
      const errorMsg = tokenRes?.message || 'Access token generation failed';
      console.error(`[KYC SERVICE STEP 2.2 ERROR] ${errorMsg}`);
      logger.error('[KYC:COMPLETE] Generate access token failed', {
        refid,
        statuscode: tokenRes?.statuscode,
        message: errorMsg
      });
      await this._markFailed(kycRecord, errorMsg);
      throw ApiError.badRequest(errorMsg, ErrorCode.UNEXPECTED_ERROR, tokenRes?.raw || null);
    }

    const accessToken = extractAccessToken(tokenRes);
    console.log('[KYC SERVICE STEP 2.2 SUCCESS] Access Token API returned success response');

    // Step 2.3: Fetch Issued Files List (API 3 - POST /digilocker/issued_files)
    let filesRes;
    try {
      console.log('[KYC SERVICE STEP 2.3] Calling API 3: Fetch Issued Files (/digilocker/issued_files)');
      logger.info('[KYC:COMPLETE] Step 2/4: Retrieving issued files list', { refid });
      filesRes = await fetchIssuedFilesApi(refid);
    } catch (error) {
      console.error('[KYC SERVICE STEP 2.3 ERROR] Fetch issued files failed:', error.message);
      await this._markFailed(kycRecord, error.message);
      throw error;
    }

    if (!filesRes?.success) {
      const errorMsg = filesRes?.message || 'Failed to fetch issued documents list';
      console.error(`[KYC SERVICE STEP 2.3 ERROR] ${errorMsg}`);
      logger.error('[KYC:COMPLETE] Fetch issued files failed', {
        refid,
        statuscode: filesRes?.statuscode,
        message: errorMsg
      });
      await this._markFailed(kycRecord, errorMsg);
      throw ApiError.badRequest(errorMsg, ErrorCode.UNEXPECTED_ERROR, filesRes?.raw || null);
    }

    const issuedFiles = extractIssuedFiles(filesRes);
    console.log(`[KYC SERVICE STEP 2.3 SUCCESS] Retrieved ${issuedFiles.length} issued documents:`, JSON.stringify(issuedFiles, null, 2));

    if (issuedFiles.length === 0) {
      const errorMsg = 'No documents found in this DigiLocker account';
      console.error(`[KYC SERVICE STEP 2.3 ERROR] ${errorMsg}`);
      logger.error('[KYC:COMPLETE] Empty issued files list', { refid });
      await this._markFailed(kycRecord, errorMsg);
      throw ApiError.badRequest(errorMsg, ErrorCode.UNEXPECTED_ERROR);
    }

    logger.info('[KYC:COMPLETE] Retrieved issued files list', { refid, count: issuedFiles.length });

    // Step 2.4: Identify Aadhaar & PAN documents from issued files
    const aadhaarDoc = issuedFiles.find(doc => AADHAAR_DOCTYPES.includes(String(doc?.doctype || '').toUpperCase()));
    const panDoc = issuedFiles.find(doc => PAN_DOCTYPES.includes(String(doc?.doctype || '').toUpperCase()));

    console.log(`[KYC SERVICE STEP 2.4] Document Discovery -> Aadhaar URI: ${aadhaarDoc?.uri || 'NOT FOUND'} | PAN URI: ${panDoc?.uri || 'NOT FOUND'}`);

    const availableDocuments = [];
    const unavailableDocuments = [];

    if (aadhaarDoc) availableDocuments.push('AADHAAR');
    else unavailableDocuments.push('AADHAAR');

    if (panDoc) availableDocuments.push('PAN');
    else unavailableDocuments.push('PAN');

    let personalDetails = {
      fullName: null,
      gender: null,
      dob: null,
      fatherName: null,
      address: null,
      aadhaarVerified: false,
      panVerified: false,
      aadhaarStatus: aadhaarDoc ? 'FAILED' : 'UNAVAILABLE',
      panStatus: panDoc ? 'FAILED' : 'UNAVAILABLE',
      availableDocuments,
      unavailableDocuments,
      aadhaarNumber: null,
      panNumber: null
    };

    let rawXmlBase64 = {
      aadhaar: null,
      pan: null
    };

    // Step 2.5: Process Aadhaar XML download (API 4 - POST /digilocker/download_xml)
    if (aadhaarDoc?.uri) {
      try {
        console.log(`[KYC SERVICE STEP 2.5] Calling API 4 for Aadhaar XML (/digilocker/download_xml) with URI: ${aadhaarDoc.uri}`);
        logger.info('[KYC:COMPLETE] Step 3/4: Downloading Aadhaar XML document', { refid, uri: aadhaarDoc.uri });
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
            personalDetails.fatherName = parsed.fatherName || personalDetails.fatherName;
            personalDetails.address = parsed.address || personalDetails.address;
            if (parsed.aadhaarNumber) {
              const currentAadhaar = personalDetails.aadhaarNumber || '';
              const isCurrentUnmasked = /^\d{12}$/.test(String(currentAadhaar).replace(/\D/g, ''));
              const isParsedMasked = /[xX]/.test(String(parsed.aadhaarNumber)) || parsed.isMasked;

              if (isParsedMasked && isCurrentUnmasked) {
                personalDetails.aadhaarNumber = String(currentAadhaar).replace(/\D/g, '');
              } else {
                personalDetails.aadhaarNumber = parsed.aadhaarNumber;
              }
            }
            personalDetails.aadhaarVerified = true;
            personalDetails.aadhaarStatus = 'VERIFIED';
            console.log('[KYC SERVICE STEP 2.5 SUCCESS] Aadhaar XML processed and parsed successfully');
            logger.info('[KYC:COMPLETE] Aadhaar XML successfully parsed', {
              refid,
              summary: extractVerificationSummary(personalDetails)
            });
          }
        }
      } catch (err) {
        console.error(`[KYC SERVICE STEP 2.5 ERROR] Aadhaar XML processing failed:`, err.message);
        logger.error('[KYC:COMPLETE] Aadhaar XML processing failed', { refid, error: err.message });
      }
    }

    // Step 2.6: Process PAN XML download (API 4 - POST /digilocker/download_xml)
    if (panDoc?.uri) {
      try {
        console.log(`[KYC SERVICE STEP 2.6] Calling API 4 for PAN XML (/digilocker/download_xml) with URI: ${panDoc.uri}`);
        logger.info('[KYC:COMPLETE] Step 4/4: Downloading PAN XML document', { refid, uri: panDoc.uri });
        const xmlRes = await downloadXmlDocumentApi(refid, panDoc.uri);
        const base64Data = extractXmlData(xmlRes);

        if (base64Data) {
          rawXmlBase64.pan = base64Data;
          const decoded = decodeBase64Xml(base64Data);
          const parsed = parsePanXml(decoded);

          if (parsed) {
            personalDetails.fullName = personalDetails.fullName || parsed.fullName;
            personalDetails.gender = personalDetails.gender || parsed.gender;
            personalDetails.dob = personalDetails.dob || parsed.dob;
            personalDetails.fatherName = personalDetails.fatherName || parsed.fatherName;
            personalDetails.panNumber = parsed.panNumber || personalDetails.panNumber;
            personalDetails.panVerified = true;
            personalDetails.panStatus = 'VERIFIED';
            console.log('[KYC SERVICE STEP 2.6 SUCCESS] PAN XML processed and parsed successfully');
            logger.info('[KYC:COMPLETE] PAN XML successfully parsed', {
              refid,
              summary: extractVerificationSummary(personalDetails)
            });
          }
        }
      } catch (err) {
        console.error(`[KYC SERVICE STEP 2.6 ERROR] PAN XML processing failed:`, err.message);
        logger.error('[KYC:COMPLETE] PAN XML processing failed', { refid, error: err.message });
      }
    }

    // Step 2.7: Strict ID Matching Validation
    let isMatch = false;
    let matchError = null;

    const requestedDocType = kycRecord.documentType;
    const isDocAvailable = requestedDocType === 'AADHAAR'
      ? personalDetails.aadhaarVerified
      : personalDetails.panVerified;

    if (!isDocAvailable) {
      matchError = `Requested document (${requestedDocType}) was not found in user's DigiLocker account.`;
      console.error(`[KYC SERVICE STEP 2.7 ERROR] ${matchError}`);
      logger.error('[KYC:COMPLETE] Requested document missing in DigiLocker', {
        refid,
        requestedDocType
      });
    } else {
      const parsedIdNumber = requestedDocType === 'AADHAAR'
        ? personalDetails.aadhaarNumber
        : personalDetails.panNumber;

      if (!parsedIdNumber) {
        matchError = `Could not extract ${requestedDocType} number from DigiLocker document.`;
        console.error(`[KYC SERVICE STEP 2.7 ERROR] ${matchError}`);
        logger.error('[KYC:COMPLETE] Parsed ID number missing in XML', {
          refid,
          requestedDocType
        });
      } else {
        isMatch = matchIdNumbers(requestedDocType, kycRecord.idNumber, parsedIdNumber);
        if (!isMatch) {
          matchError = `Submitted ${requestedDocType} number does not match the document retrieved from DigiLocker.`;
          console.error(`[KYC SERVICE STEP 2.7 ERROR] Document number mismatch. Input: ${maskId(requestedDocType, kycRecord.idNumber)} | Parsed: ${maskId(requestedDocType, parsedIdNumber)}`);
          logger.warn('[KYC:COMPLETE] Document number mismatch', {
            refid,
            requested: requestedDocType,
            input: maskId(requestedDocType, kycRecord.idNumber),
            parsed: maskId(requestedDocType, parsedIdNumber)
          });
        } else {
          console.log(`[KYC SERVICE STEP 2.7 SUCCESS] Document ${requestedDocType} number matched successfully.`);
        }
      }
    }

    const isVerified = isDocAvailable && isMatch;

    // Step 2.8: Persist final status to database
    kycRecord.status = isVerified ? 'VERIFIED' : 'FAILED';
    kycRecord.verifiedAt = new Date();
    kycRecord.billingCode = tokenRes?.statuscode ?? 200;
    kycRecord.lastError = isVerified ? null : (matchError || 'Required document verification failed');

    if (isVerified) {
      kycRecord.personalDetails = personalDetails;
      kycRecord.rawXmlBase64 = rawXmlBase64;
    } else {
      // Do not retain any sensitive identity PII or raw XMLs on failed sessions
      kycRecord.personalDetails = null;
      kycRecord.rawXmlBase64 = { aadhaar: null, pan: null };
    }

    await kycRecord.save();

    if (!isVerified) {
      throw ApiError.badRequest(matchError || 'KYC document verification failed.');
    }

    // Step 2.9: Propagate verification status to User Profile
    if (isVerified && kycRecord.requestById) {
      try {
        console.log(`[KYC SERVICE STEP 2.9] Propagating KYC Status to User Profile. requestById: ${kycRecord.requestById}`);
        const user = await User.findById(kycRecord.requestById);
        if (user) {
          const docNumber = kycRecord.documentType === 'AADHAAR' ? personalDetails.aadhaarNumber : personalDetails.panNumber;

          if (user.profileModel === 'CustomerProfile') {
            const profile = await CustomerProfile.findById(user.profileId);
            if (profile) {
              profile.kycStatus = 'VERIFIED';
              if (kycRecord.documentType === 'AADHAAR') {
                profile.aadhaarNumber = docNumber;
                profile.firstName = personalDetails.fullName?.split(' ')[0] || profile.firstName;
                profile.lastName = personalDetails.fullName?.split(' ').slice(1).join(' ') || profile.lastName;
                profile.gender = personalDetails.gender?.toUpperCase() || profile.gender;
                if (personalDetails.dob) {
                  const parts = personalDetails.dob.split(/[-/]/);
                  if (parts.length === 3) {
                    const dateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                    if (!isNaN(dateObj.getTime())) {
                      profile.dob = dateObj;
                    }
                  }
                }
              } else if (kycRecord.documentType === 'PAN') {
                profile.panNumber = docNumber?.toUpperCase();
              }
              await profile.save();
              console.log(`[KYC SERVICE STEP 2.9 SUCCESS] Updated CustomerProfile kycStatus to VERIFIED`);
            }
          } else if (user.profileModel === 'SocietyEmployee') {
            const profile = await SocietyEmployee.findById(user.profileId);
            if (profile) {
              if (!profile.personalDetails) {
                profile.personalDetails = {};
              }
              profile.fullName = personalDetails.fullName || profile.fullName;
              profile.personalDetails.fullName = personalDetails.fullName || profile.personalDetails.fullName;
              profile.personalDetails.gender = personalDetails.gender?.toUpperCase() || profile.personalDetails.gender;
              if (personalDetails.dob) {
                const parts = personalDetails.dob.split(/[-/]/);
                if (parts.length === 3) {
                  const dateObj = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                  if (!isNaN(dateObj.getTime())) {
                    profile.personalDetails.dob = dateObj;
                    profile.personalDetails.dateOfBirth = dateObj;
                  }
                }
              }
              await profile.save();
              console.log(`[KYC SERVICE STEP 2.9 SUCCESS] Updated SocietyEmployee profile details`);
            }
            
            user.status = 'ACTIVE';
            await user.save();
          }
        }
      } catch (err) {
        console.error(`[KYC SERVICE STEP 2.9 ERROR] Failed to propagate KYC status to user/profile:`, err.message);
        logger.error('[KYC:COMPLETE] Profile state propagation failed', { refid, error: err.message });
      }
    }

    console.log('\n================================================================');
    console.log(`[KYC SERVICE STEP 2 FINALIZED] Record RefID: ${refid}`);
    console.log(`[KYC SERVICE STEP 2 FINALIZED] Final Status: ${kycRecord.status}`);
    console.log(`[KYC SERVICE STEP 2 FINALIZED] Billing Code: ${kycRecord.billingCode}`);
    console.log('[KYC SERVICE STEP 2 FINALIZED] Personal Details:', JSON.stringify(kycRecord.personalDetails, null, 2));
    console.log('================================================================\n');

    logger.info('[KYC:COMPLETE] Verification process finalized', {
      refid,
      status: kycRecord.status,
      availableDocuments: personalDetails.availableDocuments
    });

    return {
      refid: kycRecord.refid,
      documentType: kycRecord.documentType,
      idNumber: kycRecord.idNumber,
      status: kycRecord.status,
      personalDetails: kycRecord.personalDetails,
      verifiedAt: kycRecord.verifiedAt
    };
  }


  /**
   * Fetch verification report by Ref ID
   */
  async getReportByRefId(refid, userId) {
    logger.info('[KYC:REPORT] Querying report by refid', { refid, userId });

    const record = await KycVerificationModel.findOne({ refid });

    if (!record) {
      logger.warn('[KYC:REPORT] Record not found', { refid, userId });
      throw ApiError.notFound('KYC verification report not found', ErrorCode.RESOURCE_NOT_FOUND);
    }

    return record;
  }

  /**
   * Fetch KYC verification history list with search, status, documentType, date range, and pagination filters.
   */
  async getHistory({ societyId, query = {} }) {
    const page = Math.max(1, parseInt(query.page || 1, 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || 10, 10)));
    const skip = (page - 1) * limit;

    const filter = {};
    if (societyId) {
      filter.societyId = societyId;
    }

    if (query.requestById) {
      filter.requestById = query.requestById;
    }

    if (query.createdBy) {
      filter.createdBy = query.createdBy;
    }

    if (query.documentType) {
      filter.documentType = String(query.documentType).toUpperCase();
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.search && query.search.trim()) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      filter.$or = [
        { refid: searchRegex },
        { idNumber: searchRegex },
        { 'personalDetails.fullName': searchRegex },
        { 'personalDetails.aadhaarNumber': searchRegex },
        { 'personalDetails.panNumber': searchRegex }
      ];
    }

    if (query.startDate || query.endDate) {
      filter.createdAt = {};
      if (query.startDate) {
        filter.createdAt.$gte = new Date(query.startDate);
      }
      if (query.endDate) {
        filter.createdAt.$lte = new Date(query.endDate);
      }
    }

    logger.info('[KYC:HISTORY] Querying KYC verification history', {
      societyId,
      filter: JSON.stringify(filter),
      page,
      limit
    });

    const statsFilter = societyId ? { societyId } : {};

    const [items, total, statsResult] = await Promise.all([
      KycVerificationModel.find(filter)
        .select('-rawXmlBase64')
        .populate('createdBy', 'fullName email')
        .populate('requestById', 'fullName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      KycVerificationModel.countDocuments(filter),
      KycVerificationModel.aggregate([
        { $match: statsFilter },
        {
          $group: {
            _id: null,
            totalKyc: { $sum: 1 },
            verified: {
              $sum: { $cond: [{ $eq: ['$status', 'VERIFIED'] }, 1, 0] }
            },
            failed: {
              $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] }
            },
            aadhaarVerified: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$documentType', 'AADHAAR'] },
                      { $eq: ['$status', 'VERIFIED'] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            panVerified: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$documentType', 'PAN'] },
                      { $eq: ['$status', 'VERIFIED'] }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        }
      ])
    ]);

    const statsData = statsResult[0] || {};

    const stats = {
      totalKyc: statsData.totalKyc || 0,
      verified: statsData.verified || 0,
      failed: statsData.failed || 0,
      aadhaarVerified: statsData.aadhaarVerified || 0,
      panVerified: statsData.panVerified || 0
    };

    return {
      stats,
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  /**
   * Helper to mark a session record as FAILED.
   * Ensures no PII identity data or raw XML payloads are stored.
   */
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

export const kycVerificationService = new KycVerificationService();
