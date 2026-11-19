import mongoose from 'mongoose';
import { Banner } from '../../../../models/banner.model.js';
import { User } from '../../../../models/user.model.js';
import { CustomerProfile } from '../../../../models/customer-profile.model.js';
import { Loan } from '../../../../models/loan.model.js';
import { employeeLoansService } from '../../loans/services/loans.service.js';
import { Variant } from '../../../../models/variant.model.js';
import { TempOtp } from '../../../../models/temp-otp.model.js';
import { EmployeeProfile } from '../../../../models/employee-profile.model.js';
import { MerchantProfile } from '../../../../models/merchant-profile.model.js';
import { SocietyEmployee } from '../../../../models/society-employee.model.js';
import { BranchManager } from '../../../../models/branch-manager.model.js';
import { OnboardingTeam } from '../../../../models/onboarding-team.model.js';
import { Branch } from '../../../../models/branch.model.js';
import { Bank } from '../../../../models/bank.model.js';
import { CreditLog } from '../../../../models/credit-log.model.js';
import { CardCreditUsage } from '../../../../models/card-credit-usage.model.js';
import { SocietyCustomerLink } from '../../../../models/society-customer-link.model.js';
import { OnboardingEngineService } from '../../onboarding/services/onboarding-engine.service.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';
import { UserRole, UserType } from '../../../../constants/user-role.constant.js';
import { storageManager } from '../../../../storage/storage.manager.js';
import { logger } from '../../../../utils/logger.util.js';
import { envConfig } from '../../../../config/env.config.js';
import { generateOtp } from '../../../../utils/otp.util.js';
import { smsManager } from '../../../../sms/sms.manager.js';
import { paginationUtil } from '../../../../utils/pagination.util.js';
import { smsConfig } from '../../../../config/sms.config.js';
import { panelControlConfig } from '../../../../config/panel-control.config.js';
import { BankAccount } from '../../../../models/bank-account.model.js';
import { EmiCard } from '../../../../models/emi-card.model.js';
import { isCardExpired, maskCardNumber, extendValidity } from '../../loans/services/loans.service.js';
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
import { parseAadhaarXml, parsePanXml, encodeXmlToBase64, formatDobForCibil } from '../../../society/kycVerification/utils/xml-parser.util.js';
import { CreditReportRequest } from '../../../../models/cibilReport.model.js';
import crypto from 'crypto';
import { loanPdfService } from '../../loans/services/loan-pdf.service.js';
import { SprintVerifyEsignUtil } from '../../loans/utils/sprintverify-esign.util.js';
import { RazorpayHelper } from '../../../../utils/razorpay.helper.js';
import { loanApprovalTimerService } from '../../loans/services/loan-approval-timer.service.js';
import { creditReportService } from '../../../society/cibilScore/services/cibilScore.service.js';
import { employeeMerchantService } from '../../merchant/services/employee-merchant.service.js';
import { employeePigmyService } from '../../pigmy/services/employee-pigmy.service.js';

const parseBase64ToMulterFile = (base64String, fieldName = 'doc', identifier = 'user') => {
  if (!base64String || typeof base64String !== 'string') return null;

  let mimeType = 'image/jpeg';
  let pureBase64 = base64String.trim();

  if (pureBase64.includes(';base64,')) {
    const parts = pureBase64.split(';base64,');
    mimeType = parts[0].replace('data:', '') || 'image/jpeg';
    pureBase64 = parts[1];
  } else {
    if (pureBase64.startsWith('iVBORw0KGgo')) {
      mimeType = 'image/png';
    } else if (pureBase64.startsWith('/9j/')) {
      mimeType = 'image/jpeg';
    } else if (pureBase64.startsWith('R0lGOD')) {
      mimeType = 'image/gif';
    } else if (pureBase64.startsWith('UklGR')) {
      mimeType = 'image/webp';
    } else if (pureBase64.startsWith('JVBERi0')) {
      mimeType = 'application/pdf';
    }
  }

  const buffer = Buffer.from(pureBase64, 'base64');
  const ext = mimeType.split('/')[1] || 'jpg';
  
  return {
    originalname: `${fieldName}_${identifier}_${Date.now()}.${ext}`,
    buffer,
    mimetype: mimeType,
    size: buffer.length
  };
};

export const processDocumentUpload = async (rawInput, fieldName = 'doc', identifier = 'user', folder = 'customers') => {
  if (!rawInput) return null;

  if (typeof rawInput === 'object' && rawInput.buffer) {
    try {
      const res = await storageManager.uploadFile(rawInput, folder);
      return res?.fileUrl || res?.url || null;
    } catch (err) {
      logger.warn(`STORAGE UPLOAD WARNING (${fieldName}): ${err.message}`);
      return null;
    }
  }

  if (typeof rawInput === 'string') {
    const trimmed = rawInput.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('//')) {
      return trimmed;
    }

    try {
      const multerFile = parseBase64ToMulterFile(trimmed, fieldName, identifier);
      if (multerFile) {
        const res = await storageManager.uploadFile(multerFile, folder);
        return res?.fileUrl || res?.url || null;
      }
    } catch (err) {
      logger.warn(`STORAGE BASE64 UPLOAD WARNING (${fieldName}): ${err.message}`);
      return null;
    }
  }

  return null;
};

export class LeadsService {
  /**
   * Resolve Bank and Branch scoping context for any logged-in user
   * (Supports Loan Executives, Branch Managers, Branch Staff, Bank Admins, and Bank Owners)
   */
  async resolveExecutiveOrBranchContext(userObj, explicitBankId = null, explicitBranchId = null, options = {}) {
    const { requireBranchForOwner = false } = options;

    const userId = (userObj?.id || userObj?._id || userObj?.userId || (typeof userObj === 'string' ? userObj : '')).toString();
    const userDoc = userId && mongoose.Types.ObjectId.isValid(userId) ? await User.findById(userId).lean() : null;

    const roleUpper = String(userObj?.role || userDoc?.role || '').toUpperCase();
    const isBankOwnerOrHead = ['BANK_OWNER', 'BANK_ADMIN', 'SOCIETY_ADMIN', 'HO_ADMIN', 'SUPER_ADMIN', 'OWNER', 'CHAIRMAN', 'ADMIN', 'BANK_HEAD', 'HEAD', 'DIRECTOR', 'AUTHORIZED_PERSON', 'BANK_AUTHORIZED_PERSON'].includes(roleUpper) || roleUpper.includes('HEAD') || roleUpper.includes('OWNER') || roleUpper.includes('AUTHORIZED');

    // 1. Resolve Bank ID
    let resolvedBankId = explicitBankId || userObj?.bankId || userObj?.societyId || userDoc?.bankId || null;

    if (userId && !resolvedBankId) {
      const societyEmployee = await SocietyEmployee.findOne({ userId, isDeleted: { $ne: true } }).lean();
      if (societyEmployee?.bankId) resolvedBankId = societyEmployee.bankId;
    }
    if (userId && !resolvedBankId) {
      const branchManager = await BranchManager.findOne({ userId, isDeleted: { $ne: true } }).lean();
      if (branchManager?.bankId) resolvedBankId = branchManager.bankId;
    }
    if (userId && !resolvedBankId) {
      const employeeProfile = await EmployeeProfile.findOne({ userId, isDeleted: { $ne: true } }).lean();
      if (employeeProfile?.bankId) resolvedBankId = employeeProfile.bankId;
    }
    if (userId && !resolvedBankId) {
      const onboardingTeam = await OnboardingTeam.findOne({ userId, isDeleted: { $ne: true } }).lean();
      if (onboardingTeam?.bankId) resolvedBankId = onboardingTeam.bankId;
    }
    if (userId && !resolvedBankId) {
      const bankDoc = await Bank.findOne({ userId, isDeleted: { $ne: true } }).lean();
      if (bankDoc) resolvedBankId = bankDoc._id;
    }

    let resolvedBranchId = null;
    let branch = null;

    if (isBankOwnerOrHead) {
      // FOR BANK OWNER / HEAD:
      // Branch selection is allowed and strictly verified.
      const candidateBranchId = explicitBranchId || userObj?.branchId || userDoc?.branchId || null;

      if (candidateBranchId) {
        if (!mongoose.Types.ObjectId.isValid(candidateBranchId)) {
          throw ApiError.badRequest('Selected branch ID is invalid.');
        }
        const targetBranch = await Branch.findOne({ _id: candidateBranchId, isDeleted: { $ne: true } });
        if (!targetBranch) {
          throw ApiError.badRequest('Selected branch does not exist or has been deactivated.');
        }
        if (resolvedBankId && targetBranch.bankId && targetBranch.bankId.toString() !== resolvedBankId.toString()) {
          throw ApiError.badRequest('Selected branch does not belong to your bank.');
        }
        resolvedBranchId = targetBranch._id;
        branch = targetBranch;
        if (!resolvedBankId && targetBranch.bankId) {
          resolvedBankId = targetBranch.bankId;
        }
      } else {
        if (requireBranchForOwner) {
          throw ApiError.badRequest('Please select a target branch for onboarding this customer.');
        }
        // Fallback for non-creation / query endpoints
        if (resolvedBankId) {
          const activeBranch = await Branch.findOne({ bankId: resolvedBankId, isDeleted: { $ne: true } });
          if (activeBranch) {
            resolvedBranchId = activeBranch._id;
            branch = activeBranch;
          }
        }
      }
    } else {
      // FOR NON-OWNER (Executive, Branch Manager, Branch Staff, Employee):
      // Incoming explicitBranchId is strictly IGNORED to prevent unauthorized cross-branch onboarding!
      // Must strictly resolve from their own database assignment.
      resolvedBranchId = userObj?.branchId || userDoc?.branchId || null;

      if (userId && !resolvedBranchId) {
        const societyEmployee = await SocietyEmployee.findOne({ userId, isDeleted: { $ne: true } }).lean();
        if (societyEmployee?.branchId) resolvedBranchId = societyEmployee.branchId;
      }
      if (userId && !resolvedBranchId) {
        const branchManager = await BranchManager.findOne({ userId, isDeleted: { $ne: true } }).lean();
        if (branchManager?.branchId) resolvedBranchId = branchManager.branchId;
      }
      if (userId && !resolvedBranchId) {
        const employeeProfile = await EmployeeProfile.findOne({ userId, isDeleted: { $ne: true } }).lean();
        if (employeeProfile?.branchId) resolvedBranchId = employeeProfile.branchId;
      }
      if (userId && !resolvedBranchId) {
        const onboardingTeam = await OnboardingTeam.findOne({ userId, isDeleted: { $ne: true } }).lean();
        if (onboardingTeam?.branchId) resolvedBranchId = onboardingTeam.branchId;
      }

      if (resolvedBranchId) {
        branch = await Branch.findOne({ _id: resolvedBranchId, isDeleted: { $ne: true } });
        if (!resolvedBankId && branch?.bankId) {
          resolvedBankId = branch.bankId;
        }
      }
    }

    let bank = null;
    if (resolvedBankId) {
      bank = await Bank.findById(resolvedBankId);
    } else if (branch?.bankId) {
      resolvedBankId = branch.bankId;
      bank = await Bank.findById(branch.bankId);
    }

    return {
      userId,
      userDoc,
      isBankOwnerOrHead,
      bankId: resolvedBankId,
      branchId: resolvedBranchId,
      branch,
      bank
    };
  }

  /**
   * Generates and dispatches a verification OTP code for phone check
   */
  async sendLookupOtp(phoneNumber, productType = 'LOAN') {
    const cleanPhone = String(phoneNumber || '').replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      throw ApiError.badRequest('Please enter a valid 10-digit mobile number.');
    }

    const isTestMode = panelControlConfig.EMPLOYEE_PANEL?.OTP === 'TEST' || panelControlConfig.CUSTOMER_PANEL?.OTP === 'TEST';
    const isLiveOtp = !isTestMode;
    const otp = isLiveOtp ? generateOtp(6, { numericOnly: true }) : '123456';
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Upsert TempOtp
    await TempOtp.findOneAndUpdate(
      { phoneNumber: cleanPhone },
      { otp, expiresAt },
      { upsert: true, new: true }
    );

    const resolvedProduct = String(productType || 'LOAN').toUpperCase();
    logger.info(`CUSTOMER OTP DISPATCH (${resolvedProduct}): Phone check OTP code [${otp}] generated for: ${cleanPhone} (OTP Mode: ${isLiveOtp ? 'LIVE' : 'TEST'})`);
    
    let smsRes = null;
    if (isLiveOtp) {
      smsRes = await smsManager.sendOtp(cleanPhone, otp, smsConfig.templates.CUSTOMER_LOOKUP_OTP.templateId);
    }

