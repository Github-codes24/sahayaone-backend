import { Bank } from '../../../../models/bank.model.js';
import { Branch } from '../../../../models/branch.model.js';
import { CreditLog } from '../../../../models/credit-log.model.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';
import { logger } from '../../../../utils/logger.util.js';
import { User } from '../../../../models/user.model.js';
import { UserRole, UserType } from '../../../../constants/user-role.constant.js';
import { cryptoUtil } from '../../../../utils/crypto.util.js';

import { mailer } from '../../../../emails/mailer.util.js';
import { emailConfig } from '../../../../config/email.config.js';
import { panelControlConfig, msg91TemplateConfig } from '../../../../config/panel-control.config.js';

export class BankVerificationService {
  /**
   * Verifies an onboarded bank application (Approve / Reject)
   */
  async verifyBank(bankId, payload, updaterId = null) {
    const { status } = payload;
    const remarks = (payload.remarks || payload.rejectionRemarks || payload.rejectionReason || '').trim();

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      throw ApiError.badRequest('Invalid verification status action. MUST be APPROVED or REJECTED.', ErrorCode.VALIDATION_ERROR);
    }

    const bank = await Bank.findById(bankId);
    if (!bank) {
      throw ApiError.notFound('Bank record not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const isLiveEmail = panelControlConfig.SUPER_ADMIN_PANEL?.EMAIL === 'LIVE';

    if (status === 'APPROVED') {
      if (bank.paymentStatus === 'PENDING' || (bank.paymentMethod && bank.paymentStatus !== 'SUCCESS')) {
        throw ApiError.badRequest(
          'Cannot approve bank application while onboarding payment is pending. Payment must be completed/verified first.',
          ErrorCode.BAD_REQUEST
        );
      }
      bank.status = 'APPROVED';
      bank.verifiedBy = updaterId;
      bank.verifiedAt = new Date();
      bank.rejectedBy = null;
      bank.rejectedAt = null;
      if (remarks) {
        bank.remarks = remarks;
      }
      bank.updatedBy = updaterId;
      await bank.save();

      // Automatically create a corresponding User login account if it doesn't already exist
      const existingUser = await User.findOne({ email: bank.email, isDeleted: { $ne: true } });
      if (!existingUser) {
        const passwordHash = bank.passwordHash || (await cryptoUtil.hash('Password@123'));
        const bankUser = new User({
          email: bank.email,
          phoneNumber: bank.phoneNumber,
          passwordHash,
          role: UserRole.BANK_OWNER,
          userType: UserType.PARTNER,
          status: 'ACTIVE',
          createdBy: updaterId
        });
        await bankUser.save();
        bank.userId = bankUser._id;
        await bank.save();
        logger.info(`USER CREATION: Successfully created BANK_OWNER user account [${bank.email}] linked to bank [${bank.name}].`);
      } else {
        bank.userId = existingUser._id;
        existingUser.role = UserRole.BANK_OWNER;
        if (bank.passwordHash) {
          existingUser.passwordHash = bank.passwordHash;
        }
        if (existingUser.status !== 'ACTIVE') {
          existingUser.status = 'ACTIVE';
        }
        await existingUser.save();
        await bank.save();
        logger.info(`USER SYNC: Successfully synced existing BANK_OWNER user account [${bank.email}] linked to bank [${bank.name}].`);
      }

      // Dispatch Approval Email Notification if SUPER_ADMIN_PANEL Email is LIVE
      if (isLiveEmail && bank.email) {
        try {
          await mailer.sendMail({
            to: bank.email,
            subject: emailConfig.templates.BANK_ONBOARDING_APPROVED?.subject || `Bank Onboarding Application Approved - ${bank.name}`,
            templateId: msg91TemplateConfig.SUPER_ADMIN_PANEL?.BANK_ONBOARDING_APPROVED || emailConfig.templates.BANK_ONBOARDING_APPROVED?.templateId,
            variables: {
              bankName: bank.name,
              bankCode: bank.code,
              uboName: bank.ubo || bank.name,
              email: bank.email,
              phoneNumber: bank.phoneNumber || '',
              totalEmiCards: String(bank.totalEmiCards || 110),
              totalVerificationCredits: String(bank.totalVerificationCredits || 220),
              portalUrl: 'https://sahayaone-partner-panel.netlify.app',
              supportPhone: '8080494923',
              supportEmail: 'info@sahayaone.com'
            }
          });
          logger.info(`BANK ONBOARDING EMAIL: Approval email successfully dispatched to bank owner [${bank.email}].`);
        } catch (emailErr) {
          logger.error(`BANK ONBOARDING EMAIL ERROR: Failed dispatching approval email to [${bank.email}]: ${emailErr.message}`);
        }
      }
    } else {
      if (!remarks) {
        throw ApiError.badRequest('Remarks are required when rejecting a bank onboarding request.', ErrorCode.VALIDATION_ERROR);
      }
      bank.status = 'REJECTED';
      bank.remarks = remarks;
      bank.rejectionRemarks = remarks;
      bank.rejectionReason = remarks;
      bank.rejectedAt = new Date();
      bank.rejectedBy = updaterId;
      bank.verifiedBy = null;
      bank.verifiedAt = null;
      bank.updatedBy = updaterId;
      await bank.save();

      // Dispatch Rejection Email Notification if SUPER_ADMIN_PANEL Email is LIVE
      if (isLiveEmail && bank.email) {
        try {
          await mailer.sendMail({
            to: bank.email,
            subject: emailConfig.templates.BANK_ONBOARDING_REJECTED?.subject || `Update Required for Your Bank Onboarding Application - ${bank.name}`,
            templateId: msg91TemplateConfig.SUPER_ADMIN_PANEL?.BANK_ONBOARDING_REJECTED || emailConfig.templates.BANK_ONBOARDING_REJECTED?.templateId,
            variables: {
              bankName: bank.name,
              bankCode: bank.code,
              uboName: bank.ubo || bank.name,
              remarks: remarks,
              rejectionReason: remarks,
              resubmitUrl: 'https://sahayaone-onboarding.netlify.app',
              supportPhone: '8080494923',
              supportEmail: 'info@sahayaone.com'
            }
          });
          logger.info(`BANK ONBOARDING EMAIL: Rejection email successfully dispatched to bank owner [${bank.email}].`);
        } catch (emailErr) {
          logger.error(`BANK ONBOARDING EMAIL ERROR: Failed dispatching rejection email to [${bank.email}]: ${emailErr.message}`);
        }
      }
    }

    await bank.populate([
      { path: 'createdBy', select: 'fullName name email phoneNumber role' },
      { path: 'onboardingTeamMemberId', select: 'fullName phone email onboardingTeamType region userId' },
      { path: 'cashCollectedByTeamId', select: 'fullName phone email onboardingTeamType region userId' },
      { path: 'verifiedBy', select: 'fullName name email phoneNumber role' },
      { path: 'rejectedBy', select: 'fullName name email phoneNumber role' }
    ]);

    return {
      success: true,
      bankId: bank._id,
      status: bank.status,
      remarks: bank.remarks,
      rejectionRemarks: bank.rejectionRemarks,
      verifiedAt: bank.verifiedAt || null,
      verifiedBy: bank.verifiedBy ? {
        id: bank.verifiedBy._id,
        userId: bank.verifiedBy._id,
        name: bank.verifiedBy.fullName || bank.verifiedBy.name || bank.verifiedBy.email,
        email: bank.verifiedBy.email,
        phone: bank.verifiedBy.phoneNumber || bank.verifiedBy.phone,
        role: bank.verifiedBy.role
      } : null,
      rejectedAt: bank.rejectedAt || null,
      rejectedBy: bank.rejectedBy ? {
        id: bank.rejectedBy._id,
        userId: bank.rejectedBy._id,
        name: bank.rejectedBy.fullName || bank.rejectedBy.name || bank.rejectedBy.email,
        email: bank.rejectedBy.email,
        phone: bank.rejectedBy.phoneNumber || bank.rejectedBy.phone,
        role: bank.rejectedBy.role
      } : null,
      onboardedBy: bank.onboardingTeamMemberId ? {
        id: bank.onboardingTeamMemberId._id,
        userId: bank.onboardingTeamMemberId.userId || bank.createdBy?._id || null,
        teamMemberId: bank.onboardingTeamMemberId._id,
        name: bank.onboardingTeamMemberId.fullName || bank.onboardingTeamMemberId.name,
        email: bank.onboardingTeamMemberId.email,
        phone: bank.onboardingTeamMemberId.phone,
        role: 'ONBOARDING_TEAM',
        type: bank.onboardingTeamMemberId.onboardingTeamType,
        region: bank.onboardingTeamMemberId.region
      } : bank.cashCollectedByTeamId ? {
        id: bank.cashCollectedByTeamId._id,
        userId: bank.cashCollectedByTeamId.userId || bank.createdBy?._id || null,
        teamMemberId: bank.cashCollectedByTeamId._id,
        name: bank.cashCollectedByTeamId.fullName || bank.cashCollectedByTeamId.name,
        email: bank.cashCollectedByTeamId.email,
        phone: bank.cashCollectedByTeamId.phone,
        role: 'ONBOARDING_TEAM',
        type: bank.cashCollectedByTeamId.onboardingTeamType,
        region: bank.cashCollectedByTeamId.region
      } : (bank.createdBy ? {
        id: bank.createdBy._id,
        userId: bank.createdBy._id,
        teamMemberId: null,
        name: bank.createdBy.fullName || bank.createdBy.name || bank.createdBy.email,
        email: bank.createdBy.email,
        phone: bank.createdBy.phoneNumber || bank.createdBy.phone,
        role: bank.createdBy.role,
        type: bank.createdBy.role,
        region: null
      } : null),
      creditLimit: bank.creditLimit,
      message: `Bank onboarding request successfully processed with action: ${status}`
    };
  }

  /**
   * Manually allots credits (cards / verification tokens) to a bank by Super Admin
   */
  async allotCredits(bankId, payload) {
    const { cardQuantity = 0, verificationCredit = 0 } = payload;

    const bank = await Bank.findById(bankId);
    if (!bank) {
      throw ApiError.notFound('Bank record not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const qtyCard = Number(cardQuantity);
    const qtyCredit = Number(verificationCredit);

    bank.totalEmiCards += qtyCard;
    bank.availableEmiCards += qtyCard;
    bank.totalVerificationCredits += qtyCredit;
    bank.availableVerificationCredits += qtyCredit;

    await bank.save();

    // Log the Super Admin allotment in CreditLog
    if (qtyCard > 0) {
      await CreditLog.create({
        bankId: bank._id,
        type: 'EMI_CARD',
        action: 'ADMIN_ALLOTMENT',
        amount: qtyCard,
        description: `Super Admin manually alloted ${qtyCard} EMI Cards to bank.`
      });
    }

    if (qtyCredit > 0) {
      await CreditLog.create({
        bankId: bank._id,
        type: 'VERIFICATION_CREDIT',
        action: 'ADMIN_ALLOTMENT',
        amount: qtyCredit,
        description: `Super Admin manually alloted ${qtyCredit} Verification Credits to bank.`
      });
    }

    logger.info(`SUPER ADMIN ALLOTMENT: Alloted ${qtyCard} cards & ${qtyCredit} credits to bank [${bank.name}].`);

    return {
      success: true,
      bank: {
        id: bank._id,
        name: bank.name,
        totalEmiCards: bank.totalEmiCards,
        availableEmiCards: bank.availableEmiCards,
        totalVerificationCredits: bank.totalVerificationCredits,
        availableVerificationCredits: bank.availableVerificationCredits
      }
    };
  }
}

export const bankVerificationService = new BankVerificationService();
