import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../../../../models/user.model.js';
import { MerchantProfile } from '../../../../models/merchant-profile.model.js';
import { SocietyCustomerLink } from '../../../../models/society-customer-link.model.js';
import { Branch } from '../../../../models/branch.model.js';
import { Bank } from '../../../../models/bank.model.js';
import { SocietyEmployee } from '../../../../models/society-employee.model.js';
import { BranchManager } from '../../../../models/branch-manager.model.js';
import { EmployeeProfile } from '../../../../models/employee-profile.model.js';
import { OnboardingTeam } from '../../../../models/onboarding-team.model.js';
import { UserRole, UserType } from '../../../../constants/user-role.constant.js';
import { storageManager } from '../../../../storage/storage.manager.js';
import { OnboardingEngineService } from '../../onboarding/services/onboarding-engine.service.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';
import { logger } from '../../../../utils/logger.util.js';
import { resolveExistingCustomerKyc } from '../../../../utils/customer-kyc-resolver.util.js';

export class EmployeeMerchantService {
  /**
   * Process uploaded files or return URL
   */
  async processFileUpload(fileArray, folder = 'merchants') {
    if (!fileArray || fileArray.length === 0) return { url: null, key: null };
    const file = fileArray[0];
    const uploadResult = await storageManager.uploadFile(file, folder);
    return {
      url: uploadResult?.fileUrl || uploadResult?.url || null,
      key: uploadResult?.key || uploadResult?.filePath || null
    };
  }

