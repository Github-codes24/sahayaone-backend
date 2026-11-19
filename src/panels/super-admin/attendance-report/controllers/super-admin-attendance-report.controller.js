import { BaseController } from '../../../../common/base.controller.js';
import { superAdminAttendanceReportService } from '../services/super-admin-attendance-report.service.js';
import { superAdminAttendanceService } from '../../attendance/services/super-admin-attendance.service.js';

export class SuperAdminAttendanceReportController extends BaseController {
  constructor() {
    super();
    this.getFilters = this.catchAsync(this.getFilters.bind(this));
    this.getReport = this.catchAsync(this.getReport.bind(this));
    this.getSinglePersonReport = this.catchAsync(this.getSinglePersonReport.bind(this));
  }

  async getFilters(req, res, next) {
    const result = await superAdminAttendanceReportService.getFilters();
    return this.sendResponse(res, 200, result, 'Attendance report filters retrieved successfully.');
  }

  async getReport(req, res, next) {
    const result = await superAdminAttendanceReportService.getReport(req.query);
    return this.sendResponse(res, 200, result, 'Attendance report retrieved successfully.');
  }

  async getSinglePersonReport(req, res, next) {
    const targetId = req.params.id || req.query.employeeId || req.query.userId || req.query.id || req.user.id;
    const result = await superAdminAttendanceService.getSinglePersonAttendanceReport(targetId, req.query);
    return this.sendResponse(res, 200, result, 'Single person attendance report retrieved successfully.');
  }
}

export const superAdminAttendanceReportController = new SuperAdminAttendanceReportController();
