import { User } from '../../../../models/user.model.js';
import { CustomerProfile } from '../../../../models/customer-profile.model.js';
import { SocietyCustomerLink } from '../../../../models/society-customer-link.model.js';
import { Loan } from '../../../../models/loan.model.js';
import { PigmyCustomer } from '../../../../models/pigmy-customer.model.js';
import { MerchantProfile } from '../../../../models/merchant-profile.model.js';
import '../../../../models/bank.model.js';
import '../../../../models/branch.model.js';
import '../../../../models/product.model.js';
import '../../../../models/brand.model.js';
import '../../../../models/variant.model.js';
import { cryptoUtil } from '../../../../utils/crypto.util.js';
import { jwtUtil } from '../../../../utils/jwt.util.js';
import { ApiError } from '../../../../common/api.error.js';
import { UserRole, UserType } from '../../../../constants/user-role.constant.js';
import { logger } from '../../../../utils/logger.util.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';
import { envConfig } from '../../../../config/env.config.js';
import { smsManager } from '../../../../sms/sms.manager.js';
import { generateOtp } from '../../../../utils/otp.util.js';
import { smsConfig } from '../../../../config/sms.config.js';
import { panelControlConfig } from '../../../../config/panel-control.config.js';

export class CustomerMobileAuthService {
  /**
   * Helper to normalize phone number to clean 10 digits
   */
  normalizePhone(phone) {
    return String(phone || '').replace(/\D/g, '').slice(-10);
  }

