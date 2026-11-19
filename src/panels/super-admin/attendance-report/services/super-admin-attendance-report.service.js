import { Admin } from '../../../../models/admin.model.js';
import { OnboardingTeam } from '../../../../models/onboarding-team.model.js';
import { Attendance } from '../../../../models/attendance.model.js';
import { getISTDayRange, getISTMonthRange, getISTYearRange, formatTime12H } from '../../../../utils/date.util.js';

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class SuperAdminAttendanceReportService {
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

  async getFilters() {
    return {
      userTypes: ['SUPER_ADMIN', 'SUB_ADMIN', 'ONBOARDING_TEAM']
    };
  }

  async getReport(query = {}) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const period = query.period || 'DAILY';
    const selectedDate = query.date || new Date();
    const search = query.search ? new RegExp(escapeRegex(query.search), 'i') : null;

    const adminFilter = { isDeleted: { $ne: true }, status: 'ACTIVE' };
    const onboardingFilter = { isDeleted: { $ne: true }, status: 'ACTIVE' };

    if (search) {
      adminFilter.$or = [
        { name: search },
        { email: search },
        { phoneNumber: search }
      ];
      onboardingFilter.$or = [
        { fullName: search },
        { email: search },
        { phone: search },
        { onboardingTeamType: search }
      ];
    }

    const [admins, onboardingMembers] = await Promise.all([
      Admin.find(adminFilter).lean(),
      OnboardingTeam.find(onboardingFilter).lean()
    ]);

    const people = [
      ...admins.map((a) => ({
        id: a._id,
        userId: a._id.toString(),
        type: a.role || 'SUPER_ADMIN',
        name: a.name || 'Admin',
        profileImage: a.avatar || null,
        designation: a.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Sub Admin'
      })),
      ...onboardingMembers.map((m) => ({
        id: m._id,
        userId: m.userId ? m.userId.toString() : null,
        type: 'ONBOARDING_TEAM',
        name: m.fullName || 'Onboarding Team Member',
        profileImage: m.profileImage || null,
        designation: m.onboardingTeamType || 'Onboarding Executive'
      }))
    ].sort((a, b) => a.name.localeCompare(b.name));

    if (!people.length) {
      return this.emptyPage(page, limit);
    }

    const { start, end } = this.getDateRange(selectedDate, period);
    const personIds = people.map((p) => p.id).filter(Boolean);
    const userIds = people.map((p) => p.userId).filter(Boolean);

    const attendanceRecords = await Attendance.find({
      $or: [
        { employeeId: { $in: personIds }, date: { $gte: start, $lte: end }, isDeleted: false },
        { userId: { $in: userIds }, date: { $gte: start, $lte: end }, isDeleted: false }
      ]
    }).sort({ createdAt: -1 }).lean();

    const latestByPerson = new Map();
    for (const raw of attendanceRecords) {
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

export const superAdminAttendanceReportService = new SuperAdminAttendanceReportService();
