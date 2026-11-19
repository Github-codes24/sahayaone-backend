import { Branch } from '../../../../models/branch.model.js';
import { BranchManager } from '../../../../models/branch-manager.model.js';
import { SocietyEmployee } from '../../../../models/society-employee.model.js';
import { Attendance } from '../../../../models/attendance.model.js';
import { ApiError } from '../../../../common/api.error.js';
import { SocietyAttendance } from '../models/society-attendance.model.js';

import { getISTDayRange, getISTMonthRange, getISTYearRange, formatTime12H } from '../../../../utils/date.util.js';

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class AttendanceReportService {
  requireBank(context) {
    if (!context?.bankId) throw ApiError.forbidden('A valid society bank context is required.');
    return context.bankId;
  }

  getDateRange(dateValue, period) {
    const selected = dateValue ? new Date(dateValue) : new Date();
    if (period === 'YEARLY') {
      const { start, end } = getISTYearRange(selected);
      return { start, end };
    }
    if (period === 'MONTHLY') {
      const { start, end } = getISTMonthRange(selected);
      return { start, end };
    }
    const { start, end } = getISTDayRange(selected);
    return { start, end };
  }

  formatTime(value) {
    if (!value) return null;
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    }).format(new Date(value));
  }

  calculateTotalHours(punchIn, punchOut) {
    if (!punchIn || !punchOut) return null;
    const milliseconds = new Date(punchOut).getTime() - new Date(punchIn).getTime();
    if (milliseconds < 0) return null;
    const totalMinutes = Math.floor(milliseconds / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes ? `${hours} hrs ${minutes} mins` : `${hours} hrs`;
  }

  async getFilters(context, state = '') {
    const bankId = this.requireBank(context);
    const base = { bankId };
    if (context.branchId) base._id = context.branchId;
    if (state) base.$or = [{ state }, { 'address.state': state }];

    const [states, branches] = await Promise.all([
      Branch.aggregate([
        { $match: { bankId, isDeleted: false, ...(context.branchId ? { _id: context.branchId } : {}) } },
        { $project: { state: { $ifNull: ['$state', '$address.state'] } } },
        { $match: { state: { $nin: ['', null] } } },
        { $group: { _id: '$state' } },
        { $sort: { _id: 1 } }
      ]),
      Branch.find(base).select('name code state address.state').sort({ name: 1 }).lean()
    ]);

    return {
      states: states.map((item) => item._id),
      branches: branches.map((branch) => ({
        id: branch._id,
        name: branch.name,
        code: branch.code,
        state: branch.state || branch.address?.state || ''
      }))
    };
  }

  async getReport(context, query = {}) {
    const bankId = this.requireBank(context);
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const period = query.period || 'DAILY';
    const selectedDate = query.date || new Date();
    const branchFilter = context.branchId || query.branchId || null;
    const branchQuery = { bankId };
    if (branchFilter) branchQuery._id = branchFilter;
    if (query.state) branchQuery.$or = [{ state: query.state }, { 'address.state': query.state }];

    const branches = await Branch.find(branchQuery).select('_id name state address.state').lean();
    const branchIds = branches.map((branch) => branch._id);
    if (!branchIds.length) {
      return this.emptyPage(page, limit);
    }

    const employeeFilter = { bankId, branchId: { $in: branchIds }, status: 'ACTIVE' };
    const managerFilter = { bankId, branchId: { $in: branchIds }, status: 'ACTIVE' };
    if (query.search) {
      const search = new RegExp(escapeRegex(query.search), 'i');
      const conditions = [
        { fullName: search },
        { designation: search },
        { 'personalDetails.fullName': search },
        { 'jobDetails.designation': search }
      ];
      employeeFilter.$or = conditions;
      managerFilter.$or = conditions;
    }

    const [employees, managers] = await Promise.all([
      SocietyEmployee.find(employeeFilter).lean(),
      BranchManager.find(managerFilter).lean()
    ]);
    const people = [
      ...managers.map((manager) => ({
        id: manager._id,
        userId: manager.userId ? manager.userId.toString() : null,
        type: 'BRANCH_MANAGER',
        branchId: manager.branchId,
        name: manager.fullName || manager.personalDetails?.fullName || '',
        profileImage: manager.personalDetails?.profileImage || null,
        designation: manager.designation || manager.jobDetails?.designation || 'Branch Manager'
      })),
      ...employees.map((employee) => ({
        id: employee._id,
        userId: employee.userId ? employee.userId.toString() : null,
        type: 'SOCIETY_EMPLOYEE',
        branchId: employee.branchId,
        name: employee.fullName || employee.personalDetails?.fullName || '',
        profileImage: employee.personalDetails?.profileImage || null,
        designation: employee.designation || employee.jobDetails?.designation || 'Employee'
      }))
    ].sort((a, b) => a.name.localeCompare(b.name));

    const { start, end } = this.getDateRange(selectedDate, period);
    const employeeIds = people.map((p) => p.id).filter(Boolean);
    const userIds = people.map((p) => p.userId).filter(Boolean);

    const [attendanceRecords, rawAttendanceRecords] = await Promise.all([
      SocietyAttendance.find({
        bankId,
        branchId: { $in: branchIds },
        employeeId: { $in: employeeIds },
        date: { $gte: start, $lte: end }
      }).sort({ date: -1 }).lean(),
      Attendance.find({
        $or: [
          { bankId, branchId: { $in: branchIds }, date: { $gte: start, $lte: end }, isDeleted: false },
          { employeeId: { $in: employeeIds }, date: { $gte: start, $lte: end }, isDeleted: false },
          { userId: { $in: userIds }, date: { $gte: start, $lte: end }, isDeleted: false }
        ]
      }).sort({ createdAt: -1 }).lean()
    ]);

    const latestByPerson = new Map();
    for (const record of attendanceRecords) {
      const key = `${record.employeeType}:${record.employeeId}`;
      if (!latestByPerson.has(key)) {
        latestByPerson.set(key, {
          punchIn: record.punchIn,
          punchOut: record.punchOut,
          status: record.status,
          punchInLocation: record.punchInLocation || null,
          punchOutLocation: record.punchOutLocation || null
        });
      }
    }

    // Merge from Attendance collection if SocietyAttendance is missing or has incomplete punchIn/punchOut
    for (const raw of rawAttendanceRecords) {
      const matchedPerson = people.find(p => p.id?.toString() === raw.employeeId?.toString()) ||
                            people.find(p => p.userId && raw.userId && p.userId === raw.userId.toString());
      if (matchedPerson) {
        const key = `${matchedPerson.type}:${matchedPerson.id}`;
        const existing = latestByPerson.get(key) || {};

        const rawPunchInLoc = raw.punchIn ? {
          latitude: raw.punchIn.latitude ?? null,
          longitude: raw.punchIn.longitude ?? null,
          address: raw.punchIn.address || '',
          city: raw.punchIn.city || raw.city || '',
          state: raw.punchIn.state || raw.state || '',
          pincode: raw.punchIn.pincode || raw.pincode || ''
        } : null;

        const rawPunchOutLoc = raw.punchOut ? {
          latitude: raw.punchOut.latitude ?? null,
          longitude: raw.punchOut.longitude ?? null,
          address: raw.punchOut.address || '',
          city: raw.punchOut.city || raw.city || '',
          state: raw.punchOut.state || raw.state || '',
          pincode: raw.punchOut.pincode || raw.pincode || ''
        } : null;

        if (!existing.punchIn && raw.punchIn?.time) existing.punchIn = raw.punchIn.time;
        if (!existing.punchOut && raw.punchOut?.time) existing.punchOut = raw.punchOut.time;
        if (!existing.punchInLocation && rawPunchInLoc) existing.punchInLocation = rawPunchInLoc;
        if (!existing.punchOutLocation && rawPunchOutLoc) existing.punchOutLocation = rawPunchOutLoc;

        if (!existing.status || (existing.status === 'A' && raw.status && raw.status !== 'ABSENT')) {
          existing.status = raw.status === 'HALF_DAY' ? 'HD' : (raw.status === 'LEAVE' ? 'L' : 'P');
        }

        latestByPerson.set(key, existing);
      }
    }

    const totalRecords = people.length;
    const skip = (page - 1) * limit;
    const pagePeople = people.slice(skip, skip + limit);
    const items = pagePeople.map((person, index) => {
      const record = latestByPerson.get(`${person.type}:${person.id}`);
      const pInLoc = record?.punchInLocation || null;
      const pOutLoc = record?.punchOutLocation || null;

      return {
        srNo: skip + index + 1,
        id: person.id,
        name: person.name,
        profileImage: person.profileImage,
        designation: person.designation,
        punchIn: this.formatTime(record?.punchIn),
        punchOut: this.formatTime(record?.punchOut),
        punchInLocation: pInLoc,
        punchOutLocation: pOutLoc,
        punchInLatitude: pInLoc?.latitude ?? null,
        punchInLongitude: pInLoc?.longitude ?? null,
        punchOutLatitude: pOutLoc?.latitude ?? null,
        punchOutLongitude: pOutLoc?.longitude ?? null,
        totalHrs: this.calculateTotalHours(record?.punchIn, record?.punchOut),
        status: record?.status || 'A'
      };
    });
    const totalPages = Math.max(1, Math.ceil(totalRecords / limit));
    return {
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

  emptyPage(page, limit) {
    return {
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
}

export const attendanceReportService = new AttendanceReportService();
