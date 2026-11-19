import { BaseController } from '../../../../common/base.controller.js';
import { attendanceService } from '../../../employee/attendance/services/attendance.service.js';
import { societyAttendanceService } from '../services/society-attendance.service.js';

export class SocietyAttendanceController extends BaseController {
  constructor() {
    super();
    this.getTodayAttendance = this.catchAsync(this.getTodayAttendance.bind(this));
    this.punchIn = this.catchAsync(this.punchIn.bind(this));
    this.punchOut = this.catchAsync(this.punchOut.bind(this));
    this.getMonthlyReport = this.catchAsync(this.getMonthlyReport.bind(this));
    this.applyLeave = this.catchAsync(this.applyLeave.bind(this));
    this.getMonthlyAttendanceSheet = this.catchAsync(this.getMonthlyAttendanceSheet.bind(this));
    this.getYearlyAttendanceMatrix = this.catchAsync(this.getYearlyAttendanceMatrix.bind(this));
    this.getAttendanceHistory = this.catchAsync(this.getAttendanceHistory.bind(this));
    this.getSinglePersonAttendanceReport = this.catchAsync(this.getSinglePersonAttendanceReport.bind(this));
  }

  /**
   * Get today's attendance snapshot & status for logged-in society user
   */
  async getTodayAttendance(req, res, next) {
    const userId = req.society?.userId || req.user.id;
    const result = await attendanceService.getTodayAttendance(userId);
    return this.sendResponse(res, 200, result, 'Today attendance status retrieved successfully.');
  }

  /**
   * Executive / Employee Punch-In from Society Panel
   */
  async punchIn(req, res, next) {
    const userId = req.society?.userId || req.user.id;
    const latitude = req.body.latitude ?? req.body.latitute ?? req.body.lat ?? req.body.location?.latitude ?? req.body.location?.lat;
    const longitude = req.body.longitude ?? req.body.langitute ?? req.body.lng ?? req.body.location?.longitude ?? req.body.location?.lng;
    const address = req.body.address || req.body.location?.address || '';
    const result = await attendanceService.punchIn(userId, latitude, longitude, address);
    return this.sendResponse(res, 200, result, result.message);
  }

  /**
   * Executive / Employee Punch-Out from Society Panel
   */
  async punchOut(req, res, next) {
    const userId = req.society?.userId || req.user.id;
    const latitude = req.body.latitude ?? req.body.latitute ?? req.body.lat ?? req.body.location?.latitude ?? req.body.location?.lat;
    const longitude = req.body.longitude ?? req.body.langitute ?? req.body.lng ?? req.body.location?.longitude ?? req.body.location?.lng;
    const address = req.body.address || req.body.location?.address || '';
    const result = await attendanceService.punchOut(userId, latitude, longitude, address);
    return this.sendResponse(res, 200, result, result.message);
  }

  /**
   * Get monthly attendance summary report card for logged-in society user
   */
  async getMonthlyReport(req, res, next) {
    const userId = req.society?.userId || req.user.id;
    const { month, year } = req.query;
    const result = await attendanceService.getMonthlyReport(userId, month, year);
    return this.sendResponse(res, 200, result, 'Monthly attendance report retrieved successfully.');
  }

  /**
   * Apply / submit leave application from Society Panel
   */
  async applyLeave(req, res, next) {
    const userId = req.society?.userId || req.user.id;
    const { leaveType, startDate, endDate, reason } = req.body;
    const result = await attendanceService.applyLeave(userId, leaveType, startDate, endDate, reason);
    return this.sendResponse(res, 200, result, result.message);
  }

  /**
   * Get all employee monthly attendance sheet/data with location, branch, search filters and pagination
   */
  async getMonthlyAttendanceSheet(req, res, next) {
    const societyContext = req.society || {};
    const result = await societyAttendanceService.getMonthlyAttendanceSheet(societyContext, req.query);
    return this.sendResponse(res, 200, result, 'Monthly attendance sheet retrieved successfully.');
  }

  /**
   * Get all employee yearly attendance matrix data (JAN to DEC present days & avg attendance %)
   */
  async getYearlyAttendanceMatrix(req, res, next) {
    const result = await societyAttendanceService.getYearlyAttendanceMatrix(req.society, req.query);
    return this.sendResponse(res, 200, result, 'Yearly attendance matrix retrieved successfully.');
  }

  /**
   * Get detailed date-wise attendance history logs with automatic role-based hierarchy
   */
  async getAttendanceHistory(req, res, next) {
    const context = req.society || req.user;
    const result = await attendanceService.getAttendanceHistory(context, req.query);
    return this.sendResponse(res, 200, result, 'Attendance history retrieved successfully.');
  }

  /**
   * Get single person monthly and yearly attendance report (with punch locations and 12-month summary matrix)
   */
  async getSinglePersonAttendanceReport(req, res, next) {
    const targetId = req.params.id || req.query.employeeId || req.query.userId || req.query.id;
    const result = await societyAttendanceService.getSinglePersonAttendanceReport(req.society, targetId, req.query);
    return this.sendResponse(res, 200, result, 'Single person attendance report retrieved successfully.');
  }
}

export const societyAttendanceController = new SocietyAttendanceController();
