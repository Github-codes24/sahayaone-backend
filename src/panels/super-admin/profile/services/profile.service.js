import { Admin } from '../../../../models/admin.model.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';
import { cryptoUtil } from '../../../../utils/crypto.util.js';
import { logger } from '../../../../utils/logger.util.js';
import { UserRole, UserType } from '../../../../constants/user-role.constant.js';
import { storageManager } from '../../../../storage/storage.manager.js';

export class SuperAdminProfileService {
  /**
   * Helper to format Admin Profile response payload matching UI specifications
   */
  formatProfileResponse(admin) {
    if (!admin) return null;

    const roleName = admin.role === UserRole.SUPER_ADMIN ? 'Admin' : 'Sub Admin';
    const avatar = admin.avatar || null;

    return {
      id: admin._id,
      userId: admin._id,
      name: admin.name,
      fullName: admin.name,
      email: admin.email,
      phone: admin.phoneNumber,
      phoneNumber: admin.phoneNumber,
      role: admin.role,
      roleName,
      userType: UserType.ADMIN,
      avatar,
      profileImage: avatar,
      status: admin.status,
      permissions: admin.role === UserRole.SUPER_ADMIN ? ['ALL_PERMISSIONS'] : (admin.permissions || []),
      lastLoginAt: admin.lastLoginAt,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt
    };
  }

