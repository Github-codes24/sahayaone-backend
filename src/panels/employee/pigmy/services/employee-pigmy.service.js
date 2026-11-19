import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../../../../models/user.model.js';
import { PigmyCustomer } from '../../../../models/pigmy-customer.model.js';
import { Branch } from '../../../../models/branch.model.js';
import { Bank } from '../../../../models/bank.model.js';
import { BankAccount } from '../../../../models/bank-account.model.js';
import { CustomerProfile } from '../../../../models/customer-profile.model.js';
import { SocietyCustomerLink } from '../../../../models/society-customer-link.model.js';
import { SocietyEmployee } from '../../../../models/society-employee.model.js';
import { BranchManager } from '../../../../models/branch-manager.model.js';
import { EmployeeProfile } from '../../../../models/employee-profile.model.js';
import { OnboardingTeam } from '../../../../models/onboarding-team.model.js';
import Scheme from '../../../../sip/models/scheme.js';
import { UserRole, UserType } from '../../../../constants/user-role.constant.js';
import { storageManager } from '../../../../storage/storage.manager.js';
import { OnboardingEngineService } from '../../onboarding/services/onboarding-engine.service.js';
import { ApiError } from '../../../../common/api.error.js';
import { logger } from '../../../../utils/logger.util.js';
import { resolveExistingCustomerKyc } from '../../../../utils/customer-kyc-resolver.util.js';

export class EmployeePigmyService {
  /**
   * Process uploaded files or return URL
   */
  async processFileUpload(fileArray, folder = 'pigmy-customers') {
    if (!fileArray || fileArray.length === 0) return { url: null, key: null };
    const file = fileArray[0];
    const uploadResult = await storageManager.uploadFile(file, folder);
    return {
      url: uploadResult?.fileUrl || uploadResult?.url || null,
      key: uploadResult?.key || uploadResult?.filePath || null
    };
  }

  /**
   * Resolve Bank and Branch IDs from Executive User, Assigned Profile, or System
   */
  async resolveExecutiveContext(executiveUser, explicitBankId = null, explicitBranchId = null) {
    const execUserId = (executiveUser?.id || executiveUser?._id || executiveUser?.userId || '').toString();
    const execUserDoc = execUserId && mongoose.Types.ObjectId.isValid(execUserId) ? await User.findById(execUserId).lean() : null;

    let resolvedBranchId = explicitBranchId || executiveUser?.branchId || execUserDoc?.branchId || null;
    let resolvedBankId = explicitBankId || executiveUser?.bankId || executiveUser?.societyId || execUserDoc?.bankId || null;

    if (execUserId && (!resolvedBankId || !resolvedBranchId)) {
      const societyEmployee = await SocietyEmployee.findOne({ userId: execUserId, isDeleted: { $ne: true } }).lean();
      if (societyEmployee) {
        if (!resolvedBranchId && societyEmployee.branchId) resolvedBranchId = societyEmployee.branchId;
        if (!resolvedBankId && societyEmployee.bankId) resolvedBankId = societyEmployee.bankId;
      }
    }

    if (execUserId && (!resolvedBankId || !resolvedBranchId)) {
      const branchManager = await BranchManager.findOne({ userId: execUserId, isDeleted: { $ne: true } }).lean();
      if (branchManager) {
        if (!resolvedBranchId && branchManager.branchId) resolvedBranchId = branchManager.branchId;
        if (!resolvedBankId && branchManager.bankId) resolvedBankId = branchManager.bankId;
      }
    }

    if (execUserId && (!resolvedBankId || !resolvedBranchId)) {
      const onboardingTeam = await OnboardingTeam.findOne({ userId: execUserId, isDeleted: { $ne: true } }).lean();
      if (onboardingTeam) {
        if (!resolvedBranchId && onboardingTeam.branchId) resolvedBranchId = onboardingTeam.branchId;
        if (!resolvedBankId && onboardingTeam.bankId) resolvedBankId = onboardingTeam.bankId;
      }
    }

    if (execUserId && (!resolvedBankId || !resolvedBranchId)) {
      const employeeProfile = await EmployeeProfile.findOne({ userId: execUserId, isDeleted: { $ne: true } }).lean();
      if (employeeProfile) {
        if (!resolvedBranchId && employeeProfile.branchId) resolvedBranchId = employeeProfile.branchId;
        if (!resolvedBankId && employeeProfile.bankId) resolvedBankId = employeeProfile.bankId;
      }
    }

    // Direct Bank Head / Owner lookup
    if (execUserId && !resolvedBankId) {
      const bank = await Bank.findOne({
        $or: [{ userId: execUserId }, { email: execUserDoc?.email?.toLowerCase() }],
        isDeleted: { $ne: true }
      }).lean();
      if (bank) resolvedBankId = bank._id;
    }

    const roleUpper = String(executiveUser?.role || execUserDoc?.role || '').toUpperCase();
    const isBankOwnerOrHead = ['BANK_OWNER', 'BANK_ADMIN', 'SOCIETY_ADMIN', 'SUPER_ADMIN', 'OWNER', 'CHAIRMAN', 'ADMIN', 'BANK_HEAD', 'HEAD', 'AUTHORIZED_PERSON', 'BANK_AUTHORIZED_PERSON'].includes(roleUpper) || roleUpper.includes('HEAD') || roleUpper.includes('OWNER') || roleUpper.includes('AUTHORIZED');

    if (isBankOwnerOrHead && explicitBranchId) {
      const targetBranch = await Branch.findOne({ _id: explicitBranchId, isDeleted: { $ne: true } }).lean();
      if (!targetBranch) {
        throw ApiError.badRequest('Selected bank branch is invalid or deactivated.');
      }
      if (resolvedBankId && targetBranch.bankId && targetBranch.bankId.toString() !== resolvedBankId.toString()) {
        throw ApiError.badRequest('Selected bank branch does not belong to your bank organization.');
      }
      resolvedBranchId = targetBranch._id;
    }

    if (resolvedBranchId && !resolvedBankId) {
      const branch = await Branch.findById(resolvedBranchId).lean();
      if (branch) resolvedBankId = branch.bankId;
    }

    if (resolvedBankId && !resolvedBranchId) {
      const activeBranches = await Branch.find({ bankId: resolvedBankId, isDeleted: { $ne: true } }).lean();
      if (activeBranches.length > 0) {
        resolvedBranchId = activeBranches[0]._id;
      }
    }

    return { bankId: resolvedBankId, branchId: resolvedBranchId };
  }

  /**
   * Get active SIP schemes available for the Executive's assigned bank
   */
  async getActiveSchemes(executiveUser, query = {}) {
    const { bankId: resolvedBankId } = await this.resolveExecutiveContext(
      executiveUser,
      query?.bankId,
      query?.branchId
    );

    const filter = { status: 'ACTIVE' };
    if (resolvedBankId) {
      filter.bankId = resolvedBankId;
    }

    const rawSchemes = await Scheme.find(filter).lean().sort({ createdAt: -1 });

    return rawSchemes.map((s) => ({
      id: s._id,
      schemeId: s._id,
      schemeCode: s.schemeCode,
      schemeName: s.schemeName,
      description: s.description || '',
      frequency: s.frequency || 'DAILY',
      durationPlans: (s.durationPlans || []).map((p) => ({
        durationMonths: p.durationMonths,
        interestRate: p.interestRate,
        tenureMonths: p.durationMonths
      })),
      allowedAmounts: s.allowedAmounts || [100, 200, 500, 1000],
      customAmountEnabled: Boolean(s.customAmountEnabled !== false),
      customAmountMin: s.customAmountMin || 10,
      customAmountMax: s.customAmountMax || null,
      status: s.status
    }));
  }

