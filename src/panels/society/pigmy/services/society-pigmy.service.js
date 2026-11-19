import mongoose from 'mongoose';
import { PigmyCustomer } from '../../../../models/pigmy-customer.model.js';
import { User } from '../../../../models/user.model.js';
import { CustomerProfile } from '../../../../models/customer-profile.model.js';
import { SocietyCustomerLink } from '../../../../models/society-customer-link.model.js';
import { SocietyEmployee } from '../../../../models/society-employee.model.js';
import { BranchManager } from '../../../../models/branch-manager.model.js';
import { OnboardingEngineService } from '../../../employee/onboarding/services/onboarding-engine.service.js';
import { ApiError } from '../../../../common/api.error.js';
import { logger } from '../../../../utils/logger.util.js';
import { societyLeadEmailService } from '../../services/society-lead-email.service.js';
import { resolveExistingCustomerKyc } from '../../../../utils/customer-kyc-resolver.util.js';

export class SocietyPigmyService {
  /**
   * Resolve Bank and Branch scoping context for logged in Society User / Staff
   */
  async resolveSocietyUserContext(societyUser, queryBranchId = null) {
    const userId = (societyUser?.id || societyUser?._id || societyUser?.userId || '').toString();
    const userRole = (societyUser?.role || societyUser?.userType || '').toString().toUpperCase();

    let userBankId = societyUser?.bankId || societyUser?.societyId || null;
    let userBranchId = societyUser?.branchId || null;

    // Lookup SocietyEmployee or BranchManager profile if IDs missing
    if (userId && (!userBankId || !userBranchId)) {
      const societyEmployee = await SocietyEmployee.findOne({ userId, isDeleted: { $ne: true } }).lean();
      if (societyEmployee) {
        if (!userBankId && societyEmployee.bankId) userBankId = societyEmployee.bankId;
        if (!userBranchId && societyEmployee.branchId) userBranchId = societyEmployee.branchId;
      }
    }

    if (userId && (!userBankId || !userBranchId)) {
      const branchManager = await BranchManager.findOne({ userId, isDeleted: { $ne: true } }).lean();
      if (branchManager) {
        if (!userBankId && branchManager.bankId) userBankId = branchManager.bankId;
        if (!userBranchId && branchManager.branchId) userBranchId = branchManager.branchId;
      }
    }

    const isBankOwner =
      Boolean(societyUser?.isBankOwner) ||
      ['SUPER_ADMIN', 'SOCIETY_ADMIN', 'BANK_ADMIN', 'BANK_OWNER', 'OWNER', 'CHAIRMAN', 'ADMIN'].includes(userRole);

    let effectiveBranchId = null;
    if (!isBankOwner) {
      // Branch Manager, QC Employee, Branch Staff strictly bound to assigned branch
      effectiveBranchId = userBranchId || queryBranchId || null;
    } else {
      // Bank owner can filter by queryBranchId if explicitly passed
      effectiveBranchId = queryBranchId || null;
    }

    return {
      bankId: userBankId,
      branchId: effectiveBranchId,
      userBranchId: userBranchId,
      isBankOwner,
      userRole
    };
  }