  /**
   * Authoritative helper to retrieve rich customer data across all Sahayaone banks, loans, and pigmy accounts.
   * If customer was onboarded (e.g. 8999230839), fetches all real onboarding data.
   * If customer has no onboarding details yet, marks them as Guest (allowed in without KYC).
   */
  async getEnrichedCustomerData(user, rawPhone = null) {
    if (!user && !rawPhone) return null;

    const cleanPhone = this.normalizePhone(user?.phoneNumber || rawPhone);

    // 1. Fetch User document
    let userDoc = user;
    if (!userDoc && cleanPhone) {
      userDoc = await User.findOne({
        $or: [
          { phoneNumber: cleanPhone },
          { phoneNumber: `+91${cleanPhone}` },
          { phoneNumber: `91${cleanPhone}` }
        ],
        isDeleted: { $ne: true }
      });
    }

    // 2. Fetch CustomerProfile (where onboarding saves all customer identity & KYC details)
    let profile = null;
    if (userDoc?.profileId) {
      profile = await CustomerProfile.findById(userDoc.profileId).lean();
    }
    if (!profile && userDoc?._id) {
      profile = await CustomerProfile.findOne({ userId: userDoc._id }).lean();
    }
    if (!profile && cleanPhone) {
      profile = await CustomerProfile.findOne({
        $or: [
          { phoneNumber: cleanPhone },
          { phoneNumber: `+91${cleanPhone}` }
        ]
      }).lean();
    }
    profile = profile || {};

    // 3. Fetch linked Banks & Societies from SocietyCustomerLink
    const candidateIds = [
      ...(userDoc?._id ? [userDoc._id] : []),
      ...(profile?._id ? [profile._id] : [])
    ];

    const societyLinks = await SocietyCustomerLink.find({
      $or: [
        { userId: { $in: candidateIds } },
        { customerId: { $in: candidateIds.map(String) } },
        ...(cleanPhone ? [{ phoneNumber: cleanPhone }] : [])
      ],
      isDeleted: { $ne: true }
    })
      .populate({ path: 'bankId', strictPopulate: false })
      .populate({ path: 'branchId', strictPopulate: false })
      .lean();

    // 4. Fetch Loans across ALL banks
    const loanQueryConditions = [
      { customerId: { $in: candidateIds } }
    ];
    if (cleanPhone) {
      loanQueryConditions.push({ customerPhoneNumber: cleanPhone });
    }
    const loans = await Loan.find({
      $or: loanQueryConditions,
      isDeleted: { $ne: true }
    })
      .populate({ path: 'assignedBankId', strictPopulate: false })
      .populate({ path: 'branchId', strictPopulate: false })
      .populate({
        path: 'variantId',
        populate: {
          path: 'productId',
          populate: { path: 'brandId' }
        },
        strictPopulate: false
      })
      .sort({ createdAt: -1 })
      .lean();

    // 5. Fetch Pigmy accounts across ALL banks (Individual & Merchant Pigmy)
    const pigmyAccounts = await PigmyCustomer.find({
      $or: [
        { userId: { $in: candidateIds } },
        ...(cleanPhone ? [{ phoneNumber: cleanPhone }, { primaryPhoneNumber: cleanPhone }] : [])
      ],
      isDeleted: { $ne: true }
    })
      .populate({ path: 'bankId', strictPopulate: false })
      .populate({ path: 'branchId', strictPopulate: false })
      .sort({ createdAt: -1 })
      .lean();

    // 5b. Fetch Merchant Profile if user operates as a merchant
    const merchantProfile = cleanPhone
      ? await MerchantProfile.findOne({
          $or: [
            { phoneNumber: cleanPhone },
            { primaryPhoneNumber: cleanPhone },
            ...(userDoc?._id ? [{ userId: userDoc._id }] : [])
          ],
          isDeleted: { $ne: true }
        }).lean()
      : null;

    // 6. Check Guest status:
    // If user has no KYC documents and no real name saved in the system -> Guest
    const hasRealName = profile.firstName &&
      profile.firstName !== 'New' &&
      profile.firstName.toLowerCase() !== 'guest' &&
      profile.firstName.trim().length > 0;

    const hasKycOrDocs = profile.panNumber || profile.aadhaarNumber || profile.kycStatus === 'VERIFIED';
    const isGuest = !hasRealName && !hasKycOrDocs;

    const resolvedFullName = isGuest
      ? 'Guest'
      : (userDoc?.fullName ||
         (profile.firstName ? `${profile.firstName} ${profile.lastName || ''}`.trim() : null) ||
         'Guest');

    const resolvedFirstName = isGuest ? 'Guest' : (profile.firstName || resolvedFullName.split(' ')[0] || 'Guest');
    const resolvedLastName = isGuest ? '' : (profile.lastName || resolvedFullName.split(' ').slice(1).join(' ') || '');

    // Collect all associated bank summaries
    const banksMap = new Map();

    // From SocietyCustomerLink
    societyLinks.forEach(l => {
      const bId = l.bankId?._id?.toString() || l.bankId?.toString();
      if (bId && !banksMap.has(bId)) {
        banksMap.set(bId, {
          bankId: bId,
          bankName: l.bankId?.name || l.bankId?.bankName || l.societyName || 'Bank',
          branchId: l.branchId?._id || l.branchId || null,
          branchName: l.branchId?.name || l.branchId?.branchName || 'Branch',
          accountNumber: l.societyAccountNumber || null
        });
      }
    });

    // From Loans
    loans.forEach(l => {
      const bankObj = l.assignedBankId || l.bankId;
      const bId = bankObj?._id?.toString() || bankObj?.toString();
      if (bId && !banksMap.has(bId)) {
        banksMap.set(bId, {
          bankId: bId,
          bankName: bankObj?.name || bankObj?.bankName || 'Bank',
          branchId: l.branchId?._id || l.branchId || null,
          branchName: l.branchId?.name || l.branchId?.branchName || 'Branch'
        });
      }
    });

    // From Pigmy
    pigmyAccounts.forEach(p => {
      const bId = p.bankId?._id?.toString() || p.bankId?.toString();
      if (bId && !banksMap.has(bId)) {
        banksMap.set(bId, {
          bankId: bId,
          bankName: p.bankName || p.bankId?.name || p.bankId?.bankName || 'Bank',
          branchId: p.branchId?._id || p.branchId || null,
          branchName: p.branchName || p.branchId?.name || p.branchId?.branchName || 'Branch'
        });
      }
    });

    // Active loan metrics
    const activeLoans = loans.filter(l => ['NEW', 'ACTIVE', 'DISBURSED', 'PENDING'].includes(l.status));
    const totalOutstanding = activeLoans.reduce((sum, l) => sum + (l.outstandingAmount || 0), 0);
    const totalLoanAmount = activeLoans.reduce((sum, l) => sum + (l.totalPayableAmount || l.loanAmount || 0), 0);

    return {
      userId: userDoc?._id || profile.userId || null,
      id: userDoc?._id || profile.userId || null,
      _id: userDoc?._id || profile.userId || null,
      phoneNumber: userDoc?.phoneNumber || profile.phoneNumber || cleanPhone,
      isGuest,
      fullName: resolvedFullName,
      firstName: resolvedFirstName,
      lastName: resolvedLastName,
      email: userDoc?.email || profile.email || null,
      role: 'CUSTOMER',
      userType: 'CUSTOMER',
      status: userDoc?.status || 'ACTIVE',
      kycStatus: isGuest ? 'PENDING' : (profile.kycStatus || 'PENDING'),
      creditScore: profile.creditScore || null,
      cibilStatus: profile.cibilStatus || null,
      cibilReportUrl: profile.cibilReportUrl || null,
      customerUniqueId: profile.customerUniqueId || userDoc?.customerUniqueId || null,
      panNumber: profile.panNumber || null,
      aadhaarNumber: profile.aadhaarNumber || null,
      livePhoto: profile.livePhoto || profile.profileImage || null,
      avatar: profile.livePhoto || profile.profileImage || profile.avatar || null,
      panImage: profile.panImage || null,
      aadhaarImage: profile.aadhaarImage || null,
      activeAddress: profile.activeAddress || null,
      residentialPincode: profile.residentialPincode || profile.currentPinCode || null,
      gender: profile.gender || null,
      dob: profile.dob || null,
      onboardingSource: profile.onboardingSource || userDoc?.onboardingSource || (isGuest ? 'SELF' : 'EXECUTIVE'),
      onboardedBy: profile.onboardedBy || userDoc?.onboardedBy || null,
      mpinConfigured: !!userDoc?.mpinHash,
      isMpinSet: !!userDoc?.mpinHash,
      profileId: profile._id || userDoc?.profileId || null,
      // Role & Merchant indicators
      isMerchant: !!merchantProfile,
      hasLoans: loans.length > 0,
      loansCount: loans.length,
      hasPigmy: pigmyAccounts.length > 0,
      pigmyAccountsCount: pigmyAccounts.length,
      associatedBanksCount: banksMap.size
    };
  }