  /**
   * Format Pigmy Customer details including Mandate, Bank Account, Tenure, and Agreement PDFs
   */
  formatPigmyCustomerDetails(pigmyCustomer, societyLink = null, fallbackKyc = null) {
    if (!pigmyCustomer) return null;
    const branchObj = pigmyCustomer.branchId;
    const bankObj = pigmyCustomer.bankId;

    let branchName = pigmyCustomer.branchName || (branchObj && typeof branchObj === 'object' && branchObj.name) || 'N/A';
    let branchId = (branchObj && typeof branchObj === 'object' && (branchObj._id || branchObj.id)) || branchObj || null;

    let bankName = pigmyCustomer.bankName || (bankObj && typeof bankObj === 'object' && bankObj.name) || 'N/A';
    let bankId = (bankObj && typeof bankObj === 'object' && (bankObj._id || bankObj.id)) || bankObj || null;

    const isCreateNewSavings = pigmyCustomer.savingsAccountOption === 'CREATE_NEW' || pigmyCustomer.newSavingsAccountRequested;

    let formattedDob = null;
    if (pigmyCustomer.dob) {
      if (pigmyCustomer.dob instanceof Date) {
        formattedDob = pigmyCustomer.dob.toISOString().split('T')[0];
      } else {
        const d = new Date(pigmyCustomer.dob);
        formattedDob = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : String(pigmyCustomer.dob).trim();
      }
    }

    const resolvedAadhaarNum = pigmyCustomer.aadhaarNumber || pigmyCustomer.ownerAadharNumber || pigmyCustomer.ownerAadhaarNumber || fallbackKyc?.aadhaarNumber || null;
    const resolvedPanNum = pigmyCustomer.panNumber || pigmyCustomer.ownerPanNumber || fallbackKyc?.panNumber || null;

    const resolvedOwnerAadhaarUrl = pigmyCustomer.documents?.ownerAadhaar || pigmyCustomer.aadhaarImage || fallbackKyc?.ownerAadhaar || null;
    const resolvedOwnerPanUrl = pigmyCustomer.documents?.ownerPan || pigmyCustomer.panImage || fallbackKyc?.ownerPan || null;

    return {
      id: pigmyCustomer._id,
      pigmyCustomerId: pigmyCustomer._id,
      pigmyCustomerCode: pigmyCustomer.pigmyCustomerCode || pigmyCustomer.code,
      code: pigmyCustomer.pigmyCustomerCode || pigmyCustomer.code,
      accountNumber: pigmyCustomer.accountNumber,
      userId: pigmyCustomer.userId,
      bankId: bankId,
      bankName: bankName,
      branchId: branchId,
      branchName: branchName,
      customerType: pigmyCustomer.customerType || (pigmyCustomer.isMerchant ? 'MERCHANT' : 'INDIVIDUAL'),
      isMerchant: Boolean(pigmyCustomer.isMerchant || pigmyCustomer.customerType === 'MERCHANT'),
      fullName: pigmyCustomer.fullName,
      ownerName: pigmyCustomer.ownerName || pigmyCustomer.fullName,
      primaryPhoneNumber: pigmyCustomer.primaryPhoneNumber || pigmyCustomer.phoneNumber,
      phoneNumber: pigmyCustomer.primaryPhoneNumber || pigmyCustomer.phoneNumber,
      secondaryPhoneNumber: pigmyCustomer.secondaryPhoneNumber || null,
      email: pigmyCustomer.email || null,
      dob: formattedDob,
      gender: pigmyCustomer.gender || '',
      address: pigmyCustomer.address || pigmyCustomer.residenceAddress || '',
      residenceAddress: pigmyCustomer.residenceAddress || pigmyCustomer.address || '',
      aadhaarNumber: resolvedAadhaarNum,
      ownerAadharNumber: resolvedAadhaarNum,
      ownerAadhaarNumber: resolvedAadhaarNum,
      panNumber: resolvedPanNum,
      ownerPanNumber: resolvedPanNum,

      // Savings Account Option & New Bank Account Request
      savingsAccountOption: pigmyCustomer.savingsAccountOption || 'EXISTING',
      hasSavingsAccount: pigmyCustomer.hasSavingsAccount !== false,
      existingSavingsAccountNumber: pigmyCustomer.existingSavingsAccountNumber || null,
      newSavingsAccountRequested: isCreateNewSavings,

      // Internal Society Bank Account Details (Only present if officially linked via linkSocietyAccount)
      societyAccount: (pigmyCustomer.societyAccount?.societyAccountNumber || societyLink?.societyAccountNumber) ? {
        societyAccountNumber: pigmyCustomer.societyAccount?.societyAccountNumber || societyLink?.societyAccountNumber,
        ifscCode: pigmyCustomer.societyAccount?.ifscCode || societyLink?.ifscCode || '',
        accountHolderName: pigmyCustomer.societyAccount?.accountHolderName || societyLink?.accountHolderName || pigmyCustomer.fullName || '',
        bankBranchName: pigmyCustomer.societyAccount?.bankBranchName || societyLink?.bankBranchName || branchName || ''
      } : null,

      // Customer Bank Account Details for Auto-Debit
      bankAccountDetails: {
        accountHolderName: pigmyCustomer.bankAccountDetails?.accountHolderName || pigmyCustomer.fullName,
        accountNumber: pigmyCustomer.bankAccountDetails?.accountNumber || null,
        ifscCode: pigmyCustomer.bankAccountDetails?.ifscCode || null,
        bankName: pigmyCustomer.bankAccountDetails?.bankName || bankName,
        branchName: pigmyCustomer.bankAccountDetails?.branchName || branchName,
        accountType: pigmyCustomer.bankAccountDetails?.accountType || 'SAVINGS'
      },

      // Auto-Debit e-NACH Mandate Details
      mandateDetails: {
        mandateId: pigmyCustomer.mandateDetails?.mandateId || `MAND-${pigmyCustomer._id.toString().slice(-6).toUpperCase()}`,
        mandateStatus: pigmyCustomer.mandateDetails?.mandateStatus || 'PENDING_SETUP',
        autoDebitAmount: pigmyCustomer.mandateDetails?.autoDebitAmount || pigmyCustomer.dailyDepositAmount || 100,
        autoDebitFrequency: pigmyCustomer.mandateDetails?.autoDebitFrequency || pigmyCustomer.depositFrequency || 'DAILY',
        mandateStartDate: pigmyCustomer.mandateDetails?.mandateStartDate || pigmyCustomer.startDate || pigmyCustomer.createdAt,
        mandateEndDate: pigmyCustomer.mandateDetails?.mandateEndDate || pigmyCustomer.endDate || null
      },

      // SIP Scheme Linkage & Tenure (Safe snapshot: never breaks even if master scheme is deleted)
      scheme: (pigmyCustomer.schemeId || pigmyCustomer.schemeCode || pigmyCustomer.schemeName)
        ? {
            id: pigmyCustomer.schemeId?._id || pigmyCustomer.schemeId || null,
            code: pigmyCustomer.schemeCode || '',
            name: pigmyCustomer.schemeName || '',
            interestRate: pigmyCustomer.interestRate || 0,
            tenureMonths: pigmyCustomer.tenureMonths || 12,
            isCustomAmount: Boolean(pigmyCustomer.isCustomAmount),
            dailyDepositAmount: pigmyCustomer.dailyDepositAmount || 100,
            maturityAmount: pigmyCustomer.maturityAmount || 0
          }
        : null,
      schemeId: pigmyCustomer.schemeId?._id || pigmyCustomer.schemeId || null,
      schemeCode: pigmyCustomer.schemeCode || null,
      schemeName: pigmyCustomer.schemeName || null,
      interestRate: pigmyCustomer.interestRate || 0,
      isCustomAmount: Boolean(pigmyCustomer.isCustomAmount),
      maturityAmount: pigmyCustomer.maturityAmount || 0,
      tenureMonths: pigmyCustomer.tenureMonths || 12,
      dailyDepositAmount: pigmyCustomer.dailyDepositAmount || 100,
      depositFrequency: pigmyCustomer.depositFrequency || 'DAILY',
      startDate: pigmyCustomer.startDate || pigmyCustomer.createdAt,
      endDate: pigmyCustomer.endDate || null,

      // Merchant Specific Details
      shopName: pigmyCustomer.shopName || null,
      shopAddress: pigmyCustomer.shopAddress || null,
      businessProofType: pigmyCustomer.businessProofType || null,
      businessProofNumber: pigmyCustomer.businessProofNumber || pigmyCustomer.gstinNumber || null,
      gstinNumber: pigmyCustomer.gstinNumber || null,

      // Documents
      documents: {
        ownerAadhaar: resolvedOwnerAadhaarUrl,
        ownerPan: resolvedOwnerPanUrl,
        businessProof: pigmyCustomer.documents?.businessProof || pigmyCustomer.businessProofImage || null,
        shopPhoto: pigmyCustomer.documents?.shopPhoto || pigmyCustomer.shopPhoto || null,
        profilePhoto: pigmyCustomer.documents?.profilePhoto || pigmyCustomer.profilePhoto || null
      },
      aadhaarImage: resolvedOwnerAadhaarUrl,
      panImage: resolvedOwnerPanUrl,
      businessProofImage: pigmyCustomer.documents?.businessProof || pigmyCustomer.businessProofImage || null,
      shopPhoto: pigmyCustomer.documents?.shopPhoto || pigmyCustomer.shopPhoto || null,
      profilePhoto: pigmyCustomer.documents?.profilePhoto || pigmyCustomer.profilePhoto || null,

      // PDF Agreements & e-Sign (Generated after Branch Manager approval)
      agreements: {
        requiredPdfCount: isCreateNewSavings ? 2 : 1,
        pigmyAgreementPdfUrl: pigmyCustomer.agreements?.pigmyAgreementPdfUrl || null,
        pigmyAgreementDocId: pigmyCustomer.agreements?.pigmyAgreementDocId || null,
        pigmyAgreementStatus: pigmyCustomer.agreements?.pigmyAgreementStatus || 'PENDING',
        savingsAccountPdfUrl: isCreateNewSavings ? (pigmyCustomer.agreements?.savingsAccountPdfUrl || null) : null,
        savingsAccountDocId: isCreateNewSavings ? (pigmyCustomer.agreements?.savingsAccountDocId || null) : null,
        savingsAccountStatus: isCreateNewSavings ? (pigmyCustomer.agreements?.savingsAccountStatus || 'PENDING') : 'NOT_APPLICABLE',
        signedAt: pigmyCustomer.agreements?.signedAt || null,
        eSignTxnId: pigmyCustomer.agreements?.eSignTxnId || null
      },

      approvalStatus: pigmyCustomer.approvalStatus || 'PENDING_BRANCH_APPROVAL',
      rejectionReason: pigmyCustomer.rejectionReason || null,
      status: pigmyCustomer.status || 'INACTIVE',
      onboardedBy: pigmyCustomer.onboardedBy || null,
      approvedAt: pigmyCustomer.approvedAt || null,
      rejectedAt: pigmyCustomer.rejectedAt || null,
      createdAt: pigmyCustomer.createdAt,
      updatedAt: pigmyCustomer.updatedAt
    };
  }

