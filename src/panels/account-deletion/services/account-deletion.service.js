import { User } from '../../../models/user.model.js';
import { CustomerProfile } from '../../../models/customer-profile.model.js';
import { EmployeeProfile } from '../../../models/employee-profile.model.js';
import { SocietyEmployee } from '../../../models/society-employee.model.js';
import { OnboardingTeam } from '../../../models/onboarding-team.model.js';
import { Loan } from '../../../models/loan.model.js';
import { TempOtp } from '../../../models/temp-otp.model.js';
import { ApiError } from '../../../common/api.error.js';
import { ErrorCode } from '../../../constants/error-code.constant.js';
import { UserRole, UserType } from '../../../constants/user-role.constant.js';
import { generateOtp } from '../../../utils/otp.util.js';
import { logger } from '../../../utils/logger.util.js';
import { panelControlConfig } from '../../../config/panel-control.config.js';
import { smsManager } from '../../../sms/sms.manager.js';
import { smsConfig } from '../../../config/sms.config.js';

export class AccountDeletionService {
  /**
   * Helper method to normalize account type string
   */
  normalizeAccountType(type) {
    const uppercaseType = (type || '').trim().toUpperCase();
    if (uppercaseType === 'ONBOARDING') return 'BANK_ONBOARDING';
    return uppercaseType;
  }

  /**
   * Look up account entity in the database based on account type & phone number
   */
  async findAccountEntity(accountType, phoneNumber) {
    const normalizedType = this.normalizeAccountType(accountType);
    const cleanPhone = (phoneNumber || '').trim();

    if (normalizedType === 'CUSTOMER') {
      // 1. Look up User or CustomerProfile
      let user = await User.findOne({
        phoneNumber: cleanPhone,
        isDeleted: { $ne: true },
        $or: [{ role: UserRole.CUSTOMER }, { userType: UserType.CUSTOMER }]
      });

      let profile = null;
      if (user) {
        profile = await CustomerProfile.findOne({ userId: user._id, isDeleted: { $ne: true } });
      } else {
        profile = await CustomerProfile.findOne({ isDeleted: { $ne: true } }).populate({
          path: 'userId',
          match: { phoneNumber: cleanPhone, isDeleted: { $ne: true } }
        });
        if (profile && profile.userId) {
          user = profile.userId;
        } else {
          profile = null;
        }
      }

      if (!user && !profile) {
        throw ApiError.notFound(
          `No active Customer account found with phone number ${cleanPhone}.`,
          ErrorCode.RESOURCE_NOT_FOUND
        );
      }

      // 2. Check for active loans or pending payments
      const activeLoan = await Loan.findOne({
        customerId: user._id,
        isDeleted: { $ne: true },
        $or: [
          { status: { $in: ['NEW', 'PENDING_DOWN_PAYMENT', 'ACTIVE'] } },
          { outstandingAmount: { $gt: 0 } }
        ]
      });

      if (activeLoan) {
        throw ApiError.badRequest(
          'Account deletion cannot be processed as you have active loans or pending payments.',
          ErrorCode.OPERATION_NOT_ALLOWED
        );
      }

      return { accountType: normalizedType, user, profile };
    }

    if (normalizedType === 'LOAN_EXECUTIVE') {
      // Look up Employee / Loan Executive User & Profiles
      let user = await User.findOne({
        phoneNumber: cleanPhone,
        isDeleted: { $ne: true },
        $or: [{ role: UserRole.EMPLOYEE }, { userType: UserType.EMPLOYEE }]
      });

      let employeeProfile = await EmployeeProfile.findOne({
        isDeleted: { $ne: true },
        ...(user ? { userId: user._id } : {})
      });

      let societyEmployee = await SocietyEmployee.findOne({
        isDeleted: { $ne: true },
        $or: [{ phoneNumber: cleanPhone }, ...(user ? [{ userId: user._id }] : [])]
      });

      if (!user && societyEmployee && societyEmployee.userId) {
        user = await User.findOne({ _id: societyEmployee.userId, isDeleted: { $ne: true } });
      }

      if (!user && !employeeProfile && !societyEmployee) {
        throw ApiError.notFound(
          `No active Loan Executive account found with phone number ${cleanPhone}.`,
          ErrorCode.RESOURCE_NOT_FOUND
        );
      }

      return { accountType: normalizedType, user, employeeProfile, societyEmployee };
    }

    if (normalizedType === 'BANK_ONBOARDING') {
      // Look up Bank Onboarding Team member
      let member = await OnboardingTeam.findOne({
        $or: [{ phone: cleanPhone }, { phoneNumber: cleanPhone }],
        isDeleted: { $ne: true }
      });

      let user = null;
      if (member && member.userId) {
        user = await User.findOne({ _id: member.userId, isDeleted: { $ne: true } });
      } else {
        user = await User.findOne({
          phoneNumber: cleanPhone,
          isDeleted: { $ne: true },
          $or: [{ role: UserRole.ONBOARDING_TEAM }, { userType: UserType.ONBOARDING_TEAM }]
        });
        if (user) {
          member = await OnboardingTeam.findOne({ userId: user._id, isDeleted: { $ne: true } });
        }
      }

      if (!member && !user) {
        throw ApiError.notFound(
          `No active Bank Onboarding account found with phone number ${cleanPhone}.`,
          ErrorCode.RESOURCE_NOT_FOUND
        );
      }

      return { accountType: normalizedType, user, onboardingMember: member };
    }

    throw ApiError.badRequest('Invalid account type provided.');
  }