  /**
   * Format single merchant response for Executive App UI
   */
  formatMerchantDetails(merchant, onboardedByUser = null, societyLink = null, fallbackKyc = null) {
    if (!merchant) return null;

    let kycFallback = fallbackKyc;
    let actualSocietyLink = societyLink;
    let actualOnboardedBy = onboardedByUser;
    if (societyLink && (societyLink.aadhaarNumber || societyLink.panNumber || societyLink.ownerAadhaar || societyLink.ownerPan)) {
      kycFallback = societyLink;
      actualSocietyLink = null;
    } else if (onboardedByUser && (onboardedByUser.aadhaarNumber || onboardedByUser.panNumber || onboardedByUser.ownerAadhaar || onboardedByUser.ownerPan)) {
      kycFallback = onboardedByUser;
      actualOnboardedBy = null;
    }

    const docs = merchant.documents || {};
    const branchObj = merchant.branchId;

    let branchName = 'N/A';
    let branchId = null;
    if (branchObj && typeof branchObj === 'object') {
      branchName = branchObj.name || 'N/A';
      branchId = branchObj._id;
    } else if (branchObj) {
      branchId = branchObj;
    }

    const onboardedByInfo = merchant.onboardedBy || {};
    let onboardedByName = onboardedByInfo.name || actualOnboardedBy?.fullName || 'Loan Executive';
    let onboardedByPhone = onboardedByInfo.phone || actualOnboardedBy?.phoneNumber || '';
    let onboardedByRole = onboardedByInfo.role || actualOnboardedBy?.role || 'LOAN_EXECUTIVE';

    const generatedCode = merchant.merchantCode || merchant.code || `MER-${merchant._id.toString().slice(-6).toUpperCase()}`;

    const resolvedSocietyAccount = actualSocietyLink?.societyAccountNumber ? {
      societyAccountNumber: actualSocietyLink.societyAccountNumber,
      ifscCode: actualSocietyLink.ifscCode || '',
      accountHolderName: actualSocietyLink.accountHolderName || merchant.ownerName,
      bankBranchName: actualSocietyLink.bankBranchName || ''
    } : null;

    const effectiveAadhaarNum = merchant.aadhaarNumber || kycFallback?.aadhaarNumber || '';
    const effectivePanNum = merchant.panNumber || kycFallback?.panNumber || '';
    const effectiveAadhaarDoc = docs.ownerAadhaar || merchant.aadhaarImage || kycFallback?.ownerAadhaar || null;
    const effectivePanDoc = docs.ownerPan || merchant.panImage || kycFallback?.ownerPan || null;

    return {
      id: merchant._id,
      merchantId: merchant._id,
      merchantCode: generatedCode,
      code: generatedCode,
      userId: merchant.userId,
      shopName: merchant.shopName,
      ownerName: merchant.ownerName,
      shopOwnerName: merchant.ownerName,
      primaryPhoneNumber: merchant.phoneNumber || merchant.primaryPhoneNumber,
      phoneNumber: merchant.phoneNumber || merchant.primaryPhoneNumber,
      secondaryPhoneNumber: merchant.secondaryPhoneNumber || null,
      email: merchant.email,
      shopAddress: merchant.shopAddress || '',
      aadhaarNumber: effectiveAadhaarNum,
      ownerAadharNumber: effectiveAadhaarNum,
      ownerAadhaarNumber: effectiveAadhaarNum,
      panNumber: effectivePanNum,
      ownerPanNumber: effectivePanNum,
      businessProofType: merchant.businessProofType || null,
      businessProofNumber: merchant.businessProofNumber || merchant.gstinNumber || null,
      gstinNumber: merchant.gstinNumber || merchant.businessProofNumber || null,
      societyAccount: resolvedSocietyAccount,
      documents: {
        ownerAadhaar: effectiveAadhaarDoc,
        ownerPan: effectivePanDoc,
        businessProof: docs.businessProof || docs.gstCertificate || docs.shopRegistrationCertificate || null,
        shopPhoto: docs.shopPhoto || null,
        shopRegistrationCertificate: docs.shopRegistrationCertificate || null,
        gstCertificate: docs.gstCertificate || null
      },
      aadhaarImage: effectiveAadhaarDoc,
      panImage: effectivePanDoc,
      businessProofImage: docs.businessProof || docs.gstCertificate || docs.shopRegistrationCertificate || null,
      shopPhoto: docs.shopPhoto || null,
      approvalStatus: merchant.approvalStatus || 'PENDING_BRANCH_APPROVAL',
      rejectionReason: merchant.rejectionReason || null,
      status: merchant.status || 'INACTIVE',
      bankId: merchant.bankId?._id || merchant.bankId || null,
      branchId: branchId,
      branchName: branchName,
      branch: branchName,
      onboardedBy: {
        id: onboardedByInfo.id || onboardedByInfo.userId || merchant.createdBy,
        userId: onboardedByInfo.userId || onboardedByInfo.id || merchant.createdBy,
        name: onboardedByName,
        phone: onboardedByPhone,
        role: onboardedByRole
      },
      approvedAt: merchant.approvedAt || null,
      rejectedAt: merchant.rejectedAt || null,
      createdAt: merchant.createdAt,
      updatedAt: merchant.updatedAt
    };
  }

