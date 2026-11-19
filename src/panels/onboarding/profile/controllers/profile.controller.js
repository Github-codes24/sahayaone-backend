import { BaseController } from '../../../../common/base.controller.js';
import { onboardingProfileService } from '../services/profile.service.js';

export class OnboardingProfileController extends BaseController {
  constructor() {
    super();
    this.getProfile = this.catchAsync(this.getProfile.bind(this));
    this.getTodayAttendance = this.catchAsync(this.getTodayAttendance.bind(this));
    this.punchIn = this.catchAsync(this.punchIn.bind(this));
    this.punchOut = this.catchAsync(this.punchOut.bind(this));
    this.getMonthlyReport = this.catchAsync(this.getMonthlyReport.bind(this));
    this.getAttendanceHistory = this.catchAsync(this.getAttendanceHistory.bind(this));
    this.applyLeave = this.catchAsync(this.applyLeave.bind(this));
    this.changePassword = this.catchAsync(this.changePassword.bind(this));
    this.updateLocation = this.catchAsync(this.updateLocation.bind(this));
  }

  async getProfile(req, res, next) {
    const result = await onboardingProfileService.getProfile(req.user.id);
    return this.sendResponse(res, 200, result, 'Profile details successfully retrieved.');
  }

  async getTodayAttendance(req, res, next) {
    const result = await onboardingProfileService.getTodayAttendance(req.user.id);
    return this.sendResponse(res, 200, result, 'Today attendance status retrieved successfully.');
  }

  async punchIn(req, res, next) {
    const { latitude, longitude, address } = req.body;
    const result = await onboardingProfileService.punchIn(req.user.id, latitude, longitude, address);
    return this.sendResponse(res, 200, result, result.message);
  }

  async punchOut(req, res, next) {
    const { latitude, longitude, address } = req.body;
    const result = await onboardingProfileService.punchOut(req.user.id, latitude, longitude, address);
    return this.sendResponse(res, 200, result, result.message);
  }

  async getMonthlyReport(req, res, next) {
    const { month, year } = req.query;
    const result = await onboardingProfileService.getMonthlyReport(req.user.id, month, year);
    return this.sendResponse(res, 200, result, 'Monthly attendance report retrieved successfully.');
  }

  async getAttendanceHistory(req, res, next) {
    const context = req.society || req.user;
    const result = await onboardingProfileService.getAttendanceHistory(context, req.query);
    return this.sendResponse(res, 200, result, 'Attendance history retrieved successfully.');
  }

  async applyLeave(req, res, next) {
    const { leaveType, startDate, endDate, reason } = req.body;
    const result = await onboardingProfileService.applyLeave(req.user.id, leaveType, startDate, endDate, reason);
    return this.sendResponse(res, 200, result, result.message);
  }

  async changePassword(req, res, next) {
    const { oldPassword, newPassword } = req.body;
    const result = await onboardingProfileService.changePassword(req.user.id, oldPassword, newPassword);
    return this.sendResponse(res, 200, result, 'Password successfully updated.');
  }

  async updateLocation(req, res, next) {
    const { latitude, longitude, address } = req.body;
    const result = await onboardingProfileService.updateLocation(req.user.id, latitude, longitude, address);
    return this.sendResponse(res, 200, result, result.message);
  }
}

export const onboardingProfileController = new OnboardingProfileController();
