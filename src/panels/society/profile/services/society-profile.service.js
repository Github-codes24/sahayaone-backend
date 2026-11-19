import { User } from '../../../../models/user.model.js';
import { Bank } from '../../../../models/bank.model.js';
import { Branch } from '../../../../models/branch.model.js';
import { BranchManager } from '../../../../models/branch-manager.model.js';
import { SocietyEmployee } from '../../../../models/society-employee.model.js';
import { SocietyRole } from '../../../../models/society-role.model.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';
import { cryptoUtil } from '../../../../utils/crypto.util.js';
import { logger } from '../../../../utils/logger.util.js';
import { UserRole } from '../../../../constants/user-role.constant.js';
import { storageManager } from '../../../../storage/storage.manager.js';

export class SocietyProfileService {
  /**
   * Get formatted profile details for logged in society user
   */
  async getProfile(userId) {
    const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } });
    if (!user) {
      throw ApiError.notFound('Society user account not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const userRole = (user.role || '').toUpperCase();
    const isOwnerRole = [UserRole.BANK_OWNER, UserRole.SOCIETY_ADMIN, UserRole.VENDOR, UserRole.SUPER_ADMIN].includes(userRole);
    const isBranchManager = userRole === UserRole.BRANCH_MANAGER;

    let bankDetails = null;
    let branchDetails = null;
    let roleName = userRole === UserRole.BANK_OWNER ? 'Bank Owner' : userRole;
    let profileData = {};
    let avatar = user.location?.address || null;

    if (isOwnerRole) {
      const bank = await Bank.findOne({
        $or: [{ userId: user._id }, { email: user.email?.toLowerCase() }],
        isDeleted: { $ne: true }
      }).lean();

      if (bank) {
        roleName = 'Bank Owner';
        avatar = bank.logo || null;
        bankDetails = {
          id: bank._id,
          name: bank.name,
          code: bank.code,
          logo: bank.logo || null,
          email: bank.email,
          phoneNumber: bank.phoneNumber,
          status: bank.status
        };
        profileData = {
          name: bank.name || user.fullName,
          fullName: user.fullName || bank.name,
          email: user.email || bank.email,
          phone: user.phoneNumber || bank.phoneNumber,
          phoneNumber: user.phoneNumber || bank.phoneNumber,
          avatar: bank.logo || null
        };
      }
    } else if (isBranchManager) {
      const manager = await BranchManager.findOne({ userId: user._id, isDeleted: { $ne: true } }).lean();
      if (manager) {
        roleName = 'Branch Manager';
        if (manager.roleId) {
          const roleDoc = await SocietyRole.findOne({ _id: manager.roleId, isDeleted: { $ne: true } }).lean();
          if (roleDoc) roleName = roleDoc.name;
        }

        avatar = manager.personalDetails?.profileImage || null;
        profileData = {
          name: manager.fullName || user.fullName,
          fullName: manager.fullName || user.fullName,
          email: manager.email || user.email,
          phone: manager.phoneNumber || user.phoneNumber,
          phoneNumber: manager.phoneNumber || user.phoneNumber,
          avatar
        };

        const [bank, branch] = await Promise.all([
          Bank.findOne({ _id: manager.bankId, isDeleted: { $ne: true } }).lean(),
          Branch.findOne({ _id: manager.branchId, isDeleted: { $ne: true } }).lean()
        ]);

        if (bank) bankDetails = { id: bank._id, name: bank.name, code: bank.code };
        if (branch) branchDetails = { id: branch._id, name: branch.name, code: branch.code };
      }
    } else {
      // Society Employee
      const employee = await SocietyEmployee.findOne({ userId: user._id, isDeleted: { $ne: true } }).lean();
      if (employee) {
        roleName = employee.designation || 'Society Employee';
        if (employee.roleId) {
          const roleDoc = await SocietyRole.findOne({ _id: employee.roleId, isDeleted: { $ne: true } }).lean();
          if (roleDoc) roleName = roleDoc.name;
        }

        avatar = employee.personalDetails?.profileImage || null;
        profileData = {
          name: employee.fullName || user.fullName,
          fullName: employee.fullName || user.fullName,
          email: employee.email || user.email,
          phone: employee.phoneNumber || user.phoneNumber,
          phoneNumber: employee.phoneNumber || user.phoneNumber,
          avatar,
          designation: employee.designation || '',
          department: employee.department || '',
          dutyHours: employee.dutyHours || '',
          weeklyOff: employee.weeklyOff || '',
          bloodGroup: employee.bloodGroup || '',
          officeAddress: employee.officeAddress || ''
        };

        const [bank, branch] = await Promise.all([
          Bank.findOne({ _id: employee.bankId, isDeleted: { $ne: true } }).lean(),
          Branch.findOne({ _id: employee.branchId, isDeleted: { $ne: true } }).lean()
        ]);

        if (bank) bankDetails = { id: bank._id, name: bank.name, code: bank.code };
        if (branch) branchDetails = { id: branch._id, name: branch.name, code: branch.code };
      }
    }

    const fullName = profileData.fullName || user.fullName || '';
    const email = profileData.email || user.email || '';
    const phoneNumber = profileData.phoneNumber || user.phoneNumber || '';

    return {
      user: {
        id: user._id,
        fullName,
        name: fullName,
        email,
        phoneNumber,
        phone: phoneNumber,
        avatar,
        profileImage: avatar,
        role: user.role,
        roleName,
        userType: user.userType,
        status: user.status,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt
      },
      profile: {
        fullName,
        name: fullName,
        email,
        phoneNumber,
        phone: phoneNumber,
        avatar,
        profileImage: avatar,
        roleName,
        bank: bankDetails,
        branch: branchDetails,
        ...profileData
      }
    };
  }

  /**
   * Update profile details for logged in society user
   */
  async updateProfile(userId, payload = {}, file = null) {
    const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } });
    if (!user) {
      throw ApiError.notFound('Society user account not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const fullName = (payload.fullName || payload.name || '').trim();
    const email = (payload.email || '').trim().toLowerCase();
    const phoneNumber = (payload.phoneNumber || payload.phone || '').trim();
    let avatar = (payload.avatar || payload.profileImage || '').trim();

    // 1. Process S3 Avatar Image Upload if file or base64 string is provided
    if (file && file.buffer) {
      logger.info(`SOCIETY PROFILE: Uploading avatar file to S3 for user ${userId}...`);
      const uploadResult = await storageManager.uploadFile(file, `society/avatars/user_${userId}`);
      avatar = uploadResult.fileUrl || uploadResult.url;
    } else if (avatar && avatar.startsWith('data:image/')) {
      logger.info(`SOCIETY PROFILE: Processing base64 avatar for S3 upload for user ${userId}...`);
      const matches = avatar.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const mimeType = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');
        const ext = mimeType.split('/')[1] || 'jpg';
        const dummyFile = {
          originalname: `avatar_${userId}_${Date.now()}.${ext}`,
          mimetype: mimeType,
          buffer
        };
        const uploadResult = await storageManager.uploadFile(dummyFile, `society/avatars/user_${userId}`);
        avatar = uploadResult.fileUrl || uploadResult.url;
      }
    }

    // Validate email uniqueness if changing
    if (email && email !== user.email) {
      const existingUser = await User.findOne({
        email,
        _id: { $ne: userId },
        isDeleted: { $ne: true }
      });
      if (existingUser) {
        throw ApiError.badRequest('Email address is already in use by another account.', ErrorCode.RESOURCE_ALREADY_EXISTS);
      }
      user.email = email;
    }

    // Validate phone number uniqueness if changing
    if (phoneNumber && phoneNumber !== user.phoneNumber) {
      const existingUser = await User.findOne({
        phoneNumber,
        _id: { $ne: userId },
        isDeleted: { $ne: true }
      });
      if (existingUser) {
        throw ApiError.badRequest('Phone number is already in use by another account.', ErrorCode.RESOURCE_ALREADY_EXISTS);
      }
      user.phoneNumber = phoneNumber;
    }

    if (fullName) {
      user.fullName = fullName;
    }

    await user.save();

    // Synchronize linked profile documents (Bank, BranchManager, SocietyEmployee)
    const userRole = (user.role || '').toUpperCase();
    const isOwnerRole = [UserRole.BANK_OWNER, UserRole.SOCIETY_ADMIN, UserRole.VENDOR, UserRole.SUPER_ADMIN].includes(userRole);
    const isBranchManager = userRole === UserRole.BRANCH_MANAGER;

    if (isOwnerRole) {
      const bank = await Bank.findOne({
        $or: [{ userId: user._id }, { email: user.email?.toLowerCase() }],
        isDeleted: { $ne: true }
      });
      if (bank) {
        if (email) bank.email = email;
        if (phoneNumber) bank.phoneNumber = phoneNumber;
        if (fullName) bank.name = fullName;
        if (avatar) bank.logo = avatar;
        await bank.save();
      }
    } else if (isBranchManager) {
      const manager = await BranchManager.findOne({ userId: user._id, isDeleted: { $ne: true } });
      if (manager) {
        if (email) manager.email = email;
        if (phoneNumber) manager.phoneNumber = phoneNumber;
        if (fullName) manager.fullName = fullName;
        if (avatar) {
          if (!manager.personalDetails) manager.personalDetails = {};
          manager.personalDetails.profileImage = avatar;
        }
        await manager.save();
      }
    } else {
      const employee = await SocietyEmployee.findOne({ userId: user._id, isDeleted: { $ne: true } });
      if (employee) {
        if (email) employee.email = email;
        if (phoneNumber) employee.phoneNumber = phoneNumber;
        if (fullName) employee.fullName = fullName;
        if (avatar) {
          if (!employee.personalDetails) employee.personalDetails = {};
          employee.personalDetails.profileImage = avatar;
        }
        await employee.save();
      }
    }

    logger.info(`SOCIETY PROFILE: Profile updated for user ${user._id} (${user.email})`);
    return this.getProfile(userId);
  }

  /**
   * Validate old password & update password for logged in user
   */
  async changePassword(userId, { currentPassword, oldPassword, newPassword, confirmPassword }) {
    const pwdToVerify = currentPassword || oldPassword;
    if (!pwdToVerify) {
      throw ApiError.badRequest('Current password is required.', ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    if (confirmPassword && confirmPassword !== newPassword) {
      throw ApiError.badRequest('New password and confirm password do not match.', ErrorCode.VALIDATION_ERROR);
    }

    if (pwdToVerify === newPassword) {
      throw ApiError.badRequest('New password must be different from current password.', ErrorCode.VALIDATION_ERROR);
    }

    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound('User account not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (!user.passwordHash) {
      throw ApiError.badRequest('Password authentication is not configured for this account.', ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    const isMatch = await cryptoUtil.compare(pwdToVerify, user.passwordHash);
    if (!isMatch) {
      throw ApiError.badRequest('Your current password is incorrect.', ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    user.passwordHash = await cryptoUtil.hash(newPassword);
    await user.save();

    logger.info(`SOCIETY PROFILE: Password changed successfully for user ${user._id} (${user.email})`);

    return {
      success: true,
      message: 'Your password has been changed successfully.'
    };
  }
}

export const societyProfileService = new SocietyProfileService();
