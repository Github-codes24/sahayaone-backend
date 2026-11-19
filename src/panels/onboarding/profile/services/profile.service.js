import { User } from '../../../../models/user.model.js';
import { OnboardingTeam } from '../../../../models/onboarding-team.model.js';
import { Attendance } from '../../../../models/attendance.model.js';
import { EmployeeLeave } from '../../../../models/employee-leave.model.js';
import { Loan } from '../../../../models/loan.model.js';
import { CustomerProfile } from '../../../../models/customer-profile.model.js';
import { Branch } from '../../../../models/branch.model.js';
import { EmployeeProfile } from '../../../../models/employee-profile.model.js';
import { SocietyEmployee } from '../../../../models/society-employee.model.js';
import { cryptoUtil } from '../../../../utils/crypto.util.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';
import { logger } from '../../../../utils/logger.util.js';
import { mailer } from '../../../../emails/mailer.util.js';
import { reverseGeocodeCoordinates, reverseGeocodeLocation } from '../../../../utils/geocoding.util.js';

import { formatDateString, formatTime12H, formatTime24H, getISTDayRange, getISTMonthRange, INDIAN_TIMEZONE } from '../../../../utils/date.util.js';

export class OnboardingProfileService {
  /**
   * Helper: fetches onboarding team member metadata and user account
   */
  async getMemberMetadata(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound('Onboarding executive account not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    let member = await OnboardingTeam.findOne({ userId: user._id, isDeleted: { $ne: true } }).populate({ path: 'branchId', strictPopulate: false });
    if (!member && user.email) {
      member = await OnboardingTeam.findOne({ email: user.email, isDeleted: { $ne: true } }).populate({ path: 'branchId', strictPopulate: false });
    }
    if (!member && user.phoneNumber) {
      member = await OnboardingTeam.findOne({ phone: user.phoneNumber, isDeleted: { $ne: true } }).populate({ path: 'branchId', strictPopulate: false });
    }

    let branchId = (member?.branchId && typeof member.branchId === 'object' ? member.branchId._id : member?.branchId) || user.branchId || null;
    let bankId = user.bankId || (member?.branchId && typeof member.branchId === 'object' ? member.branchId.bankId : null) || member?.bankId || null;

    if (!member) {
      const emp = await EmployeeProfile.findOne({ userId: user._id }).populate({ path: 'branchId', strictPopulate: false }) ||
                  await SocietyEmployee.findOne({ userId: user._id }).populate({ path: 'branchId', strictPopulate: false });
      if (emp) {
        member = emp;
        branchId = emp.branchId?._id || emp.branchId || branchId;
        bankId = emp.bankId || bankId;
      }
    }

    let branchObj = member?.branchId && typeof member.branchId === 'object' ? member.branchId : null;
    if (!branchObj && branchId) {
      branchObj = await Branch.findById(branchId).lean();
    }

    return {
      user,
      member,
      bankId,
      branchId,
      branchObj,
      memberId: member?._id || null
    };
  }

  /**
   * Fetches profile details, target stats, salary details, and today's attendance snapshot for Onboarding Executive
   */
  async getProfile(userId) {
    const { user, member, bankId, branchId, branchObj: resolvedBranchObj, memberId } = await this.getMemberMetadata(userId);

    const fullName = member?.fullName || (member?.firstName ? `${member.firstName} ${member.lastName || ''}`.trim() : user.fullName) || 'Ananya Sharma';
    const firstName = fullName.split(' ')[0] || '';
    const lastName = fullName.split(' ').slice(1).join(' ') || '';

    const branchObj = resolvedBranchObj || (member?.branchId && typeof member.branchId === 'object' ? member.branchId : null);
    const branchName = branchObj?.name || member?.branchName || 'Main Branch';

    const dutyHours = member?.shiftInTime && member?.shiftOutTime 
      ? `${member.shiftInTime} to ${member.shiftOutTime}`
      : '10:00 to 21:00';
      
    const weeklyOff = Array.isArray(member?.weeklyOffDays) && member.weeklyOffDays.length > 0
      ? member.weeklyOffDays.join(' & ')
      : 'Saturday & Sunday';

    const profileImage = member?.profileImage || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500';

    // 1. Calculate Target Stats for Onboarding Executive
    const assignedTargets = 50; // Monthly Target Count set by Super Admin
    const completedOnboardings = await Loan.countDocuments({
      $or: [
        { createdByExecutiveId: user._id },
        { createdBy: user._id },
        ...(memberId ? [{ createdByExecutiveId: memberId }, { createdBy: memberId }] : [])
      ],
      status: { $in: ['ACTIVE', 'COMPLETED', 'PENDING_DOWN_PAYMENT', 'NEW'] }
    });

    const pendingVerifications = await Loan.countDocuments({
      $or: [
        { createdByExecutiveId: user._id },
        { createdBy: user._id },
        ...(memberId ? [{ createdByExecutiveId: memberId }, { createdBy: memberId }] : [])
      ],
      status: { $in: ['NEW', 'PENDING', 'PENDING_DOWN_PAYMENT'] }
    });

    const approvedOnboardings = await Loan.countDocuments({
      $or: [
        { createdByExecutiveId: user._id },
        { createdBy: user._id },
        ...(memberId ? [{ createdByExecutiveId: memberId }, { createdBy: memberId }] : [])
      ],
      status: { $in: ['ACTIVE', 'COMPLETED'] }
    });

    const rejectedOnboardings = await Loan.countDocuments({
      $or: [
        { createdByExecutiveId: user._id },
        { createdBy: user._id },
        ...(memberId ? [{ createdByExecutiveId: memberId }, { createdBy: memberId }] : [])
      ],
      status: 'REJECTED'
    });

    const targetAchievementPercentage = Math.min(100, Math.round((completedOnboardings / assignedTargets) * 100));

    const targetStats = {
      monthlyTarget: assignedTargets,
      completedOnboardings,
      pendingVerifications,
      approvedOnboardings,
      rejectedOnboardings,
      targetAchievementPercentage
    };

    // 2. Compute EMI Card Stats & Verification Credit Stats
    const branchAvailableCards = branchObj?.availableEmiCards ?? branchObj?.cardStock ?? 0;
    const branchAvailableCredits = branchObj?.availableVerificationCredits ?? branchObj?.verificationCredits ?? 0;

    const { start: startOfDay, end: endOfDay } = getISTDayRange(new Date());

    const execFilter = {
      $or: [
        { createdByExecutiveId: user._id },
        { createdById: user._id },
        ...(memberId ? [{ createdByExecutiveId: memberId }, { createdById: memberId }] : [])
      ]
    };

    const totalCardsSold = await CustomerProfile.countDocuments(execFilter);
    const todayCardsSold = await CustomerProfile.countDocuments({
      ...execFilter,
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });

    const totalCreditsUsed = totalCardsSold;
    const todayCreditsUsed = todayCardsSold;

    const emiCardStats = {
      branchAvailableCards,
      totalCardsSold,
      todayCardsSold
    };

    const verificationCreditStats = {
      branchAvailableCredits,
      totalCreditsUsed,
      todayCreditsUsed
    };

    // 3. Salary & Shift Rules Metadata from OnboardingTeam model
    const salaryDetails = {
      monthlySalary: member?.salary || 0,
      dailySalaryEstimate: member?.salary ? Math.round(member.salary / 30) : 0,
      shiftInTime: member?.shiftInTime || '10:00',
      shiftOutTime: member?.shiftOutTime || '21:00',
      lateAllowedMins: member?.lateAllowedMins || 15,
      earlyAllowedMins: member?.earlyAllowedMins || 15,
      halfDayMins: member?.halfDayMins || 240,
      fullDayMins: member?.fullDayMins || 480,
      weeklyOffDays: member?.weeklyOffDays || ['Saturday', 'Sunday'],
      shiftType: member?.shiftType || 'Double',
      lateCutAction: member?.lateCutAction || 'Half Day'
    };

    // 4. Fetch Today's Attendance Snapshot
    const todayStr = formatDateString(new Date());
    const attendance = await Attendance.findOne({ userId: user._id, dateString: todayStr, isDeleted: false });

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

    const todayAttendance = {
      dateString: todayStr,
      punchIn: punchInTimeStr,
      punchOut: punchOutTimeStr,
      status: statusText,
      onShift,
      canPunchIn: !hasPunchedIn,
      canPunchOut: hasPunchedIn && !hasPunchedOut,
      isLate: attendance?.isLate || false,
      lateMinutes: attendance?.lateMinutes || 0
    };

    return {
      id: member?._id || user._id,
      employeeId: member?._id || user._id,
      employeeCode: member?._id || String(user._id),
      fullName,
      firstName,
      lastName,
      email: user.email || member?.email || '',
      phone: user.phoneNumber || member?.phone || '',
      onboardingTeamType: member?.onboardingTeamType || 'Regional OnboardingTeam',
      region: member?.region || 'Eastern Region',
      designation: member?.onboardingTeamType || 'Onboarding Executive',
      department: 'Onboarding & Verification',
      salary: member?.salary || 0,
      joiningDate: member?.joiningDate || user.createdAt,
      dutyHours,
      weeklyOff,
      address: member?.address || 'HO Nagpur, Maharashtra',
      state: 'Maharashtra',
      branch: {
        id: branchId,
        name: branchName
      },
      bank: {
        id: bankId
      },
      targetStats,
      emiCardStats,
      verificationCreditStats,
      salaryDetails,
      todayAttendance,
      user: {
        id: user._id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role || 'ONBOARDING_TEAM',
        userType: user.userType || 'EMPLOYEE',
        status: user.status || 'ACTIVE'
      },
      profile: {
        employeeId: String(member?._id || user._id),
        firstName,
        lastName,
        fullName,
        gender: (member?.gender || 'FEMALE').toUpperCase(),
        dob: member?.dob || null,
        profileImage,
        dutyHours,
        weeklyOff,
        bloodGroup: 'B+',
        validity: null,
        officeAddress: member?.address || 'HO Nagpur, Maharashtra',
        state: 'Maharashtra',
        designation: member?.onboardingTeamType || 'Onboarding Executive',
        department: 'Onboarding & Verification',
        branchName
      }
    };
  }

  /**
   * Gets today's attendance snapshot and shift status for Onboarding Executive
   */
  async getTodayAttendance(userId) {
    const { user, member } = await this.getMemberMetadata(userId);
    const todayStr = formatDateString(new Date());
    const attendance = await Attendance.findOne({
      userId: user._id,
      dateString: todayStr,
      appType: 'ONBOARDING_APP',
      isDeleted: false
    });

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

    const dutyHours = member?.shiftInTime && member?.shiftOutTime 
      ? `${member.shiftInTime} to ${member.shiftOutTime}`
      : '10:00 to 21:00';

    const weeklyOff = Array.isArray(member?.weeklyOffDays) && member.weeklyOffDays.length > 0
      ? member.weeklyOffDays.join(' & ')
      : 'Saturday & Sunday';

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
        shiftInTime: member?.shiftInTime || '10:00',
        shiftOutTime: member?.shiftOutTime || '21:00',
        lateAllowedMins: member?.lateAllowedMins || 15,
        dutyHours,
        weeklyOff
      }
    };
  }

  /**
   * Onboarding Executive Punch-In (Check-in) with Google Maps Geocoding and OnboardingTeam rules
   */
  async punchIn(userId, latitude, longitude, _ignoredAddress = '') {
    const { user, member, bankId, branchId, memberId } = await this.getMemberMetadata(userId);
    const now = new Date();
    const todayStr = formatDateString(now);

    let existing = await Attendance.findOne({
      userId: user._id,
      dateString: todayStr,
      appType: 'ONBOARDING_APP',
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

    // Parse member shiftInTime (e.g., "10:00") and lateAllowedMins (e.g., 15)
    const shiftInStr = member?.shiftInTime || '10:00';
    const [shiftHour, shiftMinute] = shiftInStr.split(':').map(Number);
    const graceMinutes = member?.lateAllowedMins || 15;

    const shiftInDate = new Date(`${todayStr}T${String(shiftHour || 10).padStart(2, '0')}:${String(shiftMinute || 0).padStart(2, '0')}:00.000+05:30`);

    const isLate = now.getTime() > shiftInDate.getTime() + graceMinutes * 60000;
    const lateMinutes = isLate ? Math.floor((now.getTime() - shiftInDate.getTime()) / 60000) : 0;

    const punchInObj = {
      time: now,
      latitude: Number(latitude),
      longitude: Number(longitude),
      address: finalAddress,
      city: finalCity,
      state: finalState,
      pincode: finalPincode
    };

    const branchName = member?.branchName || (branchId?.name || '');

    if (!existing) {
      existing = new Attendance({
        userId: user._id,
        employeeId: memberId || user._id,
        bankId,
        branchId,
        branchName,
        appType: 'ONBOARDING_APP',
        date: new Date(`${todayStr}T00:00:00.000+05:30`),
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
      if (branchName && !existing.branchName) existing.branchName = branchName;
      existing.status = isLate ? 'LATE_PRESENT' : 'PRESENT';
      existing.isLate = isLate;
      existing.lateMinutes = lateMinutes;
    }

    await existing.save();
    logger.info(`ONBOARDING ATTENDANCE: Executive punched in: ${user.email || user.phoneNumber} (Address: ${finalAddress})`);

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
   * Onboarding Executive Punch-Out (Check-out) with Google Maps Geocoding
   */
  async punchOut(userId, latitude, longitude, _ignoredAddress = '') {
    const { user, member } = await this.getMemberMetadata(userId);
    const now = new Date();
    const todayStr = formatDateString(now);

    const attendance = await Attendance.findOne({
      userId: user._id,
      dateString: todayStr,
      appType: 'ONBOARDING_APP',
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

    const halfDayThresholdMins = member?.halfDayMins || 240;
    const fullDayThresholdMins = member?.fullDayMins || 480;

    // Half Day threshold check
    const isHalfDay = workingMinutes < halfDayThresholdMins;

    // Early leave check based on shiftOutTime (e.g. "21:00") and earlyAllowedMins (e.g. 15)
    const shiftOutStr = member?.shiftOutTime || '21:00';
    const [shiftOutH, shiftOutM] = shiftOutStr.split(':').map(Number);
    const earlyGraceMins = member?.earlyAllowedMins || 15;

    const shiftOutDate = new Date(`${todayStr}T${String(shiftOutH || 21).padStart(2, '0')}:${String(shiftOutM || 0).padStart(2, '0')}:00.000+05:30`);

    const isEarlyLeave = now.getTime() < shiftOutDate.getTime() - earlyGraceMins * 60000;
    const earlyMinutes = isEarlyLeave ? Math.floor((shiftOutDate.getTime() - now.getTime()) / 60000) : 0;

    // Overtime check
    const overtimeMinutes = workingMinutes > fullDayThresholdMins ? workingMinutes - fullDayThresholdMins : 0;

    attendance.punchOut = {
      time: now,
      latitude: Number(latitude),
      longitude: Number(longitude),
      address: finalAddress,
      city: finalCity,
      state: finalState,
      pincode: finalPincode
    };
    attendance.workingMinutes = workingMinutes;
    attendance.isEarlyLeave = isEarlyLeave;
    attendance.earlyMinutes = earlyMinutes;
    attendance.overtimeMinutes = overtimeMinutes;

    if (isHalfDay) {
      attendance.status = 'HALF_DAY';
    }

    await attendance.save();
    logger.info(`ONBOARDING ATTENDANCE: Executive punched out: ${user.email || user.phoneNumber} (Address: ${finalAddress}, Working: ${workingMinutes} mins)`);

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
   * Monthly Attendance Report Cards for Onboarding Executive
   */
  async getMonthlyReport(userId, monthArg, yearArg) {
    const now = new Date();
    const month = monthArg ? Number(monthArg) : Number(now.toLocaleDateString('en-US', { month: 'numeric', timeZone: INDIAN_TIMEZONE }));
    const year = yearArg ? Number(yearArg) : Number(now.toLocaleDateString('en-US', { year: 'numeric', timeZone: INDIAN_TIMEZONE }));

    const { start: startOfMonth, end: endOfMonth } = getISTMonthRange(new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00.000+05:30`));

    const attendanceRecords = await Attendance.find({
      userId,
      appType: 'ONBOARDING_APP',
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
   * Get detailed date-wise attendance history logs with comprehensive filters
   * Filters supported: dateString, startDate, endDate, month, year, city, state, pincode, branchName, branchId, bankId, status, search, page, limit
   */
  async getAttendanceHistory(userOrContext, query = {}) {
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

    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const filter = {
      appType: 'ONBOARDING_APP',
      isDeleted: false
    };

    if (isBankOwner) {
      if (bankId && !isSuperAdmin) filter.bankId = bankId;
      if (query.branchId) filter.branchId = query.branchId;
      if (query.userId) filter.userId = query.userId;
    } else if (isBranchManager) {
      if (branchId) filter.branchId = branchId;
      else if (bankId) filter.bankId = bankId;
      if (query.userId) filter.userId = query.userId;
    } else {
      filter.userId = requesterId;
    }

    // Date filters (IST aligned)
    if (query.dateString) {
      filter.dateString = query.dateString.trim();
    } else if (query.startDate || query.endDate) {
      filter.date = {};
      if (query.startDate) {
        filter.date.$gte = new Date(`${query.startDate.trim()}T00:00:00.000+05:30`);
      }
      if (query.endDate) {
        filter.date.$lte = new Date(`${query.endDate.trim()}T23:59:59.999+05:30`);
      }
    } else if (query.month || query.year) {
      const now = new Date();
      const m = query.month ? Number(query.month) : Number(now.toLocaleDateString('en-US', { month: 'numeric', timeZone: INDIAN_TIMEZONE }));
      const y = query.year ? Number(query.year) : Number(now.toLocaleDateString('en-US', { year: 'numeric', timeZone: INDIAN_TIMEZONE }));
      const { start: startOfMonth, end: endOfMonth } = getISTMonthRange(new Date(`${y}-${String(m).padStart(2, '0')}-01T00:00:00.000+05:30`));
      filter.date = { $gte: startOfMonth, $lte: endOfMonth };
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

    // Branch / Bank filters
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
        appType: r.appType || 'ONBOARDING_APP',
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
   * Mark / Apply Leave Request for Onboarding Executive
   */
  async applyLeave(userId, leaveType, startDateISO, endDateISO, reason) {
    const { user, bankId, branchId, memberId } = await this.getMemberMetadata(userId);

    const startRange = getISTDayRange(new Date(startDateISO));
    const endRange = getISTDayRange(new Date(endDateISO));
    const todayRange = getISTDayRange(new Date());

    const start = startRange.start;
    const end = endRange.end;
    const today = todayRange.start;

    if (start.getTime() < today.getTime()) {
      throw ApiError.badRequest('Leave start date cannot be in the past.', ErrorCode.VALIDATION_ERROR);
    }

    if (end.getTime() < start.getTime()) {
      throw ApiError.badRequest('Leave end date must be equal to or after start date.', ErrorCode.VALIDATION_ERROR);
    }

    const overlapping = await EmployeeLeave.findOne({
      userId: user._id,
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
      userId: user._id,
      employeeId: memberId || user._id,
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
    logger.info(`ONBOARDING LEAVE APPLICATION: Submitted by user ${user._id} for ${totalDays} days (${startDateISO} to ${endDateISO})`);

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

  /**
   * Validates current password and updates it to new password
   */
  async changePassword(userId, oldPassword, newPassword) {
    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound('Onboarding executive account not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (!user.passwordHash) {
      throw ApiError.badRequest('Password authentication is not configured for this account.', ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    const isMatch = await cryptoUtil.compare(oldPassword, user.passwordHash);
    if (!isMatch) {
      throw ApiError.badRequest('Your old password is incorrect.', ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    user.passwordHash = await cryptoUtil.hash(newPassword);
    await user.save();

    logger.info(`ONBOARDING PROFILE: Password successfully updated for user: ${user.email}`);

    if (user.email) {
      mailer.sendMail({
        to: user.email,
        subject: emailConfig.templates.ONBOARDING_PASSWORD_CHANGED_PROFILE.subject,
        templateId: emailConfig.templates.ONBOARDING_PASSWORD_CHANGED_PROFILE.templateId,
        variables: { email: user.email },
        html: `
          <h3>Security Alert - Password Changed</h3>
          <p>Dear Executive,</p>
          <p>We are writing to notify you that the password for your Onboarding Executive Account (<strong>${user.email}</strong>) has been updated from the profile settings panel.</p>
          <p>If you did not authorize this change, please change your password again immediately or contact HO support at 8080494923 or email info@sahayaone.com.</p>
        `
      }).catch(err => {
        logger.warn(`ONBOARDING PROFILE: Password change confirmation email dispatch warning: ${err.message}`);
      });
    }

    return {
      success: true,
      message: 'Your password has been changed successfully.'
    };
  }

  /**
   * Updates coordinates position and resolved street address text
   */
  async updateLocation(userId, latitude, longitude, address = '') {
    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound('Onboarding executive account not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    user.location = {
      type: 'Point',
      coordinates: [Number(longitude), Number(latitude)],
      address: address ? address.trim() : '',
      lastUpdatedAt: new Date()
    };

    await user.save();
    logger.info(`ONBOARDING PROFILE: Location updated for user: ${user.email} (Lat: ${latitude}, Long: ${longitude})`);

    return {
      success: true,
      message: 'Location coordinate position updated successfully.'
    };
  }
}

export const onboardingProfileService = new OnboardingProfileService();