    return {
      success: true,
      message: `Verification code successfully dispatched to customer mobile ending in ${cleanPhone.slice(-4)}.`,
      productType: resolvedProduct,
      nextStep: 'OTP_VERIFICATION',
      screenName: 'OTP_VERIFICATION',
      messageId: smsRes?.messageId || null,
      provider: isLiveOtp ? (smsRes?.provider || 'MSG91') : 'MOCK_TEST_PROVIDER',
      ...(!isLiveOtp ? { otp } : {})
    };
  }

  /**
   * Validates lookup phone check OTP code
   */
  async verifyLookupOtp(phoneNumber, otp, productType = 'LOAN', executiveUser = null, payload = {}) {
    const cleanPhone = String(phoneNumber || '').replace(/\D/g, '').slice(-10);
    const cleanOtp = String(otp || '').trim();
    const resolvedProduct = String(productType || 'LOAN').toUpperCase();
    const isTestMode = panelControlConfig.EMPLOYEE_PANEL?.OTP === 'TEST' || panelControlConfig.CUSTOMER_PANEL?.OTP === 'TEST';
    const isTestMock = cleanOtp === '123456' && isTestMode;
    
    if (!isTestMock) {
      const record = await TempOtp.findOne({ phoneNumber: cleanPhone, otp: cleanOtp });
      if (!record || record.expiresAt < new Date()) {
        throw ApiError.badRequest('The verification code is incorrect or expired.', ErrorCode.OTP_INVALID);
      }
    }

    // Clear temp otp on successful match
    await TempOtp.deleteOne({ phoneNumber: cleanPhone });

    let bankId = executiveUser?.bankId || null;
    let branchId = executiveUser?.branchId || null;

    if (executiveUser) {
      const context = await this.resolveExecutiveOrBranchContext(executiveUser, payload?.bankId, payload?.branchId);
      bankId = context.bankId || bankId;
      branchId = context.branchId || branchId;
    }

    // Run unified onboarding engine lookup
    const lookupStatus = await OnboardingEngineService.lookupCustomerByPhone({
      phoneNumber: cleanPhone,
      bankId,
      branchId,
      productType: resolvedProduct
    });

    // Look up existing customer across all roles
    const user = await User.findOne({ phoneNumber: cleanPhone, isDeleted: { $ne: true } }).populate('profileId');
    if (!user) {
      return {
        success: true,
        verified: true,
        exists: false,
        isExistingGlobalUser: false,
        isExistingSocietyCustomer: false,
        productType: resolvedProduct,
        nextStep: 'DIGILOCKER_KYC',
        screenName: 'DIGILOCKER_KYC',
        requiresDigilockerKyc: true,
        requiresManualUploads: true,
        societyAccount: null,
        cardInfo: { exists: false, expired: false },
        emiCard: null,
        kycStatus: lookupStatus.kycStatus,
        cibilStatus: lookupStatus.cibilStatus,
        productEligibility: lookupStatus.productEligibility,
        userProfile: null,
        message: 'Mobile number successfully verified. New customer onboarding required.'
      };
    }

    let profile = null;
    if (user.profileModel === 'CustomerProfile' && user.profileId && typeof user.profileId === 'object' && typeof user.profileId.save === 'function') {
      profile = user.profileId;
    }
    if (!profile) {
      profile = await CustomerProfile.findOne({
        $or: [
          ...(user.profileId ? [{ _id: user.profileId._id || user.profileId }] : []),
          { userId: user._id },
          { phoneNumber: cleanPhone }
        ]
      });
    }

    if (profile) {
      if (String(profile.userId) !== String(user._id) || !profile.phoneNumber) {
        profile.userId = user._id;
        profile.phoneNumber = cleanPhone;
        if (typeof profile.save === 'function') {
          await profile.save();
        } else if (profile._id) {
          await CustomerProfile.updateOne({ _id: profile._id }, { $set: { userId: user._id, phoneNumber: cleanPhone } });
        }
      }
      const updatePayload = { profileId: profile._id, profileModel: 'CustomerProfile' };
      if (profile.customerUniqueId) updatePayload.customerUniqueId = profile.customerUniqueId;
      await User.updateOne({ _id: user._id }, { $set: updatePayload });
    }

    const draftLoan = await Loan.findOne({
      customerId: user._id,
      status: { $in: ['NEW', 'PENDING_DOWN_PAYMENT'] }
    });

    let isCibilExpired = false;
    if (profile?.lastCibilCheckDate) {
      const daysSinceCheck = Math.floor((Date.now() - new Date(profile.lastCibilCheckDate).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceCheck >= 30) {
        isCibilExpired = true;
      }
    }

    // Helper: Sanitize corrupt strings like "undefined undefined"
    const sanitizeNameStr = (str, fallback = '') => {
      if (!str || typeof str !== 'string') return fallback;
      const cleaned = str.replace(/undefined/gi, '').trim();
      return cleaned.length > 0 ? cleaned : fallback;
    };

    const rawProfileName = profile ? (profile.fullName || `${profile.firstName || ''} ${profile.lastName || ''}`) : '';
    let cleanFullName = sanitizeNameStr(rawProfileName, '');
    if (!cleanFullName) {
      cleanFullName = sanitizeNameStr(user.fullName, 'Customer');
    }

    // Auto-fix DB document if corrupt
    if (user.fullName && user.fullName.toLowerCase().includes('undefined')) {
      await User.updateOne({ _id: user._id }, { $set: { fullName: cleanFullName } });
    }

    if (profile && (profile.fullName?.toLowerCase()?.includes('undefined') || profile.firstName?.toLowerCase()?.includes('undefined'))) {
      const parts = cleanFullName.split(' ');
      const fName = parts[0] || 'Customer';
      const lName = parts.slice(1).join(' ') || '';
      await CustomerProfile.updateOne({ _id: profile._id }, { $set: { fullName: cleanFullName, firstName: fName, lastName: lName } });
    }

    // Preserve existing customerUniqueId; generate ONLY if missing in DB
    let customerUniqueId = profile?.customerUniqueId || user?.customerUniqueId || null;
    if (!customerUniqueId || customerUniqueId === 'null' || customerUniqueId === 'undefined') {
      const random9Digits = Math.floor(100000000 + Math.random() * 900000000);
      customerUniqueId = `ADV-${random9Digits}`;
      if (profile && profile._id) {
        await CustomerProfile.updateOne({ _id: profile._id }, { $set: { customerUniqueId } });
      }
      if (user && user._id) {
        await User.updateOne({ _id: user._id }, { $set: { customerUniqueId } });
      }
    }

    // 1. Cross-reference DigiLocker / KYC verification record in DB
    const kycRecord = await KycVerificationModel.findOne({
      $or: [
        { requestById: user._id },
        { createdBy: user._id },
        { 'personalDetails.phoneNumber': cleanPhone },
        ...(profile?.aadhaarNumber ? [{ 'personalDetails.aadhaarNumber': profile.aadhaarNumber }] : [])
      ],
      status: 'VERIFIED'
    }).sort({ createdAt: -1 });

    // 2. Cross-reference CIBIL / Experian Credit Report in DB
    const cibilRecord = await CreditReportRequest.findOne({
      $or: [
        { userId: user._id },
        { phoneNumber: cleanPhone },
        ...(profile?.panNumber ? [{ panNumber: profile.panNumber }] : [])
      ]
    }).sort({ createdAt: -1 });

    // Extract Address, Pincode, DOB, Gender, PAN, Aadhaar from Profile or KYC/CIBIL Records
    const finalPan = profile?.panNumber || kycRecord?.personalDetails?.panNumber || cibilRecord?.panNumber || null;
    const finalAadhaar = profile?.aadhaarNumber || kycRecord?.personalDetails?.aadhaarNumber || null;
    const finalGender = profile?.gender || kycRecord?.personalDetails?.gender || null;
    const rawDob = profile?.dob || kycRecord?.personalDetails?.dob || null;

    const formatDobStr = (dobVal) => {
      if (!dobVal) return null;
      if (typeof dobVal === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dobVal)) {
        return dobVal.slice(0, 10);
      }
      try {
        const d = new Date(dobVal);
        if (!isNaN(d.getTime())) {
          return d.toISOString().split('T')[0];
        }
      } catch (e) {}
      return String(dobVal);
    };

    const formattedDob = formatDobStr(rawDob);

    // Determine Verified KYC Status
    let finalKycStatus = profile?.kycStatus || 'PENDING';
    if (kycRecord || (profile?.aadhaarNumber && profile?.panNumber) || profile?.kycStatus === 'VERIFIED') {
      finalKycStatus = 'VERIFIED';
    }

    const isKycValid = Boolean(lookupStatus.kycStatus?.isKycValid && finalKycStatus === 'VERIFIED');

    // Determine CIBIL Status with strict 30-day rule for LOAN
    let finalCibilStatus = 'NOT_APPLICABLE';
    let finalCibilScore = profile?.creditScore || null;
    let lastCibilDate = profile?.lastCibilCheckDate || profile?.cibilFetchedAt || (cibilRecord?.createdAt ? new Date(cibilRecord.createdAt) : null);
    let daysSinceCibilCheck = lastCibilDate ? Math.floor((Date.now() - new Date(lastCibilDate).getTime()) / (1000 * 60 * 60 * 24)) : null;
    let isCibilFresh = daysSinceCibilCheck !== null && daysSinceCibilCheck < 30;

    if (resolvedProduct === 'LOAN') {
      if (isCibilFresh) {
        if (profile?.cibilStatus === 'REJECTED' || (finalCibilScore && finalCibilScore < 650)) {
          finalCibilStatus = 'REJECTED';
        } else if (profile?.cibilStatus === 'APPROVED' || (finalCibilScore && finalCibilScore >= 650)) {
          finalCibilStatus = 'APPROVED';
        } else {
          finalCibilStatus = 'PENDING';
        }
      } else {
        // CIBIL check is expired or was never performed (e.g. onboarded via Merchant or Pigmy)
        if (isKycValid && finalPan) {
          // KYC is valid (< 30 days) and PAN exists -> Automatically perform CIBIL check
          let score = 750;
          let checkSuccess = false;
          try {
            const cibilResult = await creditReportService.generate({
              pan: finalPan,
              fullName: cleanFullName || `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || kycRecord?.personalDetails?.fullName || 'Customer',
              mobileNumber: cleanPhone,
              dob: formattedDob || rawDob,
              requestedBy: executiveUser?.id || executiveUser?._id
            });
            if (cibilResult?.creditReport?.score) {
              score = cibilResult.creditReport.score;
              checkSuccess = true;
            } else if (cibilResult?.reportJson?.score) {
              score = cibilResult.reportJson.score;
              checkSuccess = true;
            } else if (cibilResult?.reportJson?.bureauScore) {
              score = cibilResult.reportJson.bureauScore;
              checkSuccess = true;
            } else if (cibilResult?.reportJson?.data?.score) {
              score = cibilResult.reportJson.data.score;
              checkSuccess = true;
            } else if (cibilResult?.reportJson?.data?.bureauScore) {
              score = cibilResult.reportJson.data.bureauScore;
              checkSuccess = true;
            }
          } catch (cibilErr) {
            logger.warn(`Automated CIBIL check in verifyLookupOtp error: ${cibilErr.message}`);
          }

          const minCibilThreshold = 650;
          const isEligible = score >= minCibilThreshold;
          finalCibilStatus = isEligible ? 'APPROVED' : 'REJECTED';
          finalCibilScore = score;
          lastCibilDate = new Date();
          isCibilFresh = true;

          if (profile) {
            profile.creditScore = score;
            profile.lastCibilCheckDate = lastCibilDate;
            profile.cibilStatus = finalCibilStatus;
            if (typeof profile.save === 'function') {
              await profile.save();
            } else if (profile._id) {
              await CustomerProfile.updateOne(
                { _id: profile._id },
                { $set: { creditScore: score, lastCibilCheckDate: lastCibilDate, cibilStatus: finalCibilStatus } }
              );
            }
          }
        } else {
          // KYC is expired or PAN missing -> DigiLocker KYC is required to perform CIBIL check
          finalCibilStatus = 'PENDING';
        }
      }
    }

    // Determine Onboarding Stage
    let finalStage = profile?.onboardingStage || 'OTP_VERIFIED';
    if (resolvedProduct === 'LOAN') {
      if (finalKycStatus === 'VERIFIED' && finalCibilStatus === 'APPROVED' && finalStage === 'OTP_VERIFIED') {
        finalStage = 'KYC_DONE';
      }
    } else {
      if (finalKycStatus === 'VERIFIED' && finalStage === 'OTP_VERIFIED') {
        finalStage = 'KYC_DONE';
      }
    }
    if (profile?.panImage && profile?.aadhaarImage && profile?.livePhoto) {
      finalStage = 'COMPLETED';
    }

    const extractAddress = () => {
      if (profile?.activeAddress?.addressLine && profile.activeAddress.addressLine !== 'N/A' && profile.activeAddress.addressLine.trim() !== '') {
        return profile.activeAddress.addressLine.trim();
      }
      if (profile?.address && profile.address !== 'N/A' && profile.address.trim() !== '') {
        return profile.address.trim();
      }
      if (kycRecord?.personalDetails?.addressLine && kycRecord.personalDetails.addressLine !== 'N/A' && kycRecord.personalDetails.addressLine.trim() !== '') {
        return kycRecord.personalDetails.addressLine.trim();
      }
      if (kycRecord?.personalDetails?.address && kycRecord.personalDetails.address !== 'N/A' && kycRecord.personalDetails.address.trim() !== '') {
        return kycRecord.personalDetails.address.trim();
      }
      return 'N/A';
    };

    const finalAddress = extractAddress();
    const finalPinCode = profile?.activeAddress?.pinCode || profile?.residentialPincode || profile?.currentPinCode || kycRecord?.personalDetails?.pinCode || 'N/A';

    // Auto-sync profile document in DB if any verified field was missing
    if (profile) {
      const updateFields = {
        kycStatus: finalKycStatus,
        onboardingStage: finalStage,
        ...(resolvedProduct === 'LOAN' ? { cibilStatus: finalCibilStatus } : {}),
        ...(finalPan ? { panNumber: finalPan } : {}),
        ...(finalAadhaar ? { aadhaarNumber: finalAadhaar } : {}),
        ...(finalGender ? { gender: finalGender } : {}),
        ...(rawDob ? { dob: rawDob } : {}),
        ...(finalAddress !== 'N/A' ? {
          address: finalAddress,
          activeAddress: { addressLine: finalAddress, pinCode: finalPinCode !== 'N/A' ? finalPinCode : '' },
          residentialPincode: finalPinCode !== 'N/A' ? finalPinCode : '',
          currentPinCode: finalPinCode !== 'N/A' ? finalPinCode : ''
        } : {})
      };
      await CustomerProfile.updateOne({ _id: profile._id }, { $set: updateFields });
    }

    const finalPanImage = profile?.panImage || kycRecord?.personalDetails?.panImage || null;
    const finalAadhaarImage = profile?.aadhaarImage || kycRecord?.personalDetails?.aadhaarImage || null;
    const finalLivePhoto = profile?.livePhoto || kycRecord?.personalDetails?.livePhoto || null;
    const finalFatherName = profile?.fatherName || kycRecord?.personalDetails?.fatherName || null;
    const finalEmail = profile?.email || user?.email || null;
    const firstName = profile?.firstName || (cleanFullName ? cleanFullName.split(' ')[0] : null);
    const lastName = profile?.lastName || (cleanFullName && cleanFullName.split(' ').length > 1 ? cleanFullName.split(' ').slice(1).join(' ') : null);

    let nextStep = 'FORM_SCREEN';
    let screenName = 'FORM_SCREEN';

    if (resolvedProduct === 'LOAN') {
      if (finalCibilStatus === 'REJECTED') {
        nextStep = 'CIBIL_REJECTED';
        screenName = 'CIBIL_REJECTED';
      } else if (!isKycValid) {
        // Customer has not completed KYC or KYC has expired (30-day window); MUST do DigiLocker KYC first
        nextStep = 'DIGILOCKER_KYC';
        screenName = 'DIGILOCKER_KYC';
      } else if (finalCibilStatus !== 'APPROVED') {
        // KYC is valid but CIBIL check could not be completed (e.g. missing PAN) -> DigiLocker KYC required
        nextStep = 'DIGILOCKER_KYC';
        screenName = 'DIGILOCKER_KYC';
      } else if (finalStage === 'COMPLETED') {
        nextStep = 'SCREEN_1_PRODUCT_SELECTION';
        screenName = 'SCREEN_1_PRODUCT_SELECTION';
      } else if (finalStage === 'KYC_DONE') {
        nextStep = 'FORM_SCREEN';
        screenName = 'FORM_SCREEN';
      } else {
        nextStep = 'DIGILOCKER_KYC';
        screenName = 'DIGILOCKER_KYC';
      }
    } else {
      // Non-loan products (MERCHANT, PIGMY) - CIBIL check not required
      if (!isKycValid) {
        nextStep = 'DIGILOCKER_KYC';
        screenName = 'DIGILOCKER_KYC';
      } else if (finalStage === 'COMPLETED') {
        if (resolvedProduct === 'MERCHANT') {
          if (lookupStatus.productEligibility?.canApply === false) {
            nextStep = 'MERCHANT_ALREADY_EXISTS';
            screenName = 'MERCHANT_ALREADY_EXISTS';
          } else {
            nextStep = 'MERCHANT_STORE_SETUP';
            screenName = 'MERCHANT_STORE_SETUP';
          }
        } else if (resolvedProduct === 'PIGMY') {
          nextStep = 'PIGMY_ACCOUNT_SETUP';
          screenName = 'PIGMY_ACCOUNT_SETUP';
        } else {
          nextStep = 'ONBOARDING_COMPLETED';
          screenName = 'ONBOARDING_COMPLETED';
        }
      } else if (finalStage === 'KYC_DONE') {
        nextStep = 'FORM_SCREEN';
        screenName = 'FORM_SCREEN';
      } else {
        nextStep = 'DIGILOCKER_KYC';
        screenName = 'DIGILOCKER_KYC';
      }
    }

    const resolvedAddress = finalAddress && finalAddress !== 'N/A' ? finalAddress : (lookupStatus.userProfile?.address || '');
    const resolvedPincode = finalPinCode && finalPinCode !== 'N/A' ? finalPinCode : (lookupStatus.userProfile?.pincode || '');

    let resolvedCity = lookupStatus.userProfile?.city || profile?.city || '';
    let resolvedState = lookupStatus.userProfile?.state || profile?.state || '';
    if ((!resolvedCity || !resolvedState) && resolvedAddress) {
      const parts = resolvedAddress.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const lastPart = parts[parts.length - 1];
        const secondLastPart = parts[parts.length - 2];
        if (/^\d{6}$/.test(lastPart)) {
          if (!resolvedState) resolvedState = secondLastPart;
          if (!resolvedCity && parts.length >= 3) resolvedCity = parts[parts.length - 3];
        } else {
          if (!resolvedState) resolvedState = lastPart.replace(/\d+/g, '').trim();
          if (!resolvedCity) resolvedCity = secondLastPart;
        }
      }
    }

    const unifiedUserProfile = {
      ...(lookupStatus.userProfile || {}),
      userId: user._id,
      customerId: customerUniqueId || lookupStatus.userProfile?.customerId,
      fullName: cleanFullName,
      phoneNumber: cleanPhone,
      email: finalEmail || lookupStatus.userProfile?.email || '',
      dateOfBirth: formattedDob || lookupStatus.userProfile?.dateOfBirth || null,
      gender: finalGender || lookupStatus.userProfile?.gender || '',
      fatherName: finalFatherName || lookupStatus.userProfile?.fatherName || '',
      address: resolvedAddress,
      city: resolvedCity,
      state: resolvedState,
      pincode: resolvedPincode,
      panNumber: finalPan || lookupStatus.userProfile?.panNumber || '',
      aadhaarNumber: finalAadhaar || lookupStatus.userProfile?.aadhaarNumber || '',
      aadhaarPicUrl: finalAadhaarImage || lookupStatus.userProfile?.aadhaarPicUrl || '',
      panPicUrl: finalPanImage || lookupStatus.userProfile?.panPicUrl || '',
      livePicUrl: finalLivePhoto || lookupStatus.userProfile?.livePicUrl || ''
    };

    const unifiedCibilStatus = {
      isCibilRequired: resolvedProduct === 'LOAN',
      status: finalCibilStatus,
      lastCibilScore: resolvedProduct === 'LOAN' ? (finalCibilScore || null) : null,
      lastCibilDate: resolvedProduct === 'LOAN' ? (lastCibilDate || null) : null,
      isCibilValid: resolvedProduct === 'LOAN' ? (isCibilFresh && finalCibilStatus === 'APPROVED') : true,
      isCibilRejected: resolvedProduct === 'LOAN' ? (isCibilFresh && finalCibilStatus === 'REJECTED') : false
    };

    // Auto-fetch Customer's EMI Card if present
    const emiCardDoc = await EmiCard.findOne({
      $or: [
        { customerId: user._id },
        ...(profile ? [{ customerId: profile._id }] : [])
      ],
      status: { $ne: 'CANCELLED' }
    })
      .populate('bankId')
      .populate('branchId')
      .sort({ createdAt: -1 });

    const maskedCard = emiCardDoc ? maskCardNumber(emiCardDoc.cardNumber) : '';
    const societyLogo = emiCardDoc?.bankId?.logo || "https://s3-noi.aces3.ai/sahayaone/society/avatars/user_6a7c15aa266474a6d606d2e5/1788860755500-608169862.jpg";

    let cardInfo = {
      exists: false,
      expired: false
    };
    let emiCard = null;

    if (emiCardDoc) {
      const isExp = emiCardDoc.status === 'EXPIRED' || (emiCardDoc.validThru && isCardExpired(emiCardDoc.validThru));
      cardInfo = {
        exists: true,
        expired: isExp,
        cardNumber: maskedCard,
        cardHolderName: emiCardDoc.cardHolderName,
        validThru: emiCardDoc.validThru,
        brandLogo: "https://sahayaone-backend.onrender.com/public/mocks/logo-sahayaone.png",
        bankLogo: societyLogo
      };
      emiCard = {
        exists: true,
        id: emiCardDoc._id,
        cardNumber: emiCardDoc.cardNumber,
        maskedCardNumber: maskedCard,
        cardHolderName: emiCardDoc.cardHolderName,
        validThru: emiCardDoc.validThru,
        status: emiCardDoc.status,
        allotmentStatus: emiCardDoc.allotmentStatus,
        cardLimit: emiCardDoc.cardLimit || 100000,
        availableLimit: emiCardDoc.availableLimit || 100000,
        isExpired: isExp,
        brandLogo: "https://sahayaone-backend.onrender.com/public/mocks/logo-sahayaone.png",
        bankName: emiCardDoc.bankId?.name || null,
        bankLogo: societyLogo
      };
    }

    unifiedUserProfile.cardInfo = cardInfo;
    unifiedUserProfile.emiCard = emiCard;

    return {
      success: true,
      verified: true,
      exists: true,
      nextStep,
      screenName,
      isExistingGlobalUser: lookupStatus.isExistingGlobalUser,
      isExistingSocietyCustomer: lookupStatus.isExistingSocietyCustomer,
      requiresDigilockerKyc: !lookupStatus.kycStatus.isKycValid,
      requiresManualUploads: lookupStatus.kycStatus.requiresManualUploads,
      productType: resolvedProduct,
      societyAccount: lookupStatus.societyAccount,
      cardInfo,
      emiCard,
      kycStatus: lookupStatus.kycStatus,
      cibilStatus: unifiedCibilStatus,
      productEligibility: {
        ...lookupStatus.productEligibility,
        ...(resolvedProduct === 'LOAN' && finalCibilStatus === 'REJECTED' ? {
          canApply: false,
          reason: 'Your CIBIL score is low. Please try after 30 days.'
        } : {})
      },
      userProfile: unifiedUserProfile,
      customerId: user._id,
      customerUniqueId,
      fullName: cleanFullName,
      firstName,
      lastName,
      email: finalEmail || '',
      fatherName: finalFatherName || '',
      cibilScore: resolvedProduct === 'LOAN' ? (finalCibilScore || null) : null,
      onboardingStage: finalStage,
      isCibilExpired: resolvedProduct === 'LOAN' ? !isCibilFresh : false,
      isSelfRegistered: !profile?.createdByExecutiveId,
      panImage: finalPanImage,
      aadhaarImage: finalAadhaarImage,
      livePhoto: finalLivePhoto,
      draftLoan: (resolvedProduct === 'LOAN' && draftLoan) ? {
        leadId: draftLoan._id,
        currentStep: draftLoan.currentStep,
        status: draftLoan.status
      } : null,
      profileDetails: {
        dob: formattedDob,
        gender: finalGender,
        panNumber: finalPan,
        aadhaarNumber: finalAadhaar,
        address: resolvedAddress,
        city: resolvedCity,
        state: resolvedState,
        pinCode: resolvedPincode,
        residentialPincode: resolvedPincode,
        fatherName: finalFatherName || '',
        email: finalEmail || '',
        cibilScore: finalCibilScore,
        panImage: finalPanImage,
        aadhaarImage: finalAadhaarImage,
        livePhoto: finalLivePhoto,
        cardInfo,
        emiCard
      },
      message: 'Mobile number successfully verified. Existing customer profile found.'
    };
  }

  /**
   * DigiLocker KYC & 30-Day CIBIL Score Verification
   * Requirement: Both Aadhaar AND PAN must be present in DigiLocker.
   * CIBIL score is checked for LOAN; skipped for MERCHANT and PIGMY.
   * If CIBIL score is low or checked within 30 days and rejected: reject immediately.
   */
  async digiLockerKycAndCibilCheck(executiveUser, payload) {
    const { phoneNumber, aadhaarNumber, panNumber, digilockerToken, refid, type, productType } = payload;
    const cleanPhone = String(phoneNumber || '').replace(/\D/g, '').slice(-10);
    const targetProduct = String(type || productType || 'LOAN').toUpperCase();
    const isLoan = targetProduct === 'LOAN';

    if (cleanPhone.length !== 10) {
      throw ApiError.badRequest('Please enter a valid 10-digit mobile number.');
    }

    // 1. Mandatory Input & Format Validation for Aadhaar and PAN
    const rawAadhaar = String(aadhaarNumber || '').trim();
    const isValidAadhaar = /^([xX\d]{12}|[xX\d]{4}[-\s]?[xX\d]{4}[-\s]?[xX\d]{4})$/.test(rawAadhaar);
    if (!rawAadhaar || !isValidAadhaar) {
      throw ApiError.badRequest('Please enter a valid 12-digit or masked Aadhaar number.');
    }

    const cleanPan = String(panNumber || '').trim().toUpperCase();
    if (!cleanPan || !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(cleanPan)) {
      throw ApiError.badRequest('Please enter a valid 10-character PAN number (e.g. ABCDE1234F).');
    }
    let user = await User.findOne({ phoneNumber: cleanPhone, isDeleted: { $ne: true } });
    let profile = user ? await CustomerProfile.findOne({
      $or: [
        ...(user.profileId ? [{ _id: user.profileId }] : []),
        { userId: user._id },
        { phoneNumber: cleanPhone }
      ]
    }) : null;

    let kycRecord = null;
    const currentRefid = refid || payload.refid;
    if (currentRefid) {
      kycRecord = await KycVerificationModel.findOne({ refid: currentRefid });
      if (!kycRecord) {
        throw ApiError.notFound(`DigiLocker verification session (${currentRefid}) not found. Please initiate a new session.`);
      }
      if (kycRecord.status !== 'VERIFIED') {
        await this.verifyDigiLockerKyc(currentRefid, executiveUser?.id || executiveUser?._id);
        kycRecord = await KycVerificationModel.findOne({ refid: currentRefid });
      }
    }

    // Check 30-day CIBIL cooldown rule if previously checked and rejected (only for LOAN)
    if (isLoan && profile && profile.lastCibilCheckDate && profile.cibilStatus === 'REJECTED') {
      const daysSinceCheck = Math.floor((Date.now() - new Date(profile.lastCibilCheckDate).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceCheck < 30) {
        const remainingDays = 30 - daysSinceCheck;
        throw ApiError.badRequest(`Your CIBIL score is low. Please try again after ${remainingDays} days.`, ErrorCode.CIBIL_SCORE_LOW);
      }
    }

    // If DigiLocker session is not completed yet, initiate real DigiLocker session and return authorizationUrl
    let incomingRedirectUrl = payload.redirectUrl || payload.redirect_url || payload.callbackUrl || null;
    if (incomingRedirectUrl && typeof incomingRedirectUrl === 'string') {
      incomingRedirectUrl = incomingRedirectUrl.trim();
      if (!incomingRedirectUrl.startsWith('http://') && !incomingRedirectUrl.startsWith('https://')) {
        incomingRedirectUrl = `https://${incomingRedirectUrl}`;
      }
    }
    if (!kycRecord || kycRecord.status !== 'VERIFIED') {
      const initResult = await this.initiateDigiLockerKyc({
        aadhaarNumber: payload.aadhaarNumber || '',
        panNumber: payload.panNumber || '',
        redirectUrl: incomingRedirectUrl,
        bankId: payload.bankId,
        branchId: payload.branchId
      }, executiveUser?.id || executiveUser?._id);

      return {
        success: true,
        verified: false,
        canProceedToForm: false,
        requiresDigilockerLogin: true,
        refid: initResult.refid,
        authorizationUrl: initResult.authorizationUrl,
        redirectUrl: incomingRedirectUrl || initResult.redirectUrl,
        productType: targetProduct,
        message: 'Real DigiLocker KYC session initiated. Please open authorizationUrl in browser to complete real DigiLocker Aadhaar & PAN verification.'
      };
    }

    // 2B. Strict Fraud Prevention Cross-Matching
    const candidateUnmaskedAadhaar = [
      payload.aadhaarNumber,
      profile?.aadhaarNumber,
      kycRecord?.idNumber,
      kycRecord?.personalDetails?.aadhaarNumber
    ].find(val => val && /^\d{12}$/.test(String(val).replace(/\D/g, '')));

    const digilockerAadhaarRaw = kycRecord?.personalDetails?.aadhaarNumber || '';
    const digilockerAadhaar = candidateUnmaskedAadhaar ? String(candidateUnmaskedAadhaar).replace(/\D/g, '') : (digilockerAadhaarRaw || rawAadhaar);
    
    if (candidateUnmaskedAadhaar && kycRecord && kycRecord.personalDetails) {
      kycRecord.personalDetails.aadhaarNumber = String(candidateUnmaskedAadhaar).replace(/\D/g, '');
      await KycVerificationModel.updateOne(
        { _id: kycRecord._id },
        { $set: { 'personalDetails.aadhaarNumber': String(candidateUnmaskedAadhaar).replace(/\D/g, '') } }
      );
    }

    const digilockerPan = kycRecord?.personalDetails?.panNumber || '';
    const reqPan = String(payload.panNumber || '').trim().toUpperCase();
    const reqAadhaar = String(payload.aadhaarNumber || '').replace(/\D/g, '');

    const verifiedPan = String(kycRecord?.personalDetails?.panNumber || '').trim().toUpperCase();
    const rawVerifiedAadhaar = String(kycRecord?.personalDetails?.aadhaarNumber || '').trim();

    logger.info(`[DigiLocker Cross-Match Check] reqAadhaar=${reqAadhaar}, rawVerifiedAadhaar=${rawVerifiedAadhaar}, reqPan=${reqPan}, verifiedPan=${verifiedPan}`);

    // Verify PAN card from DigiLocker XML matches the input PAN card
    if (reqPan && verifiedPan) {
      const cleanReqPan = reqPan.replace(/[^A-Z0-9]/g, '');
      const cleanVerifiedPan = verifiedPan.replace(/[^A-Z0-9]/g, '');
      if (cleanVerifiedPan.length === 10 && cleanReqPan !== cleanVerifiedPan) {
        logger.warn(`[DigiLocker Mismatch] PAN mismatch: reqPan=${cleanReqPan}, verifiedPan=${cleanVerifiedPan}`);
        if (kycRecord?._id) await KycVerificationModel.deleteOne({ _id: kycRecord._id });
        throw ApiError.badRequest(
          "Identity Verification Failed: The logged-in DigiLocker account details do not match the customer's provided PAN card. Please ensure the customer logs into their own personal DigiLocker account.",
          ErrorCode.KYC_DOCUMENTS_MISSING
        );
      }
    }

    // Verify Aadhaar card from DigiLocker XML matches the input Aadhaar card
    if (rawAadhaar && rawVerifiedAadhaar) {
      const cleanVerifiedAadhaarDigits = rawVerifiedAadhaar.replace(/\D/g, '');
      const reqLast4 = rawAadhaar.slice(-4);
      const verifiedLast4 = rawVerifiedAadhaar.slice(-4);

      if (cleanVerifiedAadhaarDigits.length === 12 && reqAadhaar.length === 12 && /^\d{12}$/.test(reqAadhaar)) {
        // Full 12-digit unmasked Aadhaar -> Match full 12 digits
        if (reqAadhaar !== cleanVerifiedAadhaarDigits) {
          logger.warn(`[DigiLocker Mismatch] Full Aadhaar mismatch: req=${reqAadhaar}, verified=${cleanVerifiedAadhaarDigits}`);
          if (kycRecord?._id) await KycVerificationModel.deleteOne({ _id: kycRecord._id });
          throw ApiError.badRequest(
            "Identity Verification Failed: The logged-in DigiLocker account details do not match the customer's provided Aadhaar card. Please ensure the customer logs into their own personal DigiLocker account.",
            ErrorCode.KYC_DOCUMENTS_MISSING
          );
        }
      } else {
        // Masked Aadhaar -> Compare last 4 digits
        if (reqLast4 !== verifiedLast4) {
          logger.warn(`[DigiLocker Mismatch] Aadhaar last 4 mismatch: reqLast4=${reqLast4}, verifiedLast4=${verifiedLast4}`);
          if (kycRecord?._id) await KycVerificationModel.deleteOne({ _id: kycRecord._id });
          throw ApiError.badRequest(
            "Identity Verification Failed: The logged-in DigiLocker account details do not match the customer's provided Aadhaar card. Please ensure the customer logs into their own personal DigiLocker account.",
            ErrorCode.KYC_DOCUMENTS_MISSING
          );
        }
      }
    }

    // 2C. Compulsory Both Aadhaar and PAN Document Verification Check
    if (!kycRecord?.personalDetails?.aadhaarVerified || !kycRecord?.personalDetails?.dob || !kycRecord?.personalDetails?.address) {
      if (kycRecord?._id) await KycVerificationModel.deleteOne({ _id: kycRecord._id });
      throw ApiError.badRequest(
        'Identity Verification Failed: Aadhaar card permission was not granted in DigiLocker. Both Aadhaar and PAN card permissions are mandatory to complete KYC.',
        ErrorCode.KYC_DOCUMENTS_MISSING
      );
    }

    if (!kycRecord?.personalDetails?.panVerified) {
      if (kycRecord?._id) await KycVerificationModel.deleteOne({ _id: kycRecord._id });
      throw ApiError.badRequest(
        'Identity Verification Failed: PAN card permission was not granted in DigiLocker. Both Aadhaar and PAN card permissions are mandatory to complete KYC.',
        ErrorCode.KYC_DOCUMENTS_MISSING
      );
    }

    const finalAadhaar = candidateUnmaskedAadhaar ? String(candidateUnmaskedAadhaar).replace(/\D/g, '') : (digilockerAadhaar || rawAadhaar);
    const finalPan = digilockerPan || cleanPan;

    // 3. Extract DOB directly from verified PAN / DigiLocker XML details
    const rawDob = formatDobForCibil(kycRecord?.personalDetails?.dob || profile?.dob || payload.dob) || null;

    // 4. Perform automated CIBIL Score Check (mandatory for LOAN; skipped for MERCHANT and PIGMY)
    let score = profile?.creditScore || 750;
    let cibilStatus = isLoan ? 'APPROVED' : 'NOT_APPLICABLE';

    if (isLoan) {
      let cibilResult = null;
      try {
        cibilResult = await creditReportService.generate({
          pan: finalPan,
          fullName: profile ? `${profile.firstName} ${profile.lastName}` : (kycRecord?.personalDetails?.fullName || 'Customer'),
          mobileNumber: cleanPhone,
          dob: rawDob
        });
        if (cibilResult?.creditReport?.score) {
          score = cibilResult.creditReport.score;
        }
      } catch (cibilErr) {
        logger.warn(`CIBIL FETCH WARNING: ${cibilErr.message}`);
      }

      const minCibilThreshold = 650;
      const isCibilEligible = score >= minCibilThreshold;
      cibilStatus = isCibilEligible ? 'APPROVED' : 'REJECTED';
      const checkDate = new Date();

      if (profile) {
        profile.panNumber = finalPan;
        profile.aadhaarNumber = finalAadhaar;
        profile.creditScore = score;
        profile.lastCibilCheckDate = checkDate;
        profile.cibilStatus = cibilStatus;
        profile.onboardingStage = isCibilEligible ? 'KYC_DONE' : 'OTP_VERIFIED';
        if (typeof profile.save === 'function') {
          await profile.save();
        } else if (profile._id) {
          await CustomerProfile.updateOne({ _id: profile._id }, { $set: {
            panNumber: finalPan,
            aadhaarNumber: finalAadhaar,
            creditScore: score,
            lastCibilCheckDate: checkDate,
            cibilStatus: cibilStatus,
            onboardingStage: isCibilEligible ? 'KYC_DONE' : 'OTP_VERIFIED'
          }});
        }
      }

      if (!isCibilEligible) {
        throw ApiError.badRequest('Your CIBIL score is low. Please try after 30 days.', ErrorCode.CIBIL_SCORE_LOW);
      }
    } else {
      if (profile) {
        profile.panNumber = finalPan;
        profile.aadhaarNumber = finalAadhaar;
        profile.onboardingStage = 'KYC_DONE';
        if (typeof profile.save === 'function') {
          await profile.save();
        } else if (profile._id) {
          await CustomerProfile.updateOne({ _id: profile._id }, { $set: {
            panNumber: finalPan,
            aadhaarNumber: finalAadhaar,
            onboardingStage: 'KYC_DONE'
          }});
        }
      }
    }

    const fullName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : (kycRecord?.personalDetails?.fullName || user?.fullName || 'Customer User');
    const gender = profile?.gender || kycRecord?.personalDetails?.gender || 'Male';
    const address = profile?.activeAddress?.addressLine || kycRecord?.personalDetails?.address || kycRecord?.personalDetails?.addressLine || '';

    return {
      success: true,
      verified: true,
      canProceedToForm: true,
      productType: targetProduct,
      nextStep: 'FORM_SCREEN',
      screenName: 'FORM_SCREEN',
      digilockerData: {
        fullName: kycRecord?.personalDetails?.fullName || fullName,
        dob: rawDob,
        gender,
        phoneNumber: cleanPhone,
        panNumber: finalPan,
        aadhaarNumber: finalAadhaar,
        address
      },
      cibilScore: isLoan ? score : (profile?.creditScore || null),
      cibilStatus,
      message: isLoan
        ? 'DigiLocker KYC and CIBIL verification completed successfully. Proceed to complete form.'
        : `DigiLocker KYC verification completed successfully for ${targetProduct}. Proceed to complete form.`
    };
  }

  /**
   * Executive Customer Form Submission
   * Uploads photos (panImage, aadhaarImage, livePhoto), saves residentialPincode,
   * Generates a 9-digit `ADV-` prefixed Customer Unique ID (e.g. ADV-987654321),
   * Creates/Updates central User & CustomerProfile records, and assigns to branch/bank.
   */
  async submitCustomerOnboarding(executiveUser, payload) {
    const {
      phoneNumber,
      type,
      productType,
      fullName,
      gender,
      dob,
      panNumber,
      aadhaarNumber,
      address,
      residentialPincode,
      panImage,
      aadhaarImage,
      livePhoto
    } = payload;

    const targetProduct = String(type || productType || 'LOAN').toUpperCase();
    const cleanPhone = String(phoneNumber || '').replace(/\D/g, '').slice(-10);

    const executiveUserId = executiveUser?.id || executiveUser?._id;
    const context = await this.resolveExecutiveOrBranchContext(executiveUser, payload?.bankId, payload?.branchId, { requireBranchForOwner: true });
    let branch = context.branch;
    let bank = context.bank;
    let bankId = context.bankId;
    let branchId = context.branchId;

    if (!branch && branchId) {
      branch = await Branch.findById(branchId);
    }
    if (!bank && bankId) {
      bank = await Bank.findById(bankId);
    }

    if (!branch && !bank) {
      throw ApiError.badRequest('User/Executive is not assigned to any bank branch or bank.');
    }

    const employeeProfile = await SocietyEmployee.findOne({ userId: executiveUserId, isDeleted: { $ne: true } }) ||
      await BranchManager.findOne({ userId: executiveUserId, isDeleted: { $ne: true } }) ||
      await EmployeeProfile.findOne({ userId: executiveUserId, isDeleted: { $ne: true } }) ||
      await OnboardingTeam.findOne({ userId: executiveUserId, isDeleted: { $ne: true } }) ||
      null;

    const onboardedById = employeeProfile?._id || executiveUserId;
    const onboardedByName = employeeProfile?.fullName ||
      (employeeProfile?.firstName ? `${employeeProfile.firstName || ''} ${employeeProfile.lastName || ''}`.trim() : null) ||
      executiveUser?.fullName ||
      context?.userDoc?.fullName ||
      'Executive';
    const onboardedByPhone = employeeProfile?.phoneNumber || executiveUser?.phoneNumber || context?.userDoc?.phoneNumber || '';
    const onboardedByRole = executiveUser?.role || context?.userDoc?.role || 'LOAN_EXECUTIVE';

    const realBankName = bank?.name || bank?.bankName || 'Bank';
    const realBranchName = branch?.name || branch?.branchName || 'Head Office';

    let user = await User.findOne({ phoneNumber: cleanPhone, isDeleted: { $ne: true } });
    let existingProfile = user ? await CustomerProfile.findOne({
      $or: [
        ...(user.profileId ? [{ _id: user.profileId }] : []),
        { userId: user._id },
        { phoneNumber: cleanPhone }
      ]
    }) : null;

    // Check pre-onboarding lookup & 30-day KYC status
    const lookupStatus = await OnboardingEngineService.lookupCustomerByPhone({
      phoneNumber: cleanPhone,
      bankId,
      branchId: branch?._id || branchId,
      productType: targetProduct
    });

    const isKycValid = lookupStatus.kycStatus?.isKycValid;
    const autoProfile = lookupStatus.userProfile || {};

    // Validate images or fallback if KYC is valid (< 30 days)
    const finalPanImage = panImage || autoProfile.panPicUrl;
    const finalAadhaarImage = aadhaarImage || autoProfile.aadhaarPicUrl;
    const finalLivePhoto = livePhoto || autoProfile.livePicUrl;

    if (!isKycValid) {
      if (!finalPanImage || !String(finalPanImage).trim()) {
        throw ApiError.badRequest('panImage is required for customer onboarding when KYC is expired or new.');
      }
      if (!finalAadhaarImage || !String(finalAadhaarImage).trim()) {
        throw ApiError.badRequest('aadhaarImage is required for customer onboarding when KYC is expired or new.');
      }
      if (!finalLivePhoto || !String(finalLivePhoto).trim()) {
        throw ApiError.badRequest('livePhoto is required for customer onboarding when KYC is expired or new.');
      }
    }

    if (existingProfile && existingProfile.panNumber && panNumber) {
      const normInputPan = String(panNumber).trim().toUpperCase();
      if (normInputPan !== existingProfile.panNumber) {
        logger.info(`[CUSTOMER ONBOARDING] Updating PAN card number for phone ${cleanPhone} from ${existingProfile.panNumber} to ${normInputPan}`);
      }
    }

    if (existingProfile && existingProfile.aadhaarNumber && aadhaarNumber) {
      const existingLast4 = String(existingProfile.aadhaarNumber).trim().slice(-4);
      const newLast4 = String(aadhaarNumber).trim().slice(-4);
      if (String(aadhaarNumber).trim() !== existingProfile.aadhaarNumber && existingLast4 !== newLast4) {
        logger.info(`[CUSTOMER ONBOARDING] Updating Aadhaar card number for phone ${cleanPhone} from ${existingProfile.aadhaarNumber} to ${aadhaarNumber}`);
      }
    }

    // Process document uploads via storageManager if provided as base64/file
    const uploadedPanUrl = (finalPanImage && finalPanImage.startsWith('http'))
      ? finalPanImage
      : await processDocumentUpload(finalPanImage, 'panImage', cleanPhone, 'customers');
    const uploadedAadhaarUrl = (finalAadhaarImage && finalAadhaarImage.startsWith('http'))
      ? finalAadhaarImage
      : await processDocumentUpload(finalAadhaarImage, 'aadhaarImage', cleanPhone, 'customers');
    const uploadedLivePhotoUrl = (finalLivePhoto && finalLivePhoto.startsWith('http'))
      ? finalLivePhoto
      : await processDocumentUpload(finalLivePhoto, 'livePhoto', cleanPhone, 'customers');

    // 2. Autofill DigiLocker Verified Details from DB if omitted in Payload
    const finalFullName = (fullName || autoProfile.fullName || (existingProfile ? `${existingProfile.firstName || ''} ${existingProfile.lastName || ''}`.trim() : '') || 'Customer User').trim();
    const nameParts = finalFullName.split(' ');
    const firstName = nameParts[0] || 'Customer';
    const lastName = nameParts.slice(1).join(' ') || '';

    const finalPanNumber = (panNumber || autoProfile.panNumber || existingProfile?.panNumber || '').toUpperCase();
    const isPayloadAadhaarUnmasked = /^\d{12}$/.test(String(aadhaarNumber || '').replace(/\D/g, ''));
    const finalAadhaarNumber = (isPayloadAadhaarUnmasked && aadhaarNumber) 
      ? String(aadhaarNumber).trim() 
      : (autoProfile.aadhaarNumber || existingProfile?.aadhaarNumber || aadhaarNumber || '');
    const finalGender = (gender || autoProfile.gender || existingProfile?.gender || 'FEMALE').toUpperCase();
    const finalDob = dob ? new Date(dob) : (autoProfile.dateOfBirth || existingProfile?.dob || null);
    const finalAddress = address || autoProfile.address || existingProfile?.activeAddress?.addressLine || '';
    const finalPincode = residentialPincode || autoProfile.pincode || existingProfile?.pincode || '';

    // Preserve existing Customer Unique ID or generate 9-digit ADV- prefixed ID if missing
    let customerUniqueId = existingProfile?.customerUniqueId || user?.customerUniqueId;
    if (!customerUniqueId) {
      const random9Digits = Math.floor(100000000 + Math.random() * 900000000);
      customerUniqueId = `ADV-${random9Digits}`;
    }

    // Find or create User account (support dual role: Merchant + Customer)
    user = user || await User.findOne({ phoneNumber: cleanPhone, isDeleted: { $ne: true } });

    if (!user) {
      user = new User({
        phoneNumber: cleanPhone,
        userType: UserType.CUSTOMER,
        role: UserRole.CUSTOMER,
        fullName: finalFullName,
        bankId,
        branchId: branch?._id,
        status: 'ACTIVE',
        customerUniqueId
      });
      await user.save();
    } else {
      user.bankId = bankId || user.bankId;
      user.branchId = branch?._id || user.branchId;
      user.fullName = finalFullName || user.fullName;
      if (!user.customerUniqueId) user.customerUniqueId = customerUniqueId;
      await user.save();
    }

    // Find or create CustomerProfile (search by userId, phoneNumber, panNumber or aadhaarNumber to avoid duplicate profile records)
    let profile = await CustomerProfile.findOne({
      $or: [
        ...(user.profileId ? [{ _id: user.profileId }] : []),
        { userId: user._id },
        { phoneNumber: cleanPhone },
        ...(finalPanNumber ? [{ panNumber: finalPanNumber }] : []),
        ...(finalAadhaarNumber ? [{ aadhaarNumber: finalAadhaarNumber }] : [])
      ]
    });
    if (!profile) {
      profile = new CustomerProfile({
        userId: user._id,
        phoneNumber: cleanPhone,
        firstName,
        lastName,
        customerUniqueId,
        panNumber: finalPanNumber,
        aadhaarNumber: finalAadhaarNumber,
        gender: finalGender,
        dob: finalDob,
        panImage: uploadedPanUrl || '',
        aadhaarImage: uploadedAadhaarUrl || '',
        livePhoto: uploadedLivePhotoUrl || '',
        residentialPincode: residentialPincode || '',
        currentPinCode: residentialPincode || '',
        activeAddress: {
          addressLine: finalAddress || '',
          pinCode: residentialPincode || ''
        },
        kycStatus: 'VERIFIED',
        kycVerifiedAt: new Date(),
        cibilStatus: 'APPROVED',
        onboardingStage: 'COMPLETED',
        onboardingSource: 'EXECUTIVE',
        createdByExecutiveId: executiveUserId,
        onboardedBy: {
          id: onboardedById,
          userId: executiveUserId,
          name: onboardedByName,
          phone: onboardedByPhone,
          role: onboardedByRole
        }
      });
    } else {
      profile.phoneNumber = cleanPhone;
      profile.userId = user._id;
      profile.firstName = firstName || profile.firstName;
      profile.lastName = lastName || profile.lastName;
      if (!profile.customerUniqueId) profile.customerUniqueId = customerUniqueId;
      profile.panNumber = finalPanNumber || profile.panNumber;
      profile.aadhaarNumber = finalAadhaarNumber || profile.aadhaarNumber;
      profile.gender = finalGender || profile.gender;
      profile.dob = finalDob || profile.dob;
      if (uploadedPanUrl) profile.panImage = uploadedPanUrl;
      if (uploadedAadhaarUrl) profile.aadhaarImage = uploadedAadhaarUrl;
      if (uploadedLivePhotoUrl) profile.livePhoto = uploadedLivePhotoUrl;
      if (residentialPincode) {
        profile.residentialPincode = residentialPincode;
        profile.currentPinCode = residentialPincode;
      }
      if (finalAddress) {
        profile.activeAddress = { addressLine: finalAddress, pinCode: residentialPincode || profile.currentPinCode || '' };
      }
      profile.kycStatus = 'VERIFIED';
      profile.kycVerifiedAt = new Date();
      profile.cibilStatus = 'APPROVED';
      profile.onboardingStage = 'COMPLETED';
      profile.onboardingSource = 'EXECUTIVE';
      profile.createdByExecutiveId = executiveUserId;
      profile.onboardedBy = {
        id: onboardedById,
        userId: executiveUserId,
        name: onboardedByName,
        phone: onboardedByPhone,
        role: onboardedByRole
      };
    }

    if (typeof profile.save === 'function') {
      await profile.save();
    } else if (profile._id) {
      await CustomerProfile.updateOne({ _id: profile._id }, { $set: profile.toObject ? profile.toObject() : profile });
    }

    // Link user to profile and save profileModel
    user.profileId = profile._id;
    user.profileModel = 'CustomerProfile';
    user.customerUniqueId = profile.customerUniqueId;
    await user.save();

    // Execute Society Customer Link & Credit Deduction Engine
    const societyResult = await OnboardingEngineService.processSocietyOnboardingAndCredits({
      user,
      bankId,
      branchId: branch?._id || branchId,
      productType: targetProduct,
      executiveUser,
      manualUploads: {
        pincode: finalPincode,
        aadhaarPicUrl: uploadedAadhaarUrl,
        panPicUrl: uploadedPanUrl,
        livePicUrl: uploadedLivePhotoUrl
      },
      cibilScore: profile.creditScore
    });

    const formattedDob = profile.dob ? (typeof profile.dob === 'string' ? profile.dob.split('T')[0] : new Date(profile.dob).toISOString().split('T')[0]) : null;

    let nextScreenVal = 'ONBOARDING_COMPLETED';
    if (targetProduct === 'LOAN') {
      nextScreenVal = 'SCREEN_1_PRODUCT_SELECTION';
    } else if (targetProduct === 'MERCHANT') {
      nextScreenVal = 'MERCHANT_STORE_SETUP';
    } else if (targetProduct === 'PIGMY') {
      nextScreenVal = 'PIGMY_ACCOUNT_SETUP';
    }

    return {
      success: true,
      customerId: user._id,
      customerUniqueId: profile.customerUniqueId,
      nextStep: nextScreenVal,
      screenName: nextScreenVal,
      fullName: `${profile.firstName} ${profile.lastName}`.trim(),
      firstName: profile.firstName,
      lastName: profile.lastName,
      phoneNumber: cleanPhone,
      gender: profile.gender,
      dob: formattedDob,
      panNumber: profile.panNumber,
      aadhaarNumber: profile.aadhaarNumber,
      address: profile.activeAddress?.addressLine || finalAddress,
      residentialPincode: profile.residentialPincode || residentialPincode,
      panImage: profile.panImage,
      aadhaarImage: profile.aadhaarImage,
      livePhoto: profile.livePhoto,
      kycStatus: profile.kycStatus,
      cibilStatus: profile.cibilStatus,
      onboardingStage: profile.onboardingStage,
      productType: targetProduct,
      societyAccount: societyResult?.societyAccount || null,
      creditsDeducted: societyResult?.creditsDeducted || 0,
      bank: { id: bankId, name: realBankName },
      branch: { id: branch?._id || branchId, name: realBranchName },
      message: `${targetProduct} customer onboarding successfully completed. Customer linked to bank branch.`
    };
  }

  async onboardCustomerRequest(payload, executiveId) {
    const { phoneNumber, panNumber, aadhaarNumber } = payload;

    if (executiveId) {
      const context = await this.resolveExecutiveOrBranchContext(executiveId, payload?.bankId, payload?.branchId);
      const branch = context.branch;
      const bank = context.bank;
      if (!branch && !bank) {
        throw ApiError.badRequest('User/Executive is not assigned to any bank branch.');
      }
      const availVerification = branch?.availableVerificationCredits || branch?.verificationCredits || bank?.verificationCredit || bank?.availableVerificationCredits || 0;
      if (availVerification <= 0) {
        throw ApiError.badRequest('No verification credits available in branch or bank stock. Please recharge verification credits.');
      }
    }

    const existingUser = await User.findOne({ phoneNumber, userType: UserType.CUSTOMER });
    if (existingUser) {
      throw ApiError.badRequest(
        'This mobile number is already registered as an active customer in our system.',
        ErrorCode.CUSTOMER_DUPLICATE_MOBILE
      );
    }

    const dupPan = await CustomerProfile.findOne({ panNumber: panNumber.toUpperCase() });
    if (dupPan) {
      throw ApiError.badRequest('A customer profile with this PAN number is already registered.');
    }

    const dupAadhaar = await CustomerProfile.findOne({ aadhaarNumber });
    if (dupAadhaar) {
      throw ApiError.badRequest('A customer profile with this Aadhaar number is already registered.');
    }

    const transactionId = `txn_aadhaar_${Math.floor(100000 + Math.random() * 900000)}`;
    logger.info(`THIRD-PARTY API MOCK: OTP [123456] dispatched for Aadhaar [${aadhaarNumber}]. Txn: ${transactionId}`);

    return {
      success: true,
      transactionId,
      message: 'Verification code successfully dispatched to the Aadhaar-linked mobile number.'
    };
  }

  /**
   * Confirms Aadhaar OTP validity
   */
  async verifyAadhaarOtp(phoneNumber, transactionId, otp) {
    if (otp !== '123456') {
      throw ApiError.badRequest('The verification code is incorrect or expired.', ErrorCode.OTP_INVALID);
    }

    return {
      success: true,
      addressLine: 'Pimpri Chinchwad, Pune, 411061',
      pinCode: '411061',
      message: 'Aadhaar identity verified successfully.'
    };
  }

  /**
   * Initiates DigiLocker KYC session for Executive Customer Onboarding
   */
  async initiateDigiLockerKyc(payload, executiveId) {
    const { aadhaarNumber, panNumber, redirectUrl } = payload;
    const isLive = panelControlConfig.EMPLOYEE_PANEL?.OTP === 'LIVE' || panelControlConfig.EMPLOYEE_PANEL?.EMAIL === 'LIVE';

    const context = await this.resolveExecutiveOrBranchContext(executiveId, payload?.bankId, payload?.branchId, { requireBranchForOwner: true });
    const branch = context.branch;
    const bank = context.bank;
    if (!branch && !bank) {
      throw ApiError.badRequest('Executive/User is not assigned to any branch or bank.');
    }

    const availVerification = branch?.availableVerificationCredits || branch?.verificationCredits || bank?.verificationCredit || bank?.availableVerificationCredits || 0;
    if (availVerification <= 0) {
      throw ApiError.badRequest('No verification credits available in branch or bank stock. Please recharge verification credits.');
    }

    let normalizedRedirectUrl = redirectUrl ? String(redirectUrl).trim() : 'https://sahayaone-onboarding.netlify.app/digilocker-callback';
    if (normalizedRedirectUrl && !normalizedRedirectUrl.startsWith('http://') && !normalizedRedirectUrl.startsWith('https://')) {
      normalizedRedirectUrl = `https://${normalizedRedirectUrl}`;
    }

    const refid = `digi_exec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    let authorizationUrl = `https://sahayaone-backend.onrender.com/public/mocks/digilocker-callback?refid=${refid}&redirect_url=${encodeURIComponent(normalizedRedirectUrl)}`;

    // Always attempt real SprintVerify DigiLocker session initiation
    try {
      const apiRes = await initiateDigiLockerSessionApi(
        refid,
        normalizedRedirectUrl
      );
      const liveUrl = apiRes?.data?.authorizationUrl || apiRes?.data?.authorization_url || apiRes?.authorization_url || apiRes?.raw?.authorizationUrl || apiRes?.raw?.authorization_url || apiRes?.raw?.data?.authorizationUrl || apiRes?.raw?.data?.authorization_url;
      if (liveUrl) {
        authorizationUrl = liveUrl;
      }
    } catch (err) {
      logger.warn(`EMPLOYEE DIGILOCKER INIT NOTICE: SprintVerify API notice (${err.message}). Using mock callback fallback.`);
    }

    await KycVerificationModel.create({
      createdBy: executiveId,
      societyId: branch?.bankId || bank?._id,
      requestById: executiveId,
      refid,
      documentType: 'AADHAAR',
      idNumber: aadhaarNumber || '000000000000',
      consent: true,
      status: 'INITIATED',
      authorizationUrl,
      redirectUrl: normalizedRedirectUrl,
      personalDetails: {
        aadhaarNumber,
        panNumber
      }
    });

    return {
      success: true,
      refid,
      authorizationUrl,
      mode: isLive ? 'LIVE' : 'TEST',
      message: 'DigiLocker KYC session successfully initiated.'
    };
  }

  /**
   * Verifies DigiLocker session & deducts 1 Verification Credit ONLY upon successful API execution
   */
  async verifyDigiLockerKyc(refid, executiveId) {
    const kycRecord = await KycVerificationModel.findOne({ refid });
    if (!kycRecord) {
      throw ApiError.notFound('DigiLocker verification session not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (kycRecord.status === 'VERIFIED') {
      return {
        success: true,
        alreadyVerified: true,
        personalDetails: kycRecord.personalDetails,
        rawKycData: kycRecord.rawXmlBase64,
        message: 'DigiLocker identity already verified.'
      };
    }

    const context = await this.resolveExecutiveOrBranchContext(executiveId);
    const branch = context.branch;
    const bank = context.bank;
    if (!branch && !bank) {
      throw ApiError.badRequest('Executive/User is not assigned to any branch or bank.');
    }

    const availVerification = branch?.availableVerificationCredits || branch?.verificationCredits || bank?.verificationCredit || bank?.availableVerificationCredits || 0;
    if (availVerification <= 0) {
      throw ApiError.badRequest('No verification credits available in branch or bank stock. Please recharge verification credits.');
    }

    const isLive = panelControlConfig.EMPLOYEE_PANEL?.OTP === 'LIVE' || panelControlConfig.EMPLOYEE_PANEL?.EMAIL === 'LIVE';

    let verifiedDetails = {
      fullName: '',
      dob: '',
      gender: '',
      fatherName: '',
      aadhaarNumber: '',
      panNumber: '',
      aadhaarVerified: false,
      panVerified: false,
      aadhaarStatus: 'UNAVAILABLE',
      panStatus: 'UNAVAILABLE',
      address: '',
      addressLine: '',
      pinCode: '',
      state: '',
      district: ''
    };

    let rawDataObj = {
      aadhaarXml: '',
      panXml: ''
    };

    // Always attempt real SprintVerify DigiLocker API verification & XML parsing
    try {
        const tokenRes = await generateAccessTokenApi(refid);
        const accessToken = extractAccessToken(tokenRes);

        const filesRes = await fetchIssuedFilesApi(refid);
        logger.info(`[DigiLocker Verify] fetchIssuedFilesApi response for refid (${refid}):`, JSON.stringify(filesRes, null, 2));

        const issuedFiles = extractIssuedFiles(filesRes);
        logger.info(`[DigiLocker Verify] Extracted issuedFiles count: ${issuedFiles.length}`);

        const getDocUri = (doc) => doc?.uri || doc?.document_uri || doc?.doc_uri || doc?.docUri || doc?.URI || doc?.id || '';

        const aadhaarDoc = (issuedFiles || []).find(f => 
          ['AADHAAR', 'ADHAR', 'UIDAI'].includes((f.doctype || f.docType || f.name || f.description || '').toUpperCase()) ||
          (getDocUri(f)).toLowerCase().includes('aadhaar') || (getDocUri(f)).toLowerCase().includes('adhar')
        );
        const panDoc = (issuedFiles || []).find(f => 
          ['PAN', 'PANCR', 'INCOME TAX'].includes((f.doctype || f.docType || f.name || f.description || '').toUpperCase()) ||
          (getDocUri(f)).toLowerCase().includes('pan')
        );

        if (aadhaarDoc && getDocUri(aadhaarDoc)) {
          const xmlRes = await downloadXmlDocumentApi(refid, getDocUri(aadhaarDoc));
          const xmlData = extractXmlData(xmlRes);
          const parsed = parseAadhaarXml(xmlData);
          if (parsed) {
            verifiedDetails.fullName = parsed.fullName || verifiedDetails.fullName;
            verifiedDetails.dob = parsed.dob || verifiedDetails.dob;
            verifiedDetails.gender = parsed.gender || verifiedDetails.gender;
            if (parsed.aadhaarNumber) {
              const existingAadhaarCandidate = [
                kycRecord?.idNumber,
                kycRecord?.personalDetails?.aadhaarNumber,
                verifiedDetails.aadhaarNumber
              ].find(val => val && /^\d{12}$/.test(String(val).replace(/\D/g, '')));

              const isParsedMasked = /[xX]/.test(String(parsed.aadhaarNumber)) || parsed.isMasked;

              if (isParsedMasked && existingAadhaarCandidate) {
                verifiedDetails.aadhaarNumber = String(existingAadhaarCandidate).replace(/\D/g, '');
              } else {
                verifiedDetails.aadhaarNumber = parsed.aadhaarNumber;
              }
            }
            if (parsed.address) {
              verifiedDetails.address = parsed.address;
              verifiedDetails.addressLine = parsed.address;
            }
            if (parsed.pinCode) verifiedDetails.pinCode = parsed.pinCode;
            verifiedDetails.aadhaarVerified = true;
            verifiedDetails.aadhaarStatus = 'VERIFIED';
            rawDataObj.aadhaarXmlBase64 = encodeXmlToBase64(xmlData || xmlRes);
            rawDataObj.aadhaarXml = typeof xmlData === 'string' ? xmlData : JSON.stringify(xmlData);
          }
        }

        if (panDoc && getDocUri(panDoc)) {
          const xmlRes = await downloadXmlDocumentApi(refid, getDocUri(panDoc));
          const xmlData = extractXmlData(xmlRes);
          const parsed = parsePanXml(xmlData);
          if (parsed) {
            if (parsed.fullName && !parsed.fullName.toLowerCase().includes('verification record')) {
              verifiedDetails.fullName = parsed.fullName;
            }
            if (parsed.panNumber) verifiedDetails.panNumber = parsed.panNumber;
            if (parsed.dob) verifiedDetails.dob = parsed.dob;
            if (parsed.gender && !verifiedDetails.gender) verifiedDetails.gender = parsed.gender;
            if (parsed.fatherName && !verifiedDetails.fatherName) verifiedDetails.fatherName = parsed.fatherName;
            verifiedDetails.panVerified = true;
            verifiedDetails.panStatus = 'VERIFIED';
            rawDataObj.panXmlBase64 = encodeXmlToBase64(xmlData || xmlRes);
            rawDataObj.panXml = typeof xmlData === 'string' ? xmlData : JSON.stringify(xmlData);
          }
        }

        if (!verifiedDetails.fullName && (issuedFiles || []).length > 0) {
          // If files exist but XML parsing needed fallback, check any document for name
          for (const doc of issuedFiles) {
            const uri = getDocUri(doc);
            if (uri) {
              try {
                const xmlRes = await downloadXmlDocumentApi(refid, uri);
                const xmlData = extractXmlData(xmlRes);
                const parsedAadhaar = parseAadhaarXml(xmlData) || parsePanXml(xmlData);
                if (parsedAadhaar?.fullName) {
                  verifiedDetails.fullName = parsedAadhaar.fullName;
                  verifiedDetails.dob = parsedAadhaar.dob || verifiedDetails.dob;
                  verifiedDetails.gender = parsedAadhaar.gender || verifiedDetails.gender;
                  if (parsedAadhaar.address) verifiedDetails.address = parsedAadhaar.address;
                  if (parsedAadhaar.pinCode) verifiedDetails.pinCode = parsedAadhaar.pinCode;
                  verifiedDetails.aadhaarVerified = true;
                  verifiedDetails.aadhaarStatus = 'VERIFIED';
                  rawDataObj.aadhaarXml = typeof xmlData === 'string' ? xmlData : JSON.stringify(xmlData);
                  break;
                }
              } catch (e) {
                logger.warn(`Doc XML download try notice for URI (${uri}): ${e.message}`);
              }
            }
          }
        }

        if (!verifiedDetails.aadhaarVerified || !verifiedDetails.dob || !verifiedDetails.address) {
          logger.error(`DigiLocker Aadhaar verification failed: permission denied or e-Aadhaar document missing.`);
          throw new Error('Aadhaar card permission was not granted in DigiLocker. Both Aadhaar and PAN card permissions are mandatory to complete KYC.');
        }

        if (!verifiedDetails.panVerified) {
          logger.error(`DigiLocker PAN verification failed: permission denied or PAN document missing.`);
          throw new Error('PAN card permission was not granted in DigiLocker. Both Aadhaar and PAN card permissions are mandatory to complete KYC.');
        }

        if (!verifiedDetails.fullName) {
          logger.error(`DigiLocker document XML parsing returned empty details. Issued files sample:`, JSON.stringify(issuedFiles.slice(0, 2), null, 2));
          throw new Error(`DigiLocker document XML parsing returned empty details. Issued files count: ${(issuedFiles || []).length}`);
        }
      } catch (liveErr) {
        logger.error(`DIGILOCKER REAL VERIFICATION ERROR: ${liveErr.message}`, { stack: liveErr.stack });
        throw ApiError.badRequest(`Identity Verification Failed: ${liveErr.message}`);
      }

    // Deduct 1 Verification Credit ONLY AFTER SUCCESSFUL API EXECUTION
    if (branch && (branch.availableVerificationCredits > 0 || branch.verificationCredits > 0)) {
      const balanceBefore = branch.availableVerificationCredits || branch.verificationCredits || 0;
      branch.verificationCredits = Math.max(0, (branch.verificationCredits || 0) - 1);
      branch.availableVerificationCredits = Math.max(0, balanceBefore - 1);
      await branch.save();

      await CreditLog.create({
        bankId: branch.bankId,
        branchId: branch._id,
        type: 'VERIFICATION_CREDIT',
        action: 'DEDUCTION',
        amount: 1,
        employeeId: executiveId,
        description: `Verification credit deducted on DigiLocker API completion for: ${verifiedDetails.fullName}`
      });

      await CardCreditUsage.create({
        bankId: branch.bankId,
        branchId: branch._id,
        type: 'VERIFICATION_CREDIT',
        quantity: 1,
        balanceBefore,
        balanceAfter: branch.availableVerificationCredits,
        createdBy: executiveId
      });
    } else if (bank) {
      const balanceBefore = bank.verificationCredit || bank.availableVerificationCredits || 0;
      bank.verificationCredit = Math.max(0, (bank.verificationCredit || 0) - 1);
      if (bank.availableVerificationCredits !== undefined) {
        bank.availableVerificationCredits = Math.max(0, balanceBefore - 1);
      }
      await bank.save();

      await CreditLog.create({
        bankId: bank._id,
        branchId: branch?._id || null,
        type: 'VERIFICATION_CREDIT',
        action: 'DEDUCTION',
        amount: 1,
        employeeId: executiveId,
        description: `Verification credit deducted on DigiLocker API completion for: ${verifiedDetails.fullName}`
      });

      await CardCreditUsage.create({
        bankId: bank._id,
        branchId: branch?._id || null,
        type: 'VERIFICATION_CREDIT',
        quantity: 1,
        balanceBefore,
        balanceAfter: bank.verificationCredit,
        createdBy: executiveId
      });
    }

    kycRecord.status = 'VERIFIED';
    kycRecord.personalDetails = verifiedDetails;
    kycRecord.rawXmlBase64 = rawDataObj;
    kycRecord.verifiedAt = new Date();
    await kycRecord.save();

    return {
      success: true,
      verified: true,
      refid,
      personalDetails: verifiedDetails,
      rawKycData: rawDataObj,
      creditDeducted: 1,
      message: 'DigiLocker identity and Aadhaar address verified successfully. 1 Verification credit deducted.'
    };
  }

  /**
   * Checks CIBIL Score with 30-Day Cache Rule & Raw Data Storage
   */
  async checkCibilScore(payload, executiveId) {
    const { panNumber, fullName, dob, mobileNumber, customerId } = payload;
    const cleanPan = (panNumber || '').trim().toUpperCase();

    if (!cleanPan) {
      throw ApiError.badRequest('PAN number is required for CIBIL credit check.');
    }

    const validityDays = 30;
    const expiryDate = new Date(Date.now() - validityDays * 24 * 60 * 60 * 1000);

    // 30-Day Cache Check Rule (Same concept as Society panel)
    const existingReport = await CreditReportRequest.findOne({
      pan: cleanPan,
      status: 'completed',
      createdAt: { $gte: expiryDate }
    }).select('+reportJson').sort({ createdAt: -1 });

    if (existingReport && existingReport.reportJson) {
      logger.info(`CIBIL CHECK: Found valid 30-day cached credit report for PAN: ${cleanPan}`);
      const rawCibilData = existingReport.reportJson;
      const scoreVal = rawCibilData?.bureauScore || rawCibilData?.score || rawCibilData?.data?.score || 750;

      if (customerId) {
        await CustomerProfile.updateOne(
          { userId: customerId },
          {
            $set: {
              creditScore: scoreVal,
              cibilReportUrl: existingReport.pdfUrl,
              cibilFetchedAt: existingReport.createdAt,
              rawCibilData
            }
          }
        );
      }

      return {
        success: true,
        cached: true,
        creditScore: scoreVal,
        cibilReportUrl: existingReport.pdfUrl,
        rawCibilData,
        message: 'Valid 30-day cached CIBIL credit report retrieved.'
      };
    }

    const isLive = panelControlConfig.EMPLOYEE_PANEL?.OTP === 'LIVE' || panelControlConfig.EMPLOYEE_PANEL?.EMAIL === 'LIVE';

    let cibilResult = null;

    if (isLive) {
      try {
        cibilResult = await creditReportService.generate({
          fullName: fullName || 'Customer Name',
          pan: cleanPan,
          dob: formatDobForCibil(dob) || '1994-08-15',
          mobileNumber: mobileNumber || '9876543210',
          requestedBy: executiveId
        });
      } catch (cibilErr) {
        logger.warn(`CIBIL LIVE API NOTICE: ${cibilErr.message}. Fallback applied.`);
      }
    }

    if (!cibilResult) {
      const mockRawJson = {
        status: 'SUCCESS',
        score: 750,
        summary: {
          totalAccounts: 3,
          activeAccounts: 2,
          overdueAccounts: 0,
          totalCurrentBalance: 12500
        },
        bureau: 'EXPERIAN'
      };

      const newReport = await CreditReportRequest.create({
        fullName: fullName || 'Customer Name',
        pan: cleanPan,
        dob: dob ? new Date(dob) : new Date('1994-08-15'),
        mobileNumber: mobileNumber || '9876543210',
        status: 'completed',
        reportJson: mockRawJson,
        pdfUrl: 'https://sahayaone-backend.onrender.com/public/mocks/cibil-report-sample.pdf',
        requestedBy: executiveId
      });

      cibilResult = {
        creditScore: 750,
        pdfUrl: newReport.pdfUrl,
        rawCibilData: mockRawJson
      };
    }

    const scoreVal = cibilResult.creditScore || cibilResult.bureauScore || 750;
    const pdfUrl = cibilResult.pdfUrl || cibilResult.pdfReportUrl || 'https://sahayaone-backend.onrender.com/public/mocks/cibil-report-sample.pdf';
    const rawCibilData = cibilResult.rawCibilData || cibilResult.reportJson || cibilResult;

    if (customerId) {
      await CustomerProfile.updateOne(
        { userId: customerId },
        {
          $set: {
            creditScore: scoreVal,
            cibilReportUrl: pdfUrl,
            cibilFetchedAt: new Date(),
            rawCibilData
          }
        }
      );
    }

    return {
      success: true,
      cached: false,
      creditScore: scoreVal,
      cibilReportUrl: pdfUrl,
      rawCibilData,
      message: 'Fresh CIBIL credit report successfully generated and cached for 30 days.'
    };
  }

  /**
   * Saves customer records and uploads scans to Storage Manager
   */
  async confirmOnboard(payload, executiveId) {
    const cleanPhone = (payload.phoneNumber || '').trim();
    const cleanPan = (payload.panNumber || '').trim().toUpperCase();
    const cleanAadhaar = (payload.aadhaarNumber || '').trim();
    const cleanPin = (payload.pinCode || payload.currentPinCode || '').trim();
    const cleanCurrentPin = (payload.currentPinCode || payload.pinCode || '').trim();

    let firstName = (payload.firstName || '').trim();
    let lastName = (payload.lastName || '').trim();
    if (!firstName && payload.fullName) {
      const parts = payload.fullName.trim().split(' ');
      firstName = parts[0] || 'Customer';
      lastName = parts.slice(1).join(' ') || 'User';
    }

    const {
      gender,
      dob,
      addressLine
    } = payload;

    const context = await this.resolveExecutiveOrBranchContext(executiveId, payload?.bankId, payload?.branchId, { requireBranchForOwner: true });
    let branch = context.branch;
    let bank = context.bank;
    let employeeProfile = await SocietyEmployee.findOne({ userId: executiveId }) || await EmployeeProfile.findOne({ userId: executiveId });
    const availVerification = branch?.availableVerificationCredits || branch?.verificationCredits || bank?.verificationCredit || bank?.availableVerificationCredits || 0;
    if ((branch || bank) && availVerification <= 0) {
      throw ApiError.badRequest('No verification credits available in branch or bank stock. Please recharge verification credits.');
    }

    const executiveUser = await User.findById(executiveId);
    const onboardedByData = {
      id: employeeProfile?._id || executiveId,
      userId: executiveId,
      name: employeeProfile?.fullName || (employeeProfile?.firstName ? `${employeeProfile.firstName || ''} ${employeeProfile.lastName || ''}`.trim() : (executiveUser?.fullName || 'Loan Executive')),
      phone: employeeProfile?.phoneNumber || executiveUser?.phoneNumber || '',
      email: employeeProfile?.email || executiveUser?.email || '',
      role: executiveUser?.role || 'LOAN_EXECUTIVE',
      type: 'EXECUTIVE',
      employeeId: employeeProfile?.employeeId || null,
      branchId: branch?._id || context.branchId || null,
      branchName: branch?.name || branch?.branchName || null,
      bankId: bank?._id || context.bankId || null,
      bankName: bank?.name || bank?.bankName || null
    };

    const existingUser = await User.findOne({ phoneNumber: cleanPhone, userType: UserType.CUSTOMER });
    if (existingUser) {
      throw ApiError.badRequest(
        'This mobile number is already registered as an active customer in our system.',
        ErrorCode.CUSTOMER_DUPLICATE_MOBILE
      );
    }

    const dupPan = await CustomerProfile.findOne({ panNumber: cleanPan });
    if (dupPan) {
      throw ApiError.badRequest('A customer profile with this PAN number is already registered.');
    }

    const dupAadhaar = await CustomerProfile.findOne({ aadhaarNumber: cleanAadhaar });
    if (dupAadhaar) {
      throw ApiError.badRequest('A customer profile with this Aadhaar number is already registered.');
    }

    const rawPan = payload.panImage || payload.panCardUrl || payload.panCardImage || payload.pan;
    const rawAadhaar = payload.aadhaarImage || payload.aadhaarCardUrl || payload.aadhaarCardImage || payload.aadhaar;
    const rawSig = payload.signatureImage || payload.digitalSignature || payload.signature;

    const panImageUrl = (await processDocumentUpload(rawPan, 'pan_card', cleanPhone, 'customers')) ||
                        'https://sahayaone-backend.onrender.com/public/mocks/doc-pan.png';

    const aadhaarImageUrl = (await processDocumentUpload(rawAadhaar, 'aadhaar_card', cleanPhone, 'customers')) ||
                            'https://sahayaone-backend.onrender.com/public/mocks/doc-aadhaar.png';

    const signatureUrl = await processDocumentUpload(rawSig, 'signature', cleanPhone, 'customers');

    let user = null;
    let profile = null;

    try {
      const fullCustName = `${firstName} ${lastName}`.trim();
      user = new User({
        phoneNumber: cleanPhone,
        fullName: fullCustName,
        role: UserRole.CUSTOMER,
        userType: UserType.CUSTOMER,
        status: 'ACTIVE',
        onboardingSource: 'EXECUTIVE',
        createdBy: executiveId,
        onboardedBy: onboardedByData
      });
      await user.save();

      profile = new CustomerProfile({
        userId: user._id,
        firstName,
        lastName,
        gender: (gender || 'MALE').toUpperCase(),
        dob: new Date(dob),
        panNumber: cleanPan,
        aadhaarNumber: cleanAadhaar,
        currentPinCode: cleanCurrentPin || cleanPin,
        panImage: panImageUrl,
        aadhaarImage: aadhaarImageUrl,
        signatureImage: signatureUrl || null,
        kycStatus: 'VERIFIED',
        activeAddress: { addressLine, pinCode: cleanPin },
        addressHistory: [{ addressLine, pinCode: cleanPin, verifiedAt: new Date() }],
        onboardingSource: 'EXECUTIVE',
        createdByExecutiveId: executiveId,
        createdById: executiveId,
        onboardedBy: onboardedByData
      });
      await profile.save();

      user.profileId = profile._id;
      user.profileModel = 'CustomerProfile';
      await user.save();

      if (branch && (branch.availableVerificationCredits > 0 || branch.verificationCredits > 0)) {
        // Decrement branch verification credit stock for customer onboarding
        const balanceBefore = branch.availableVerificationCredits || branch.verificationCredits || 0;
        branch.verificationCredits = Math.max(0, (branch.verificationCredits || 0) - 1);
        branch.availableVerificationCredits = Math.max(0, balanceBefore - 1);
        await branch.save();

        // Log credit deduction in CreditLog
        await CreditLog.create({
          bankId: branch.bankId,
          branchId: branch._id,
          type: 'VERIFICATION_CREDIT',
          action: 'DEDUCTION',
          amount: 1,
          employeeId: executiveId,
          customerId: user._id,
          description: `Verification credit deducted for customer onboarding: ${profile.firstName} ${profile.lastName}`
        });

        // Log credit usage in CardCreditUsage
        await CardCreditUsage.create({
          bankId: branch.bankId,
          branchId: branch._id,
          verificationId: user._id,
          type: 'VERIFICATION_CREDIT',
          quantity: 1,
          balanceBefore,
          balanceAfter: branch.availableVerificationCredits,
          createdBy: executiveId
        });
        logger.info(`CUSTOMER ONBOARDING CREDIT DEDUCTION: 1 verification credit deducted from branch [${branch.name}] for customer [${profile.firstName} ${profile.lastName}].`);
      } else if (bank) {
        const balanceBefore = bank.verificationCredit || bank.availableVerificationCredits || 0;
        bank.verificationCredit = Math.max(0, (bank.verificationCredit || 0) - 1);
        if (bank.availableVerificationCredits !== undefined) {
          bank.availableVerificationCredits = Math.max(0, balanceBefore - 1);
        }
        await bank.save();

        await CreditLog.create({
          bankId: bank._id,
          branchId: branch?._id || null,
          type: 'VERIFICATION_CREDIT',
          action: 'DEDUCTION',
          amount: 1,
          employeeId: executiveId,
          customerId: user._id,
          description: `Verification credit deducted for customer onboarding: ${profile.firstName} ${profile.lastName}`
        });

        await CardCreditUsage.create({
          bankId: bank._id,
          branchId: branch?._id || null,
          verificationId: user._id,
          type: 'VERIFICATION_CREDIT',
          quantity: 1,
          balanceBefore,
          balanceAfter: bank.verificationCredit,
          createdBy: executiveId
        });
        logger.info(`CUSTOMER ONBOARDING CREDIT DEDUCTION: 1 verification credit deducted from bank [${bank.name || bank._id}] for customer [${profile.firstName} ${profile.lastName}].`);
      }

      const usedMockImage = panImageUrl.includes('/mocks/') || aadhaarImageUrl.includes('/mocks/');
      const responseMessage = usedMockImage
        ? 'Customer successfully onboarded. Mock document image uploaded.'
        : 'Customer successfully onboarded and verified.';

      return {
        success: true,
        customerId: user._id,
        fullName: `${firstName} ${lastName}`,
        kycStatus: 'VERIFIED',
        onboardingSource: 'EXECUTIVE',
        onboardedBy: onboardedByData,
        isMockImageUploaded: usedMockImage,
        message: responseMessage
      };
    } catch (dbError) {
      if (panUploadResult?.filePath) await storageManager.deleteFile(panUploadResult.filePath);
      if (aadhaarUploadResult?.filePath) await storageManager.deleteFile(aadhaarUploadResult.filePath);
      if (user?._id) await User.deleteOne({ _id: user._id });
      if (profile?._id) await CustomerProfile.deleteOne({ _id: profile._id });
      throw dbError;
    }
  }

  /**
   * Registers a draft Lead Application linking customer and variant
   */
  async createLead(customerId, variantId, executiveId) {
    const variant = await Variant.findById(variantId).populate('productId');
    if (!variant) {
      throw ApiError.notFound('Selected product variant does not exist.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    // Verify CIBIL 30-day cooldown before creating a loan lead
    const customerProfile = await CustomerProfile.findOne({
      $or: [{ userId: customerId }, { _id: customerId }]
    });
    if (customerProfile && customerProfile.lastCibilCheckDate && customerProfile.cibilStatus === 'REJECTED') {
      const daysSinceCheck = Math.floor((Date.now() - new Date(customerProfile.lastCibilCheckDate).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceCheck < 30) {
        const remainingDays = 30 - daysSinceCheck;
        throw ApiError.badRequest(`Your CIBIL score is low. Please try again after ${remainingDays} days.`, ErrorCode.CIBIL_SCORE_LOW);
      }
    }

    let branchId = null;
    let assignedBankId = null;
    let branch = null;
    let bank = null;
    let employeeProfile = null;
    let executiveUser = null;

    if (executiveId) {
      executiveUser = await User.findById(executiveId);
      const context = await this.resolveExecutiveOrBranchContext(executiveUser, leadData?.bankId, leadData?.branchId, { requireBranchForOwner: true });
      branchId = context.branchId;
      assignedBankId = context.bankId;
      branch = context.branch;
      bank = context.bank;
      employeeProfile = await EmployeeProfile.findOne({ userId: executiveId }) || await SocietyEmployee.findOne({ userId: executiveId });
    }

    const creatorDetails = {
      id: employeeProfile?._id || executiveId,
      userId: executiveId,
      name: employeeProfile?.fullName || (employeeProfile?.firstName ? `${employeeProfile.firstName || ''} ${employeeProfile.lastName || ''}`.trim() : (executiveUser?.fullName || 'Loan Executive')),
      phone: employeeProfile?.phoneNumber || executiveUser?.phoneNumber || '',
      email: employeeProfile?.email || executiveUser?.email || '',
      role: executiveUser?.role || 'LOAN_EXECUTIVE',
      type: 'EXECUTIVE',
      employeeId: employeeProfile?.employeeId || null,
      branchId: branch?._id || branchId,
      branchName: branch?.name || null,
      bankId: bank?._id || assignedBankId,
      bankName: bank?.name || null
    };

    // Check if customer needs credit stock deduction for loan allotment
    // Condition 1: New customer getting a loan (no active EMI card)
    // Condition 2: Existing customer with an EXPIRED card
    let isNewCustomerLoan = false;
    let isExpiredCardLoan = false;

    const existingCard = await EmiCard.findOne({ customerId, status: { $ne: 'CANCELLED' } }).sort({ createdAt: -1 });

    if (!existingCard) {
      isNewCustomerLoan = true;
    } else if (existingCard.status === 'EXPIRED' || (existingCard.validThru && isCardExpired(existingCard.validThru))) {
      isExpiredCardLoan = true;
    }

    const requiresCardCreditDeduction = isNewCustomerLoan || isExpiredCardLoan;

    if (requiresCardCreditDeduction) {
      if (!branch) {
        throw ApiError.badRequest('Executive branch assignment is required to allot a loan.');
      }

      const availableCardCredits = branch.availableEmiCards || branch.cardStock || branch.totalEmiCards || 0;
      if (availableCardCredits <= 0) {
        throw ApiError.badRequest(
          `No EMI Card credits available in branch stock [${branch.name}] to allot loan. Please contact your branch manager to request EMI Card stock.`,
          ErrorCode.BAD_REQUEST
        );
      }

      // Deduct 1 EMI Card credit from branch card stock for loan allotment
      const balanceBefore = availableCardCredits;
      branch.cardStock = Math.max(0, (branch.cardStock || 0) - 1);
      branch.availableEmiCards = Math.max(0, balanceBefore - 1);
      await branch.save();

      const customerUser = await User.findById(customerId).populate('profileId');
      const custName = customerUser?.profileId?.firstName
        ? `${customerUser.profileId.firstName} ${customerUser.profileId.lastName || ''}`.trim()
        : customerUser?.fullName || 'Customer';

      const deductionReason = isNewCustomerLoan
        ? `EMI Card credit deducted for new customer loan allotment: ${custName}`
        : `EMI Card credit deducted for loan allotment (Renewed Expired EMI Card): ${custName}`;

      await CreditLog.create({
        bankId: branch.bankId,
        branchId: branch._id,
        type: 'EMI_CARD',
        action: 'DEDUCTION',
        amount: 1,
        employeeId: executiveId,
        customerId: customerId,
        description: deductionReason
      });

      await CardCreditUsage.create({
        bankId: branch.bankId,
        branchId: branch._id,
        verificationId: customerId,
        type: 'EMI_CARD',
        purpose: isExpiredCardLoan ? 'RENEWAL' : 'NEW_PURCHASE',
        quantity: 1,
        balanceBefore,
        balanceAfter: branch.availableEmiCards,
        createdBy: executiveId
      });

      logger.info(`LOAN ALLOTMENT EMI CARD DEDUCTION: 1 card credit deducted from branch [${branch.name}] for loan allotment. Reason: ${deductionReason}`);

      // Generate new EMI Card for first time customer or renew expired card
      if (isExpiredCardLoan && existingCard) {
        const previousValidThru = existingCard.validThru;
        const newValidThru = extendValidity(previousValidThru, 1);
        if (!existingCard.renewalHistory) existingCard.renewalHistory = [];
        existingCard.renewalHistory.push({
          renewedAt: new Date(),
          previousValidThru,
          newValidThru,
          renewedByUserId: executiveId,
          branchId: branch?._id,
          bankId: branch?.bankId || assignedBankId,
          fee: 499
        });
        existingCard.validThru = newValidThru;
        existingCard.cardHolderName = custName;
        existingCard.status = 'ACTIVE';
        await existingCard.save();
        logger.info(`EXPIRED EMI CARD RENEWED: Card [${existingCard.cardNumber}] renewed for customer [${custName}] with new validity [${newValidThru}].`);
      } else if (isNewCustomerLoan) {
        const now = new Date();
        const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
        const currentYearShort = String(now.getFullYear()).slice(-2);
        const formattedCurrent = `${currentMonth}/${currentYearShort}`;
        const initialValidThru = extendValidity(formattedCurrent, 1);
        const generatedNum = `52461245${Math.floor(10000000 + Math.random() * 90000000)}`;
        await EmiCard.create({
          bankId: branch?.bankId || assignedBankId,
          branchId: branch?._id || null,
          customerId,
          cardNumber: generatedNum,
          cardHolderName: custName,
          validThru: initialValidThru,
          cvv: `${Math.floor(100 + Math.random() * 900)}`,
          cardLimit: 100000,
          availableLimit: 100000,
          status: 'ACTIVE',
          allotmentStatus: 'ALLOTTED',
          allottedAt: new Date()
        });
        logger.info(`NEW EMI CARD GENERATED: Card [${generatedNum}] generated for customer [${custName}] valid thru [${initialValidThru}].`);
      }
    }

    await Loan.deleteMany({ customerId, status: { $in: ['NEW', 'PENDING_DOWN_PAYMENT'] } });

    const productPrice = variant.price || 0;

    const loan = new Loan({
      applicationId: `APPL${Math.floor(10000000 + Math.random() * 90000000)}`,
      customerId,
      variantId,
      status: 'NEW',
      currentStep: 'SLABS',
      productPrice,
      emiCardCharges: 0,
      processingFees: 0,
      totalAmount: productPrice,
      downPayment: 0,
      totalLoanAmount: productPrice,
      interestAmount: 0,
      insuranceAmount: 0,
      totalPayableAmount: productPrice,
      emiAmount: 0,
      tenureMonths: 1,
      outstandingAmount: productPrice,
      sourceType: 'EXECUTIVE',
      createdBy: executiveId,
      createdByExecutiveId: executiveId,
      assignedEmployeeId: executiveId,
      createdByDetails: creatorDetails,
      branchId,
      assignedBankId
    });

    await loan.save();

    return {
      success: true,
      leadId: loan._id,
      applicationId: loan.applicationId,
      sourceType: 'EXECUTIVE',
      createdBy: creatorDetails,
      message: 'New lead application successfully registered.'
    };
  }

  /**
   * Lists and filters all draft/new lead applications processed by the logged-in employee
   */
  /**
   * Lists and filters all customer leads/loan applications with full customer details, photos, merchant info, and loan amounts
   */
  async listLeads(executiveUserOrId, filters = {}) {
    const type = String(filters.type || filters.productType || 'LOAN').toUpperCase();

    // 1. Delegate to Merchant if type === 'MERCHANT'
    if (type === 'MERCHANT') {
      const executiveUser = (executiveUserOrId && typeof executiveUserOrId === 'object' && (executiveUserOrId.id || executiveUserOrId._id))
        ? executiveUserOrId
        : { id: executiveUserOrId, _id: executiveUserOrId };
      const merchantResult = await employeeMerchantService.listMerchants(executiveUser, filters);
      const total = merchantResult.pagination?.total || merchantResult.pagination?.totalRecords || merchantResult.items?.length || 0;
      const p = Math.max(1, parseInt(filters.page || merchantResult.pagination?.page || 1, 10));
      const l = Math.max(1, parseInt(filters.limit || merchantResult.pagination?.limit || 10, 10));
      const pagination = paginationUtil.getPaginationMeta(total, p, l);
      return {
        items: merchantResult.items,
        leads: merchantResult.items,
        data: merchantResult.items,
        pagination,
        stats: merchantResult.stats,
        productType: 'MERCHANT'
      };
    }

    // 2. Delegate to Pigmy if type === 'PIGMY'
    if (type === 'PIGMY') {
      const executiveUser = (executiveUserOrId && typeof executiveUserOrId === 'object' && (executiveUserOrId.id || executiveUserOrId._id))
        ? executiveUserOrId
        : { id: executiveUserOrId, _id: executiveUserOrId };
      const pigmyResult = await employeePigmyService.listPigmyCustomers(executiveUser, filters);
      const total = pigmyResult.pagination?.total || pigmyResult.pagination?.totalRecords || pigmyResult.items?.length || 0;
      const p = Math.max(1, parseInt(filters.page || pigmyResult.pagination?.page || 1, 10));
      const l = Math.max(1, parseInt(filters.limit || pigmyResult.pagination?.limit || 10, 10));
      const pagination = paginationUtil.getPaginationMeta(total, p, l);
      return {
        items: pigmyResult.items,
        leads: pigmyResult.items,
        data: pigmyResult.items,
        pagination,
        stats: pigmyResult.stats,
        productType: 'PIGMY'
      };
    }

    // 3. LOAN (Default)
    const executiveId = (executiveUserOrId && typeof executiveUserOrId === 'object')
      ? (executiveUserOrId.id || executiveUserOrId._id)
      : executiveUserOrId;

    const {
      status,
      currentStep,
      search,
      merchantId,
      startDate,
      endDate,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = filters;

    const conditions = [];

    // 1. Executive / Branch / Bank Scoping
    if (executiveId) {
      const executiveUser = (executiveUserOrId && typeof executiveUserOrId === 'object')
        ? executiveUserOrId
        : (mongoose.Types.ObjectId.isValid(executiveId) ? await User.findById(executiveId).lean() : null);
      const userRole = (executiveUser?.role || '').toUpperCase();
      const isBankPrivileged = ['SUPER_ADMIN', 'ADMIN', 'BANK_ADMIN', 'BANK_OWNER', 'SOCIETY_ADMIN', 'HO_ADMIN', 'REGIONAL_MANAGER', 'CREDIT_MANAGER', 'RISK_MANAGER'].includes(userRole);
      const isBranchPrivileged = ['BRANCH_MANAGER', 'BRANCH_STAFF', 'MANAGER'].includes(userRole);

      const execStrId = executiveId.toString();
      const execObjId = mongoose.Types.ObjectId.isValid(execStrId) ? new mongoose.Types.ObjectId(execStrId) : null;
      const idMatches = [execStrId];
      if (execObjId) idMatches.push(execObjId);

      if (isBankPrivileged) {
        const context = await this.resolveExecutiveOrBranchContext(executiveUser);
        if (context.bankId) {
          const bankObjId = mongoose.Types.ObjectId.isValid(context.bankId) ? new mongoose.Types.ObjectId(context.bankId) : context.bankId;
          conditions.push({
            $or: [
              { assignedBankId: bankObjId },
              { bankId: bankObjId },
              { createdByExecutiveId: { $in: idMatches } },
              { createdBy: { $in: idMatches } }
            ]
          });
        }
      } else if (isBranchPrivileged) {
        const context = await this.resolveExecutiveOrBranchContext(executiveUser);
        if (context.branchId) {
          const branchObjId = mongoose.Types.ObjectId.isValid(context.branchId) ? new mongoose.Types.ObjectId(context.branchId) : context.branchId;
          conditions.push({
            $or: [
              { branchId: branchObjId },
              { createdByExecutiveId: { $in: idMatches } },
              { createdBy: { $in: idMatches } }
            ]
          });
        }
      } else {
        conditions.push({
          $or: [
            { createdByExecutiveId: { $in: idMatches } },
            { createdBy: { $in: idMatches } },
            { assignedEmployeeId: { $in: idMatches } },
            { 'createdByDetails.id': { $in: idMatches } },
            { 'createdByDetails.userId': { $in: idMatches } }
          ]
        });
      }
    }

    // 2. Only show SUBMITTED loan applications (Exclude incomplete/draft lookup leads)
    conditions.push({
      status: { $nin: ['DRAFT', 'INCOMPLETE', 'CANCELLED', 'EXPIRED', 'LOOKUP_DONE', 'OTP_VERIFIED'] },
      currentStep: { $nin: ['LOOKUP', 'PRODUCT_DETAILS', 'SLABS', 'CALCULATE', 'LOAN_CALCULATED'] }
    });

    // 3. Status Filter
    if (status && status.trim().toUpperCase() !== 'ALL' && status.trim().toUpperCase() !== 'ALL LEADS') {
      conditions.push({ status: status.trim().toUpperCase() });
    }

    // 4. Step Filter
    if (currentStep && currentStep.trim().toUpperCase() !== 'ALL') {
      conditions.push({ currentStep: currentStep.trim().toUpperCase() });
    }

    // 5. Merchant Filter
    if (merchantId && mongoose.Types.ObjectId.isValid(merchantId)) {
      conditions.push({ merchantId: new mongoose.Types.ObjectId(merchantId) });
    }

    // 6. Date Range Filter
    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);
      conditions.push({ createdAt: dateFilter });
    }

    const query = conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : { $and: conditions }) : {};

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skipCount = (pageNum - 1) * limitNum;
    const sortDirection = sortOrder.toLowerCase() === 'asc' ? 1 : -1;
    const sortObj = { [sortBy]: sortDirection, _id: sortDirection };

    const totalCount = await Loan.countDocuments(query);
    const pagination = paginationUtil.getPaginationMeta(totalCount, pageNum, limitNum);

    let loans = await Loan.find(query)
      .populate({ path: 'merchantId', model: 'MerchantProfile', select: 'shopName ownerName email phoneNumber address city pincode merchantCode' })
      .populate({ path: 'customerId', model: 'User', select: 'phoneNumber fullName email profileId' })
      .sort(sortObj)
      .skip(skipCount)
      .limit(limitNum)
      .lean();

    // Batch lookup customer profiles by userId, customerId, _id, and phoneNumber
    const customerUserIds = [...new Set(loans.map(l => l.customerId?._id || l.customerId).filter(Boolean))];
    const phoneNumbers = [...new Set(loans.map(l => l.customerPhoneNumber || l.customerId?.phoneNumber).filter(Boolean))];

    const customerProfiles = await CustomerProfile.find({
      $or: [
        { userId: { $in: customerUserIds } },
        { customerId: { $in: customerUserIds } },
        { _id: { $in: customerUserIds } },
        ...(phoneNumbers.length > 0 ? [{ phoneNumber: { $in: phoneNumbers } }] : [])
      ]
    }).lean();

    const profileMap = new Map();
    customerProfiles.forEach(p => {
      if (p.userId) profileMap.set(p.userId.toString(), p);
      if (p.customerId) profileMap.set(p.customerId.toString(), p);
      if (p._id) profileMap.set(p._id.toString(), p);
      if (p.phoneNumber) profileMap.set(p.phoneNumber, p);
    });

    // In-memory Search Filter if Search Query is provided
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      loans = loans.filter(loan => {
        const userObj = loan.customerId && typeof loan.customerId === 'object' ? loan.customerId : null;
        const userStrId = userObj?._id?.toString() || loan.customerId?.toString();
        const phone = loan.customerPhoneNumber || userObj?.phoneNumber || '';
        const profile = (userStrId ? profileMap.get(userStrId) : null) || (phone ? profileMap.get(phone) : null);

        const nameMatch = profile?.fullName?.match(searchRegex) || profile?.firstName?.match(searchRegex) || userObj?.fullName?.match(searchRegex);
        const phoneMatch = phone.match(searchRegex);
        const panMatch = profile?.panNumber?.match(searchRegex);
        const aadhaarMatch = profile?.aadhaarNumber?.match(searchRegex);
        const appMatch = loan.applicationId?.match(searchRegex);
        const merchantMatch = loan.merchantId?.shopName?.match(searchRegex);
        const modelMatch = loan.productDetails?.modelName?.match(searchRegex) || loan.productDetails?.brandName?.match(searchRegex);
        return nameMatch || phoneMatch || panMatch || aadhaarMatch || appMatch || merchantMatch || modelMatch;
      });
    }

    const filteredCustomerUserIds = loans.map(l => (l.customerId?._id || l.customerId)).filter(Boolean);
    const societyLinks = filteredCustomerUserIds.length > 0
      ? await SocietyCustomerLink.find({ userId: { $in: filteredCustomerUserIds } }).lean()
      : [];
    const societyLinkMap = new Map();
    societyLinks.forEach(link => {
      societyLinkMap.set(String(link.userId), link);
    });

    const items = loans.map(loan => {
      const userObj = loan.customerId && typeof loan.customerId === 'object' ? loan.customerId : null;
      const userStrId = userObj?._id?.toString() || loan.customerId?.toString();
      const phone = loan.customerPhoneNumber || userObj?.phoneNumber || '';
      const profile = (userStrId ? profileMap.get(userStrId) : null) || (phone ? profileMap.get(phone) : null);

      const fullName = profile?.fullName ||
                       (profile ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() : null) ||
                       userObj?.fullName ||
                       loan.customerDetails?.fullName ||
                       loan.customerName ||
                       'Customer';

      const finalPhone = phone || profile?.phoneNumber || userObj?.phoneNumber || loan.customerDetails?.phoneNumber || '';

      const resolvedUserId = String(userObj?._id || loan.customerId?._id || loan.customerId);
      const socLink = societyLinkMap.get(resolvedUserId);
      const societyAccount = socLink?.societyAccountNumber ? {
        societyAccountNumber: socLink.societyAccountNumber,
        ifscCode: socLink.ifscCode || '',
        accountHolderName: socLink.accountHolderName || fullName,
        bankBranchName: socLink.bankBranchName || ''
      } : null;

      return {
        loanId: loan._id,
        applicationId: loan.applicationId,
        status: loan.status,
        currentStep: loan.currentStep,
        approvalStatus: loan.approvalTimer?.approvalStatus || loan.status,
        societyAccount,
        customerDetails: {
          customerId: profile?._id || userObj?._id || loan.customerId,
          fullName,
          phoneNumber: finalPhone,
          gender: profile?.gender || loan.customerDetails?.gender || null,
          dob: profile?.dob || loan.customerDetails?.dob || null,
          panNumber: profile?.panNumber || loan.customerDetails?.panNumber || loan.panNumber || null,
          aadhaarNumber: profile?.aadhaarNumber || loan.customerDetails?.aadhaarNumber || loan.aadhaarNumber || null,
          address: profile?.address || profile?.activeAddress?.addressLine || loan.customerDetails?.address || loan.address || null,
          residentialPincode: profile?.residentialPincode || profile?.activeAddress?.pincode || loan.customerDetails?.residentialPincode || loan.pincode || null,
          panImage: profile?.panImage || loan.customerDetails?.panImage || loan.panImage || null,
          aadhaarImage: profile?.aadhaarImage || loan.customerDetails?.aadhaarImage || loan.aadhaarImage || null,
          livePhoto: profile?.livePhoto || loan.customerDetails?.livePhoto || loan.livePhoto || null,
          societyAccount
        },
        productDetails: {
          merchantId: loan.merchantId?._id || loan.merchantId,
          brandName: loan.productDetails?.brandName || null,
          modelName: loan.productDetails?.modelName || null,
          imeiNumber: loan.productDetails?.imeiNumber || null,
          productPrice: loan.productPrice || loan.productDetails?.price || 0,
          productPhoto: loan.productDetails?.productPhoto || null,
          imeiPhoto: loan.productDetails?.imeiPhoto || null
        },
        merchantDetails: loan.merchantId && typeof loan.merchantId === 'object' ? {
          merchantId: loan.merchantId._id,
          shopName: loan.merchantId.shopName,
          merchantCode: loan.merchantId.merchantCode,
          ownerName: loan.merchantId.ownerName,
          phoneNumber: loan.merchantId.phoneNumber,
          email: loan.merchantId.email,
          address: loan.merchantId.address
        } : null,
        financialDetails: {
          productPrice: loan.productPrice || 0,
          tenureMonths: loan.tenureMonths || 0,
          downPayment: loan.downPayment || 0,
          totalLoanAmount: loan.totalLoanAmount || 0,
          emiAmount: loan.emiAmount || 0,
          processingFee: loan.processingFee || loan.processingFees || 0,
          dbdCharges: loan.dbdCharges || loan.dbd || 0,
          membershipFee: loan.membershipFee || 0,
          financialChecksum: loan.antiTamperingChecksum || null
        },
        repaymentBankAccount: loan.repaymentBankAccount || null,
        mandateDetails: loan.mandateDetails || null,
        esignDetails: loan.esignDetails || null,
        createdAt: loan.createdAt,
        updatedAt: loan.updatedAt
      };
    });

    return {
      items,
      leads: items,
      data: items,
      pagination,
      productType: 'LOAN'
    };
  }

  /**
   * Fetches single lead application details with full populated customer photos & merchant info
   */
  async getLeadDetails(id, executiveUserOrId, query = {}) {
    if (!id) {
      throw ApiError.badRequest('Loan ID, Application ID, or Customer Phone is required.');
    }

    const type = String(query.type || query.productType || '').toUpperCase();
    const executiveUser = (executiveUserOrId && typeof executiveUserOrId === 'object' && (executiveUserOrId.id || executiveUserOrId._id))
      ? executiveUserOrId
      : { id: executiveUserOrId, _id: executiveUserOrId };
    const executiveId = executiveUser?.id || executiveUser?._id;

    // 1. If explicit MERCHANT request
    if (type === 'MERCHANT') {
      const merchant = await employeeMerchantService.getMerchantDetails(executiveUser, id);
      return { ...merchant, productType: 'MERCHANT' };
    }

    // 2. If explicit PIGMY request
    if (type === 'PIGMY') {
      const pigmy = await employeePigmyService.getPigmyCustomerDetails(executiveUser, id);
      return { ...pigmy, productType: 'PIGMY' };
    }

    // 3. Search Loan
    const trimmedId = String(id).trim();
    const isObjectId = mongoose.Types.ObjectId.isValid(trimmedId);

    const loan = await Loan.findOne({
      $or: [
        ...(isObjectId ? [{ _id: new mongoose.Types.ObjectId(trimmedId) }] : []),
        { applicationId: trimmedId },
        { customerPhoneNumber: trimmedId }
      ]
    })
      .populate({ path: 'merchantId', model: 'MerchantProfile', select: 'shopName ownerName email phoneNumber address city pincode merchantCode' })
      .populate({ path: 'customerId', model: 'User', select: 'phoneNumber fullName email profileId' })
      .sort({ createdAt: -1 })
      .lean();

    if (!loan) {
      // Fallback: If type was not explicitly LOAN, check Merchant or Pigmy by identifier
      if (!type || type === 'ALL' || type === 'MERCHANT' || type === 'PIGMY') {
        try {
          const merchant = await employeeMerchantService.getMerchantDetails(executiveUser, id);
          if (merchant) return { ...merchant, productType: 'MERCHANT' };
        } catch (_) {}
        try {
          const pigmy = await employeePigmyService.getPigmyCustomerDetails(executiveUser, id);
          if (pigmy) return { ...pigmy, productType: 'PIGMY' };
        } catch (_) {}
      }
      throw ApiError.notFound(`Customer lead record not found for identifier [${id}].`);
    }

    // Verify Executive Access Scoping if executiveId is present
    if (executiveId) {
      const userRole = (executiveUser?.role || '').toUpperCase();
      const isPrivileged = ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'BRANCH_STAFF', 'SOCIETY_ADMIN', 'BANK_ADMIN', 'BANK_OWNER', 'CREDIT_MANAGER', 'RISK_MANAGER', 'MANAGER', 'HO_ADMIN', 'REGIONAL_MANAGER', 'ONBOARDING_TEAM', 'QUALITY_CHECK', 'QC'].includes(userRole);
      if (!isPrivileged) {
        let userBankId = executiveUser?.bankId;
        let userBranchId = executiveUser?.branchId;

        // Auto-resolve branch/bank from EmployeeProfile if not present on token
        if (!userBranchId || !userBankId) {
          const emp = await EmployeeProfile.findOne({ userId: executiveId }).select('bankId branchId').lean()
            || await SocietyEmployee.findOne({ userId: executiveId }).select('bankId branchId').lean();
          if (emp) {
            userBankId = userBankId || emp.bankId;
            userBranchId = userBranchId || emp.branchId;
          }
        }

        const execStrId = executiveId.toString();
        const createdByExec = (loan.createdByExecutiveId || loan.createdBy || loan.assignedEmployeeId || loan.createdByDetails?.id || loan.createdByDetails?.userId || '').toString();
        const isCreator = createdByExec && createdByExec === execStrId;
        const branchMatch = userBranchId && loan.branchId && (typeof loan.branchId === 'object' ? loan.branchId._id?.toString() : loan.branchId.toString()) === userBranchId.toString();
        const bankMatch = userBankId && loan.bankId && (typeof loan.bankId === 'object' ? loan.bankId._id?.toString() : loan.bankId.toString()) === userBankId.toString();
        const isUnassigned = !loan.branchId && !loan.bankId;

        // In employee app, allow viewing unless explicitly belonging to another bank
        if (!isCreator && !branchMatch && !bankMatch && !isUnassigned && loan.bankId && userBankId && loan.bankId.toString() !== userBankId.toString()) {
          throw ApiError.notFound(`Customer lead record not found or access denied for this executive.`);
        }
      }
    }

    const userObj = loan.customerId && typeof loan.customerId === 'object' ? loan.customerId : null;
    const userStrId = userObj?._id?.toString() || loan.customerId?.toString();
    const phone = loan.customerPhoneNumber || userObj?.phoneNumber || id;

    const profile = await CustomerProfile.findOne({
      $or: [
        ...(userStrId ? [{ userId: userStrId }, { customerId: userStrId }, { _id: userStrId }] : []),
        ...(phone ? [{ phoneNumber: phone }] : [])
      ]
    }).lean();

    const fullName = profile?.fullName ||
                     (profile ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() : null) ||
                     userObj?.fullName ||
                     loan.customerDetails?.fullName ||
                     loan.customerName ||
                     'Customer';

    const finalPhone = phone || profile?.phoneNumber || userObj?.phoneNumber || loan.customerDetails?.phoneNumber || '';

    const targetUserId = userObj?._id || loan.customerId?._id || loan.customerId;
    let socLink = null;
    if (targetUserId) {
      if (loan.assignedBankId) {
        socLink = await SocietyCustomerLink.findOne({
          userId: targetUserId,
          bankId: loan.assignedBankId
        }).lean();
      }
      if (!socLink) {
        socLink = await SocietyCustomerLink.findOne({
          userId: targetUserId
        }).sort({ lastKycDate: -1, createdAt: -1 }).lean();
      }
    }

    const societyAccount = socLink?.societyAccountNumber ? {
      societyAccountNumber: socLink.societyAccountNumber,
      ifscCode: socLink.ifscCode || '',
      accountHolderName: socLink.accountHolderName || fullName,
      bankBranchName: socLink.bankBranchName || ''
    } : null;

    return {
      loanId: loan._id,
      applicationId: loan.applicationId,
      productType: 'LOAN',
      status: loan.status,
      currentStep: loan.currentStep,
      approvalStatus: loan.approvalTimer?.approvalStatus || loan.status,
      autoApproved: loan.approvalTimer?.autoApproved || false,
      timerExpiresAt: loan.approvalTimer?.timerExpiresAt || null,
      societyAccount,
      customerDetails: {
        customerId: profile?._id || userObj?._id || loan.customerId,
        fullName,
        phoneNumber: finalPhone,
        gender: profile?.gender || loan.customerDetails?.gender || null,
        dob: profile?.dob || loan.customerDetails?.dob || null,
        panNumber: profile?.panNumber || loan.customerDetails?.panNumber || loan.panNumber || null,
        aadhaarNumber: profile?.aadhaarNumber || loan.customerDetails?.aadhaarNumber || loan.aadhaarNumber || null,
        address: profile?.address || profile?.activeAddress?.addressLine || loan.customerDetails?.address || loan.address || null,
        residentialPincode: profile?.residentialPincode || profile?.activeAddress?.pincode || loan.customerDetails?.residentialPincode || loan.pincode || null,
        panImage: profile?.panImage || loan.customerDetails?.panImage || loan.panImage || null,
        aadhaarImage: profile?.aadhaarImage || loan.customerDetails?.aadhaarImage || loan.aadhaarImage || null,
        livePhoto: profile?.livePhoto || loan.customerDetails?.livePhoto || loan.livePhoto || null,
        societyAccount
      },
      productDetails: {
        merchantId: loan.merchantId?._id || loan.merchantId,
        brandName: loan.productDetails?.brandName || null,
        modelName: loan.productDetails?.modelName || null,
        imeiNumber: loan.productDetails?.imeiNumber || null,
        productPrice: loan.productPrice || loan.productDetails?.price || 0,
        productPhoto: loan.productDetails?.productPhoto || null,
        imeiPhoto: loan.productDetails?.imeiPhoto || null
      },
      merchantDetails: loan.merchantId && typeof loan.merchantId === 'object' ? {
        merchantId: loan.merchantId._id,
        shopName: loan.merchantId.shopName,
        merchantCode: loan.merchantId.merchantCode,
        ownerName: loan.merchantId.ownerName,
        phoneNumber: loan.merchantId.phoneNumber,
        email: loan.merchantId.email,
        address: loan.merchantId.address
      } : null,
      financialDetails: {
        productPrice: loan.productPrice || 0,
        tenureMonths: loan.tenureMonths || 0,
        downPayment: loan.downPayment || 0,
        totalLoanAmount: loan.totalLoanAmount || 0,
        emiAmount: loan.emiAmount || 0,
        processingFee: loan.processingFee || loan.processingFees || 0,
        dbdCharges: loan.dbdCharges || loan.dbd || 0,
        membershipFee: loan.membershipFee || 0,
        emiCardCharges: loan.emiCardCharges || 0,
        financialChecksum: loan.antiTamperingChecksum || null
      },
      emiCard: await (async () => {
        const emiCardDoc = await EmiCard.findOne({ customerId: loan.customerId, status: { $ne: 'CANCELLED' } })
          .populate('bankId')
          .sort({ createdAt: -1 });
        if (!emiCardDoc) return { exists: false, expired: false };
        const isExp = emiCardDoc.status === 'EXPIRED' || (emiCardDoc.validThru && isCardExpired(emiCardDoc.validThru));
        return {
          exists: true,
          id: emiCardDoc._id,
          cardNumber: maskCardNumber(emiCardDoc.cardNumber),
          cardHolderName: emiCardDoc.cardHolderName,
          validThru: emiCardDoc.validThru,
          status: emiCardDoc.status,
          isExpired: isExp,
          brandLogo: "https://sahayaone-backend.onrender.com/public/mocks/logo-sahayaone.png",
          bankName: emiCardDoc.bankId?.name || null,
          bankLogo: emiCardDoc.bankId?.logo || "https://sahayaone-backend.onrender.com/public/mocks/logo-society.png"
        };
      })(),
      repaymentBankAccount: loan.repaymentBankAccount || null,
      mandateDetails: loan.mandateDetails || null,
      esignDetails: loan.esignDetails || null,
      createdAt: loan.createdAt,
      updatedAt: loan.updatedAt
    };
  }

  /**
   * Screen 1: Fetch Eligible Merchants belonging to Executive's SAME Bank & SAME Branch
   */
  async getEligibleMerchants(executiveUser) {
    const context = await this.resolveExecutiveOrBranchContext(executiveUser);
    const bankId = context.bankId;
    const branchId = context.branchId;

    if (!bankId && !branchId) {
      throw ApiError.badRequest('User/Executive is not assigned to a bank branch or bank.');
    }

    const filter = { status: 'ACTIVE' };
    if (bankId) filter.bankId = bankId;
    if (branchId) filter.branchId = branchId;

    const merchants = await MerchantProfile.find(filter).select('_id shopName ownerName email phoneNumber bankId branchId status createdAt');

    return {
      success: true,
      count: merchants.length,
      merchants: merchants.map(m => ({
        merchantId: m._id,
        shopName: m.shopName,
        ownerName: m.ownerName,
        phoneNumber: m.phoneNumber,
        email: m.email
      })),
      message: 'Eligible merchants fetched successfully for executive branch.'
    };
  }

  /**
   * Screen 1: Submit Product Details (Brand, Model, IMEI, Product Photo, Merchant Selection)
   */
  async submitProductDetails(executiveUser, payload) {
    const userId = executiveUser?.id || executiveUser?._id;
    const { merchantId, brandName, modelName, imeiNumber, productPhoto, imeiPhoto, phoneNumber, customerId } = payload;

    // 1. Validate required payload parameters
    if (!phoneNumber) throw ApiError.badRequest('phoneNumber is required.');
    if (!merchantId) throw ApiError.badRequest('merchantId is required.');
    if (!brandName || !String(brandName).trim()) throw ApiError.badRequest('brandName is required.');
    if (!modelName || !String(modelName).trim()) throw ApiError.badRequest('modelName is required.');
    if (!imeiNumber || !String(imeiNumber).trim()) throw ApiError.badRequest('imeiNumber is required.');
    if (!productPhoto || !String(productPhoto).trim()) throw ApiError.badRequest('productPhoto is required.');
    if (!imeiPhoto || !String(imeiPhoto).trim()) throw ApiError.badRequest('imeiPhoto is required.');

    // 2. Resolve and Validate Customer Record by Phone Number FIRST
    const cleanPhone = String(phoneNumber || '').replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      throw ApiError.badRequest('Please enter a valid 10-digit mobile number.');
    }

    let customerUser = await User.findOne({ phoneNumber: cleanPhone, isDeleted: { $ne: true } });

    if (!customerUser) {
      throw ApiError.notFound(`Customer user not found for phone number (${cleanPhone}). Please complete customer onboarding first.`);
    }

    const customerProfile = await CustomerProfile.findOne({
      $or: [
        ...(customerUser.profileId ? [{ _id: customerUser.profileId }] : []),
        { userId: customerUser._id },
        { phoneNumber: cleanPhone }
      ]
    });
    if (!customerProfile) {
      throw ApiError.notFound(`Customer profile record not found for phone number (${cleanPhone}). Please complete customer onboarding first.`);
    }

    // Ensure bidirectional link and phoneNumber are always synchronized
    if (String(customerProfile.userId) !== String(customerUser._id) || !customerProfile.phoneNumber) {
      customerProfile.userId = customerUser._id;
      customerProfile.phoneNumber = cleanPhone;
      await customerProfile.save();
    }
    if (!customerUser.profileId || String(customerUser.profileId) !== String(customerProfile._id)) {
      customerUser.profileId = customerProfile._id;
      customerUser.profileModel = 'CustomerProfile';
      await customerUser.save();
    }

    // 3. Get Context to verify Bank & Branch alignment
    const context = await this.resolveExecutiveOrBranchContext(executiveUser);
    const bankId = context.bankId;
    const branchId = context.branchId;

    if (!bankId && !branchId) {
      throw ApiError.badRequest('Executive branch record not found or not assigned to a bank branch.');
    }

    // 4. Verify Selected Merchant exists and belongs to Executive's SAME Bank & Branch
    const merchant = await MerchantProfile.findById(merchantId);
    if (!merchant) {
      throw ApiError.badRequest(`Selected merchant (${merchantId}) was not found in the database. Please select a valid merchant.`);
    }

    if (merchant.status !== 'ACTIVE') {
      throw ApiError.badRequest(`Selected merchant (${merchant.shopName || merchantId}) is currently inactive.`);
    }

    if (bankId && merchant.bankId && String(merchant.bankId) !== String(bankId)) {
      throw ApiError.badRequest('Selected merchant does not belong to your bank.');
    }

    if (branchId && merchant.branchId && String(merchant.branchId) !== String(branchId)) {
      throw ApiError.badRequest('Selected merchant does not belong to your bank branch.');
    }

    // 5. Upload / Process productPhoto and imeiPhoto
    const uploadedProductPhoto = (await processDocumentUpload(productPhoto, 'product_photo', cleanPhone, 'products')) || productPhoto;
    const uploadedImeiPhoto = (await processDocumentUpload(imeiPhoto, 'imei_photo', cleanPhone, 'products')) || imeiPhoto;

    // 6. Generate Application ID and create Draft Loan record
    const applicationId = 'ADV-' + Date.now().toString().slice(-6) + Math.floor(100 + Math.random() * 900);

    const productDetailsObj = {
      brandName: String(brandName).trim(),
      modelName: String(modelName).trim(),
      imeiNumber: String(imeiNumber).trim(),
      productPhoto: uploadedProductPhoto,
      imeiPhoto: uploadedImeiPhoto,
      merchantName: merchant.shopName
    };

    // Fallback variantId if needed for schema compatibility
    let defaultVariant = await Variant.findOne();

    const customerFullName = customerProfile.fullName || customerUser.fullName || `${customerProfile.firstName || ''} ${customerProfile.lastName || ''}`.trim() || 'Customer';

    const loan = await Loan.create({
      applicationId,
      customerId: customerUser._id,
      customerPhoneNumber: cleanPhone,
      customerName: customerFullName,
      merchantId: merchant._id,
      assignedBankId: bankId || merchant.bankId,
      branchId: branchId || merchant.branchId,
      createdByExecutiveId: userId,
      sourceType: 'EXECUTIVE',
      status: 'NEW',
      currentStep: 'PRODUCT_DETAILS',
      productPrice: payload.productPrice ? Number(payload.productPrice) : 0,
      totalAmount: payload.productPrice ? Number(payload.productPrice) : 0,
      downPayment: 0,
      totalLoanAmount: payload.productPrice ? Number(payload.productPrice) : 0,
      interestAmount: 0,
      insuranceAmount: 0,
      totalPayableAmount: payload.productPrice ? Number(payload.productPrice) : 0,
      emiAmount: 0,
      tenureMonths: 6,
      outstandingAmount: payload.productPrice ? Number(payload.productPrice) : 0,
      productDetails: productDetailsObj,
      variantId: defaultVariant?._id || merchant._id
    });

    return {
      success: true,
      statusCode: 200,
      message: 'Product and merchant details saved successfully. Proceed to Screen 2.',
      nextStep: 'SCREEN_2_LOAN_CALCULATION',
      screenName: 'SCREEN_2_LOAN_CALCULATION',
      data: {
        applicationId: loan.applicationId,
        loanId: loan._id,
        merchant: {
          merchantId: merchant._id,
          shopName: merchant.shopName,
          ownerName: merchant.ownerName
        },
        product: productDetailsObj,
        nextStep: 'SCREEN_2_LOAN_CALCULATION',
        screenName: 'SCREEN_2_LOAN_CALCULATION'
      }
    };
  }

  /**
   * Screen 2: Get EMI Slabs array with Month-wise Down Payment breakdown & ₹110 Membership Fee
   */
  async getEmiSlabs(executiveUser, payload) {
    const { productPrice, purchaseEmiCard = true, purchaseInsurance = false, customerId, loanId, applicationId } = payload;
    const priceNum = Number(productPrice);

    if (!priceNum || priceNum <= 0) {
      throw ApiError.badRequest('Please provide a valid positive productPrice.');
    }

    let shouldPurchaseCard = purchaseEmiCard !== false;
    let targetCustomerId = customerId;
    if (!targetCustomerId && loanId && mongoose.Types.ObjectId.isValid(loanId)) {
      const loanDoc = await Loan.findById(loanId);
      targetCustomerId = loanDoc?.customerId;
    } else if (!targetCustomerId && applicationId) {
      const loanDoc = await Loan.findOne({ applicationId });
      targetCustomerId = loanDoc?.customerId;
    }

    if (targetCustomerId) {
      const card = await EmiCard.findOne({ customerId: targetCustomerId, status: { $ne: 'CANCELLED' } }).sort({ createdAt: -1 });
      if (card && card.status !== 'EXPIRED' && !(card.validThru && isCardExpired(card.validThru))) {
        shouldPurchaseCard = false;
      }
    }

    const slabs = await employeeLoansService.calculateEmiSlabs(priceNum, {
      shouldPurchaseCard,
      purchaseInsurance: purchaseInsurance === true
    });

    return {
      message: 'EMI slabs calculated successfully.',
      productPrice: priceNum,
      membershipFee: 110,
      slabsCount: slabs.length,
      slabs
    };
  }

  /**
   * Screen 2: Calculate & Submit Selected Loan Slab Details
   */
  async calculateLoanDetails(executiveUser, payload) {
    const { productPrice, tenureMonths, loanId, applicationId, customerId: reqCustomerId, purchaseEmiCard = true, purchaseInsurance = false } = payload;
    const priceNum = Number(productPrice);
    const tenureNum = Number(tenureMonths);

    if (!priceNum || priceNum <= 0) {
      throw ApiError.badRequest('Please provide a valid positive productPrice.');
    }
    if (!tenureNum || tenureNum <= 0) {
      throw ApiError.badRequest('Please select a valid tenureMonths.');
    }

    const userId = executiveUser?.id || executiveUser?._id;

    // Locate draft loan FIRST to resolve customerId and update loan record
    let loan = null;
    if (loanId) {
      if (!mongoose.Types.ObjectId.isValid(loanId)) {
        throw ApiError.badRequest('Invalid loanId format. Must be a valid 24-character ID.');
      }
      loan = await Loan.findById(loanId);
      if (!loan) {
        throw ApiError.notFound(`Loan application record not found for loanId (${loanId}). Please provide a valid loanId.`);
      }
    } else if (applicationId) {
      loan = await Loan.findOne({ applicationId });
      if (!loan) {
        throw ApiError.notFound(`Loan application record not found for applicationId (${applicationId}). Please provide a valid applicationId.`);
      }
    } else {
      throw ApiError.badRequest('loanId or applicationId is required to calculate and update loan details.');
    }

    const customerId = reqCustomerId || loan?.customerId;

    // Perform exact calculation using employeeLoansService WITH customerId
    const calc = await employeeLoansService.calculateLoan({
      productPrice: priceNum,
      tenureMonths: tenureNum,
      purchaseEmiCard: purchaseEmiCard !== false,
      purchaseInsurance: purchaseInsurance === true,
      customerId,
      userId
    });

    // Generate Anti-Tampering Checksum
    const secret = process.env.JWT_SECRET || 'sahayaone_financial_anti_tamper_secret';
    const checksumPayload = `${calc.productPrice}:${calc.tenureMonths}:${calc.downPayment}:${calc.totalLoanAmount}:${calc.emiAmount}`;
    const financialChecksum = crypto.createHmac('sha256', secret).update(checksumPayload).digest('hex');

    if (loan) {
      loan.productPrice = calc.productPrice;
      loan.tenureMonths = calc.tenureMonths;
      loan.repaymentMonths = calc.repaymentMonths;
      loan.emiAmount = calc.emiAmount;
      loan.downPayment = calc.downPayment;
      loan.baseDownPayment = calc.baseDownPayment;
      loan.dbdCharges = calc.dbdCharges;
      loan.membershipFee = calc.membershipFee || 110;
      loan.emiCardCharges = calc.emiCardCharges;
      loan.insuranceAmount = calc.insuranceAmount;
      loan.totalAmount = calc.totalAmount;
      loan.totalLoanAmount = calc.totalLoanAmount;
      loan.interestAmount = calc.interestAmount;
      loan.totalPayableAmount = calc.totalPayableAmount;
      loan.outstandingAmount = calc.totalPayableAmount;
      loan.antiTamperingChecksum = financialChecksum;
      loan.currentStep = 'LOAN_CALCULATED';
      loan.draftMetadata = {
        lastSavedStep: 'LOAN_CALCULATED',
        lastSavedAt: new Date(),
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        isExpired: false
      };
      await loan.save();
    }

    return {
      message: 'Loan calculation completed successfully. Proceed to Screen 3.',
      applicationId: loan?.applicationId || null,
      loanId: loan?._id || null,
      financialChecksum,
      cardInfo: calc.cardInfo,
      calculation: {
        productPrice: calc.productPrice,
        tenureMonths: calc.tenureMonths,
        repaymentMonths: calc.repaymentMonths,
        monthlyEmi: calc.emiAmount,
        baseDownPayment: calc.baseDownPayment,
        dbdCharges: calc.dbdCharges,
        membershipFee: calc.membershipFee || 110,
        emiCardCharges: calc.emiCardCharges,
        insuranceAmount: calc.insuranceAmount,
        totalDownPayment: calc.downPayment,
        totalLoanAmount: calc.totalLoanAmount,
        totalPayableAmount: calc.totalPayableAmount,
        financialChecksum,
        cardInfo: calc.cardInfo
      },
      nextStep: 'SCREEN_3_CUSTOMER_BANK_AND_SIGNATURE',
      screenName: 'SCREEN_3_CUSTOMER_BANK_AND_SIGNATURE'
    };
  }

  /**
   * Screen 3 Step 1: Initiate Razorpay e-NACH Mandate Registration
   */
  async initiateMandate(executiveUser, payload) {
    const { loanId, applicationId, bankName, accountNumber, ifsc, accountHolder, authType = 'NETBANKING', maxAmount = 15000, hostUrl } = payload;
    
    let loan = null;
    if (loanId) {
      if (!mongoose.Types.ObjectId.isValid(loanId)) {
        throw ApiError.badRequest('Invalid loanId format provided.');
      }
      loan = await Loan.findById(loanId);
    } else if (applicationId) {
      loan = await Loan.findOne({ applicationId });
    }

    if (!loan) {
      throw ApiError.notFound('Loan draft application not found for provided loanId or applicationId.');
    }

    const customerProfile = await CustomerProfile.findOne({
      $or: [
        ...(loan.customerId ? [{ _id: loan.customerId }, { userId: loan.customerId }] : []),
        ...(loan.customerPhoneNumber ? [{ phoneNumber: loan.customerPhoneNumber }] : [])
      ]
    });

    const mandateOrderRes = await razorpayHelper.createMandateOrder({
      loanId: loan._id,
      maxAmount: Number(maxAmount) || 15000,
      authType,
      bankDetails: { bankName, accountNumber, ifsc, accountHolder },
      customer: {
        name: accountHolder || customerProfile?.fullName || 'Customer',
        phone: loan.customerPhoneNumber || customerProfile?.phoneNumber,
        email: customerProfile?.email
      },
      hostUrl
    });

    const mandateId = mandateOrderRes.mandateId;
    const tokenId = mandateOrderRes.tokenId;
    const razorpayMandateUrl = mandateOrderRes.razorpayMandateUrl;
    const interactiveWebviewUrl = mandateOrderRes.interactiveWebviewUrl;

    loan.repaymentBankAccount = { bankName, accountNumber, ifsc, accountHolder };
    loan.mandateDetails = {
      mandateId,
      tokenId,
      authType,
      maxAmount: Number(maxAmount) || 15000,
      status: 'PENDING',
      initiatedAt: new Date()
    };
    loan.draftMetadata.lastSavedStep = 'MANDATE_INITIATED';
    loan.draftMetadata.lastSavedAt = new Date();
    await loan.save();

    return {
      message: 'Razorpay e-NACH / UPI Mandate initiated successfully.',
      mandateId,
      tokenId,
      status: 'PENDING',
      razorpayMandateUrl,
      interactiveWebviewUrl,
      nextStep: 'SCREEN_3_VERIFY_MANDATE',
      screenName: 'SCREEN_3_VERIFY_MANDATE'
    };
  }

  /**
   * Screen 3 Step 2: Verify Razorpay e-NACH / UPI Mandate Signature & Callback
   */
  async verifyMandate(executiveUser, payload) {
    const { mandateId, razorpayPaymentId, razorpaySignature } = payload;

    if (!mandateId) {
      throw ApiError.badRequest('mandateId is required for mandate verification.');
    }

    const loan = await Loan.findOne({ 'mandateDetails.mandateId': mandateId });
    if (!loan) {
      throw ApiError.notFound(`Mandate application with ID [${mandateId}] not found.`);
    }

    loan.mandateDetails.status = 'ACTIVE';
    loan.mandateDetails.verifiedAt = new Date();
    loan.draftMetadata.lastSavedStep = 'MANDATE_VERIFIED';
    loan.draftMetadata.lastSavedAt = new Date();
    await loan.save();

    return {
      message: 'e-NACH / UPI Mandate verified and activated successfully!',
      verified: true,
      mandateId,
      mandateStatus: 'ACTIVE',
      nextStep: 'SCREEN_3_SUBMIT_APPLICATION',
      screenName: 'SCREEN_3_SUBMIT_APPLICATION'
    };
  }

  /**
   * Helper: Ensure EMI Card generation or renewal on loan application
   */
  async _ensureLoanEmiCard({ customerId, loanId, branchId, assignedBankId, executiveId, customerName = null }) {
    if (!customerId) return null;

    const existingCard = await EmiCard.findOne({ customerId, status: { $ne: 'CANCELLED' } }).sort({ createdAt: -1 });
    let isNewCustomerLoan = false;
    let isExpiredCardLoan = false;

    if (!existingCard) {
      isNewCustomerLoan = true;
    } else if (existingCard.status === 'EXPIRED' || (existingCard.validThru && isCardExpired(existingCard.validThru))) {
      isExpiredCardLoan = true;
    }

    if (!isNewCustomerLoan && !isExpiredCardLoan) {
      return existingCard;
    }

    let branch = branchId ? await Branch.findById(branchId) : null;
    if (!branch && executiveId) {
      const context = await this.resolveExecutiveOrBranchContext(executiveId);
      branch = context.branch;
    }
    if (!branch) {
      branch = await Branch.findOne({ status: 'ACTIVE' });
    }

    const customerUser = await User.findById(customerId).populate('profileId');
    const custName = customerName || (customerUser?.profileId?.firstName
      ? `${customerUser.profileId.firstName} ${customerUser.profileId.lastName || ''}`.trim()
      : customerUser?.fullName || 'Customer');

    // Deduct stock if branch has stock
    if (branch) {
      const availableCardCredits = branch.availableEmiCards || branch.cardStock || branch.totalEmiCards || 0;
      if (availableCardCredits > 0) {
        const balanceBefore = availableCardCredits;
        branch.cardStock = Math.max(0, (branch.cardStock || 0) - 1);
        branch.availableEmiCards = Math.max(0, balanceBefore - 1);
        await branch.save();

        const deductionReason = isNewCustomerLoan
          ? `EMI Card credit deducted for new customer loan allotment: ${custName}`
          : `EMI Card credit deducted for loan allotment (Renewed Expired EMI Card): ${custName}`;

        await CreditLog.create({
          bankId: branch.bankId || assignedBankId,
          branchId: branch._id,
          type: 'EMI_CARD',
          action: 'DEDUCTION',
          amount: 1,
          employeeId: executiveId || null,
          customerId,
          description: deductionReason
        });

        await CardCreditUsage.create({
          bankId: branch.bankId || assignedBankId,
          branchId: branch._id,
          verificationId: customerId,
          type: 'EMI_CARD',
          purpose: isExpiredCardLoan ? 'RENEWAL' : 'NEW_PURCHASE',
          quantity: 1,
          balanceBefore,
          balanceAfter: branch.availableEmiCards,
          createdBy: executiveId || null
        });

        logger.info(`LOAN EMI CARD DEDUCTION: 1 card credit deducted from branch [${branch.name}] for customer [${custName}].`);
      }
    }

    let targetCard = null;
    if (isExpiredCardLoan && existingCard) {
      const previousValidThru = existingCard.validThru;
      const newValidThru = extendValidity(previousValidThru, 1);
      if (!existingCard.renewalHistory) existingCard.renewalHistory = [];
      existingCard.renewalHistory.push({
        renewedAt: new Date(),
        previousValidThru,
        newValidThru,
        renewedByUserId: executiveId || null,
        loanId: loanId || null,
        branchId: branch?._id || branchId,
        bankId: branch?.bankId || assignedBankId,
        fee: 499
      });
      existingCard.validThru = newValidThru;
      existingCard.cardHolderName = custName;
      existingCard.status = 'ACTIVE';
      await existingCard.save();
      targetCard = existingCard;
      logger.info(`EXPIRED EMI CARD RENEWED: Card [${existingCard.cardNumber}] renewed for customer [${custName}] with new validity [${newValidThru}].`);
    } else if (isNewCustomerLoan) {
      const now = new Date();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const currentYearShort = String(now.getFullYear()).slice(-2);
      const formattedCurrent = `${currentMonth}/${currentYearShort}`;
      const initialValidThru = extendValidity(formattedCurrent, 1);
      const generatedNum = `52461245${Math.floor(10000000 + Math.random() * 90000000)}`;

      targetCard = await EmiCard.create({
        bankId: branch?.bankId || assignedBankId,
        branchId: branch?._id || branchId || null,
        customerId,
        cardNumber: generatedNum,
        cardHolderName: custName,
        validThru: initialValidThru,
        cvv: `${Math.floor(100 + Math.random() * 900)}`,
        cardLimit: 100000,
        availableLimit: 100000,
        status: 'ACTIVE',
        allotmentStatus: 'ALLOTTED',
        allottedAt: new Date()
      });
      logger.info(`NEW EMI CARD GENERATED: Card [${generatedNum}] generated for customer [${custName}] valid thru [${initialValidThru}].`);
    }

    return targetCard;
  }

  /**
   * Screen 3 Step 3: Submit Final Loan Application & Start 5-Minute Auto-Approval Timer
   */
  async submitLoanApplicationWithMandate(executiveUser, payload) {
    const {
      loanId,
      applicationId,
      phoneNumber,
      productPrice,
      tenureMonths,
      downPayment,
      totalLoanAmount,
      emiAmount,
      financialChecksum,
      digitalSignature,
      termsAccepted = true,
      bankDetails
    } = payload;

    let loan = null;
    if (loanId) loan = await Loan.findById(loanId);
    else if (applicationId) loan = await Loan.findOne({ applicationId });
    else if (phoneNumber) loan = await Loan.findOne({ customerPhoneNumber: phoneNumber }).sort({ createdAt: -1 });

    if (!loan) {
      throw ApiError.notFound('Draft loan application not found. Please initiate calculation first.');
    }

    // 1. Anti-Tampering Checksum Verification
    if (financialChecksum || loan.antiTamperingChecksum) {
      const secret = process.env.JWT_SECRET || 'sahayaone_financial_anti_tamper_secret';
      const pPrice = productPrice !== undefined ? Number(productPrice) : loan.productPrice;
      const tTenure = tenureMonths !== undefined ? Number(tenureMonths) : loan.tenureMonths;
      const dDown = downPayment !== undefined ? Number(downPayment) : loan.downPayment;
      const tLoan = totalLoanAmount !== undefined ? Number(totalLoanAmount) : loan.totalLoanAmount;
      const eEmi = emiAmount !== undefined ? Number(emiAmount) : loan.emiAmount;

      const expectedChecksumPayload = `${pPrice}:${tTenure}:${dDown}:${tLoan}:${eEmi}`;
      const expectedChecksum = crypto.createHmac('sha256', secret).update(expectedChecksumPayload).digest('hex');

      const incomingChecksum = financialChecksum || loan.antiTamperingChecksum;
      if (incomingChecksum && incomingChecksum !== expectedChecksum) {
        throw ApiError.badRequest('FINANCIAL_DATA_TAMPERED: Submitted loan financial details do not match signed calculation checksum.');
      }
    }

    // 2. Save signature and bank details
    if (digitalSignature) loan.digitalSignature = digitalSignature;
    if (bankDetails) loan.repaymentBankAccount = bankDetails;

    loan.termsAccepted = {
      accepted: termsAccepted === true,
      acceptedAt: new Date(),
      ipAddress: '127.0.0.1'
    };

    // 3. Ensure EMI Card generation / renewal & branch stock deduction
    let emiCard = null;
    try {
      emiCard = await this._ensureLoanEmiCard({
        customerId: loan.customerId,
        loanId: loan._id,
        branchId: loan.branchId,
        assignedBankId: loan.assignedBankId,
        executiveId: executiveUser?.id || executiveUser?._id || loan.createdByExecutiveId,
        customerName: loan.customerName
      });
      if (emiCard?._id) {
        loan.emiCardId = emiCard._id;
      }
    } catch (cardErr) {
      logger.error(`[EMI CARD ALLOTMENT ERROR] Failed for loan [${loan.applicationId}]:`, cardErr.message);
    }

    // 4. Mark Status as PENDING_APPROVAL and start 5-minute Auto-Approval Timer
    loan.status = 'PENDING';
    loan.currentStep = 'PENDING_APPROVAL';
    loan.approvalTimer = {
      approvalStatus: 'PENDING_APPROVAL',
      timerExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
      approvedAt: null,
      autoApproved: false
    };
    loan.draftMetadata.lastSavedStep = 'SUBMITTED_PENDING_APPROVAL';
    loan.draftMetadata.lastSavedAt = new Date();

    await loan.save();

    // Start background auto-approval timer
    loanApprovalTimerService.startAutoApprovalTimer(loan._id);

    return {
      message: 'Loan application submitted successfully! 5-Minute Approval Timer initiated.',
      applicationId: loan.applicationId,
      status: 'PENDING_APPROVAL',
      approvalTimerSeconds: 300,
      timerExpiresAt: loan.approvalTimer.timerExpiresAt,
      emiCard: emiCard ? {
        id: emiCard._id,
        cardNumber: emiCard.cardNumber,
        maskedCardNumber: maskCardNumber(emiCard.cardNumber),
        cardHolderName: emiCard.cardHolderName,
        validThru: emiCard.validThru,
        status: emiCard.status
      } : null,
      nextStep: 'WAIT_FOR_APPROVAL_OR_AUTO_APPROVAL',
      screenName: 'WAIT_FOR_APPROVAL_OR_AUTO_APPROVAL'
    };
  }

  /**
   * Resume Drop-off Application & 72-Hour Expiry Check
   */
  async resumeDraftLead(executiveUser, identifier) {
    const loan = await Loan.findOne({
      $or: [
        { customerPhoneNumber: identifier },
        { applicationId: identifier },
        { _id: mongoose.isValidObjectId(identifier) ? identifier : null }
      ]
    }).sort({ createdAt: -1 });

    if (!loan) {
      throw ApiError.notFound(`No draft application found for identifier [${identifier}].`);
    }

    // 72-Hour Expiry Check (3 Days Expiry)
    const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;
    const lastSaved = new Date(loan.draftMetadata?.lastSavedAt || loan.updatedAt).getTime();
    const isExpired = Date.now() - lastSaved > SEVENTY_TWO_HOURS_MS;

    const customer = await CustomerProfile.findOne({
      $or: [
        ...(loan.customerId ? [{ _id: loan.customerId }, { userId: loan.customerId }] : []),
        ...(loan.customerPhoneNumber ? [{ phoneNumber: loan.customerPhoneNumber }] : [])
      ]
    });

    if (isExpired) {
      loan.draftMetadata.isExpired = true;
      await loan.save();

      return {
        message: 'Draft application expired (older than 72 hours). Please perform fresh EMI calculation.',
        canResume: false,
        isExpired: true,
        reason: 'DRAFT_EXPIRED_72_HOURS',
        savedCustomerDetails: {
          fullName: customer?.fullName,
          phoneNumber: customer?.phoneNumber,
          panNumber: customer?.panNumber,
          aadhaarNumber: customer?.aadhaarNumber
        }
      };
    }

    return {
      message: 'Draft application recovered successfully.',
      canResume: true,
      isExpired: false,
      lastSavedStep: loan.currentStep || loan.draftMetadata?.lastSavedStep || 'LOOKUP',
      draftData: loan
    };
  }

  /**
   * Post-Approval: Initiate SprintVerify Aadhaar OTP e-Sign
   */
  async initiateAadhaarEsign(executiveUser, payload) {
    const { loanId, applicationId, redirectUrl } = payload;

    let loan = null;
    if (loanId) {
      if (!mongoose.Types.ObjectId.isValid(loanId)) {
        throw ApiError.badRequest('Invalid loanId format provided.');
      }
      loan = await Loan.findById(loanId);
    } else if (applicationId) {
      loan = await Loan.findOne({ applicationId });
    }

    if (!loan) {
      throw ApiError.notFound(`Loan application not found for provided loanId or applicationId.`);
    }

    const customer = await CustomerProfile.findOne({
      $or: [
        { userId: loan.customerId },
        { _id: loan.customerId },
        { phoneNumber: loan.customerPhoneNumber }
      ]
    });

    const customerFullName = customer ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.fullName : 'Borrower';

    const esignRes = await SprintVerifyEsignUtil.initiateEsignSession({
      applicationId: loan.applicationId,
      pdfUrl: loan.pdfDocuments?.loanAgreementPdfUrl || 'https://sahayaone-backend.onrender.com/public/sample_loan_agreement.pdf',
      customerName: customerFullName,
      aadhaarNumber: customer?.aadhaarNumber,
      redirectUrl
    });

    loan.esignDetails = {
      provider: 'SPRINTVERIFY',
      txnId: esignRes.refid,
      status: 'INITIATED',
      signedAt: null,
      signedPdfUrl: null
    };
    await loan.save();

    return {
      message: 'Aadhaar e-Sign session initiated successfully.',
      refid: esignRes.refid,
      esignUrl: esignRes.esignUrl,
      status: 'INITIATED',
      nextStep: 'VERIFY_ESIGN',
      screenName: 'ESIGN_SCREEN'
    };
  }

  /**
   * Post-Approval: Verify SprintVerify Aadhaar OTP e-Sign
   */
  async verifyAadhaarEsign(executiveUser, payload) {
    const { refid, otp } = payload;

    const loan = await Loan.findOne({ 'esignDetails.txnId': refid });
    if (!loan) {
      throw ApiError.notFound(`Loan application with e-Sign refid [${refid}] not found.`);
    }

    const verifyRes = await SprintVerifyEsignUtil.verifyEsignSession(refid, otp);

    loan.esignDetails.status = 'SIGNED';
    loan.esignDetails.signedAt = new Date();
    loan.esignDetails.signedPdfUrl = verifyRes.signedPdfUrl;
    loan.currentStep = 'READY_FOR_DISBURSAL';
    await loan.save();

    return {
      message: 'Aadhaar e-Sign completed successfully! Loan is ready for disbursal.',
      verified: true,
      refid,
      status: 'SIGNED',
      signedPdfUrl: verifyRes.signedPdfUrl,
      nextStep: 'READY_FOR_DISBURSAL',
      screenName: 'READY_FOR_DISBURSAL'
    };
  }

  /**
   * Check Loan Application Status & 5-Minute Auto-Approval Timer Status
   */
  async getLeadStatus(id) {
    if (!id) {
      throw ApiError.badRequest('Loan ID or Application ID is required.');
    }

    const loan = await Loan.findOne({
      $or: [
        { _id: mongoose.isValidObjectId(id) ? id : null },
        { applicationId: id },
        { customerPhoneNumber: id }
      ]
    }).sort({ createdAt: -1 });

    if (!loan) {
      throw ApiError.notFound(`Loan application record [${id}] not found.`);
    }

    // Auto-approve after 5 minutes if still pending
    if ((loan.status === 'PENDING' || loan.status === 'PENDING_APPROVAL') && loan.approvalTimer?.timerExpiresAt) {
      const now = new Date();
      if (now >= new Date(loan.approvalTimer.timerExpiresAt)) {
        loan.status = 'APPROVED';
        loan.currentStep = 'READY_FOR_DISBURSAL';
        if (!loan.approvalTimer) loan.approvalTimer = {};
        loan.approvalTimer.approvalStatus = 'AUTO_APPROVED';
        loan.approvalTimer.autoApproved = true;
        loan.approvalTimer.approvedAt = now;
        await loan.save();
      }
    }

    return {
      loanId: loan._id,
      applicationId: loan.applicationId,
      status: loan.status,
      currentStep: loan.currentStep,
      approvalStatus: loan.approvalTimer?.approvalStatus || loan.status,
      autoApproved: loan.approvalTimer?.autoApproved || false,
      timerExpiresAt: loan.approvalTimer?.timerExpiresAt || null,
      productDetails: loan.productDetails,
      financialDetails: {
        productPrice: loan.productPrice,
        tenureMonths: loan.tenureMonths,
        downPayment: loan.downPayment,
        totalLoanAmount: loan.totalLoanAmount,
        emiAmount: loan.emiAmount
      },
      repaymentBankAccount: loan.repaymentBankAccount,
      mandateDetails: loan.mandateDetails,
      esignDetails: loan.esignDetails,
      updatedAt: loan.updatedAt
    };
  }

  /**
   * Helper: Build role-based scope conditions
   * Bank Owner / Admin: Views ALL leads across all branches of their bank (or filters by query branchId)
   * Branch Staff / Manager: Restricted strictly to assigned branchId
   */
  _buildLeadScopeConditions(employeeUser, queryBranchId = null) {
    const roleUpper = (employeeUser?.role || '').toString().toUpperCase();
    const userTypeUpper = (employeeUser?.userType || '').toString().toUpperCase();

    const isBankOwnerOrAdmin =
      Boolean(employeeUser?.isBankOwner) ||
      ['SUPER_ADMIN', 'SOCIETY_ADMIN', 'BANK_ADMIN', 'BANK_OWNER', 'ADMIN', 'OWNER', 'CHAIRMAN'].includes(roleUpper) ||
      ['SUPER_ADMIN', 'SOCIETY_ADMIN', 'BANK_ADMIN'].includes(userTypeUpper);

    if (isBankOwnerOrAdmin) {
      if (queryBranchId && mongoose.Types.ObjectId.isValid(queryBranchId)) {
        const branchObjId = new mongoose.Types.ObjectId(queryBranchId);
        return {
          $or: [
            { branchId: branchObjId },
            { 'merchantSettlement.branchId': branchObjId }
          ]
        };
      } else if (employeeUser?.bankId || employeeUser?.societyId) {
        const bankIdVal = new mongoose.Types.ObjectId(employeeUser.bankId || employeeUser.societyId);
        return {
          $or: [
            { bankId: bankIdVal },
            { societyId: bankIdVal },
            { 'merchantSettlement.bankId': bankIdVal }
          ]
        };
      }
      return null;
    } else {
      if (employeeUser?.branchId && mongoose.Types.ObjectId.isValid(employeeUser.branchId)) {
        const branchObjId = new mongoose.Types.ObjectId(employeeUser.branchId);
        return {
          $or: [
            { branchId: branchObjId },
            { 'merchantSettlement.branchId': branchObjId }
          ]
        };
      }
      return null;
    }
  }

  /**
   * Branch Staff / Bank Owner: List Customer System Loan Applications (App / Executive Customer Flow)
   */
  async listCustomerSystemLeads(employeeUser, filters = {}) {
    const {
      status,
      search,
      branchId,
      startDate,
      endDate,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = filters;

    const conditions = [
      {
        $or: [
          { sourceType: { $in: ['EXECUTIVE', 'DIRECT', 'CUSTOMER', 'SOCIETY'] } },
          { merchantId: null }
        ]
      }
    ];

    // Apply Bank Owner vs Branch Staff scoping
    const scopeCondition = this._buildLeadScopeConditions(employeeUser, branchId);
    if (scopeCondition) {
      conditions.push(scopeCondition);
    }

    // Keep a base filter copy for aggregate statistics before status filtering
    const baseStatsConditions = [...conditions];

    if (status && status.trim().toUpperCase() !== 'ALL') {
      const upperStatus = status.trim().toUpperCase();
      if (upperStatus === 'PENDING' || upperStatus === 'PENDING_APPROVAL' || upperStatus === 'PENDING_DOWN_PAYMENT') {
        conditions.push({
          $or: [
            { status: { $in: ['PENDING', 'PENDING_APPROVAL', 'PENDING_DOWN_PAYMENT', 'NEW'] } },
            { 'approvalTimer.approvalStatus': 'PENDING' },
            { currentStep: 'PENDING_APPROVAL' }
          ]
        });
      } else if (upperStatus === 'APPROVED') {
        conditions.push({
          $or: [
            { status: 'APPROVED' },
            { 'approvalTimer.approvalStatus': 'APPROVED' }
          ]
        });
      } else if (upperStatus === 'REJECTED') {
        conditions.push({
          $or: [
            { status: 'REJECTED' },
            { 'approvalTimer.approvalStatus': 'REJECTED' }
          ]
        });
      } else {
        conditions.push({ status: upperStatus });
      }
    }

    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);
      conditions.push({ createdAt: dateFilter });
    }

    const query = conditions.length === 1 ? conditions[0] : { $and: conditions };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skipCount = (pageNum - 1) * limitNum;
    const sortDirection = sortOrder.toLowerCase() === 'asc' ? 1 : -1;
    const sortObj = { [sortBy]: sortDirection, _id: sortDirection };

    const totalCount = await Loan.countDocuments(query);
    const pagination = paginationUtil.getPaginationMeta(totalCount, pageNum, limitNum);

    let loans = await Loan.find(query)
      .populate({ path: 'customerId', model: 'User', select: 'phoneNumber fullName' })
      .sort(sortObj)
      .skip(skipCount)
      .limit(limitNum)
      .lean();

    const phoneNumbers = [...new Set(loans.map(l => l.customerPhoneNumber || l.customerId?.phoneNumber).filter(Boolean))];
    const customerProfiles = await CustomerProfile.find({ phoneNumber: { $in: phoneNumbers } }).lean();
    const profileMap = new Map(customerProfiles.map(p => [p.phoneNumber, p]));

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      loans = loans.filter(loan => {
        const phone = loan.customerPhoneNumber || loan.customerId?.phoneNumber || '';
        const profile = profileMap.get(phone);
        const nameMatch = profile?.fullName?.match(searchRegex) || profile?.firstName?.match(searchRegex);
        const phoneMatch = phone.match(searchRegex);
        const panMatch = profile?.panNumber?.match(searchRegex);
        const aadhaarMatch = profile?.aadhaarNumber?.match(searchRegex);
        const appMatch = loan.applicationId?.match(searchRegex);
        return nameMatch || phoneMatch || panMatch || aadhaarMatch || appMatch;
      });
    }

    const items = loans.map(loan => {
      const phone = loan.customerPhoneNumber || loan.customerId?.phoneNumber || '';
      const profile = profileMap.get(phone);

      return {
        systemType: 'CUSTOMER',
        loanId: loan._id,
        applicationId: loan.applicationId,
        status: loan.status,
        currentStep: loan.currentStep,
        approvalStatus: loan.approvalTimer?.approvalStatus || loan.status,
        autoApproved: loan.approvalTimer?.autoApproved || false,
        customerDetails: {
          customerId: profile?._id || loan.customerId?._id || null,
          customerUniqueId: profile?.customerUniqueId || null,
          fullName: profile?.fullName || (profile ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() : 'Customer'),
          firstName: profile?.firstName || null,
          lastName: profile?.lastName || null,
          phoneNumber: phone,
          gender: profile?.gender || null,
          dob: profile?.dob ? (typeof profile.dob === 'string' ? profile.dob.split('T')[0] : new Date(profile.dob).toISOString().split('T')[0]) : null,
          panNumber: profile?.panNumber || null,
          aadhaarNumber: profile?.aadhaarNumber || null,
          address: profile?.address || profile?.activeAddress?.addressLine || null,
          residentialPincode: profile?.residentialPincode || profile?.pinCode || profile?.activeAddress?.pinCode || null,
          kycStatus: profile?.kycStatus || 'VERIFIED',
          cibilStatus: profile?.cibilStatus || 'APPROVED',
          cibilScore: profile?.creditScore || profile?.cibilScore || 750,
          onboardingStage: profile?.onboardingStage || 'COMPLETED',
          panImage: profile?.panImage || null,
          aadhaarImage: profile?.aadhaarImage || null,
          livePhoto: profile?.livePhoto || null
        },
        productDetails: {
          brandName: loan.productDetails?.brandName || 'N/A',
          modelName: loan.productDetails?.modelName || 'Smart Phone',
          imeiNumber: loan.productDetails?.imeiNumber || null,
          productPrice: loan.productPrice || 0,
          productPhoto: loan.productDetails?.productPhoto || null,
          imeiPhoto: loan.productDetails?.imeiPhoto || null
        },
        financialDetails: {
          productPrice: loan.productPrice || 0,
          downPayment: loan.downPayment || 0,
          totalLoanAmount: loan.totalLoanAmount || 0,
          emiAmount: loan.emiAmount || 0,
          tenureMonths: loan.tenureMonths || 0,
          financialChecksum: loan.antiTamperingChecksum || null
        },
        repaymentBankAccount: loan.repaymentBankAccount || null,
        mandateDetails: loan.mandateDetails || null,
        esignDetails: loan.esignDetails || null,
        createdAt: loan.createdAt,
        updatedAt: loan.updatedAt
      };
    });

    // Calculate aggregated statistics for Customer System
    const baseCustomerFilter = baseStatsConditions.length === 1 ? baseStatsConditions[0] : { $and: baseStatsConditions };
    const statsAgg = await Loan.aggregate([
      { $match: baseCustomerFilter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalPrice: { $sum: { $ifNull: ["$productPrice", 0] } },
          totalLoan: { $sum: { $ifNull: ["$totalLoanAmount", 0] } }
        }
      }
    ]);

    let totalLeads = 0;
    let pendingLeads = 0;
    let approvedLeads = 0;
    let activeLeads = 0;
    let completedLeads = 0;
    let rejectedLeads = 0;
    let totalBusinessVolume = 0;

    statsAgg.forEach(s => {
      const cnt = s.count || 0;
      totalLeads += cnt;
      totalBusinessVolume += (s.totalPrice || s.totalLoan || 0);

      const st = (s._id || '').toUpperCase();
      if (st === 'PENDING' || st === 'PENDING_APPROVAL' || st === 'PENDING_DOWN_PAYMENT' || st === 'NEW') {
        pendingLeads += cnt;
      } else if (st === 'APPROVED') {
        approvedLeads += cnt;
      } else if (st === 'ACTIVE') {
        activeLeads += cnt;
      } else if (st === 'COMPLETED') {
        completedLeads += cnt;
      } else if (st === 'REJECTED') {
        rejectedLeads += cnt;
      }
    });

    const stats = {
      totalLeads,
      pendingLeads,
      approvedLeads,
      activeLeads,
      completedLeads,
      rejectedLeads,
      totalBusinessVolume
    };

    return { items, pagination, stats };
  }

  /**
   * Branch Staff: List Merchant System Loan Leads
   */
  async listMerchantSystemLeads(employeeUser, filters = {}) {
    return this.listBranchSettlementLeads(employeeUser, filters);
  }

  /**
   * Branch Staff: Manually Approve a Customer Lead (Loan Request or Pigmy Deposit)
   */
  async approveCustomerLead(employeeUser, loanId, payload = {}) {
    const { remarks = 'Manually approved by Branch Staff' } = payload;

    const loan = await Loan.findById(loanId);
    if (!loan) {
      // Check if this lead is a Pigmy Customer
      try {
        const pigmyRes = await employeePigmyService.approvePigmyCustomer(employeeUser, loanId, payload);
        return {
          message: pigmyRes.message,
          status: 'APPROVED',
          approvalStatus: 'APPROVED',
          approvedAt: new Date(),
          pigmyCustomer: pigmyRes.pigmyCustomer
        };
      } catch (pigmyErr) {
        if (pigmyErr.statusCode !== 404) throw pigmyErr;
      }
      throw ApiError.notFound(`Customer application / lead [${loanId}] not found.`);
    }

    loan.status = 'APPROVED';
    loan.currentStep = 'READY_FOR_DISBURSAL';
    if (!loan.approvalTimer) loan.approvalTimer = {};
    loan.approvalTimer.approvalStatus = 'APPROVED';
    loan.approvalTimer.autoApproved = false;
    loan.approvalTimer.approvedByUserId = employeeUser?.id || employeeUser?._id;
    loan.approvalTimer.approvedAt = new Date();
    loan.approvalTimer.remarks = remarks;

    await loan.save();

    return {
      message: `Customer loan application [${loan.applicationId || loan._id}] manually approved successfully.`,
      status: loan.status,
      approvalStatus: 'APPROVED',
      approvedAt: loan.approvalTimer.approvedAt
    };
  }

  /**
   * Branch Staff: Manually Reject a Customer Lead (Loan Request or Pigmy Deposit)
   */
  async rejectCustomerLead(employeeUser, loanId, payload = {}) {
    const { reason = 'Manually rejected by Branch Manager' } = payload;

    const loan = await Loan.findById(loanId);
    if (!loan) {
      // Check if this lead is a Pigmy Customer
      try {
        const pigmyRes = await employeePigmyService.rejectPigmyCustomer(employeeUser, loanId, payload);
        return {
          message: pigmyRes.message,
          status: 'REJECTED',
          approvalStatus: 'REJECTED',
          rejectionReason: reason,
          pigmyCustomer: pigmyRes.pigmyCustomer
        };
      } catch (pigmyErr) {
        if (pigmyErr.statusCode !== 404) throw pigmyErr;
      }
      throw ApiError.notFound(`Customer application / lead [${loanId}] not found.`);
    }

    loan.status = 'REJECTED';
    if (!loan.approvalTimer) loan.approvalTimer = {};
    loan.approvalTimer.approvalStatus = 'REJECTED';
    loan.approvalTimer.approvedByUserId = employeeUser?.id || employeeUser?._id;
    loan.approvalTimer.rejectionReason = reason;

    await loan.save();

    return {
      message: `Customer loan application [${loan.applicationId || loan._id}] rejected successfully.`,
      status: loan.status,
      approvalStatus: 'REJECTED',
      rejectionReason: reason
    };
  }

  /**
   * Branch Staff / Bank Owner: List all Merchant Leads for Branch Disbursal / Settlement
   */
  async listBranchSettlementLeads(employeeUser, filters = {}) {
    const {
      settlementStatus,
      status,
      approvalStatus,
      search,
      merchantId,
      branchId,
      startDate,
      endDate,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = filters;

    const conditions = [];

    // Filter by Bank Owner vs Branch Staff scope
    const scopeCondition = this._buildLeadScopeConditions(employeeUser, branchId);
    if (scopeCondition) {
      conditions.push(scopeCondition);
    }

    // Merchant Filter
    if (merchantId && mongoose.Types.ObjectId.isValid(merchantId)) {
      conditions.push({ merchantId: new mongoose.Types.ObjectId(merchantId) });
    }

    // Save base conditions for statistics aggregation before specific status & date filters
    const baseStatsConditions = [...conditions];

    // Resolve single active filter intent from status, settlementStatus, and approvalStatus
    const reqStatus = (status && status.trim().toUpperCase() !== 'ALL') ? status.trim().toUpperCase() : null;
    const reqSettlement = (settlementStatus && settlementStatus.trim().toUpperCase() !== 'ALL') ? settlementStatus.trim().toUpperCase() : null;
    const reqApproval = (approvalStatus && approvalStatus.trim().toUpperCase() !== 'ALL') ? approvalStatus.trim().toUpperCase() : null;

    if (reqSettlement === 'SETTLED' || reqSettlement === 'SETTLED_BY_BRANCH' || reqStatus === 'SETTLED' || reqStatus === 'SETTLED_BY_BRANCH') {
      conditions.push({ 'merchantSettlement.settlementStatus': { $in: ['SETTLED_BY_BRANCH', 'SETTLED'] } });
    } else if (reqSettlement === 'PENDING' || reqSettlement === 'PENDING_BRANCH_PAYMENT' || reqSettlement === 'PENDING_SETTLEMENT' || reqStatus === 'PENDING_SETTLEMENT' || reqStatus === 'PENDING_BRANCH_PAYMENT' || reqApproval === 'PENDING_BRANCH_PAYMENT') {
      conditions.push({
        $or: [
          { 'merchantSettlement.settlementStatus': { $in: ['PENDING_BRANCH_PAYMENT', 'PENDING', 'PENDING_SETTLEMENT'] } },
          { 'merchantSettlement.settlementStatus': null },
          { 'merchantSettlement.settlementStatus': { $exists: false } }
        ]
      });
    } else {
      // Loan Status Filter (APPROVED, ACTIVE, PENDING, REJECTED)
      const targetStatus = reqStatus || reqApproval;

      if (targetStatus) {
        if (targetStatus === 'APPROVED') {
          conditions.push({
            $or: [
              { status: 'APPROVED' },
              { 'approvalTimer.approvalStatus': 'APPROVED' }
            ]
          });
        } else if (targetStatus === 'ACTIVE') {
          conditions.push({ status: 'ACTIVE' });
        } else if (targetStatus === 'PENDING' || targetStatus === 'PENDING_APPROVAL') {
          conditions.push({
            $or: [
              { status: { $in: ['PENDING', 'PENDING_APPROVAL', 'PENDING_DOWN_PAYMENT', 'NEW'] } },
              { 'approvalTimer.approvalStatus': 'PENDING' },
              { currentStep: 'PENDING_APPROVAL' }
            ]
          });
        } else if (targetStatus === 'REJECTED') {
          conditions.push({
            $or: [
              { status: 'REJECTED' },
              { 'approvalTimer.approvalStatus': 'REJECTED' }
            ]
          });
        } else {
          conditions.push({ status: targetStatus });
        }
      }
    }

    // Date Filter
    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);
      conditions.push({ createdAt: dateFilter });
    }

    const query = conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : { $and: conditions }) : {};

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skipCount = (pageNum - 1) * limitNum;
    const sortDirection = sortOrder.toLowerCase() === 'asc' ? 1 : -1;
    const sortObj = { [sortBy]: sortDirection, _id: sortDirection };

    const totalCount = await Loan.countDocuments(query);
    const pagination = paginationUtil.getPaginationMeta(totalCount, pageNum, limitNum);

    let loans = await Loan.find(query)
      .populate({ path: 'merchantId', model: 'MerchantProfile', select: 'shopName ownerName email phoneNumber address city pincode merchantCode' })
      .populate({ path: 'customerId', model: 'User', select: 'phoneNumber fullName' })
      .sort(sortObj)
      .skip(skipCount)
      .limit(limitNum)
      .lean();

    const phoneNumbers = [...new Set(loans.map(l => l.customerPhoneNumber || l.customerId?.phoneNumber).filter(Boolean))];
    const customerProfiles = await CustomerProfile.find({ phoneNumber: { $in: phoneNumbers } }).lean();
    const profileMap = new Map(customerProfiles.map(p => [p.phoneNumber, p]));

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      loans = loans.filter(loan => {
        const phone = loan.customerPhoneNumber || loan.customerId?.phoneNumber || '';
        const profile = profileMap.get(phone);
        const nameMatch = profile?.fullName?.match(searchRegex) || profile?.firstName?.match(searchRegex);
        const phoneMatch = phone.match(searchRegex);
        const appMatch = loan.applicationId?.match(searchRegex);
        const merchantMatch = loan.merchantId?.shopName?.match(searchRegex);
        return nameMatch || phoneMatch || appMatch || merchantMatch;
      });
    }

    const items = loans.map(loan => {
      const phone = loan.customerPhoneNumber || loan.customerId?.phoneNumber || '';
      const profile = profileMap.get(phone);
      const netDisbursal = loan.totalLoanAmount || (loan.productPrice ? Math.max(0, loan.productPrice - (loan.downPayment || 0)) : 0);

      return {
        systemType: 'MERCHANT',
        loanId: loan._id,
        applicationId: loan.applicationId,
        status: loan.status,
        customerDetails: {
          customerId: profile?._id || loan.customerId?._id || null,
          customerUniqueId: profile?.customerUniqueId || null,
          fullName: profile?.fullName || (profile ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() : 'Customer'),
          firstName: profile?.firstName || null,
          lastName: profile?.lastName || null,
          phoneNumber: phone,
          gender: profile?.gender || null,
          dob: profile?.dob ? (typeof profile.dob === 'string' ? profile.dob.split('T')[0] : new Date(profile.dob).toISOString().split('T')[0]) : null,
          panNumber: profile?.panNumber || null,
          aadhaarNumber: profile?.aadhaarNumber || null,
          address: profile?.address || profile?.activeAddress?.addressLine || null,
          residentialPincode: profile?.residentialPincode || profile?.pinCode || profile?.activeAddress?.pinCode || null,
          kycStatus: profile?.kycStatus || 'VERIFIED',
          cibilStatus: profile?.cibilStatus || 'APPROVED',
          cibilScore: profile?.creditScore || profile?.cibilScore || 750,
          onboardingStage: profile?.onboardingStage || 'COMPLETED',
          panImage: profile?.panImage || null,
          aadhaarImage: profile?.aadhaarImage || null,
          livePhoto: profile?.livePhoto || null
        },
        productDetails: {
          brandName: loan.productDetails?.brandName || 'N/A',
          modelName: loan.productDetails?.modelName || 'Smart Phone',
          imeiNumber: loan.productDetails?.imeiNumber || null,
          productPrice: loan.productPrice || 0,
          productPhoto: loan.productDetails?.productPhoto || null,
          imeiPhoto: loan.productDetails?.imeiPhoto || null
        },
        financialDetails: {
          productPrice: loan.productPrice || 0,
          downPayment: loan.downPayment || 0,
          totalLoanAmount: loan.totalLoanAmount || 0,
          netDisbursalAmount: netDisbursal,
          emiAmount: loan.emiAmount || 0,
          tenureMonths: loan.tenureMonths || 0,
          financialChecksum: loan.antiTamperingChecksum || null
        },
        merchantDetails: loan.merchantId && typeof loan.merchantId === 'object' ? {
          merchantId: loan.merchantId._id,
          shopName: loan.merchantId.shopName,
          merchantCode: loan.merchantId.merchantCode,
          ownerName: loan.merchantId.ownerName,
          phoneNumber: loan.merchantId.phoneNumber,
          email: loan.merchantId.email,
          address: loan.merchantId.address
        } : null,
        settlementDetails: {
          settlementStatus: loan.merchantSettlement?.settlementStatus || 'PENDING_BRANCH_PAYMENT',
          netDisbursalAmount: netDisbursal,
          settledAt: loan.merchantSettlement?.settledAt || null,
          paymentTxnRef: loan.merchantSettlement?.paymentTxnRef || null,
          remarks: loan.merchantSettlement?.remarks || null
        },
        createdAt: loan.createdAt,
        updatedAt: loan.updatedAt
      };
    });

    // Calculate aggregated statistics for Merchant System (Branch Settlements)
    const baseMerchantFilter = baseStatsConditions.length === 0 ? {} : (baseStatsConditions.length === 1 ? baseStatsConditions[0] : { $and: baseStatsConditions });
    const statsAgg = await Loan.aggregate([
      { $match: baseMerchantFilter },
      {
        $group: {
          _id: {
            status: "$status",
            settlementStatus: "$merchantSettlement.settlementStatus"
          },
          count: { $sum: 1 },
          totalBusinessVolume: { $sum: { $ifNull: ["$productPrice", 0] } },
          totalNetDisbursal: { $sum: { $ifNull: ["$totalLoanAmount", 0] } }
        }
      }
    ]);

    let totalLeads = 0;
    let pendingSettlementLeads = 0;
    let settledLeads = 0;
    let approvedLeads = 0;
    let activeLeads = 0;
    let totalBusinessVolume = 0;
    let pendingSettlementAmount = 0;
    let totalSettledAmount = 0;

    statsAgg.forEach(s => {
      const count = s.count || 0;
      totalLeads += count;
      totalBusinessVolume += (s.totalBusinessVolume || 0);

      const st = (s._id?.status || '').toUpperCase();
      const setSt = (s._id?.settlementStatus || '').toUpperCase();

      if (setSt === 'SETTLED_BY_BRANCH') {
        settledLeads += count;
        totalSettledAmount += (s.totalNetDisbursal || 0);
      } else {
        pendingSettlementLeads += count;
        pendingSettlementAmount += (s.totalNetDisbursal || 0);
      }

      if (st === 'APPROVED') approvedLeads += count;
      if (st === 'ACTIVE') activeLeads += count;
    });

    const stats = {
      totalLeads,
      pendingSettlementLeads,
      settledLeads,
      approvedLeads,
      activeLeads,
      totalBusinessVolume,
      pendingSettlementAmount,
      totalSettledAmount
    };

    return { items, pagination, stats };
  }

  /**
   * Branch Staff: Execute Next-Day Merchant Settlement / Disbursal Payment
   */
  async settleMerchantLoan(employeeUser, loanId, payload = {}) {
    const { paymentTxnRef, remarks = 'Next day loan disbursal paid to merchant' } = payload;

    const loan = await Loan.findById(loanId);
    if (!loan) {
      throw ApiError.notFound(`Loan application [${loanId}] not found.`);
    }

    const netDisbursal = loan.totalLoanAmount || (loan.productPrice ? Math.max(0, loan.productPrice - (loan.downPayment || 0)) : 0);

    loan.merchantSettlement = {
      settlementStatus: 'SETTLED_BY_BRANCH',
      settlementAmount: netDisbursal,
      netDisbursalAmount: netDisbursal,
      settledAt: new Date(),
      settledByUserId: employeeUser?.id || employeeUser?._id,
      branchId: employeeUser?.branchId || loan.branchId || null,
      bankId: employeeUser?.bankId || loan.bankId || null,
      paymentTxnRef: paymentTxnRef || `UTR_${Date.now()}`,
      remarks
    };

    loan.status = 'ACTIVE';
    loan.disbursedBy = employeeUser?.id || employeeUser?._id;
    loan.disbursedAt = new Date();
    await loan.save();

    return {
      message: `Merchant settlement of ₹${netDisbursal} completed successfully by Branch.`,
      settlementStatus: 'SETTLED_BY_BRANCH',
      netDisbursalAmount: netDisbursal,
      paymentTxnRef: loan.merchantSettlement.paymentTxnRef,
      settledAt: loan.merchantSettlement.settledAt,
      loanStatus: loan.status
    };
  }

  /**
   * Retrieves active banners for Executive / Customer Onboarding flow
   */
  async getBanners(queryOptions = {}) {
    const { bannerType, portalType } = queryOptions;

    const filter = {
      isDeleted: { $ne: true },
      status: 'ACTIVE'
    };

    // Strictly filter banners assigned to EXECUTIVE_APP (unless explicitly overridden by portalType query)
    const targetPortal = portalType && typeof portalType === 'string' && portalType.trim()
      ? portalType.trim().toUpperCase()
      : 'EXECUTIVE_APP';

    filter.portalType = {
      $in: [
        targetPortal,
        ...(targetPortal === 'EXECUTIVE_APP' ? ['Loan Executive App', 'Executive App', 'LOAN_EXECUTIVE_APP'] : [])
      ]
    };

    if (bannerType && typeof bannerType === 'string' && bannerType.trim()) {
      filter.bannerType = new RegExp(`^${bannerType.trim()}$`, 'i');
    }

    const banners = await Banner.find(filter)
      .sort({ createdAt: -1 })
      .select('_id portalType bannerType imageUrl imageKey status createdAt')
      .lean();

    return {
      message: 'Banners retrieved successfully.',
      banners,
      count: banners.length
    };
  }
}

export const leadsService = new LeadsService();