  /**
   * 1. Onboard Pigmy Deposit Customer (Unified Single-Step API with Auto-Debit, Bank Details, Tenure, and Agreement PDFs)
   */
  async onboardPigmyCustomer(executiveUser, payload, files = {}) {
    const {
      customerId,
      customerUniqueId,
      userId,
      fullName,
      ownerName,
      primaryPhoneNumber,
      phoneNumber,
      secondaryPhoneNumber,
      email,
      dob,
      gender,
      address,
      residenceAddress,
      aadhaarNumber,
      panNumber,

      // Savings Account Option (EXISTING vs CREATE_NEW)
      savingsAccountOption: inputSavingsOption,
      existingSavingsAccountNumber,

      // Customer Bank Account Details for Auto-Debit Mandate
      bankAccountId,
      accountHolderName,
      bankAccountNumber,
      accountNumber: inputAccountNumber,
      ifscCode,
      bankName: inputBankName,
      bankBranchName,
      accountType,

      // Tenure (1, 3, 6, 12 Months)
      tenureMonths: inputTenureMonths,

      // SIP Scheme Linkage
      schemeId: inputSchemeId,
      schemeCode: inputSchemeCode,
      schemeName: inputSchemeName,
      interestRate: inputInterestRate,
      isCustomAmount: inputIsCustomAmount,

      // Deposit Configuration
      dailyDepositAmount,
      autoDebitAmount,
      depositFrequency,

      // Merchant Option
      isMerchant: inputIsMerchant,
      customerType: inputCustomerType,
      shopName,
      shopAddress,
      businessProofType,
      businessProofNumber,

      password,
      termsAccepted,
      branchId: inputBranchId,
      bankId: inputBankId
    } = payload;

    // 1. Resolve Customer Identity from Database (Auto-fetch profile if customerId/customerUniqueId/userId/phone is given)
    let customerUser = null;
    let customerProfile = null;

    const rawId = (customerId || customerUniqueId || userId || payload.uniqueId || '').toString().trim();
    const inputPhone = (primaryPhoneNumber || phoneNumber || payload.mobileNumber || '').toString().trim();

    // Strategy A: If rawId is a valid Mongo ObjectId, search User, CustomerProfile, SocietyCustomerLink
    if (rawId && mongoose.Types.ObjectId.isValid(rawId)) {
      customerUser = await User.findById(rawId);
      if (!customerUser) {
        customerProfile = await CustomerProfile.findById(rawId);
        if (customerProfile?.userId) {
          customerUser = await User.findById(customerProfile.userId);
        }
      }
      if (!customerUser) {
        const societyLink = await SocietyCustomerLink.findById(rawId);
        if (societyLink?.userId) {
          customerUser = await User.findById(societyLink.userId);
        }
      }
    }

    // Strategy B: If rawId is a code like ADV-562871878, or not yet found, check customerUniqueId / customerId
    if (!customerUser && rawId) {
      customerProfile = await CustomerProfile.findOne({
        $or: [
          { customerUniqueId: rawId },
          { customerUniqueId: new RegExp(`^${rawId}$`, 'i') },
          { customerId: rawId },
          { customerId: new RegExp(`^${rawId}$`, 'i') }
        ]
      });

      if (customerProfile?.userId) {
        customerUser = await User.findById(customerProfile.userId);
      }

      if (!customerUser) {
        const societyLink = await SocietyCustomerLink.findOne({
          $or: [
            { customerId: rawId },
            { customerId: new RegExp(`^${rawId}$`, 'i') }
          ]
        });
        if (societyLink?.userId) {
          customerUser = await User.findById(societyLink.userId);
        }
      }

      if (!customerUser) {
        customerUser = await User.findOne({
          $or: [
            { customerUniqueId: rawId },
            { customerUniqueId: new RegExp(`^${rawId}$`, 'i') }
          ]
        });
      }
    }

    // Strategy C: Check customerUniqueId separately if passed
    if (!customerUser && customerUniqueId) {
      const cleanUniqueId = String(customerUniqueId).trim();
      customerProfile = await CustomerProfile.findOne({
        $or: [
          { customerUniqueId: cleanUniqueId },
          { customerUniqueId: new RegExp(`^${cleanUniqueId}$`, 'i') }
        ]
      });
      if (customerProfile?.userId) {
        customerUser = await User.findById(customerProfile.userId);
      }
    }

    // Strategy D: Fallback to phone number lookup
    if (!customerUser && inputPhone) {
      customerUser = await User.findOne({ phoneNumber: inputPhone, isDeleted: { $ne: true } });
      if (!customerUser) {
        customerProfile = await CustomerProfile.findOne({ phoneNumber: inputPhone });
        if (customerProfile?.userId) {
          customerUser = await User.findById(customerProfile.userId);
        }
      }
    }

    // Ensure customerProfile is loaded if customerUser is found
    if (customerUser && !customerProfile) {
      customerProfile = await CustomerProfile.findOne({
        $or: [
          ...(customerUser.profileId ? [{ _id: customerUser.profileId }] : []),
          { userId: customerUser._id },
          { phoneNumber: customerUser.phoneNumber }
        ]
      });
    }

    // If customerProfile found but customerUser missing, load user
    if (!customerUser && customerProfile?.userId) {
      customerUser = await User.findById(customerProfile.userId);
    }

    const mainPhone = (customerUser?.phoneNumber || customerProfile?.phoneNumber || inputPhone).trim();
    if (!mainPhone) {
      throw ApiError.badRequest('Customer ID, Unique ID, or phone number is required to identify customer.');
    }

    const resolvedFullName = (
      fullName ||
      ownerName ||
      customerUser?.fullName ||
      (customerProfile?.firstName ? `${customerProfile.firstName} ${customerProfile.lastName || ''}`.trim() : null) ||
      'Customer'
    ).trim();

    const mainEmail = (email || customerUser?.email || customerProfile?.email || '').trim() || null;

    let resolvedDob = null;
    const rawDob = dob || customerProfile?.dob || customerProfile?.dateOfBirth || customerUser?.dob || null;
    if (rawDob) {
      if (rawDob instanceof Date) {
        resolvedDob = rawDob.toISOString().split('T')[0];
      } else {
        const d = new Date(String(rawDob).trim());
        resolvedDob = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : String(rawDob).trim();
      }
    }

    const resolvedGender = gender || customerProfile?.gender || customerUser?.gender || '';
    const existingKyc = await resolveExistingCustomerKyc({
      phoneNumber: mainPhone,
      userId: customerUser?._id,
      customerId: customerProfile?._id
    });

    const resolvedAadhaar = (
      aadhaarNumber ||
      payload.ownerAadhaarNumber ||
      payload.ownerAadharNumber ||
      customerProfile?.aadhaarNumber ||
      customerUser?.aadhaarNumber ||
      existingKyc.aadhaarNumber ||
      null
    );
    const resolvedPan = (
      panNumber ||
      payload.ownerPanNumber ||
      customerProfile?.panNumber ||
      customerUser?.panNumber ||
      existingKyc.panNumber ||
      ''
    ).toUpperCase() || null;

    const resolvedAddress = (
      address ||
      residenceAddress ||
      payload.currentAddress ||
      (typeof customerProfile?.activeAddress === 'string' ? customerProfile.activeAddress : customerProfile?.activeAddress?.addressLine) ||
      customerProfile?.address ||
      customerUser?.location?.address ||
      autoProfile?.address ||
      'Address Not Specified'
    ).trim();

    const isTermsAccepted = termsAccepted === true || termsAccepted === 'true' || termsAccepted === 1 || termsAccepted === '1';
    if (!isTermsAccepted) {
      throw ApiError.badRequest('You must accept terms & conditions to onboard Pigmy Customer.');
    }

    // Determine Savings Account Option (EXISTING vs CREATE_NEW)
    const isCreateNewSavings = String(inputSavingsOption || '').replace(/[\r\n'"]/g, '').trim().toUpperCase() === 'CREATE_NEW';
    const resolvedSavingsOption = isCreateNewSavings ? 'CREATE_NEW' : 'EXISTING';

    // Determine Tenure Months (1, 3, 6, or 12)
    const validTenures = [1, 3, 6, 12];
    const resolvedTenureMonths = validTenures.includes(Number(inputTenureMonths)) ? Number(inputTenureMonths) : 12;

    // Determine Merchant vs Individual
    const isMerchantCustomer = Boolean(
      inputIsMerchant === true ||
      inputIsMerchant === 'true' ||
      inputIsMerchant === 1 ||
      inputIsMerchant === '1' ||
      inputCustomerType === 'MERCHANT' ||
      Boolean(shopName && shopName.trim())
    );
    const resolvedCustomerType = isMerchantCustomer ? 'MERCHANT' : 'INDIVIDUAL';

    // 2. Resolve Executive User details and Branch/Bank IDs
    const execUserId = (executiveUser?.id || executiveUser?._id || executiveUser?.userId || '').toString();
    const execUserDoc = execUserId ? await User.findById(execUserId).lean() : null;

    const execId = execUserId || execUserDoc?._id || null;
    const execName = execUserDoc?.fullName || executiveUser?.fullName || executiveUser?.name || 'Loan Executive';
    const execPhone = execUserDoc?.phoneNumber || executiveUser?.phoneNumber || executiveUser?.phone || '';
    const execRole = execUserDoc?.role || executiveUser?.role || 'LOAN_EXECUTIVE';

    let { bankId: resolvedBankId, branchId: resolvedBranchId } = await this.resolveExecutiveContext(
      executiveUser,
      inputBankId || payload.bankId,
      inputBranchId || payload.branchId
    );

    // If still missing, check if customer already has a SocietyCustomerLink to inherit bank/branch
    if (!resolvedBankId || !resolvedBranchId) {
      const custSocLink = await SocietyCustomerLink.findOne({
        $or: [
          ...(customerUser?._id ? [{ userId: customerUser._id }] : []),
          ...(customerProfile?.userId ? [{ userId: customerProfile.userId }] : [])
        ]
      }).sort({ createdAt: -1 }).lean();
      if (custSocLink) {
        if (!resolvedBankId && custSocLink.bankId) resolvedBankId = custSocLink.bankId;
        if (!resolvedBranchId && custSocLink.branchId) resolvedBranchId = custSocLink.branchId;
      }
    }

    // Ultimate fallback to first active branch in the system
    if (!resolvedBankId || !resolvedBranchId) {
      const anyBranch = await Branch.findOne({ isDeleted: { $ne: true } }).lean();
      if (anyBranch) {
        if (!resolvedBranchId) resolvedBranchId = anyBranch._id;
        if (!resolvedBankId) resolvedBankId = anyBranch.bankId;
      }
    }

    let bankDoc = null;
    let branchDoc = null;
    if (resolvedBankId) {
      bankDoc = await Bank.findById(resolvedBankId).lean();
    }
    if (resolvedBranchId) {
      branchDoc = await Branch.findById(resolvedBranchId).lean();
    }
    const finalBankName = bankDoc?.name || inputBankName || 'N/A';
    const finalBranchName = branchDoc?.name || bankBranchName || 'N/A';

    // Lookup customer profile by phone (Auto-fetches existing bank account and profile)
    const lookupStatus = await OnboardingEngineService.lookupCustomerByPhone({
      phoneNumber: mainPhone,
      bankId: resolvedBankId,
      branchId: resolvedBranchId,
      productType: 'PIGMY'
    });

    const autoProfile = lookupStatus.userProfile || {};
    const autoAccount = lookupStatus.societyAccount || {};

    // Resolve Customer External Bank Account for Daily Auto-Debit
    // Note: Society account is where daily Pigmy deposits get CREDITED.
    // An external commercial Bank Account (e.g. HDFC, SBI) is REQUIRED to DEBIT funds.
    // It is NOT auto-fetched from society account; customer explicitly adds/inputs it every time.
    let selectedSavedAccount = null;
    if (bankAccountId && mongoose.Types.ObjectId.isValid(bankAccountId)) {
      selectedSavedAccount = await BankAccount.findOne({ _id: bankAccountId, isDeleted: false }).lean();
    }

    const userAccNumber = (bankAccountNumber || inputAccountNumber || selectedSavedAccount?.accountNumber || '').toString().trim();
    if (!userAccNumber) {
      throw ApiError.badRequest('Customer debit bank account number is required for auto-debit setup.');
    }
    const resolvedIfsc = (ifscCode || selectedSavedAccount?.ifsc || '').trim().toUpperCase();
    if (!resolvedIfsc) {
      throw ApiError.badRequest('Bank IFSC code is required for auto-debit setup.');
    }
    const resolvedAccHolder = (accountHolderName || selectedSavedAccount?.accountHolder || resolvedFullName).trim();
    const resolvedBankName = (inputBankName || selectedSavedAccount?.bankName || null);

    // Normalize files from multer.any()
    let filesObj = {};
    if (Array.isArray(files)) {
      files.forEach(f => {
        if (!filesObj[f.fieldname]) filesObj[f.fieldname] = [];
        filesObj[f.fieldname].push(f);
      });
    } else {
      filesObj = files || {};
    }

    // 3. Process File Uploads
    const aadhaarUpload = await this.processFileUpload(filesObj.ownerAadhaar || filesObj.aadhaarImage || filesObj.ownerAadhar, 'pigmy/aadhaar');
    const panUpload = await this.processFileUpload(filesObj.ownerPan || filesObj.panImage, 'pigmy/pan');
    const businessProofUpload = await this.processFileUpload(filesObj.businessProof || filesObj.businessProofImage || filesObj.gstCertificate || filesObj.shopRegistrationCertificate, 'pigmy/business-proof');
    const shopPhotoUpload = await this.processFileUpload(filesObj.shopPhoto || filesObj.shopPhotoUpload || filesObj.storePhoto, 'pigmy/shop-photos');
    const profilePhotoUpload = await this.processFileUpload(filesObj.profilePhoto || filesObj.avatar || filesObj.photo, 'pigmy/profiles');

    // Check or Create Customer User account (Enables instant Customer App Login)
    customerUser = customerUser || await User.findOne({ phoneNumber: mainPhone, isDeleted: { $ne: true } });

    // Lookup customer's existing documents from CustomerProfile and SocietyCustomerLink
    const customerProfileDoc = customerProfile || (customerUser?._id ? await CustomerProfile.findOne({ userId: customerUser._id }).lean() : null);
    const societyLinkDoc = customerUser?._id ? await SocietyCustomerLink.findOne({ userId: customerUser._id }).sort({ createdAt: -1 }).lean() : null;

    const finalAadhaarUrl = aadhaarUpload.url ||
      payload.aadhaarImage ||
      payload.ownerAadhaar ||
      payload.ownerAadhar ||
      customerProfileDoc?.aadhaarImage ||
      customerProfileDoc?.aadhaarPicUrl ||
      societyLinkDoc?.aadhaarPicUrl ||
      autoProfile?.aadhaarPicUrl ||
      autoProfile?.aadhaarImage ||
      existingKyc?.ownerAadhaar ||
      null;

    const finalPanUrl = panUpload.url ||
      payload.panImage ||
      payload.ownerPan ||
      customerProfileDoc?.panImage ||
      customerProfileDoc?.panPicUrl ||
      societyLinkDoc?.panPicUrl ||
      autoProfile?.panPicUrl ||
      autoProfile?.panImage ||
      existingKyc?.ownerPan ||
      null;

    const finalProfilePhotoUrl = profilePhotoUpload.url ||
      payload.profilePhoto ||
      payload.livePhoto ||
      payload.avatar ||
      customerProfileDoc?.livePhoto ||
      customerProfileDoc?.profileImage ||
      customerProfileDoc?.livePicUrl ||
      societyLinkDoc?.livePicUrl ||
      autoProfile?.livePicUrl ||
      autoProfile?.livePhoto ||
      customerUser?.livePhoto ||
      customerUser?.profileImage ||
      null;

    const finalBusinessProofUrl = businessProofUpload.url ||
      payload.businessProof ||
      payload.businessProofImage ||
      null;

    const finalShopPhotoUrl = shopPhotoUpload.url ||
      payload.shopPhoto ||
      payload.storePhoto ||
      null;

    // 4. Hash password for User account (Allows immediate Customer App login even before KYC completion!)
    const passwordHash = await bcrypt.hash(password || 'Test@1234', 10);

    if (customerUser) {
      customerUser.fullName = resolvedFullName || customerUser.fullName;
      if (mainEmail) customerUser.email = mainEmail;
      customerUser.passwordHash = passwordHash;
      customerUser.role = isMerchantCustomer ? UserRole.VENDOR : UserRole.CUSTOMER;
      customerUser.userType = isMerchantCustomer ? UserType.PARTNER : UserType.CUSTOMER;
      customerUser.status = 'ACTIVE'; // Enabled for instant Customer App login!
      customerUser.isApproved = false; // Pending Branch KYC Approval
      customerUser.profileModel = 'PigmyCustomer';
      customerUser.onboardingSource = 'EXECUTIVE_APP';
      if (execId) customerUser.onboardedBy = execId;
      if (execId) customerUser.updatedBy = execId;
    } else {
      customerUser = new User({
        phoneNumber: mainPhone,
        email: mainEmail || null,
        fullName: resolvedFullName,
        passwordHash,
        role: isMerchantCustomer ? UserRole.VENDOR : UserRole.CUSTOMER,
        userType: isMerchantCustomer ? UserType.PARTNER : UserType.CUSTOMER,
        status: 'ACTIVE', // Enabled for instant Customer App login!
        isApproved: false, // Pending Branch KYC Approval
        profileModel: 'PigmyCustomer',
        onboardingSource: 'EXECUTIVE_APP',
        onboardedBy: execId,
        createdBy: execId,
        updatedBy: execId
      });
    }

    await customerUser.save();

    // Ensure bank account is registered in BankAccount collection (Prevents duplicate addition, allows reuse for debit!)
    if (customerUser?._id && userAccNumber && resolvedIfsc) {
      try {
        const existingBankAcc = await BankAccount.findOne({
          userId: customerUser._id,
          accountNumber: userAccNumber.trim(),
          isDeleted: false
        });
        if (!existingBankAcc) {
          await BankAccount.create({
            userId: customerUser._id,
            bankName: resolvedBankName || 'Bank',
            accountNumber: userAccNumber.trim(),
            ifsc: resolvedIfsc.trim().toUpperCase(),
            accountHolder: resolvedAccHolder || customerUser.fullName || '',
            isPrimary: false,
            status: 'ACTIVE'
          });
        }
      } catch (bankErr) {
        logger.warn(`Failed to link BankAccount record for Pigmy customer: ${bankErr.message}`);
      }
    }

    // 6. Generate Unique Codes & Account Numbers
    const random6Digit = Math.floor(100000 + Math.random() * 900000);
    const generatedPigmyCode = `PIG-${random6Digit}`;
    const generatedAccNumber = `PIGACC-${Date.now().toString().slice(-6)}${random6Digit.toString().slice(0, 3)}`;

    const autoDebitValue = Number(autoDebitAmount || dailyDepositAmount || 100);

    // 6. Validate & Resolve SIP Scheme
    if (!inputSchemeId && !inputSchemeCode) {
      throw ApiError.badRequest('SIP Scheme ID (schemeId) or Scheme Code (schemeCode) is required to onboard Pigmy Customer.');
    }

    let resolvedScheme = null;
    if (inputSchemeId) {
      if (!mongoose.Types.ObjectId.isValid(inputSchemeId)) {
        throw ApiError.badRequest(`Invalid Scheme ID format [${inputSchemeId}]. Please provide a valid MongoDB ObjectId.`);
      }
      resolvedScheme = await Scheme.findById(inputSchemeId).lean();
    } else if (inputSchemeCode) {
      resolvedScheme = await Scheme.findOne({ schemeCode: inputSchemeCode.toUpperCase().trim() }).lean();
    }

    if (!resolvedScheme) {
      throw ApiError.badRequest(`Invalid SIP Scheme. No scheme found for Scheme ID [${inputSchemeId || 'N/A'}] or Code [${inputSchemeCode || 'N/A'}].`);
    }

    if (resolvedBankId && resolvedScheme.bankId && resolvedScheme.bankId.toString() !== resolvedBankId.toString()) {
      throw ApiError.badRequest(`Scheme "${resolvedScheme.schemeName}" (${resolvedScheme.schemeCode}) does not belong to the selected Bank.`);
    }

    if (resolvedScheme.status !== 'ACTIVE') {
      throw ApiError.badRequest(`Selected SIP Scheme "${resolvedScheme.schemeName}" is inactive.`);
    }

    const resolvedSchemeId = resolvedScheme._id;
    const resolvedSchemeCode = resolvedScheme.schemeCode;
    const resolvedSchemeName = resolvedScheme.schemeName;

    // Resolve Interest Rate based on chosen Tenure (1, 3, 6, 12 months) from durationPlans
    let resolvedInterestRate = 0;
    if (Array.isArray(resolvedScheme.durationPlans) && resolvedScheme.durationPlans.length > 0) {
      const matchedPlan = resolvedScheme.durationPlans.find(p => Number(p.durationMonths) === Number(resolvedTenureMonths));
      if (matchedPlan && matchedPlan.interestRate !== undefined) {
        resolvedInterestRate = Number(matchedPlan.interestRate);
      } else {
        throw ApiError.badRequest(`Selected tenure (${resolvedTenureMonths} months) is not available for scheme "${resolvedScheme.schemeName}". Available tenures: ${resolvedScheme.durationPlans.map(p => p.durationMonths + 'M').join(', ')}`);
      }
    } else if (inputInterestRate !== undefined) {
      resolvedInterestRate = Number(inputInterestRate);
    }

    // Determine if custom amount
    const resolvedIsCustomAmount = Boolean(
      inputIsCustomAmount === true ||
      inputIsCustomAmount === 'true' ||
      inputIsCustomAmount === 1 ||
      inputIsCustomAmount === '1' ||
      (resolvedScheme && Array.isArray(resolvedScheme.allowedAmounts) && !resolvedScheme.allowedAmounts.includes(autoDebitValue))
    );

    // Calculate Maturity Amount:
    // Total Principal = daily amount * (tenureMonths * 30 days)
    // Interest Earnings = (Total Principal * interestRate * (tenureMonths / 12)) / 100
    const totalDepositDays = resolvedTenureMonths * 30;
    const totalPrincipal = autoDebitValue * totalDepositDays;
    const interestEarnings = resolvedInterestRate > 0
      ? Math.round((totalPrincipal * resolvedInterestRate * (resolvedTenureMonths / 12)) / 100)
      : 0;
    const maturityAmount = totalPrincipal + interestEarnings;

    // 7. Create PigmyCustomer Profile Document
    const pigmyCustomer = new PigmyCustomer({
      pigmyCustomerCode: generatedPigmyCode,
      code: generatedPigmyCode,
      accountNumber: generatedAccNumber,
      userId: customerUser._id,
      bankId: resolvedBankId,
      bankName: finalBankName,
      branchId: resolvedBranchId,
      branchName: finalBranchName,
      customerType: resolvedCustomerType,
      isMerchant: isMerchantCustomer,
      fullName: resolvedFullName,
      ownerName: ownerName || resolvedFullName,
      primaryPhoneNumber: mainPhone,
      phoneNumber: mainPhone,
      secondaryPhoneNumber: secondaryPhoneNumber || null,
      email: mainEmail || null,
      dob: resolvedDob,
      gender: resolvedGender,
      address: resolvedAddress,
      residenceAddress: resolvedAddress,
      aadhaarNumber: resolvedAadhaar,
      ownerAadhaarNumber: resolvedAadhaar,
      ownerAadharNumber: resolvedAadhaar,
      panNumber: resolvedPan,
      ownerPanNumber: resolvedPan,

      // Savings Account Option
      savingsAccountOption: resolvedSavingsOption,
      hasSavingsAccount: !isCreateNewSavings,
      existingSavingsAccountNumber: societyLinkDoc?.societyAccountNumber || null,
      newSavingsAccountRequested: isCreateNewSavings,

      // Internal Society Bank Account (Single source of truth per customer)
      societyAccount: societyLinkDoc?.societyAccountNumber ? {
        societyAccountNumber: societyLinkDoc.societyAccountNumber,
        ifscCode: societyLinkDoc.ifscCode || '',
        accountHolderName: societyLinkDoc.accountHolderName || resolvedFullName,
        bankBranchName: societyLinkDoc.bankBranchName || ''
      } : {
        societyAccountNumber: null,
        ifscCode: '',
        accountHolderName: '',
        bankBranchName: ''
      },

      // Bank Account Details for Mandate (Commercial Bank e.g. HDFC, SBI)
      bankAccountDetails: {
        accountHolderName: resolvedAccHolder,
        accountNumber: userAccNumber,
        ifscCode: resolvedIfsc,
        bankName: resolvedBankName,
        branchName: bankBranchName || null,
        accountType: accountType || 'SAVINGS'
      },

      // Mandate Configuration (Activated upon Branch Approval)
      mandateDetails: {
        mandateId: `MAND-${generatedPigmyCode}`,
        mandateStatus: 'PENDING_APPROVAL',
        autoDebitAmount: autoDebitValue,
        autoDebitFrequency: depositFrequency || 'DAILY',
        mandateStartDate: null,
        mandateEndDate: null
      },

      // SIP Scheme Linkage & Projected Calculation
      schemeId: resolvedSchemeId,
      schemeCode: resolvedSchemeCode,
      schemeName: resolvedSchemeName,
      interestRate: resolvedInterestRate,
      isCustomAmount: resolvedIsCustomAmount,
      maturityAmount: maturityAmount,

      // Tenure Configuration (Start and End dates activate upon Branch Approval)
      tenureMonths: resolvedTenureMonths,
      startDate: null,
      endDate: null,

      // Merchant specific details
      shopName: isMerchantCustomer ? (shopName || resolvedFullName || null) : null,
      shopAddress: isMerchantCustomer ? (shopAddress || resolvedAddress || null) : null,
      businessProofType: isMerchantCustomer ? (businessProofType || '') : '',
      businessProofNumber: isMerchantCustomer ? (businessProofNumber ? businessProofNumber.toUpperCase() : null) : null,
      gstinNumber: (isMerchantCustomer && businessProofType === 'GST') ? businessProofNumber?.toUpperCase() : null,

      dailyDepositAmount: autoDebitValue,
      depositFrequency: depositFrequency || 'DAILY',

      documents: {
        ownerAadhaar: finalAadhaarUrl,
        ownerAadhaarKey: aadhaarUpload.key,
        ownerPan: finalPanUrl,
        ownerPanKey: panUpload.key,
        businessProof: finalBusinessProofUrl,
        businessProofKey: businessProofUpload.key,
        shopPhoto: finalShopPhotoUrl,
        shopPhotoKey: shopPhotoUpload.key,
        profilePhoto: finalProfilePhotoUrl,
        profilePhotoKey: profilePhotoUpload.key
      },
      aadhaarImage: finalAadhaarUrl,
      panImage: finalPanUrl,
      businessProofImage: finalBusinessProofUrl,
      shopPhoto: finalShopPhotoUrl,
      profilePhoto: finalProfilePhotoUrl,

      // PDF Agreements & e-Sign (Generated after Branch Manager approval)
      agreements: {
        requiredPdfCount: isCreateNewSavings ? 2 : 1,
        pigmyAgreementPdfUrl: null,
        pigmyAgreementDocId: null,
        pigmyAgreementStatus: 'PENDING',
        savingsAccountPdfUrl: null,
        savingsAccountDocId: null,
        savingsAccountStatus: isCreateNewSavings ? 'PENDING' : 'NOT_APPLICABLE',
        signedAt: null,
        eSignTxnId: null
      },

      approvalStatus: 'PENDING_BRANCH_APPROVAL',
      status: 'INACTIVE',
      onboardedBy: {
        id: execId,
        userId: execId,
        name: execName,
        phone: execPhone,
        role: execRole
      },
      createdBy: execId,
      updatedBy: execId
    });

    await pigmyCustomer.save();

    await pigmyCustomer.populate([
      { path: 'bankId', select: 'name code' },
      { path: 'branchId', select: 'name code' }
    ]);

    // Link profileId to user
    customerUser.profileId = pigmyCustomer._id;
    await customerUser.save();

    // Execute Society Customer Link & Credit Deduction Engine
    await OnboardingEngineService.processSocietyOnboardingAndCredits({
      user: customerUser,
      bankId: resolvedBankId,
      branchId: resolvedBranchId,
      productType: 'PIGMY',
      executiveUser,
      manualUploads: {
        pincode: payload.pincode || payload.residentialPincode || customerProfile?.residentialPincode || customerProfile?.currentPinCode || '',
        aadhaarPicUrl: finalAadhaarUrl || '',
        panPicUrl: finalPanUrl || '',
        livePicUrl: finalProfilePhotoUrl || ''
      }
    });

    logger.info(`EXECUTIVE PIGMY ONBOARDING: Pigmy Deposit Customer "${fullName}" onboarded by Executive ${executiveUser.fullName || execName} (${executiveUser.phoneNumber || execPhone}) with Savings Option: ${resolvedSavingsOption}, Tenure: ${resolvedTenureMonths}M`);

    const formattedPigmy = this.formatPigmyCustomerDetails(pigmyCustomer);

    return {
      message: 'Pigmy Deposit Customer onboarded successfully. Auto-debit mandate & agreements initialized for Branch approval.',
      pigmyCustomer: formattedPigmy
    };
  }

  /**
   * 2. List Executive Pigmy Customers (Scoped to Executive's own onboardings)
   */
  async listPigmyCustomers(executiveUser, queryOptions = {}) {
    const page = parseInt(queryOptions.page || '1', 10);
    const limit = parseInt(queryOptions.limit || '10', 10);
    const skip = (page - 1) * limit;
    const search = (queryOptions.search || '').trim();
    const customerType = (queryOptions.customerType || '').trim().toUpperCase();
    const savingsOption = (queryOptions.savingsAccountOption || '').trim().toUpperCase();
    const approvalStatus = queryOptions.approvalStatus || queryOptions.status;

    const execUserId = (executiveUser.id || executiveUser._id || executiveUser.userId || '').toString();
    const execObjId = mongoose.Types.ObjectId.isValid(execUserId) ? new mongoose.Types.ObjectId(execUserId) : null;

    const isExecutiveRole = [UserRole.LOAN_EXECUTIVE, 'EMPLOYEE', 'LOAN_OFFICER', 'FIELD_EXECUTIVE'].includes(executiveUser.role);

    const filter = { isDeleted: { $ne: true } };

    // 1. Executive Scoping (match String & ObjectId in DB)
    if (isExecutiveRole && execUserId) {
      const idMatches = [execUserId];
      if (execObjId) idMatches.push(execObjId);

      filter.$or = [
        { 'onboardedBy.id': { $in: idMatches } },
        { 'onboardedBy.userId': { $in: idMatches } },
        { createdBy: { $in: idMatches } }
      ];
    } else if (executiveUser.branchId) {
      filter.branchId = executiveUser.branchId;
    }

    if (queryOptions.branchId && mongoose.Types.ObjectId.isValid(queryOptions.branchId)) {
      filter.branchId = queryOptions.branchId;
    }

    // 2. Customer Type Filter (INDIVIDUAL vs MERCHANT)
    if (customerType && customerType !== 'ALL') {
      filter.customerType = customerType;
    }

    // 3. Savings Account Option Filter (EXISTING vs CREATE_NEW)
    if (savingsOption && savingsOption !== 'ALL') {
      filter.savingsAccountOption = savingsOption;
    }

    // 4. Status / Approval Status Filtering
    if (approvalStatus && approvalStatus !== 'ALL') {
      const upperStatus = approvalStatus.toUpperCase();
      if (['PENDING_BRANCH_APPROVAL', 'APPROVED', 'REJECTED'].includes(upperStatus)) {
        filter.approvalStatus = upperStatus;
      } else if (['ACTIVE', 'INACTIVE', 'BLOCKED'].includes(upperStatus)) {
        filter.status = upperStatus;
      } else {
        filter.$or = [
          { approvalStatus: upperStatus },
          { status: upperStatus }
        ];
      }
    }

    // 5. Date Range Filtering
    const startDate = queryOptions.startDate || queryOptions.fromDate;
    const endDate = queryOptions.endDate || queryOptions.toDate;
    const singleDate = queryOptions.date;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    } else if (singleDate) {
      const start = new Date(singleDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(singleDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: start, $lte: end };
    }

    // 6. Search Filtering
    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      const searchConditions = [
        { fullName: searchRegex },
        { ownerName: searchRegex },
        { primaryPhoneNumber: searchRegex },
        { phoneNumber: searchRegex },
        { secondaryPhoneNumber: searchRegex },
        { email: searchRegex },
        { pigmyCustomerCode: searchRegex },
        { code: searchRegex },
        { accountNumber: searchRegex },
        { shopName: searchRegex },
        { panNumber: searchRegex },
        { aadhaarNumber: searchRegex },
        { gstinNumber: searchRegex },
        { businessProofNumber: searchRegex },
        { address: searchRegex }
      ];

      if (filter.$or) {
        const existingOr = filter.$or;
        delete filter.$or;
        filter.$and = [
          { $or: existingOr },
          { $or: searchConditions }
        ];
      } else if (filter.$and) {
        filter.$and.push({ $or: searchConditions });
      } else {
        filter.$or = searchConditions;
      }
    }

    const sort = {};
    const sortBy = queryOptions.sortBy || 'createdAt';
    const sortOrder = queryOptions.sortOrder === 'asc' || queryOptions.sortOrder === '1' ? 1 : -1;
    sort[sortBy] = sortOrder;

    const [pigmyCustomers, total] = await Promise.all([
      PigmyCustomer.find(filter)
        .populate('branchId', 'name code')
        .populate('bankId', 'name code')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      PigmyCustomer.countDocuments(filter)
    ]);

    // Calculate aggregated stats
    const statsFilter = { isDeleted: { $ne: true } };
    if (isExecutiveRole && execUserId) {
      const idMatches = [execUserId];
      if (execObjId) idMatches.push(execObjId);

      statsFilter.$or = [
        { 'onboardedBy.id': { $in: idMatches } },
        { 'onboardedBy.userId': { $in: idMatches } },
        { createdBy: { $in: idMatches } }
      ];
    } else if (executiveUser.branchId) {
      statsFilter.branchId = executiveUser.branchId;
    }

    const [totalCount, individualCount, merchantCount, existingCount, newCount, pendingCount, approvedCount, rejectedCount] = await Promise.all([
      PigmyCustomer.countDocuments(statsFilter),
      PigmyCustomer.countDocuments({ ...statsFilter, customerType: 'INDIVIDUAL' }),
      PigmyCustomer.countDocuments({ ...statsFilter, customerType: 'MERCHANT' }),
      PigmyCustomer.countDocuments({ ...statsFilter, savingsAccountOption: 'EXISTING' }),
      PigmyCustomer.countDocuments({ ...statsFilter, savingsAccountOption: 'CREATE_NEW' }),
      PigmyCustomer.countDocuments({ ...statsFilter, approvalStatus: 'PENDING_BRANCH_APPROVAL' }),
      PigmyCustomer.countDocuments({ ...statsFilter, approvalStatus: 'APPROVED' }),
      PigmyCustomer.countDocuments({ ...statsFilter, approvalStatus: 'REJECTED' })
    ]);

    // Batch fetch associated SocietyCustomerLink to reflect actual society accounts
    const userIds = pigmyCustomers.map(p => p.userId).filter(Boolean);
    const societyLinks = userIds.length > 0
      ? await SocietyCustomerLink.find({ userId: { $in: userIds } }).lean()
      : [];
    const linkMap = new Map();
    for (const sl of societyLinks) {
      if (sl.userId) {
        linkMap.set(`${sl.userId.toString()}_${sl.bankId?.toString() || ''}`, sl);
        if (!linkMap.has(sl.userId.toString())) {
          linkMap.set(sl.userId.toString(), sl);
        }
      }
    }

    const formattedItems = await Promise.all(pigmyCustomers.map(async p => {
      const sl = p.userId
        ? (linkMap.get(`${p.userId.toString()}_${p.bankId?.toString() || ''}`) || linkMap.get(p.userId.toString()))
        : null;
      let fallbackKyc = null;
      if (!p.aadhaarNumber || !p.panNumber || !p.documents?.ownerAadhaar || !p.documents?.ownerPan) {
        fallbackKyc = await resolveExistingCustomerKyc({
          phoneNumber: p.primaryPhoneNumber || p.phoneNumber,
          userId: p.userId
        });
      }
      return this.formatPigmyCustomerDetails(p, sl, fallbackKyc);
    }));

    return {
      items: formattedItems,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      },
      stats: {
        total: totalCount,
        individual: individualCount,
        merchant: merchantCount,
        existingSavingsAccount: existingCount,
        newSavingsAccountRequested: newCount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount
      }
    };
  }