  /**
   * Format Pigmy Customer details response object matching Integration Guide API 8
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

    // Resolve society account details (Only from official societyAccount or SocietyCustomerLink)
    const resolvedSocietyAccNum =
      (pigmyCustomer.societyAccount?.societyAccountNumber && String(pigmyCustomer.societyAccount.societyAccountNumber).trim()) ||
      (societyLink?.societyAccountNumber && String(societyLink.societyAccountNumber).trim()) ||
      null;

    const resolvedSocietyIfsc =
      pigmyCustomer.societyAccount?.ifscCode ||
      societyLink?.ifscCode ||
      '';

    const resolvedSocietyAccHolder =
      pigmyCustomer.societyAccount?.accountHolderName ||
      societyLink?.accountHolderName ||
      '';

    const resolvedSocietyBranchName =
      pigmyCustomer.societyAccount?.bankBranchName ||
      societyLink?.bankBranchName ||
      '';

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

      // Merchant Specific Details
      shopName: pigmyCustomer.shopName || null,
      shopAddress: pigmyCustomer.shopAddress || null,
      businessProofType: pigmyCustomer.businessProofType || null,
      businessProofNumber: pigmyCustomer.businessProofNumber || pigmyCustomer.gstinNumber || null,
      gstinNumber: pigmyCustomer.gstinNumber || null,

      // Savings Account Option Selection
      savingsAccountOption: pigmyCustomer.savingsAccountOption || 'EXISTING',
      hasSavingsAccount: pigmyCustomer.hasSavingsAccount !== false,
      existingSavingsAccountNumber: pigmyCustomer.existingSavingsAccountNumber || null,
      newSavingsAccountRequested: isCreateNewSavings,

      // Internal Cooperative Society Account (Credit Destination)
      societyAccount: resolvedSocietyAccNum ? {
        societyAccountNumber: resolvedSocietyAccNum,
        ifscCode: resolvedSocietyIfsc,
        accountHolderName: resolvedSocietyAccHolder,
        bankBranchName: resolvedSocietyBranchName
      } : null,

      // Customer Bank Account Details (Used for Daily Auto-Debit Mandate)
      bankAccountDetails: {
        accountHolderName: pigmyCustomer.bankAccountDetails?.accountHolderName || pigmyCustomer.fullName,
        accountNumber: pigmyCustomer.bankAccountDetails?.accountNumber || null,
        ifscCode: pigmyCustomer.bankAccountDetails?.ifscCode || null,
        bankName: pigmyCustomer.bankAccountDetails?.bankName || bankName,
        branchName: pigmyCustomer.bankAccountDetails?.branchName || branchName,
        accountType: pigmyCustomer.bankAccountDetails?.accountType || 'SAVINGS'
      },

      // Auto-Debit Mandate Details
      mandateDetails: {
        mandateId: pigmyCustomer.mandateDetails?.mandateId || `MAND-${pigmyCustomer._id.toString().slice(-6).toUpperCase()}`,
        mandateStatus: pigmyCustomer.mandateDetails?.mandateStatus || 'PENDING_SETUP',
        autoDebitAmount: pigmyCustomer.mandateDetails?.autoDebitAmount || pigmyCustomer.dailyDepositAmount || 100,
        autoDebitFrequency: pigmyCustomer.mandateDetails?.autoDebitFrequency || pigmyCustomer.depositFrequency || 'DAILY',
        mandateStartDate: pigmyCustomer.mandateDetails?.mandateStartDate || pigmyCustomer.startDate || pigmyCustomer.createdAt,
        mandateEndDate: pigmyCustomer.mandateDetails?.mandateEndDate || pigmyCustomer.endDate || null
      },

      // SIP Scheme Linkage & Calculations
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

      // PDF Agreements & e-Sign
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
      productType: 'PIGMY',
      createdAt: pigmyCustomer.createdAt,
      updatedAt: pigmyCustomer.updatedAt
    };
  }

  /**
   * 1. View Single Pigmy Customer Details (Society Panel API)
   * GET /api/v1/society/pigmy-customers/:id
   */
  async getPigmyCustomerDetails(societyUser, pigmyId) {
    if (!pigmyId) {
      throw ApiError.badRequest('Pigmy Customer ID, Account Number, or Phone Number is required.');
    }

    const { bankId: contextBankId, branchId: contextBranchId, isBankOwner } = await this.resolveSocietyUserContext(societyUser);

    const trimmedId = String(pigmyId).trim();
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
      throw ApiError.notFound(`Pigmy Customer profile not found for identifier [${pigmyId}].`);
    }

    // Enforce Branch-Level Data Isolation
    if (!isBankOwner && contextBranchId) {
      const recordBranchId = (pigmyCustomer.branchId && (typeof pigmyCustomer.branchId === 'object' ? pigmyCustomer.branchId._id : pigmyCustomer.branchId))?.toString();
      if (recordBranchId && recordBranchId !== contextBranchId.toString()) {
        throw ApiError.notFound(`Pigmy Customer profile not found or access denied for this branch.`);
      }
    }

