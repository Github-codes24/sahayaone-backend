import bcrypt from "bcryptjs";
import { User } from "../../../../models/user.model.js";
import { Bank } from "../../../../models/bank.model.js";
import { Branch } from "../../../../models/branch.model.js";
import { BranchManager } from "../../../../models/branch-manager.model.js";
import { SocietyEmployee } from "../../../../models/society-employee.model.js";
import { SocietyRole } from "../../../../models/society-role.model.js";
import { EmployeeProfile } from "../../../../models/employee-profile.model.js";
import { ApiError } from "../../../../common/api.error.js";
import { jwtUtil } from "../../../../utils/jwt.util.js";
import { generateOtp } from "../../../../utils/otp.util.js";
import { logger } from "../../../../utils/logger.util.js";
import {
  UserRole,
  UserType,
} from "../../../../constants/user-role.constant.js";
import { ALL_SOCIETY_PERMISSIONS } from "../../../../constants/society-permission.constant.js";
import { mailer } from "../../../../emails/mailer.util.js";
import { msg91TemplateConfig } from "../../../../config/panel-control.config.js";
import { societyRoleService } from "../../roles/services/society-role.service.js";
import {
  PREDEFINED_SOCIETY_ROLES,
  normalizeRoleCode,
} from "../../../../constants/society-role.constant.js";