  /**
   * 1. Onboard Merchant by Executive App
   */
  async onboardMerchant(executiveUser, payload, files = {}) {
    const {
      shopName,
      ownerName,
      primaryPhoneNumber,
      phoneNumber,
      secondaryPhoneNumber,
      email,
      shopAddress,
      aadhaarNumber,
      aadhaarImage,
      panNumber,
      panImage,
      businessProofType,
      businessProofNumber,
      businessProofImage,
      shopPhoto,
      password,
      termsAccepted,
      branchId: inputBranchId,
      bankId: inputBankId
    } = payload;

    const mainPhone = (primaryPhoneNumber || phoneNumber || '').trim();
    const mainEmail = (email || '').trim().toLowerCase();

    if (!mainPhone || !mainEmail) {
      throw ApiError.badRequest('Primary contact number and email address are required.');
    }

    const isTermsAccepted = termsAccepted === true || termsAccepted === 'true' || termsAccepted === 1 || termsAccepted === '1';
    if (!isTermsAccepted) {
      throw ApiError.badRequest('You must accept terms & conditions to onboard merchant.');
    }

    // 1. Resolve Executive User details and Branch/Bank IDs
    const execUserId = executiveUser?.id || executiveUser?._id || executiveUser?.userId;
    const execUserDoc = execUserId ? await User.findById(execUserId).lean() : null;

    const execId = execUserId || execUserDoc?._id || null;
    const execName = execUserDoc?.fullName || executiveUser?.fullName || executiveUser?.name || 'Loan Executive';
    const execPhone = execUserDoc?.phoneNumber || executiveUser?.phoneNumber || executiveUser?.phone || '';
    const execRole = execUserDoc?.role || executiveUser?.role || 'LOAN_EXECUTIVE';

    let resolvedBranchId = executiveUser?.branchId || execUserDoc?.branchId || inputBranchId || payload.branchId || null;
    let resolvedBankId = executiveUser?.bankId || executiveUser?.societyId || execUserDoc?.bankId || inputBankId || payload.bankId || null;

    if (execId && (!resolvedBankId || !resolvedBranchId)) {
      const societyEmployee = await SocietyEmployee.findOne({ userId: execId, isDeleted: { $ne: true } }).lean();
      if (societyEmployee) {
        if (!resolvedBranchId && societyEmployee.branchId) resolvedBranchId = societyEmployee.branchId;
        if (!resolvedBankId && societyEmployee.bankId) resolvedBankId = societyEmployee.bankId;
      }
    }

    if (execId && (!resolvedBankId || !resolvedBranchId)) {
      const branchManager = await BranchManager.findOne({ userId: execId, isDeleted: { $ne: true } }).lean();
      if (branchManager) {
        if (!resolvedBranchId && branchManager.branchId) resolvedBranchId = branchManager.branchId;
        if (!resolvedBankId && branchManager.bankId) resolvedBankId = branchManager.bankId;
      }
    }

    if (execId && (!resolvedBankId || !resolvedBranchId)) {
      const onboardingTeam = await OnboardingTeam.findOne({ userId: execId, isDeleted: { $ne: true } }).lean();
      if (onboardingTeam) {
        if (!resolvedBranchId && onboardingTeam.branchId) resolvedBranchId = onboardingTeam.branchId;
      }
    }

    if (execId && (!resolvedBankId || !resolvedBranchId)) {
      const employeeProfile = await EmployeeProfile.findOne({ userId: execId, isDeleted: { $ne: true } }).lean();
      if (employeeProfile) {
        if (!resolvedBranchId && employeeProfile.branchId) resolvedBranchId = employeeProfile.branchId;
      }
    }

    // Direct Bank Head / Owner lookup
    if (execId && !resolvedBankId) {
      const bankDoc = await Bank.findOne({
        $or: [{ userId: execId }, { email: execUserDoc?.email?.toLowerCase() }],
        isDeleted: { $ne: true }
      }).lean();
      if (bankDoc) {
        resolvedBankId = bankDoc._id;
      }
    }

    if (resolvedBranchId && !resolvedBankId) {
      const branch = await Branch.findById(resolvedBranchId).lean();
      if (branch) resolvedBankId = branch.bankId;
    }

    const roleUpper = String(execRole || '').toUpperCase();
    const isBankOwnerOrHead = ['BANK_OWNER', 'BANK_ADMIN', 'SOCIETY_ADMIN', 'SUPER_ADMIN', 'OWNER', 'CHAIRMAN', 'ADMIN', 'BANK_HEAD', 'HEAD', 'AUTHORIZED_PERSON', 'BANK_AUTHORIZED_PERSON'].includes(roleUpper) || roleUpper.includes('HEAD') || roleUpper.includes('OWNER') || roleUpper.includes('AUTHORIZED');

    if (isBankOwnerOrHead && (inputBranchId || payload.branchId)) {
      const candidateBranchId = inputBranchId || payload.branchId;
      if (candidateBranchId) {
        const targetBranch = await Branch.findOne({ _id: candidateBranchId, isDeleted: { $ne: true } }).lean();
        if (!targetBranch) {
          throw ApiError.badRequest('Selected bank branch is invalid or deactivated.');
        }
        if (resolvedBankId && targetBranch.bankId && targetBranch.bankId.toString() !== resolvedBankId.toString()) {
          throw ApiError.badRequest('Selected bank branch does not belong to your bank organization.');
        }
        resolvedBranchId = targetBranch._id;
      }
    }

    if (resolvedBankId && !resolvedBranchId) {
      const activeBranches = await Branch.find({ bankId: resolvedBankId, isDeleted: { $ne: true } }).lean();
      if (activeBranches.length > 0) {
        resolvedBranchId = activeBranches[0]._id;
      }
    }

    // Check single merchant limit per bank
    const existingMerchantBank = await MerchantProfile.findOne({
      $or: [{ phoneNumber: mainPhone }, { primaryPhoneNumber: mainPhone }],
      bankId: resolvedBankId,
      isDeleted: { $ne: true }
    });
    if (existingMerchantBank) {
      throw ApiError.conflict('Customer is already an onboarded Merchant in this Bank. Only 1 Merchant profile is allowed per Bank.');
    }

    // Lookup customer profile by phone
    const lookupStatus = await OnboardingEngineService.lookupCustomerByPhone({
      phoneNumber: mainPhone,
      bankId: resolvedBankId,
      branchId: resolvedBranchId,
      productType: 'MERCHANT'
    });

    if (!lookupStatus.productEligibility?.canApply) {
      throw ApiError.conflict(lookupStatus.productEligibility?.reason || 'Customer cannot be onboarded as Merchant in this bank.');
    }

    const autoProfile = lookupStatus.userProfile || {};
    // Normalize files if passed as array from multer.any()
    let filesObj = {};
    if (Array.isArray(files)) {
      files.forEach(f => {
        if (!filesObj[f.fieldname]) filesObj[f.fieldname] = [];
        filesObj[f.fieldname].push(f);
      });
    } else {
      filesObj = files || {};
    }

    // 3. Find existing user if present
    const existingUserPhone = await User.findOne({ phoneNumber: mainPhone, isDeleted: { $ne: true } });
    let merchantUser = existingUserPhone;

    // Resolve existing Customer KYC if details are missing
    const existingKyc = await resolveExistingCustomerKyc({
      phoneNumber: mainPhone,
      userId: merchantUser?._id,
    });

    const effectiveAadhaarNumber = (
      aadhaarNumber ||
      payload.ownerAadhaarNumber ||
      payload.ownerAadharNumber ||
      autoProfile.aadhaarNumber ||
      existingKyc.aadhaarNumber ||
      ''
    ).trim();

    const effectivePanNumber = (
      panNumber ||
      payload.ownerPanNumber ||
      autoProfile.panNumber ||
      existingKyc.panNumber ||
      ''
    ).trim().toUpperCase();

    // 4. Process File Uploads or fallback to payload image URLs / existing KYC documents
    const aadhaarUpload = await this.processFileUpload(filesObj.ownerAadhaar || filesObj.aadhaarImage || filesObj.ownerAadhar, 'merchants/aadhaar');
    const panUpload = await this.processFileUpload(filesObj.ownerPan || filesObj.panImage, 'merchants/pan');
    const businessProofUpload = await this.processFileUpload(filesObj.businessProof || filesObj.businessProofImage || filesObj.gstCertificate || filesObj.shopRegistrationCertificate, 'merchants/business-proof');
    const shopPhotoUpload = await this.processFileUpload(filesObj.shopPhoto || filesObj.shopPhotoUpload || filesObj.storePhoto, 'merchants/shop-photos');

    const finalAadhaarUrl =
      aadhaarUpload.url ||
      aadhaarImage ||
      payload.ownerAadhaar ||
      payload.ownerAadhar ||
      autoProfile.aadhaarPicUrl ||
      autoProfile.aadhaarImage ||
      existingKyc.ownerAadhaar ||
      null;

    const finalPanUrl =
      panUpload.url ||
      panImage ||
      payload.ownerPan ||
      autoProfile.panPicUrl ||
      autoProfile.panImage ||
      existingKyc.ownerPan ||
      null;

    const finalBusinessProofUrl = businessProofUpload.url || businessProofImage || null;
    const finalShopPhotoUrl = shopPhotoUpload.url || shopPhoto || null;

    // 4. Hash password
    const passwordHash = await bcrypt.hash(password || 'Test@1234', 10);

    // 5. Create or update Merchant User (Status = PENDING, isApproved = false)
    if (merchantUser) {
      merchantUser.fullName = ownerName || merchantUser.fullName;
      if (mainEmail) merchantUser.email = mainEmail;
      if (password) {
        merchantUser.passwordHash = passwordHash;
      } else if (!merchantUser.passwordHash) {
        merchantUser.passwordHash = passwordHash;
      }
      merchantUser.role = UserRole.VENDOR;
      merchantUser.userType = UserType.PARTNER;
      if (merchantUser.status !== 'ACTIVE') {
        merchantUser.status = 'PENDING';
        merchantUser.isApproved = false;
      }
      merchantUser.profileModel = 'MerchantProfile';
      merchantUser.onboardingSource = 'EXECUTIVE_APP';
      if (execId) merchantUser.onboardedBy = execId;
      if (execId) merchantUser.updatedBy = execId;
    } else {
      merchantUser = new User({
        phoneNumber: mainPhone,
        email: mainEmail,
        fullName: ownerName,
        passwordHash,
        role: UserRole.VENDOR,
        userType: UserType.PARTNER,
        status: 'PENDING',
        isApproved: false,
        profileModel: 'MerchantProfile',
        onboardingSource: 'EXECUTIVE_APP',
        onboardedBy: execId,
        createdBy: execId,
        updatedBy: execId
      });
    }

    await merchantUser.save();

    // Generate Unique Merchant Code
    const generatedMerchantCode = `MER-${Math.floor(100000 + Math.random() * 900000)}`;

    // 6. Create MerchantProfile (approvalStatus = PENDING_BRANCH_APPROVAL, status = INACTIVE)
    const merchantProfile = new MerchantProfile({
      userId: merchantUser._id,
      merchantCode: generatedMerchantCode,
      code: generatedMerchantCode,
      bankId: resolvedBankId,
      branchId: resolvedBranchId,
      shopName,
      ownerName,
      email: mainEmail,
      phoneNumber: mainPhone,
      primaryPhoneNumber: mainPhone,
      secondaryPhoneNumber: secondaryPhoneNumber || null,
      shopAddress: shopAddress || null,
      aadhaarNumber: effectiveAadhaarNumber || null,
      panNumber: effectivePanNumber || null,
      gstinNumber: businessProofType === 'GST' ? businessProofNumber?.toUpperCase() : null,
      businessProofType: businessProofType || null,
      businessProofNumber: businessProofNumber ? businessProofNumber.toUpperCase() : null,
      documents: {
        ownerAadhaar: finalAadhaarUrl,
        ownerAadhaarKey: aadhaarUpload.key,
        ownerPan: finalPanUrl,
        ownerPanKey: panUpload.key,
        businessProof: finalBusinessProofUrl,
        businessProofKey: businessProofUpload.key,
        shopPhoto: finalShopPhotoUrl,
        shopPhotoKey: shopPhotoUpload.key,
        gstCertificate: businessProofType === 'GST' ? finalBusinessProofUrl : null,
        shopRegistrationCertificate: businessProofType === 'SHOP_LICENSE' ? finalBusinessProofUrl : null
      },
      aadhaarImage: finalAadhaarUrl,
      panImage: finalPanUrl,
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

    await merchantProfile.save();

    // Link profileId to user
    merchantUser.profileId = merchantProfile._id;
    await merchantUser.save();

    // Execute Society Customer Link & Credit Deduction Engine
    await OnboardingEngineService.processSocietyOnboardingAndCredits({
      user: merchantUser,
      bankId: resolvedBankId,
      branchId: resolvedBranchId,
      productType: 'MERCHANT',
      executiveUser,
      manualUploads: {
        pincode: shopAddress || '',
        aadhaarPicUrl: finalAadhaarUrl || '',
        panPicUrl: finalPanUrl || '',
        livePicUrl: finalShopPhotoUrl || ''
      }
    });

    logger.info(`EXECUTIVE MERCHANT ONBOARDING: Merchant "${shopName}" onboarded by Executive ${execName} (${execPhone})`);

    const populatedProfile = await MerchantProfile.findById(merchantProfile._id)
      .populate('branchId', 'name code')
      .populate('bankId', 'name code')
      .lean();

    const formattedMerchant = this.formatMerchantDetails(populatedProfile || merchantProfile, executiveUser);

    return {
      message: 'Merchant onboarded successfully. Submitted for Branch Manager / Owner approval.',
      merchant: formattedMerchant
    };
  }

  /**
   * 2. List Merchants Onboarded by Executive / Branch
   */
  async listMerchants(executiveUser, queryOptions = {}) {
    const page = parseInt(queryOptions.page || '1', 10);
    const limit = parseInt(queryOptions.limit || '10', 10);
    const skip = (page - 1) * limit;
    const search = (queryOptions.search || '').trim();
    const approvalStatus = queryOptions.approvalStatus || queryOptions.status;

    const execUserId = (executiveUser.id || executiveUser._id || executiveUser.userId || '').toString();
    const execObjId = mongoose.Types.ObjectId.isValid(execUserId) ? new mongoose.Types.ObjectId(execUserId) : null;

    const isExecutiveRole = [UserRole.LOAN_EXECUTIVE, 'EMPLOYEE', 'LOAN_OFFICER', 'FIELD_EXECUTIVE'].includes(executiveUser.role);

    const filter = { isDeleted: { $ne: true } };

    // 1. Executive Scoping (support both String and ObjectId matching in DB)
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

    // 2. Status / Approval Status Filtering
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

    // 3. Date Range & Single Date Filtering
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

    // 4. Search Filtering
    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      const searchConditions = [
        { shopName: searchRegex },
        { ownerName: searchRegex },
        { phoneNumber: searchRegex },
        { primaryPhoneNumber: searchRegex },
        { secondaryPhoneNumber: searchRegex },
        { email: searchRegex },
        { merchantCode: searchRegex },
        { code: searchRegex },
        { panNumber: searchRegex },
        { gstinNumber: searchRegex },
        { businessProofNumber: searchRegex },
        { shopAddress: searchRegex }
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

    const [merchants, total] = await Promise.all([
      MerchantProfile.find(filter)
        .populate('branchId', 'name code')
        .populate('bankId', 'name code')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      MerchantProfile.countDocuments(filter)
    ]);

    // Calculate stats matching executive scoping
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

    const [totalCount, pendingCount, approvedCount, rejectedCount] = await Promise.all([
      MerchantProfile.countDocuments(statsFilter),
      MerchantProfile.countDocuments({ ...statsFilter, approvalStatus: 'PENDING_BRANCH_APPROVAL' }),
      MerchantProfile.countDocuments({ ...statsFilter, approvalStatus: 'APPROVED' }),
      MerchantProfile.countDocuments({ ...statsFilter, approvalStatus: 'REJECTED' })
    ]);

    for (const m of merchants) {
      if (!m.branchId && m.bankId) {
        const bankIdVal = typeof m.bankId === 'object' ? m.bankId._id : m.bankId;
        const defaultBranch = await Branch.findOne({ bankId: bankIdVal, isDeleted: { $ne: true } }).select("name code").lean();
        if (defaultBranch) {
          m.branchId = defaultBranch;
          MerchantProfile.updateOne({ _id: m._id }, { branchId: defaultBranch._id }).catch(() => {});
        }
      }
    }

    const merchantUserIds = merchants.map(m => m.userId).filter(Boolean);
    const societyLinks = merchantUserIds.length > 0
      ? await SocietyCustomerLink.find({ userId: { $in: merchantUserIds }, societyAccountNumber: { $ne: null } }).lean()
      : [];
    const socMap = new Map();
    societyLinks.forEach(l => socMap.set(String(l.userId), l));

    const formattedItems = await Promise.all(
      merchants.map(async (m) => {
        let fallbackKyc = null;
        if (!m.aadhaarNumber || !m.panNumber || !m.documents?.ownerAadhaar || !m.documents?.ownerPan) {
          fallbackKyc = await resolveExistingCustomerKyc({
            phoneNumber: m.phoneNumber || m.primaryPhoneNumber,
            userId: m.userId,
          });
          if (fallbackKyc.aadhaarNumber || fallbackKyc.panNumber || fallbackKyc.ownerAadhaar || fallbackKyc.ownerPan) {
            const updateFields = {};
            if (!m.aadhaarNumber && fallbackKyc.aadhaarNumber) updateFields.aadhaarNumber = fallbackKyc.aadhaarNumber;
            if (!m.panNumber && fallbackKyc.panNumber) updateFields.panNumber = fallbackKyc.panNumber;
            if (!m.documents?.ownerAadhaar && fallbackKyc.ownerAadhaar) updateFields['documents.ownerAadhaar'] = fallbackKyc.ownerAadhaar;
            if (!m.documents?.ownerPan && fallbackKyc.ownerPan) updateFields['documents.ownerPan'] = fallbackKyc.ownerPan;
            if (Object.keys(updateFields).length > 0) {
              MerchantProfile.updateOne({ _id: m._id }, { $set: updateFields }).catch(() => {});
            }
          }
        }
        return this.formatMerchantDetails(m, null, socMap.get(String(m.userId)), fallbackKyc);
      })
    );

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
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount
      }
    };
  }

  /**
   * 3. Get Single Merchant Details by ID
   */
  async getMerchantDetails(executiveUser, merchantId) {
    if (!merchantId) {
      throw ApiError.badRequest('Merchant ID, Merchant Code, or Phone Number is required.');
    }

    const trimmedId = String(merchantId).trim();
    const isObjectId = mongoose.Types.ObjectId.isValid(trimmedId);
    const identifierQuery = {
      $or: [
        ...(isObjectId ? [{ _id: new mongoose.Types.ObjectId(trimmedId) }, { userId: new mongoose.Types.ObjectId(trimmedId) }] : []),
        { merchantCode: trimmedId.toUpperCase() },
        { code: trimmedId.toUpperCase() },
        { phoneNumber: trimmedId },
        { primaryPhoneNumber: trimmedId }
      ],
      isDeleted: { $ne: true }
    };

    const merchant = await MerchantProfile.findOne(identifierQuery)
      .populate('branchId', 'name code')
      .populate('bankId', 'name code')
      .lean();

    if (!merchant) {
      throw ApiError.notFound(`Merchant profile not found for identifier [${merchantId}].`);
    }

    // Access Scoping:
    // Allow if creator, or if user & merchant belong to same branch or bank, or if merchant has no branch assigned, or if user has privileged role
    const execUserId = (executiveUser?.id || executiveUser?._id || executiveUser?.userId || '').toString();
    const userRole = (executiveUser?.role || '').toUpperCase();
    const isPrivileged = ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'BRANCH_STAFF', 'SOCIETY_ADMIN', 'BANK_ADMIN', 'BANK_OWNER', 'CREDIT_MANAGER', 'RISK_MANAGER', 'MANAGER'].includes(userRole);

    if (!isPrivileged && execUserId) {
      const onboardedById = (merchant.onboardedBy?.id || merchant.onboardedBy?.userId || merchant.createdBy || '').toString();
      const isCreator = onboardedById && onboardedById === execUserId;
      const branchMatch = executiveUser?.branchId && merchant.branchId && (typeof merchant.branchId === 'object' ? merchant.branchId._id?.toString() : merchant.branchId.toString()) === executiveUser.branchId.toString();
      const bankMatch = executiveUser?.bankId && merchant.bankId && (typeof merchant.bankId === 'object' ? merchant.bankId._id?.toString() : merchant.bankId.toString()) === executiveUser.bankId.toString();
      const isUnassignedBranch = !merchant.branchId;

      // In employee app, if merchant exists and was onboarded in the system, allow viewing by employee unless explicitly cross-bank
      if (!isCreator && !branchMatch && !bankMatch && !isUnassignedBranch && merchant.bankId) {
        throw ApiError.notFound('Merchant profile not found or access denied for this executive.');
      }
    }

    if (!merchant.branchId && merchant.bankId) {
      const bankIdVal = typeof merchant.bankId === 'object' ? merchant.bankId._id : merchant.bankId;
      const defaultBranch = await Branch.findOne({ bankId: bankIdVal, isDeleted: { $ne: true } }).select("name code").lean();
      if (defaultBranch) {
        merchant.branchId = defaultBranch;
        MerchantProfile.updateOne({ _id: merchant._id }, { branchId: defaultBranch._id }).catch(() => {});
      }
    }

    const merchantBankId = merchant.bankId?._id || merchant.bankId;
    let societyLink = null;
    if (merchant.userId) {
      if (merchantBankId) {
        societyLink = await SocietyCustomerLink.findOne({
          userId: merchant.userId,
          bankId: merchantBankId,
          societyAccountNumber: { $ne: null }
        }).lean();
      }
      if (!societyLink) {
        societyLink = await SocietyCustomerLink.findOne({
          userId: merchant.userId,
          societyAccountNumber: { $ne: null }
        }).sort({ lastKycDate: -1, createdAt: -1 }).lean();
      }
    }

    let fallbackKyc = null;
    if (!merchant.aadhaarNumber || !merchant.panNumber || !merchant.documents?.ownerAadhaar || !merchant.documents?.ownerPan) {
      fallbackKyc = await resolveExistingCustomerKyc({
        phoneNumber: merchant.phoneNumber || merchant.primaryPhoneNumber,
        userId: merchant.userId,
      });

      const updateFields = {};
      if (!merchant.aadhaarNumber && fallbackKyc.aadhaarNumber) updateFields.aadhaarNumber = fallbackKyc.aadhaarNumber;
      if (!merchant.panNumber && fallbackKyc.panNumber) updateFields.panNumber = fallbackKyc.panNumber;
      if (!merchant.documents?.ownerAadhaar && fallbackKyc.ownerAadhaar) updateFields['documents.ownerAadhaar'] = fallbackKyc.ownerAadhaar;
      if (!merchant.documents?.ownerPan && fallbackKyc.ownerPan) updateFields['documents.ownerPan'] = fallbackKyc.ownerPan;

      if (Object.keys(updateFields).length > 0) {
        MerchantProfile.updateOne({ _id: merchant._id }, { $set: updateFields }).catch(err => {
          logger.warn(`[MERCHANT BACKFILL WARN]: ${err.message}`);
        });
      }
    }

    return this.formatMerchantDetails(merchant, null, societyLink, fallbackKyc);
  }
}

export const employeeMerchantService = new EmployeeMerchantService();
