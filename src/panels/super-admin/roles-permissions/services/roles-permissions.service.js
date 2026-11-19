import { Admin } from '../../../../models/admin.model.js';
import { cryptoUtil } from '../../../../utils/crypto.util.js';
import { ApiError } from '../../../../common/api.error.js';
import { UserRole } from '../../../../constants/user-role.constant.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';

export class RolesPermissionsService {
  /**
   * Retrieves a paginated list of Sub-Admins, supporting name/email/phone searches
   */
  async listSubAdmins(queryOptions) {
    const page = parseInt(queryOptions.page || '1', 10);
    const limit = parseInt(queryOptions.limit || '10', 10);
    const search = queryOptions.search || '';
    const skip = (page - 1) * limit;

    const filter = {
      role: UserRole.SUB_ADMIN,
      isDeleted: { $ne: true }
    };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const [items, totalRecords] = await Promise.all([
      Admin.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Admin.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalRecords / limit);

    return {
      items,
      meta: {
        totalRecords,
        limit,
        page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  }

  /**
   * Retrieves details of a specific Sub-Admin by ID
   */
  async getSubAdminById(id) {
    const admin = await Admin.findOne({
      _id: id,
      role: UserRole.SUB_ADMIN,
      isDeleted: { $ne: true }
    }).lean();

    if (!admin) {
      throw ApiError.notFound('Sub-Admin user account not found in system storage.');
    }

    return admin;
  }

  /**
   * Creates a new Sub-Admin user account
   */
  async createSubAdmin(payload, creatorId) {
    const { name, email, phoneNumber, password, permissions } = payload;

    // 1. Check duplicate email
    const duplicateEmail = await Admin.findOne({ email, isDeleted: { $ne: true } });
    if (duplicateEmail) {
      throw ApiError.conflict('An administrator account with this email address already exists.', ErrorCode.VALIDATION_ERROR);
    }

    // 2. Check duplicate phone
    const duplicatePhone = await Admin.findOne({ phoneNumber, isDeleted: { $ne: true } });
    if (duplicatePhone) {
      throw ApiError.conflict('An administrator account with this phone number already exists.', ErrorCode.VALIDATION_ERROR);
    }

    // 3. Hash password
    const passwordHash = await cryptoUtil.hash(password);

    // 4. Create record
    const subAdmin = new Admin({
      name,
      email,
      phoneNumber,
      passwordHash,
      role: UserRole.SUB_ADMIN,
      permissions,
      status: 'ACTIVE',
      createdBy: creatorId
    });

    await subAdmin.save();
    return subAdmin;
  }

  /**
   * Updates an existing Sub-Admin user account
   */
  async updateSubAdmin(id, payload, updaterId) {
    const subAdmin = await Admin.findOne({
      _id: id,
      role: UserRole.SUB_ADMIN,
      isDeleted: { $ne: true }
    });

    if (!subAdmin) {
      throw ApiError.notFound('Sub-Admin user account not found for updates.');
    }

    const { name, email, phoneNumber, password, permissions, status } = payload;

    // 1. Validate email uniqueness
    if (email && email !== subAdmin.email) {
      const duplicateEmail = await Admin.findOne({ email, isDeleted: { $ne: true } });
      if (duplicateEmail) {
        throw ApiError.conflict('An administrator account with this email address already exists.', ErrorCode.VALIDATION_ERROR);
      }
      subAdmin.email = email;
    }

    // 2. Validate phone uniqueness
    if (phoneNumber && phoneNumber !== subAdmin.phoneNumber) {
      const duplicatePhone = await Admin.findOne({ phoneNumber, isDeleted: { $ne: true } });
      if (duplicatePhone) {
        throw ApiError.conflict('An administrator account with this phone number already exists.', ErrorCode.VALIDATION_ERROR);
      }
      subAdmin.phoneNumber = phoneNumber;
    }

    // 3. Update name
    if (name) {
      subAdmin.name = name;
    }

    // 4. Update status
    if (status) {
      subAdmin.status = status;
    }

    // 5. Update permissions
    if (permissions) {
      subAdmin.permissions = permissions;
    }

    // 6. Update password if provided
    if (password) {
      subAdmin.passwordHash = await cryptoUtil.hash(password);
    }

    subAdmin.updatedBy = updaterId;
    await subAdmin.save();

    return subAdmin;
  }

  /**
   * Soft deletes a Sub-Admin user account
   */
  async deleteSubAdmin(id, deleterId) {
    const subAdmin = await Admin.findOne({
      _id: id,
      role: UserRole.SUB_ADMIN,
      isDeleted: { $ne: true }
    });

    if (!subAdmin) {
      throw ApiError.notFound('Sub-Admin user account not found for deletion.');
    }

    subAdmin.isDeleted = true;
    subAdmin.deletedAt = new Date();
    subAdmin.deletedBy = deleterId;
    await subAdmin.save();

    return subAdmin;
  }

  /**
   * Returns list of available modules and capabilities to populate UI checkboxes
   */
  async getAvailablePermissions() {
    return [
      {
        module: 'Dashboard',
        permissions: [
          { label: 'View Only', value: 'dashboard:view_only' },
          { label: 'Create', value: 'dashboard:create' },
          { label: 'Edit', value: 'dashboard:edit' },
          { label: 'Delete', value: 'dashboard:delete' }
        ]
      },
      {
        module: 'Co-operative Bank',
        permissions: [
          { label: 'View Only', value: 'co_operative_bank:view_only' },
          { label: 'Create', value: 'co_operative_bank:create' },
          { label: 'Edit', value: 'co_operative_bank:edit' },
          { label: 'Delete', value: 'co_operative_bank:delete' }
        ]
      },
      {
        module: 'Merchant',
        permissions: [
          { label: 'View Only', value: 'merchant:view_only' },
          { label: 'Create', value: 'merchant:create' },
          { label: 'Edit', value: 'merchant:edit' },
          { label: 'Delete', value: 'merchant:delete' }
        ]
      },
      {
        module: 'Customers',
        permissions: [
          { label: 'View Only', value: 'customers:view_only' },
          { label: 'Create', value: 'customers:create' },
          { label: 'Edit', value: 'customers:edit' },
          { label: 'Delete', value: 'customers:delete' }
        ]
      },
      {
        module: 'Leads',
        permissions: [
          { label: 'View Only', value: 'leads:view_only' },
          { label: 'Create', value: 'leads:create' },
          { label: 'Edit', value: 'leads:edit' },
          { label: 'Delete', value: 'leads:delete' }
        ]
      },
      {
        module: 'Onboarding Team',
        permissions: [
          { label: 'View Only', value: 'onboarding_team:view_only' },
          { label: 'Create', value: 'onboarding_team:create' },
          { label: 'Edit', value: 'onboarding_team:edit' },
          { label: 'Delete', value: 'onboarding_team:delete' }
        ]
      },
      {
        module: 'Cash Payment',
        permissions: [
          { label: 'View Only', value: 'cash_payment:view_only' },
          { label: 'Create', value: 'cash_payment:create' },
          { label: 'Edit', value: 'cash_payment:edit' },
          { label: 'Delete', value: 'cash_payment:delete' }
        ]
      },
      {
        module: 'Notification',
        permissions: [
          { label: 'View Only', value: 'notification:view_only' },
          { label: 'Create', value: 'notification:create' },
          { label: 'Edit', value: 'notification:edit' },
          { label: 'Delete', value: 'notification:delete' }
        ]
      },
      {
        module: 'Roles & Permissions',
        permissions: [
          { label: 'View Only', value: 'roles_permissions:view_only' },
          { label: 'Create', value: 'roles_permissions:create' },
          { label: 'Edit', value: 'roles_permissions:edit' },
          { label: 'Delete', value: 'roles_permissions:delete' }
        ]
      },
      {
        module: 'Categories',
        permissions: [
          { label: 'View Only', value: 'categories:view_only' },
          { label: 'Create', value: 'categories:create' },
          { label: 'Edit', value: 'categories:edit' },
          { label: 'Delete', value: 'categories:delete' }
        ]
      },
      {
        module: 'Brands',
        permissions: [
          { label: 'View Only', value: 'brands:view_only' },
          { label: 'Create', value: 'brands:create' },
          { label: 'Edit', value: 'brands:edit' },
          { label: 'Delete', value: 'brands:delete' }
        ]
      },
      {
        module: 'Products',
        permissions: [
          { label: 'View Only', value: 'products:view_only' },
          { label: 'Create', value: 'products:create' },
          { label: 'Edit', value: 'products:edit' },
          { label: 'Delete', value: 'products:delete' }
        ]
      },
      {
        module: 'Banner Management',
        permissions: [
          { label: 'View Only', value: 'banner_management:view_only' },
          { label: 'Create', value: 'banner_management:create' },
          { label: 'Edit', value: 'banner_management:edit' },
          { label: 'Delete', value: 'banner_management:delete' }
        ]
      }
    ];
  }
}

export const rolesPermissionsService = new RolesPermissionsService();