    // Fetch associated SocietyCustomerLink if available
    let societyLink = null;
    if (pigmyCustomer.userId) {
      societyLink = await SocietyCustomerLink.findOne({
        userId: pigmyCustomer.userId,
        ...(pigmyCustomer.bankId ? { bankId: pigmyCustomer.bankId } : {})
      }).lean();
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
   * 2. Branch Manager / QC Employee Approval API for Pigmy Customer (With mandatory account existence check)
   * POST /api/v1/society/pigmy-customers/:id/approve
   */
  async approvePigmyCustomer(societyUser, pigmyId, payload = {}) {
    const { remarks = 'Approved by Branch Staff' } = payload;
    const { branchId: contextBranchId, isBankOwner } = await this.resolveSocietyUserContext(societyUser);

    const pigmyCustomer = await PigmyCustomer.findById(pigmyId);
    if (!pigmyCustomer || pigmyCustomer.isDeleted) {
      throw ApiError.notFound(`Pigmy customer record [${pigmyId}] not found.`);
    }

    // Enforce Branch-Level Data Isolation
    if (!isBankOwner && contextBranchId) {
      const recordBranchId = pigmyCustomer.branchId?.toString();
      if (recordBranchId && recordBranchId !== contextBranchId.toString()) {
        throw ApiError.notFound(`Pigmy Customer profile [${pigmyId}] not found or access denied for this branch.`);
      }
    }

    // Check if already approved
    if (pigmyCustomer.approvalStatus === 'APPROVED' && pigmyCustomer.status === 'ACTIVE') {
      return {
        message: `Pigmy Deposit Account [${pigmyCustomer.pigmyCustomerCode || pigmyCustomer.code}] is already approved and active.`,
        pigmyCustomer: this.formatPigmyCustomerDetails(pigmyCustomer)
      };
    }

    // MANDATORY ACCOUNT NUMBER EXISTENCE CHECK
    // Society deposit accounts require a valid customer society account number before approval!
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

    const approverUserId = (societyUser?.id || societyUser?._id || societyUser?.userId || '').toString();
    const approverName = societyUser?.fullName || societyUser?.name || 'Branch Manager';
    const approverRole = societyUser?.role || societyUser?.userType || 'BRANCH_MANAGER';

    const approvalDate = new Date();
    const tenureMonths = Number(pigmyCustomer.tenureMonths || 12);
    const calculatedEndDate = new Date(approvalDate);
    calculatedEndDate.setMonth(calculatedEndDate.getMonth() + tenureMonths);

    // Update Status & Approval details
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

    // Officially activate tenure dates from approval date
    pigmyCustomer.startDate = approvalDate;
    pigmyCustomer.endDate = calculatedEndDate;

    if (!pigmyCustomer.mandateDetails) {
      pigmyCustomer.mandateDetails = {};
    }
    pigmyCustomer.mandateDetails.mandateStartDate = approvalDate;
    pigmyCustomer.mandateDetails.mandateEndDate = calculatedEndDate;
    pigmyCustomer.mandateDetails.mandateStatus = 'ACTIVE';

    // Generate Agreement PDF links and Doc IDs
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

    // Activate User if linked
    if (pigmyCustomer.userId) {
      await User.findByIdAndUpdate(pigmyCustomer.userId, {
        status: 'ACTIVE',
        isApproved: true
      });
    }

    logger.info(`SOCIETY PIGMY CUSTOMER APPROVED: [${pigmyCustomer.pigmyCustomerCode}] approved by ${approverName} (${approverRole}). Society Acc: ${existingAccNum}`);

    // Dispatch MSG91 email notifications to customer and creating executive
    societyLeadEmailService.sendPigmyApprovalEmails({
      pigmyCustomer,
      societyUser
    }).catch(() => {});

    return {
      message: `Pigmy Deposit Account [${pigmyCustomer.pigmyCustomerCode}] approved successfully. Deposit tenure and auto-debit collection activated.`,
      pigmyCustomer: this.formatPigmyCustomerDetails(pigmyCustomer, societyLink)
    };
  }

  /**
   * 3. Rejection API for Pigmy Customer (Society Panel)
   * POST /api/v1/society/pigmy-customers/:id/reject
   */
  async rejectPigmyCustomer(societyUser, pigmyId, payload = {}) {
    const rawReason = payload.reason || payload.rejectionReason || payload.remarks;
    const cleanReason = String(rawReason || '').trim();
    if (!cleanReason) {
      throw ApiError.badRequest('Rejection reason (reason) is required to reject Pigmy Customer application.');
    }
    const reason = cleanReason;
    const { branchId: contextBranchId, isBankOwner } = await this.resolveSocietyUserContext(societyUser);

    const pigmyCustomer = await PigmyCustomer.findById(pigmyId);
    if (!pigmyCustomer || pigmyCustomer.isDeleted) {
      throw ApiError.notFound(`Pigmy customer record [${pigmyId}] not found.`);
    }

    // Enforce Branch-Level Data Isolation
    if (!isBankOwner && contextBranchId) {
      const recordBranchId = pigmyCustomer.branchId?.toString();
      if (recordBranchId && recordBranchId !== contextBranchId.toString()) {
        throw ApiError.notFound(`Pigmy Customer profile [${pigmyId}] not found or access denied for this branch.`);
      }
    }

    const approverUserId = (societyUser?.id || societyUser?._id || societyUser?.userId || '').toString();
    const approverName = societyUser?.fullName || societyUser?.name || 'Branch Manager';
    const approverRole = societyUser?.role || societyUser?.userType || 'BRANCH_MANAGER';

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

    // Dispatch MSG91 email notifications to customer and creating executive
    societyLeadEmailService.sendPigmyRejectionEmails({
      pigmyCustomer,
      reason: cleanReason,
      societyUser
    }).catch(() => {});

    return {
      message: `Pigmy Deposit Account [${pigmyCustomer.pigmyCustomerCode || pigmyCustomer.code}] rejected successfully.`,
      pigmyCustomer: this.formatPigmyCustomerDetails(pigmyCustomer)
    };
  }

  /**
   * 4. Add / Link Society Account Numbers and Details (Society Panel API)
   * POST /api/v1/society/pigmy-customers/:id/society-account
   */
  async addSocietyAccount(societyUser, pigmyIdOrPayload, payload = {}) {
    let targetId = pigmyIdOrPayload;
    let dataPayload = payload;

    if (typeof pigmyIdOrPayload === 'object' && pigmyIdOrPayload !== null) {
      targetId = pigmyIdOrPayload.pigmyCustomerId || pigmyIdOrPayload.id || pigmyIdOrPayload.customerId;
      dataPayload = pigmyIdOrPayload;
    }

    const {
      pigmyCustomerId,
      customerId,
      userId,
      phoneNumber,
      societyAccountNumber,
      ifscCode,
      accountHolderName,
      bankBranchName,
      pincode
    } = dataPayload;

    const finalSocietyAccNum = (societyAccountNumber || dataPayload.accountNumber || '').toString().trim();
    if (!finalSocietyAccNum) {
      throw ApiError.badRequest('societyAccountNumber is required to add or link society account.');
    }

    const { bankId: contextBankId, branchId: contextBranchId, isBankOwner } = await this.resolveSocietyUserContext(societyUser);

    const lookupId = targetId || pigmyCustomerId || customerId || userId || phoneNumber;
    if (!lookupId) {
      throw ApiError.badRequest('Pigmy Customer ID, Customer ID, or Phone Number is required to locate customer record.');
    }

    const trimmedId = String(lookupId).trim();
    const isObjectId = mongoose.Types.ObjectId.isValid(trimmedId);

    const pigmyCustomer = await PigmyCustomer.findOne({
      $or: [
        ...(isObjectId ? [{ _id: new mongoose.Types.ObjectId(trimmedId) }, { userId: new mongoose.Types.ObjectId(trimmedId) }] : []),
        { pigmyCustomerCode: trimmedId.toUpperCase() },
        { code: trimmedId.toUpperCase() },
        { accountNumber: trimmedId },
        { phoneNumber: trimmedId },
        { primaryPhoneNumber: trimmedId }
      ],
      isDeleted: { $ne: true }
    });

    if (!pigmyCustomer) {
      throw ApiError.notFound(`Pigmy customer record not found for identifier [${lookupId}].`);
    }

    // Enforce Branch-Level Data Isolation
    if (!isBankOwner && contextBranchId) {
      const recordBranchId = pigmyCustomer.branchId?.toString();
      if (recordBranchId && recordBranchId !== contextBranchId.toString()) {
        throw ApiError.notFound(`Pigmy Customer profile not found or access denied for this branch.`);
      }
    }

    const resolvedIfsc = (ifscCode || pigmyCustomer.bankAccountDetails?.ifscCode || '').trim().toUpperCase();
    const resolvedHolder = (accountHolderName || pigmyCustomer.fullName).trim();
    const resolvedBranchName = (bankBranchName || pigmyCustomer.branchName || '').trim();

    // 1. Update PigmyCustomer document
    pigmyCustomer.existingSavingsAccountNumber = finalSocietyAccNum;
    pigmyCustomer.hasSavingsAccount = true;
    pigmyCustomer.savingsAccountOption = 'EXISTING';
    pigmyCustomer.societyAccount = {
      societyAccountNumber: finalSocietyAccNum,
      ifscCode: resolvedIfsc,
      accountHolderName: resolvedHolder,
      bankBranchName: resolvedBranchName
    };

    await pigmyCustomer.save();

    // 2. Sync / Link with SocietyCustomerLink
    if (pigmyCustomer.userId) {
      const targetBankId = pigmyCustomer.bankId || contextBankId;
      const targetBranchId = pigmyCustomer.branchId || contextBranchId;

      if (targetBankId) {
        await OnboardingEngineService.linkSocietyAccount({
          userId: pigmyCustomer.userId,
          bankId: targetBankId,
          branchId: targetBranchId,
          societyAccountNumber: finalSocietyAccNum,
          ifscCode: resolvedIfsc,
          accountHolderName: resolvedHolder,
          bankBranchName: resolvedBranchName,
          authorizedUser: societyUser
        });
      }
    }

    await pigmyCustomer.populate([
      { path: 'bankId', select: 'name code' },
      { path: 'branchId', select: 'name code' }
    ]);

    logger.info(`SOCIETY ACCOUNT ADDED: Added society account ${finalSocietyAccNum} for Pigmy Customer [${pigmyCustomer.pigmyCustomerCode || pigmyCustomer.code}] by User ${societyUser.fullName || societyUser.name}`);

    return {
      message: 'Society bank account details added successfully.',
      societyAccount: pigmyCustomer.societyAccount,
      pigmyCustomer: this.formatPigmyCustomerDetails(pigmyCustomer)
    };
  }

  /**
   * 5. List Pigmy Customer Leads for Society Panel (With Branch Scoping)
   * GET /api/v1/society/pigmy-customers
   */
  async listPigmyCustomers(societyUser, queryOptions = {}) {
    const page = parseInt(queryOptions.page || '1', 10);
    const limit = parseInt(queryOptions.limit || '10', 10);
    const skip = (page - 1) * limit;
    const search = (queryOptions.search || '').trim();
    const customerType = (queryOptions.customerType || '').trim().toUpperCase();
    const savingsOption = (queryOptions.savingsAccountOption || '').trim().toUpperCase();
    const approvalStatus = queryOptions.approvalStatus || queryOptions.status;

    const { bankId: contextBankId, branchId: contextBranchId } = await this.resolveSocietyUserContext(societyUser, queryOptions.branchId);

    const filter = { isDeleted: { $ne: true } };

    // Apply Bank & Branch level data isolation
    if (contextBankId) {
      filter.bankId = contextBankId;
    }
    if (contextBranchId && mongoose.Types.ObjectId.isValid(contextBranchId)) {
      filter.branchId = new mongoose.Types.ObjectId(contextBranchId);
    }

    // Customer Type Filter (INDIVIDUAL vs MERCHANT)
    if (customerType && customerType !== 'ALL') {
      filter.customerType = customerType;
    }

    // Savings Account Option Filter (EXISTING vs CREATE_NEW)
    if (savingsOption && savingsOption !== 'ALL') {
      filter.savingsAccountOption = savingsOption;
    }

    // Status / Approval Status Filtering
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

    // Date Range Filtering
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

    // Search Filtering
    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      const searchConditions = [
        { fullName: searchRegex },
        { ownerName: searchRegex },
        { primaryPhoneNumber: searchRegex },
        { phoneNumber: searchRegex },
        { pigmyCustomerCode: searchRegex },
        { code: searchRegex },
        { accountNumber: searchRegex },
        { 'societyAccount.societyAccountNumber': searchRegex },
        { existingSavingsAccountNumber: searchRegex },
        { shopName: searchRegex },
        { panNumber: searchRegex },
        { aadhaarNumber: searchRegex }
      ];

      if (filter.$or) {
        const existingOr = filter.$or;
        delete filter.$or;
        filter.$and = [
          { $or: existingOr },
          { $or: searchConditions }
        ];
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

    // Calculate aggregated statistics for Society Panel
    const statsFilter = { isDeleted: { $ne: true } };
    if (contextBankId) statsFilter.bankId = contextBankId;
    if (contextBranchId && mongoose.Types.ObjectId.isValid(contextBranchId)) {
      statsFilter.branchId = new mongoose.Types.ObjectId(contextBranchId);
    }

    const [totalCount, individualCount, merchantCount, pendingCount, approvedCount, rejectedCount] = await Promise.all([
      PigmyCustomer.countDocuments(statsFilter),
      PigmyCustomer.countDocuments({ ...statsFilter, customerType: 'INDIVIDUAL' }),
      PigmyCustomer.countDocuments({ ...statsFilter, customerType: 'MERCHANT' }),
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
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount
      }
    };
  }
}

export const societyPigmyService = new SocietyPigmyService();