export class SocietyAuthService {
  /**
   * Authenticate Society portal users (Bank Owner, Branch Manager, Society Employee)
   */
  async login({ role, email, password }) {
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Locate User by email and Bank by email/userId
    let user = await User.findOne({
      email: normalizedEmail,
      isDeleted: { $ne: true },
    });

    let bankDoc = await Bank.findOne({
      $or: [
        { email: normalizedEmail },
        ...(user ? [{ userId: user._id }] : []),
      ],
      isDeleted: { $ne: true },
    });

    if (!user) {
      if (bankDoc && bankDoc.passwordHash) {
        const isBankPwdMatch = await bcrypt.compare(password, bankDoc.passwordHash);
        if (isBankPwdMatch) {
          // Check approval status before auto-creating User doc
          const bankStatusUpper = (bankDoc.status || "").toUpperCase();
          if (
            [
              "PENDING",
              "ON_VERIFICATION",
              "REJECTED",
              "INACTIVE",
              "BLOCKED",
            ].includes(bankStatusUpper) ||
            (bankStatusUpper !== "APPROVED" && bankStatusUpper !== "ACTIVE")
          ) {
            if (bankStatusUpper === "ON_VERIFICATION") {
              throw ApiError.forbidden(
                "Your Co-operative Bank onboarding is currently ON VERIFICATION. Access denied until approved by super admin.",
              );
            }
            if (bankStatusUpper === "PENDING") {
              throw ApiError.forbidden(
                "Your Co-operative Bank onboarding is currently PENDING approval or payment verification. Access denied until approved.",
              );
            }
            if (bankStatusUpper === "REJECTED") {
              throw ApiError.forbidden(
                "Your Co-operative Bank onboarding request has been REJECTED. Access denied.",
              );
            }
            throw ApiError.forbidden(
              `Co-operative Bank status is ${bankDoc.status}. Access denied.`,
            );
          }

          user = new User({
            email: normalizedEmail,
            phoneNumber: bankDoc.phoneNumber,
            passwordHash: bankDoc.passwordHash,
            role: UserRole.BANK_OWNER,
            userType: UserType.PARTNER,
            status: "ACTIVE",
          });
          await user.save();
          bankDoc.userId = user._id;
          await bankDoc.save();
          logger.info(`SOCIETY AUTH: Auto-created missing User doc for approved bank [${bankDoc.name}] on login.`);
        }
      }
    }

    if (!user) {
      throw ApiError.unauthorized("Invalid email address or password.");
    }

    // 2. Validate user account status
    if (user.status !== "ACTIVE") {
      throw ApiError.forbidden(
        "Account is currently inactive or blocked. Please contact support.",
      );
    }

    // 3. Verify password
    if (!user.passwordHash && (!bankDoc || !bankDoc.passwordHash)) {
      throw ApiError.unauthorized(
        "Password login is not set up for this account.",
      );
    }

    let isMatch = false;
    if (user.passwordHash) {
      isMatch = await bcrypt.compare(password, user.passwordHash);
    }

    // Fallback sync: If password comparison fails against user.passwordHash, check bankDoc.passwordHash
    if (!isMatch && bankDoc && bankDoc.passwordHash) {
      const isBankMatch = await bcrypt.compare(password, bankDoc.passwordHash);
      if (isBankMatch) {
        user.passwordHash = bankDoc.passwordHash;
        if (user.status !== "ACTIVE") {
          user.status = "ACTIVE";
        }
        await user.save();
        if (!bankDoc.userId) {
          bankDoc.userId = user._id;
          await bankDoc.save();
        }
        isMatch = true;
        logger.info(`SOCIETY AUTH: Synced updated Bank password to User doc for [${normalizedEmail}] on login.`);
      }
    }

    if (!isMatch) {
      throw ApiError.unauthorized("Invalid email address or password.");
    }

    // 4. Check for active sub-profiles (BranchManager or SocietyEmployee)
    const managerDoc = await BranchManager.findOne({
      userId: user._id,
      isDeleted: { $ne: true },
    }).lean();

    const employeeDoc = !managerDoc
      ? await SocietyEmployee.findOne({
          userId: user._id,
          isDeleted: { $ne: true },
        }).lean()
      : null;

    const userRole = (user.role || "").toUpperCase();
    let requestedRole = role ? role.trim().toUpperCase() : null;

    const isOwnerByBankDoc = Boolean(bankDoc) && !managerDoc && !employeeDoc;
    const isOwnerRoleUser = [
      UserRole.BANK_OWNER,
      UserRole.SOCIETY_ADMIN,
      UserRole.VENDOR,
      UserRole.SUPER_ADMIN,
    ].includes(userRole);

    if (isOwnerByBankDoc && (!user.role || user.role === UserRole.VENDOR)) {
      user.role = UserRole.BANK_OWNER;
      await user.save().catch(() => {});
    }

    if (!requestedRole) {
      if (isOwnerByBankDoc || isOwnerRoleUser) {
        requestedRole = userRole || UserRole.BANK_OWNER;
      } else if (managerDoc) {
        requestedRole = UserRole.BRANCH_MANAGER;
      } else if (employeeDoc) {
        requestedRole = userRole || UserRole.EMPLOYEE;
      } else {
        requestedRole = userRole || UserRole.BANK_OWNER;
      }
    }

    const isOwnerRoleRequested = [
      UserRole.BANK_OWNER,
      UserRole.SOCIETY_ADMIN,
      UserRole.VENDOR,
    ].includes(requestedRole);

    const isEmployeeRoleRequested = [
      UserRole.EMPLOYEE,
      UserRole.SALES_AGENT,
      UserRole.RECOVERY_AGENT,
      UserRole.COLLECTION_AGENT,
      UserRole.LOAN_EXECUTIVE,
      UserRole.COLLECTION_EXECUTIVE,
      UserRole.BRANCH_MANAGER,
      "MANAGER",
    ].includes(requestedRole);

    const isEmployeeUser =
      user.userType === UserType.EMPLOYEE ||
      userRole === UserRole.BRANCH_MANAGER ||
      Boolean(managerDoc || employeeDoc);

    const isOwnerFlow =
      (isOwnerRoleRequested || isOwnerRoleUser || isOwnerByBankDoc) &&
      (!isEmployeeRoleRequested || isOwnerByBankDoc);

    if (isOwnerRoleRequested && !isOwnerRoleUser && !isOwnerByBankDoc) {
      const bankExists = await Bank.findOne({
        $or: [{ userId: user._id }, { email: normalizedEmail }],
        isDeleted: { $ne: true },
      });
      if (!bankExists && userRole !== UserRole.SUPER_ADMIN) {
        throw ApiError.unauthorized(
          `Role mismatch: User is not authorized as ${requestedRole}.`,
        );
      }
    } else if (isEmployeeRoleRequested && !isEmployeeUser && !isOwnerRoleUser && !isOwnerByBankDoc) {
      throw ApiError.unauthorized(
        `Role mismatch: User is not authorized as ${requestedRole}.`,
      );
    }

    // 5. Resolve Bank, Branch, Role and Permissions Context
    let bankId = null;
    let branchId = null;
    let profileId = null;
    let roleId = null;
    let roleName = "Bank Owner";
    let permissions = [];
    let bankDetails = null;
    let branchDetails = null;

    if (isOwnerFlow) {
      const bank = bankDoc || (await Bank.findOne({
        $or: [{ userId: user._id }, { email: normalizedEmail }],
        isDeleted: { $ne: true },
      }).lean());

      if (!bank && userRole !== UserRole.SUPER_ADMIN) {
        throw ApiError.forbidden(
          "No Co-operative Bank / Society record associated with this account.",
        );
      }

      if (bank) {
        const bankStatusUpper = (bank.status || "").toUpperCase();
        if (
          [
            "PENDING",
            "ON_VERIFICATION",
            "REJECTED",
            "INACTIVE",
            "BLOCKED",
          ].includes(bankStatusUpper) ||
          (bankStatusUpper !== "APPROVED" && bankStatusUpper !== "ACTIVE")
        ) {
          if (bankStatusUpper === "ON_VERIFICATION") {
            throw ApiError.forbidden(
              "Your Co-operative Bank onboarding is currently ON VERIFICATION. Access denied until approved by super admin.",
            );
          }
          if (bankStatusUpper === "PENDING") {
            throw ApiError.forbidden(
              "Your Co-operative Bank onboarding is currently PENDING approval or payment verification. Access denied until approved.",
            );
          }
          if (bankStatusUpper === "REJECTED") {
            throw ApiError.forbidden(
              "Your Co-operative Bank onboarding request has been REJECTED. Access denied.",
            );
          }
          throw ApiError.forbidden(
            `Co-operative Bank status is ${bank.status}. Access denied.`,
          );
        }
        bankId = bank._id;
        profileId = bank._id;
        roleName = "Bank Owner";
        permissions = ALL_SOCIETY_PERMISSIONS;
        bankDetails = {
          id: bank._id,
          name: bank.name,
          code: bank.code,
          logo: bank.logo || null,
          email: bank.email,
          phoneNumber: bank.phoneNumber,
          status: bank.status,
          availableEmiCards: bank.availableEmiCards || bank.cardQuantity || 0,
          availableVerificationCredits:
            bank.availableVerificationCredits || bank.verificationCredit || 0,
        };
      }
    } else {
      // Check BranchManager profile first
      const manager = await BranchManager.findOne({
        userId: user._id,
        isDeleted: { $ne: true },
      }).lean();

      if (manager) {
        if (manager.status !== "ACTIVE") {
          throw ApiError.forbidden(
            "Branch Manager account is currently inactive.",
          );
        }

        const branch = await Branch.findOne({
          _id: manager.branchId,
          isDeleted: { $ne: true },
        }).lean();

        if (!branch || branch.status !== "ACTIVE") {
          throw ApiError.forbidden(
            "Assigned branch could not be found or is inactive.",
          );
        }

        const bank = await Bank.findOne({
          _id: manager.bankId,
          isDeleted: { $ne: true },
        }).lean();

        if (bank) {
          const bankStatusUpper = (bank.status || "").toUpperCase();
          if (
            [
              "PENDING",
              "ON_VERIFICATION",
              "REJECTED",
              "INACTIVE",
              "BLOCKED",
            ].includes(bankStatusUpper) ||
            (bankStatusUpper !== "APPROVED" && bankStatusUpper !== "ACTIVE")
          ) {
            if (
              bankStatusUpper === "PENDING" ||
              bankStatusUpper === "ON_VERIFICATION"
            ) {
              throw ApiError.forbidden(
                "The parent Co-operative Bank onboarding is currently PENDING approval. Access denied.",
              );
            }
            if (bankStatusUpper === "REJECTED") {
              throw ApiError.forbidden(
                "The parent Co-operative Bank onboarding request has been REJECTED. Access denied.",
              );
            }
            throw ApiError.forbidden(
              `Parent Co-operative Bank status is ${bank.status}. Access denied.`,
            );
          }
        }

        bankId = manager.bankId;
        branchId = manager.branchId;
        profileId = manager._id;
        roleId = manager.roleId || null;
        roleName = "Branch Manager";

        const managerPredefined = PREDEFINED_SOCIETY_ROLES.find(
          (r) => r.code === "MANAGER",
        );
        permissions = managerPredefined ? managerPredefined.permissions : [];

        bankDetails = bank
          ? { id: bank._id, name: bank.name, code: bank.code }
          : null;
        branchDetails = {
          id: branch._id,
          name: branch.name,
          code: branch.code,
          cardStock: branch.cardStock || 0,
          verificationCredits: branch.verificationCredits || 0,
        };
      } else {
        // Check SocietyEmployee Profile
        const societyEmployee = await SocietyEmployee.findOne({
          userId: user._id,
          isDeleted: { $ne: true },
        }).lean();

        if (societyEmployee) {
          if (societyEmployee.status !== "ACTIVE") {
            throw ApiError.forbidden(
              "Society Employee account is currently inactive.",
            );
          }

          bankId = societyEmployee.bankId;
          branchId = societyEmployee.branchId;
          profileId = societyEmployee._id;
          roleId = societyEmployee.roleId || null;

          const [branch, bank] = await Promise.all([
            Branch.findOne({ _id: branchId, isDeleted: { $ne: true } }).lean(),
            Bank.findOne({ _id: bankId, isDeleted: { $ne: true } }).lean(),
          ]);

          if (bank) {
            const bankStatusUpper = (bank.status || "").toUpperCase();
            if (
              [
                "PENDING",
                "ON_VERIFICATION",
                "REJECTED",
                "INACTIVE",
                "BLOCKED",
              ].includes(bankStatusUpper) ||
              (bankStatusUpper !== "APPROVED" && bankStatusUpper !== "ACTIVE")
            ) {
              if (
                bankStatusUpper === "PENDING" ||
                bankStatusUpper === "ON_VERIFICATION"
              ) {
                throw ApiError.forbidden(
                  "The parent Co-operative Bank onboarding is currently PENDING approval. Access denied.",
                );
              }
              if (bankStatusUpper === "REJECTED") {
                throw ApiError.forbidden(
                  "The parent Co-operative Bank onboarding request has been REJECTED. Access denied.",
                );
              }
              throw ApiError.forbidden(
                `Parent Co-operative Bank status is ${bank.status}. Access denied.`,
              );
            }
          }

          const empRoleCode = normalizeRoleCode(
            requestedRole || userRole || "EMPLOYEE",
          );
          const predefinedRole = PREDEFINED_SOCIETY_ROLES.find(
            (r) => r.code === empRoleCode,
          );

          roleName =
            predefinedRole?.name || societyEmployee.designation || "Employee";
          permissions = predefinedRole ? predefinedRole.permissions : [];

          bankDetails = bank
            ? { id: bank._id, name: bank.name, code: bank.code }
            : null;
          branchDetails = branch
            ? {
                id: branch._id,
                name: branch.name,
                code: branch.code,
                cardStock: branch.cardStock || 0,
                verificationCredits: branch.verificationCredits || 0,
              }
            : null;
        } else {
          // Fallback for generic EmployeeProfile if present
          const employee = await EmployeeProfile.findOne({
            userId: user._id,
            isDeleted: { $ne: true },
          }).lean();

          if (employee) {
            profileId = employee._id;
            branchId = employee.branchId || null;

            if (branchId) {
              const branch = await Branch.findOne({
                _id: branchId,
                isDeleted: { $ne: true },
              }).lean();
              if (branch) {
                bankId = branch.bankId;
                branchDetails = {
                  id: branch._id,
                  name: branch.name,
                  code: branch.code,
                };
              }
            }
          } else {
            throw ApiError.forbidden(
              "No registered Society profile (Branch Manager / Employee) found for this account.",
            );
          }
        }
      }
    }

    // 6. Update last login timestamp
    user.lastLoginAt = new Date();
    await user.save();

    // Ensure non-bank-owner accounts do not receive cards_credit permissions
    if (
      isEmployeeRoleRequested ||
      (requestedRole !== UserRole.BANK_OWNER &&
        requestedRole !== UserRole.SOCIETY_ADMIN &&
        requestedRole !== UserRole.SUPER_ADMIN)
    ) {
      permissions = (permissions || []).filter(
        (p) => !p.startsWith("cards_credit"),
      );
    }

    // 7. Generate JWT access and refresh tokens
    const tokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: requestedRole,
      userType: user.userType,
      bankId: bankId ? bankId.toString() : null,
      branchId: branchId ? branchId.toString() : null,
      profileId: profileId ? profileId.toString() : null,
      roleId: roleId ? roleId.toString() : null,
      permissions: permissions || [],
    };

