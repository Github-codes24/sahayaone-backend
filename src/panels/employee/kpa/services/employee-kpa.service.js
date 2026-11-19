import { User } from '../../../../models/user.model.js';
import { SocietyEmployee } from '../../../../models/society-employee.model.js';
import { BranchManager } from '../../../../models/branch-manager.model.js';
import { societyEmployeeHrService } from '../../../society/employees/services/society-employee-hr.service.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';

export class EmployeeKpaService {
  /**
   * Resolve employee profile ID and Bank ID from logged-in User ID
   */
  async resolveEmployeeContext(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound('Employee account not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    let profile = null;
    if (user.profileId) {
      profile = await SocietyEmployee.findById(user.profileId);
      if (!profile) {
        profile = await BranchManager.findById(user.profileId);
      }
    }

    if (!profile) {
      profile = await SocietyEmployee.findOne({ userId, isDeleted: { $ne: true } });
    }
    if (!profile) {
      profile = await BranchManager.findOne({ userId, isDeleted: { $ne: true } });
    }

    if (!profile) {
      throw ApiError.notFound('Employee profile record not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    return {
      userId: user._id,
      bankId: profile.bankId || user.bankId,
      employeeId: profile._id,
      branchId: profile.branchId,
      fullName: profile.fullName
    };
  }

  /**
   * Get synced KPA targets breakdown for logged-in employee
   */
  async getMyKpaReportDetail(userId, queryParams = {}) {
    const ctx = await this.resolveEmployeeContext(userId);
    return societyEmployeeHrService.getKpaReportDetail(
      ctx.bankId,
      ctx.employeeId,
      queryParams,
      ctx.branchId
    );
  }

  /**
   * List Daily Work Reports logged for or by logged-in employee
   */
  async getMyDailyWorkReports(userId, queryParams = {}) {
    const ctx = await this.resolveEmployeeContext(userId);
    const query = {
      ...queryParams,
      employeeId: ctx.employeeId.toString()
    };
    return societyEmployeeHrService.listDailyWorkReports(ctx.bankId, query, ctx.branchId);
  }

  /**
   * Log a new Daily Work Report from Employee Panel
   */
  async createMyDailyWorkReport(userId, payload = {}) {
    const ctx = await this.resolveEmployeeContext(userId);
    const body = {
      ...payload,
      employeeId: ctx.employeeId.toString()
    };
    return societyEmployeeHrService.createDailyWorkReport(ctx.bankId, body, ctx.userId);
  }
}

export const employeeKpaService = new EmployeeKpaService();
