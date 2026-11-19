import { SocietyEmployee } from '../../../../models/society-employee.model.js';
import { BranchManager } from '../../../../models/branch-manager.model.js';
import { Branch } from '../../../../models/branch.model.js';
import { Attendance } from '../../../../models/attendance.model.js';
import { SocietyAttendance } from '../../attendance-report/models/society-attendance.model.js';
import { ApiError } from '../../../../common/api.error.js';
import { formatDateString, getISTMonthRange, getISTYearRange, INDIAN_TIMEZONE } from '../../../../utils/date.util.js';

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class SocietyAttendanceService {
  /**
   * Format minutes to readable hours and minutes string
   */
  formatMinutesToHours(minutes = 0) {
    const mins = Math.max(0, Math.floor(Number(minutes) || 0));
    if (mins === 0) return '0 hrs';
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs === 0) return `${remMins} mins`;
    if (remMins === 0) return `${hrs} hrs`;
    return `${hrs} hrs ${remMins} mins`;
  }

  /**
   * Format date to 12-hour AM/PM time format in IST timezone
   */
  formatTime12H(value) {
    if (!value) return null;
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    }).format(new Date(value));
  }

  /**
   * Calculate total working hours between punchIn and punchOut
   */
  calculateWorkingMinutes(punchIn, punchOut) {
    if (!punchIn || !punchOut) return 0;
    const diff = new Date(punchOut).getTime() - new Date(punchIn).getTime();
    if (diff <= 0) return 0;
    return Math.floor(diff / 60000);
  }

  /**
   * Get all employee monthly attendance sheet/data with location, branch, search filters and pagination
   */
  async getMonthlyAttendanceSheet(societyContext, queryOptions = {}) {
    const bankId = societyContext?.bankId;
    if (!bankId && societyContext?.role !== 'SUPER_ADMIN') {
      throw ApiError.forbidden('A valid society bank context is required.');
    }

    const page = parseInt(queryOptions.page || '1', 10);
    const limit = parseInt(queryOptions.limit || '10', 10);
    const skip = (page - 1) * limit;

    // 1. Month & Year Resolution
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

    // 2. Branch & Location (City/State) Scoping
    const branchQuery = { isDeleted: { $ne: true } };
    if (bankId) branchQuery.bankId = bankId;

    const scopedBranchId = societyContext?.branchId || queryOptions.branchId;
    if (scopedBranchId) {
      branchQuery._id = scopedBranchId;
    } else if (
      queryOptions.branchIds &&
      (Array.isArray(queryOptions.branchIds)
        ? queryOptions.branchIds.length > 0
        : String(queryOptions.branchIds).trim())
    ) {
      const bIds = Array.isArray(queryOptions.branchIds)
        ? queryOptions.branchIds
        : String(queryOptions.branchIds)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
      branchQuery._id = { $in: bIds };
    }

    const cityInput = queryOptions.cities || queryOptions.city;
    const stateInput = queryOptions.states || queryOptions.state;

    if (cityInput) {
      const cityList = Array.isArray(cityInput)
        ? cityInput
        : String(cityInput)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
      const cityRegexes = cityList.map((c) => new RegExp(escapeRegex(c), 'i'));
      branchQuery.$or = [
        { 'address.city': { $in: cityRegexes } },
        { city: { $in: cityRegexes } }
      ];
    }

    if (stateInput) {
      const stateList = Array.isArray(stateInput)
        ? stateInput
        : String(stateInput)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
      const stateRegexes = stateList.map((s) => new RegExp(escapeRegex(s), 'i'));
      const stateConds = [
        { state: { $in: stateRegexes } },
        { 'address.state': { $in: stateRegexes } }
      ];

      if (branchQuery.$or) {
        branchQuery.$and = [{ $or: branchQuery.$or }, { $or: stateConds }];
        delete branchQuery.$or;
      } else {
        branchQuery.$or = stateConds;
      }
    }

    const matchingBranches = await Branch.find(branchQuery)
      .select('_id name code state address')
      .lean();
    const branchIds = matchingBranches.map((b) => b._id);

    if (branchIds.length === 0) {
      return {
        month,
        year,
        monthName,
        daysInMonth,
        summaryStats: {
          totalEmployees: 0,
          totalPresentDays: 0,
          totalAbsentDays: 0,
          totalLeaveDays: 0,
          totalHalfDays: 0,
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

    // 3. Employee Scoping & Search Filtering
    const empFilter = {
      bankId,
      branchId: { $in: branchIds },
      isDeleted: { $ne: true },
      status: 'ACTIVE'
    };

    const searchKeyword = (queryOptions.search || '').trim();
    if (searchKeyword) {
      const searchRegex = new RegExp(escapeRegex(searchKeyword), 'i');
      const searchConditions = [
        { fullName: searchRegex },
        { designation: searchRegex },
        { email: searchRegex },
        { phoneNumber: searchRegex },
        { employeeCode: searchRegex },
        { 'personalDetails.fullName': searchRegex },
        { 'jobDetails.designation': searchRegex }
      ];
      empFilter.$or = searchConditions;
    }

    const [employees, managers] = await Promise.all([
      SocietyEmployee.find(empFilter).populate('branchId', 'name code').lean(),
      BranchManager.find(empFilter).populate('branchId', 'name code').lean()
    ]);

    const userSeen = new Set();
    const allPeople = [];

    [...managers, ...employees].forEach((p) => {
      const key = p.userId ? p.userId.toString() : p._id.toString();
      if (!userSeen.has(key)) {
        userSeen.add(key);
        allPeople.push({
          id: p._id,
          userId: p.userId ? p.userId.toString() : null,
          type: p.role === 'BRANCH_MANAGER' ? 'BRANCH_MANAGER' : 'SOCIETY_EMPLOYEE',
          branchId: p.branchId?._id || p.branchId,
          branchName: p.branchId?.name || 'N/A',
          fullName: p.fullName || p.personalDetails?.fullName || 'N/A',
          designation: p.designation || p.jobDetails?.designation || (p.role === 'BRANCH_MANAGER' ? 'Branch Manager' : 'Employee'),
          employeeCode: p.employeeCode || 'N/A',
          email: p.email || '',
          phoneNumber: p.phoneNumber || ''
        });
      }
    });

    allPeople.sort((a, b) => a.fullName.localeCompare(b.fullName));

    const totalRecords = allPeople.length;
    const pagedPeople = allPeople.slice(skip, skip + limit);

    // 4. Fetch Attendance Data for month across SocietyAttendance and Attendance
    const allPersonIds = allPeople.map((p) => p.id).filter(Boolean);
    const allUserIds = allPeople.map((p) => p.userId).filter(Boolean);

    const [societyAttendanceList, coreAttendanceList] = await Promise.all([
      SocietyAttendance.find({
        bankId,
        employeeId: { $in: allPersonIds },
        date: { $gte: monthStart, $lte: monthEnd },
        isDeleted: false
      }).lean(),
      Attendance.find({
        $or: [
          { bankId, employeeId: { $in: allPersonIds }, date: { $gte: monthStart, $lte: monthEnd }, isDeleted: false },
          { userId: { $in: allUserIds }, date: { $gte: monthStart, $lte: monthEnd }, isDeleted: false }
        ]
      }).lean()
    ]);

    // Map attendance records by `personId:YYYY-MM-DD`
    const attendanceMap = new Map();

    const getDayKey = (personId, dateObj) => {
      if (!dateObj) return null;
      const formatted = formatDateString(dateObj);
      return formatted ? `${personId}:${formatted}` : null;
    };

    // Populate from SocietyAttendance first
    societyAttendanceList.forEach((rec) => {
      const key = getDayKey(rec.employeeId, rec.date);
      if (key) {
        attendanceMap.set(key, {
          punchIn: rec.punchIn,
          punchOut: rec.punchOut,
          status: rec.status,
          isLate: Boolean(rec.isLate),
          lateMinutes: Number(rec.lateMinutes || 0)
        });
      }
    });

    // Merge from core Attendance collection
    coreAttendanceList.forEach((rec) => {
      const person = allPeople.find(
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

    // 5. Build Monthly Sheet for Paged Employees & Aggregate Summary Stats
    let globalPresentCount = 0;
    let globalAbsentCount = 0;
    let globalLeaveCount = 0;
    let globalHalfDayCount = 0;

    // Helper to calculate daily sheet for one employee
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
        const dayOfWeek = dateObj.getDay(); // 0 = Sunday

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
          // No record found: if Sunday mark Weekly Off
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
        branchId: person.branchId,
        branchName: person.branchName,
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

    // Process summary stats across ALL filtered employees
    allPeople.forEach((p) => buildEmployeeSheet(p, false));

    // Process detailed item sheets for PAGED employees
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

  /**
   * Get single person monthly and yearly attendance report (with punch locations and 12-month summary matrix)
   */
  async getSinglePersonAttendanceReport(societyContext, employeeOrUserId, queryOptions = {}) {
    const bankId = societyContext?.bankId;

    // 1. Resolve employee or branch manager profile
    let personDoc = null;
    let personType = 'SOCIETY_EMPLOYEE';

    const targetId = employeeOrUserId || queryOptions.employeeId || queryOptions.userId;

    if (targetId && typeof targetId === 'string' && targetId.match(/^[0-9a-fA-F]{24}$/)) {
      personDoc = await SocietyEmployee.findOne({ _id: targetId, isDeleted: { $ne: true } })
        .populate('branchId', 'name code')
        .lean();
      if (!personDoc) {
        personDoc = await BranchManager.findOne({ _id: targetId, isDeleted: { $ne: true } })
          .populate('branchId', 'name code')
          .lean();
        if (personDoc) personType = 'BRANCH_MANAGER';
      }
      if (!personDoc) {
        personDoc = await SocietyEmployee.findOne({ userId: targetId, isDeleted: { $ne: true } })
          .populate('branchId', 'name code')
          .lean();
        if (!personDoc) {
          personDoc = await BranchManager.findOne({ userId: targetId, isDeleted: { $ne: true } })
            .populate('branchId', 'name code')
            .lean();
          if (personDoc) personType = 'BRANCH_MANAGER';
        }
      }
    }

    if (!personDoc && societyContext?.userId) {
      const uId = societyContext.userId;
      personDoc = await SocietyEmployee.findOne({ userId: uId, isDeleted: { $ne: true } })
        .populate('branchId', 'name code')
        .lean();
      if (!personDoc) {
        personDoc = await BranchManager.findOne({ userId: uId, isDeleted: { $ne: true } })
          .populate('branchId', 'name code')
          .lean();
        if (personDoc) personType = 'BRANCH_MANAGER';
      }
    }

    if (!personDoc) {
      throw ApiError.notFound('Employee profile not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const employeeProfile = {
      id: personDoc._id,
      userId: personDoc.userId ? personDoc.userId.toString() : null,
      type: personType,
      fullName: personDoc.fullName || personDoc.personalDetails?.fullName || 'N/A',
      designation: personDoc.designation || personDoc.jobDetails?.designation || (personType === 'BRANCH_MANAGER' ? 'Branch Manager' : 'Employee'),
      employeeCode: personDoc.employeeCode || 'N/A',
      email: personDoc.email || '',
      phoneNumber: personDoc.phoneNumber || '',
      branchId: personDoc.branchId?._id || personDoc.branchId || null,
      branchName: personDoc.branchId?.name || 'N/A',
      profileImage: personDoc.personalDetails?.profileImage || null
    };

    // 2. Resolve Year and Month
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

    const { start: monthStart, end: monthEnd } = getISTMonthRange(new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00.000+05:30`));
    const { start: yearStart, end: yearEnd } = getISTYearRange(new Date(`${year}-01-01T00:00:00.000+05:30`));
    const daysInMonth = new Date(year, month, 0).getDate();

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = `${monthNames[month - 1]} ${year}`;

    // 3. Query Attendance Records for Year & Month
    const [societyRecords, coreRecords] = await Promise.all([
      SocietyAttendance.find({
        employeeId: personDoc._id,
        date: { $gte: yearStart, $lte: yearEnd },
        isDeleted: false
      }).lean(),
      Attendance.find({
        $or: [
          { employeeId: personDoc._id, date: { $gte: yearStart, $lte: yearEnd }, isDeleted: false },
          ...(personDoc.userId ? [{ userId: personDoc.userId, date: { $gte: yearStart, $lte: yearEnd }, isDeleted: false }] : [])
        ]
      }).lean()
    ]);

    // Build day map for Month (YYYY-MM-DD -> record)
    const dayMap = new Map();
    // Build month matrix map for Year (monthIndex 0-11 -> present count)
    const yearMonthMap = new Map();

    const addYearPresence = (dateObj, status) => {
      if (!dateObj) return;
      const formatted = formatDateString(dateObj);
      if (!formatted) return;
      const [yStr, mStr] = formatted.split('-');
      if (Number(yStr) !== year) return;
      const mIdx = Number(mStr) - 1;
      const current = yearMonthMap.get(mIdx) || 0;
      const st = (status || '').toUpperCase();
      if (st === 'P' || st === 'PRESENT' || st === 'LATE_PRESENT') {
        yearMonthMap.set(mIdx, current + 1);
      } else if (st === 'HD' || st === 'HALF_DAY') {
        yearMonthMap.set(mIdx, current + 0.5);
      }
    };

    societyRecords.forEach((rec) => {
      const formatted = formatDateString(rec.date);
      if (formatted) {
        dayMap.set(formatted, {
          punchIn: rec.punchIn,
          punchOut: rec.punchOut,
          status: rec.status,
          isLate: Boolean(rec.isLate),
          lateMinutes: Number(rec.lateMinutes || 0)
        });
      }
      addYearPresence(rec.date, rec.status);
    });

    coreRecords.forEach((rec) => {
      const dObj = rec.date || (rec.dateString ? new Date(rec.dateString) : rec.createdAt);
      const formatted = formatDateString(dObj);
      if (formatted) {
        const existing = dayMap.get(formatted) || {};
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

        dayMap.set(formatted, {
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
      addYearPresence(dObj, rec.status);
    });

    // 4. Construct Monthly Daily Breakdown
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

    // 5. Construct 12-Month Yearly Matrix for Single Person
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

    const yearlySummary = {
      year,
      totalPresentDaysYear,
      totalPossibleDaysYear,
      averageAttendancePercentage: yearlyAvgPct,
      formattedAverageAttendance: `${yearlyAvgPct}%`
    };

    return {
      success: true,
      employee: employeeProfile,
      month,
      year,
      monthName,
      monthlySummary,
      dailySheet,
      yearlySummary,
      yearlyMatrix
    };
  }
}

export const societyAttendanceService = new SocietyAttendanceService();