  /**
   * Request OTP for account deletion
   */
  async requestOtp(accountType, phoneNumber) {
    const cleanPhone = (phoneNumber || '').trim();

    // 1. Verify entity exists and check constraints (e.g. active loans for customers)
    const entityData = await this.findAccountEntity(accountType, cleanPhone);

    // 2. Generate OTP
    const isLiveOtp = panelControlConfig.CUSTOMER_PANEL.OTP === 'LIVE';
    const otp = isLiveOtp ? generateOtp(6, { numericOnly: true }) : '123456';

    // 3. Store OTP in TempOtp collection with 10-minute expiry
    await TempOtp.deleteMany({ phoneNumber: cleanPhone });
    const tempOtpDoc = new TempOtp({
      phoneNumber: cleanPhone,
      otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });
    await tempOtpDoc.save();

    logger.info(
      `ACCOUNT DELETION: Dispatching OTP to phone ${cleanPhone} for [${entityData.accountType}] -> [${otp}] (OTP Mode: ${panelControlConfig.CUSTOMER_PANEL.OTP})`
    );

    // 4. Send SMS if Live
    if (isLiveOtp) {
      try {
        await smsManager.sendOtp(
          cleanPhone,
          otp,
          smsConfig.templates.CUSTOMER_LOGIN_OTP.templateId,
          { var1: otp, var2: '10' }
        );
      } catch (err) {
        logger.error(`ACCOUNT DELETION SMS ERROR: ${err.message}`);
      }
    }

    return {
      success: true,
      message: `We've sent a verification code to ${cleanPhone} for account deletion.`,
      accountType: entityData.accountType,
      ...(!isLiveOtp ? { otp } : {})
    };
  }

  /**
   * Verify OTP & Perform Account Deletion
   */
  async verifyAndDelete(accountType, phoneNumber, otp) {
    const cleanPhone = (phoneNumber || '').trim();
    const cleanOtp = (otp || '').trim();

    // 1. Validate OTP
    const isTestMock = cleanOtp === '123456' && panelControlConfig.CUSTOMER_PANEL.OTP === 'TEST';
    const otpRecord = await TempOtp.findOne({
      phoneNumber: cleanPhone,
      expiresAt: { $gt: new Date() }
    });

    const isLiveValid = otpRecord && otpRecord.otp === cleanOtp;

    if (!isTestMock && !isLiveValid) {
      throw ApiError.badRequest(
        'The verification OTP entered is incorrect or has expired.',
        ErrorCode.OTP_INVALID
      );
    }

    // 2. Fetch Entity & perform deletion
    const entityData = await this.findAccountEntity(accountType, cleanPhone);
    const timestamp = Date.now();

    if (entityData.accountType === 'CUSTOMER') {
      const { user, profile } = entityData;

      if (profile) {
        profile.isDeleted = true;
        profile.deletedAt = new Date();
        await profile.save();
      }

      if (user) {
        user.isDeleted = true;
        user.deletedAt = new Date();
        user.status = 'INACTIVE';
        // Anonymize phone and email to free up original credentials for re-registration
        if (user.phoneNumber) {
          user.phoneNumber = `${user.phoneNumber}_deleted_${timestamp}`;
        }
        if (user.email) {
          user.email = `${user.email}_deleted_${timestamp}`;
        }
        await user.save();
      }
    } else if (entityData.accountType === 'LOAN_EXECUTIVE') {
      const { user, employeeProfile, societyEmployee } = entityData;

      if (employeeProfile) {
        employeeProfile.isDeleted = true;
        employeeProfile.deletedAt = new Date();
        await employeeProfile.save();
      }

      if (societyEmployee) {
        societyEmployee.isDeleted = true;
        societyEmployee.deletedAt = new Date();
        societyEmployee.status = 'INACTIVE';
        if (societyEmployee.phoneNumber) {
          societyEmployee.phoneNumber = `${societyEmployee.phoneNumber}_deleted_${timestamp}`;
        }
        if (societyEmployee.email) {
          societyEmployee.email = `${societyEmployee.email}_deleted_${timestamp}`;
        }
        await societyEmployee.save();
      }

      if (user) {
        user.isDeleted = true;
        user.deletedAt = new Date();
        user.status = 'INACTIVE';
        if (user.phoneNumber) {
          user.phoneNumber = `${user.phoneNumber}_deleted_${timestamp}`;
        }
        if (user.email) {
          user.email = `${user.email}_deleted_${timestamp}`;
        }
        await user.save();
      }
    } else if (entityData.accountType === 'BANK_ONBOARDING') {
      const { user, onboardingMember } = entityData;

      if (onboardingMember) {
        onboardingMember.isDeleted = true;
        onboardingMember.deletedAt = new Date();
        onboardingMember.status = 'INACTIVE';
        if (onboardingMember.phone) {
          onboardingMember.phone = `${onboardingMember.phone}_deleted_${timestamp}`;
        }
        if (onboardingMember.email) {
          onboardingMember.email = `${onboardingMember.email}_deleted_${timestamp}`;
        }
        await onboardingMember.save();
      }

      if (user) {
        user.isDeleted = true;
        user.deletedAt = new Date();
        user.status = 'INACTIVE';
        if (user.phoneNumber) {
          user.phoneNumber = `${user.phoneNumber}_deleted_${timestamp}`;
        }
        if (user.email) {
          user.email = `${user.email}_deleted_${timestamp}`;
        }
        await user.save();
      }
    }

    // 3. Delete used OTP records
    await TempOtp.deleteMany({ phoneNumber: cleanPhone });

    return {
      success: true,
      message: 'Your account has been deleted successfully. Your personal data has been cleaned up.'
    };
  }
}

export const accountDeletionService = new AccountDeletionService();
