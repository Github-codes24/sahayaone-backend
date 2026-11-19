import { getAvailableSocietyPermissionsGrouped } from '../../../../constants/society-permission.constant.js';
import { getAvailableInventoryPermissionsGrouped } from '../../../../constants/inventory-permission.constant.js';

export class SocietyPermissionService {
  /**
   * Retrieves list of available modules and checkbox capabilities for frontend role creation
   */
  async getAvailablePermissions() {
    const basePermissions = getAvailableSocietyPermissionsGrouped();
    const inventoryPermissions = getAvailableInventoryPermissionsGrouped();

    const existingModules = new Set(basePermissions.modules.map((m) => m.module));
    const extraInventoryModules = inventoryPermissions.modules.filter(
      (m) => !existingModules.has(m.module)
    );

    return {
      ...basePermissions,
      modules: [...basePermissions.modules, ...extraInventoryModules],
      inventoryPredefinedRoles: inventoryPermissions.predefinedRoles || []
    };
  }
}

export const societyPermissionService = new SocietyPermissionService();
