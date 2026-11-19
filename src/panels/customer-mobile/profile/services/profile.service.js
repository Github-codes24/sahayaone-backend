import { User } from '../../../../models/user.model.js';
import { CustomerProfile } from '../../../../models/customer-profile.model.js';
import { customerMobileAuthService } from '../../auth/services/auth.service.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';
import { storageManager } from '../../../../storage/storage.manager.js';
import { mailer } from '../../../../emails/mailer.util.js';
import { emailConfig } from '../../../../config/email.config.js';
import { generateOtp } from '../../../../utils/otp.util.js';
import { envConfig } from '../../../../config/env.config.js';

export class CustomerProfileService {
  /**
   * Retrieves clean profile details for self session
   * Fetches unified onboard customer data across banks, loans, and pigmy accounts
   * @param {String} userId - Logged-in user ID
   */
  async getProfile(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound('User account record not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const enriched = await customerMobileAuthService.getEnrichedCustomerData(user);
    if (!enriched) {
      throw ApiError.notFound('Customer profile record not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    return enriched;
  }

  /**
   * Updates customer profile details (supports both avatar image upload and email update)
   */
  async updateProfile(userId, payload, file) {
    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound('User account record not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const profile = await CustomerProfile.findOne({ userId });
    if (!profile) {
      throw ApiError.notFound('Customer profile record not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    // 1. If email is provided, validate uniqueness and update
    if (payload.email) {
      const cleanEmail = payload.email.trim().toLowerCase();
      if (cleanEmail !== user.email?.toLowerCase()) {
        const existingUser = await User.findOne({ email: cleanEmail });
        if (existingUser) {
          throw ApiError.badRequest('This email address is already registered to another account.', ErrorCode.VALIDATION_ERROR);
        }
        
        const oldEmail = user.email;
        user.email = cleanEmail;
        await user.save();

        // Send confirmation email notification to old and new email addresses
        if (oldEmail) {
          mailer.sendMail({
            to: oldEmail,
            subject: emailConfig.templates.CUSTOMER_EMAIL_CHANGE_OLD.subject,
            templateId: emailConfig.templates.CUSTOMER_EMAIL_CHANGE_OLD.templateId,
            variables: {
              oldEmail,
              newEmail: cleanEmail
            },
            html: `
              <h3>Security Alert - Email Address Updated</h3>
              <p>Dear Customer,</p>
              <p>This is to inform you that your email address on Sahayaone has been successfully changed from <strong>${oldEmail}</strong> to <strong>${cleanEmail}</strong>.</p>
              <p>If you did not perform this change, please immediately contact Sahayaone Credit Support at 8080494923 or email info@sahayaone.com.</p>
            `
          }).catch(err => {
            console.warn(`[EMAIL ALERT EXCEPTION]: Failed dispatching notification to old address:`, err.message);
          });
        }

        mailer.sendMail({
          to: cleanEmail,
          subject: emailConfig.templates.CUSTOMER_EMAIL_CHANGE_NEW.subject,
          templateId: emailConfig.templates.CUSTOMER_EMAIL_CHANGE_NEW.templateId,
          variables: {
            newEmail: cleanEmail
          },
          html: `
            <h3>Email Linked Successfully</h3>
            <p>Dear Customer,</p>
            <p>Your email address <strong>${cleanEmail}</strong> has been successfully linked to your Sahayaone account. You will now receive all future statements and alerts at this address.</p>
            <p>If you did not perform this change, please contact support immediately at 8080494923 or email info@sahayaone.com.</p>
          `
        }).catch(err => {
          console.warn(`[EMAIL ALERT EXCEPTION]: Failed dispatching notification to new address:`, err.message);
        });
      }
    }

    // 2. Upload profile avatar image if provided
    if (file) {
      const uploadResult = await storageManager.uploadFile(file, `sahayaone/customers/customer_${userId}/avatars`);
      
      // Cleanup previous avatar from cloud storage
      if (profile.avatarKey) {
        storageManager.deleteFile(profile.avatarKey).catch(err => {
          console.warn(`[PROFILE DELETION]: Failed clearing old avatar key [${profile.avatarKey}]:`, err.message);
        });
      }

      profile.avatar = uploadResult.fileUrl || uploadResult.url;
      profile.avatarKey = uploadResult.filePath || uploadResult.key;
    }

    await profile.save();

    // 3. Return the profile details based on verification status
    if (profile.kycStatus === 'VERIFIED') {
      return {
        userId: user._id,
        firstName: profile.firstName,
        lastName: profile.lastName,
        fullName: `${profile.firstName} ${profile.lastName}`.trim(),
        gender: profile.gender || null,
        dob: profile.dob || null,
        phoneNumber: user.phoneNumber,
        email: user.email || null,
        avatar: profile.avatar || null,
        activeAddress: profile.activeAddress || null,
        kycStatus: profile.kycStatus
      };
    } else {
      return {
        userId: user._id,
        phoneNumber: user.phoneNumber,
        kycStatus: profile.kycStatus,
        role: 'GUEST'
      };
    }
  }
}

export const customerProfileService = new CustomerProfileService();
