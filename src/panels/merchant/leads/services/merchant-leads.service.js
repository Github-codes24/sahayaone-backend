import mongoose from 'mongoose';
import { User } from '../../../../models/user.model.js';
import { CustomerProfile } from '../../../../models/customer-profile.model.js';
import { Loan } from '../../../../models/loan.model.js';
import { Variant } from '../../../../models/variant.model.js';
import { TempOtp } from '../../../../models/temp-otp.model.js';
import { MerchantProfile } from '../../../../models/merchant-profile.model.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';
import { UserRole, UserType } from '../../../../constants/user-role.constant.js';
import { storageManager } from '../../../../storage/storage.manager.js';
import { logger } from '../../../../utils/logger.util.js';
import { generateOtp } from '../../../../utils/otp.util.js';
import { smsManager } from '../../../../sms/sms.manager.js';
import { paginationUtil } from '../../../../utils/pagination.util.js';
import { smsConfig } from '../../../../config/sms.config.js';
import { panelControlConfig, msg91TemplateConfig } from '../../../../config/panel-control.config.js';
import { BankAccount } from '../../../../models/bank-account.model.js';
import { EmiCard } from '../../../../models/emi-card.model.js';
import { processDocumentUpload } from '../../../employee/leads/services/leads.service.js';

const parseBase64ToMulterFile = (base64String, fieldName, identifier) => {
  if (!base64String || typeof base64String !== 'string') return null;

  let mimeType = 'image/jpeg';
  let base64Data = base64String;

  if (base64String.includes(';base64,')) {
    const parts = base64String.split(';base64,');
    mimeType = parts[0].replace('data:', '') || 'image/jpeg';
    base64Data = parts[1];
  }

  const buffer = Buffer.from(base64Data, 'base64');
  const ext = mimeType.split('/')[1] || 'jpg';
  
  return {
    originalname: `${fieldName}_${identifier}_${Date.now()}.${ext}`,
    buffer,
    mimetype: mimeType,
    size: buffer.length
  };
};

export class MerchantLeadsService {
  /**
   * Helper to resolve merchant profile
   */
  async getMerchantProfile(merchantUser) {
    if (!merchantUser) return null;
    let profile = null;
    if (merchantUser.merchantId) {
      profile = await MerchantProfile.findById(merchantUser.merchantId);
    }
    if (!profile && merchantUser.profileId) {
      profile = await MerchantProfile.findById(merchantUser.profileId);
    }
    if (!profile && merchantUser.id) {
      profile = await MerchantProfile.findOne({ userId: merchantUser.id });
    }
    return profile;
  }

  /**
   * 1. GET ALL LEADS ADDED BY THIS MERCHANT
   */
  async listLeads(merchantUser, queryParams = {}) {
    const {
      status,
      settlementStatus,
      search,
      state,
      city,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = queryParams;

    const merchantProfile = await this.getMerchantProfile(merchantUser);
    const merchantUserId = merchantUser?.id || merchantUser?._id;

    const filterCriteria = {
      $or: [
        { createdByMerchantId: merchantUserId },
        { createdByExecutiveId: merchantUserId },
        { createdBy: merchantUserId },
        ...(merchantProfile ? [{ merchantId: merchantProfile._id }] : [])
      ]
    };

    // 1. Status Filter
    if (status) {
      const upperStatus = status.trim().toUpperCase();
      if (upperStatus !== 'ALL' && upperStatus !== 'ALL LEADS') {
        filterCriteria.status = upperStatus;
      }
    }

    // 2. Settlement Status Filter
    if (settlementStatus && settlementStatus.trim().toUpperCase() !== 'ALL') {
      filterCriteria['merchantSettlement.settlementStatus'] = settlementStatus.trim().toUpperCase();
    }

    // 3. Date Range Filter (Supports startDate, endDate, or both)
    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (!isNaN(start.getTime())) dateFilter.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (!isNaN(end.getTime())) dateFilter.$lte = end;
      }
      if (Object.keys(dateFilter).length > 0) {
        filterCriteria.createdAt = dateFilter;
      }
    }

    // 4. Search Filter (Application Number, Customer Name, Phone, PAN, Aadhaar)
    let matchingCustomerIds = null;
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');

      const matchingUsers = await User.find({
        userType: UserType.CUSTOMER,
        $or: [
          { fullName: searchRegex },
          { phoneNumber: searchRegex }
        ]
      }).select('_id');

