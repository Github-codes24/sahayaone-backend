import { SocietyRole } from "../../../../models/society-role.model.js";
import { SocietyEmployee } from "../../../../models/society-employee.model.js";
import { BranchManager } from "../../../../models/branch-manager.model.js";
import { ApiError } from "../../../../common/api.error.js";
import { ALL_SOCIETY_PERMISSIONS } from "../../../../constants/society-permission.constant.js";
import { PREDEFINED_SOCIETY_ROLES, PREDEFINED_ROLE_CODES, normalizeRoleCode } from "../../../../constants/society-role.constant.js";

export class SocietyRoleService {
  /**
   * Helper to format SocietyRole response payload
   */
  formatRoleResponse(role) {
    if (!role) return null;
    return {
      id: role._id,
      roleId: role._id,
      bankId: role.bankId,
      name: role.name,
      code: role.code,
      description: role.description || "",
      permissions: role.permissions || [],
      isSystemRole: role.isSystemRole || false,
      status: role.status,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  /**
   * Ensure predefined system roles exist in DB for a specific Bank context.
   * Also deduplicates and migrates legacy alias role documents (e.g. BRANCH_MANAGER -> MANAGER).
   */
  async ensurePredefinedRolesForBank(bankId) {
    if (!bankId) return [];

    const existingRoles = await SocietyRole.find({
      bankId,
      isDeleted: { $ne: true }
    }).lean();

    const usedDocIds = new Set();

    for (const sysRole of PREDEFINED_SOCIETY_ROLES) {
      // Find candidate documents matching this predefined role (or legacy aliases)
      const matches = existingRoles.filter(r => {
        if (usedDocIds.has(r._id.toString())) return false;
        const normCode = normalizeRoleCode(r.code);
        return normCode === sysRole.code || r.name.toLowerCase() === sysRole.name.toLowerCase();
      });

      if (matches.length === 0) {
        // No match found -> Create fresh system role
        const newRole = await SocietyRole.create({
          bankId,
          name: sysRole.name,
          code: sysRole.code,
          description: sysRole.description,
          permissions: sysRole.permissions,
          isSystemRole: true,
          status: "ACTIVE"
        });
        usedDocIds.add(newRole._id.toString());
      } else {
        // Pick primary match (prefer matching sysRole.code && isSystemRole === true)
        const primary = matches.find(r => r.code === sysRole.code && r.isSystemRole)
          || matches.find(r => r.code === sysRole.code)
          || matches[0];

        usedDocIds.add(primary._id.toString());

        // Update primary document to standard code, name, description, permissions & system flag
        await SocietyRole.updateOne(
          { _id: primary._id },
          {
            $set: {
              code: sysRole.code,
              name: sysRole.name,
              description: sysRole.description,
              permissions: sysRole.permissions,
              isSystemRole: true,
              status: "ACTIVE"
            }
          }
        );

        // Deduplicate any leftover legacy matches (e.g. old BRANCH_MANAGER role doc)
        const duplicates = matches.filter(r => r._id.toString() !== primary._id.toString());
        for (const dup of duplicates) {
          usedDocIds.add(dup._id.toString());

          // Soft delete duplicate legacy role
          await SocietyRole.updateOne(
            { _id: dup._id },
            { $set: { isDeleted: true, status: "INACTIVE" } }
          );

          // Reassign employees & branch managers to primary role _id
          await SocietyEmployee.updateMany(
            { bankId, roleId: dup._id },
            { $set: { roleId: primary._id } }
          );
          await BranchManager.updateMany(
            { bankId, roleId: dup._id },
            { $set: { roleId: primary._id } }
          );
        }
      }
    }

    // Soft delete any unmapped legacy dynamic roles that were created previously
    const unmappedLegacy = existingRoles.filter(r => !usedDocIds.has(r._id.toString()) && !r.isSystemRole);
    for (const legacy of unmappedLegacy) {
      await SocietyRole.updateOne(
        { _id: legacy._id },
        { $set: { isDeleted: true, status: "INACTIVE" } }
      );
    }
  }

  /**
   * Create or Sync Predefined Role for Bank
   */
  async createRole(bankId, payload, creatorId) {
    if (!bankId) {
      throw ApiError.badRequest("Bank context is required for role creation.");
    }

    await this.ensurePredefinedRolesForBank(bankId);

    const rawCode = (payload.code || payload.name || "").trim().toUpperCase();
    const normalizedCode = normalizeRoleCode(rawCode);

    const matchedPredefined = PREDEFINED_SOCIETY_ROLES.find(
      r => r.code === normalizedCode || r.name.toLowerCase() === (payload.name || "").trim().toLowerCase()
    );

    if (!matchedPredefined) {
      throw ApiError.badRequest(
        `Dynamic custom roles are disabled. Please choose from predefined roles: ${PREDEFINED_ROLE_CODES.join(", ")}`
      );
    }

    const existingRole = await SocietyRole.findOne({
      bankId,
      code: matchedPredefined.code,
      isDeleted: { $ne: true }
    });

    if (existingRole) {
      existingRole.permissions = matchedPredefined.permissions;
      existingRole.isSystemRole = true;
      existingRole.status = "ACTIVE";
      await existingRole.save();
      return this.formatRoleResponse(existingRole);
    }

    const role = await SocietyRole.create({
      bankId,
      name: matchedPredefined.name,
      code: matchedPredefined.code,
      description: matchedPredefined.description,
      permissions: matchedPredefined.permissions,
      isSystemRole: true,
      status: "ACTIVE",
      createdBy: creatorId
    });

    return this.formatRoleResponse(role);
  }


  /**
   * List Roles (Bank-Scoped) - Auto-seeds predefined roles
   */
  async listRoles(bankId, queryOptions = {}) {
    if (!bankId) {
      throw ApiError.badRequest("Bank context is required.");
    }

    // Ensure all 7 predefined roles exist in DB
    await this.ensurePredefinedRolesForBank(bankId);

    const page = parseInt(queryOptions.page || "1", 10);
    const limit = parseInt(queryOptions.limit || "10", 10);
    const search = (queryOptions.search || "").trim();
    const status =
      queryOptions.status && queryOptions.status !== "ALL"
        ? queryOptions.status.toUpperCase()
        : null;
    const skip = (page - 1) * limit;

    const filter = {
      bankId,
      isDeleted: { $ne: true },
    };

    if (status) {
      filter.status = status;
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [
        { name: searchRegex },
        { code: searchRegex },
        { description: searchRegex },
      ];
    }

    const sortField = queryOptions.sortBy || "createdAt";
    const sortOrder =
      (queryOptions.sortOrder || "desc").toLowerCase() === "asc" ? 1 : -1;

    const [roles, totalRecords] = await Promise.all([
      SocietyRole.find(filter)
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      SocietyRole.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    const items = roles.map((r, idx) => ({
      srNo: skip + idx + 1,
      ...this.formatRoleResponse(r),
    }));

    return {
      items,
      meta: {
        totalRecords,
        limit,
        page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Get single Role by ID (Tenant-Scoped)
   */
  async getRoleById(bankId, roleId) {
    await this.ensurePredefinedRolesForBank(bankId);

    const role = await SocietyRole.findOne({
      _id: roleId,
      bankId,
      isDeleted: { $ne: true },
    }).lean();

    if (!role) {
      throw ApiError.notFound(
        "Role not found or does not belong to your bank.",
      );
    }

    return this.formatRoleResponse(role);
  }

  /**
   * Update Predefined Role (Tenant-Scoped)
   */
  async updateRole(bankId, roleId, payload, updaterId) {
    const role = await SocietyRole.findOne({
      _id: roleId,
      bankId,
      isDeleted: { $ne: true },
    });

    if (!role) {
      throw ApiError.notFound(
        "Role not found or does not belong to your bank.",
      );
    }

    if (payload.description !== undefined) {
      role.description = payload.description.trim();
    }
    if (payload.status) {
      role.status = payload.status.toUpperCase();
    }

    role.updatedBy = updaterId;
    await role.save();

    return this.formatRoleResponse(role);
  }

  /**
   * Deactivate / Soft Delete Role with Safety Checks
   */
  async deleteRole(bankId, roleId, deleterId) {
    const role = await SocietyRole.findOne({
      _id: roleId,
      bankId,
      isDeleted: { $ne: true },
    });

    if (!role) {
      throw ApiError.notFound(
        "Role not found or does not belong to your bank.",
      );
    }

    if (role.isSystemRole) {
      throw ApiError.forbidden("Predefined system roles cannot be deleted.");
    }

    // Safety check: verify no active employees are assigned to this role
    const activeEmployeeAssigned = await SocietyEmployee.findOne({
      bankId,
      roleId,
      status: "ACTIVE",
      isDeleted: { $ne: true },
    });

    const activeManagerAssigned = await BranchManager.findOne({
      bankId,
      roleId,
      status: "ACTIVE",
      isDeleted: { $ne: true },
    });

    if (activeEmployeeAssigned || activeManagerAssigned) {
      throw ApiError.conflict(
        "Role cannot be deleted because it is currently assigned to active employees.",
      );
    }

    role.isDeleted = true;
    role.deletedAt = new Date();
    role.deletedBy = deleterId;
    role.status = "INACTIVE";
    await role.save();

    return this.formatRoleResponse(role);
  }
}

export const societyRoleService = new SocietyRoleService();
