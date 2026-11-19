import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { SocietyEmployee } from '../../../../models/society-employee.model.js';
import { SocietyRole } from '../../../../models/society-role.model.js';
import { Branch } from '../../../../models/branch.model.js';
import { BranchManager } from '../../../../models/branch-manager.model.js';
import { User } from '../../../../models/user.model.js';
import { EmployeeProfile } from '../../../../models/employee-profile.model.js';
import { ApiError } from '../../../../common/api.error.js';
import { PREDEFINED_ROLE_CODES, normalizeRoleCode, isBranchManagerRole } from '../../../../constants/society-role.constant.js';
import { getDefaultKraTargetsForRole } from '../../../../constants/kpa-matrix.constant.js';
import { UserRole, UserType } from '../../../../constants/user-role.constant.js';

export class SocietyEmployeeService {
  /**
   * Helper to format full SocietyEmployee object including HR sections
   */
  formatEmployeeResponse(employee, roleDoc = null, branchDoc = null) {
    if (!employee) return null;

    const personal = employee.personalDetails || {};
    const job = employee.jobDetails || {};
    const shift = employee.shiftSettings || {};
    const attendance = employee.attendanceSettings || {};
    const woffHoff = employee.woffHoffSettings || {};
    const kra = employee.kraSettings || {};

    const roleObj = roleDoc || (employee.roleId && typeof employee.roleId === 'object' ? employee.roleId : null);
    const branchObj = branchDoc || (employee.branchId && typeof employee.branchId === 'object' ? employee.branchId : null);

    const fullName = employee.fullName || personal.fullName || '';
    const nameParts = fullName.trim().split(' ');
    const firstName = personal.firstName || (nameParts[0] || '');
    const lastName = personal.lastName || (nameParts.slice(1).join(' ') || '');

    const dutyHours = employee.dutyHours || personal.dutyHours || (shift.punchInTime && shift.punchOutTime ? `${shift.punchInTime} to ${shift.punchOutTime}` : '10:00 to 19:00');
    const weeklyOff = employee.weeklyOff || personal.weeklyOff || (shift.weeklyOff?.day || 'Saturday & Sunday');
    const bloodGroup = employee.bloodGroup || personal.bloodGroup || '';
    const validity = employee.validity || personal.validity || null;
    const officeAddress = employee.officeAddress || personal.officeAddress || personal.address || branchObj?.address?.addressLine1 || '';
    const department = employee.department || job.department || personal.department || 'Loans & Disbursals';

    return {
      id: employee._id,
      employeeId: employee.employeeCode || employee._id,
      userId: employee.userId,
      bankId: employee.bankId,
      branchId: branchObj?._id || employee.branchId,
      branch: branchObj
        ? {
            id: branchObj._id,
            name: branchObj.name,
            code: branchObj.code,
            state: branchObj.state || branchObj.address?.state || ''
          }
        : null,
      roleId: roleObj?._id || employee.roleId,
      role: roleObj
        ? {
            id: roleObj._id,
            name: roleObj.name,
            code: roleObj.code,
            permissions: roleObj.permissions || []
          }
        : null,
      designation: roleObj?.name || employee.designation || job.designation || 'EMPLOYEE',
      department,
      employeeCode: employee.employeeCode || '',
      fullName,
      firstName,
      lastName,
      email: employee.email || personal.email || '',
      phoneNumber: employee.phoneNumber || personal.phoneNumber || '',
      dutyHours,
      weeklyOff,
      bloodGroup,
      validity,
      officeAddress,
      state: job.state || branchObj?.state || '',
      personalDetails: {
        profileImage: personal.profileImage || null,
        profileImageKey: personal.profileImageKey || null,
        fullName: fullName || employee.fullName || '',
        firstName,
        lastName,
        gender: personal.gender || 'MALE',
        dateOfBirth: personal.dateOfBirth || personal.dob || null,
        dob: personal.dateOfBirth || personal.dob || null,
        phoneNumber: personal.phoneNumber || employee.phoneNumber || '',
        email: personal.email || employee.email || '',
        address: personal.address || officeAddress,
        dutyHours,
        weeklyOff,
        bloodGroup,
        validity,
        officeAddress,
        department
      },
      jobDetails: {
        roleId: roleObj?._id || employee.roleId,
        branchId: branchObj?._id || employee.branchId,
        designation: roleObj?.name || job.designation || employee.designation || 'EMPLOYEE',
        department,
        state: job.state || '',
        salary: job.salary !== undefined ? job.salary : 0,
        joiningDate: job.joiningDate || employee.createdAt || null,
        probationPeriodMonths: job.probationPeriodMonths !== undefined ? job.probationPeriodMonths : 0
      },
      shiftSettings: {
        punchInTime: shift.punchInTime || '09:30',
        punchOutTime: shift.punchOutTime || '18:30',
        weeklyOff: {
          day: shift.weeklyOff?.day || 'SUNDAY',
          payable: shift.weeklyOff?.payable !== undefined ? shift.weeklyOff.payable : true,
          variable: shift.weeklyOff?.variable !== undefined ? shift.weeklyOff.variable : false,
          secondWeeklyOff: shift.weeklyOff?.secondWeeklyOff !== undefined ? shift.weeklyOff.secondWeeklyOff : false,
          secondWeeklyOffDay: shift.weeklyOff?.secondWeeklyOffDay || 'SATURDAY'
        },
        lateAllowedMinutes: shift.lateAllowedMinutes !== undefined ? shift.lateAllowedMinutes : 15,
        lateAllowedAsPerShift: shift.lateAllowedAsPerShift !== undefined ? shift.lateAllowedAsPerShift : true,
        earlyAllowedMinutes: shift.earlyAllowedMinutes !== undefined ? shift.earlyAllowedMinutes : 15,
        earlyAllowedAsPerShift: shift.earlyAllowedAsPerShift !== undefined ? shift.earlyAllowedAsPerShift : false,
        halfDayMinutes: shift.halfDayMinutes !== undefined ? shift.halfDayMinutes : 240,
        halfDayAsPerShift: shift.halfDayAsPerShift !== undefined ? shift.halfDayAsPerShift : false,
        fullDayMinutes: shift.fullDayMinutes !== undefined ? shift.fullDayMinutes : 480,
        fullDayAsPerShift: shift.fullDayAsPerShift !== undefined ? shift.fullDayAsPerShift : false
      },
      attendanceSettings: {
        punchType: attendance.punchType || 'DOUBLE',
        noOutPunchAction: attendance.noOutPunchAction || 'MARK_ABSENT',
        presentOnWeeklyOffHolidayAction: attendance.presentOnWeeklyOffHolidayAction || 'COMP_OFF',
        lateCut: {
          allowedDays: attendance.lateCut?.allowedDays !== undefined ? attendance.lateCut.allowedDays : 3,
          action: attendance.lateCut?.action || 'DEDUCT_LEAVE',
          enabled: attendance.lateCut?.enabled !== undefined ? attendance.lateCut.enabled : false,
          extraLateCutDeduction: attendance.lateCut?.extraLateCutDeduction !== undefined ? attendance.lateCut.extraLateCutDeduction : false,
          additionalLateCutInLeaveBalance: attendance.lateCut?.additionalLateCutInLeaveBalance !== undefined ? attendance.lateCut.additionalLateCutInLeaveBalance : false
        },
        lunchAndEarlyGoing: {
          lunchAllowedMinutes: attendance.lunchAndEarlyGoing?.lunchAllowedMinutes !== undefined ? attendance.lunchAndEarlyGoing.lunchAllowedMinutes : 0,
          lunchAsPerShift: attendance.lunchAndEarlyGoing?.lunchAsPerShift !== undefined ? attendance.lunchAndEarlyGoing.lunchAsPerShift : true,
          lunchAllowed: attendance.lunchAndEarlyGoing?.lunchAllowed !== undefined ? attendance.lunchAndEarlyGoing.lunchAllowed : false,
          earlyGoingAllowed: attendance.lunchAndEarlyGoing?.earlyGoingAllowed !== undefined ? attendance.lunchAndEarlyGoing.earlyGoingAllowed : false
        },
        overtime: {
          allowed: attendance.overtime?.allowed !== undefined ? attendance.overtime.allowed : false,
          customOT: attendance.overtime?.customOT !== undefined ? attendance.overtime.customOT : false,
          beforeOT: attendance.overtime?.beforeOT !== undefined ? attendance.overtime.beforeOT : false,
          gracePeriodMinutes: attendance.overtime?.gracePeriodMinutes !== undefined ? attendance.overtime.gracePeriodMinutes : 5,
          oneDayOTHrs: attendance.overtime?.oneDayOTHrs !== undefined ? attendance.overtime.oneDayOTHrs : 4,
          asPerShift: attendance.overtime?.asPerShift !== undefined ? attendance.overtime.asPerShift : false,
          considerAsCompOff: attendance.overtime?.considerAsCompOff !== undefined ? attendance.overtime.considerAsCompOff : false
        }
      },
      woffHoffSettings: {
        weeklyOffRules: {
          absentBefore: woffHoff.weeklyOffRules?.absentBefore !== undefined ? woffHoff.weeklyOffRules.absentBefore : true,
          absentAfter: woffHoff.weeklyOffRules?.absentAfter !== undefined ? woffHoff.weeklyOffRules.absentAfter : true,
          absentBeforeOrAfter: woffHoff.weeklyOffRules?.absentBeforeOrAfter !== undefined ? woffHoff.weeklyOffRules.absentBeforeOrAfter : false,
          addWorkingHours: woffHoff.weeklyOffRules?.addWorkingHours !== undefined ? woffHoff.weeklyOffRules.addWorkingHours : false,
          ignoreLateDeductionIfPresent: woffHoff.weeklyOffRules?.ignoreLateDeductionIfPresent !== undefined ? woffHoff.weeklyOffRules.ignoreLateDeductionIfPresent : false,
          lwp: woffHoff.weeklyOffRules?.lwp !== undefined ? woffHoff.weeklyOffRules.lwp : false
        },
        holidayRules: {
          absentBefore: woffHoff.holidayRules?.absentBefore !== undefined ? woffHoff.holidayRules.absentBefore : false,
          absentAfter: woffHoff.holidayRules?.absentAfter !== undefined ? woffHoff.holidayRules.absentAfter : false,
          absentBeforeAndAfter: woffHoff.holidayRules?.absentBeforeAndAfter !== undefined ? woffHoff.holidayRules.absentBeforeAndAfter : false,
          addWorkingHours: woffHoff.holidayRules?.addWorkingHours !== undefined ? woffHoff.holidayRules.addWorkingHours : false,
          ignoreLateDeductionIfPresent: woffHoff.holidayRules?.ignoreLateDeductionIfPresent !== undefined ? woffHoff.holidayRules.ignoreLateDeductionIfPresent : false,
          lwp: woffHoff.holidayRules?.lwp !== undefined ? woffHoff.holidayRules.lwp : false
        },
        leaveBridgeRules: {
          considerWeeklyOffInLeave: woffHoff.leaveBridgeRules?.considerWeeklyOffInLeave !== undefined ? woffHoff.leaveBridgeRules.considerWeeklyOffInLeave : true,
          considerHolidayInLeave: woffHoff.leaveBridgeRules?.considerHolidayInLeave !== undefined ? woffHoff.leaveBridgeRules.considerHolidayInLeave : true,
          absentWeeklyOffLeaveMarksWeeklyOffAbsent: woffHoff.leaveBridgeRules?.absentWeeklyOffLeaveMarksWeeklyOffAbsent !== undefined ? woffHoff.leaveBridgeRules.absentWeeklyOffLeaveMarksWeeklyOffAbsent : true,
          leaveWeeklyOffAbsentMarksWeeklyOffAbsent: woffHoff.leaveBridgeRules?.leaveWeeklyOffAbsentMarksWeeklyOffAbsent !== undefined ? woffHoff.leaveBridgeRules.leaveWeeklyOffAbsentMarksWeeklyOffAbsent : false,
          absentHolidayLeaveMarksHolidayAbsent: woffHoff.leaveBridgeRules?.absentHolidayLeaveMarksHolidayAbsent !== undefined ? woffHoff.leaveBridgeRules.absentHolidayLeaveMarksHolidayAbsent : false,
          leaveHolidayAbsentMarksHolidayAbsent: woffHoff.leaveBridgeRules?.leaveHolidayAbsentMarksHolidayAbsent !== undefined ? woffHoff.leaveBridgeRules.leaveHolidayAbsentMarksHolidayAbsent : false
        },
        leaveSettings: {
          leaveEncashmentAllowed: woffHoff.leaveSettings?.leaveEncashmentAllowed !== undefined ? woffHoff.leaveSettings.leaveEncashmentAllowed : false,
          carryForwardAllowed: woffHoff.leaveSettings?.carryForwardAllowed !== undefined ? woffHoff.leaveSettings.carryForwardAllowed : true
        }
      },
      kraSettings: {
        year: kra.year || new Date().getFullYear(),
        targets: Array.isArray(kra.targets)
          ? kra.targets.map((t) => ({
              product: t.product || '',
              productId: t.productId || null,
              targetType: t.targetType || 'AMOUNT',
              targetValue: t.targetValue !== undefined ? t.targetValue : 0
            }))
          : []
      },
      status: employee.status || 'ACTIVE',
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt
    };
  }

