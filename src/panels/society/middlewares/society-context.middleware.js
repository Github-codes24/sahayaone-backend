import { Bank } from '../../../models/bank.model.js';
import { BranchManager } from '../../../models/branch-manager.model.js';
import { SocietyEmployee } from '../../../models/society-employee.model.js';
import { User } from '../../../models/user.model.js';
import { SocietyRole } from '../../../models/society-role.model.js';
import { ApiError } from '../../../common/api.error.js';
import { UserRole, UserType } from '../../../constants/user-role.constant.js';
import { ALL_SOCIETY_PERMISSIONS } from '../../../constants/society-permission.constant.js';
import { PREDEFINED_SOCIETY_ROLES, normalizeRoleCode, isBranchManagerRole, isQualityCheckRole } from '../../../constants/society-role.constant.js';

/**
 * Middleware to resolve and attach isolated tenant context (bankId, branchId, roleId, permissions)
 * directly from database identity records.
 * NEVER trusts client-supplied bankId or branchId parameters.
 */
export const resolveSocietyContext = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return next(ApiError.unauthorized('User identity not loaded. Access denied.'));
    }

    const userId = req.user.id;
    const role = (req.user.role || '').toUpperCase();

    const userDoc = await User.findById(userId).select('fullName email phoneNumber').lean();
    const userFullName = userDoc?.fullName || req.user.fullName || userDoc?.email || req.user.email || null;

    let bankId = null;
    let branchId = null;
    let profileId = null;
    let roleId = null;
    let permissions = [];
    let bank = null;

    const isBankOwner = [UserRole.BANK_OWNER, UserRole.SOCIETY_ADMIN, UserRole.VENDOR, UserRole.SUPER_ADMIN].includes(role);
    const isBranchManager = isBranchManagerRole(role);
    const isEmployee = req.user.userType === UserType.EMPLOYEE || [UserRole.EMPLOYEE, UserRole.SALES_AGENT, UserRole.RECOVERY_AGENT, UserRole.COLLECTION_AGENT, UserRole.LOAN_EXECUTIVE, UserRole.COLLECTION_EXECUTIVE, UserRole.RECEIPT_MANAGER, UserRole.INVENTORY_MANAGER].includes(role);


    let userName = null;

    // 1. Bank Owner / Society Admin / Vendor Role
    if (isBankOwner) {
      bank = await Bank.findOne({
        $or: [{ userId }, { email: req.user.email?.toLowerCase() }],
        isDeleted: { $ne: true }
      }).lean();

      if (!bank && role !== UserRole.SUPER_ADMIN) {
        return next(ApiError.forbidden('No registered Bank/Society account found for this user.'));
      }

      if (bank) {
        const bankStatusUpper = (bank.status || '').toUpperCase();
        if (['PENDING', 'ON_VERIFICATION', 'REJECTED', 'INACTIVE', 'BLOCKED'].includes(bankStatusUpper) || (bankStatusUpper !== 'APPROVED' && bankStatusUpper !== 'ACTIVE')) {
          if (bankStatusUpper === 'PENDING' || bankStatusUpper === 'ON_VERIFICATION') {
            return next(ApiError.forbidden('Your Co-operative Bank onboarding request is currently PENDING approval or payment verification. Access denied.'));
          }
          if (bankStatusUpper === 'REJECTED') {
            return next(ApiError.forbidden('Your Co-operative Bank onboarding request has been REJECTED. Access denied.'));
          }
          return next(ApiError.forbidden(`Co-operative Bank status is ${bank.status}. Access denied.`));
        }
        bankId = bank._id;
        profileId = bank._id;
        userName = userFullName || bank.ubo || bank.name || req.user?.email || 'Bank Owner';
      }
      permissions = ['*:*'];
    } else {
      // 2. Try Branch Manager Profile
      const manager = await BranchManager.findOne({
        userId,
        isDeleted: { $ne: true }
      }).lean();

      if (manager) {
        if (manager.status !== 'ACTIVE') {
          return next(ApiError.forbidden('Branch Manager account is currently inactive.'));
        }
        bankId = manager.bankId;
        branchId = manager.branchId;
        profileId = manager._id;
        roleId = manager.roleId || null;
        userName = manager.fullName || manager.name || req.user?.fullName || req.user?.email || 'Branch Manager';
      } else {
        // 3. Try Society Employee Profile
        const employee = await SocietyEmployee.findOne({
          userId,
          isDeleted: { $ne: true }
        }).lean();

        if (employee) {
          if (employee.status !== 'ACTIVE') {
            return next(ApiError.forbidden('Society Employee account is currently inactive.'));
          }
          bankId = employee.bankId;
          branchId = employee.branchId;
          profileId = employee._id;
          roleId = employee.roleId || null;
          userName = employee.fullName || employee.name || req.user?.fullName || req.user?.email || 'Society Employee';
        } else {
          return next(ApiError.forbidden('No active Society profile (Branch Manager / Employee) associated with this account.'));
        }
      }

      // Check linked bank status for Branch Manager or Employee
      if (bankId) {
        bank = await Bank.findOne({ _id: bankId, isDeleted: { $ne: true } }).lean();
        if (bank) {
          const bankStatusUpper = (bank.status || '').toUpperCase();
          if (['PENDING', 'ON_VERIFICATION', 'REJECTED', 'INACTIVE', 'BLOCKED'].includes(bankStatusUpper) || (bankStatusUpper !== 'APPROVED' && bankStatusUpper !== 'ACTIVE')) {
            if (bankStatusUpper === 'PENDING' || bankStatusUpper === 'ON_VERIFICATION') {
              return next(ApiError.forbidden('The parent Co-operative Bank onboarding is currently PENDING approval. Access denied.'));
            }
            if (bankStatusUpper === 'REJECTED') {
              return next(ApiError.forbidden('The parent Co-operative Bank onboarding request has been REJECTED. Access denied.'));
            }
            return next(ApiError.forbidden(`Parent Co-operative Bank status is ${bank.status}. Access denied.`));
          }
        }
      }

      // Resolve permissions directly from system role constants (hardcoded)
      const targetRoleStr = (role || req.user.role || '').trim();
      const normCode = normalizeRoleCode(targetRoleStr);
      const predefinedRole = PREDEFINED_SOCIETY_ROLES.find(r => r.code === normCode);

      permissions = predefinedRole ? predefinedRole.permissions : [];

      if (!isBankOwner) {
        permissions = (permissions || []).filter(p => !p.startsWith('cards_credit'));
      }
    }

    const normRoleCode = normalizeRoleCode(role || req.user?.role || '');
    const isBankWideReceiptManager = normRoleCode === 'RECEIPT_MANAGER';
    const isQualityCheck = isQualityCheckRole(role || req.user?.role || '');

    req.society = {
      userId,
      userName: userName || req.user?.fullName || req.user?.email || 'Authorized User',
      role,
      bankId,
      branchId,
      profileId,
      roleId,
      permissions,
      isBankOwner,
      isBranchManager,
      isEmployee,
      isBankWideReceiptManager,
      isQualityCheck,
      bank
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware requiring Bank Owner privileges.
 */
export const requireBankOwner = (req, res, next) => {
  const isSuperAdmin = (req.society?.role || '').toUpperCase() === 'SUPER_ADMIN';
  if (!req.society || (!isSuperAdmin && (!req.society.bankId || !req.society.isBankOwner))) {
    return next(ApiError.forbidden('Access denied. Bank Owner or Society Admin privileges required.'));
  }
  next();
};

/**
 * Middleware requiring Branch Manager privileges.
 */
export const requireBranchManager = (req, res, next) => {
  if (!req.society || !req.society.branchId) {
    return next(ApiError.forbidden('Access denied. Branch Manager privileges required.'));
  }
  next();
};

/**
 * Middleware allowing access to Bank Owner, Branch Manager, and HR / HR Executive roles.
 */
export const requireHrOrBankOwnerOrManager = (req, res, next) => {
  const roleUpper = (req.society?.role || '').toUpperCase();
  const isSuperAdmin = roleUpper === 'SUPER_ADMIN';
  if (!req.society || (!isSuperAdmin && !req.society.bankId)) {
    return next(ApiError.unauthorized('Society context not resolved. Access denied.'));
  }

  const isHr = roleUpper.includes('HR') || (req.society.permissions && (req.society.permissions.includes('employee.view') || req.society.permissions.includes('employee.create') || req.society.permissions.includes('*:*')));
  const isAuthorized = isSuperAdmin || req.society.isBankOwner || req.society.isBranchManager || isHr;

  if (!isAuthorized) {
    return next(ApiError.forbidden('Access denied. Only Bank Owner, Branch Manager, or HR roles are authorized to access this feature.'));
  }

  next();
};
