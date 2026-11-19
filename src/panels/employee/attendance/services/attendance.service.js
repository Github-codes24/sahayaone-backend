import { Attendance } from '../../../../models/attendance.model.js';
import { EmployeeLeave } from '../../../../models/employee-leave.model.js';
import { User } from '../../../../models/user.model.js';
import { SocietyEmployee } from '../../../../models/society-employee.model.js';
import { Branch } from '../../../../models/branch.model.js';
import { Bank } from '../../../../models/bank.model.js';
import { BranchManager } from '../../../../models/branch-manager.model.js';
import { SocietyAttendance } from '../../../society/attendance-report/models/society-attendance.model.js';
import { Admin } from '../../../../models/admin.model.js';
import { OnboardingTeam } from '../../../../models/onboarding-team.model.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';
import { reverseGeocodeCoordinates, reverseGeocodeLocation } from '../../../../utils/geocoding.util.js';
import { logger } from '../../../../utils/logger.util.js';

import { formatDateString, formatTime12H, formatTime24H, getISTDayRange, getISTMonthRange, INDIAN_TIMEZONE } from '../../../../utils/date.util.js';

export class AttendanceService {
  /**
   * Helper: fetches employee/user metadata across User, Admin, and OnboardingTeam models
   */
  async getEmployeeMetadata(userId) {
    let user = await User.findById(userId).lean();
    let emp = null;
    let employeeType = 'USER';

    if (!user) {
      const adminDoc = await Admin.findById(userId).lean();
      if (adminDoc) {
        user = {
          _id: adminDoc._id,
          id: adminDoc._id,
          email: adminDoc.email,
          phoneNumber: adminDoc.phoneNumber,
          role: adminDoc.role,
          userType: 'ADMIN'
        };
        employeeType = adminDoc.role || 'SUPER_ADMIN';
      }
    }

    if (!user) {
      const onboardingDoc = await OnboardingTeam.findOne({
        $or: [{ _id: userId }, { userId }]
      }).lean();
      if (onboardingDoc) {
        user = {
          _id: onboardingDoc.userId || onboardingDoc._id,
          id: onboardingDoc.userId || onboardingDoc._id,
          email: onboardingDoc.email,
          phoneNumber: onboardingDoc.phone,
          role: 'ONBOARDING_TEAM',
          userType: 'ONBOARDING_TEAM'
        };
        emp = onboardingDoc;
        employeeType = 'ONBOARDING_TEAM';
      }
    }

    if (!user) {
      throw ApiError.notFound('Account profile not found for attendance operations.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (!emp) {
      emp = await SocietyEmployee.findOne({ userId: user._id, isDeleted: false }).lean();
      if (emp) {
        employeeType = 'SOCIETY_EMPLOYEE';
      } else {
        const manager = await BranchManager.findOne({ userId: user._id, isDeleted: false }).lean();
        if (manager) {
          emp = manager;
          employeeType = 'BRANCH_MANAGER';
        }
      }
    }

    return {
      user,
      emp,
      employeeType,
      bankId: user.bankId || emp?.bankId || null,
      branchId: user.branchId || emp?.branchId || null,
      employeeId: emp?._id || user._id
    };
  }

  /**
   * Gets today's attendance snapshot and shift status
   */
  async getTodayAttendance(userId) {
    const { user, emp } = await this.getEmployeeMetadata(userId);
    const todayStr = formatDateString(new Date());
    const attendance = await Attendance.findOne({ userId, dateString: todayStr, isDeleted: false });

    const punchInTimeStr = formatTime12H(attendance?.punchIn?.time);
    const punchOutTimeStr = formatTime12H(attendance?.punchOut?.time);
    const hasPunchedIn = Boolean(attendance?.punchIn?.time);
    const hasPunchedOut = Boolean(attendance?.punchOut?.time);

    let onShift = hasPunchedIn && !hasPunchedOut;
    let statusText = '—';

    if (hasPunchedIn && hasPunchedOut) {
      statusText = attendance.status;
    } else if (hasPunchedIn) {
      statusText = attendance.isLate ? 'LATE_PRESENT' : 'ON_SHIFT';
    }

    return {
      success: true,
      onShift,
      today: {
        dateString: todayStr,
        punchIn: punchInTimeStr,
        punchOut: punchOutTimeStr,
        status: statusText,
        canPunchIn: !hasPunchedIn,
        canPunchOut: hasPunchedIn && !hasPunchedOut,
        isLate: attendance?.isLate || false,
        lateMinutes: attendance?.lateMinutes || 0
      },
      shiftInfo: {
        dutyHours: emp?.dutyHours || '10:00 to 19:00',
        weeklyOff: emp?.weeklyOff || 'Sunday'
      }
    };
  }

  /**
   * Executive Punch-In (Check-in) with Google Maps Geocoding
   */
  async punchIn(userId, rawLat, rawLng, _ignoredAddress = '') {
    const latitude = Number(rawLat);
    const longitude = Number(rawLng);

    const meta = await this.getEmployeeMetadata(userId);
    const { user, emp, bankId, branchId, employeeId, employeeType } = meta;
    const now = new Date();
    const todayStr = formatDateString(now);

    let existing = await Attendance.findOne({
      userId,
      dateString: todayStr,
      appType: 'EXECUTIVE_APP',
      isDeleted: false
    });
    if (existing && existing.punchIn?.time) {
      throw ApiError.badRequest('You have already punched in for today.', ErrorCode.VALIDATION_ERROR);
    }

    // Always reverse geocode using Google Maps API (frontend address is strictly ignored)
    const loc = await reverseGeocodeLocation(latitude, longitude);
    const finalAddress = loc.address || '';
    const finalCity = loc.city || '';
    const finalState = loc.state || '';
    const finalPincode = loc.pincode || '';

    // Resolve branchName from Branch model
    let resolvedBranchName = '';
    if (branchId) {
      const branchDoc = await Branch.findById(branchId).lean();
      if (branchDoc) resolvedBranchName = branchDoc.name || '';
    }

    // Calculate Late Arrival (Default shift in time 09:30 AM IST, grace 15 mins)
    const graceMinutes = 15;
    const shiftInDate = new Date(`${todayStr}T09:30:00.000+05:30`);

    const isLate = now.getTime() > shiftInDate.getTime() + graceMinutes * 60000;
    const lateMinutes = isLate ? Math.floor((now.getTime() - shiftInDate.getTime()) / 60000) : 0;

    const punchInObj = {
      time: now,
      latitude: !isNaN(latitude) ? latitude : null,
      longitude: !isNaN(longitude) ? longitude : null,
      address: finalAddress,
      city: finalCity,
      state: finalState,
      pincode: finalPincode
    };

    if (!existing) {
      existing = new Attendance({
        userId,
        employeeId,
        bankId,
        branchId,
        branchName: resolvedBranchName,
        appType: 'EXECUTIVE_APP',
        date: new Date(todayStr),
        dateString: todayStr,
        punchIn: punchInObj,
        city: finalCity,
        state: finalState,
        pincode: finalPincode,
        status: isLate ? 'LATE_PRESENT' : 'PRESENT',
        isLate,
        lateMinutes
      });
    } else {
      existing.punchIn = punchInObj;
      if (finalCity) existing.city = finalCity;
      if (finalState) existing.state = finalState;
      if (finalPincode) existing.pincode = finalPincode;
      if (resolvedBranchName && !existing.branchName) existing.branchName = resolvedBranchName;
      existing.status = isLate ? 'LATE_PRESENT' : 'PRESENT';
      existing.isLate = isLate;
      existing.lateMinutes = lateMinutes;
    }

    await existing.save();

    // Synchronize SocietyAttendance model for Society Panel reports
    if (bankId && branchId && employeeId) {
      const todayDate = new Date(todayStr);
      await SocietyAttendance.findOneAndUpdate(
        { bankId, branchId, employeeId, date: todayDate, isDeleted: false },
        {
          $set: {
            bankId,
            branchId,
            employeeId,
            employeeType: employeeType || meta.employeeType || 'SOCIETY_EMPLOYEE',
            date: todayDate,
            punchIn: now,
            status: 'P'
          }
        },
        { upsert: true, new: true }
      ).catch((err) => logger.error(`Error syncing SocietyAttendance punchIn: ${err.message}`));
    }

    logger.info(`ATTENDANCE: Executive punched in: ${user.email || user.phoneNumber} (Address: ${finalAddress})`);

    return {
      success: true,
      message: 'Punched in successfully.',
      todayAttendance: {
        punchIn: formatTime12H(now),
        punchOut: null,
        status: isLate ? 'LATE_PRESENT' : 'PRESENT',
        isLate,
        lateMinutes,
        location: {
          latitude: Number(latitude),
          longitude: Number(longitude),
          address: finalAddress,
          city: finalCity,
          state: finalState,
          pincode: finalPincode
        }
      }
    };
  }

  /**
   * Executive Punch-Out (Check-out) with Google Maps Geocoding
   */
  async punchOut(userId, rawLat, rawLng, _ignoredAddress = '') {
    const latitude = Number(rawLat);
    const longitude = Number(rawLng);

    const meta = await this.getEmployeeMetadata(userId);
    const { user, bankId, branchId, employeeId } = meta;
    const now = new Date();
    const todayStr = formatDateString(now);

    const attendance = await Attendance.findOne({
      userId,
      dateString: todayStr,
      appType: 'EXECUTIVE_APP',
      isDeleted: false
    });
    if (!attendance || !attendance.punchIn?.time) {
      throw ApiError.badRequest('Please punch in first before punching out.', ErrorCode.VALIDATION_ERROR);
    }

    if (attendance.punchOut?.time) {
      throw ApiError.badRequest('You have already punched out for today.', ErrorCode.VALIDATION_ERROR);
    }

    // Always reverse geocode using Google Maps API (frontend address is strictly ignored)
    const loc = await reverseGeocodeLocation(latitude, longitude);
    const finalAddress = loc.address || '';
    const finalCity = loc.city || '';
    const finalState = loc.state || '';
    const finalPincode = loc.pincode || '';

    const punchInTime = new Date(attendance.punchIn.time);
    const workingMinutes = Math.floor((now.getTime() - punchInTime.getTime()) / 60000);

    // Half Day threshold: < 240 mins (4 hours)
    const isHalfDay = workingMinutes < 240;

    // Early leave check (Shift Out: 18:30 / 06:30 PM IST, grace 15 mins)
    const shiftOutDate = new Date(`${todayStr}T18:30:00.000+05:30`);

    const isEarlyLeave = now.getTime() < shiftOutDate.getTime() - 15 * 60000;
    const earlyMinutes = isEarlyLeave ? Math.floor((shiftOutDate.getTime() - now.getTime()) / 60000) : 0;

    // Overtime check (Full day: 480 mins / 8 hrs)
    const overtimeMinutes = workingMinutes > 480 ? workingMinutes - 480 : 0;

    attendance.punchOut = {
      time: now,
      latitude: !isNaN(latitude) ? latitude : null,
      longitude: !isNaN(longitude) ? longitude : null,
      address: finalAddress,
      city: finalCity,
      state: finalState,
      pincode: finalPincode
    };
    attendance.workingMinutes = workingMinutes;
    attendance.isEarlyLeave = isEarlyLeave;
    attendance.earlyMinutes = earlyMinutes;
    attendance.overtimeMinutes = overtimeMinutes;

    if (finalCity && !attendance.city) attendance.city = finalCity;
    if (finalState && !attendance.state) attendance.state = finalState;
    if (finalPincode && !attendance.pincode) attendance.pincode = finalPincode;

    if (isHalfDay) {
      attendance.status = 'HALF_DAY';
    }

    await attendance.save();

    // Synchronize SocietyAttendance model for Society Panel reports
    if (bankId && branchId && employeeId) {
      const todayDate = new Date(todayStr);
      await SocietyAttendance.findOneAndUpdate(
        { bankId, branchId, employeeId, date: todayDate, isDeleted: false },
        {
          $set: {
            punchOut: now,
            status: isHalfDay ? 'L' : 'P'
          }
        },
        { new: true }
      ).catch((err) => logger.error(`Error syncing SocietyAttendance punchOut: ${err.message}`));
    }

    logger.info(`ATTENDANCE: Executive punched out: ${user.email || user.phoneNumber} (Address: ${finalAddress}, Working: ${workingMinutes} mins)`);

    return {
      success: true,
      message: 'Punched out successfully.',
      todayAttendance: {
        punchIn: formatTime12H(punchInTime),
        punchOut: formatTime12H(now),
        status: attendance.status,
        workingMinutes,
        overtimeMinutes,
        isEarlyLeave,
        location: {
          latitude: !isNaN(latitude) ? latitude : null,
          longitude: !isNaN(longitude) ? longitude : null,
          address: finalAddress,
          city: finalCity,
          state: finalState,
          pincode: finalPincode
        }
      }
    };
  }

  /**
   * Generates the monthly attendance report cards matching exact UI cards
   */
  async getMonthlyReport(userId, monthArg, yearArg) {
    const now = new Date();
    const month = monthArg ? Number(monthArg) : now.getMonth() + 1;
    const year = yearArg ? Number(yearArg) : now.getFullYear();

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    const attendanceRecords = await Attendance.find({
      userId,
      appType: 'EXECUTIVE_APP',
      date: { $gte: startOfMonth, $lte: endOfMonth },
      isDeleted: false
    });

    const leaveRecords = await EmployeeLeave.find({
      userId,
      status: 'APPROVED',
      startDate: { $lte: endOfMonth },
      endDate: { $gte: startOfMonth },
      isDeleted: false
    });

    let present = 0;
    let absent = 0;
    let halfDay = 0;
    let leave = 0;
    let latePresent = 0;
    let earlyLeave = 0;
    let lateFine = 0;
    let totalOvertimeMinutes = 0;

    attendanceRecords.forEach((rec) => {
      if (rec.status === 'PRESENT') present += 1;
      else if (rec.status === 'ABSENT') absent += 1;
      else if (rec.status === 'HALF_DAY') halfDay += 1;
      else if (rec.status === 'LATE_PRESENT') {
        present += 1;
        latePresent += 1;
      }

      if (rec.isEarlyLeave) earlyLeave += 1;
      if (rec.lateFineAmount) lateFine += rec.lateFineAmount;
      if (rec.overtimeMinutes) totalOvertimeMinutes += rec.overtimeMinutes;
    });

    leaveRecords.forEach((l) => {
      leave += l.totalDays || 1;
    });

    // Format overtime as "HH:MM hrs"
    const otHours = String(Math.floor(totalOvertimeMinutes / 60)).padStart(2, '0');
    const otMins = String(totalOvertimeMinutes % 60).padStart(2, '0');
    const overtimeFormatted = `${otHours}:${otMins} hrs`;

    return {
      success: true,
      month,
      year,
      monthName: startOfMonth.toLocaleString('default', { month: 'long' }),
      cards: {
        present,
        absent,
        halfDay,
        leave,
        latePresent,
        earlyLeave,
        lateFine,
        overtime: overtimeFormatted
      }
    };
  }

  /**
   * Get detailed date-wise attendance history logs with automatic role-based hierarchy:
   * - Bank Owner / Society Admin: Can view all attendance within their bank (can filter by branch, employee, date, location).
   * - Branch Manager: Can view all attendance within their branch (can filter by employee, date, location).
   * - Executive / Employee: Strictly views their own personal attendance history.
   */
  async getAttendanceHistory(userOrContext, query = {}) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    let requesterId = null;
    if (typeof userOrContext === 'string') {
      requesterId = userOrContext;
    } else if (userOrContext && typeof userOrContext.toString === 'function' && !userOrContext.id && !userOrContext.userId) {
      requesterId = userOrContext.toString();
    } else if (userOrContext?.id) {
      requesterId = userOrContext.id.toString();
    } else if (userOrContext?.userId) {
      requesterId = userOrContext.userId.toString();
    }
    const userDoc = requesterId ? await User.findById(requesterId).select('role userType bankId branchId isBankOwner').lean() : null;

    const rawRole = (userOrContext?.role || userDoc?.role || '').toString().toUpperCase();
    const isBankOwnerFlag = Boolean(userOrContext?.isBankOwner || userDoc?.isBankOwner);
    let bankId = userOrContext?.bankId || userDoc?.bankId || null;
    let branchId = userOrContext?.branchId || userDoc?.branchId || null;

    const isSuperAdmin = rawRole === 'SUPER_ADMIN' || userDoc?.userType === 'SUPER_ADMIN';
    const isBankOwner =
      isSuperAdmin ||
      isBankOwnerFlag ||
      rawRole === 'BANK_OWNER' ||
      rawRole === 'SOCIETY_ADMIN' ||
      rawRole === 'VENDOR' ||
      rawRole.includes('BANK_OWNER') ||
      rawRole.includes('OWNER') ||
      rawRole.includes('ADMIN');

    const isBranchManager =
      !isBankOwner &&
      (rawRole === 'BRANCH_MANAGER' || rawRole.includes('BRANCH_MANAGER') || rawRole.includes('MANAGER') || Boolean(userOrContext?.isBranchManager));

    // Resolve Bank ID if owner but missing in context
    if (isBankOwner && !bankId && !isSuperAdmin) {
      const bank = await Bank.findOne({
        $or: [{ userId: requesterId }, { email: userOrContext?.email?.toLowerCase() }],
        isDeleted: { $ne: true }
      }).select('_id').lean();
      if (bank) bankId = bank._id;
    }

    // Resolve Branch ID if branch manager but missing in context
    if (isBranchManager && !branchId) {
      const mgr = await BranchManager.findOne({ userId: requesterId, isDeleted: { $ne: true } }).select('bankId branchId').lean();
      if (mgr) {
        branchId = mgr.branchId;
        if (!bankId) bankId = mgr.bankId;
      }
    }

    const filter = {
      isDeleted: false
    };

    // Auto-detect role and apply data partitioning scope
    if (isBankOwner) {
      // 1. BANK OWNER: Scoped to entire bank
      if (bankId && !isSuperAdmin) {
        filter.bankId = bankId;
      }
      if (query.branchId) filter.branchId = query.branchId;
      if (query.userId) filter.userId = query.userId;
      if (query.employeeId) filter.employeeId = query.employeeId;
      if (query.appType) filter.appType = query.appType.trim().toUpperCase();
    } else if (isBranchManager) {
      // 2. BRANCH MANAGER: Scoped to branch
      if (branchId) {
        filter.branchId = branchId;
      } else if (bankId) {
        filter.bankId = bankId;
      }
      if (query.userId) filter.userId = query.userId;
      if (query.employeeId) filter.employeeId = query.employeeId;
      if (query.appType) filter.appType = query.appType.trim().toUpperCase();
    } else {
      // 3. REGULAR EMPLOYEE / EXECUTIVE: Strictly scoped to own attendance
      filter.userId = requesterId;
      filter.appType = 'EXECUTIVE_APP';
    }

    // Date filters
    if (query.dateString) {
      filter.dateString = query.dateString.trim();
    } else if (query.startDate || query.endDate) {
      filter.date = {};
      if (query.startDate) {
        const cleanStart = String(query.startDate).trim().slice(0, 10);
        filter.date.$gte = new Date(`${cleanStart}T00:00:00.000+05:30`);
      }
      if (query.endDate) {
        const cleanEnd = String(query.endDate).trim().slice(0, 10);
        filter.date.$lte = new Date(`${cleanEnd}T23:59:59.999+05:30`);
      }
    } else if (query.month || query.year) {
      const now = new Date();
      const m = query.month ? String(query.month).padStart(2, '0') : String(now.getMonth() + 1).padStart(2, '0');
      const y = query.year ? String(query.year) : String(now.getFullYear());
      const mRange = getISTMonthRange(`${y}-${m}-01`);
      filter.date = { $gte: mRange.start, $lte: mRange.end };
    }

    // Location filters (city, state, pincode)
    if (query.city) {
      const escaped = query.city.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { city: { $regex: escaped, $options: 'i' } },
        { 'punchIn.city': { $regex: escaped, $options: 'i' } },
        { 'punchIn.address': { $regex: escaped, $options: 'i' } }
      ];
    }