  /**
   * 3. Get Single Pigmy Customer Details by ID
   */
  async getPigmyCustomerDetails(executiveUser, pigmyId) {
    let targetId = pigmyId;
    let userObj = executiveUser;
    if (typeof executiveUser === 'string' || (!pigmyId && executiveUser)) {
      targetId = executiveUser;
      userObj = pigmyId;
    }

    if (!targetId) {
      throw ApiError.badRequest('Pigmy Customer ID, Account Number, or Phone Number is required.');
    }

    const trimmedId = String(targetId).trim();
    const isObjectId = mongoose.Types.ObjectId.isValid(trimmedId);
    const identifierQuery = {
      $or: [
        ...(isObjectId ? [{ _id: new mongoose.Types.ObjectId(trimmedId) }, { userId: new mongoose.Types.ObjectId(trimmedId) }] : []),
        { pigmyCustomerCode: trimmedId.toUpperCase() },
        { code: trimmedId.toUpperCase() },
        { accountNumber: trimmedId },
        { phoneNumber: trimmedId },
        { primaryPhoneNumber: trimmedId }
      ],
      isDeleted: { $ne: true }
    };

    const pigmyCustomer = await PigmyCustomer.findOne(identifierQuery)
      .populate('branchId', 'name code')
      .populate('bankId', 'name code')
      .lean();

    if (!pigmyCustomer) {
      throw ApiError.notFound(`Pigmy Customer profile not found for identifier [${targetId}].`);
    }

    const execUserId = (userObj?.id || userObj?._id || userObj?.userId || '').toString();
    const userRole = (userObj?.role || '').toUpperCase();
    const isPrivileged = ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'BRANCH_STAFF', 'SOCIETY_ADMIN', 'BANK_ADMIN', 'BANK_OWNER', 'CREDIT_MANAGER', 'RISK_MANAGER', 'MANAGER'].includes(userRole);

