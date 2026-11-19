import bcrypt from 'bcryptjs';
import { User } from '../../../../models/user.model.js';
import { MerchantProfile } from '../../../../models/merchant-profile.model.js';
import { Branch } from '../../../../models/branch.model.js';
import { Bank } from '../../../../models/bank.model.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';
import { UserRole, UserType } from '../../../../constants/user-role.constant.js';
import { jwtUtil } from '../../../../utils/jwt.util.js';
import { generateOtp } from '../../../../utils/otp.util.js';
import { logger } from '../../../../utils/logger.util.js';
import { envConfig } from '../../../../config/env.config.js';
import { smsManager } from '../../../../sms/sms.manager.js';
import { smsConfig } from '../../../../config/sms.config.js';
import { panelControlConfig } from '../../../../config/panel-control.config.js';

export class MerchantAuthService {
  /**
   * Helper to format merchant profile response
   */
  formatMerchantDetails(merchant) {
    if (!merchant) return null;
    const branchObj = merchant.branchId;
    const bankObj = merchant.bankId;

    let branchName = 'N/A';
    let branchCode = null;
    let branchId = null;
    let branchAddress = null;
    if (branchObj && typeof branchObj === 'object') {
      branchName = branchObj.name || 'N/A';
      branchCode = branchObj.code || null;
      branchId = branchObj._id;
      branchAddress = branchObj.address || null;
    } else if (branchObj) {
      branchId = branchObj;
    }

    let bankName = 'N/A';
    let bankCode = null;
    let bankLogo = null;
    let bankId = null;
    let bankType = null;
    if (bankObj && typeof bankObj === 'object') {
      bankName = bankObj.name || bankObj.societyName || 'N/A';
      bankCode = bankObj.code || null;
      bankLogo = bankObj.logo || null;
      bankId = bankObj._id;
      bankType = bankObj.bankType || null;
    } else if (bankObj) {
      bankId = bankObj;
    }

    return {
      id: merchant._id,
      merchantId: merchant._id,
      storeId: merchant._id,
      merchantCode: merchant.merchantCode || merchant.code || null,
      code: merchant.code || merchant.merchantCode || null,
      bankId: bankId,
      bankName: bankName,
      bankCode: bankCode,
      bankLogo: bankLogo,
      bankType: bankType,
      branchId: branchId,
      branchName: branchName,
      branchCode: branchCode,
      branchAddress: branchAddress,
      branch: branchName,
      shopName: merchant.shopName,
      ownerName: merchant.ownerName,
      shopOwnerName: merchant.ownerName,
      email: merchant.email,
      phoneNumber: merchant.phoneNumber,
      phone: merchant.phoneNumber,
      aadhaarNumber: merchant.aadhaarNumber || null,
      panNumber: merchant.panNumber || null,
      gstinNumber: merchant.gstinNumber || null,
      approvalStatus: merchant.approvalStatus || (merchant.status === 'ACTIVE' ? 'APPROVED' : 'PENDING_BRANCH_APPROVAL'),
      status: merchant.status,
      rejectionReason: merchant.rejectionReason || null,
      bankDetails: merchant.bankDetails || null,
      societyAccount: merchant.societyAccount || null,
      documents: {
        ownerAadhaar: merchant.documents?.ownerAadhaar || null,
        ownerPan: merchant.documents?.ownerPan || null,
        shopRegistrationCertificate: merchant.documents?.shopRegistrationCertificate || null,
        gstCertificate: merchant.documents?.gstCertificate || null
      },
      createdAt: merchant.createdAt
    };
  }