  /**
   * Create Employee Atomically inside Mongoose Transaction
   */
  async createEmployee(bankId, payload, creatorId) {
    if (!bankId) {
      throw ApiError.badRequest('Bank context is required for employee creation.');
    }

    const personal = payload.personalDetails || {};
    const job = payload.jobDetails || {};

    const fullName = (personal.fullName || payload.fullName || (payload.firstName ? `${payload.firstName} ${payload.lastName || ''}`.trim() : '') || '').trim();
    const email = (personal.email || payload.email || '').trim().toLowerCase();
    const phoneNumber = (personal.phoneNumber || payload.phoneNumber || '').trim();
    const password = (personal.password || payload.password || '').trim();
    const roleId = job.roleId || payload.roleId;
    const branchId = job.branchId || payload.branchId;

    if (!fullName || !email || !phoneNumber || !password) {
      throw ApiError.badRequest('Employee full name, email, phone number, and password are required.');
    }

    if (!roleId || !branchId) {
      throw ApiError.badRequest('Employee role and assigned branch are required.');
    }

    // 1. Validate Role belongs to authenticated Bank
    const role = await SocietyRole.findOne({
      _id: roleId,
      bankId,
      isDeleted: { $ne: true }
    });
    if (!role) {
      throw ApiError.notFound('Target role not found or does not belong to your bank.');
    }
    if (role.status !== 'ACTIVE') {
      throw ApiError.badRequest(`Role [${role.name}] is currently inactive.`);
    }

    // 2. Validate Branch belongs to authenticated Bank
    const branch = await Branch.findOne({
      _id: branchId,
      bankId,
      isDeleted: { $ne: true }
    });
    if (!branch) {
      throw ApiError.notFound('Target branch not found or does not belong to your bank.');
    }
    if (branch.status !== 'ACTIVE') {
      throw ApiError.badRequest(`Branch [${branch.name}] is currently inactive.`);
    }

    // 2b. Validate Single Branch Manager per branch limit
    await this.validateSingleBranchManager(bankId, branch._id, role._id);

    // 3. Check duplicate email / phone in User identity collection
    const existingEmail = await User.findOne({ email, isDeleted: { $ne: true } });
    if (existingEmail) {
      throw ApiError.conflict(`User identity with email [${email}] already exists.`);
    }

    const existingPhone = await User.findOne({ phoneNumber, isDeleted: { $ne: true } });
    if (existingPhone) {
      throw ApiError.conflict(`User identity with phone number [${phoneNumber}] already exists.`);
    }

    // Generate Employee Code
    const employeeCode =
      payload.employeeCode ||
      payload.employeeId ||
      `EMP-${branch.code || 'SOC'}-${Math.floor(10000 + Math.random() * 90000)}`;

    let session = null;
    let sessionOpts = {};
    let transactionCommitted = false;

    try {
      const topoType = mongoose.connection.client?.topology?.description?.type;
      const supportsTransactions = topoType && topoType !== 'Single' && topoType !== 'Unknown';

      if (supportsTransactions) {
        session = await mongoose.startSession().catch(() => null);
        if (session) {
          session.startTransaction();
          sessionOpts = { session };
        }
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create User Identity
      const [user] = await User.create(
        [
          {
            email,
            phoneNumber,
            passwordHash,
            fullName,
            role: role.code || role.name || UserRole.EMPLOYEE,
            userType: UserType.EMPLOYEE,
            status: 'ACTIVE',
            createdBy: creatorId
          }
        ],
        sessionOpts
      );

      // Extract extended profile fields
      const rawDob = personal.dateOfBirth || payload.dateOfBirth || personal.dob || payload.dob;
      const parsedDob = rawDob ? new Date(rawDob) : null;

      const rawValidity = personal.validity || payload.validity;
      const parsedValidity = rawValidity ? new Date(rawValidity) : null;

      const nameParts = fullName.split(' ');
      const firstName = personal.firstName || payload.firstName || nameParts[0] || '';
      const lastName = personal.lastName || payload.lastName || nameParts.slice(1).join(' ') || '';

      const officeAddress = (personal.officeAddress || payload.officeAddress || personal.address || payload.address || '').trim();
      const dutyHours = (personal.dutyHours || payload.dutyHours || (payload.shiftSettings?.punchInTime ? `${payload.shiftSettings.punchInTime} to ${payload.shiftSettings.punchOutTime}` : '') || '').trim();
      const weeklyOff = (personal.weeklyOff || payload.weeklyOff || (payload.shiftSettings?.weeklyOff?.day || '') || '').trim();
      const bloodGroup = (personal.bloodGroup || payload.bloodGroup || '').trim();
      const department = (personal.department || payload.department || job.department || 'Loans & Disbursals').trim();
      const designation = (payload.designation || job.designation || role.name || '').trim();

      // Build SocietyEmployee Profile
      const finalPersonalDetails = {
        fullName,
        firstName,
        lastName,
        email,
        phoneNumber,
        gender: personal.gender || payload.gender || 'MALE',
        dateOfBirth: parsedDob,
        dob: parsedDob,
        address: officeAddress,
        officeAddress,
        profileImage: personal.profileImage || payload.profileImage || null,
        profileImageKey: personal.profileImageKey || payload.profileImageKey || null,
        dutyHours,
        weeklyOff,
        bloodGroup,
        validity: parsedValidity,
        department
      };

      const finalJobDetails = {
        roleId: role._id,
        branchId: branch._id,
        designation,
        department,
        state: job.state || payload.state || branch.state || '',
        salary: job.salary || payload.salary || 0,
        joiningDate: job.joiningDate || payload.joiningDate ? new Date(job.joiningDate || payload.joiningDate) : new Date(),
        probationPeriodMonths: job.probationPeriodMonths || payload.probationPeriodMonths || 0
      };

      const rawShift = payload.shiftSettings || {};
      const rawWeeklyOff = rawShift.weeklyOff || {};
      const finalShiftSettings = {
        punchInTime: (rawShift.punchInTime || '09:30').trim(),
        punchOutTime: (rawShift.punchOutTime || '18:30').trim(),
        weeklyOff: {
          day: (rawWeeklyOff.day || rawShift.weeklyOffDay || 'SUNDAY').toUpperCase().trim(),
          payable: rawWeeklyOff.payable !== undefined ? Boolean(rawWeeklyOff.payable) : (rawShift.weeklyOffPayable !== undefined ? Boolean(rawShift.weeklyOffPayable) : true),
          variable: rawWeeklyOff.variable !== undefined ? Boolean(rawWeeklyOff.variable) : (rawShift.variableWeeklyOff !== undefined ? Boolean(rawShift.variableWeeklyOff) : false),
          secondWeeklyOff: rawWeeklyOff.secondWeeklyOff !== undefined ? Boolean(rawWeeklyOff.secondWeeklyOff) : (rawShift.secondWeeklyOff !== undefined ? Boolean(rawShift.secondWeeklyOff) : false),
          secondWeeklyOffDay: (rawWeeklyOff.secondWeeklyOffDay || rawShift.secondWeeklyOffDay || 'SATURDAY').toUpperCase().trim()
        },
        lateAllowedMinutes: rawShift.lateAllowedMinutes !== undefined ? Number(rawShift.lateAllowedMinutes) : (rawShift.lateAllowed !== undefined ? Number(rawShift.lateAllowed) : 15),
        lateAllowedAsPerShift: rawShift.lateAllowedAsPerShift !== undefined ? Boolean(rawShift.lateAllowedAsPerShift) : (rawShift.lateAsPerShift !== undefined ? Boolean(rawShift.lateAsPerShift) : true),
        earlyAllowedMinutes: rawShift.earlyAllowedMinutes !== undefined ? Number(rawShift.earlyAllowedMinutes) : (rawShift.earlyAllowed !== undefined ? Number(rawShift.earlyAllowed) : 15),
        earlyAllowedAsPerShift: rawShift.earlyAllowedAsPerShift !== undefined ? Boolean(rawShift.earlyAllowedAsPerShift) : (rawShift.earlyAsPerShift !== undefined ? Boolean(rawShift.earlyAsPerShift) : false),
        halfDayMinutes: rawShift.halfDayMinutes !== undefined ? Number(rawShift.halfDayMinutes) : (rawShift.halfDay !== undefined ? Number(rawShift.halfDay) : 240),
        halfDayAsPerShift: rawShift.halfDayAsPerShift !== undefined ? Boolean(rawShift.halfDayAsPerShift) : false,
        fullDayMinutes: rawShift.fullDayMinutes !== undefined ? Number(rawShift.fullDayMinutes) : (rawShift.fullDay !== undefined ? Number(rawShift.fullDay) : 480),
        fullDayAsPerShift: rawShift.fullDayAsPerShift !== undefined ? Boolean(rawShift.fullDayAsPerShift) : false
      };

      const rawAttendance = payload.attendanceSettings || {};
      const finalAttendanceSettings = {
        punchType: rawAttendance.punchType || 'DOUBLE',
        noOutPunchAction: rawAttendance.noOutPunchAction || 'MARK_ABSENT',
        presentOnWeeklyOffHolidayAction: rawAttendance.presentOnWeeklyOffHolidayAction || 'COMP_OFF',
        lateCut: {
          allowedDays: rawAttendance.lateCut?.allowedDays !== undefined ? Number(rawAttendance.lateCut.allowedDays) : 3,
          action: rawAttendance.lateCut?.action || 'DEDUCT_LEAVE',
          enabled: rawAttendance.lateCut?.enabled !== undefined ? Boolean(rawAttendance.lateCut.enabled) : (rawAttendance.lateCut?.lateCutAllowed !== undefined ? Boolean(rawAttendance.lateCut.lateCutAllowed) : false),
          extraLateCutDeduction: rawAttendance.lateCut?.extraLateCutDeduction !== undefined ? Boolean(rawAttendance.lateCut.extraLateCutDeduction) : false,
          additionalLateCutInLeaveBalance: rawAttendance.lateCut?.additionalLateCutInLeaveBalance !== undefined ? Boolean(rawAttendance.lateCut.additionalLateCutInLeaveBalance) : false
        },
        lunchAndEarlyGoing: {
          lunchAllowedMinutes: rawAttendance.lunchAndEarlyGoing?.lunchAllowedMinutes !== undefined ? Number(rawAttendance.lunchAndEarlyGoing.lunchAllowedMinutes) : 0,
          lunchAsPerShift: rawAttendance.lunchAndEarlyGoing?.lunchAsPerShift !== undefined ? Boolean(rawAttendance.lunchAndEarlyGoing.lunchAsPerShift) : true,
          lunchAllowed: rawAttendance.lunchAndEarlyGoing?.lunchAllowed !== undefined ? Boolean(rawAttendance.lunchAndEarlyGoing.lunchAllowed) : false,
          earlyGoingAllowed: rawAttendance.lunchAndEarlyGoing?.earlyGoingAllowed !== undefined ? Boolean(rawAttendance.lunchAndEarlyGoing.earlyGoingAllowed) : false
        },
        overtime: {
          allowed: rawAttendance.overtime?.allowed !== undefined ? Boolean(rawAttendance.overtime.allowed) : (rawAttendance.overtime?.overtimeAllowed !== undefined ? Boolean(rawAttendance.overtime.overtimeAllowed) : false),
          customOT: rawAttendance.overtime?.customOT !== undefined ? Boolean(rawAttendance.overtime.customOT) : false,
          beforeOT: rawAttendance.overtime?.beforeOT !== undefined ? Boolean(rawAttendance.overtime.beforeOT) : false,
          gracePeriodMinutes: rawAttendance.overtime?.gracePeriodMinutes !== undefined ? Number(rawAttendance.overtime.gracePeriodMinutes) : 5,
          oneDayOTHrs: rawAttendance.overtime?.oneDayOTHrs !== undefined ? Number(rawAttendance.overtime.oneDayOTHrs) : 4,
          asPerShift: rawAttendance.overtime?.asPerShift !== undefined ? Boolean(rawAttendance.overtime.asPerShift) : (rawAttendance.overtime?.otAsPerShift !== undefined ? Boolean(rawAttendance.overtime.otAsPerShift) : false),
          considerAsCompOff: rawAttendance.overtime?.considerAsCompOff !== undefined ? Boolean(rawAttendance.overtime.considerAsCompOff) : (rawAttendance.overtime?.considerOTAsCOFF !== undefined ? Boolean(rawAttendance.overtime.considerOTAsCOFF) : false)
        }
      };

      const rawWoffHoff = payload.woffHoffSettings || {};
      const finalWoffHoffSettings = {
        weeklyOffRules: {
          absentBefore: rawWoffHoff.weeklyOffRules?.absentBefore !== undefined ? Boolean(rawWoffHoff.weeklyOffRules.absentBefore) : true,
          absentAfter: rawWoffHoff.weeklyOffRules?.absentAfter !== undefined ? Boolean(rawWoffHoff.weeklyOffRules.absentAfter) : true,
          absentBeforeOrAfter: rawWoffHoff.weeklyOffRules?.absentBeforeOrAfter !== undefined ? Boolean(rawWoffHoff.weeklyOffRules.absentBeforeOrAfter) : false,
          addWorkingHours: rawWoffHoff.weeklyOffRules?.addWorkingHours !== undefined ? Boolean(rawWoffHoff.weeklyOffRules.addWorkingHours) : false,
          ignoreLateDeductionIfPresent: rawWoffHoff.weeklyOffRules?.ignoreLateDeductionIfPresent !== undefined ? Boolean(rawWoffHoff.weeklyOffRules.ignoreLateDeductionIfPresent) : false,
          lwp: rawWoffHoff.weeklyOffRules?.lwp !== undefined ? Boolean(rawWoffHoff.weeklyOffRules.lwp) : false
        },
        holidayRules: {
          absentBefore: rawWoffHoff.holidayRules?.absentBefore !== undefined ? Boolean(rawWoffHoff.holidayRules.absentBefore) : false,
          absentAfter: rawWoffHoff.holidayRules?.absentAfter !== undefined ? Boolean(rawWoffHoff.holidayRules.absentAfter) : false,
          absentBeforeAndAfter: rawWoffHoff.holidayRules?.absentBeforeAndAfter !== undefined ? Boolean(rawWoffHoff.holidayRules.absentBeforeAndAfter) : false,
          addWorkingHours: rawWoffHoff.holidayRules?.addWorkingHours !== undefined ? Boolean(rawWoffHoff.holidayRules.addWorkingHours) : false,
          ignoreLateDeductionIfPresent: rawWoffHoff.holidayRules?.ignoreLateDeductionIfPresent !== undefined ? Boolean(rawWoffHoff.holidayRules.ignoreLateDeductionIfPresent) : false,
          lwp: rawWoffHoff.holidayRules?.lwp !== undefined ? Boolean(rawWoffHoff.holidayRules.lwp) : false
        },
        leaveBridgeRules: {
          considerWeeklyOffInLeave: rawWoffHoff.leaveBridgeRules?.considerWeeklyOffInLeave !== undefined ? Boolean(rawWoffHoff.leaveBridgeRules.considerWeeklyOffInLeave) : true,
          considerHolidayInLeave: rawWoffHoff.leaveBridgeRules?.considerHolidayInLeave !== undefined ? Boolean(rawWoffHoff.leaveBridgeRules.considerHolidayInLeave) : true,
          absentWeeklyOffLeaveMarksWeeklyOffAbsent: rawWoffHoff.leaveBridgeRules?.absentWeeklyOffLeaveMarksWeeklyOffAbsent !== undefined ? Boolean(rawWoffHoff.leaveBridgeRules.absentWeeklyOffLeaveMarksWeeklyOffAbsent) : true,
          leaveWeeklyOffAbsentMarksWeeklyOffAbsent: rawWoffHoff.leaveBridgeRules?.leaveWeeklyOffAbsentMarksWeeklyOffAbsent !== undefined ? Boolean(rawWoffHoff.leaveBridgeRules.leaveWeeklyOffAbsentMarksWeeklyOffAbsent) : false,
          absentHolidayLeaveMarksHolidayAbsent: rawWoffHoff.leaveBridgeRules?.absentHolidayLeaveMarksHolidayAbsent !== undefined ? Boolean(rawWoffHoff.leaveBridgeRules.absentHolidayLeaveMarksHolidayAbsent) : false,
          leaveHolidayAbsentMarksHolidayAbsent: rawWoffHoff.leaveBridgeRules?.leaveHolidayAbsentMarksHolidayAbsent !== undefined ? Boolean(rawWoffHoff.leaveBridgeRules.leaveHolidayAbsentMarksHolidayAbsent) : false
        },
        leaveSettings: {
          leaveEncashmentAllowed: rawWoffHoff.leaveSettings?.leaveEncashmentAllowed !== undefined ? Boolean(rawWoffHoff.leaveSettings.leaveEncashmentAllowed) : (rawWoffHoff.leaveSettings?.leaveInCash !== undefined ? Boolean(rawWoffHoff.leaveSettings.leaveInCash) : false),
          carryForwardAllowed: rawWoffHoff.leaveSettings?.carryForwardAllowed !== undefined ? Boolean(rawWoffHoff.leaveSettings.carryForwardAllowed) : (rawWoffHoff.leaveSettings?.leaveCarryForward !== undefined ? Boolean(rawWoffHoff.leaveSettings.leaveCarryForward) : true)
        }
      };

      const rawKra = payload.kraSettings || {};
      const rawTargets = Array.isArray(rawKra.targets) ? rawKra.targets : (Array.isArray(payload.kraTargets) ? payload.kraTargets : []);
      let finalTargets = rawTargets.map((t) => ({
        product: (t.product || t.productName || '').trim(),
        productId: t.productId || null,
        targetType: (t.targetType || 'AMOUNT').toUpperCase().trim(),
        targetValue: t.targetValue !== undefined ? Number(t.targetValue) : (t.target !== undefined ? Number(t.target) : 0)
      })).filter((t) => t.product);

      if (finalTargets.length === 0) {
        finalTargets = getDefaultKraTargetsForRole(role.code || role.name || designation);
      }

      const finalKraSettings = {
        year: rawKra.year ? Number(rawKra.year) : new Date().getFullYear(),
        targets: finalTargets
      };

      const [employee] = await SocietyEmployee.create(
        [
          {
            userId: user._id,
            bankId,
            branchId: branch._id,
            roleId: role._id,
            employeeCode,
            fullName,
            email,
            phoneNumber,
            designation,
            department,
            dutyHours,
            weeklyOff,
            bloodGroup,
            validity: parsedValidity,
            officeAddress,
            personalDetails: finalPersonalDetails,
            jobDetails: finalJobDetails,
            shiftSettings: finalShiftSettings,
            attendanceSettings: finalAttendanceSettings,
            woffHoffSettings: finalWoffHoffSettings,
            kraSettings: finalKraSettings,
            status: 'ACTIVE',
            createdBy: creatorId
          }
        ],
        sessionOpts
      );

      // Check if role is Branch Manager / Manager role
      const isManagerRole = isBranchManagerRole(role);

      if (isManagerRole) {
        let bmDoc = await BranchManager.findOne({ userId: user._id, includeDeleted: true }).session(session || null);
        if (bmDoc) {
          bmDoc.bankId = bankId;
          bmDoc.branchId = branch._id;
          bmDoc.roleId = role._id;
          bmDoc.employeeCode = employeeCode;
          bmDoc.fullName = fullName;
          bmDoc.email = email;
          bmDoc.phoneNumber = phoneNumber;
          bmDoc.designation = designation;
          bmDoc.personalDetails = finalPersonalDetails;
          bmDoc.jobDetails = finalJobDetails;
          bmDoc.shiftSettings = finalShiftSettings;
          bmDoc.attendanceSettings = finalAttendanceSettings;
          bmDoc.woffHoffSettings = finalWoffHoffSettings;
          bmDoc.kraSettings = finalKraSettings;
          bmDoc.status = 'ACTIVE';
          bmDoc.isDeleted = false;
          bmDoc.deletedAt = null;
          bmDoc.deletedBy = null;
          bmDoc.updatedBy = creatorId;
          await bmDoc.save(sessionOpts);
        } else {
          const [newBm] = await BranchManager.create(
            [
              {
                userId: user._id,
                bankId,
                branchId: branch._id,
                roleId: role._id,
                employeeCode,
                fullName,
                email,
                phoneNumber,
                designation,
                personalDetails: finalPersonalDetails,
                jobDetails: finalJobDetails,
                shiftSettings: finalShiftSettings,
                attendanceSettings: finalAttendanceSettings,
                woffHoffSettings: finalWoffHoffSettings,
                kraSettings: finalKraSettings,
                status: 'ACTIVE',
                createdBy: creatorId
              }
            ],
            sessionOpts
          );
          bmDoc = newBm;
        }

        user.role = UserRole.BRANCH_MANAGER;
        branch.branchManagerId = bmDoc._id;
        await branch.save(sessionOpts);
      }

      // Connect User -> Profile
      user.profileId = employee._id;
      user.profileModel = 'SocietyEmployee';
      await user.save(sessionOpts);

      if (session) {
        await session.commitTransaction();
        transactionCommitted = true;
      }

      return this.formatEmployeeResponse(employee, role, branch);
    } catch (error) {
      if (session && !transactionCommitted) {
        await session.abortTransaction().catch(() => {});
      }
      throw error;
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }

  /**
   * List Employees (Bank-Scoped, optional Branch/Role filters)
   * Also supports including Branch Managers in listing if requested
   */
  /**
   * List Employees (Bank-Scoped, optional Branch/Role filters)
   * Also supports including Branch Managers in listing with clean unified pagination
   */
  async listEmployees(bankId, queryOptions = {}, branchIdFilter = null, isBankOwner = false, isBranchManager = false) {
    if (!bankId) {
      throw ApiError.badRequest('Bank context is required.');
    }

    const page = parseInt(queryOptions.page || '1', 10);
    const limit = parseInt(queryOptions.limit || '10', 10);
    const search = (queryOptions.search || '').trim();
    const status = queryOptions.status && queryOptions.status !== 'ALL' ? queryOptions.status.toUpperCase() : null;
    const branchFilter = branchIdFilter || queryOptions.branchId || null;
    const rawRoleInput = queryOptions.roleId || queryOptions.roleCode || queryOptions.role || queryOptions.roles || null;

    let resolvedRoleIds = [];
    let isManagerRoleRequested = false;

    if (rawRoleInput) {
      let roleTokens = [];
      if (Array.isArray(rawRoleInput)) {
        roleTokens = rawRoleInput.map((r) => String(r).trim()).filter(Boolean);
      } else {
        roleTokens = String(rawRoleInput).split(',').map((r) => r.trim()).filter(Boolean);
      }

      const validObjectIds = [];
      const codeOrNameTokens = [];

      for (const token of roleTokens) {
        if (mongoose.Types.ObjectId.isValid(token) && token.length === 24) {
          validObjectIds.push(token);
        } else {
          codeOrNameTokens.push(token);
        }
      }

      const roleOrConditions = [];
      if (validObjectIds.length > 0) {
        roleOrConditions.push({ _id: { $in: validObjectIds.map((id) => new mongoose.Types.ObjectId(id)) } });
      }
      for (const token of codeOrNameTokens) {
        const norm = normalizeRoleCode(token);
        if (norm) roleOrConditions.push({ code: norm });
        roleOrConditions.push({ code: token.toUpperCase() });
        roleOrConditions.push({ name: new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') });
      }

      if (roleOrConditions.length > 0) {
        const matchedRoles = await SocietyRole.find({
          bankId,
          isDeleted: { $ne: true },
          $or: roleOrConditions
        }).select('_id code name').lean();

        resolvedRoleIds = matchedRoles.map((r) => r._id.toString());

        isManagerRoleRequested = matchedRoles.some((r) => {
          const norm = normalizeRoleCode(r.code);
          return norm === 'MANAGER' || (r.name || '').toLowerCase().includes('branch manager');
        });
      }

      if (validObjectIds.length > 0) {
        for (const vId of validObjectIds) {
          if (!resolvedRoleIds.includes(vId)) {
            resolvedRoleIds.push(vId);
          }
        }
      }

      if (!isManagerRoleRequested) {
        isManagerRoleRequested = codeOrNameTokens.some((t) => {
          const norm = normalizeRoleCode(t);
          return norm === 'MANAGER' || t.toUpperCase() === 'BRANCH_MANAGER';
        });
      }
    }

    const includeDeleted = queryOptions.includeDeleted === 'true' || queryOptions.includeDeleted === true || queryOptions.includeDeleted === '1';
    const isDeletedQuery = queryOptions.isDeleted === 'true' || queryOptions.isDeleted === true || queryOptions.isDeleted === '1' || status === 'DELETED';
    const includeStats = queryOptions.includeStats !== undefined
      ? (queryOptions.includeStats === 'true' || queryOptions.includeStats === true || queryOptions.includeStats === '1' || queryOptions.includeStats === 1)
      : (queryOptions.stats !== undefined
          ? (queryOptions.stats === 'true' || queryOptions.stats === true || queryOptions.stats === '1' || queryOptions.stats === 1)
          : true);

    // 0. Permission check: Only Bank Owner / Super Admin and Branch Manager can view soft-deleted employees
    if ((isDeletedQuery || includeDeleted) && !isBankOwner && !isBranchManager) {
      throw ApiError.forbidden('Access denied. Only Branch Manager and Bank Owner / Super Admin can view soft-deleted employees.');
    }

    // Branch location filters (city and state - handles string, array, or comma-separated values)
    const parseLocationFilter = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val.map(s => String(s).trim()).filter(Boolean);
      return String(val).split(',').map(s => s.trim()).filter(Boolean);
    };

    const cityFilters = parseLocationFilter(queryOptions.city);
    const stateFilters = parseLocationFilter(queryOptions.state);
    const skip = (page - 1) * limit;

    // 1. Resolve matching Branch IDs if location filters are active (city / state)
    let locationBranchIds = null;
    if (cityFilters.length > 0 || stateFilters.length > 0) {
      const branchQuery = { bankId, isDeleted: { $ne: true } };
      const andConditions = [];

      if (cityFilters.length > 0) {
        const cityRegexes = cityFilters.map(c => new RegExp(c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
        andConditions.push({
          $or: [
            { city: { $in: cityRegexes } },
            { 'address.city': { $in: cityRegexes } }
          ]
        });
      }

      if (stateFilters.length > 0) {
        const stateRegexes = stateFilters.map(s => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
        andConditions.push({
          $or: [
            { state: { $in: stateRegexes } },
            { 'address.state': { $in: stateRegexes } }
          ]
        });
      }

      if (andConditions.length > 0) {
        branchQuery.$and = andConditions;
      }

      const matchingBranches = await Branch.find(branchQuery).select('_id').lean();
      locationBranchIds = matchingBranches.map(b => b._id);
    }

    // 2. Build Filter for SocietyEmployee
    const filter = { bankId };

    if (isDeletedQuery) {
      filter.isDeleted = true;
    } else if (includeDeleted) {
      filter.includeDeleted = true;
    } else {
      filter.isDeleted = { $ne: true };
    }

    if (locationBranchIds !== null) {
      if (branchFilter) {
        const isMatched = locationBranchIds.some(id => id.toString() === branchFilter.toString());
        filter.branchId = isMatched ? branchFilter : { $in: [] };
      } else {
        filter.branchId = { $in: locationBranchIds };
      }
    } else if (branchFilter) {
      filter.branchId = branchFilter;
    }

    if (resolvedRoleIds.length > 0) {
      filter.roleId = { $in: resolvedRoleIds.map((id) => new mongoose.Types.ObjectId(id)) };
    }
    if (status && status !== 'DELETED') filter.status = status;
    const explicitEmpId = (queryOptions.employeeId || queryOptions.employeeCode || queryOptions.empId || queryOptions.id || '').trim();
    if (explicitEmpId) {
      const isObjectId = mongoose.Types.ObjectId.isValid(explicitEmpId) && explicitEmpId.length === 24;
      const empIdConditions = [
        { employeeCode: new RegExp(explicitEmpId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
      ];
      if (isObjectId) {
        empIdConditions.push({ _id: new mongoose.Types.ObjectId(explicitEmpId) });
        empIdConditions.push({ userId: new mongoose.Types.ObjectId(explicitEmpId) });
      }
      filter.$and = filter.$and || [];
      filter.$and.push({ $or: empIdConditions });
    }

    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const searchConditions = [
        { fullName: searchRegex },
        { employeeCode: searchRegex },
        { email: searchRegex },
        { phoneNumber: searchRegex }
      ];
      if (mongoose.Types.ObjectId.isValid(search) && search.length === 24) {
        searchConditions.push({ _id: new mongoose.Types.ObjectId(search) });
        searchConditions.push({ userId: new mongoose.Types.ObjectId(search) });
      }
      filter.$and = filter.$and || [];
      filter.$and.push({ $or: searchConditions });
    }

    // Exclude actual Branch Managers from SocietyEmployee collection to prevent duplicate listings
    const bmDocs = await BranchManager.find({ bankId }).populate('roleId').select('userId roleId designation').lean();
    const actualBmUserIds = bmDocs
      .filter((bm) => {
        if (!bm.roleId) return true;
        return isBranchManagerRole(bm.roleId);
      })
      .map((bm) => bm.userId);

    const bmRoles = await SocietyRole.find({
      bankId,
      $or: [
        { code: { $in: ['BRANCH_MANAGER', 'MANAGER'] } },
        { name: { $regex: /branch manager/i } }
      ]
    }).select('_id').lean();
    const bmRoleIds = bmRoles.map(r => r._id);

    const bmExcludeConditions = [];
    if (actualBmUserIds.length > 0) {
      bmExcludeConditions.push({ userId: { $nin: actualBmUserIds } });
    }
    if (bmRoleIds.length > 0) {
      bmExcludeConditions.push({ roleId: { $nin: bmRoleIds } });
    }
    bmExcludeConditions.push({ designation: { $not: /branch manager/i } });

    if (bmExcludeConditions.length > 0) {
      filter.$and = filter.$and ? [...filter.$and, ...bmExcludeConditions] : bmExcludeConditions;
    }

    const sortField = queryOptions.sortBy || 'createdAt';
    const sortOrder = (queryOptions.sortOrder || 'desc').toLowerCase() === 'asc' ? 1 : -1;

    // 3. Check if BranchManager should be included in count and query
    const includeBranchManagers = queryOptions.includeBranchManagers === 'true' || queryOptions.includeBranchManagers === true || queryOptions.includeBranchManagers === '1';
    const shouldFetchManagers = includeBranchManagers && (!rawRoleInput || isManagerRoleRequested);

    let managerCount = 0;
    let bmFilter = null;

    if (shouldFetchManagers) {
      bmFilter = { bankId };

      if (isDeletedQuery) {
        bmFilter.isDeleted = true;
      } else if (includeDeleted) {
        bmFilter.includeDeleted = true;
      } else {
        bmFilter.isDeleted = { $ne: true };
      }

      if (locationBranchIds !== null) {
        if (branchFilter) {
          const isMatched = locationBranchIds.some(id => id.toString() === branchFilter.toString());
          bmFilter.branchId = isMatched ? branchFilter : { $in: [] };
        } else {
          bmFilter.branchId = { $in: locationBranchIds };
        }
      } else if (branchFilter) {
        bmFilter.branchId = branchFilter;
      }

      if (status && status !== 'DELETED') bmFilter.status = status;

      if (explicitEmpId) {
        const isObjectId = mongoose.Types.ObjectId.isValid(explicitEmpId) && explicitEmpId.length === 24;
        const empIdConditions = [
          { employeeCode: new RegExp(explicitEmpId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
        ];
        if (isObjectId) {
          empIdConditions.push({ _id: new mongoose.Types.ObjectId(explicitEmpId) });
          empIdConditions.push({ userId: new mongoose.Types.ObjectId(explicitEmpId) });
        }
        bmFilter.$and = bmFilter.$and || [];
        bmFilter.$and.push({ $or: empIdConditions });
      }

      if (search) {
        const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const searchConditions = [
          { fullName: searchRegex },
          { employeeCode: searchRegex },
          { email: searchRegex },
          { phoneNumber: searchRegex }
        ];
        if (mongoose.Types.ObjectId.isValid(search) && search.length === 24) {
          searchConditions.push({ _id: new mongoose.Types.ObjectId(search) });
          searchConditions.push({ userId: new mongoose.Types.ObjectId(search) });
        }
        bmFilter.$and = bmFilter.$and || [];
        bmFilter.$and.push({ $or: searchConditions });
      }
      managerCount = await BranchManager.countDocuments(bmFilter);
    }

    const employeeCount = (isManagerRoleRequested && shouldFetchManagers && String(rawRoleInput || '').toUpperCase() === 'BRANCH_MANAGER')
      ? 0
      : await SocietyEmployee.countDocuments(filter);

    const totalRecords = managerCount + employeeCount;
    const totalPages = Math.max(1, Math.ceil(totalRecords / limit));

    let items = [];

    if (shouldFetchManagers) {
      if (skip < managerCount) {
        // Fetch managers starting at `skip` up to `limit`
        const managersToFetch = Math.min(limit, managerCount - skip);
        const rawManagers = await BranchManager.find(bmFilter)
          .populate('roleId')
          .populate('branchId')
          .sort({ [sortField]: sortOrder })
          .skip(skip)
          .limit(managersToFetch)
          .lean();

        const formattedManagers = rawManagers.map((bm) => {
          const roleObj = bm.roleId && typeof bm.roleId === 'object' ? bm.roleId : null;
          return {
            type: 'BRANCH_MANAGER',
            id: bm._id,
            employeeId: bm._id,
            userId: bm.userId,
            bankId: bm.bankId,
            branchId: bm.branchId?._id || bm.branchId,
            branch: bm.branchId
              ? {
                  id: bm.branchId._id,
                  name: bm.branchId.name,
                  code: bm.branchId.code,
                  state: bm.branchId.state || bm.branchId.address?.state || ''
                }
              : null,
            roleId: roleObj?._id || bm.roleId || null,
            role: roleObj
              ? {
                  id: roleObj._id,
                  name: roleObj.name,
                  code: roleObj.code,
                  permissions: roleObj.permissions || []
                }
              : { id: null, name: 'Branch Manager', code: 'BRANCH_MANAGER', permissions: [] },
            designation: roleObj?.name || bm.designation || 'Branch Manager',
            department: bm.department || 'Branch Operations',
            employeeCode: bm.employeeCode || '',
            fullName: bm.fullName,
            email: bm.email,
            phoneNumber: bm.phoneNumber,
            dutyHours: '09:30 to 18:30',
            weeklyOff: 'Sunday',
            status: bm.status,
            createdAt: bm.createdAt
          };
        });

        items.push(...formattedManagers);

        // If we still need more items to fill the page limit, fetch employees starting from 0
        const remLimit = limit - formattedManagers.length;
        if (remLimit > 0 && employeeCount > 0) {
          const rawEmployees = await SocietyEmployee.find(filter)
            .populate('roleId')
            .populate('branchId')
            .sort({ [sortField]: sortOrder })
            .skip(0)
            .limit(remLimit)
            .lean();

          const formattedEmployees = rawEmployees.map((e) => ({
            type: 'EMPLOYEE',
            ...this.formatEmployeeResponse(e, e.roleId, e.branchId)
          }));

          items.push(...formattedEmployees);
        }
      } else {
        // skip >= managerCount: all managers are skipped, offset into employees array
        const empSkip = skip - managerCount;
        const rawEmployees = await SocietyEmployee.find(filter)
          .populate('roleId')
          .populate('branchId')
          .sort({ [sortField]: sortOrder })
          .skip(empSkip)
          .limit(limit)
          .lean();

        const formattedEmployees = rawEmployees.map((e) => ({
          type: 'EMPLOYEE',
          ...this.formatEmployeeResponse(e, e.roleId, e.branchId)
        }));

        items.push(...formattedEmployees);
      }
    } else {
      // Standard query for SocietyEmployee only
      const rawEmployees = await SocietyEmployee.find(filter)
        .populate('roleId')
        .populate('branchId')
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean();

      items = rawEmployees.map((e) => ({
        type: 'EMPLOYEE',
        ...this.formatEmployeeResponse(e, e.roleId, e.branchId)
      }));
    }

    // Attach 1-based srNo relative to the current page
    items = items.map((item, idx) => ({
      srNo: skip + idx + 1,
      ...item
    }));

    let stats = null;
    if (includeStats) {
      stats = await this.getEmployeeStats(bankId, branchFilter, locationBranchIds);
    }

    const response = {
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

    if (stats) response.stats = stats;
    return response;
  }

  /**
   * Helper to aggregate comprehensive Employee & HR statistics
   */
  async getEmployeeStats(bankId, branchIdFilter = null, locationBranchIds = null) {
    try {
      const baseMatch = { bankId };

      if (locationBranchIds !== null) {
        if (branchIdFilter) {
          const isMatched = locationBranchIds.some(id => id.toString() === branchIdFilter.toString());
          baseMatch.branchId = isMatched ? branchIdFilter : { $in: [] };
        } else {
          baseMatch.branchId = { $in: locationBranchIds };
        }
      } else if (branchIdFilter) {
        baseMatch.branchId = branchIdFilter;
      }

      // Exclude Branch Managers from SocietyEmployee queries to avoid double counting
      const bmUserIds = await BranchManager.distinct('userId', { bankId });
      const bmRoles = await SocietyRole.find({
        bankId,
        $or: [
          { code: { $in: ['BRANCH_MANAGER', 'MANAGER'] } },
          { name: { $regex: /branch manager/i } }
        ]
      }).select('_id').lean();
      const bmRoleIds = bmRoles.map(r => r._id);

      const bmExcludeConditions = [];
      if (bmUserIds.length > 0) {
        bmExcludeConditions.push({ userId: { $nin: bmUserIds } });
      }
      if (bmRoleIds.length > 0) {
        bmExcludeConditions.push({ roleId: { $nin: bmRoleIds } });
      }
      bmExcludeConditions.push({ designation: { $not: /branch manager/i } });

      const empBaseMatch = { ...baseMatch };
      if (bmExcludeConditions.length > 0) {
        empBaseMatch.$and = bmExcludeConditions;
      }

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const [
        activeEmpCount,
        inactiveEmpCount,
        deletedEmpCount,
        activeManagerCount,
        deletedManagerCount,
        genderStatsEmp,
        genderStatsBm,
        deptStats,
        desigStats,
        financialStatsEmp,
        financialStatsBm,
        joiningStatsEmp,
        joiningStatsBm,
        dobStatsEmp,
        dobStatsBm
      ] = await Promise.all([
        SocietyEmployee.countDocuments({ ...empBaseMatch, status: 'ACTIVE', isDeleted: { $ne: true } }),
        SocietyEmployee.countDocuments({ ...empBaseMatch, status: 'INACTIVE', isDeleted: { $ne: true } }),
        SocietyEmployee.countDocuments({ ...empBaseMatch, isDeleted: true }),
        BranchManager.countDocuments({ ...baseMatch, status: 'ACTIVE', isDeleted: { $ne: true } }),
        BranchManager.countDocuments({ ...baseMatch, isDeleted: true }),
        SocietyEmployee.aggregate([
          { $match: { ...empBaseMatch, isDeleted: { $ne: true } } },
          {
            $group: {
              _id: { $ifNull: ['$personalDetails.gender', 'MALE'] },
              count: { $sum: 1 }
            }
          }
        ]),
        BranchManager.aggregate([
          { $match: { ...baseMatch, isDeleted: { $ne: true } } },
          {
            $group: {
              _id: { $ifNull: ['$personalDetails.gender', 'MALE'] },
              count: { $sum: 1 }
            }
          }
        ]),
        SocietyEmployee.aggregate([
          { $match: { ...empBaseMatch, isDeleted: { $ne: true } } },
          {
            $group: {
              _id: { $ifNull: ['$department', 'Loans & Disbursals'] },
              count: { $sum: 1 }
            }
          }
        ]),
        SocietyEmployee.aggregate([
          { $match: { ...empBaseMatch, isDeleted: { $ne: true } } },
          {
            $group: {
              _id: { $ifNull: ['$designation', 'EMPLOYEE'] },
              count: { $sum: 1 }
            }
          }
        ]),
        SocietyEmployee.aggregate([
          { $match: { ...empBaseMatch, isDeleted: { $ne: true } } },
          {
            $group: {
              _id: null,
              totalSalary: { $sum: { $ifNull: ['$jobDetails.salary', 0] } },
              count: { $sum: 1 }
            }
          }
        ]),
        BranchManager.aggregate([
          { $match: { ...baseMatch, isDeleted: { $ne: true } } },
          {
            $group: {
              _id: null,
              totalSalary: { $sum: { $ifNull: ['$jobDetails.salary', 0] } },
              count: { $sum: 1 }
            }
          }
        ]),
        SocietyEmployee.countDocuments({
          ...empBaseMatch,
          isDeleted: { $ne: true },
          $or: [
            { 'jobDetails.joiningDate': { $gte: startOfMonth, $lt: endOfMonth } },
            { createdAt: { $gte: startOfMonth, $lt: endOfMonth } }
          ]
        }),
        BranchManager.countDocuments({
          ...baseMatch,
          isDeleted: { $ne: true },
          $or: [
            { 'jobDetails.joiningDate': { $gte: startOfMonth, $lt: endOfMonth } },
            { createdAt: { $gte: startOfMonth, $lt: endOfMonth } }
          ]
        }),
        SocietyEmployee.countDocuments({
          ...empBaseMatch,
          isDeleted: { $ne: true },
          'personalDetails.dateOfBirth': { $exists: true, $ne: null }
        }),
        BranchManager.countDocuments({
          ...baseMatch,
          isDeleted: { $ne: true },
          'personalDetails.dateOfBirth': { $exists: true, $ne: null }
        })
      ]);

      const genderRatio = { MALE: 0, FEMALE: 0, OTHER: 0 };
      [...(genderStatsEmp || []), ...(genderStatsBm || [])].forEach(g => {
        if (g._id) {
          const key = g._id.toString().toUpperCase();
          genderRatio[key] = (genderRatio[key] || 0) + g.count;
        }
      });

      const departmentWise = {};
      (deptStats || []).forEach(d => {
        if (d._id) departmentWise[d._id] = d.count;
      });
      if (activeManagerCount > 0) {
        departmentWise['Branch Operations'] = (departmentWise['Branch Operations'] || 0) + activeManagerCount;
      }

      const designationWise = {};
      if (activeManagerCount > 0) {
        designationWise['Branch Manager'] = activeManagerCount;
      }
      (desigStats || []).forEach(d => {
        if (d._id) designationWise[d._id] = (designationWise[d._id] || 0) + d.count;
      });

      const totalSalEmp = (financialStatsEmp && financialStatsEmp[0]?.totalSalary) || 0;
      const countEmp = (financialStatsEmp && financialStatsEmp[0]?.count) || 0;
      const totalSalBm = (financialStatsBm && financialStatsBm[0]?.totalSalary) || 0;
      const countBm = (financialStatsBm && financialStatsBm[0]?.count) || 0;

      const totalSalaryBudget = totalSalEmp + totalSalBm;
      const totalCountForAvg = countEmp + countBm;
      const averageSalary = totalCountForAvg > 0 ? totalSalaryBudget / totalCountForAvg : 0;

      const totalActive = activeEmpCount + activeManagerCount;
      const totalInactive = inactiveEmpCount;
      const totalSoftDeleted = deletedEmpCount + deletedManagerCount;
      const totalEmployees = totalActive + totalInactive;

      return {
        totalEmployees,
        totalActive,
        totalSoftDeleted,
        totalBranchManagers: activeManagerCount,
        totalRegularEmployees: activeEmpCount,
        genderRatio,
        newHiresThisMonth: (joiningStatsEmp || 0) + (joiningStatsBm || 0),
        upcomingBirthdaysThisMonth: (dobStatsEmp || 0) + (dobStatsBm || 0),
        departmentWise,
        designationWise,
        totalMonthlySalaryBudget: Math.round(totalSalaryBudget),
        averageSalary: Math.round(averageSalary)
      };
    } catch (err) {
      return {
        totalEmployees: 0,
        totalActive: 0,
        totalSoftDeleted: 0,
        totalBranchManagers: 0,
        totalRegularEmployees: 0,
        genderRatio: { MALE: 0, FEMALE: 0, OTHER: 0 },
        newHiresThisMonth: 0,
        upcomingBirthdaysThisMonth: 0,
        departmentWise: {},
        designationWise: {},
        totalMonthlySalaryBudget: 0,
        averageSalary: 0
      };
    }
  }

  /**
   * Get single Employee details by ID (Tenant-Scoped)
   */
  async getEmployeeById(bankId, employeeId) {
    const isObjectId = mongoose.Types.ObjectId.isValid(employeeId);
    const idQuery = isObjectId
      ? { $or: [{ _id: employeeId }, { userId: employeeId }, { employeeCode: employeeId }] }
      : { employeeCode: employeeId };

    const bankQuery = bankId ? { bankId } : {};

    // 1. Try finding in SocietyEmployee collection with bank filter
    let employee = await SocietyEmployee.findOne({
      ...idQuery,
      ...bankQuery,
      isDeleted: { $ne: true }
    })
      .populate('roleId')
      .populate('branchId')
      .lean();

    // 1b. Fallback: Try finding in SocietyEmployee without strict bank filter
    if (!employee && bankId) {
      employee = await SocietyEmployee.findOne({
        ...idQuery,
        isDeleted: { $ne: true }
      })
        .populate('roleId')
        .populate('branchId')
        .lean();
    }

    if (employee) {
      return this.formatEmployeeResponse(employee, employee.roleId, employee.branchId);
    }

    // 2. Try finding in BranchManager collection with bank filter
    let manager = await BranchManager.findOne({
      ...idQuery,
      ...bankQuery,
      isDeleted: { $ne: true }
    })
      .populate('branchId')
      .lean();

    // 2b. Fallback: Try finding in BranchManager without strict bank filter
    if (!manager && bankId) {
      manager = await BranchManager.findOne({
        ...idQuery,
        isDeleted: { $ne: true }
      })
        .populate('branchId')
        .lean();
    }

    if (manager) {
      let roleDoc = { id: null, name: 'Branch Manager', code: 'BRANCH_MANAGER', permissions: [] };
      if (manager.roleId) {
        const customRole = await SocietyRole.findOne({ _id: manager.roleId, isDeleted: { $ne: true } }).lean();
        if (customRole) roleDoc = customRole;
      }
      return this.formatEmployeeResponse(manager, roleDoc, manager.branchId);
    }

    throw ApiError.notFound('Employee profile not found or does not belong to your bank.');
  }

  /**
   * Helper to locate Employee and associated User
   */
  async findEmployeeAndUser(bankId, employeeId, includeDeleted = false) {
    const isObjectId = mongoose.Types.ObjectId.isValid(employeeId);
    const idQuery = isObjectId
      ? { $or: [{ _id: employeeId }, { userId: employeeId }, { employeeCode: employeeId }] }
      : { employeeCode: employeeId };

    const filterExtra = includeDeleted ? { includeDeleted: true } : { isDeleted: { $ne: true } };

    let employee = await SocietyEmployee.findOne({
      ...idQuery,
      ...(bankId ? { bankId } : {}),
      ...filterExtra
    });

    if (!employee && bankId) {
      employee = await SocietyEmployee.findOne({
        ...idQuery,
        ...filterExtra
      });
    }

    if (!employee) {
      employee = await BranchManager.findOne({
        ...idQuery,
        ...(bankId ? { bankId } : {}),
        ...filterExtra
      });

      if (!employee && bankId) {
        employee = await BranchManager.findOne({
          ...idQuery,
          ...filterExtra
        });
      }
    }

    if (!employee) {
      throw ApiError.notFound('Employee profile not found or does not belong to your bank.');
    }

    const user = await User.findOne({
      _id: employee.userId,
      ...filterExtra
    });

    if (!user) {
      throw ApiError.notFound('Employee user identity record not found.');
    }

    return { employee, user };
  }

  /**
   * Update complete Employee profile
   */
  async updateEmployee(bankId, employeeId, payload, updaterId) {
    const { employee, user } = await this.findEmployeeAndUser(bankId, employeeId);

    if (payload.fullName || payload.personalDetails?.fullName) {
      const fullName = (payload.fullName || payload.personalDetails?.fullName).trim();
      employee.fullName = fullName;
      employee.personalDetails.fullName = fullName;
      user.fullName = fullName;
    }

    if (payload.email || payload.personalDetails?.email) {
      const email = (payload.email || payload.personalDetails?.email).trim().toLowerCase();
      if (email !== employee.email) {
        const existing = await User.findOne({ email, _id: { $ne: user._id }, isDeleted: { $ne: true } });
        if (existing) {
          throw ApiError.conflict(`User identity with email [${email}] already exists.`);
        }
        employee.email = email;
        employee.personalDetails.email = email;
        user.email = email;
      }
    }

    if (payload.phoneNumber || payload.personalDetails?.phoneNumber) {
      const phone = (payload.phoneNumber || payload.personalDetails?.phoneNumber).trim();
      if (phone !== employee.phoneNumber) {
        const existing = await User.findOne({ phoneNumber: phone, _id: { $ne: user._id }, isDeleted: { $ne: true } });
        if (existing) {
          throw ApiError.conflict(`User identity with phone number [${phone}] already exists.`);
        }
        employee.phoneNumber = phone;
        employee.personalDetails.phoneNumber = phone;
        user.phoneNumber = phone;
      }
    }

    if (payload.password && payload.password.trim().length >= 6) {
      user.passwordHash = await bcrypt.hash(payload.password.trim(), 10);
    }

    if (payload.employeeCode) employee.employeeCode = payload.employeeCode.trim();

    if (payload.status) {
      const status = payload.status.toUpperCase();
      employee.status = status;
      user.status = status;
    }

    // Role / Branch Transfer Validation & Single Branch Manager Constraint
    const targetRoleId = payload.roleId || payload.jobDetails?.roleId || employee.roleId;
    const targetBranchId = payload.branchId || payload.jobDetails?.branchId || employee.branchId;

    if (
      targetRoleId &&
      targetBranchId &&
      (targetRoleId.toString() !== employee.roleId.toString() || targetBranchId.toString() !== employee.branchId.toString())
    ) {
      await this.validateSingleBranchManager(bankId, targetBranchId, targetRoleId, employee._id);
    }

    if (payload.roleId || payload.jobDetails?.roleId) {
      const targetRoleId = payload.roleId || payload.jobDetails?.roleId;
      if (targetRoleId.toString() !== employee.roleId.toString()) {
        const role = await SocietyRole.findOne({ _id: targetRoleId, bankId, isDeleted: { $ne: true } });
        if (!role) {
          throw ApiError.notFound('Target role not found or does not belong to your bank.');
        }
        employee.roleId = role._id;
        employee.designation = role.name;
        employee.jobDetails.designation = role.name;
        user.role = role.code || role.name || UserRole.EMPLOYEE;
      }
    }

    // Branch Transfer Validation
    if (payload.branchId || payload.jobDetails?.branchId) {
      const targetBranchId = payload.branchId || payload.jobDetails?.branchId;
      if (targetBranchId.toString() !== employee.branchId.toString()) {
        const branch = await Branch.findOne({ _id: targetBranchId, bankId, isDeleted: { $ne: true } });
        if (!branch) {
          throw ApiError.notFound('Target branch not found or does not belong to your bank.');
        }
        employee.branchId = branch._id;
      }
    }

    // Merge nested HR sections
    if (payload.personalDetails) {
      employee.personalDetails = { ...employee.personalDetails.toObject(), ...payload.personalDetails };
    }
    if (payload.jobDetails) {
      employee.jobDetails = { ...employee.jobDetails.toObject(), ...payload.jobDetails };
    }
    if (payload.shiftSettings) {
      employee.shiftSettings = { ...employee.shiftSettings.toObject(), ...payload.shiftSettings };
    }
    if (payload.attendanceSettings) {
      employee.attendanceSettings = { ...employee.attendanceSettings.toObject(), ...payload.attendanceSettings };
    }
    if (payload.woffHoffSettings) {
      employee.woffHoffSettings = { ...employee.woffHoffSettings.toObject(), ...payload.woffHoffSettings };
    }
    if (payload.kraSettings) {
      employee.kraSettings = { ...employee.kraSettings.toObject(), ...payload.kraSettings };
    }

    employee.updatedBy = updaterId;
    user.updatedBy = updaterId;

    await Promise.all([employee.save(), user.save()]);
    await this.syncManagerAndEmployeeProfiles(user._id, bankId, employee.branchId, updaterId, payload);

    const [roleDoc, branchDoc] = await Promise.all([
      SocietyRole.findById(employee.roleId).lean(),
      Branch.findById(employee.branchId).lean()
    ]);

    return this.formatEmployeeResponse(employee, roleDoc, branchDoc);
  }

  /**
   * Deactivate (Soft Delete) or Permanently Purge (Hard Delete) Employee
   */
  async deleteEmployee(bankId, employeeId, deleterId, permanent = false) {
    const { employee, user } = await this.findEmployeeAndUser(bankId, employeeId, true);

    if (permanent) {
      const formatted = this.formatEmployeeResponse(employee);
      const empId = employee._id;
      const userId = user._id;

      await Promise.all([
        SocietyEmployee.deleteMany({ $or: [{ _id: empId }, { userId }] }),
        BranchManager.deleteMany({ $or: [{ _id: empId }, { userId }] }),
        EmployeeProfile.deleteMany({ $or: [{ _id: empId }, { userId }] }),
        User.deleteOne({ _id: userId })
      ]);

      await Branch.updateMany(
        { branchManagerId: { $in: [empId, userId] } },
        { $unset: { branchManagerId: 1 } }
      ).catch(() => {});

      return {
        id: empId,
        userId,
        isPermanentlyDeleted: true,
        ...formatted
      };
    }

    const now = new Date();

    employee.isDeleted = true;
    employee.deletedAt = now;
    employee.deletedBy = deleterId;
    employee.status = 'INACTIVE';

    user.isDeleted = true;
    user.deletedAt = now;
    user.deletedBy = deleterId;
    user.status = 'INACTIVE';

    await Promise.all([
      employee.save(),
      user.save(),
      SocietyEmployee.updateMany(
        { userId: user._id },
        { $set: { isDeleted: true, deletedAt: now, deletedBy: deleterId, status: 'INACTIVE' } }
      ),
      BranchManager.updateMany(
        { userId: user._id },
        { $set: { isDeleted: true, deletedAt: now, deletedBy: deleterId, status: 'INACTIVE' } }
      )
    ]);

    return this.formatEmployeeResponse(employee);
  }

  /**
   * Restore soft-deleted Employee
   */
  async restoreEmployee(bankId, employeeId, restorerId, isBankOwner = false, isBranchManager = false) {
    if (!isBankOwner && !isBranchManager) {
      throw ApiError.forbidden('Access denied. Only Super Admin / Bank Owner and Branch Manager can restore employees.');
    }
    const isObjectId = mongoose.Types.ObjectId.isValid(employeeId);
    const idQuery = isObjectId
      ? { $or: [{ _id: employeeId }, { userId: employeeId }, { employeeCode: employeeId }] }
      : { employeeCode: employeeId };

    const bankQuery = bankId ? { bankId } : {};

    let employee = await SocietyEmployee.findOne({
      ...idQuery,
      ...bankQuery,
      includeDeleted: true
    });

    if (!employee && bankId) {
      employee = await SocietyEmployee.findOne({
        ...idQuery,
        includeDeleted: true
      });
    }

    if (!employee) {
      employee = await BranchManager.findOne({
        ...idQuery,
        ...bankQuery,
        includeDeleted: true
      });

      if (!employee && bankId) {
        employee = await BranchManager.findOne({
          ...idQuery,
          includeDeleted: true
        });
      }
    }

    if (!employee && isObjectId) {
      employee = await SocietyEmployee.findOne({ userId: employeeId, includeDeleted: true })
        || await BranchManager.findOne({ userId: employeeId, includeDeleted: true });
    }

    if (!employee) {
      throw ApiError.notFound('Employee profile not found.');
    }

    if (!employee.isDeleted) {
      throw ApiError.badRequest('Employee is already active and not deleted.');
    }

    const user = await User.findOne({ _id: employee.userId, includeDeleted: true });
    if (!user) {
      throw ApiError.notFound('Employee user identity record not found.');
    }

    // Check duplicate email / phone conflicts with existing active users
    if (employee.email) {
      const existingEmail = await User.findOne({
        email: employee.email,
        _id: { $ne: user._id },
        isDeleted: { $ne: true }
      });
      if (existingEmail) {
        throw ApiError.conflict(`Cannot restore: Active user identity with email [${employee.email}] already exists.`);
      }
    }

    if (employee.phoneNumber) {
      const existingPhone = await User.findOne({
        phoneNumber: employee.phoneNumber,
        _id: { $ne: user._id },
        isDeleted: { $ne: true }
      });
      if (existingPhone) {
        throw ApiError.conflict(`Cannot restore: Active user identity with phone number [${employee.phoneNumber}] already exists.`);
      }
    }

    // Validate single branch manager constraint if employee has manager role
    if (employee.branchId && employee.roleId) {
      await this.validateSingleBranchManager(bankId || employee.bankId, employee.branchId, employee.roleId, employee._id);
    }

    employee.isDeleted = false;
    employee.deletedAt = null;
    employee.deletedBy = null;
    employee.status = 'ACTIVE';
    employee.updatedBy = restorerId;

    user.isDeleted = false;
    user.deletedAt = null;
    user.deletedBy = null;
    user.status = 'ACTIVE';
    user.updatedBy = restorerId;

    await Promise.all([
      employee.save(),
      user.save(),
      SocietyEmployee.updateMany(
        { userId: user._id },
        { $set: { isDeleted: false, deletedAt: null, deletedBy: null, status: 'ACTIVE', updatedBy: restorerId } }
      ),
      BranchManager.updateMany(
        { userId: user._id },
        { $set: { isDeleted: false, deletedAt: null, deletedBy: null, status: 'ACTIVE', updatedBy: restorerId } }
      )
    ]);

    const [roleDoc, branchDoc] = await Promise.all([
      SocietyRole.findById(employee.roleId).lean(),
      Branch.findById(employee.branchId).lean()
    ]);

    return this.formatEmployeeResponse(employee, roleDoc, branchDoc);
  }

  /**
   * Change Employee Role
   */
  async changeRole(bankId, employeeId, roleId, updaterId) {
    const role = await SocietyRole.findOne({ _id: roleId, bankId, isDeleted: { $ne: true } });
    if (!role) {
      throw ApiError.notFound('Target role not found or does not belong to your bank.');
    }

    const { employee, user } = await this.findEmployeeAndUser(bankId, employeeId);
    const isTargetBM = isBranchManagerRole(role);

    // Validate single branch manager constraint
    if (isTargetBM) {
      await this.validateSingleBranchManager(bankId, employee.branchId, role._id, employee._id);
    }

    employee.roleId = role._id;
    employee.designation = role.name;
    employee.jobDetails.designation = role.name;
    employee.updatedBy = updaterId;

    if (user) {
      user.role = isTargetBM ? UserRole.BRANCH_MANAGER : (role.code || role.name || UserRole.EMPLOYEE);
      user.updatedBy = updaterId;
      await user.save();
    }

    if (!isTargetBM) {
      // Clean up any stale BranchManager document if user is assigned a non-Branch Manager role
      await BranchManager.deleteMany({ userId: user._id });
    } else {
      await this.syncManagerAndEmployeeProfiles(user._id, bankId, employee.branchId, updaterId, { designation: role.name });
    }

    await employee.save();
    const branch = await Branch.findById(employee.branchId).lean();
    return this.formatEmployeeResponse(employee, role, branch);
  }

  /**
   * Change Employee Branch
   */
  async changeBranch(bankId, employeeId, branchId, updaterId) {
    const branch = await Branch.findOne({ _id: branchId, bankId, isDeleted: { $ne: true } });
    if (!branch) {
      throw ApiError.notFound('Target branch not found or does not belong to your bank.');
    }

    const { employee } = await this.findEmployeeAndUser(bankId, employeeId);

    // Validate single branch manager constraint
    await this.validateSingleBranchManager(bankId, branch._id, employee.roleId, employee._id);

    employee.branchId = branch._id;
    employee.updatedBy = updaterId;

    await employee.save();
    const role = await SocietyRole.findById(employee.roleId).lean();
    return this.formatEmployeeResponse(employee, role, branch);
  }

  /**
   * Tab 1: Update Personal Details
   */
  async updatePersonalDetails(bankId, employeeId, payload, updaterId) {
    const { employee, user } = await this.findEmployeeAndUser(bankId, employeeId);

    if (payload.fullName) {
      const name = payload.fullName.trim();
      employee.fullName = name;
      user.fullName = name;
      employee.personalDetails.fullName = name;
    }

    if (payload.email) {
      const email = payload.email.trim().toLowerCase();
      if (email !== employee.email) {
        const existing = await User.findOne({ email, _id: { $ne: user._id }, isDeleted: { $ne: true } });
        if (existing) {
          throw ApiError.conflict(`Email [${email}] is already in use.`);
        }
        employee.email = email;
        user.email = email;
        employee.personalDetails.email = email;
      }
    }

    if (payload.phoneNumber) {
      const phone = payload.phoneNumber.trim();
      if (phone !== employee.phoneNumber) {
        const existing = await User.findOne({ phoneNumber: phone, _id: { $ne: user._id }, isDeleted: { $ne: true } });
        if (existing) {
          throw ApiError.conflict(`Phone number [${phone}] is already in use.`);
        }
        employee.phoneNumber = phone;
        user.phoneNumber = phone;
        employee.personalDetails.phoneNumber = phone;
      }
    }

    if (payload.password && payload.password.trim().length >= 6) {
      user.passwordHash = await bcrypt.hash(payload.password.trim(), 10);
    }

    if (payload.gender) employee.personalDetails.gender = payload.gender;
    if (payload.dateOfBirth) employee.personalDetails.dateOfBirth = new Date(payload.dateOfBirth);
    if (payload.address !== undefined) employee.personalDetails.address = payload.address.trim();
    if (payload.profileImage !== undefined) employee.personalDetails.profileImage = payload.profileImage;
    if (payload.profileImageKey !== undefined) employee.personalDetails.profileImageKey = payload.profileImageKey;

    employee.updatedBy = updaterId;
    user.updatedBy = updaterId;

    await Promise.all([employee.save(), user.save()]);

    const [roleDoc, branchDoc] = await Promise.all([
      SocietyRole.findById(employee.roleId).lean(),
      Branch.findById(employee.branchId).lean()
    ]);

    return this.formatEmployeeResponse(employee, roleDoc, branchDoc);
  }

  /**
   * Tab 2: Update Job Details
   */
  async updateJobDetails(bankId, employeeId, payload, updaterId) {
    const { employee, user } = await this.findEmployeeAndUser(bankId, employeeId);

    const targetRoleId = payload.roleId || employee.roleId;
    const targetBranchId = payload.branchId || employee.branchId;

    if (
      targetRoleId &&
      targetBranchId &&
      (targetRoleId.toString() !== employee.roleId.toString() || targetBranchId.toString() !== employee.branchId.toString())
    ) {
      await this.validateSingleBranchManager(bankId, targetBranchId, targetRoleId, employee._id);
    }

    if (payload.roleId) {
      const role = await SocietyRole.findOne({ _id: payload.roleId, bankId, isDeleted: { $ne: true } });
      if (!role) {
        throw ApiError.notFound('Target role not found or does not belong to your bank.');
      }
      employee.roleId = role._id;
      employee.designation = role.name;
      employee.jobDetails.designation = role.name;

      if (user) {
        user.role = role.code || role.name || UserRole.EMPLOYEE;
        user.updatedBy = updaterId;
        await user.save();
      }
    }

    if (payload.branchId) {
      const branch = await Branch.findOne({ _id: payload.branchId, bankId, isDeleted: { $ne: true } });
      if (!branch) {
        throw ApiError.notFound('Target branch not found or does not belong to your bank.');
      }
      employee.branchId = branch._id;
    }

    if (payload.state !== undefined) employee.jobDetails.state = payload.state.trim();
    if (payload.salary !== undefined) employee.jobDetails.salary = Number(payload.salary);
    if (payload.joiningDate) employee.jobDetails.joiningDate = new Date(payload.joiningDate);
    if (payload.probationPeriodMonths !== undefined)
      employee.jobDetails.probationPeriodMonths = Number(payload.probationPeriodMonths);

    employee.updatedBy = updaterId;
    await employee.save();

    const [roleDoc, branchDoc] = await Promise.all([
      SocietyRole.findById(employee.roleId).lean(),
      Branch.findById(employee.branchId).lean()
    ]);

    return this.formatEmployeeResponse(employee, roleDoc, branchDoc);
  }

  /**
   * Tab 3: Update Shift Settings
   */
  async updateShiftSettings(bankId, employeeId, payload, updaterId) {
    const { employee } = await this.findEmployeeAndUser(bankId, employeeId);

    const shift = employee.shiftSettings || {};
    if (payload.punchInTime) shift.punchInTime = payload.punchInTime;
    if (payload.punchOutTime) shift.punchOutTime = payload.punchOutTime;
    if (payload.weeklyOff) {
      shift.weeklyOff = { ...shift.weeklyOff?.toObject(), ...payload.weeklyOff };
    }
    if (payload.lateAllowedMinutes !== undefined) shift.lateAllowedMinutes = Number(payload.lateAllowedMinutes);
    if (payload.lateAllowedAsPerShift !== undefined) shift.lateAllowedAsPerShift = Boolean(payload.lateAllowedAsPerShift);
    if (payload.earlyAllowedMinutes !== undefined) shift.earlyAllowedMinutes = Number(payload.earlyAllowedMinutes);
    if (payload.earlyAllowedAsPerShift !== undefined) shift.earlyAllowedAsPerShift = Boolean(payload.earlyAllowedAsPerShift);
    if (payload.halfDayMinutes !== undefined) shift.halfDayMinutes = Number(payload.halfDayMinutes);
    if (payload.fullDayMinutes !== undefined) shift.fullDayMinutes = Number(payload.fullDayMinutes);

    employee.shiftSettings = shift;
    employee.updatedBy = updaterId;
    await employee.save();

    const [roleDoc, branchDoc] = await Promise.all([
      SocietyRole.findById(employee.roleId).lean(),
      Branch.findById(employee.branchId).lean()
    ]);

    return this.formatEmployeeResponse(employee, roleDoc, branchDoc);
  }

  /**
   * Tab 4: Update Attendance Settings
   */
  async updateAttendanceSettings(bankId, employeeId, payload, updaterId) {
    const { employee } = await this.findEmployeeAndUser(bankId, employeeId);

    const att = employee.attendanceSettings || {};
    if (payload.punchType) att.punchType = payload.punchType;
    if (payload.noOutPunchAction) att.noOutPunchAction = payload.noOutPunchAction;
    if (payload.presentOnWeeklyOffHolidayAction) att.presentOnWeeklyOffHolidayAction = payload.presentOnWeeklyOffHolidayAction;
    if (payload.lateCut) att.lateCut = { ...att.lateCut?.toObject(), ...payload.lateCut };
    if (payload.lunchAndEarlyGoing) att.lunchAndEarlyGoing = { ...att.lunchAndEarlyGoing?.toObject(), ...payload.lunchAndEarlyGoing };
    if (payload.overtime) att.overtime = { ...att.overtime?.toObject(), ...payload.overtime };

    employee.attendanceSettings = att;
    employee.updatedBy = updaterId;
    await employee.save();

    const [roleDoc, branchDoc] = await Promise.all([
      SocietyRole.findById(employee.roleId).lean(),
      Branch.findById(employee.branchId).lean()
    ]);

    return this.formatEmployeeResponse(employee, roleDoc, branchDoc);
  }

  /**
   * Tab 5: Update WOFF / HOFF Settings
   */
  async updateWoffHoffSettings(bankId, employeeId, payload, updaterId) {
    const { employee } = await this.findEmployeeAndUser(bankId, employeeId);

    const wh = employee.woffHoffSettings || {};
    if (payload.weeklyOffRules) wh.weeklyOffRules = { ...wh.weeklyOffRules?.toObject(), ...payload.weeklyOffRules };
    if (payload.holidayRules) wh.holidayRules = { ...wh.holidayRules?.toObject(), ...payload.holidayRules };
    if (payload.leaveBridgeRules) wh.leaveBridgeRules = { ...wh.leaveBridgeRules?.toObject(), ...payload.leaveBridgeRules };
    if (payload.leaveSettings) wh.leaveSettings = { ...wh.leaveSettings?.toObject(), ...payload.leaveSettings };

    employee.woffHoffSettings = wh;
    employee.updatedBy = updaterId;
    await employee.save();

    const [roleDoc, branchDoc] = await Promise.all([
      SocietyRole.findById(employee.roleId).lean(),
      Branch.findById(employee.branchId).lean()
    ]);

    return this.formatEmployeeResponse(employee, roleDoc, branchDoc);
  }

  /**
   * Tab 6: Update KRA Settings
   */
  async updateKraSettings(bankId, employeeId, payload, updaterId) {
    const { employee } = await this.findEmployeeAndUser(bankId, employeeId);

    const kra = employee.kraSettings || {};
    if (payload.year) kra.year = Number(payload.year);
    if (Array.isArray(payload.targets)) kra.targets = payload.targets;

    employee.kraSettings = kra;
    employee.updatedBy = updaterId;
    await employee.save();

    const [roleDoc, branchDoc] = await Promise.all([
      SocietyRole.findById(employee.roleId).lean(),
      Branch.findById(employee.branchId).lean()
    ]);

    return this.formatEmployeeResponse(employee, roleDoc, branchDoc);
  }
  /**
   * Enforce constraint: Only 1 active Branch Manager allowed per branch
   */
  async validateSingleBranchManager(bankId, branchId, roleId, currentEmployeeId = null) {
    if (!branchId || !roleId) return;

    // Resolve Role Document
    const role = await SocietyRole.findOne({
      _id: roleId,
      bankId,
      isDeleted: { $ne: true }
    }).lean();

    if (!role) return;

    const roleCode = (role.code || '').toUpperCase();
    const roleName = (role.name || '').toUpperCase();
    const isBM =
      roleCode === 'BRANCH_MANAGER' ||
      roleName === 'BRANCH MANAGER' ||
      roleCode.includes('BRANCH_MANAGER') ||
      roleName.includes('BRANCH MANAGER');

    if (!isBM) return;

    // 1. Check if an active BranchManager profile document exists for target branch
    const existingManagerDoc = await BranchManager.findOne({
      branchId,
      status: 'ACTIVE',
      isDeleted: { $ne: true }
    }).lean();

    if (existingManagerDoc) {
      const isSameUser = currentEmployeeId && existingManagerDoc._id.toString() === currentEmployeeId.toString();
      if (!isSameUser) {
        throw ApiError.conflict('An active Branch Manager is already assigned to this branch. Only one Branch Manager is allowed per branch.');
      }
    }

    // 2. Check if another active SocietyEmployee profile has Branch Manager role for target branch
    const bmRoleIds = await SocietyRole.find({
      bankId,
      $or: [
        { code: new RegExp('BRANCH_MANAGER', 'i') },
        { name: new RegExp('Branch Manager', 'i') }
      ],
      isDeleted: { $ne: true }
    }).distinct('_id');

    const employeeQuery = {
      bankId,
      branchId,
      roleId: { $in: bmRoleIds },
      status: 'ACTIVE',
      isDeleted: { $ne: true }
    };

    if (currentEmployeeId) {
      employeeQuery._id = { $ne: currentEmployeeId };
    }

    const existingEmployeeBM = await SocietyEmployee.findOne(employeeQuery).lean();

    if (existingEmployeeBM) {
      throw ApiError.conflict('An active Branch Manager is already assigned to this branch. Only one Branch Manager is allowed per branch.');
    }
  }

  /**
   * Helper to keep SocietyEmployee and BranchManager profiles in sync for a given user
   */
  async syncManagerAndEmployeeProfiles(userId, bankId, branchId, updaterId, payload = {}) {
    const managerDoc = await BranchManager.findOne({ userId, includeDeleted: true });
    const employeeDoc = await SocietyEmployee.findOne({ userId, includeDeleted: true });

    if (!managerDoc && !employeeDoc) return;

    const src = managerDoc || employeeDoc;

    if (employeeDoc) {
      if (payload.fullName || src.fullName) employeeDoc.fullName = payload.fullName || src.fullName;
      if (payload.email || src.email) employeeDoc.email = payload.email || src.email;
      if (payload.phoneNumber || src.phoneNumber) employeeDoc.phoneNumber = payload.phoneNumber || src.phoneNumber;
      if (payload.designation || src.designation) employeeDoc.designation = payload.designation || src.designation;
      if (payload.employeeCode || src.employeeCode) employeeDoc.employeeCode = payload.employeeCode || src.employeeCode;
      if (payload.status || src.status) employeeDoc.status = payload.status || src.status;
      if (branchId) employeeDoc.branchId = branchId;
      if (bankId) employeeDoc.bankId = bankId;
      if (payload.personalDetails || src.personalDetails) {
        employeeDoc.personalDetails = { ...(employeeDoc.personalDetails?.toObject?.() || employeeDoc.personalDetails || {}), ...(src.personalDetails?.toObject?.() || src.personalDetails || {}), ...(payload.personalDetails || {}) };
      }
      if (payload.jobDetails || src.jobDetails) {
        employeeDoc.jobDetails = { ...(employeeDoc.jobDetails?.toObject?.() || employeeDoc.jobDetails || {}), ...(src.jobDetails?.toObject?.() || src.jobDetails || {}), ...(payload.jobDetails || {}) };
      }
      if (payload.shiftSettings || src.shiftSettings) {
        employeeDoc.shiftSettings = { ...(employeeDoc.shiftSettings?.toObject?.() || employeeDoc.shiftSettings || {}), ...(src.shiftSettings?.toObject?.() || src.shiftSettings || {}), ...(payload.shiftSettings || {}) };
      }
      if (payload.attendanceSettings || src.attendanceSettings) {
        employeeDoc.attendanceSettings = { ...(employeeDoc.attendanceSettings?.toObject?.() || employeeDoc.attendanceSettings || {}), ...(src.attendanceSettings?.toObject?.() || src.attendanceSettings || {}), ...(payload.attendanceSettings || {}) };
      }
      if (payload.woffHoffSettings || src.woffHoffSettings) {
        employeeDoc.woffHoffSettings = { ...(employeeDoc.woffHoffSettings?.toObject?.() || employeeDoc.woffHoffSettings || {}), ...(src.woffHoffSettings?.toObject?.() || src.woffHoffSettings || {}), ...(payload.woffHoffSettings || {}) };
      }
      if (payload.kraSettings || src.kraSettings) {
        employeeDoc.kraSettings = { ...(employeeDoc.kraSettings?.toObject?.() || employeeDoc.kraSettings || {}), ...(src.kraSettings?.toObject?.() || src.kraSettings || {}), ...(payload.kraSettings || {}) };
      }
      if (updaterId) employeeDoc.updatedBy = updaterId;
      await employeeDoc.save().catch(() => {});
    }

    if (managerDoc) {
      if (payload.fullName || src.fullName) managerDoc.fullName = payload.fullName || src.fullName;
      if (payload.email || src.email) managerDoc.email = payload.email || src.email;
      if (payload.phoneNumber || src.phoneNumber) managerDoc.phoneNumber = payload.phoneNumber || src.phoneNumber;
      if (payload.designation || src.designation) managerDoc.designation = payload.designation || src.designation;
      if (payload.employeeCode || src.employeeCode) managerDoc.employeeCode = payload.employeeCode || src.employeeCode;
      if (payload.status || src.status) managerDoc.status = payload.status || src.status;
      if (branchId) managerDoc.branchId = branchId;
      if (bankId) managerDoc.bankId = bankId;
      if (payload.personalDetails || src.personalDetails) {
        managerDoc.personalDetails = { ...(managerDoc.personalDetails?.toObject?.() || managerDoc.personalDetails || {}), ...(src.personalDetails?.toObject?.() || src.personalDetails || {}), ...(payload.personalDetails || {}) };
      }
      if (payload.jobDetails || src.jobDetails) {
        managerDoc.jobDetails = { ...(managerDoc.jobDetails?.toObject?.() || managerDoc.jobDetails || {}), ...(src.jobDetails?.toObject?.() || src.jobDetails || {}), ...(payload.jobDetails || {}) };
      }
      if (payload.shiftSettings || src.shiftSettings) {
        managerDoc.shiftSettings = { ...(managerDoc.shiftSettings?.toObject?.() || managerDoc.shiftSettings || {}), ...(src.shiftSettings?.toObject?.() || src.shiftSettings || {}), ...(payload.shiftSettings || {}) };
      }
      if (payload.attendanceSettings || src.attendanceSettings) {
        managerDoc.attendanceSettings = { ...(managerDoc.attendanceSettings?.toObject?.() || managerDoc.attendanceSettings || {}), ...(src.attendanceSettings?.toObject?.() || src.attendanceSettings || {}), ...(payload.attendanceSettings || {}) };
      }
      if (payload.woffHoffSettings || src.woffHoffSettings) {
        managerDoc.woffHoffSettings = { ...(managerDoc.woffHoffSettings?.toObject?.() || managerDoc.woffHoffSettings || {}), ...(src.woffHoffSettings?.toObject?.() || src.woffHoffSettings || {}), ...(payload.woffHoffSettings || {}) };
      }
      if (payload.kraSettings || src.kraSettings) {
        managerDoc.kraSettings = { ...(managerDoc.kraSettings?.toObject?.() || managerDoc.kraSettings || {}), ...(src.kraSettings?.toObject?.() || src.kraSettings || {}), ...(payload.kraSettings || {}) };
      }
      if (updaterId) managerDoc.updatedBy = updaterId;
      await managerDoc.save().catch(() => {});
    }
  }

  /**
   * Get Employee Location (Coordinates: Latitude & Longitude) by Employee ID / User ID
   */
  async getEmployeeLocation(bankId, employeeId) {
    let employeeData = null;
    try {
      employeeData = await this.getEmployeeById(bankId, employeeId);
    } catch (err) {
      // Fallback for direct User ID or Super Admin queries without a SocietyEmployee profile
    }

    let userId = employeeData?.userId || null;
    let address = employeeData?.officeAddress || '';

    if (!userId && mongoose.Types.ObjectId.isValid(employeeId)) {
      userId = employeeId;
    }

    const user = userId
      ? await User.findById(userId).select('location email phoneNumber fullName address').lean()
      : null;

    if (!user && !employeeData) {
      throw ApiError.notFound('Employee location profile not found.');
    }

    const coordinates = user?.location?.coordinates || [0, 0];
    const longitude = Number(coordinates[0] || 0);
    const latitude = Number(coordinates[1] || 0);
    address = user?.location?.address || address || user?.address || '';
    const lastUpdatedAt = user?.location?.lastUpdatedAt || null;

    return {
      latitude,
      longitude,
      coordinates: [longitude, latitude],
      address,
      lastUpdatedAt
    };
  }

  /**
   * Get List of Employees Locations (Coordinates: Latitude & Longitude)
   */
  async getEmployeesLocations(bankId, queryOptions = {}, branchIdFilter = null, isBankOwner = false, isBranchManager = false) {
    const employeeListing = await this.listEmployees(bankId, queryOptions, branchIdFilter, isBankOwner, isBranchManager);

    const userIds = employeeListing.items.map((item) => item.userId).filter(Boolean);
    const users = await User.find({ _id: { $in: userIds } }).select('_id location').lean();
    const userLocationMap = new Map(users.map((u) => [u._id.toString(), u.location]));

    const itemsWithLocation = employeeListing.items.map((item) => {
      const uLoc = userLocationMap.get(item.userId?.toString());
      const coordinates = uLoc?.coordinates || [0, 0];
      const longitude = Number(coordinates[0] || 0);
      const latitude = Number(coordinates[1] || 0);
      const address = uLoc?.address || item.officeAddress || '';
      const lastUpdatedAt = uLoc?.lastUpdatedAt || null;

      return {
        ...item,
        location: {
          latitude,
          longitude,
          coordinates: [longitude, latitude],
          address,
          lastUpdatedAt
        }
      };
    });

    return {
      items: itemsWithLocation,
      meta: employeeListing.meta,
      ...(employeeListing.stats ? { stats: employeeListing.stats } : {})
    };
  }
}

export const societyEmployeeService = new SocietyEmployeeService();