    if (!isPrivileged && execUserId) {
      const onboardedById = (pigmyCustomer.onboardedBy?.id || pigmyCustomer.onboardedBy?.userId || pigmyCustomer.createdBy || '').toString();
      const isCreator = onboardedById && onboardedById === execUserId;
      const branchMatch = userObj?.branchId && pigmyCustomer.branchId && (typeof pigmyCustomer.branchId === 'object' ? pigmyCustomer.branchId._id?.toString() : pigmyCustomer.branchId.toString()) === userObj.branchId.toString();
      const bankMatch = userObj?.bankId && pigmyCustomer.bankId && (typeof pigmyCustomer.bankId === 'object' ? pigmyCustomer.bankId._id?.toString() : pigmyCustomer.bankId.toString()) === userObj.bankId.toString();
      const isUnassignedBranch = !pigmyCustomer.branchId;

      if (!isCreator && !branchMatch && !bankMatch && !isUnassignedBranch && pigmyCustomer.bankId) {
        throw ApiError.notFound('Pigmy Customer profile not found or access denied for this executive.');
      }
    }

    let societyLink = null;
    if (pigmyCustomer.userId) {
      const pBankId = pigmyCustomer.bankId?._id || pigmyCustomer.bankId;
      if (pBankId) {
        societyLink = await SocietyCustomerLink.findOne({
          userId: pigmyCustomer.userId,
          bankId: pBankId
        }).lean();
      }
      if (!societyLink) {
        societyLink = await SocietyCustomerLink.findOne({
          userId: pigmyCustomer.userId
        }).sort({ lastKycDate: -1, createdAt: -1 }).lean();
      }
    }