  /**
   * Get Super Admin / Sub-Admin profile details for authenticated user
   */
  async getProfile(adminId) {
    const admin = await Admin.findOne({ _id: adminId, isDeleted: { $ne: true } }).lean();
    if (!admin) {
      throw ApiError.notFound('Admin user account not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    return {
      user: this.formatProfileResponse(admin),
      profile: this.formatProfileResponse(admin)
    };
  }

  /**
   * Update Super Admin profile (Name, Email, Phone, Avatar)
   */
  async updateProfile(adminId, payload = {}, files = {}) {
    const admin = await Admin.findOne({ _id: adminId, isDeleted: { $ne: true } });
    if (!admin) {
      throw ApiError.notFound('Admin user account not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const name = (payload.name || payload.fullName || '').trim();
    const email = (payload.email || '').trim().toLowerCase();
    const phoneNumber = (payload.phoneNumber || payload.phone || '').trim();
    let avatarUrl = (payload.avatar || payload.profileImage || '').trim();

    // 1. Process S3 Avatar Image Upload if file or base64 string is provided
    const fileObj =
      (files.avatar && files.avatar[0]) ||
      (files.profileImage && files.profileImage[0]) ||
      (files.file && files.file[0]) ||
      (files.image && files.image[0]) ||
      null;

    if (fileObj && fileObj.buffer) {
      logger.info(`SUPER ADMIN PROFILE: Uploading avatar file to S3 for admin ${adminId}...`);
      const uploadResult = await storageManager.uploadFile(fileObj, `super-admin/avatars/admin_${adminId}`);
      avatarUrl = uploadResult.fileUrl || uploadResult.url;
    } else if (avatarUrl && avatarUrl.startsWith('data:image/')) {
      logger.info(`SUPER ADMIN PROFILE: Processing base64 avatar for S3 upload for admin ${adminId}...`);
      const matches = avatarUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const mimeType = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');
        const ext = mimeType.split('/')[1] || 'jpg';
        const dummyFile = {
          originalname: `avatar_${adminId}_${Date.now()}.${ext}`,
          mimetype: mimeType,
          buffer
        };
        const uploadResult = await storageManager.uploadFile(dummyFile, `super-admin/avatars/admin_${adminId}`);
        avatarUrl = uploadResult.fileUrl || uploadResult.url;
      }
    }

    // 2. Validate email uniqueness if changing
    if (email && email !== admin.email) {
      const existingUser = await Admin.findOne({
        email,
        _id: { $ne: adminId },
        isDeleted: { $ne: true }
      });
      if (existingUser) {
        throw ApiError.conflict('Email address is already in use by another admin account.', ErrorCode.RESOURCE_ALREADY_EXISTS);
      }
      admin.email = email;
    }

    // 3. Validate phone number uniqueness if changing
    if (phoneNumber && phoneNumber !== admin.phoneNumber) {
      const existingUser = await Admin.findOne({
        phoneNumber,
        _id: { $ne: adminId },
        isDeleted: { $ne: true }
      });
      if (existingUser) {
        throw ApiError.conflict('Phone number is already in use by another admin account.', ErrorCode.RESOURCE_ALREADY_EXISTS);
      }
      admin.phoneNumber = phoneNumber;
    }

    if (name) {
      admin.name = name;
    }

    if (avatarUrl) {
      admin.avatar = avatarUrl;
    }

    admin.updatedBy = adminId;
    await admin.save();

    logger.info(`SUPER ADMIN PROFILE: Profile updated for admin ${admin._id} (${admin.email})`);
    return this.getProfile(adminId);
  }

  /**
   * Validate current password & change password for logged-in admin user
   */
  async changePassword(adminId, { currentPassword, oldPassword, newPassword, password, confirmPassword }) {
    const pwdToVerify = (currentPassword || oldPassword || '').trim();
    const newPwd = (newPassword || password || '').trim();
    const confirmPwd = (confirmPassword || '').trim();

    if (!pwdToVerify) {
      throw ApiError.badRequest('Current password is required.', ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    if (!newPwd || newPwd.length < 6) {
      throw ApiError.badRequest('New password must be at least 6 characters long.', ErrorCode.VALIDATION_ERROR);
    }

    if (confirmPwd && confirmPwd !== newPwd) {
      throw ApiError.badRequest('New password and confirm password do not match.', ErrorCode.VALIDATION_ERROR);
    }

    if (pwdToVerify === newPwd) {
      throw ApiError.badRequest('New password must be different from current password.', ErrorCode.VALIDATION_ERROR);
    }

    const admin = await Admin.findOne({ _id: adminId, isDeleted: { $ne: true } });
    if (!admin) {
      throw ApiError.notFound('Admin user account not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const isMatch = await cryptoUtil.compare(pwdToVerify, admin.passwordHash);
    if (!isMatch) {
      throw ApiError.badRequest('Your current password is incorrect.', ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    admin.passwordHash = await cryptoUtil.hash(newPwd);
    admin.updatedBy = adminId;
    await admin.save();

    logger.info(`SUPER ADMIN PROFILE: Password changed successfully for admin ${admin._id} (${admin.email})`);

    return {
      success: true,
      message: 'Your password has been changed successfully.'
    };
  }

  /**
   * Super-Admin resets password for another sub-admin / user account by target ID
   */
  async adminResetUserPassword(targetUserId, { newPassword, password, confirmPassword }, performerId) {
    const newPwd = (newPassword || password || '').trim();
    const confirmPwd = (confirmPassword || '').trim();

    if (!newPwd || newPwd.length < 6) {
      throw ApiError.badRequest('New password must be at least 6 characters long.', ErrorCode.VALIDATION_ERROR);
    }

    if (confirmPwd && confirmPwd !== newPwd) {
      throw ApiError.badRequest('New password and confirm password do not match.', ErrorCode.VALIDATION_ERROR);
    }

    const admin = await Admin.findOne({ _id: targetUserId, isDeleted: { $ne: true } });
    if (!admin) {
      throw ApiError.notFound('Target admin user account not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    admin.passwordHash = await cryptoUtil.hash(newPwd);
    admin.updatedBy = performerId;
    await admin.save();

    logger.info(`SUPER ADMIN RESET: Password for admin user ${admin.email} (${admin._id}) reset by ${performerId}`);

    return {
      success: true,
      message: `Password for ${admin.name} (${admin.email}) reset successfully.`
    };
  }
}

export const superAdminProfileService = new SuperAdminProfileService();