    if (query.state) {
      const escaped = query.state.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { state: { $regex: escaped, $options: 'i' } },
          { 'punchIn.state': { $regex: escaped, $options: 'i' } },
          { 'punchIn.address': { $regex: escaped, $options: 'i' } }
        ]
      });
    }

    if (query.pincode) {
      filter.pincode = query.pincode.trim();
    }

    // Branch / Bank filters (if specified in query)
    if (query.branchId) filter.branchId = query.branchId;
    if (query.bankId && isSuperAdmin) filter.bankId = query.bankId;
    if (query.branchName) {
      const escaped = query.branchName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.branchName = { $regex: escaped, $options: 'i' };
    }

    // Status filter
    if (query.status) {
      filter.status = query.status.trim().toUpperCase();
    }
    if (query.isLate !== undefined) {
      filter.isLate = query.isLate === true || query.isLate === 'true';
    }
    if (query.isEarlyLeave !== undefined) {
      filter.isEarlyLeave = query.isEarlyLeave === true || query.isEarlyLeave === 'true';
    }

    // General Search keyword
    if (query.search) {
      const s = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { 'punchIn.address': { $regex: s, $options: 'i' } },
        { 'punchOut.address': { $regex: s, $options: 'i' } },
        { city: { $regex: s, $options: 'i' } },
        { state: { $regex: s, $options: 'i' } },
        { branchName: { $regex: s, $options: 'i' } },
        { dateString: { $regex: s, $options: 'i' } }
      ];
    }

    const totalRecords = await Attendance.countDocuments(filter);
    const rawRecords = await Attendance.find(filter)
      .populate('userId', 'fullName firstName lastName email phoneNumber employeeCode role')
      .populate('branchId', 'name code branchCode address')
      .populate('bankId', 'name code')
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const history = rawRecords.map((r) => {
      const punchInTime = r.punchIn?.time;
      const punchOutTime = r.punchOut?.time;
      const dObj = new Date(r.date);
      const dayName = dObj.toLocaleDateString('en-US', { weekday: 'long', timeZone: INDIAN_TIMEZONE });

      let workingFormatted = '00:00 hrs';
      if (r.workingMinutes) {
        const hrs = String(Math.floor(r.workingMinutes / 60)).padStart(2, '0');
        const mins = String(r.workingMinutes % 60).padStart(2, '0');
        workingFormatted = `${hrs}:${mins} hrs`;
      }

      const u = r.userId;
      const userName = u ? (u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || '') : '';

      return {
        id: r._id,
        user: u
          ? {
              id: u._id,
              fullName: userName,
              email: u.email || '',
              phoneNumber: u.phoneNumber || '',
              employeeCode: u.employeeCode || '',
              role: u.role || ''
            }
          : null,
        date: r.date,
        dateString: r.dateString,
        dayName,
        appType: r.appType || 'EXECUTIVE_APP',
        status: r.status,
        isLate: Boolean(r.isLate),
        lateMinutes: r.lateMinutes || 0,
        isEarlyLeave: Boolean(r.isEarlyLeave),
        earlyMinutes: r.earlyMinutes || 0,
        workingMinutes: r.workingMinutes || 0,
        workingHoursFormatted: workingFormatted,
        overtimeMinutes: r.overtimeMinutes || 0,
        punchIn: {
          time: punchInTime || null,
          timeFormatted: formatTime12H(punchInTime),
          latitude: r.punchIn?.latitude || null,
          longitude: r.punchIn?.longitude || null,
          address: r.punchIn?.address || '',
          city: r.punchIn?.city || r.city || '',
          state: r.punchIn?.state || r.state || '',
          pincode: r.punchIn?.pincode || r.pincode || ''
        },
        punchOut: {
          time: punchOutTime || null,
          timeFormatted: formatTime12H(punchOutTime),
          latitude: r.punchOut?.latitude || null,
          longitude: r.punchOut?.longitude || null,
          address: r.punchOut?.address || '',
          city: r.punchOut?.city || r.city || '',
          state: r.punchOut?.state || r.state || '',
          pincode: r.punchOut?.pincode || r.pincode || ''
        },
        branch: r.branchId ? { id: r.branchId._id, name: r.branchId.name, code: r.branchId.branchCode || r.branchId.code } : null,
        bank: r.bankId ? { id: r.bankId._id, name: r.bankId.name, code: r.bankId.code } : null
      };
    });

    return {
      success: true,
      history,
      pagination: {
        totalRecords,
        currentPage: page,
        totalPages: Math.ceil(totalRecords / limit) || 1,
        limit,
        hasNextPage: page * limit < totalRecords,
        hasPrevPage: page > 1
      }
    };
  }

  /**
   * Mark / Submit Executive Leave Request with strict date & overlap validations
   */
  async applyLeave(userId, leaveType, startDateISO, endDateISO, reason) {
    const { bankId, branchId, employeeId } = await this.getEmployeeMetadata(userId);

    const startRange = getISTDayRange(new Date(startDateISO));
    const endRange = getISTDayRange(new Date(endDateISO));
    const todayRange = getISTDayRange(new Date());

    const start = startRange.start;
    const end = endRange.end;
    const today = todayRange.start;

    // Validation 1: Start date cannot be in the past
    if (start.getTime() < today.getTime()) {
      throw ApiError.badRequest('Leave start date cannot be in the past.', ErrorCode.VALIDATION_ERROR);
    }

    // Validation 2: End date must be equal to or after start date
    if (end.getTime() < start.getTime()) {
      throw ApiError.badRequest('Leave end date must be equal to or after start date.', ErrorCode.VALIDATION_ERROR);
    }

    // Validation 3: Check for overlapping leaves for this executive
    const overlapping = await EmployeeLeave.findOne({
      userId,
      status: { $in: ['PENDING', 'APPROVED'] },
      startDate: { $lte: end },
      endDate: { $gte: start },
      isDeleted: false
    });

    if (overlapping) {
      throw ApiError.badRequest('You already have an active or pending leave application for the selected date range.', ErrorCode.VALIDATION_ERROR);
    }

    const timeDiff = Math.abs(end.getTime() - start.getTime());
    const totalDays = Math.ceil(timeDiff / (1000 * 3600 * 24));

    const leave = new EmployeeLeave({
      userId,
      employeeId,
      bankId,
      branchId,
      leaveType: leaveType || 'CASUAL_LEAVE',
      startDate: start,
      endDate: end,
      totalDays: totalDays || 1,
      reason: reason ? reason.trim() : '',
      status: 'PENDING'
    });

    await leave.save();
    logger.info(`LEAVE APPLICATION: Submitted by user ${userId} for ${totalDays} days (${startDateISO} to ${endDateISO})`);

    return {
      success: true,
      message: 'Leave application submitted successfully.',
      leave: {
        id: leave._id,
        leaveType: leave.leaveType,
        startDate: startDateISO,
        endDate: endDateISO,
        totalDays: totalDays || 1,
        status: leave.status
      }
    };
  }
}

export const attendanceService = new AttendanceService();