    let fallbackKyc = null;
    const hasAadhaar = pigmyCustomer.aadhaarNumber || pigmyCustomer.ownerAadharNumber || pigmyCustomer.ownerAadhaarNumber;
    const hasPan = pigmyCustomer.panNumber || pigmyCustomer.ownerPanNumber;
    const hasAadhaarDoc = pigmyCustomer.documents?.ownerAadhaar || pigmyCustomer.aadhaarImage;
    const hasPanDoc = pigmyCustomer.documents?.ownerPan || pigmyCustomer.panImage;

    if (!hasAadhaar || !hasPan || !hasAadhaarDoc || !hasPanDoc) {
      fallbackKyc = await resolveExistingCustomerKyc({
        phoneNumber: pigmyCustomer.primaryPhoneNumber || pigmyCustomer.phoneNumber,
        userId: pigmyCustomer.userId
      });

      const updateFields = {};
      if (!hasAadhaar && fallbackKyc.aadhaarNumber) {
        updateFields.aadhaarNumber = fallbackKyc.aadhaarNumber;
        updateFields.ownerAadhaarNumber = fallbackKyc.aadhaarNumber;
        updateFields.ownerAadharNumber = fallbackKyc.aadhaarNumber;
        pigmyCustomer.aadhaarNumber = fallbackKyc.aadhaarNumber;
        pigmyCustomer.ownerAadhaarNumber = fallbackKyc.aadhaarNumber;
        pigmyCustomer.ownerAadharNumber = fallbackKyc.aadhaarNumber;
      }
      if (!hasPan && fallbackKyc.panNumber) {
        updateFields.panNumber = fallbackKyc.panNumber;
        updateFields.ownerPanNumber = fallbackKyc.panNumber;
        pigmyCustomer.panNumber = fallbackKyc.panNumber;
        pigmyCustomer.ownerPanNumber = fallbackKyc.panNumber;
      }
      if (!hasAadhaarDoc && fallbackKyc.ownerAadhaar) {
        updateFields['documents.ownerAadhaar'] = fallbackKyc.ownerAadhaar;
        updateFields.aadhaarImage = fallbackKyc.ownerAadhaar;
        if (!pigmyCustomer.documents) pigmyCustomer.documents = {};
        pigmyCustomer.documents.ownerAadhaar = fallbackKyc.ownerAadhaar;
        pigmyCustomer.aadhaarImage = fallbackKyc.ownerAadhaar;
      }
      if (!hasPanDoc && fallbackKyc.ownerPan) {
        updateFields['documents.ownerPan'] = fallbackKyc.ownerPan;
        updateFields.panImage = fallbackKyc.ownerPan;
        if (!pigmyCustomer.documents) pigmyCustomer.documents = {};
        pigmyCustomer.documents.ownerPan = fallbackKyc.ownerPan;
        pigmyCustomer.panImage = fallbackKyc.ownerPan;
      }

      if (Object.keys(updateFields).length > 0) {
        PigmyCustomer.findByIdAndUpdate(pigmyCustomer._id, { $set: updateFields }).catch(err => {
          logger.warn(`Failed to backfill PigmyCustomer KYC: ${err.message}`);
        });
      }
    }