  /**
   * Evaluates if a customer mobile exists; registers as Guest without KYC if not, and sends OTP
   */
  async verifyMobile(phoneNumber) {
    const cleanPhone = this.normalizePhone(phoneNumber);
    if (!cleanPhone || cleanPhone.length !== 10) {
      throw ApiError.badRequest('Phone number must be a valid 10-digit mobile number');
    }

    let user = await User.findOne({
      $or: [
        { phoneNumber: cleanPhone },
        { phoneNumber: `+91${cleanPhone}` },
        { phoneNumber: `91${cleanPhone}` }
      ],
      isDeleted: { $ne: true }
    });

    // If user doesn't exist, create customer without KYC (Guest)
    if (!user) {
      const existingProfile = await CustomerProfile.findOne({
        $or: [
          { phoneNumber: cleanPhone },
          { phoneNumber: `+91${cleanPhone}` }
        ]
      });

      const random9Digits = Math.floor(100000000 + Math.random() * 900000000);
      const customerUniqueId = existingProfile?.customerUniqueId || `ADV-${random9Digits}`;

      user = new User({
        phoneNumber: cleanPhone,
        role: UserRole.CUSTOMER,
        userType: UserType.CUSTOMER,
        status: 'ACTIVE',
        customerUniqueId,
        onboardingSource: 'SELF',
        fullName: existingProfile?.firstName ? `${existingProfile.firstName} ${existingProfile.lastName || ''}`.trim() : 'Guest',
        createdBy: null,
        onboardedBy: {
          id: null,
          userId: null,
          name: 'Self Onboarding',
          phone: cleanPhone,
          role: 'CUSTOMER',
          type: 'SELF'
        }
      });
      await user.save();

      const selfOnboardedBy = {
        id: user._id,
        userId: user._id,
        name: 'Self Onboarding',
        phone: cleanPhone,
        role: 'CUSTOMER',
        type: 'SELF'
      };
      user.onboardedBy = selfOnboardedBy;

      let profile = existingProfile;
      if (!profile) {
        profile = new CustomerProfile({
          userId: user._id,
          phoneNumber: cleanPhone,
          firstName: 'Guest',
          lastName: '',
          kycStatus: 'PENDING',
          customerUniqueId,
          onboardingSource: 'SELF',
          createdByExecutiveId: null,
          createdByMerchantId: null,
          createdById: null,
          onboardedBy: selfOnboardedBy
        });
        await profile.save();
      } else {
        profile.userId = user._id;
        await profile.save();
      }

      user.profileId = profile._id;
      user.profileModel = 'CustomerProfile';
      await user.save();

      logger.info(`CUSTOMER AUTH: Registered new customer identity for phone: ${cleanPhone} [Self-Onboarded as Guest]`);
    } else {
      // Ensure profile link
      if (!user.profileId) {
        const profile = await CustomerProfile.findOne({
          $or: [{ userId: user._id }, { phoneNumber: cleanPhone }]
        });
        if (profile) {
          user.profileId = profile._id;
          user.profileModel = 'CustomerProfile';
          await user.save();
        }
      }
    }

    // 2. Generate and dispatch verification OTP
    const isLiveOtp = panelControlConfig.CUSTOMER_PANEL.OTP === 'LIVE';
    const otp = isLiveOtp ? generateOtp(6, { numericOnly: true }) : '123456';
    user.tempOtp = otp;
    user.tempOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
    await user.save();

    logger.info(`CUSTOMER MOBILE AUTH: Dispatching login OTP to phone ${cleanPhone} -> [${otp}] (OTP Mode: ${panelControlConfig.CUSTOMER_PANEL.OTP})`);
    if (isLiveOtp) {
      await smsManager.sendOtp(
        cleanPhone,
        otp,
        smsConfig.templates.CUSTOMER_LOGIN_OTP.templateId,
        { var1: otp, var2: '10' }
      );
    }

    const enriched = await this.getEnrichedCustomerData(user);

    return {
      registered: !enriched.isGuest,
      isGuest: enriched.isGuest,
      name: enriched.fullName,
      fullName: enriched.fullName,
      mpinConfigured: !!user.mpinHash,
      isMpinSet: !!user.mpinHash,
      message: "We've sent a verification code to your phone number. Please enter it to continue.",
      ...(!isLiveOtp ? { otp } : {})
    };
  }

