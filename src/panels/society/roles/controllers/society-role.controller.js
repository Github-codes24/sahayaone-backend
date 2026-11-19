import { BaseController } from "../../../../common/base.controller.js";
import { societyRoleService } from "../services/society-role.service.js";

export class SocietyRoleController extends BaseController {
  constructor() {
    super();
    this.createRole = this.createRole.bind(this);
    this.getRoles = this.getRoles.bind(this);
    this.getRoleById = this.getRoleById.bind(this);
    this.updateRole = this.updateRole.bind(this);
    this.deleteRole = this.deleteRole.bind(this);
  }

  /**
   * POST /api/v1/society/roles
   * Create Bank-Scoped Society Role
   */
  async createRole(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const creatorId = req.user.id;
      const result = await societyRoleService.createRole(
        bankId,
        req.body,
        creatorId,
      );
      return this.sendCreated(res, result, "Role created successfully.");
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/society/roles
   * List Roles belonging exclusively to authenticated Bank
   */
  async getRoles(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const result = await societyRoleService.listRoles(bankId, req.query);
      return this.sendPaginated(
        res,
        result.items,
        result.meta,
        "Roles retrieved successfully.",
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/society/roles/:id
   */
  async getRoleById(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const roleId = req.params.id;
      const result = await societyRoleService.getRoleById(bankId, roleId);
      return this.sendSuccess(
        res,
        result,
        "Role details retrieved successfully.",
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/society/roles/:id
   */
  async updateRole(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const roleId = req.params.id;
      const updaterId = req.user.id;
      const result = await societyRoleService.updateRole(
        bankId,
        roleId,
        req.body,
        updaterId,
      );
      return this.sendSuccess(res, result, "Role updated successfully.");
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/society/roles/:id
   */
  async deleteRole(req, res, next) {
    try {
      const bankId = req.society.bankId;
      const roleId = req.params.id;
      const deleterId = req.user.id;
      const result = await societyRoleService.deleteRole(
        bankId,
        roleId,
        deleterId,
      );
      return this.sendSuccess(res, result, "Role deleted successfully.");
    } catch (error) {
      next(error);
    }
  }
}

export const societyRoleController = new SocietyRoleController();