    return this.formatPigmyCustomerDetails(pigmyCustomer, societyLink, fallbackKyc);
  }

  /**
   * 4. Approve Pigmy Customer (Branch Manager / Society Admin / Authorized Staff)
   * NOTE: Calculation & Deposit Tenure Start/End Dates become active officially from the approval date!
   */
  async approvePigmyCustomer(approverUser, pigmyId, payload = {}) {
    const { remarks = 'Approved by Branch Manager' } = payload;
    const pigmyCustomer = await PigmyCustomer.findById(pigmyId);
    if (!pigmyCustomer) {
      throw ApiError.notFound(`Pigmy customer record [${pigmyId}] not found.`);
    }

    // Mandatory Society Account Existence Check
    let societyLink = null;
    if (pigmyCustomer.userId) {
      societyLink = await SocietyCustomerLink.findOne({
        userId: pigmyCustomer.userId,
        ...(pigmyCustomer.bankId ? { bankId: pigmyCustomer.bankId } : {})
      }).lean();
    }

    const existingAccNum =
      (pigmyCustomer.societyAccount?.societyAccountNumber || '').trim() ||
      (societyLink?.societyAccountNumber || '').trim();

    if (!existingAccNum) {
      throw ApiError.badRequest(
        `Cannot approve Pigmy Customer [${pigmyCustomer.pigmyCustomerCode || pigmyCustomer.code}]: Customer society account number is missing or does not exist. Please add society account details first before approval.`
      );
    }

    const approverUserId = (approverUser?.id || approverUser?._id || approverUser?.userId || '').toString();
    const approverName = approverUser?.fullName || approverUser?.name || 'Branch Manager';
    const approverRole = approverUser?.role || 'BRANCH_MANAGER';

    const approvalDate = new Date();
    const tenureMonths = Number(pigmyCustomer.tenureMonths || 12);
    const calculatedEndDate = new Date(approvalDate);
    calculatedEndDate.setMonth(calculatedEndDate.getMonth() + tenureMonths);

    // Update Status to APPROVED & ACTIVE
    pigmyCustomer.approvalStatus = 'APPROVED';
    pigmyCustomer.status = 'ACTIVE';
    pigmyCustomer.approvedAt = approvalDate;
    pigmyCustomer.approvedBy = {
      id: approverUserId,
      userId: approverUserId,
      name: approverName,
      role: approverRole
    };
    pigmyCustomer.approvalRemarks = remarks;

    // Tenure and Daily Mandate become officially active from approval date!
    pigmyCustomer.startDate = approvalDate;
    pigmyCustomer.endDate = calculatedEndDate;

    if (!pigmyCustomer.mandateDetails) {
      pigmyCustomer.mandateDetails = {};
    }
    pigmyCustomer.mandateDetails.mandateStartDate = approvalDate;
    pigmyCustomer.mandateDetails.mandateEndDate = calculatedEndDate;
    pigmyCustomer.mandateDetails.mandateStatus = 'ACTIVE';

    // Generate Official Agreement PDFs & Document IDs upon Branch Approval
    if (!pigmyCustomer.agreements) {
      pigmyCustomer.agreements = {};
    }
    const pigCode = pigmyCustomer.pigmyCustomerCode || pigmyCustomer.code;
    pigmyCustomer.agreements.pigmyAgreementPdfUrl = `https://s3-noi.aces3.ai/sahayaone/agreements/PIGMY-AGREEMENT-${pigCode}.pdf`;
    pigmyCustomer.agreements.pigmyAgreementDocId = `DOC-PIG-${pigCode}`;
    pigmyCustomer.agreements.pigmyAgreementStatus = 'GENERATED';

    const isCreateNewSavings = pigmyCustomer.savingsAccountOption === 'CREATE_NEW' || pigmyCustomer.newSavingsAccountRequested;
    if (isCreateNewSavings) {
      pigmyCustomer.agreements.savingsAccountPdfUrl = `https://s3-noi.aces3.ai/sahayaone/agreements/SAVINGS-ACCOUNT-OPENING-${pigCode}.pdf`;
      pigmyCustomer.agreements.savingsAccountDocId = `DOC-SAV-${pigCode}`;
      pigmyCustomer.agreements.savingsAccountStatus = 'GENERATED';
    }

    await pigmyCustomer.save();

    await pigmyCustomer.populate([
      { path: 'bankId', select: 'name code' },
      { path: 'branchId', select: 'name code' }
    ]);

    // Activate user if linked
    if (pigmyCustomer.userId) {
      await User.findByIdAndUpdate(pigmyCustomer.userId, {
        status: 'ACTIVE',
        isApproved: true
      });
    }

    logger.info(`PIGMY CUSTOMER APPROVED: [${pigmyCustomer.pigmyCustomerCode}] approved by ${approverName} (${approverRole}). Tenure activated: ${approvalDate.toISOString().slice(0, 10)} to ${calculatedEndDate.toISOString().slice(0, 10)}`);

    return {
      message: `Pigmy Deposit Account [${pigmyCustomer.pigmyCustomerCode}] approved successfully. Deposit tenure and auto-debit cycle activated.`,
      pigmyCustomer: this.formatPigmyCustomerDetails(pigmyCustomer)
    };
  }

  /**
   * 5. Reject Pigmy Customer (Branch Manager / Society Admin / Authorized Staff)
   */
  async rejectPigmyCustomer(approverUser, pigmyId, payload = {}) {
    const rawReason = payload.reason || payload.rejectionReason || payload.remarks;
    const cleanReason = String(rawReason || '').trim();
    if (!cleanReason) {
      throw ApiError.badRequest('Rejection reason (reason) is required to reject Pigmy Customer application.');
    }
    const reason = cleanReason;
    const pigmyCustomer = await PigmyCustomer.findById(pigmyId);
    if (!pigmyCustomer) {
      throw ApiError.notFound(`Pigmy customer record [${pigmyId}] not found.`);
    }

    const approverUserId = (approverUser?.id || approverUser?._id || approverUser?.userId || '').toString();
    const approverName = approverUser?.fullName || approverUser?.name || 'Branch Manager';
    const approverRole = approverUser?.role || 'BRANCH_MANAGER';

    pigmyCustomer.approvalStatus = 'REJECTED';
    pigmyCustomer.status = 'INACTIVE';
    pigmyCustomer.rejectedAt = new Date();
    pigmyCustomer.rejectedBy = {
      id: approverUserId,
      userId: approverUserId,
      name: approverName,
      role: approverRole
    };
    pigmyCustomer.rejectionReason = reason;

    if (pigmyCustomer.mandateDetails) {
      pigmyCustomer.mandateDetails.mandateStatus = 'CANCELLED';
    }

    if (pigmyCustomer.agreements) {
      pigmyCustomer.agreements.pigmyAgreementStatus = 'REJECTED';
      if (pigmyCustomer.agreements.savingsAccountStatus && pigmyCustomer.agreements.savingsAccountStatus !== 'NOT_APPLICABLE') {
        pigmyCustomer.agreements.savingsAccountStatus = 'REJECTED';
      }
    }

    await pigmyCustomer.save();

    await pigmyCustomer.populate([
      { path: 'bankId', select: 'name code' },
      { path: 'branchId', select: 'name code' }
    ]);

    return {
      message: `Pigmy Deposit Account [${pigmyCustomer.pigmyCustomerCode}] rejected.`,
      pigmyCustomer: this.formatPigmyCustomerDetails(pigmyCustomer)
    };
  }
}

export const employeePigmyService = new EmployeePigmyService();
