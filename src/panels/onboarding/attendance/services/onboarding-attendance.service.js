import { OnboardingTeam } from '../../../../models/onboarding-team.model.js';
import { Attendance } from '../../../../models/attendance.model.js';
import { ApiError } from '../../../../common/api.error.js';
import { formatDateString, getISTMonthRange, getISTYearRange, INDIAN_TIMEZONE } from '../../../../utils/date.util.js';

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class OnboardingAttendanceService {
  formatMinutesToHours(minutes = 0) {
    const mins = Math.max(0, Math.floor(Number(minutes) || 0));
    if (mins === 0) return '0 hrs';
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs === 0) return `${remMins} mins`;
    if (remMins === 0) return `${hrs} hrs`;
    return `${hrs} hrs ${remMins} mins`;
  }

  formatTime12H(value) {
    if (!value) return null;
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: INDIAN_TIMEZONE
    }).format(new Date(value));
  }

  calculateWorkingMinutes(punchIn, punchOut) {
    if (!punchIn || !punchOut) return 0;
    const diff = new Date(punchOut).getTime() - new Date(punchIn).getTime();
    if (diff <= 0) return 0;
    return Math.floor(diff / 60000);
  }

  async getMonthlyAttendanceSheet(queryOptions = {}) {
    const page = parseInt(queryOptions.page || '1', 10);
    const limit = parseInt(queryOptions.limit || '10', 10);
    const skip = (page - 1) * limit;

    let month = parseInt(queryOptions.month, 10);
    let year = parseInt(queryOptions.year, 10);
    const dateInput = queryOptions.date ? new Date(queryOptions.date) : new Date();

    if (isNaN(month) || month < 1 || month > 12) {
      month = Number(dateInput.toLocaleDateString('en-US', { month: 'numeric', timeZone: INDIAN_TIMEZONE }));
    }
    if (isNaN(year) || year < 2020 || year > 2035) {
      year = Number(dateInput.toLocaleDateString('en-US', { year: 'numeric', timeZone: INDIAN_TIMEZONE }));
    }

    const { start: monthStart, end: monthEnd } = getISTMonthRange(new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00.000+05:30`));
    const daysInMonth = new Date(year, month, 0).getDate();

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = `${monthNames[month - 1]} ${year}`;

    const filter = { isDeleted: { $ne: true }, status: 'ACTIVE' };
    const searchKeyword = (queryOptions.search || '').trim();
    if (searchKeyword) {
      const searchRegex = new RegExp(escapeRegex(searchKeyword), 'i');
      filter.$or = [
        { fullName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { onboardingTeamType: searchRegex }
      ];
    }

    const onboardingMembers = await OnboardingTeam.find(filter).lean();
    const people = onboardingMembers.map((m) => ({
      id: m._id,
      userId: m.userId ? m.userId.toString() : null,
      type: 'ONBOARDING_TEAM',
      fullName: m.fullName || 'Onboarding Team Member',
      designation: m.onboardingTeamType || 'Onboarding Executive',
      employeeCode: `OBT-${m._id.toString().slice(-4).toUpperCase()}`,
      email: m.email || '',
      phoneNumber: m.phone || ''
    })).sort((a, b) => a.fullName.localeCompare(b.fullName));

    const totalRecords = people.length;
    const pagedPeople = people.slice(skip, skip + limit);

    const allPersonIds = people.map((p) => p.id).filter(Boolean);
    const allUserIds = people.map((p) => p.userId).filter(Boolean);

    const attendanceRecords = await Attendance.find({
      $or: [
        { employeeId: { $in: allPersonIds }, date: { $gte: monthStart, $lte: monthEnd }, isDeleted: false },
        { userId: { $in: allUserIds }, date: { $gte: monthStart, $lte: monthEnd }, isDeleted: false }
      ]
    }).lean();

    const attendanceMap = new Map();
    const getDayKey = (personId, dateObj) => {
      if (!dateObj) return null;
      const formatted = formatDateString(dateObj);
      return formatted ? `${personId}:${formatted}` : null;
    };

    attendanceRecords.forEach((rec) => {
      const person = people.find(
        (p) => p.id?.toString() === rec.employeeId?.toString() || (p.userId && rec.userId && p.userId === rec.userId.toString())
      );
      if (person) {
        const dObj = rec.date || (rec.dateString ? new Date(rec.dateString) : rec.createdAt);
        const key = getDayKey(person.id, dObj);
        if (key) {
          const existing = attendanceMap.get(key) || {};
          const pIn = rec.punchIn?.time || existing.punchIn || null;
          const pOut = rec.punchOut?.time || existing.punchOut || null;

          const pInLoc = rec.punchIn ? {
            latitude: rec.punchIn.latitude ?? null,
            longitude: rec.punchIn.longitude ?? null,
            address: rec.punchIn.address || '',
            city: rec.punchIn.city || rec.city || '',
            state: rec.punchIn.state || rec.state || '',
            pincode: rec.punchIn.pincode || rec.pincode || ''
          } : existing.punchInLocation || null;

          const pOutLoc = rec.punchOut ? {
            latitude: rec.punchOut.latitude ?? null,
            longitude: rec.punchOut.longitude ?? null,
            address: rec.punchOut.address || '',
            city: rec.punchOut.city || rec.city || '',
            state: rec.punchOut.state || rec.state || '',
            pincode: rec.punchOut.pincode || rec.pincode || ''
          } : existing.punchOutLocation || null;

          let st = existing.status;
          if (!st || st === 'A') {
            if (rec.status === 'HALF_DAY') st = 'HD';
            else if (rec.status === 'LEAVE') st = 'L';
            else if (rec.status === 'PRESENT' || rec.status === 'LATE_PRESENT') st = 'P';
            else st = rec.status || 'P';
          }
          attendanceMap.set(key, {
            punchIn: pIn,
            punchOut: pOut,
            punchInLocation: pInLoc,
            punchOutLocation: pOutLoc,
            status: st,
            isLate: rec.isLate || existing.isLate || false,
            lateMinutes: rec.lateMinutes || existing.lateMinutes || 0,
            workingMinutes: rec.workingMinutes || 0,
            overtimeMinutes: rec.overtimeMinutes || 0,
            isEarlyLeave: rec.isEarlyLeave || false
          });
        }
      }
    });

    let globalPresentCount = 0;
    let globalAbsentCount = 0;
    let globalLeaveCount = 0;
    let globalHalfDayCount = 0;

    const buildEmployeeSheet = (person, isPaged) => {
      const days = [];
      const daysMap = {};
      let presentDays = 0;
      let absentDays = 0;
      let halfDays = 0;
      let leaveDays = 0;
      let lateDays = 0;
      let totalWorkingMins = 0;
      let totalOvertimeMins = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const dd = String(d).padStart(2, '0');
        const mm = String(month).padStart(2, '0');
        const dateStr = `${year}-${mm}-${dd}`;
        const dateObj = new Date(`${dateStr}T12:00:00.000+05:30`);
        const dayOfWeek = dateObj.getDay();

        const key = `${person.id}:${dateStr}`;
        const rec = attendanceMap.get(key);

        let statusCode = 'A';
        let statusLabel = 'ABSENT';

        if (rec) {
          const rawStatus = (rec.status || '').toUpperCase();
          if (rawStatus === 'P' || rawStatus === 'PRESENT' || rawStatus === 'LATE_PRESENT') {
            statusCode = 'P';
            statusLabel = rec.isLate ? 'LATE_PRESENT' : 'PRESENT';
            presentDays++;
            globalPresentCount++;
            if (rec.isLate) lateDays++;
          } else if (rawStatus === 'HD' || rawStatus === 'HALF_DAY') {
            statusCode = 'HD';
            statusLabel = 'HALF_DAY';
            halfDays++;
            globalHalfDayCount++;
          } else if (rawStatus === 'L' || rawStatus === 'LEAVE') {
            statusCode = 'L';
            statusLabel = 'LEAVE';
            leaveDays++;
            globalLeaveCount++;
          } else {
            statusCode = 'A';
            statusLabel = 'ABSENT';
            absentDays++;
            globalAbsentCount++;
          }

          const wMins = rec.workingMinutes || this.calculateWorkingMinutes(rec.punchIn, rec.punchOut);
          totalWorkingMins += wMins;
          totalOvertimeMins += (rec.overtimeMinutes || 0);
        } else {
          if (dayOfWeek === 0) {
            statusCode = 'WO';
            statusLabel = 'WEEKLY_OFF';
          } else {
            statusCode = 'A';
            statusLabel = 'ABSENT';
            absentDays++;
            globalAbsentCount++;
          }
        }

        daysMap[String(d)] = statusCode;

        if (isPaged) {
          const wMins = rec ? (rec.workingMinutes || this.calculateWorkingMinutes(rec.punchIn, rec.punchOut)) : 0;
          days.push({
            day: d,
            date: dateStr,
            dayName: dateObj.toLocaleDateString('en-US', { weekday: 'short', timeZone: INDIAN_TIMEZONE }),
            statusCode,
            status: statusLabel,
            punchIn: this.formatTime12H(rec?.punchIn),
            punchOut: this.formatTime12H(rec?.punchOut),
            punchInLocation: rec?.punchInLocation || null,
            punchOutLocation: rec?.punchOutLocation || null,
            punchInLatitude: rec?.punchInLocation?.latitude ?? null,
            punchInLongitude: rec?.punchInLocation?.longitude ?? null,
            punchOutLatitude: rec?.punchOutLocation?.latitude ?? null,
            punchOutLongitude: rec?.punchOutLocation?.longitude ?? null,
            isLate: Boolean(rec?.isLate),
            lateMinutes: Number(rec?.lateMinutes || 0),
            isEarlyLeave: Boolean(rec?.isEarlyLeave),
            workingMinutes: wMins,
            formattedWorkingHours: this.formatMinutesToHours(wMins)
          });
        }
      }

      const totalWorkedDays = presentDays + (halfDays * 0.5);
      const attendancePercentage = Number(((totalWorkedDays / daysInMonth) * 100).toFixed(1));

      return {
        id: person.id,
        employeeName: person.fullName,
        designation: person.designation,
        employeeCode: person.employeeCode,
        email: person.email,
        phoneNumber: person.phoneNumber,
        summary: {
          totalDays: daysInMonth,
          presentDays,
          absentDays,
          halfDays,
          leaveDays,
          lateDays,
          totalWorkingMinutes: totalWorkingMins,
          formattedTotalWorkingHours: this.formatMinutesToHours(totalWorkingMins),
          totalOvertimeMinutes: totalOvertimeMins,
          formattedTotalOvertime: this.formatMinutesToHours(totalOvertimeMins),
          attendancePercentage
        },
        daysMap,
        days: isPaged ? days : undefined
      };
    };

    people.forEach((p) => buildEmployeeSheet(p, false));

    const items = pagedPeople.map((p, idx) => ({
      srNo: skip + idx + 1,
      ...buildEmployeeSheet(p, true)
    }));

    const totalPossibleDays = totalRecords * daysInMonth;
    const avgPct = totalPossibleDays > 0 ? Number(((globalPresentCount / totalPossibleDays) * 100).toFixed(1)) : 0;
    const totalPages = Math.max(1, Math.ceil(totalRecords / limit));

    return {
      month,
      year,
      monthName,
      daysInMonth,
      summaryStats: {
        totalEmployees: totalRecords,
        totalPresentDays: globalPresentCount,
        totalAbsentDays: globalAbsentCount,
        totalLeaveDays: globalLeaveCount,
        totalHalfDays: globalHalfDayCount,
        averageAttendancePercentage: avgPct
      },
      items,
      meta: {
        totalRecords,
        limit,
        page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  }

  async getSinglePersonAttendanceReport(targetUserId, queryOptions = {}) {
    const onboardingDoc = await OnboardingTeam.findOne({
      $or: [
        { _id: targetUserId, isDeleted: { $ne: true } },
        { userId: targetUserId, isDeleted: { $ne: true } }
      ]
    }).lean();

    if (!onboardingDoc) {
      throw ApiError.notFound('Onboarding Team Member profile not found.');
    }

    const person = {
      id: onboardingDoc._id,
      userId: onboardingDoc.userId ? onboardingDoc.userId.toString() : null,
      type: 'ONBOARDING_TEAM',
      fullName: onboardingDoc.fullName,
      designation: onboardingDoc.onboardingTeamType || 'Onboarding Executive',
      employeeCode: `OBT-${onboardingDoc._id.toString().slice(-4).toUpperCase()}`,
      email: onboardingDoc.email || '',
      phoneNumber: onboardingDoc.phone || ''
    };

    const now = new Date();
    let month = parseInt(queryOptions.month, 10);
    let year = parseInt(queryOptions.year, 10);
    const dateInput = queryOptions.date ? new Date(queryOptions.date) : now;

    if (isNaN(month) || month < 1 || month > 12) {
      month = Number(dateInput.toLocaleDateString('en-US', { month: 'numeric', timeZone: INDIAN_TIMEZONE }));
    }
    if (isNaN(year) || year < 2020 || year > 2035) {
      year = Number(dateInput.toLocaleDateString('en-US', { year: 'numeric', timeZone: INDIAN_TIMEZONE }));
    }

    const { start: yearStart, end: yearEnd } = getISTYearRange(new Date(`${year}-01-01T00:00:00.000+05:30`));
    const daysInMonth = new Date(year, month, 0).getDate();

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = `${monthNames[month - 1]} ${year}`;

    const records = await Attendance.find({
      $or: [
        { employeeId: person.id, date: { $gte: yearStart, $lte: yearEnd }, isDeleted: false },
        ...(person.userId ? [{ userId: person.userId, date: { $gte: yearStart, $lte: yearEnd }, isDeleted: false }] : [])
      ]
    }).lean();

    const dayMap = new Map();
    const yearMonthMap = new Map();

    records.forEach((rec) => {
      const dObj = rec.date || (rec.dateString ? new Date(rec.dateString) : rec.createdAt);
      const formatted = formatDateString(dObj);
      if (formatted) {
        dayMap.set(formatted, {
          punchIn: rec.punchIn?.time || null,
          punchOut: rec.punchOut?.time || null,
          punchInLocation: rec.punchIn ? {
            latitude: rec.punchIn.latitude ?? null,
            longitude: rec.punchIn.longitude ?? null,
            address: rec.punchIn.address || '',
            city: rec.punchIn.city || rec.city || '',
            state: rec.punchIn.state || rec.state || '',
            pincode: rec.punchIn.pincode || rec.pincode || ''
          } : null,
          punchOutLocation: rec.punchOut ? {
            latitude: rec.punchOut.latitude ?? null,
            longitude: rec.punchOut.longitude ?? null,
            address: rec.punchOut.address || '',
            city: rec.punchOut.city || rec.city || '',
            state: rec.punchOut.state || rec.state || '',
            pincode: rec.punchOut.pincode || rec.pincode || ''
          } : null,
          status: rec.status,
          isLate: rec.isLate || false,
          lateMinutes: rec.lateMinutes || 0,
          workingMinutes: rec.workingMinutes || 0,
          overtimeMinutes: rec.overtimeMinutes || 0,
          isEarlyLeave: rec.isEarlyLeave || false
        });

        const [yStr, mStr] = formatted.split('-');
        if (Number(yStr) === year) {
          const mIdx = Number(mStr) - 1;
          const curr = yearMonthMap.get(mIdx) || 0;
          const st = (rec.status || '').toUpperCase();
          if (st === 'P' || st === 'PRESENT' || st === 'LATE_PRESENT') {
            yearMonthMap.set(mIdx, curr + 1);
          } else if (st === 'HD' || st === 'HALF_DAY') {
            yearMonthMap.set(mIdx, curr + 0.5);
          }
        }
      }
    });

    const dailySheet = [];
    let presentDays = 0;
    let absentDays = 0;
    let halfDays = 0;
    let leaveDays = 0;
    let lateDays = 0;
    let totalWorkingMins = 0;
    let totalOvertimeMins = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dd = String(d).padStart(2, '0');
      const mm = String(month).padStart(2, '0');
      const dateStr = `${year}-${mm}-${dd}`;
      const dateObj = new Date(`${dateStr}T12:00:00.000+05:30`);
      const dayOfWeek = dateObj.getDay();

      const rec = dayMap.get(dateStr);
      let statusCode = 'A';
      let statusLabel = 'ABSENT';

      if (rec) {
        const rawStatus = (rec.status || '').toUpperCase();
        if (rawStatus === 'P' || rawStatus === 'PRESENT' || rawStatus === 'LATE_PRESENT') {
          statusCode = 'P';
          statusLabel = rec.isLate ? 'LATE_PRESENT' : 'PRESENT';
          presentDays++;
          if (rec.isLate) lateDays++;
        } else if (rawStatus === 'HD' || rawStatus === 'HALF_DAY') {
          statusCode = 'HD';
          statusLabel = 'HALF_DAY';
          halfDays++;
        } else if (rawStatus === 'L' || rawStatus === 'LEAVE') {
          statusCode = 'L';
          statusLabel = 'LEAVE';
          leaveDays++;
        } else {
          statusCode = 'A';
          statusLabel = 'ABSENT';
          absentDays++;
        }

        const wMins = rec.workingMinutes || this.calculateWorkingMinutes(rec.punchIn, rec.punchOut);
        totalWorkingMins += wMins;
        totalOvertimeMins += (rec.overtimeMinutes || 0);

        dailySheet.push({
          day: d,
          date: dateStr,
          dayName: dateObj.toLocaleDateString('en-US', { weekday: 'short', timeZone: INDIAN_TIMEZONE }),
          statusCode,
          status: statusLabel,
          punchIn: this.formatTime12H(rec.punchIn),
          punchOut: this.formatTime12H(rec.punchOut),
          punchInLocation: rec.punchInLocation || null,
          punchOutLocation: rec.punchOutLocation || null,
          punchInLatitude: rec.punchInLocation?.latitude ?? null,
          punchInLongitude: rec.punchInLocation?.longitude ?? null,
          punchOutLatitude: rec.punchOutLocation?.latitude ?? null,
          punchOutLongitude: rec.punchOutLocation?.longitude ?? null,
          isLate: Boolean(rec.isLate),
          lateMinutes: Number(rec.lateMinutes || 0),
          isEarlyLeave: Boolean(rec.isEarlyLeave),
          workingMinutes: wMins,
          formattedWorkingHours: this.formatMinutesToHours(wMins)
        });
      } else {
        if (dayOfWeek === 0) {
          statusCode = 'WO';
          statusLabel = 'WEEKLY_OFF';
        } else {
          statusCode = 'A';
          statusLabel = 'ABSENT';
          absentDays++;
        }

        dailySheet.push({
          day: d,
          date: dateStr,
          dayName: dateObj.toLocaleDateString('en-US', { weekday: 'short', timeZone: INDIAN_TIMEZONE }),
          statusCode,
          status: statusLabel,
          punchIn: null,
          punchOut: null,
          punchInLocation: null,
          punchOutLocation: null,
          punchInLatitude: null,
          punchInLongitude: null,
          punchOutLatitude: null,
          punchOutLongitude: null,
          isLate: false,
          lateMinutes: 0,
          isEarlyLeave: false,
          workingMinutes: 0,
          formattedWorkingHours: '0 hrs'
        });
      }
    }

    const totalWorkedDays = presentDays + (halfDays * 0.5);
    const attendancePercentage = Number(((totalWorkedDays / daysInMonth) * 100).toFixed(1));

    const monthlySummary = {
      totalDays: daysInMonth,
      presentDays,
      absentDays,
      halfDays,
      leaveDays,
      lateDays,
      totalWorkingMinutes: totalWorkingMins,
      formattedTotalWorkingHours: this.formatMinutesToHours(totalWorkingMins),
      totalOvertimeMinutes: totalOvertimeMins,
      formattedTotalOvertime: this.formatMinutesToHours(totalOvertimeMins),
      attendancePercentage
    };

    const monthCodes = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const monthLongNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const yearlyMatrix = [];
    let totalPresentDaysYear = 0;
    let totalPossibleDaysYear = 0;

    for (let m = 0; m < 12; m++) {
      const monthCode = monthCodes[m];
      const mDaysInMonth = new Date(year, m + 1, 0).getDate();
      const pDays = Math.round((yearMonthMap.get(m) || 0) * 10) / 10;
      totalPresentDaysYear += pDays;
      totalPossibleDaysYear += mDaysInMonth;

      const mPct = mDaysInMonth > 0 ? Number(((pDays / mDaysInMonth) * 100).toFixed(1)) : 0;
      yearlyMatrix.push({
        month: m + 1,
        code: monthCode,
        name: monthLongNames[m],
        presentDays: pDays,
        daysInMonth: mDaysInMonth,
        formatted: `${pDays} Days`,
        attendancePercentage: mPct
      });
    }

    const yearlyAvgPct = totalPossibleDaysYear > 0
      ? Number(((totalPresentDaysYear / totalPossibleDaysYear) * 100).toFixed(1))
      : 0;

    return {
      success: true,
      employee: person,
      month,
      year,
      monthName,
      monthlySummary,
      dailySheet,
      yearlySummary: {
        year,
        totalPresentDaysYear,
        totalPossibleDaysYear,
        averageAttendancePercentage: yearlyAvgPct,
        formattedAverageAttendance: `${yearlyAvgPct}%`
      },
      yearlyMatrix
    };
  }

  async getYearlyAttendanceMatrix(queryOptions = {}) {
    const page = parseInt(queryOptions.page || '1', 10);
    const limit = parseInt(queryOptions.limit || '10', 10);
    const skip = (page - 1) * limit;

    let year = parseInt(queryOptions.year, 10);
    const dateInput = queryOptions.date ? new Date(queryOptions.date) : new Date();
    if (isNaN(year) || year < 2020 || year > 2035) {
      year = Number(dateInput.toLocaleDateString('en-US', { year: 'numeric', timeZone: INDIAN_TIMEZONE }));
    }

    const { start: yearStart, end: yearEnd } = getISTYearRange(new Date(`${year}-01-01T00:00:00.000+05:30`));
    const filter = { isDeleted: { $ne: true }, status: 'ACTIVE' };
    const searchKeyword = (queryOptions.search || '').trim();
    if (searchKeyword) {
      const searchRegex = new RegExp(escapeRegex(searchKeyword), 'i');
      filter.$or = [
        { fullName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { onboardingTeamType: searchRegex }
      ];
    }

    const onboardingMembers = await OnboardingTeam.find(filter).lean();
    const people = onboardingMembers.map((m) => ({
      id: m._id,
      userId: m.userId ? m.userId.toString() : null,
      type: 'ONBOARDING_TEAM',
      fullName: m.fullName || 'Onboarding Team Member',
      designation: m.onboardingTeamType || 'Onboarding Executive',
      employeeCode: `OBT-${m._id.toString().slice(-4).toUpperCase()}`,
      email: m.email || '',
      phoneNumber: m.phone || ''
    })).sort((a, b) => a.fullName.localeCompare(b.fullName));

    if (people.length === 0) {
      return {
        year,
        summaryStats: {
          totalEmployees: 0,
          totalPresentDaysYear: 0,
          totalPossibleDaysYear: 0,
          averageAttendancePercentage: 0
        },
        items: [],
        meta: {
          totalRecords: 0,
          limit,
          page,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false
        }
      };
    }

    const totalRecords = people.length;
    const pagedPeople = people.slice(skip, skip + limit);

    const allPersonIds = people.map((p) => p.id).filter(Boolean);
    const allUserIds = people.map((p) => p.userId).filter(Boolean);

    const attendanceRecords = await Attendance.find({
      $or: [
        { employeeId: { $in: allPersonIds }, date: { $gte: yearStart, $lte: yearEnd }, isDeleted: false },
        { userId: { $in: [...allPersonIds, ...allUserIds] }, date: { $gte: yearStart, $lte: yearEnd }, isDeleted: false }
      ]
    }).lean();

    const personMonthMap = new Map();

    attendanceRecords.forEach((rec) => {
      const person = people.find(
        (p) => p.id?.toString() === rec.employeeId?.toString() || (p.userId && rec.userId && p.userId === rec.userId.toString())
      );
      if (person) {
        const dObj = rec.date || (rec.dateString ? new Date(rec.dateString) : rec.createdAt);
        const formatted = formatDateString(dObj);
        if (formatted) {
          const [yStr, mStr] = formatted.split('-');
          if (Number(yStr) === year) {
            const mIdx = Number(mStr) - 1;
            const key = `${person.id}:${mIdx}`;
            const curr = personMonthMap.get(key) || 0;
            const st = (rec.status || '').toUpperCase();
            if (st === 'P' || st === 'PRESENT' || st === 'LATE_PRESENT') {
              personMonthMap.set(key, curr + 1);
            } else if (st === 'HD' || st === 'HALF_DAY') {
              personMonthMap.set(key, curr + 0.5);
            }
          }
        }
      }
    });

    const monthCodes = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const monthLongNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    let globalPresentDaysYear = 0;
    let globalPossibleDaysYear = 0;

    const buildYearlyMatrix = (person) => {
      const yearlyMatrix = [];
      let totalPresentDays = 0;
      let totalPossibleDays = 0;

      for (let m = 0; m < 12; m++) {
        const mDaysInMonth = new Date(year, m + 1, 0).getDate();
        const key = `${person.id}:${m}`;
        const pDays = Math.round((personMonthMap.get(key) || 0) * 10) / 10;
        totalPresentDays += pDays;
        totalPossibleDays += mDaysInMonth;
        globalPresentDaysYear += pDays;
        globalPossibleDaysYear += mDaysInMonth;

        const mPct = mDaysInMonth > 0 ? Number(((pDays / mDaysInMonth) * 100).toFixed(1)) : 0;
        yearlyMatrix.push({
          month: m + 1,
          code: monthCodes[m],
          name: monthLongNames[m],
          presentDays: pDays,
          daysInMonth: mDaysInMonth,
          formatted: `${pDays} Days`,
          attendancePercentage: mPct
        });
      }

      const yearlyAvgPct = totalPossibleDays > 0
        ? Number(((totalPresentDays / totalPossibleDays) * 100).toFixed(1))
        : 0;

      return {
        id: person.id,
        employeeName: person.fullName,
        designation: person.designation,
        employeeCode: person.employeeCode,
        email: person.email,
        phoneNumber: person.phoneNumber,
        yearlySummary: {
          year,
          totalPresentDaysYear: totalPresentDays,
          totalPossibleDaysYear: totalPossibleDays,
          averageAttendancePercentage: yearlyAvgPct,
          formattedAverageAttendance: `${yearlyAvgPct}%`
        },
        yearlyMatrix
      };
    };

    people.forEach((p) => buildYearlyMatrix(p));

    const items = pagedPeople.map((p, idx) => ({
      srNo: skip + idx + 1,
      ...buildYearlyMatrix(p)
    }));

    const globalAvgPct = globalPossibleDaysYear > 0
      ? Number(((globalPresentDaysYear / globalPossibleDaysYear) * 100).toFixed(1))
      : 0;
    const totalPages = Math.max(1, Math.ceil(totalRecords / limit));

    return {
      year,
      summaryStats: {
        totalEmployees: totalRecords,
        totalPresentDaysYear: globalPresentDaysYear,
        totalPossibleDaysYear: globalPossibleDaysYear,
        averageAttendancePercentage: globalAvgPct
      },
      items,
      meta: {
        totalRecords,
        limit,
        page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  }
}

export const onboardingAttendanceService = new OnboardingAttendanceService();
