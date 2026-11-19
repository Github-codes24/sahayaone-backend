import { BaseController } from '../../../../common/base.controller.js';
import { employeeKpaService } from '../services/employee-kpa.service.js';

export class EmployeeKpaController extends BaseController {
  constructor() {
    super();
    this.getMyKpaReportDetail = this.catchAsync(this.getMyKpaReportDetail.bind(this));
    this.getMyDailyWorkReports = this.catchAsync(this.getMyDailyWorkReports.bind(this));
    this.createMyDailyWorkReport = this.catchAsync(this.createMyDailyWorkReport.bind(this));
  }

  async getMyKpaReportDetail(req, res, next) {
    const userId = req.user.id;
    const result = await employeeKpaService.getMyKpaReportDetail(userId, req.query);
    return this.sendResponse(res, 200, result, 'Your KPA targets performance details retrieved successfully.');
  }

  async getMyDailyWorkReports(req, res, next) {
    const userId = req.user.id;
    const result = await employeeKpaService.getMyDailyWorkReports(userId, req.query);
    return this.sendPaginated(res, result.items, result.meta, 'Your Daily Work Reports list retrieved successfully.');
  }

  async createMyDailyWorkReport(req, res, next) {
    const userId = req.user.id;
    const result = await employeeKpaService.createMyDailyWorkReport(userId, req.body);
    return this.sendCreated(res, result, 'Daily Work Report logged successfully.');
  }
}

export const employeeKpaController = new EmployeeKpaController();
