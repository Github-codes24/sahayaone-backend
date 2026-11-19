import { BaseController } from '../../../../common/base.controller.js';
import { attendanceService } from '../services/attendance.service.js';

export class AttendanceController extends BaseController {
  constructor() {
    super();
    this.getTodayAttendance = this.catchAsync(this.getTodayAttendance.bind(this));
    this.punchIn = this.catchAsync(this.punchIn.bind(this));
    this.punchOut = this.catchAsync(this.punchOut.bind(this));
    this.getMonthlyReport = this.catchAsync(this.getMonthlyReport.bind(this));
    this.getAttendanceHistory = this.catchAsync(this.getAttendanceHistory.bind(this));
    this.applyLeave = this.catchAsync(this.applyLeave.bind(this));
  }

  async getTodayAttendance(req, res, next) {
    const result = await attendanceService.getTodayAttendance(req.user.id);
    return this.sendResponse(res, 200, result, 'Today attendance status retrieved successfully.');
  }

  async punchIn(req, res, next) {
    const latitude = req.body.latitude ?? req.body.latitute ?? req.body.lat ?? req.body.location?.latitude ?? req.body.location?.lat;
    const longitude = req.body.longitude ?? req.body.langitute ?? req.body.lng ?? req.body.location?.longitude ?? req.body.location?.lng;
    const address = req.body.address || req.body.location?.address || '';
    const result = await attendanceService.punchIn(req.user.id, latitude, longitude, address);
    return this.sendResponse(res, 200, result, result.message);
  }

  async punchOut(req, res, next) {
    const latitude = req.body.latitude ?? req.body.latitute ?? req.body.lat ?? req.body.location?.latitude ?? req.body.location?.lat;
    const longitude = req.body.longitude ?? req.body.langitute ?? req.body.lng ?? req.body.location?.longitude ?? req.body.location?.lng;
    const address = req.body.address || req.body.location?.address || '';
    const result = await attendanceService.punchOut(req.user.id, latitude, longitude, address);
    return this.sendResponse(res, 200, result, result.message);
  }

  async getMonthlyReport(req, res, next) {
    const { month, year } = req.query;
    const result = await attendanceService.getMonthlyReport(req.user.id, month, year);
    return this.sendResponse(res, 200, result, 'Monthly attendance report retrieved successfully.');
  }

  async getAttendanceHistory(req, res, next) {
    const context = req.society || req.user;
    const result = await attendanceService.getAttendanceHistory(context, req.query);
    return this.sendResponse(res, 200, result, 'Attendance history retrieved successfully.');
  }

  async applyLeave(req, res, next) {
    const { leaveType, startDate, endDate, reason } = req.body;
    const result = await attendanceService.applyLeave(req.user.id, leaveType, startDate, endDate, reason);
    return this.sendResponse(res, 200, result, result.message);
  }
}

export const attendanceController = new AttendanceController();
