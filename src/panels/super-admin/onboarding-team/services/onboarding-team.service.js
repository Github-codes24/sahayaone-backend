import bcrypt from 'bcryptjs';
import { OnboardingTeam } from '../../../../models/onboarding-team.model.js';
import { Bank } from '../../../../models/bank.model.js';
import { User } from '../../../../models/user.model.js';
import { UserRole, UserType } from '../../../../constants/user-role.constant.js';
import { storageManager } from '../../../../storage/storage.manager.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';

export class OnboardingTeamService {
  formatDateShort(dateObj) {
    if (!dateObj) return '01-01-2025';
    const d = new Date(dateObj);
    if (isNaN(d.getTime())) return '01-01-2025';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }

  formatDateSlash(dateObj) {
    if (!dateObj) return '01/01/1996';
    const d = new Date(dateObj);
    if (isNaN(d.getTime())) return '01/01/1996';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  formatDateLong(dateObj) {
    if (!dateObj) return 'January 1, 2026';
    const d = new Date(dateObj);
    if (isNaN(d.getTime())) return 'January 1, 2026';
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  formatMemberResponse(member, onboardedBanksData = null) {
    const onboardedBanks = onboardedBanksData?.banks || [];
    const totalOnboardedBanks = onboardedBanksData?.totalCount ?? (onboardedBanksData?.banks ? onboardedBanksData.banks.length : 0);

    return {
      id: member._id,
      memberId: member._id,
      userId: member.userId || null,
      fullName: member.fullName,
      name: member.fullName,
      onboardingTeamName: member.fullName,
      profileImage: member.profileImage || null,
      gender: member.gender || 'Male',
      dob: member.dob ? this.formatDateSlash(member.dob) : '01/01/1996',
      dateOfBirth: member.dob ? this.formatDateSlash(member.dob) : '01/01/1996',
      phone: member.phone,
      phoneNumber: member.phone,
      email: member.email,
      password: 'Password@123',
      address: member.address || '',
      onboardingTeamType: member.onboardingTeamType,
      salary: member.salary || 0,
      formattedSalary: `₹${(member.salary || 0).toLocaleString('en-IN')}`,
      joiningDate: member.joiningDate,
      registeredOn: this.formatDateLong(member.createdAt || member.joiningDate),
      meta: {
        shift: `${member.shiftInTime || '10:00'}-${member.shiftOutTime || '21:00'}`,
        weeklyOff: 'Sat & Sun',
        joined: this.formatDateShort(member.joiningDate || member.createdAt)
      },
      personalDetails: {
        fullName: member.fullName,
        gender: member.gender || 'Male',
        dateOfBirth: member.dob ? this.formatDateSlash(member.dob) : '01/01/1996',
        phone: member.phone,
        email: member.email,
        password: 'Password@123',
        address: member.address || ''
      },
      jobDetails: {
        onboardingTeamType: member.onboardingTeamType,
        salary: member.salary || 0
      },
      shiftAndWoff: {
        shift: {
          inTime: member.shiftInTime || '10:00',
          outTime: member.shiftOutTime || '21:00'
        },
        weeklyOff: {
          weeklyOffDays: member.weeklyOffDays || ['Saturday', 'Sunday'],
          formattedDays: 'Saturday, Sunday',
          isWeeklyOffPayable: member.isWeeklyOffPayable ?? true,
          isVariableWeeklyOff: member.isVariableWeeklyOff ?? true,
          isSecondWeeklyOff: member.isSecondWeeklyOff ?? true
        }
      },
      otherDetails: {
        lateAllowedMins: `${member.lateAllowedMins || 15} (As Per Shift)`,
        earlyAllowedMins: member.earlyAllowedMins || 15,
        halfDayMins: member.halfDayMins || 240,
        fullDayMins: `${member.fullDayMins || 480} (As Per Shift)`
      },
      attendance: {
        punch: {
          shiftType: member.shiftType || 'Double',
          noOutPunchAction: member.noOutPunchAction || 'Mark Half Day',
          presentOnWoHolidayAction: member.presentOnWoHolidayAction || 'Mark as COFF'
        },
        lateCut: {
          allowedDays: member.lateCutAllowedDays || 3,
          action: member.lateCutAction || 'Half Day',
          isLateCutAllowed: member.isLateCutAllowed ?? true,
          isExtraLateCutDeduction: member.isExtraLateCutDeduction ?? true,
          isAdditionalLateCutInLeaveBalance: member.isAdditionalLateCutInLeaveBalance ?? true
        }
      },
      lunchAndEarlyGoing: {
        lunchAllowedMins: `${member.lunchAllowedMins || 15} (As Per Shift)`,
        isLunchAllowed: member.isLunchAllowed ?? true,
        isEarlyGoingAllowed: member.isEarlyGoingAllowed ?? true
      },
      overtime: {
        isOvertimeAllowed: member.isOvertimeAllowed ?? true,
        isCustomOT: member.isCustomOT ?? true,
        isBeforeOT: member.isBeforeOT ?? true,
        otGracePeriodMins: member.otGracePeriodMins || 5,
        ot1DayHrs: member.ot1DayHrs || 4,
        isOTAsPerShift: member.isOTAsPerShift ?? true,
        isConsiderOTAsCOFF: member.isConsiderOTAsCOFF ?? true
      },
      woffAndHoff: {
        sandwichWeeklyOff: member.sandwichWeeklyOff || {
          absentBeforeWO: true,
          absentAfterWO: true,
          absentBeforeOrAfterWO: true,
          addWorkingHrsOnWODay: true,
          lateDeductionNotAppliedOnWOIfPresent: true
        },
        sandwichHolidays: member.sandwichHolidays || {
          absentBeforeHoliday: true,
          absentAfterHoliday: true,
          absentBeforeAndAfterHoliday: true,
          addWorkingHoursOnHolidayDay: true,
          lateDeductionNotAppliedOnHolidayIfPresent: true
        },
        leaveBetweenHolidayOrWO: member.leaveBetweenHolidayOrWO || {
          considerWOInLeaveApp: true,
          considerHolidayInLeaveApp: true,
          absentWoLeaveWoAbsent: true,
          leaveWoAbsentWoAbsent: true,
          absentHolidayLeaveHolidayAbsent: true,
          leaveHolidayAbsentHolidayAbsent: true
        }
      },
      totalOnboardedBanks,
      onboardedBanksCount: totalOnboardedBanks,
      onboardedBanks,
      onboardedBy: member.createdBy
        ? {
            id: member.createdBy._id,
            userId: member.createdBy._id,
            name: member.createdBy.fullName || member.createdBy.name || member.createdBy.email,
            email: member.createdBy.email,
            phone: member.createdBy.phoneNumber || member.createdBy.phone,
            role: member.createdBy.role,
            type: member.createdBy.role,
          }
        : null,
      createdBy: member.createdBy
        ? {
            id: member.createdBy._id,
            userId: member.createdBy._id,
            name: member.createdBy.fullName || member.createdBy.name || member.createdBy.email,
            email: member.createdBy.email,
            phone: member.createdBy.phoneNumber || member.createdBy.phone,
            role: member.createdBy.role,
          }
        : null,
      status: member.status || 'ACTIVE',
      createdAt: member.createdAt,
      updatedAt: member.updatedAt
    };
  }

  /**
   * Get dynamic filter dropdown options
   */
  async getFilterDropdowns() {
    return {
      onboardingTeamTypes: [
        { label: 'Regional OnboardingTeam', value: 'Regional OnboardingTeam' },
        { label: 'Branch OnboardingTeam', value: 'Branch OnboardingTeam' },
        { label: 'Collection OnboardingTeam', value: 'Collection OnboardingTeam' }
      ]
    };
  }

  /**
   * List Onboarding Team members with multi-select filters and pagination
   */
  async listOnboardingTeam(queryOptions) {
    const page = parseInt(queryOptions.page || '1', 10);
    const limit = parseInt(queryOptions.limit || '10', 10);
    const search = (queryOptions.search || '').trim();
    const skip = (page - 1) * limit;

    const filter = {
      isDeleted: { $ne: true }
    };

    if (queryOptions.onboardingTeamType) {
      const types = Array.isArray(queryOptions.onboardingTeamType)
        ? queryOptions.onboardingTeamType
        : [queryOptions.onboardingTeamType];
      filter.onboardingTeamType = { $in: types };
    }

    if (queryOptions.status) {
      filter.status = queryOptions.status.toUpperCase();
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [
        { fullName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { onboardingTeamType: searchRegex }
      ];
    }

    const sortField = queryOptions.sortBy || 'createdAt';
    const sortOrder = (queryOptions.sortOrder || 'desc').toLowerCase() === 'asc' ? 1 : -1;

    let members = [];
    let totalRecords = 0;

    try {
      if (OnboardingTeam.db && OnboardingTeam.db.readyState === 1) {
        [members, totalRecords] = await Promise.all([
          OnboardingTeam.find(filter)
            .populate('createdBy', 'fullName name email phoneNumber role')
            .sort({ [sortField]: sortOrder })
            .skip(skip)
            .limit(limit)
            .lean(),
          OnboardingTeam.countDocuments(filter)
        ]);
      }
    } catch (err) {
      // Fallback
    }

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    const items = members.map((m, idx) => ({
      srNo: skip + idx + 1,
      ...this.formatMemberResponse(m)
    }));

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

  /**
   * Fetch single Onboarding Team member details by ID
   */
  async getOnboardingTeamById(id) {
    const member = await OnboardingTeam.findOne({ _id: id, isDeleted: { $ne: true } })
      .populate('createdBy', 'fullName name email phoneNumber role')
      .lean();

    if (!member) {
      throw ApiError.notFound('Onboarding Team Member not found.');
    }

    let onboardedBanks = [];
    let totalOnboardedBanks = 0;

    try {
      if (Bank.db && Bank.db.readyState === 1) {
        const bankFilter = {
          isDeleted: { $ne: true },
          $or: [
            { onboardingTeamMemberId: member._id },
            { cashCollectedByTeamId: member._id },
            ...(member.userId ? [{ createdBy: member.userId }] : [])
          ]
        };

        const [banks, totalCount] = await Promise.all([
          Bank.find(bankFilter)
            .select('_id name code logo logoKey email alternateEmail phoneNumber ubo credit status paymentMethod paymentStatus totalAmountPaid createdAt updatedAt')
            .sort({ createdAt: -1 })
            .lean(),
          Bank.countDocuments(bankFilter)
        ]);

        onboardedBanks = banks.map((b) => ({
          id: b._id,
          bankId: b._id,
          name: b.name,
          bankName: b.name,
          code: b.code,
          logo: b.logo || null,
          email: b.email,
          alternateEmail: b.alternateEmail || null,
          phoneNumber: b.phoneNumber || null,
          ubo: b.ubo || '',
          credit: b.credit || 0,
          status: b.status || 'ACTIVE',
          paymentMethod: b.paymentMethod || null,
          paymentStatus: b.paymentStatus || null,
          totalAmountPaid: b.totalAmountPaid || 0,
          createdAt: b.createdAt,
          updatedAt: b.updatedAt
        }));
        totalOnboardedBanks = totalCount;
      }
    } catch (err) {
      // Fallback if DB query fails or is offline
    }

    return this.formatMemberResponse(member, {
      banks: onboardedBanks,
      totalCount: totalOnboardedBanks
    });
  }

  /**
   * Create a new Onboarding Team member
   */
  async createOnboardingTeam(payload, file = null, creatorId = null) {
    const fullName = (payload.fullName || '').trim();
    const email = (payload.email || '').trim().toLowerCase();
    const phone = (payload.phone || payload.phoneNumber || '').trim();

    if (!fullName) {
      throw ApiError.badRequest('Full Name is required.', ErrorCode.VALIDATION_ERROR);
    }

    const existingEmail = await OnboardingTeam.findOne({ email, isDeleted: { $ne: true } });
    if (existingEmail) {
      throw ApiError.conflict('An Onboarding Team member with this email address already exists.', ErrorCode.VALIDATION_ERROR);
    }

    const existingPhone = await OnboardingTeam.findOne({ phone, isDeleted: { $ne: true } });
    if (existingPhone) {
      throw ApiError.conflict('An Onboarding Team member with this phone number already exists.', ErrorCode.VALIDATION_ERROR);
    }

    let profileImage = null;
    let profileImageKey = null;
    if (file) {
      const upload = await storageManager.uploadFile(file, 'onboarding-team');
      profileImage = upload?.fileUrl || null;
      profileImageKey = upload?.key || null;
    }

    let teamUser = await User.findOne({ email, isDeleted: { $ne: true } });
    if (!teamUser) {
      const passwordHash = await bcrypt.hash(payload.password || 'Password@123', 10);
      teamUser = new User({
        email,
        phoneNumber: phone,
        passwordHash,
        role: UserRole.ONBOARDING_TEAM,
        userType: UserType.ONBOARDING_TEAM,
        status: 'ACTIVE',
        createdBy: creatorId
      });
      await teamUser.save();
    }

    const member = new OnboardingTeam({
      userId: teamUser._id,
      profileImage,
      profileImageKey,
      fullName,
      gender: payload.gender || 'Male',
      dob: payload.dob || payload.dateOfBirth ? new Date(payload.dob || payload.dateOfBirth) : null,
      phone,
      email,
      address: payload.address || '',
      onboardingTeamType: payload.onboardingTeamType || 'Regional OnboardingTeam',
      salary: payload.salary ? parseFloat(payload.salary) : 0,
      joiningDate: payload.joiningDate ? new Date(payload.joiningDate) : new Date(),
      status: payload.status ? payload.status.toUpperCase() : 'ACTIVE',
      createdBy: creatorId
    });

    await member.save();

    await member.populate([
      { path: 'createdBy', select: 'fullName name email phoneNumber role' }
    ]);

    return this.formatMemberResponse(member);
  }

  /**
   * Update existing Onboarding Team member
   */
  /**
   * Update existing Onboarding Team member
   */
  async updateOnboardingTeam(id, payload, file = null, updaterId = null) {
    const member = await OnboardingTeam.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!member) {
      throw ApiError.notFound('Onboarding Team Member not found for update.');
    }

    // Extract flat or section fields
    const personal = payload.personalDetails || {};
    const job = payload.jobDetails || {};
    const shiftWoff = payload.shiftAndWoff || {};
    const shift = shiftWoff.shift || {};
    const woff = shiftWoff.weeklyOff || {};
    const other = payload.otherDetails || {};
    const attendance = payload.attendance || {};
    const punch = attendance.punch || {};
    const lateCut = attendance.lateCut || {};
    const lunchEarly = payload.lunchAndEarlyGoing || {};
    const overtime = payload.overtime || {};
    const woffHoff = payload.woffAndHoff || {};

    const fullName = (payload.fullName || personal.fullName || '').trim();
    const email = (payload.email || personal.email || '').trim().toLowerCase();
    const phone = (payload.phone || payload.phoneNumber || personal.phone || personal.phoneNumber || '').trim();
    const password = (payload.password || personal.password || '').trim();

    // 1. Email Uniqueness Validation
    if (email && email !== member.email) {
      const existingEmail = await OnboardingTeam.findOne({
        _id: { $ne: id },
        email,
        isDeleted: { $ne: true }
      });
      if (existingEmail) {
        throw ApiError.conflict('An Onboarding Team member with this email address already exists.', ErrorCode.VALIDATION_ERROR);
      }
      member.email = email;
    }

    // 2. Phone Uniqueness Validation
    if (phone && phone !== member.phone) {
      const existingPhone = await OnboardingTeam.findOne({
        _id: { $ne: id },
        phone,
        isDeleted: { $ne: true }
      });
      if (existingPhone) {
        throw ApiError.conflict('An Onboarding Team member with this phone number already exists.', ErrorCode.VALIDATION_ERROR);
      }
      member.phone = phone;
    }

    if (fullName) member.fullName = fullName;

    const rawGender = payload.gender || personal.gender;
    if (rawGender) member.gender = rawGender;

    const rawDob = payload.dob || payload.dateOfBirth || personal.dob || personal.dateOfBirth;
    if (rawDob) member.dob = new Date(rawDob);

    const address = payload.address !== undefined ? payload.address : personal.address;
    if (address !== undefined) member.address = String(address).trim();

    const onboardingTeamType = payload.onboardingTeamType || job.onboardingTeamType;
    if (onboardingTeamType) member.onboardingTeamType = onboardingTeamType;

    const rawSalary = payload.salary !== undefined ? payload.salary : job.salary;
    if (rawSalary !== undefined) member.salary = parseFloat(rawSalary);

    const joiningDate = payload.joiningDate || job.joiningDate;
    if (joiningDate) member.joiningDate = new Date(joiningDate);

    const status = payload.status || personal.status;
    if (status) member.status = status.toUpperCase();

    // Shift & Woff
    if (payload.shiftInTime || shift.inTime) member.shiftInTime = payload.shiftInTime || shift.inTime;
    if (payload.shiftOutTime || shift.outTime) member.shiftOutTime = payload.shiftOutTime || shift.outTime;
    if (payload.weeklyOffDays || woff.weeklyOffDays) member.weeklyOffDays = payload.weeklyOffDays || woff.weeklyOffDays;
    if (payload.isWeeklyOffPayable !== undefined || woff.isWeeklyOffPayable !== undefined) {
      member.isWeeklyOffPayable = payload.isWeeklyOffPayable ?? woff.isWeeklyOffPayable;
    }
    if (payload.isVariableWeeklyOff !== undefined || woff.isVariableWeeklyOff !== undefined) {
      member.isVariableWeeklyOff = payload.isVariableWeeklyOff ?? woff.isVariableWeeklyOff;
    }
    if (payload.isSecondWeeklyOff !== undefined || woff.isSecondWeeklyOff !== undefined) {
      member.isSecondWeeklyOff = payload.isSecondWeeklyOff ?? woff.isSecondWeeklyOff;
    }

    // Other Details
    if (payload.lateAllowedMins !== undefined || other.lateAllowedMins !== undefined) {
      member.lateAllowedMins = payload.lateAllowedMins ?? other.lateAllowedMins;
    }
    if (payload.earlyAllowedMins !== undefined || other.earlyAllowedMins !== undefined) {
      member.earlyAllowedMins = payload.earlyAllowedMins ?? other.earlyAllowedMins;
    }
    if (payload.halfDayMins !== undefined || other.halfDayMins !== undefined) {
      member.halfDayMins = payload.halfDayMins ?? other.halfDayMins;
    }
    if (payload.fullDayMins !== undefined || other.fullDayMins !== undefined) {
      member.fullDayMins = payload.fullDayMins ?? other.fullDayMins;
    }

    // Attendance Rules
    if (payload.shiftType || punch.shiftType) member.shiftType = payload.shiftType || punch.shiftType;
    if (payload.noOutPunchAction || punch.noOutPunchAction) member.noOutPunchAction = payload.noOutPunchAction || punch.noOutPunchAction;
    if (payload.presentOnWoHolidayAction || punch.presentOnWoHolidayAction) {
      member.presentOnWoHolidayAction = payload.presentOnWoHolidayAction || punch.presentOnWoHolidayAction;
    }
    if (payload.lateCutAllowedDays !== undefined || lateCut.allowedDays !== undefined) {
      member.lateCutAllowedDays = payload.lateCutAllowedDays ?? lateCut.allowedDays;
    }
    if (payload.lateCutAction || lateCut.action) member.lateCutAction = payload.lateCutAction || lateCut.action;
    if (payload.isLateCutAllowed !== undefined || lateCut.isLateCutAllowed !== undefined) {
      member.isLateCutAllowed = payload.isLateCutAllowed ?? lateCut.isLateCutAllowed;
    }
    if (payload.isExtraLateCutDeduction !== undefined || lateCut.isExtraLateCutDeduction !== undefined) {
      member.isExtraLateCutDeduction = payload.isExtraLateCutDeduction ?? lateCut.isExtraLateCutDeduction;
    }
    if (payload.isAdditionalLateCutInLeaveBalance !== undefined || lateCut.isAdditionalLateCutInLeaveBalance !== undefined) {
      member.isAdditionalLateCutInLeaveBalance = payload.isAdditionalLateCutInLeaveBalance ?? lateCut.isAdditionalLateCutInLeaveBalance;
    }

    // Lunch & Early Going
    if (payload.lunchAllowedMins !== undefined || lunchEarly.lunchAllowedMins !== undefined) {
      member.lunchAllowedMins = payload.lunchAllowedMins ?? lunchEarly.lunchAllowedMins;
    }
    if (payload.isLunchAllowed !== undefined || lunchEarly.isLunchAllowed !== undefined) {
      member.isLunchAllowed = payload.isLunchAllowed ?? lunchEarly.isLunchAllowed;
    }
    if (payload.isEarlyGoingAllowed !== undefined || lunchEarly.isEarlyGoingAllowed !== undefined) {
      member.isEarlyGoingAllowed = payload.isEarlyGoingAllowed ?? lunchEarly.isEarlyGoingAllowed;
    }

    // Overtime Rules
    if (payload.isOvertimeAllowed !== undefined || overtime.isOvertimeAllowed !== undefined) {
      member.isOvertimeAllowed = payload.isOvertimeAllowed ?? overtime.isOvertimeAllowed;
    }
    if (payload.isCustomOT !== undefined || overtime.isCustomOT !== undefined) {
      member.isCustomOT = payload.isCustomOT ?? overtime.isCustomOT;
    }
    if (payload.isBeforeOT !== undefined || overtime.isBeforeOT !== undefined) {
      member.isBeforeOT = payload.isBeforeOT ?? overtime.isBeforeOT;
    }
    if (payload.otGracePeriodMins !== undefined || overtime.otGracePeriodMins !== undefined) {
      member.otGracePeriodMins = payload.otGracePeriodMins ?? overtime.otGracePeriodMins;
    }
    if (payload.ot1DayHrs !== undefined || overtime.ot1DayHrs !== undefined) {
      member.ot1DayHrs = payload.ot1DayHrs ?? overtime.ot1DayHrs;
    }
    if (payload.isOTAsPerShift !== undefined || overtime.isOTAsPerShift !== undefined) {
      member.isOTAsPerShift = payload.isOTAsPerShift ?? overtime.isOTAsPerShift;
    }
    if (payload.isConsiderOTAsCOFF !== undefined || overtime.isConsiderOTAsCOFF !== undefined) {
      member.isConsiderOTAsCOFF = payload.isConsiderOTAsCOFF ?? overtime.isConsiderOTAsCOFF;
    }

    // Sandwich Rules
    if (payload.sandwichWeeklyOff || woffHoff.sandwichWeeklyOff) {
      member.sandwichWeeklyOff = { ...(member.sandwichWeeklyOff || {}), ...(payload.sandwichWeeklyOff || woffHoff.sandwichWeeklyOff) };
    }
    if (payload.sandwichHolidays || woffHoff.sandwichHolidays) {
      member.sandwichHolidays = { ...(member.sandwichHolidays || {}), ...(payload.sandwichHolidays || woffHoff.sandwichHolidays) };
    }
    if (payload.leaveBetweenHolidayOrWO || woffHoff.leaveBetweenHolidayOrWO) {
      member.leaveBetweenHolidayOrWO = { ...(member.leaveBetweenHolidayOrWO || {}), ...(payload.leaveBetweenHolidayOrWO || woffHoff.leaveBetweenHolidayOrWO) };
    }

    if (file) {
      const upload = await storageManager.uploadFile(file, 'onboarding-team');
      if (upload?.fileUrl) {
        member.profileImage = upload.fileUrl;
        member.profileImageKey = upload.key;
      }
    }

    member.updatedBy = updaterId;
    await member.save();

    // 3. Sync Linked User Document (fullName, email, phone, password, status)
    if (member.userId) {
      const userDoc = await User.findById(member.userId);
      if (userDoc) {
        if (member.fullName) userDoc.fullName = member.fullName;
        if (member.email) userDoc.email = member.email;
        if (member.phone) userDoc.phoneNumber = member.phone;
        if (member.status) userDoc.status = member.status === 'BLOCKED' ? 'INACTIVE' : member.status;
        if (password) {
          userDoc.passwordHash = await bcrypt.hash(password, 10);
        }
        userDoc.updatedBy = updaterId;
        await userDoc.save();
      }
    }

    await member.populate([
      { path: 'createdBy', select: 'fullName name email phoneNumber role' }
    ]);

    return this.formatMemberResponse(member);
  }

  /**
   * Soft delete Onboarding Team member
   */
  async deleteOnboardingTeam(id, deleterId = null) {
    const member = await OnboardingTeam.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!member) {
      throw ApiError.notFound('Onboarding Team Member not found for deletion.');
    }

    member.isDeleted = true;
    member.deletedAt = new Date();
    member.deletedBy = deleterId;
    await member.save();

    if (member.userId) {
      await User.updateOne(
        { _id: member.userId },
        { isDeleted: true, deletedAt: new Date(), deletedBy: deleterId }
      );
    }

    return { id: member._id, message: 'Onboarding Team Member deleted successfully.' };
  }
}

export const onboardingTeamService = new OnboardingTeamService();
