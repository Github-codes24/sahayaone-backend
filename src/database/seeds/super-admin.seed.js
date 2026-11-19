import { Admin } from '../../models/admin.model.js';
import { cryptoUtil } from '../../utils/crypto.util.js';
import { UserRole } from '../../constants/user-role.constant.js';
import { logger } from '../../utils/logger.util.js';

export async function seedSuperAdmin() {
  const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin123@sahayaone.com';
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'Admin@2001';
//
  try {
    const existingAdmin = await Admin.findOne({ role: UserRole.SUPER_ADMIN });

    if (existingAdmin) {
      logger.info(`SEEDER: Super Admin already seeded with email: ${existingAdmin.email}`);
      // Ensure permissions array is set
      if (!existingAdmin.permissions || existingAdmin.permissions.length === 0) {
        existingAdmin.permissions = ['ALL_PERMISSIONS'];
        await existingAdmin.save();
      }
      return;
    }

    const passwordHash = await cryptoUtil.hash(adminPassword);

    const superAdmin = new Admin({
      name: 'Sahayaone Super Admin',
      email: adminEmail,
      phoneNumber: '9999999999',
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      status: 'ACTIVE',
      permissions: ['ALL_PERMISSIONS']
    });

    await superAdmin.save();
    logger.info(`SEEDER SUCCESS: Super Admin seeded successfully with username: ${adminEmail}`);
  } catch (error) {
    logger.error(`SEEDER EXCEPTION: Seeding Super Admin failed: ${error.message}`);
    throw error;
  }
}

export async function seedSubAdmin() {
  const subAdminEmail = 'subadmin@sahayaone.com';
  const subAdminPassword = 'Subadmin@123';

  try {
    const existingSubAdmin = await Admin.findOne({ email: subAdminEmail });

    if (existingSubAdmin) {
      logger.info(`SEEDER: Sub-Admin already seeded with email: ${existingSubAdmin.email}`);
      return;
    }

    const passwordHash = await cryptoUtil.hash(subAdminPassword);

    const subAdmin = new Admin({
      name: 'Sahayaone Sub Admin',
      email: subAdminEmail,
      phoneNumber: '8888888888',
      passwordHash,
      role: UserRole.SUB_ADMIN,
      status: 'ACTIVE',
      permissions: [
        'dashboard:view_only',
        'co_operative_bank:view_only',
        'merchant:view_only',
        'customers:view_only',
        'customers:create',
        'customers:edit',
        'leads:view_only',
        'leads:create',
        'leads:edit',
        'roles_permissions:view_only'
      ]
    });

    await subAdmin.save();
    logger.info(`SEEDER SUCCESS: Sub-Admin seeded successfully with username: ${subAdminEmail}`);
  } catch (error) {
    logger.error(`SEEDER EXCEPTION: Seeding Sub-Admin failed: ${error.message}`);
    throw error;
  }
}