      const matchingProfiles = await CustomerProfile.find({
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { fullName: searchRegex },
          { panNumber: searchRegex },
          { aadhaarNumber: searchRegex }
        ]
      }).select('userId');

      matchingCustomerIds = [
        ...matchingUsers.map(u => u._id),
        ...matchingProfiles.map(p => p.userId)
      ];
    }

    // 5. Location Filters (State & City)
    let locationCustomerIds = null;
    if ((state && state.trim()) || (city && city.trim())) {
      const profileQuery = {};

      if (state && state.trim()) {
        const stateRegex = new RegExp(state.trim(), 'i');
        profileQuery.$or = [
          { 'activeAddress.state': stateRegex },
          { 'activeAddress.addressLine': stateRegex }
        ];
      }

      if (city && city.trim()) {
        const cityRegex = new RegExp(city.trim(), 'i');
        const cityCond = {
          $or: [
            { 'activeAddress.city': cityRegex },
            { 'activeAddress.district': cityRegex },
            { 'activeAddress.addressLine': cityRegex }
          ]
        };

        if (profileQuery.$or) {
          profileQuery.$and = [cityCond];
        } else {
          profileQuery.$or = cityCond.$or;
        }
      }

      const matchingLocProfiles = await CustomerProfile.find(profileQuery).select('userId');
      locationCustomerIds = matchingLocProfiles.map(p => p.userId);
    }

    // Combine search and location query conditions into filterCriteria
    const andConditions = [];

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      const searchConditions = [{ applicationId: searchRegex }, { customerPhoneNumber: searchRegex }];
      if (matchingCustomerIds && matchingCustomerIds.length > 0) {
        searchConditions.push({ customerId: { $in: matchingCustomerIds } });
      }
      andConditions.push({ $or: searchConditions });
    }

    if (locationCustomerIds !== null) {
      andConditions.push({ customerId: { $in: locationCustomerIds } });
    }

    if (andConditions.length > 0) {
      filterCriteria.$and = andConditions;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const skipCount = (pageNum - 1) * limitNum;
    const sortDirection = sortOrder.toLowerCase() === 'asc' ? 1 : -1;
    const sortObj = { [sortBy]: sortDirection, _id: sortDirection };

    const totalCount = await Loan.countDocuments(filterCriteria);
    const totalPages = Math.ceil(totalCount / limitNum) || 1;
    const pagination = {
      totalRecords: totalCount,
      totalItems: totalCount,
      limit: limitNum,
      pageSize: limitNum,
      page: pageNum,
      currentPage: pageNum,
      totalPages,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1
    };

    const loans = await Loan.find(filterCriteria)
      .populate({
        path: 'customerId',
        populate: { path: 'profileId' }
      })
      .populate({
        path: 'variantId',
        populate: { path: 'productId' }
      })
      .sort(sortObj)
      .skip(skipCount)
      .limit(limitNum);

    const phoneNumbers = [...new Set(loans.map(l => l.customerPhoneNumber || l.customerId?.phoneNumber).filter(Boolean))];
    const customerProfiles = await CustomerProfile.find({ phoneNumber: { $in: phoneNumbers } }).lean();
    const profileMap = new Map(customerProfiles.map(p => [p.phoneNumber, p]));

    const items = loans.map((loan) => {
      const customer = loan.customerId;
      const variant = loan.variantId;
      const product = variant?.productId;
      const phone = loan.customerPhoneNumber || customer?.phoneNumber || '';
      const profile = profileMap.get(phone) || customer?.profileId;
      
      let age = null;
      if (profile?.dob) {
        const ageDiff = Date.now() - new Date(profile.dob).getTime();
        age = Math.abs(new Date(ageDiff).getUTCFullYear() - 1970);
      }

      const netDisbursalLoanAmount = loan.totalLoanAmount || (loan.productPrice ? Math.max(0, loan.productPrice - (loan.downPayment || 0)) : 0);

      return {
        id: loan._id,
        loanId: loan._id,
        applicationId: loan.applicationId,
        status: loan.status,
        currentStep: loan.currentStep || 'COMPLETED',
        customerDetails: {
          customerId: customer?._id || profile?._id || null,
          fullName: profile?.fullName || (profile ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() : (customer?.fullName || 'Customer')),
          phoneNumber: phone,
          gender: profile?.gender || null,
          dob: profile?.dob || null,
          panNumber: profile?.panNumber || null,
          aadhaarNumber: profile?.aadhaarNumber || null,
          address: profile?.address || profile?.activeAddress?.addressLine || 'N/A',
          state: profile?.activeAddress?.state || 'N/A',
          city: profile?.activeAddress?.city || 'N/A',
          panImage: profile?.panImage || null,
          aadhaarImage: profile?.aadhaarImage || null,
          livePhoto: profile?.livePhoto || null
        },
        productDetails: {
          brandName: loan.productDetails?.brandName || product?.brand || 'N/A',
          modelName: loan.productDetails?.modelName || product?.name || 'Smart Phone',
          imeiNumber: loan.productDetails?.imeiNumber || null,
          productPrice: loan.productPrice || variant?.price || 0,
          productPhoto: loan.productDetails?.productPhoto || variant?.image || null,
          imeiPhoto: loan.productDetails?.imeiPhoto || null
        },
        financialDetails: {
          productPrice: loan.productPrice || 0,
          downPayment: loan.downPayment || 0,
          totalLoanAmount: loan.totalLoanAmount || 0,
          netDisbursalAmount: netDisbursalLoanAmount,
          emiAmount: loan.emiAmount || 0,
          tenureMonths: loan.tenureMonths || 0,
          financialChecksum: loan.antiTamperingChecksum || null
        },
        merchantDetails: {
          merchantId: merchantProfile?._id || loan.merchantId || null,
          shopName: merchantProfile?.shopName || merchantProfile?.businessDetails?.shopName || merchantUser?.shopName || 'N/A',
          merchantCode: merchantProfile?.merchantCode || null,
          ownerName: merchantProfile?.ownerName || null,
          phoneNumber: merchantProfile?.phoneNumber || null,
          email: merchantProfile?.email || null,
          address: merchantProfile?.address || null
        },
        settlementDetails: {
          settlementStatus: loan.merchantSettlement?.settlementStatus || (loan.status === 'APPROVED' || loan.status === 'ACTIVE' ? 'PENDING_BRANCH_PAYMENT' : 'PENDING'),
          netDisbursalAmount: netDisbursalLoanAmount,
          settledAt: loan.merchantSettlement?.settledAt || loan.disbursedAt || null,
          paymentTxnRef: loan.merchantSettlement?.paymentTxnRef || null,
          remarks: loan.merchantSettlement?.remarks || null
        },
        repaymentBankAccount: loan.repaymentBankAccount || null,
        mandateDetails: loan.mandateDetails || null,
        esignDetails: loan.esignDetails || null,
        createdAt: loan.createdAt,
        updatedAt: loan.updatedAt
      };
    });

    // 5. Calculate Merchant Lead Summary Stats
    const baseMerchantFilter = {
      $or: [
        { createdByMerchantId: merchantUserId },
        { createdByExecutiveId: merchantUserId },
        { createdBy: merchantUserId },
        ...(merchantProfile ? [{ merchantId: merchantProfile._id }] : [])
      ]
    };

    const statsAgg = await Loan.aggregate([
      { $match: baseMerchantFilter },
      {
        $group: {
          _id: {
            status: "$status",
            settlementStatus: "$merchantSettlement.settlementStatus"
          },
          count: { $sum: 1 },
          totalAmount: { $sum: { $ifNull: ["$productPrice", 0] } },
          totalNetDisbursal: { $sum: { $ifNull: ["$totalLoanAmount", 0] } }
        }
      }
    ]);

    let totalLeads = 0;
    let newLeads = 0;
    let pendingLeads = 0;
    let approvedLeads = 0;
    let activeLeads = 0;
    let completedLeads = 0;
    let rejectedLeads = 0;
    let totalBusinessVolume = 0;
    let pendingSettlementLeads = 0;
    let settledLeads = 0;
    let pendingSettlementAmount = 0;
    let totalSettledAmount = 0;

    statsAgg.forEach(s => {
      const cnt = s.count || 0;
      totalLeads += cnt;
      totalBusinessVolume += (s.totalAmount || 0);

      const st = (s._id?.status || '').toUpperCase();
      const setSt = (s._id?.settlementStatus || '').toUpperCase();

      if (setSt === 'SETTLED_BY_BRANCH') {
        settledLeads += cnt;
        totalSettledAmount += (s.totalNetDisbursal || 0);
      } else if (st === 'APPROVED' || st === 'ACTIVE' || setSt === 'PENDING_BRANCH_PAYMENT') {
        pendingSettlementLeads += cnt;
        pendingSettlementAmount += (s.totalNetDisbursal || 0);
      }

      if (st === 'NEW') newLeads += cnt;
      else if (st === 'PENDING_DOWN_PAYMENT' || st === 'PENDING' || st === 'PENDING_APPROVAL') pendingLeads += cnt;
      else if (st === 'APPROVED') approvedLeads += cnt;
      else if (st === 'ACTIVE') activeLeads += cnt;
      else if (st === 'COMPLETED') completedLeads += cnt;
      else if (st === 'REJECTED') rejectedLeads += cnt;
    });

    const stats = {
      totalLeads,
      newLeads,
      pendingLeads,
      approvedLeads,
      activeLeads,
      completedLeads,
      rejectedLeads,
      pendingSettlementLeads,
      settledLeads,
      totalBusinessVolume,
      pendingSettlementAmount,
      totalSettledAmount
    };

    return {
      success: true,
      stats,
      items,
      data: items,
      leads: items,
      pagination,
      meta: pagination,
      totalCount: pagination.totalRecords,
      totalRecords: pagination.totalRecords,
      message: 'Merchant leads fetched successfully.'
    };
  }

  /**
   * 2. SEND PHONE VERIFICATION OTP CODE (LOOKUP)
   */
  async sendLookupOtp(phoneNumber) {
    const isLiveOtp = panelControlConfig.MERCHANT_PANEL?.OTP === 'LIVE';
    const otp = isLiveOtp ? generateOtp(6, { numericOnly: true }) : '123456';
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await TempOtp.findOneAndUpdate(
      { phoneNumber },
      { otp, expiresAt },
      { upsert: true, new: true }
    );

    logger.info(`MERCHANT CUSTOMER OTP DISPATCH: Phone check OTP code [${otp}] generated for: ${phoneNumber}`);
    if (isLiveOtp) {
      await smsManager.sendOtp(phoneNumber, otp, msg91TemplateConfig.CUSTOMER_PANEL.LOOKUP_OTP);
    }

    return {
      success: true,
      message: `Verification code successfully dispatched to customer mobile ending in ${phoneNumber.slice(-4)}.`,
      ...(!isLiveOtp ? { otp } : {})
    };
  }

  /**
   * 3. SUBMIT PHONE VERIFICATION OTP (LOOKUP)
   */
  async verifyLookupOtp(phoneNumber, otp) {
    const isTestMode =
      panelControlConfig.MERCHANT_PANEL?.OTP === 'TEST' ||
      panelControlConfig.CUSTOMER_PANEL?.OTP === 'TEST' ||
      panelControlConfig.EMPLOYEE_PANEL?.OTP === 'TEST';
    const isTestMock = isTestMode && otp === '123456';
    
    if (!isTestMock) {
      const record = await TempOtp.findOne({ phoneNumber, otp });
      if (!record || record.expiresAt < new Date()) {
        throw ApiError.badRequest('The verification code is incorrect or expired.', ErrorCode.OTP_INVALID);
      }
    }

    await TempOtp.deleteOne({ phoneNumber });

    const user = await User.findOne({ phoneNumber, userType: UserType.CUSTOMER }).populate('profileId');
    if (!user) {
      return {
        success: true,
        verified: true,
        exists: false,
        customerId: null,
        phoneNumber: phoneNumber || null,
        fullName: null,
        firstName: null,
        lastName: null,
        status: null,
        kycStatus: null,
        gender: null,
        dob: null,
        panNumber: null,
        aadhaarNumber: null,
        panImage: null,
        aadhaarImage: null,
        profileImage: null,
        address: null,
        pinCode: null,
        currentPinCode: null,
        fullAddress: null,
        documents: {
          panImage: null,
          aadhaarImage: null,
          profileImage: null
        },
        profileDetails: null,
        draftLoan: null,
        message: 'OTP verified successfully. Proceed to onboarding new customer.'
      };
    }

    const profile = user.profileId;
    const draftLoan = await Loan.findOne({
      customerId: user._id,
      status: { $in: ['NEW', 'PENDING_DOWN_PAYMENT'] }
    });

    const firstName = profile?.firstName || (user.fullName ? user.fullName.split(' ')[0] : null);
    const lastName = profile?.lastName || (user.fullName ? user.fullName.split(' ').slice(1).join(' ') : null);
    const fullName = profile ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || user.fullName || null : user.fullName || null;
    const formattedDob = profile?.dob ? (typeof profile.dob === 'string' ? profile.dob : profile.dob.toISOString().split('T')[0]) : null;
    const panNumber = profile?.panNumber || null;
    const aadhaarNumber = profile?.aadhaarNumber || null;
    const panImage = profile?.panImage || null;
    const aadhaarImage = profile?.aadhaarImage || null;
    const profileImage = profile?.profileImage || profile?.avatar || null;
    const addressLine = profile?.activeAddress?.addressLine || null;
    const pinCode = profile?.activeAddress?.pinCode || profile?.currentPinCode || null;
    const fullAddress = addressLine ? `${addressLine}${pinCode ? `, ${pinCode}` : ''}` : null;

    return {
      success: true,
      verified: true,
      exists: true,
      customerId: user._id,
      phoneNumber: user.phoneNumber || phoneNumber,
      fullName,
      firstName,
      lastName,
      status: user.status || 'ACTIVE',
      kycStatus: profile?.kycStatus || 'VERIFIED',
      gender: profile?.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1).toLowerCase() : null,
      dob: formattedDob,
      panNumber,
      aadhaarNumber,
      panImage,
      aadhaarImage,
      profileImage,
      address: addressLine,
      pinCode,
      currentPinCode: pinCode,
      fullAddress,
      documents: {
        panImage,
        aadhaarImage,
        profileImage
      },
      profileDetails: profile ? {
        firstName,
        lastName,
        fullName,
        phoneNumber: user.phoneNumber || phoneNumber,
        gender: profile.gender || null,
        dob: formattedDob,
        panNumber,
        aadhaarNumber,
        panImage,
        aadhaarImage,
        profileImage,
        address: addressLine,
        pinCode,
        currentPinCode: pinCode,
        fullAddress
      } : null,
      draftLoan: draftLoan ? {
        leadId: draftLoan._id,
        currentStep: draftLoan.currentStep || null,
        status: draftLoan.status || null
      } : null,
      message: 'Mobile number successfully verified. Existing customer profile found.'
    };
  }

  /**
   * 4. INITIATE ONBOARDING (Aadhaar OTP Dispatch)
   */
  async onboardCustomerRequest(payload, merchantUser) {
    const { phoneNumber, panNumber, aadhaarNumber } = payload;

    const existingUser = await User.findOne({ phoneNumber, userType: UserType.CUSTOMER });
    if (existingUser) {
      throw ApiError.badRequest(
        'This mobile number is already registered as an active customer in our system.',
        ErrorCode.CUSTOMER_DUPLICATE_MOBILE
      );
    }

    const duplicatePan = await CustomerProfile.findOne({ panNumber });
    if (duplicatePan) {
      throw ApiError.badRequest(
        'A customer account is already registered with this PAN card.',
        ErrorCode.CUSTOMER_DUPLICATE_PAN
      );
    }

    const duplicateAadhaar = await CustomerProfile.findOne({ aadhaarNumber });
    if (duplicateAadhaar) {
      throw ApiError.badRequest(
        'A customer account is already registered with this Aadhaar identity.',
        ErrorCode.CUSTOMER_DUPLICATE_AADHAAR
      );
    }

    const isLiveOtp = panelControlConfig.CUSTOMER_PANEL.OTP === 'LIVE' || panelControlConfig.EMPLOYEE_PANEL.OTP === 'LIVE';
    const otp = isLiveOtp ? generateOtp(6, { numericOnly: true }) : '123456';
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const transactionId = `txn_aadhaar_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    await TempOtp.findOneAndUpdate(
      { phoneNumber },
      { otp, expiresAt, metadata: { transactionId, aadhaarNumber, panNumber } },
      { upsert: true, new: true }
    );

    logger.info(`MERCHANT AADHAAR OTP DISPATCH: Aadhaar verification code [${otp}] generated for: ${phoneNumber} (Txn: ${transactionId})`);
    await smsManager.sendOtp(phoneNumber, otp, msg91TemplateConfig.CUSTOMER_PANEL.VERIFY_MOBILE_OTP);

    return {
      success: true,
      transactionId,
      message: 'Aadhaar verification OTP sent to registered mobile number.',
      ...(!isLiveOtp ? { otp } : {})
    };
  }

  /**
   * 5. VERIFY AADHAAR OTP
   */
  async verifyAadhaarOtp(phoneNumber, transactionId, otp) {
    const isTestMock = otp === '123456' && (panelControlConfig.CUSTOMER_PANEL.OTP === 'TEST' || panelControlConfig.EMPLOYEE_PANEL.OTP === 'TEST');

    if (!isTestMock) {
      const record = await TempOtp.findOne({ phoneNumber, otp });
      if (!record || record.expiresAt < new Date()) {
        throw ApiError.badRequest('The verification code is incorrect or expired.', ErrorCode.OTP_INVALID);
      }
      if (record.metadata?.transactionId && record.metadata.transactionId !== transactionId) {
        throw ApiError.badRequest('Transaction identifier mismatch or expired session.', ErrorCode.OTP_INVALID);
      }
    }

    return {
      success: true,
      addressLine: 'Pimpri Chinchwad, Pune, 411061',
      pinCode: '411061',
      message: 'Aadhaar identity verified successfully.'
    };
  }

  /**
   * 6. CONFIRM ONBOARDING
   */
  async confirmOnboard(payload, merchantUser) {
    const {
      fullName,
      gender,
      dob,
      phoneNumber,
      panNumber,
      panImage,
      aadhaarNumber,
      aadhaarImage,
      addressLine,
      pinCode
    } = payload;

    const existingUser = await User.findOne({ phoneNumber, userType: UserType.CUSTOMER });
    if (existingUser) {
      throw ApiError.badRequest('This customer mobile number is already registered in the system.', ErrorCode.CUSTOMER_DUPLICATE_MOBILE);
    }

    const merchantProfile = await this.getMerchantProfile(merchantUser);

    // Extract document image payloads flexible across field aliases
    const rawPan = payload.panImage || payload.panCardUrl || payload.panCardImage || payload.pan;
    const rawAadhaar = payload.aadhaarImage || payload.aadhaarCardUrl || payload.aadhaarCardImage || payload.aadhaar;
    const rawSig = payload.signatureImage || payload.digitalSignature || payload.signature;

    const panImageUrl = (await processDocumentUpload(rawPan, 'pan_doc', phoneNumber, 'customers')) ||
                        'https://sahayaone-backend.onrender.com/public/mocks/doc-pan.png';

    const aadhaarImageUrl = (await processDocumentUpload(rawAadhaar, 'aadhaar_doc', phoneNumber, 'customers')) ||
                            'https://sahayaone-backend.onrender.com/public/mocks/doc-aadhaar.png';

    const signatureUrl = await processDocumentUpload(rawSig, 'signature', phoneNumber, 'customers');

    const nameParts = fullName.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '.';

    const mUser = await User.findById(merchantUser.id);
    const onboardedByData = {
      id: merchantProfile?._id || merchantUser.id,
      userId: merchantUser.id,
      name: merchantProfile?.ownerName || merchantProfile?.fullName || mUser?.fullName || merchantProfile?.shopName || 'Merchant',
      shopName: merchantProfile?.shopName || merchantProfile?.businessDetails?.shopName || 'Merchant Shop',
      phone: merchantProfile?.phoneNumber || mUser?.phoneNumber || '',
      email: merchantProfile?.email || mUser?.email || '',
      role: 'MERCHANT',
      type: 'MERCHANT',
      merchantId: merchantProfile?._id || null
    };

    // Create User record
    const user = new User({
      fullName,
      phoneNumber,
      userType: UserType.CUSTOMER,
      role: UserRole.CUSTOMER,
      isPhoneVerified: true,
      onboardingSource: 'MERCHANT',
      createdBy: merchantUser.id,
      onboardedBy: onboardedByData
    });
    await user.save();

    // Create CustomerProfile record tagged with merchant
    const customerProfile = new CustomerProfile({
      userId: user._id,
      firstName,
      lastName,
      gender,
      dob: new Date(dob),
      panNumber,
      panImage: panImageUrl,
      aadhaarNumber,
      aadhaarImage: aadhaarImageUrl,
      signatureImage: signatureUrl || null,
      kycStatus: 'VERIFIED',
      activeAddress: {
        addressLine,
        pinCode,
        isVerified: true
      },
      onboardingSource: 'MERCHANT',
      createdByMerchantId: merchantUser.id,
      createdById: merchantUser.id,
      merchantId: merchantProfile?._id || null,
      onboardedBy: onboardedByData
    });
    await customerProfile.save();

    user.profileId = customerProfile._id;
    user.profileModel = 'CustomerProfile';
    await user.save();

    await TempOtp.deleteOne({ phoneNumber });

    logger.info(`MERCHANT CUSTOMER ONBOARDED: Customer ${fullName} (${phoneNumber}) registered successfully by Merchant ID: ${merchantUser.id}`);

    const usedMockImage = panImageUrl.includes('/mocks/') || aadhaarImageUrl.includes('/mocks/');
    const responseMessage = usedMockImage
      ? 'Customer registered successfully. Mock document image uploaded.'
      : 'Customer registered and verified successfully.';

    return {
      success: true,
      customerId: user._id,
      onboardingSource: 'MERCHANT',
      onboardedBy: onboardedByData,
      isMockImageUploaded: usedMockImage,
      message: responseMessage
    };
  }

  /**
   * 10. CREATE DRAFT LEAD APPLICATION
   */
  async createLead(payload, merchantUser) {
    const { customerId, variantId } = payload;

    const customer = await User.findOne({ _id: customerId, userType: UserType.CUSTOMER });
    if (!customer) {
      throw ApiError.notFound('Customer identity not found in records.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const variant = await Variant.findById(variantId).populate('productId');
    if (!variant) {
      throw ApiError.notFound('Selected product variant not found in catalog.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const merchantProfile = await this.getMerchantProfile(merchantUser);
    const mUser = await User.findById(merchantUser.id);
    const applicationId = `ADVT-M-${Date.now().toString().slice(-6)}`;
    const productPrice = variant.price || 0;

    const creatorDetails = {
      id: merchantProfile?._id || merchantUser.id,
      userId: merchantUser.id,
      name: merchantProfile?.ownerName || merchantProfile?.fullName || mUser?.fullName || 'Merchant',
      shopName: merchantProfile?.shopName || merchantProfile?.businessDetails?.shopName || 'Merchant Shop',
      phone: merchantProfile?.phoneNumber || mUser?.phoneNumber || '',
      email: merchantProfile?.email || mUser?.email || '',
      role: 'MERCHANT',
      type: 'MERCHANT',
      merchantId: merchantProfile?._id || null,
      bankId: merchantProfile?.bankId || null,
      branchId: merchantProfile?.branchId || null
    };

    const loan = new Loan({
      applicationId,
      customerId: customer._id,
      variantId: variant._id,
      status: 'NEW',
      currentStep: 'SLABS',
      productPrice,
      totalAmount: productPrice,
      totalLoanAmount: productPrice,
      downPayment: 0,
      interestAmount: 0,
      insuranceAmount: 0,
      totalPayableAmount: productPrice,
      emiAmount: 0,
      tenureMonths: 0,
      outstandingAmount: productPrice,
      merchantId: merchantProfile?._id || null,
      assignedBankId: merchantProfile?.bankId || null,
      branchId: merchantProfile?.branchId || null,
      createdBy: merchantUser.id,
      createdByMerchantId: merchantUser.id,
      createdByExecutiveId: merchantUser.id,
      createdByDetails: creatorDetails,
      sourceType: 'MERCHANT'
    });

    await loan.save();

    logger.info(`MERCHANT LEAD CREATED: Lead [${applicationId}] created for customer ${customer.fullName} by Merchant: ${merchantUser.id}`);

    return {
      success: true,
      leadId: loan._id,
      applicationId: loan.applicationId,
      sourceType: 'MERCHANT',
      createdBy: creatorDetails,
      message: 'Draft lead application successfully created.'
    };
  }

  /**
   * 11. GET LEAD DETAILS (SINGLE LEAD)
   */
  async getLeadDetails(merchantUser, leadId) {
    const merchantProfile = await this.getMerchantProfile(merchantUser);
    const merchantUserId = merchantUser?.id;

    const loan = await Loan.findOne({
      _id: leadId,
      $or: [
        { createdByMerchantId: merchantUserId },
        { createdByExecutiveId: merchantUserId },
        ...(merchantProfile ? [{ merchantId: merchantProfile._id }] : [])
      ]
    })
      .populate({
        path: 'customerId',
        populate: { path: 'profileId' }
      })
      .populate({
        path: 'variantId',
        populate: { path: 'productId', select: 'name brandId description' }
      });

    if (!loan) {
      throw ApiError.notFound('Lead application not found or unauthorized for this merchant.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const customer = loan.customerId;
    const variant = loan.variantId;
    const product = variant?.productId;
    let profile = customer?.profileId;
    if (!profile || typeof profile === 'string' || profile instanceof mongoose.Types.ObjectId || !profile.firstName) {
      if (customer?._id) {
        profile = await CustomerProfile.findOne({ userId: customer._id });
        if (profile) {
          await User.updateOne(
            { _id: customer._id, profileModel: { $ne: 'CustomerProfile' } },
            { $set: { profileId: profile._id, profileModel: 'CustomerProfile' } }
          );
        }
      }
    }

    // Fetch existing primary bank account
    let bankInfo = null;
    if (loan.repaymentBankAccount?.accountNumber) {
      bankInfo = {
        bankName: loan.repaymentBankAccount.bankName,
        accountNumber: loan.repaymentBankAccount.accountNumber,
        ifsc: loan.repaymentBankAccount.ifsc,
        accountHolder: loan.repaymentBankAccount.accountHolder
      };
    } else if (customer) {
      const primaryBank = await BankAccount.findOne({ userId: customer._id, isPrimary: true, isDeleted: false });
      if (primaryBank) {
        bankInfo = {
          bankName: primaryBank.bankName,
          accountNumber: primaryBank.accountNumber,
          ifsc: primaryBank.ifsc,
          accountHolder: primaryBank.accountHolder
        };
      }
    }

    // Fetch existing EMI card details
    let cardInfo = { exists: false, expired: false };
    if (customer) {
      const card = await EmiCard.findOne({ customerId: customer._id }).populate('bankId');
      if (card) {
        const isExpired = card.status === 'EXPIRED' || (card.validThru && isCardExpired(card.validThru));
        cardInfo = {
          exists: true,
          expired: isExpired,
          cardNumber: maskCardNumber(card.cardNumber),
          cardHolderName: card.cardHolderName,
          validThru: card.validThru,
          brandLogo: "https://sahayaone-backend.onrender.com/public/mocks/logo-sahayaone.png",
          bankLogo: card.bankId?.logo || "https://sahayaone-backend.onrender.com/public/mocks/logo-society.png"
        };
      }
    }

    const customerIdVal = customer?._id || loan.customerId || null;
    const phone = loan.customerPhoneNumber || customer?.phoneNumber || '';
    const netDisbursalLoanAmount = loan.totalLoanAmount || (loan.productPrice ? Math.max(0, loan.productPrice - (loan.downPayment || 0)) : 0);

    return {
      success: true,
      data: {
        id: loan._id,
        loanId: loan._id,
        applicationId: loan.applicationId,
        customerId: customerIdVal,
        status: loan.status,
        currentStep: loan.currentStep || 'COMPLETED',
        customerDetails: {
          customerId: customerIdVal,
          fullName: profile?.fullName || ((profile && (profile.firstName || profile.lastName)) ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() : (customer?.fullName || 'Customer')),
          phoneNumber: phone,
          gender: profile?.gender || null,
          dob: profile?.dob || null,
          panNumber: profile?.panNumber || null,
          aadhaarNumber: profile?.aadhaarNumber || null,
          address: profile?.address || profile?.activeAddress?.addressLine || 'N/A',
          state: profile?.activeAddress?.state || 'N/A',
          city: profile?.activeAddress?.city || 'N/A',
          panImage: profile?.panImage || null,
          aadhaarImage: profile?.aadhaarImage || null,
          livePhoto: profile?.livePhoto || null
        },
        productDetails: {
          brandName: loan.productDetails?.brandName || product?.brand || 'N/A',
          modelName: loan.productDetails?.modelName || product?.name || 'Smart Phone',
          imeiNumber: loan.productDetails?.imeiNumber || null,
          productPrice: loan.productPrice || variant?.price || 0,
          productPhoto: loan.productDetails?.productPhoto || variant?.image || null,
          imeiPhoto: loan.productDetails?.imeiPhoto || null
        },
        financialDetails: {
          productPrice: loan.productPrice || 0,
          downPayment: loan.downPayment || 0,
          totalLoanAmount: loan.totalLoanAmount || 0,
          netDisbursalAmount: netDisbursalLoanAmount,
          emiAmount: loan.emiAmount || 0,
          tenureMonths: loan.tenureMonths || 0,
          financialChecksum: loan.antiTamperingChecksum || null
        },
        merchantDetails: {
          merchantId: merchantProfile?._id || loan.merchantId || null,
          shopName: merchantProfile?.shopName || merchantProfile?.businessDetails?.shopName || merchantUser?.shopName || 'N/A',
          merchantCode: merchantProfile?.merchantCode || null,
          ownerName: merchantProfile?.ownerName || null,
          phoneNumber: merchantProfile?.phoneNumber || null,
          email: merchantProfile?.email || null,
          address: merchantProfile?.address || null
        },
        settlementDetails: {
          settlementStatus: loan.merchantSettlement?.settlementStatus || (loan.status === 'APPROVED' || loan.status === 'ACTIVE' ? 'PENDING_BRANCH_PAYMENT' : 'PENDING'),
          netDisbursalAmount: netDisbursalLoanAmount,
          settledAt: loan.merchantSettlement?.settledAt || loan.disbursedAt || null,
          paymentTxnRef: loan.merchantSettlement?.paymentTxnRef || null,
          remarks: loan.merchantSettlement?.remarks || null
        },
        repaymentBankAccount: loan.repaymentBankAccount || bankInfo || null,
        mandateDetails: loan.mandateDetails || null,
        esignDetails: loan.esignDetails || null,
        createdAt: loan.createdAt,
        updatedAt: loan.updatedAt
      },
      message: 'Lead details fetched successfully.'
    };
  }
}

export const merchantLeadsService = new MerchantLeadsService();