    const accessToken = jwtUtil.signAccess(tokenPayload);
    const refreshToken = jwtUtil.signRefresh(tokenPayload);

    return {
      user: {
        id: user._id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        fullName: user.fullName || bankDetails?.name || "User",
        role: requestedRole,
        userType: user.userType,
        status: user.status,
        lastLoginAt: user.lastLoginAt,
      },
      context: {
        bankId,
        branchId,
        employeeId: profileId,
        bank: bankDetails,
        branch: branchDetails,
      },
      role: {
        id: roleId,
        name: roleName,
      },
      permissions,
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  /**
   * Refresh JWT Session
   */
  async refresh(token) {
    if (!token) {
      throw ApiError.unauthorized("Refresh token is required.");
    }

    const decoded = jwtUtil.verifyRefresh(token);
    if (!decoded) {
      throw ApiError.unauthorized("Refresh token expired or invalid.");
    }

    const user = await User.findOne({
      _id: decoded.userId,
      isDeleted: { $ne: true },
    });
    if (!user || user.status !== "ACTIVE") {
      throw ApiError.forbidden("User session is invalid or account inactive.");
    }

    const tokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: decoded.role || user.role,
      userType: user.userType,
      bankId: decoded.bankId || null,
      branchId: decoded.branchId || null,
      profileId: decoded.profileId || null,
      roleId: decoded.roleId || null,
    };

    const accessToken = jwtUtil.signAccess(tokenPayload);
    const newRefreshToken = jwtUtil.signRefresh(tokenPayload);

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Get all available system and database roles
   */
  async getAvailableRoles(queryBankId = null) {
    // 1. Primary System Portal Roles
    const systemRoles = [
      {
        id: UserRole.BANK_OWNER,
        name: "Bank Owner / Society Admin",
        code: UserRole.BANK_OWNER,
        description: "Co-operative Bank or Society Tenant Administrator",
        isSystemRole: true,
      },
      {
        id: UserRole.BRANCH_MANAGER,
        name: "Branch Manager",
        code: UserRole.BRANCH_MANAGER,
        description: "Branch Operational Manager",
        isSystemRole: true,
      },
      {
        id: UserRole.EMPLOYEE,
        name: "Society Employee",
        code: UserRole.EMPLOYEE,
        description: "Standard Bank / Branch Staff Member",
        isSystemRole: true,
      },
    ];

    // 2. Fetch custom active roles from database (SocietyRole collection)
    const filter = {
      isDeleted: { $ne: true },
      status: "ACTIVE",
    };

    if (queryBankId) {
      filter.bankId = queryBankId;
    }

    const dbRoles = await SocietyRole.find(filter)
      .select(
        "_id name code description permissions isSystemRole status bankId",
      )
      .sort({ createdAt: -1 })
      .lean();

    const customRoles = dbRoles.map((r) => ({
      id: r._id.toString(),
      name: r.name,
      code: r.code,
      description: r.description || "",
      permissions: r.permissions || [],
      isSystemRole: r.isSystemRole || false,
      status: r.status,
      bankId: r.bankId,
    }));

    return {
      systemRoles,
      customRoles,
      allRoles: [
        ...systemRoles,
        ...customRoles.filter(
          (cRole) =>
            !systemRoles.some((sysRole) => sysRole.code === cRole.code),
        ),
      ],
    };
  }

  /**
   * Request OTP for Forgot Password (by registered Email address)
   */
  async forgotPassword({ email }) {
    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail) {
      throw ApiError.badRequest("Registered email address is required.");
    }

    const user = await User.findOne({
      email: cleanEmail,
      isDeleted: { $ne: true },
    });

    if (!user) {
      throw ApiError.notFound(
        "No society user account registered with this email address.",
      );
    }

    if (user.status !== "ACTIVE") {
      throw ApiError.forbidden(
        `Account is currently ${user.status}. Please contact support.`,
      );
    }

    const otp = generateOtp(6, { numericOnly: true });
    const expirationMinutes = 10;

    user.resetOtp = otp;
    user.resetOtpExpires = new Date(Date.now() + expirationMinutes * 60 * 1000);
    user.resetVerifiedAt = null;
    await user.save();

    logger.info(
      `SOCIETY AUTH: Password reset OTP [${otp}] generated for email: ${user.email}`,
    );

    // Dispatch OTP via MSG91 Email API using template "6a7982eca2cadb62ad0db6f4"
    const templateId =
      msg91TemplateConfig.SOCIETY_PANEL?.FORGOT_MPIN_OTP ||
      "6a7982eca2cadb62ad0db6f4";
    try {
      const emailResult = await mailer.sendMail({
        to: user.email,
        name: user.fullName || "Society User",
        subject: "Sahayaone ERP - Society Portal Password Reset OTP Code",
        templateId,
        variables: {
          otp,
          OTP: otp,
          user_name: user.fullName || "User",
          name: user.fullName || "User",
          email: user.email,
        },
      });
      logger.info(
        `SOCIETY AUTH: MSG91 Email OTP dispatch result for [${user.email}]:`,
        emailResult,
      );
    } catch (emailErr) {
      logger.error(
        `SOCIETY AUTH: Failed to dispatch MSG91 Email OTP to [${user.email}]: ${emailErr.message}`,
      );
    }

    return {
      email: user.email,
      otp: process.env.NODE_ENV === "production" ? undefined : otp,
      message: `A 6-digit verification OTP code has been dispatched to ${user.email}`,
    };
  }

