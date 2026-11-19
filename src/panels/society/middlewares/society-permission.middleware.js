import { ApiError } from '../../../common/api.error.js';
import { SocietyRole } from '../../../models/society-role.model.js';
import { ALL_SOCIETY_PERMISSIONS } from '../../../constants/society-permission.constant.js';

/**
 * Middleware enforcing fine-grained module permission authorization
 * @param {string} permission - Required permission string key (e.g. 'employee.view', 'cash_payment.create')
 */
export const requireSocietyPermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.society) {
        return next(ApiError.unauthorized('Society context not resolved. Access denied.'));
      }

      // 1. Bank Owner retains implicit full administrative access across society APIs
      if (req.society.isBankOwner) {
        return next();
      }

      // 2. Fetch current permissions for employee's assigned role from DB (fresh check)
      let permissions = req.society.permissions;

      if ((!permissions || permissions.length === 0) && req.society.roleId) {
        const role = await SocietyRole.findOne({
          _id: req.society.roleId,
          isDeleted: { $ne: true }
        }).lean();
        if (role && role.status === 'ACTIVE') {
          permissions = role.permissions || [];
          req.society.permissions = permissions;
        }
      }

      // 3. Ensure permissions array is defined
      permissions = permissions || [];

      // 4. Super-admin or wildcard permissions check
      if (permissions.includes('*:*') || permissions.includes('ALL_PERMISSIONS')) {
        return next();
      }

      // 5. Verify specific permission key or list of alternative keys
      const requiredPermissions = Array.isArray(permission) ? permission : [permission];
      const hasPermission = requiredPermissions.some((p) => permissions.includes(p));

      if (!hasPermission) {
        return next(
          ApiError.forbidden(
            `Access denied. Required capability [${requiredPermissions.join(' or ')}] is not granted to your assigned role.`
          )
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