  /**
   * 1. Merchant Password Login (Screen 1)
   * Authenticates merchant by Mobile Number (or Email) and Password
   * Returns authenticated user profile, active store, tokens, and ALL merchant stores across banks
   */
  async login(payload) {
    const { phoneNumber, email, loginId, password } = payload;
    const rawIdentifier = (phoneNumber || email || loginId || '').trim();
    if (!rawIdentifier) {
      throw ApiError.badRequest('Mobile number or email is required.', ErrorCode.VALIDATION_ERROR);
    }

    if (!password) {
      throw ApiError.badRequest('Password is required.', ErrorCode.VALIDATION_ERROR);
    }

    // 1. Find user by mobile number or email
    const isEmail = rawIdentifier.includes('@');
    const normalizedIdentifier = isEmail ? rawIdentifier.toLowerCase() : rawIdentifier.replace(/\D/g, '').slice(-10);

    const query = isEmail ? { email: normalizedIdentifier } : { phoneNumber: normalizedIdentifier };
    let user = await User.findOne({
      ...query,
      isDeleted: { $ne: true }
    });

    // Fallback: Check if MerchantProfile has this email or phoneNumber, then find User
    if (!user) {
      const merchantProfile = await MerchantProfile.findOne({
        $or: [
          { email: normalizedIdentifier },
          { phoneNumber: normalizedIdentifier }
        ],
        isDeleted: { $ne: true }
      }).lean();

      if (merchantProfile?.userId) {
        user = await User.findOne({ _id: merchantProfile.userId, isDeleted: { $ne: true } });
      }
    }

    if (!user) {
      throw ApiError.unauthorized('Invalid mobile number/email or password.', ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    // 2. Verify role eligibility
    const allowedRoles = [UserRole.VENDOR, UserRole.MERCHANT, UserRole.SUPER_ADMIN];
    if (!allowedRoles.includes(user.role) && user.userType !== UserType.PARTNER) {
      throw ApiError.forbidden('Access denied. Merchant partner privileges required.', ErrorCode.AUTH_FORBIDDEN);
    }

    // 3. Verify password
    if (!user.passwordHash) {
      throw ApiError.unauthorized('Password authentication is not configured for this account. Please use Forgot Password.', ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw ApiError.unauthorized('Invalid mobile number/email or password.', ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    // 4. Resolve ALL MerchantProfiles for this user with populated bank and branch details
    const allStores = await MerchantProfile.find({
      $or: [
        { userId: user._id },
        { phoneNumber: user.phoneNumber },
        ...(user.email ? [{ email: user.email }] : [])
      ],
      isDeleted: { $ne: true }
    })
      .populate('branchId', 'name code address')
      .populate('bankId', 'name code logo bankType societyName')
      .sort({ createdAt: -1 })
      .lean();

    if (allStores.length === 0) {
      throw ApiError.forbidden('No merchant profile associated with this account. Please contact branch or administrator.', ErrorCode.AUTH_FORBIDDEN);
    }

    // Check if at least one store is approved or active
    const approvedStores = allStores.filter(
      s => s.approvalStatus === 'APPROVED' || s.status === 'ACTIVE'
    );
    const pendingStores = allStores.filter(
      s => s.approvalStatus === 'PENDING_BRANCH_APPROVAL' || s.status === 'INACTIVE'
    );

    if (approvedStores.length === 0) {
      if (allStores.every(s => s.approvalStatus === 'REJECTED' || s.status === 'BLOCKED')) {
        const reason = allStores[0]?.rejectionReason ? ` Reason: ${allStores[0].rejectionReason}` : '';
        throw ApiError.forbidden(`Your merchant onboarding application was rejected by Branch.${reason}`, ErrorCode.AUTH_FORBIDDEN);
      }
      if (user.status === 'PENDING' || pendingStores.length > 0) {
        throw ApiError.forbidden('Your merchant onboarding application is pending approval from Branch Manager or Owner. Login will be enabled once approved.', ErrorCode.AUTH_FORBIDDEN);
      }
      throw ApiError.forbidden(`Your merchant account is currently ${user.status}. Please contact Branch Manager.`, ErrorCode.AUTH_FORBIDDEN);
    }

    if (user.status !== 'ACTIVE' && approvedStores.length > 0) {
      user.status = 'ACTIVE';
      user.isApproved = true;
    }

    // Determine active/primary store:
    let activeMerchant = null;
    const requestedMerchantId = (payload.merchantId || payload.storeId || '').toString().trim();
    const requestedBankId = (payload.bankId || '').toString().trim();

    if (requestedMerchantId) {
      activeMerchant = allStores.find(s => s._id.toString() === requestedMerchantId && (s.approvalStatus === 'APPROVED' || s.status === 'ACTIVE'));
    }
    if (!activeMerchant && requestedBankId) {
      activeMerchant = allStores.find(s => {
        const bId = s.bankId?._id?.toString() || s.bankId?.toString();
        return bId === requestedBankId && (s.approvalStatus === 'APPROVED' || s.status === 'ACTIVE');
      });
    }
    if (!activeMerchant) {
      activeMerchant = approvedStores.find(s => s.status === 'ACTIVE') || approvedStores[0] || allStores[0];
    }

    // 6. Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // 7. Generate JWT access and refresh tokens
    const tokenPayload = {
      userId: user._id.toString(),
      phoneNumber: user.phoneNumber,
      email: user.email,
      role: user.role || UserRole.MERCHANT,
      userType: user.userType || UserType.PARTNER,
      merchantId: activeMerchant?._id ? activeMerchant._id.toString() : null,
      bankId: activeMerchant?.bankId?._id ? activeMerchant.bankId._id.toString() : (activeMerchant?.bankId || null),
      branchId: activeMerchant?.branchId?._id ? activeMerchant.branchId._id.toString() : (activeMerchant?.branchId || null),
      shopName: activeMerchant?.shopName || null
    };

    const accessToken = jwtUtil.signAccess(tokenPayload);
    const refreshToken = jwtUtil.signRefresh(tokenPayload);

    logger.info(`MERCHANT AUTH: Successful login for shop "${activeMerchant?.shopName || 'N/A'}" (Phone: ${user.phoneNumber}) with ${allStores.length} stores.`);

    const formattedStores = allStores.map(store => {
      const formatted = this.formatMerchantDetails(store);
      formatted.isActiveStore = String(store._id) === String(activeMerchant._id);
      return formatted;
    });

    const formattedActive = this.formatMerchantDetails(activeMerchant);
    if (formattedActive) {
      formattedActive.isActiveStore = true;
    }

    return {
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        email: user.email,
        fullName: user.fullName || activeMerchant?.ownerName || 'Merchant Owner',
        role: user.role,
        userType: user.userType,
        status: user.status,
        lastLoginAt: user.lastLoginAt
      },
      merchant: formattedActive,
      activeStore: formattedActive,
      stores: formattedStores,
      merchants: formattedStores,
      totalStores: formattedStores.length,
      tokens: {
        accessToken,
        refreshToken
      }
    };
  }

  /**
   * 2. Forget Password - Request OTP (Screen 2)
   * Sends 6-digit OTP code to merchant's registered mobile number
   */
  async forgotPassword({ phoneNumber }) {
    const cleanPhone = (phoneNumber || '').trim();
    if (!cleanPhone) {
      throw ApiError.badRequest('Registered mobile number is required.', ErrorCode.VALIDATION_ERROR);
    }

    const user = await User.findOne({
      phoneNumber: cleanPhone,
      isDeleted: { $ne: true }
    });

    if (!user) {
      throw ApiError.notFound('No merchant account registered with this mobile number.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (user.status !== 'ACTIVE') {
      throw ApiError.forbidden(`Your account is currently ${user.status}. Please contact support.`, ErrorCode.AUTH_FORBIDDEN);
    }

    // Generate 6-digit numeric OTP
    const isLiveOtp = panelControlConfig.EMPLOYEE_PANEL?.OTP === 'LIVE' || envConfig.nodeEnv === 'production';
    const otp = isLiveOtp ? generateOtp(6, { numericOnly: true }) : '123456';
    const expirationMinutes = envConfig.otpExpirationMinutes || 10;

    user.resetOtp = otp;
    user.resetOtpExpires = new Date(Date.now() + expirationMinutes * 60 * 1000);
    user.resetVerifiedAt = null;
    await user.save();

    logger.info(`MERCHANT AUTH: Password reset OTP [${otp}] generated for mobile: ${user.phoneNumber}`);

    // Dispatch SMS via MSG91 if live mode
    if (isLiveOtp) {
      try {
        await smsManager.sendOtp(
          user.phoneNumber,
          otp,
          smsConfig.templates?.EMPLOYEE_LOGIN_OTP?.templateId,
          { var1: otp, var2: String(expirationMinutes) }
        );
      } catch (smsErr) {
        logger.error(`MERCHANT AUTH: SMS delivery exception: ${smsErr.message}`);
      }
    }

    return {
      phoneNumber: user.phoneNumber,
      otp,
      message: `A 6 digit OTP has been sent to +91 ${user.phoneNumber}`
    };
  }

  /**
   * 3. Verify OTP (Screen 3)
   * Verifies the 6-digit OTP and generates a secure resetToken
   */
  async verifyOtp({ phoneNumber, otp }) {
    const cleanPhone = (phoneNumber || '').trim();
    const cleanOtp = (otp || '').trim();

    if (!cleanPhone || !cleanOtp) {
      throw ApiError.badRequest('Mobile number and 6-digit OTP are required.', ErrorCode.VALIDATION_ERROR);
    }

    const user = await User.findOne({
      phoneNumber: cleanPhone,
      isDeleted: { $ne: true }
    });

    if (!user) {
      throw ApiError.notFound('Merchant user record not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const isDevMock = cleanOtp === '123456' && envConfig.nodeEnv !== 'production';
    const isLiveValid = user.resetOtp && user.resetOtp === cleanOtp && user.resetOtpExpires && user.resetOtpExpires > new Date();

    if (!isDevMock && !isLiveValid) {
      throw ApiError.badRequest('Invalid or expired OTP code. Please request a new OTP.', ErrorCode.OTP_INVALID);
    }

    // Mark as verified and clear the one-time code
    user.resetOtp = null;
    user.resetOtpExpires = null;
    user.resetVerifiedAt = new Date();
    await user.save();

    // Generate a short-lived reset token (valid for 15 minutes)
    const resetToken = jwtUtil.signAccess({
      userId: user._id.toString(),
      phoneNumber: user.phoneNumber,
      purpose: 'MERCHANT_PASSWORD_RESET'
    });

    logger.info(`MERCHANT AUTH: OTP verified successfully for mobile: ${user.phoneNumber}`);

    return {
      phoneNumber: user.phoneNumber,
      resetToken,
      message: 'OTP verified successfully. Please enter your new password.'
    };
  }

  /**
   * 4. Reset Password (Screen 4)
   * Updates merchant password after OTP verification
   */
  async resetPassword({ phoneNumber, password, confirmPassword, resetToken }) {
    const cleanPhone = (phoneNumber || '').trim();

    if (!resetToken) {
      throw ApiError.unauthorized('Reset token is required. Please complete OTP verification first.', ErrorCode.AUTH_UNAUTHORIZED);
    }

    if (!password) {
      throw ApiError.badRequest('New password is required.', ErrorCode.VALIDATION_ERROR);
    }

    if (password !== confirmPassword) {
      throw ApiError.badRequest('New password and confirm password do not match.', ErrorCode.VALIDATION_ERROR);
    }

    let decoded = null;
    try {
      decoded = jwtUtil.verifyAccess(resetToken);
    } catch (err) {
      throw ApiError.unauthorized('Invalid or expired reset token. Please complete OTP verification again.', ErrorCode.AUTH_SESSION_EXPIRED);
    }

    if (!decoded || !decoded.userId || decoded.purpose !== 'MERCHANT_PASSWORD_RESET') {
      throw ApiError.unauthorized('Invalid or forged reset token signature.', ErrorCode.AUTH_FORBIDDEN);
    }

    const user = await User.findOne({ _id: decoded.userId, isDeleted: { $ne: true } });
    if (!user) {
      throw ApiError.notFound('Merchant account not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (cleanPhone && user.phoneNumber !== cleanPhone) {
      throw ApiError.unauthorized('Phone number mismatch with reset token authorization.', ErrorCode.AUTH_FORBIDDEN);
    }

    // Update password hash
    const passwordHash = await bcrypt.hash(password, 10);
    user.passwordHash = passwordHash;
    user.resetVerifiedAt = null;
    user.resetOtp = null;
    user.resetOtpExpires = null;
    await user.save();

    logger.info(`MERCHANT AUTH: Password successfully reset for merchant mobile: ${user.phoneNumber}`);

    return {
      phoneNumber: user.phoneNumber,
      message: 'Password has been successfully reset. You can now login with your new password.'
    };
  }

  /**
   * 5. Resend OTP (Screen 3 link)
   */
  async resendOtp({ phoneNumber }) {
    return this.forgotPassword({ phoneNumber });
  }

  /**
   * 6. Get Authenticated Merchant Profile
   * Returns authenticated user, active store, and ALL merchant stores across banks
   */
  async getProfile(userId, selectedMerchantId = null) {
    const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } }).lean();
    if (!user) {
      throw ApiError.notFound('Merchant user not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const allStores = await MerchantProfile.find({
      $or: [
        { userId: user._id },
        { phoneNumber: user.phoneNumber },
        ...(user.email ? [{ email: user.email }] : [])
      ],
      isDeleted: { $ne: true }
    })
      .populate('branchId', 'name code address')
      .populate('bankId', 'name code logo bankType societyName')
      .sort({ createdAt: -1 })
      .lean();

    let activeMerchant = null;
    if (selectedMerchantId) {
      activeMerchant = allStores.find(s => s._id.toString() === selectedMerchantId.toString());
    }
    if (!activeMerchant) {
      activeMerchant = allStores.find(s => s.status === 'ACTIVE' && s.approvalStatus === 'APPROVED') || allStores[0] || null;
    }

    const formattedStores = allStores.map(store => {
      const formatted = this.formatMerchantDetails(store);
      formatted.isActiveStore = Boolean(activeMerchant && String(store._id) === String(activeMerchant._id));
      return formatted;
    });

    const formattedActive = this.formatMerchantDetails(activeMerchant);
    if (formattedActive) {
      formattedActive.isActiveStore = true;
    }

    return {
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        email: user.email,
        fullName: user.fullName || activeMerchant?.ownerName || 'Merchant Owner',
        role: user.role,
        userType: user.userType,
        status: user.status,
        lastLoginAt: user.lastLoginAt
      },
      merchant: formattedActive,
      activeStore: formattedActive,
      stores: formattedStores,
      merchants: formattedStores,
      totalStores: formattedStores.length
    };
  }

  /**
   * 6b. Switch Active Store
   * Allows multi-bank merchants to switch their active store and receive updated tokens
   */
  async switchStore(userId, { merchantId, storeId }) {
    const targetStoreId = (merchantId || storeId || '').toString().trim();
    if (!targetStoreId) {
      throw ApiError.badRequest('merchantId (storeId) is required to switch store.', ErrorCode.VALIDATION_ERROR);
    }

    const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } });
    if (!user) {
      throw ApiError.notFound('Merchant user not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const store = await MerchantProfile.findOne({
      _id: targetStoreId,
      $or: [
        { userId: user._id },
        { phoneNumber: user.phoneNumber },
        ...(user.email ? [{ email: user.email }] : [])
      ],
      isDeleted: { $ne: true }
    })
      .populate('branchId', 'name code address')
      .populate('bankId', 'name code logo bankType societyName')
      .lean();

    if (!store) {
      throw ApiError.notFound('Selected store not found or does not belong to your account.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (store.approvalStatus !== 'APPROVED' && store.status !== 'ACTIVE') {
      throw ApiError.forbidden(`This store application is currently ${store.approvalStatus || store.status}. You cannot switch to an unapproved store.`, ErrorCode.AUTH_FORBIDDEN);
    }

    const tokenPayload = {
      userId: user._id.toString(),
      phoneNumber: user.phoneNumber,
      email: user.email,
      role: user.role || UserRole.MERCHANT,
      userType: user.userType || UserType.PARTNER,
      merchantId: store._id.toString(),
      bankId: store.bankId?._id ? store.bankId._id.toString() : (store.bankId || null),
      branchId: store.branchId?._id ? store.branchId._id.toString() : (store.branchId || null),
      shopName: store.shopName || null
    };

    const accessToken = jwtUtil.signAccess(tokenPayload);
    const refreshToken = jwtUtil.signRefresh(tokenPayload);

    const formattedStore = this.formatMerchantDetails(store);
    formattedStore.isActiveStore = true;

    return {
      message: `Active store switched to "${store.shopName}".`,
      activeStore: formattedStore,
      merchant: formattedStore,
      tokens: {
        accessToken,
        refreshToken
      }
    };
  }

  /**
   * 7. Change Password (Logged-in User)
   */
  async changePassword(userId, { currentPassword, newPassword, confirmPassword }) {
    if (newPassword !== confirmPassword) {
      throw ApiError.badRequest('New password and confirm password do not match.', ErrorCode.VALIDATION_ERROR);
    }

    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound('User record not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (!user.passwordHash) {
      throw ApiError.badRequest('Password authentication is not configured for this account.');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw ApiError.badRequest('Current password is incorrect.', ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    logger.info(`MERCHANT AUTH: Password changed successfully for user: ${user.phoneNumber}`);

    return {
      message: 'Password has been changed successfully.'
    };
  }

  /**
   * 8. Refresh JWT Tokens
   */
  async refreshToken(token) {
    if (!token) {
      throw ApiError.unauthorized('Refresh token is required.', ErrorCode.AUTH_SESSION_EXPIRED);
    }

    const decoded = jwtUtil.verifyRefresh(token);
    if (!decoded) {
      throw ApiError.unauthorized('Refresh token expired or invalid.', ErrorCode.AUTH_SESSION_EXPIRED);
    }

    const user = await User.findOne({ _id: decoded.userId, isDeleted: { $ne: true } });
    if (!user || user.status !== 'ACTIVE') {
      throw ApiError.forbidden('User session is invalid or account inactive.', ErrorCode.AUTH_FORBIDDEN);
    }

    const tokenPayload = {
      userId: user._id.toString(),
      phoneNumber: user.phoneNumber,
      email: user.email,
      role: user.role,
      userType: user.userType,
      merchantId: decoded.merchantId || null,
      shopName: decoded.shopName || null
    };

    const accessToken = jwtUtil.signAccess(tokenPayload);
    const newRefreshToken = jwtUtil.signRefresh(tokenPayload);

    return {
      accessToken,
      refreshToken: newRefreshToken
    };
  }

  /**
   * 9. Logout
   */
  async logout(userId) {
    if (userId) {
      logger.info(`MERCHANT AUTH: Merchant logged out: ${userId}`);
    }
    return {
      message: 'Logged out successfully.'
    };
  }
}

export const merchantAuthService = new MerchantAuthService();