  /**
   * Verify 6-digit OTP code for password reset
   */
  async verifyOtp({ email, otp }) {
    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanOtp = (otp || "").trim();

    if (!cleanEmail || !cleanOtp) {
      throw ApiError.badRequest(
        "Email address and 6-digit OTP code are required.",
      );
    }

    const user = await User.findOne({
      email: cleanEmail,
      isDeleted: { $ne: true },
    });

    if (!user) {
      throw ApiError.notFound("User account record not found.");
    }

    const isDevMock =
      cleanOtp === "123456" && process.env.NODE_ENV !== "production";
    const isLiveValid =
      user.resetOtp &&
      user.resetOtp === cleanOtp &&
      user.resetOtpExpires &&
      user.resetOtpExpires > new Date();

    if (!isDevMock && !isLiveValid) {
      throw ApiError.badRequest("Invalid or expired verification OTP code.");
    }

    user.resetOtp = null;
    user.resetOtpExpires = null;
    user.resetVerifiedAt = new Date();
    await user.save();

    const resetToken = jwtUtil.signAccess({
      userId: user._id.toString(),
      email: user.email,
      purpose: "SOCIETY_PASSWORD_RESET",
    });

    logger.info(
      `SOCIETY AUTH: OTP verified successfully for email: ${user.email}`,
    );

    return {
      email: user.email,
      resetToken,
      message: "OTP verified successfully. You can now reset your password.",
    };
  }