  /**
   * Confirms OTP validity and issues transitions token if MPIN configuration is needed
   */
  async verifyOtp(phoneNumber, otp) {
    const cleanPhone = this.normalizePhone(phoneNumber);
    const user = await User.findOne({
      $or: [
        { phoneNumber: cleanPhone },
        { phoneNumber: `+91${cleanPhone}` },
        { phoneNumber: `91${cleanPhone}` }
      ],
      isDeleted: { $ne: true }
    });

    if (!user) {
      throw ApiError.notFound('Customer identity not found in records.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    // Check OTP credentials
    const isTestMock = otp === '123456' && (panelControlConfig.CUSTOMER_PANEL.OTP === 'TEST' || user.tempOtp === '123456');
    const isLiveValid = user.tempOtp && user.tempOtp === otp && user.tempOtpExpires > new Date();

    if (!isTestMock && !isLiveValid) {
      throw ApiError.badRequest('The OTP code entered is incorrect or expired.', ErrorCode.OTP_INVALID);
    }

    // Clear temp OTP on success
    user.tempOtp = null;
    user.tempOtpExpires = null;
    await user.save();

    const enrichedUser = await this.getEnrichedCustomerData(user);

    const payload = {
      userId: user._id,
      phoneNumber: user.phoneNumber,
      role: user.role,
      userType: user.userType,
      permissions: ['CUSTOMER_PORTAL_READ'],
      purpose: user.mpinHash ? 'SESSION' : 'MPIN_SETUP'
    };

    const accessToken = jwtUtil.signAccess(payload);
    const refreshToken = jwtUtil.signRefresh(payload);

    return {
      mpinSetupRequired: !user.mpinHash,
      isMpinSet: !!user.mpinHash,
      mpinConfigured: !!user.mpinHash,
      isGuest: enrichedUser.isGuest,
      accessToken,
      refreshToken,
      token: accessToken,
      tempToken: accessToken,
      user: enrichedUser,
      profile: enrichedUser,
      message: user.mpinHash
        ? 'Verification successful! You can now log in using your 4-digit MPIN.'
        : 'Verification successful! Please choose a 4-digit security MPIN to protect your account.'
    };
  }

  /**
   * Hashes and registers customer MPIN
   */
  async registerMpin(userId, mpin, phoneNumber = null) {
    let user = null;
    if (phoneNumber) {
      const cleanPhone = this.normalizePhone(phoneNumber);
      user = await User.findOne({
        $or: [
          { phoneNumber: cleanPhone },
          { phoneNumber: `+91${cleanPhone}` },
          { phoneNumber: `91${cleanPhone}` }
        ],
        isDeleted: { $ne: true }
      });
    }
    if (!user && userId) {
      user = await User.findById(userId);
    }

    if (!user) {
      throw ApiError.notFound('Customer identity not found in records.');
    }

    // Cryptographically hash MPIN
    user.mpinHash = await cryptoUtil.hash(mpin);

    // Change status from PENDING_KYC or PENDING to ACTIVE
    if (user.status === 'PENDING_KYC' || user.status === 'PENDING') {
      user.status = 'ACTIVE';
    }
    user.lastLoginAt = new Date();
    await user.save();

    // Complete session token sign
    const payload = {
      userId: user._id,
      phoneNumber: user.phoneNumber,
      role: user.role,
      userType: user.userType,
      permissions: ['CUSTOMER_PORTAL_READ']
    };

    const accessToken = jwtUtil.signAccess(payload);
    const refreshToken = jwtUtil.signRefresh(payload);
    const enrichedUser = await this.getEnrichedCustomerData(user);

    return {
      accessToken,
      refreshToken,
      token: accessToken,
      isGuest: enrichedUser.isGuest,
      user: enrichedUser,
      profile: enrichedUser
    };
  }

  /**
   * Authenticates Customer Mobile App using MPIN
   */
  async authenticateCustomerMpin(phoneNumber, mpin) {
    const cleanPhone = this.normalizePhone(phoneNumber);
    const user = await User.findOne({
      $or: [
        { phoneNumber: cleanPhone },
        { phoneNumber: `+91${cleanPhone}` },
        { phoneNumber: `91${cleanPhone}` }
      ],
      isDeleted: { $ne: true }
    });

    if (!user) {
      throw ApiError.badRequest('Invalid mobile number or MPIN credentials.', ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    if (!user.mpinHash) {
      throw ApiError.badRequest('MPIN has not been configured on this account. Authenticate via OTP first.', ErrorCode.MPIN_REQUIRED);
    }

    // Verify MPIN hash matches
    const isMpinValid = await cryptoUtil.compare(mpin, user.mpinHash);
    if (!isMpinValid) {
      throw ApiError.badRequest('Invalid mobile number or MPIN credentials.', ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    if (user.status === 'BLOCKED' || user.status === 'REJECTED') {
      throw ApiError.forbidden(`Your account is currently locked or suspended [Status: ${user.status}].`, ErrorCode.AUTH_SESSION_EXPIRED);
    }

    if (user.status === 'PENDING' || user.status === 'PENDING_KYC') {
      user.status = 'ACTIVE';
    }

    const payload = {
      userId: user._id,
      phoneNumber: user.phoneNumber,
      role: user.role,
      userType: user.userType,
      permissions: ['CUSTOMER_PORTAL_READ']
    };

    const accessToken = jwtUtil.signAccess(payload);
    const refreshToken = jwtUtil.signRefresh(payload);

    // Update login audit timestamp
    user.lastLoginAt = new Date();
    await user.save();

    const enrichedUser = await this.getEnrichedCustomerData(user);

    return {
      accessToken,
      refreshToken,
      token: accessToken,
      isGuest: enrichedUser.isGuest,
      user: enrichedUser,
      profile: enrichedUser
    };
  }

  /**
   * Resends verification OTP code using dedicated resend flow
   */
  async resendOtp(phoneNumber) {
    const cleanPhone = this.normalizePhone(phoneNumber);
    const user = await User.findOne({
      $or: [
        { phoneNumber: cleanPhone },
        { phoneNumber: `+91${cleanPhone}` }
      ],
      isDeleted: { $ne: true }
    });

    if (!user) {
      throw ApiError.notFound('Customer identity not found in records.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const isLiveOtp = panelControlConfig.CUSTOMER_PANEL.OTP === 'LIVE';
    const otp = isLiveOtp ? generateOtp(6, { numericOnly: true }) : '123456';
    user.tempOtp = otp;
    user.tempOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    logger.info(`CUSTOMER MOBILE AUTH: Dispatching resent OTP to phone ${cleanPhone} -> [${otp}] (OTP Mode: ${panelControlConfig.CUSTOMER_PANEL.OTP})`);
    if (isLiveOtp) {
      await smsManager.sendOtp(
        cleanPhone,
        otp,
        smsConfig.templates.CUSTOMER_RESEND_OTP.templateId,
        { expiry: '10', var1: otp, var2: '10' }
      );
    }

    const enriched = await this.getEnrichedCustomerData(user);

    return {
      registered: !enriched.isGuest,
      isGuest: enriched.isGuest,
      mpinConfigured: !!user.mpinHash,
      isMpinSet: !!user.mpinHash,
      message: "We've resent a verification code to your phone number. Please enter it to continue.",
      ...(!isLiveOtp ? { otp } : {})
    };
  }

  /**
   * Triggers forgot MPIN SMS OTP
   */
  async forgotMpin(phoneNumber) {
    const cleanPhone = this.normalizePhone(phoneNumber);
    const user = await User.findOne({
      $or: [
        { phoneNumber: cleanPhone },
        { phoneNumber: `+91${cleanPhone}` }
      ],
      isDeleted: { $ne: true }
    });

    if (!user) {
      throw ApiError.notFound('Customer identity not found in records.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const isLiveOtp = panelControlConfig.CUSTOMER_PANEL.OTP === 'LIVE';
    const otp = isLiveOtp ? generateOtp(6, { numericOnly: true }) : '123456';
    user.tempOtp = otp;
    user.tempOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    logger.info(`CUSTOMER MOBILE AUTH: Dispatching forgot MPIN OTP to phone ${cleanPhone} -> [${otp}] (OTP Mode: ${panelControlConfig.CUSTOMER_PANEL.OTP})`);
    if (isLiveOtp) {
      await smsManager.sendOtp(
        cleanPhone,
        otp,
        smsConfig.templates.CUSTOMER_FORGOT_MPIN_OTP.templateId,
        { expiry: '10', var1: otp, var2: '10' }
      );
    }

    return {
      success: true,
      message: "We've sent a verification code to your phone number. Please enter it to reset your MPIN.",
      ...(!isLiveOtp ? { otp } : {})
    };
  }

  /**
   * Verifies forgot MPIN OTP and issues a short-lived reset token
   */
  async verifyResetOtp(phoneNumber, otp) {
    const cleanPhone = this.normalizePhone(phoneNumber);
    const user = await User.findOne({
      $or: [
        { phoneNumber: cleanPhone },
        { phoneNumber: `+91${cleanPhone}` }
      ],
      isDeleted: { $ne: true }
    });

    if (!user) {
      throw ApiError.notFound('Customer identity not found in records.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const isTestMock = otp === '123456' && (panelControlConfig.CUSTOMER_PANEL.OTP === 'TEST' || user.tempOtp === '123456');
    const isLiveValid = user.tempOtp && user.tempOtp === otp && user.tempOtpExpires > new Date();

    if (!isTestMock && !isLiveValid) {
      throw ApiError.badRequest('The verification code is incorrect or expired.', ErrorCode.OTP_INVALID);
    }

    user.tempOtp = null;
    user.tempOtpExpires = null;
    await user.save();

    const tempToken = jwtUtil.signAccess({
      userId: user._id,
      phoneNumber: user.phoneNumber,
      role: user.role,
      userType: user.userType,
      purpose: 'MPIN_RESET'
    }, '30d');

    return {
      success: true,
      tempToken,
      token: tempToken,
      accessToken: tempToken,
      message: 'Verification successful! Please choose a new 4-digit MPIN.'
    };
  }

  /**
   * Resets the customer MPIN passcode using an authorized transition token
   */
  async resetMpin(userId, mpin, phoneNumber = null) {
    let user = null;
    if (userId) {
      user = await User.findById(userId);
    }
    if (!user && phoneNumber) {
      const cleanPhone = this.normalizePhone(phoneNumber);
      user = await User.findOne({
        $or: [
          { phoneNumber: cleanPhone },
          { phoneNumber: `+91${cleanPhone}` }
        ],
        isDeleted: { $ne: true }
      });
    }

    if (!user) {
      throw ApiError.notFound('Customer identity not found in records.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    user.mpinHash = await cryptoUtil.hash(mpin);
    if (user.status === 'PENDING_KYC' || user.status === 'PENDING') {
      user.status = 'ACTIVE';
    }
    user.lastLoginAt = new Date();
    await user.save();

    const payload = {
      userId: user._id,
      phoneNumber: user.phoneNumber,
      role: user.role,
      userType: user.userType,
      permissions: ['CUSTOMER_PORTAL_READ']
    };

    const accessToken = jwtUtil.signAccess(payload);
    const refreshToken = jwtUtil.signRefresh(payload);
    const enrichedUser = await this.getEnrichedCustomerData(user);

    return {
      accessToken,
      refreshToken,
      token: accessToken,
      isGuest: enrichedUser.isGuest,
      user: enrichedUser,
      profile: enrichedUser
    };
  }

  /**
   * Refreshes access and refresh tokens using a valid refresh token signature
   */
  async refreshSession(token) {
    if (!token) {
      throw ApiError.unauthorized('Session expired or invalid token. Please log in again.', ErrorCode.AUTH_SESSION_EXPIRED);
    }

    const decoded = jwtUtil.verifyRefresh(token);
    if (!decoded) {
      throw ApiError.unauthorized('Session expired or invalid token. Please log in again.', ErrorCode.AUTH_SESSION_EXPIRED);
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      throw ApiError.unauthorized('Session expired or invalid token. Please log in again.', ErrorCode.AUTH_SESSION_EXPIRED);
    }

    if (user.status === 'BLOCKED' || user.status === 'REJECTED') {
      throw ApiError.forbidden(`Your account is currently locked or suspended [Status: ${user.status}].`, ErrorCode.AUTH_SESSION_EXPIRED);
    }

    const payload = {
      userId: user._id,
      phoneNumber: user.phoneNumber,
      role: user.role,
      userType: user.userType,
      permissions: ['CUSTOMER_PORTAL_READ']
    };

    const accessToken = jwtUtil.signAccess(payload);
    const refreshToken = jwtUtil.signRefresh(payload);

    return {
      accessToken,
      refreshToken,
      token: accessToken
    };
  }
}

export const customerMobileAuthService = new CustomerMobileAuthService();
