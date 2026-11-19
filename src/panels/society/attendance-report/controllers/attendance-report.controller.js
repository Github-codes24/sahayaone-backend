import { BaseController } from '../../../../common/base.controller.js';
import { attendanceReportService } from '../services/attendance-report.service.js';
import { societyAttendanceService } from '../../attendance/services/society-attendance.service.js';

export class AttendanceReportController extends BaseController {
  constructor() {
    super();
    this.getFilters = this.getFilters.bind(this);
    this.getReport = this.getReport.bind(this);
    this.getSinglePersonReport = this.getSinglePersonReport.bind(this);
  }

  async getFilters(req, res, next) {
    try {
      const result = await attendanceReportService.getFilters(req.society, req.query.state);
      return this.sendResponse(res, 200, result, 'Attendance filters retrieved successfully.');
    } catch (error) { next(error); }
  }

  async getReport(req, res, next) {
    try {
      const result = await attendanceReportService.getReport(req.society, req.query);
      return this.sendPaginated(res, result.items, result.meta, 'Attendance report retrieved successfully.');
    } catch (error) { next(error); }
  }

  async getSinglePersonReport(req, res, next) {
    try {
      const targetId = req.params.id || req.query.employeeId || req.query.userId || req.query.id;
      const result = await societyAttendanceService.getSinglePersonAttendanceReport(req.society, targetId, req.query);
      return this.sendResponse(res, 200, result, 'Single person attendance report retrieved successfully.');
    } catch (error) { next(error); }
  }
}

export const attendanceReportController = new AttendanceReportController();