  /**
   * Reset Password after OTP verification
   */
  async resetPassword({ email, password, confirmPassword, resetToken }) {
    const cleanEmail = (email || "").trim().toLowerCase();

    if (!resetToken) {
      throw ApiError.unauthorized(
        "Reset token is required. Please verify OTP first.",
      );
    }

    if (!password) {
      throw ApiError.badRequest("New password is required.");
    }

    if (password !== confirmPassword) {
      throw ApiError.badRequest(
        "New password and confirm password do not match.",
      );
    }

    let decoded = null;
    try {
      decoded = jwtUtil.verifyAccess(resetToken);
    } catch (err) {
      throw ApiError.unauthorized("Invalid or expired reset token.");
    }

    if (
      !decoded ||
      !decoded.userId ||
      decoded.purpose !== "SOCIETY_PASSWORD_RESET"
    ) {
      throw ApiError.unauthorized("Invalid reset token authorization.");
    }

    const user = await User.findOne({
      _id: decoded.userId,
      isDeleted: { $ne: true },
    });
    if (!user) {
      throw ApiError.notFound("User account not found.");
    }

    if (cleanEmail && user.email !== cleanEmail) {
      throw ApiError.unauthorized(
        "Email address mismatch with reset token authorization.",
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    user.passwordHash = passwordHash;
    user.resetVerifiedAt = null;
    user.resetOtp = null;
    user.resetOtpExpires = null;
    await user.save();

    logger.info(
      `SOCIETY AUTH: Password successfully reset for user email: ${user.email}`,
    );

    return {
      email: user.email,
      message:
        "Your password has been successfully reset. You can now log in with your new password.",
    };
  }

  /**
   * Resend OTP for Forgot Password
   */
  async resendOtp({ email }) {
    return this.forgotPassword({ email });
  }
}

export const societyAuthService = new SocietyAuthService();
