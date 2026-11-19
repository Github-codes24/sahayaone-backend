import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Branch } from '../../../../models/branch.model.js';
import { BranchManager } from '../../../../models/branch-manager.model.js';
import { SocietyEmployee } from '../../../../models/society-employee.model.js';
import { MerchantProfile } from '../../../../models/merchant-profile.model.js';
import { User } from '../../../../models/user.model.js';
import { Bank } from '../../../../models/bank.model.js';
import { CardCreditTransfer } from '../../../../models/card-credit-transfer.model.js';
import { CreditLog } from '../../../../models/credit-log.model.js';
import { SocietyRole } from '../../../../models/society-role.model.js';
import { societyRoleService } from '../../roles/services/society-role.service.js';
import { UserRole, UserType } from '../../../../constants/user-role.constant.js';
import { getDefaultKraTargetsForRole } from '../../../../constants/kpa-matrix.constant.js';
import { ApiError } from '../../../../common/api.error.js';

export class BranchService {
  /**
   * Helper to format full BranchManager object including all 6 HR sections
   */
  formatBranchManagerResponse(manager) {
    if (!manager) return null;

    const personal = manager.personalDetails || {};
    const job = manager.jobDetails || {};
    const shift = manager.shiftSettings || {};
    const attendance = manager.attendanceSettings || {};
    const woffHoff = manager.woffHoffSettings || {};
    const kra = manager.kraSettings || {};

    return {
      id: manager._id,
      userId: manager.userId,
      bankId: manager.bankId,
      branchId: manager.branchId,
      employeeCode: manager.employeeCode || '',
      fullName: manager.fullName || personal.fullName || '',
      email: manager.email || personal.email || '',
      phoneNumber: manager.phoneNumber || personal.phoneNumber || '',
      roleId: manager.roleId || job.roleId || null,
      role: {
        id: manager.roleId || job.roleId || null,
        name: 'Branch Manager',
        code: 'MANAGER'
      },
      designation: manager.designation || job.designation || 'Branch Manager',

      personalDetails: {
        profileImage: personal.profileImage || null,
        profileImageKey: personal.profileImageKey || null,
        fullName: personal.fullName || manager.fullName || '',
        gender: personal.gender || 'MALE',
        dateOfBirth: personal.dateOfBirth || null,
        phoneNumber: personal.phoneNumber || manager.phoneNumber || '',
        email: personal.email || manager.email || '',
        address: personal.address || ''
      },
      jobDetails: {
        designation: job.designation || manager.designation || 'BRANCH_MANAGER',
        state: job.state || '',
        salary: job.salary !== undefined ? job.salary : 0,
        joiningDate: job.joiningDate || manager.createdAt || null,
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
        fullDayMinutes: shift.fullDayMinutes !== undefined ? shift.fullDayMinutes : 480
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
      status: manager.status || 'ACTIVE',
      createdAt: manager.createdAt,
      updatedAt: manager.updatedAt
    };
  }

  /**
   * Helper to format Branch + Manager payload output matching design specifications
   */
  formatBranchResponse(branch, manager = null) {
    const mgr = manager || branch.branchManagerId || null;
    const formattedManager = mgr && typeof mgr === 'object' && mgr._id ? this.formatBranchManagerResponse(mgr) : null;

    return {
      id: branch._id,
      branchId: branch._id,
      bankId: branch.bankId,
      name: branch.name,
      branchName: branch.name,
      code: branch.code,
      email: branch.email || '',
      phoneNumber: branch.phoneNumber || '',
      state: branch.state || branch.address?.state || '',
      address: branch.address || {},
      cardStock: branch.cardStock || 0,
      emiCardAvailable: branch.cardStock || 0,
      verificationCredits: branch.verificationCredits || 0,
      verificationCredit: branch.verificationCredits || 0,
      status: branch.status,
      branchManager: formattedManager
        ? {
            id: formattedManager.id,
            managerId: formattedManager.id,
            fullName: formattedManager.fullName,
            name: formattedManager.fullName,
            email: formattedManager.email,
            phoneNumber: formattedManager.phoneNumber,
            employeeCode: formattedManager.employeeCode,
            designation: formattedManager.designation,
            status: formattedManager.status
          }
        : null,
      fullBranchManagerDetails: formattedManager,
      createdAt: branch.createdAt,
      updatedAt: branch.updatedAt
    };
  }

  /**
   * Create a new Branch and Branch Manager atomically inside a Mongoose Session Transaction
   */
  async createBranchAndManager(bankId, payload, creatorId) {
    if (!bankId) {
      throw ApiError.badRequest('Bank identification is required for branch creation.');
    }

    // Extract nested or flat payload structures
    const branchData = payload.branch || {
      name: payload.name,
      code: payload.code,
      email: payload.email,
      phoneNumber: payload.phoneNumber,
      state: payload.state,
      address: payload.address,
      cardStock: payload.cardStock,
      verificationCredits: payload.verificationCredits
    };

    const managerData = payload.manager || {
      fullName: payload.managerName,
      email: payload.managerEmail,
      phoneNumber: payload.managerPhone,
      password: payload.managerPassword,
      employeeCode: payload.employeeCode
    };

    // Extract personal details values with fallback support
    const personalDetailsData = managerData.personalDetails || {};
    const jobDetailsData = managerData.jobDetails || {};
    const shiftSettingsData = managerData.shiftSettings || {};
    const attendanceSettingsData = managerData.attendanceSettings || {};
    const woffHoffSettingsData = managerData.woffHoffSettings || {};
    let kraSettingsData = managerData.kraSettings || {};
    if (!Array.isArray(kraSettingsData.targets) || kraSettingsData.targets.length === 0) {
      kraSettingsData = {
        year: kraSettingsData.year || new Date().getFullYear(),
        targets: getDefaultKraTargetsForRole('MANAGER')
      };
    }

    const name = (branchData.name || '').trim();
    const code = (branchData.code || '').trim().toUpperCase();

    const managerName = (personalDetailsData.fullName || managerData.fullName || '').trim();
    const managerEmail = (personalDetailsData.email || managerData.email || '').trim().toLowerCase();
    const managerPhone = (personalDetailsData.phoneNumber || managerData.phoneNumber || '').trim();
    const managerPassword = (personalDetailsData.password || managerData.password || '').trim();

    if (!name || !code) {
      throw ApiError.badRequest('Branch name and branch code are required.');
    }
    if (!managerName || !managerEmail || !managerPhone || !managerPassword) {
      throw ApiError.badRequest('Branch manager full name, email, phone number, and password are required.');
    }

    // Extract allocated cards & credits from payload
    const allocatedEmiCards = Math.max(
      0,
      Number(
        branchData.cardStock ??
          branchData.emiQuantity ??
          branchData.emiCardQuantity ??
          payload.cardStock ??
          payload.emiQuantity ??
          payload.emiCardQuantity ??
          0
      )
    );

    const allocatedVerificationCredits = Math.max(
      0,
      Number(
        branchData.verificationCredits ??
          branchData.verificationQuantity ??
          branchData.verificationCreditQuantity ??
          payload.verificationCredits ??
          payload.verificationQuantity ??
          payload.verificationCreditQuantity ??
          0
      )
    );

    // Verify Bank exists and has enough stock available
    const bank = await Bank.findOne({ _id: bankId, isDeleted: { $ne: true } });
    if (!bank) {
      throw ApiError.notFound('Bank record not found.');
    }

    if (allocatedEmiCards > 0 && (bank.availableEmiCards || 0) < allocatedEmiCards) {
      throw ApiError.badRequest(
        `Insufficient available EMI Cards at Bank level. Requested: ${allocatedEmiCards}, Available: ${bank.availableEmiCards || 0}`
      );
    }

    if (allocatedVerificationCredits > 0 && (bank.availableVerificationCredits || 0) < allocatedVerificationCredits) {
      throw ApiError.badRequest(
        `Insufficient available Verification Credits at Bank level. Requested: ${allocatedVerificationCredits}, Available: ${bank.availableVerificationCredits || 0}`
      );
    }

    // Check duplicate branch code within the bank
    const existingCode = await Branch.findOne({
      bankId,
      code,
      isDeleted: { $ne: true }
    });
    if (existingCode) {
      throw ApiError.conflict(`Branch code [${code}] is already in use for this bank.`);
    }

    // Check duplicate email / phone in User identity collection
    const existingUserEmail = await User.findOne({ email: managerEmail, isDeleted: { $ne: true } });
    if (existingUserEmail) {
      throw ApiError.conflict(`User with email [${managerEmail}] already exists.`);
    }

    const existingUserPhone = await User.findOne({ phoneNumber: managerPhone, isDeleted: { $ne: true } });
    if (existingUserPhone) {
      throw ApiError.conflict(`User with phone number [${managerPhone}] already exists.`);
    }

    // Attempt Mongoose Transaction Session (supported on ReplicaSet / Sharded cluster)
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

      // 0. Deduct allocated stock & credits from Bank
      if (allocatedEmiCards > 0 || allocatedVerificationCredits > 0) {
        bank.availableEmiCards = Math.max(0, (bank.availableEmiCards || 0) - allocatedEmiCards);
        bank.availableVerificationCredits = Math.max(0, (bank.availableVerificationCredits || 0) - allocatedVerificationCredits);
        await bank.save(sessionOpts);
      }

      // 1. Create Branch instance
      const [branch] = await Branch.create(
        [
          {
            bankId,
            name,
            code,
            email: branchData.email || managerEmail,
            phoneNumber: branchData.phoneNumber || managerPhone,
            state: branchData.state || branchData.address?.state || jobDetailsData.state || '',
            address: branchData.address || {},
            cardStock: allocatedEmiCards,
            totalEmiCards: allocatedEmiCards,
            availableEmiCards: allocatedEmiCards,
            verificationCredits: allocatedVerificationCredits,
            totalVerificationCredits: allocatedVerificationCredits,
            availableVerificationCredits: allocatedVerificationCredits,
            status: 'ACTIVE',
            createdBy: creatorId
          }
        ],
        sessionOpts
      );

      // Audit credit transfer and logs
      if (allocatedEmiCards > 0 || allocatedVerificationCredits > 0) {
        await CardCreditTransfer.create(
          [
            {
              bankId: bank._id,
              branchId: branch._id,
              emiQuantity: allocatedEmiCards,
              verificationQuantity: allocatedVerificationCredits,
              balanceBefore: { availableEmiCards: 0, availableVerificationCredits: 0 },
              balanceAfter: { availableEmiCards: allocatedEmiCards, availableVerificationCredits: allocatedVerificationCredits },
              remarks: 'Initial stock allocation during branch creation',
              createdBy: creatorId
            }
          ],
          sessionOpts
        );

        if (allocatedEmiCards > 0) {
          await CreditLog.create(
            [
              {
                bankId: bank._id,
                branchId: branch._id,
                type: 'EMI_CARD',
                action: 'ALLOCATION',
                amount: allocatedEmiCards,
                employeeId: creatorId,
                description: `Allocated ${allocatedEmiCards} EMI Cards during branch creation [${branch.name}]`
              }
            ],
            sessionOpts
          );
        }

        if (allocatedVerificationCredits > 0) {
          await CreditLog.create(
            [
              {
                bankId: bank._id,
                branchId: branch._id,
                type: 'VERIFICATION_CREDIT',
                action: 'ALLOCATION',
                amount: allocatedVerificationCredits,
                employeeId: creatorId,
                description: `Allocated ${allocatedVerificationCredits} Verification Credits during branch creation [${branch.name}]`
              }
            ],
            sessionOpts
          );
        }
      }

      // 2. Hash Manager Password
      const passwordHash = await bcrypt.hash(managerPassword, 10);

      // 3. Create Manager User Identity
      const [user] = await User.create(
        [
          {
            email: managerEmail,
            phoneNumber: managerPhone,
            passwordHash,
            fullName: managerName,
            role: UserRole.BRANCH_MANAGER,
            userType: UserType.EMPLOYEE,
            status: 'ACTIVE',
            createdBy: creatorId
          }
        ],
        sessionOpts
      );

      // 4. Build complete BranchManager profile with subdocuments
      const finalPersonalDetails = {
        fullName: managerName,
        email: managerEmail,
        phoneNumber: managerPhone,
        gender: personalDetailsData.gender || 'MALE',
        dateOfBirth: personalDetailsData.dateOfBirth || null,
        address: personalDetailsData.address || '',
        profileImage: personalDetailsData.profileImage || null,
        profileImageKey: personalDetailsData.profileImageKey || null
      };

      // 3.5. Ensure and resolve predefined MANAGER role for Bank
      await societyRoleService.ensurePredefinedRolesForBank(bankId);
      const managerRoleDoc = await SocietyRole.findOne({
        bankId,
        code: 'MANAGER',
        isDeleted: { $ne: true }
      }).lean();

      const managerRoleId = managerRoleDoc?._id || jobDetailsData.roleId || null;

      const finalJobDetails = {
        roleId: managerRoleId,
        designation: jobDetailsData.designation || managerData.designation || 'Branch Manager',
        state: jobDetailsData.state || branchData.state || '',
        salary: jobDetailsData.salary || 0,
        joiningDate: jobDetailsData.joiningDate || new Date(),
        probationPeriodMonths: jobDetailsData.probationPeriodMonths || 0
      };

      const [branchManager] = await BranchManager.create(
        [
          {
            userId: user._id,
            bankId,
            branchId: branch._id,
            roleId: managerRoleId,
            employeeCode: managerData.employeeCode || `BM-${code}`,
            fullName: managerName,
            email: managerEmail,
            phoneNumber: managerPhone,
            designation: finalJobDetails.designation,
            personalDetails: finalPersonalDetails,
            jobDetails: finalJobDetails,
            shiftSettings: shiftSettingsData,
            attendanceSettings: attendanceSettingsData,
            woffHoffSettings: woffHoffSettingsData,
            kraSettings: kraSettingsData,
            status: 'ACTIVE',
            createdBy: creatorId
          }
        ],
        sessionOpts
      );


      // 4.5. Also create corresponding SocietyEmployee document so manager is present in both collections
      let existingEmp = await SocietyEmployee.findOne({ userId: user._id, includeDeleted: true }).session(session || null);
      if (existingEmp) {
        existingEmp.bankId = bankId;
        existingEmp.branchId = branch._id;
        existingEmp.roleId = managerRoleId;
        existingEmp.employeeCode = managerData.employeeCode || `BM-${code}`;
        existingEmp.fullName = managerName;
        existingEmp.email = managerEmail;
        existingEmp.phoneNumber = managerPhone;
        existingEmp.designation = finalJobDetails.designation;
        existingEmp.personalDetails = finalPersonalDetails;
        existingEmp.jobDetails = finalJobDetails;
        existingEmp.shiftSettings = shiftSettingsData;
        existingEmp.attendanceSettings = attendanceSettingsData;
        existingEmp.woffHoffSettings = woffHoffSettingsData;
        existingEmp.kraSettings = kraSettingsData;
        existingEmp.status = 'ACTIVE';
        existingEmp.isDeleted = false;
        existingEmp.deletedAt = null;
        existingEmp.deletedBy = null;
        existingEmp.updatedBy = creatorId;
        await existingEmp.save(sessionOpts);
      } else {
        await SocietyEmployee.create(
          [
            {
              userId: user._id,
              bankId,
              branchId: branch._id,
              roleId: managerRoleId,
              employeeCode: managerData.employeeCode || `BM-${code}`,
              fullName: managerName,
              email: managerEmail,
              phoneNumber: managerPhone,
              designation: finalJobDetails.designation,
              personalDetails: finalPersonalDetails,
              jobDetails: finalJobDetails,
              shiftSettings: shiftSettingsData,
              attendanceSettings: attendanceSettingsData,
              woffHoffSettings: woffHoffSettingsData,
              kraSettings: kraSettingsData,
              status: 'ACTIVE',
              createdBy: creatorId
            }
          ],
          sessionOpts
        );
      }

      // 5. Connect User -> Profile and Branch -> Manager
      user.profileId = branchManager._id;
      user.profileModel = 'BranchManager';
      await user.save(sessionOpts);

      branch.branchManagerId = branchManager._id;
      await branch.save(sessionOpts);

      if (session) {
        await session.commitTransaction();
        transactionCommitted = true;
      }

      return this.formatBranchResponse(branch, branchManager);
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
   * List Branches belonging exclusively to the authenticated Bank ID
   */
  async listBranches(bankId, queryOptions = {}, branchIdFilter = null) {
    if (!bankId) {
      throw ApiError.badRequest('Bank context is required.');
    }

    const page = parseInt(queryOptions.page || '1', 10);
    const limit = parseInt(queryOptions.limit || '10', 10);
    const search = (queryOptions.search || '').trim();
    const status = queryOptions.status && queryOptions.status !== 'ALL' ? queryOptions.status.toUpperCase() : null;
    const stateFilter = (queryOptions.state || '').trim();
    const cityFilter = (queryOptions.city || '').trim();
    const skip = (page - 1) * limit;

    const filter = {
      bankId,
      isDeleted: { $ne: true }
    };

    if (branchIdFilter) {
      filter._id = branchIdFilter;
    }

    if (status) {
      filter.status = status;
    }

    const andConditions = [];

    if (cityFilter) {
      const cityRegex = new RegExp(cityFilter, 'i');
      andConditions.push({
        $or: [{ city: cityRegex }, { 'address.city': cityRegex }]
      });
    }

    if (stateFilter) {
      const stateRegex = new RegExp(stateFilter, 'i');
      andConditions.push({
        $or: [{ state: stateRegex }, { 'address.state': stateRegex }]
      });
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      andConditions.push({
        $or: [
          { name: searchRegex },
          { code: searchRegex },
          { email: searchRegex },
          { phoneNumber: searchRegex },
          { state: searchRegex },
          { city: searchRegex },
          { 'address.city': searchRegex },
          { 'address.state': searchRegex }
        ]
      });
    }

    if (andConditions.length > 0) {
      filter.$and = andConditions;
    }

    const sortField = queryOptions.sortBy || 'createdAt';
    const sortOrder = (queryOptions.sortOrder || 'desc').toLowerCase() === 'asc' ? 1 : -1;

    const [branches, totalRecords, stockAgg, totalEmps, totalMerchants] = await Promise.all([
      Branch.find(filter)
        .populate('branchManagerId')
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      Branch.countDocuments(filter),
      Branch.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            availableCardStock: { $sum: { $ifNull: ["$availableEmiCards", "$cardStock"] } },
            availableVerificationCredits: { $sum: { $ifNull: ["$availableVerificationCredits", "$verificationCredits"] } }
          }
        }
      ]).catch(() => []),
      SocietyEmployee.countDocuments({ bankId, isDeleted: { $ne: true } }).catch(() => 0),
      MerchantProfile.countDocuments({ bankId, isDeleted: { $ne: true } }).catch(() => 0)
    ]);

    const availableCardStock = stockAgg[0]?.availableCardStock || 0;
    const availableVerificationCredits = stockAgg[0]?.availableVerificationCredits || 0;

    const stats = {
      totalBranches: totalRecords,
      availableCardStock,
      availableVerificationCredits,
      totalEmployees: totalEmps,
      totalMerchants
    };

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    const items = branches.map((b, idx) => ({
      srNo: skip + idx + 1,
      ...this.formatBranchResponse(b, b.branchManagerId)
    }));

    return {
      stats,
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
   * List active branches for dropdown selections returning branch ID and branch name
   */
  async listBranchesDropdown(societyContext) {
    const bankId = societyContext?.bankId;
    if (!bankId && societyContext?.role !== UserRole.SUPER_ADMIN) {
      throw ApiError.forbidden('A valid society bank context is required.');
    }

    const filter = { isDeleted: { $ne: true }, status: 'ACTIVE' };
    if (bankId) {
      filter.bankId = bankId;
    }
    if (societyContext?.branchId) {
      filter._id = societyContext.branchId;
    }

    const branches = await Branch.find(filter)
      .select('_id name code state city address')
      .sort({ name: 1 })
      .lean();

    return branches.map((b) => ({
      id: b._id,
      branchId: b._id,
      branchName: b.name,
      name: b.name,
      code: b.code || '',
      state: b.state || b.address?.state || '',
      city: b.city || b.address?.city || ''
    }));
  }

  /**
   * Get dropdown list of available cities and states from active branches
   */
  async getAvailableCitiesAndStates(societyContext) {
    const bankId = societyContext?.bankId;
    if (!bankId && societyContext?.role !== UserRole.SUPER_ADMIN) {
      throw ApiError.forbidden('A valid society bank context is required.');
    }

    const filter = { isDeleted: { $ne: true }, status: 'ACTIVE' };
    if (bankId) {
      filter.bankId = bankId;
    }
    if (societyContext?.branchId) {
      filter._id = societyContext.branchId;
    }

    const branches = await Branch.find(filter)
      .select('state city address.state address.city')
      .lean();

    const statesSet = new Set();
    const citiesSet = new Set();
    const stateCitiesMap = new Map();

    branches.forEach((b) => {
      const state = (b.state || b.address?.state || '').trim();
      const city = (b.city || b.address?.city || '').trim();

      if (state) {
        statesSet.add(state);
        if (!stateCitiesMap.has(state)) {
          stateCitiesMap.set(state, new Set());
        }
        if (city) {
          stateCitiesMap.get(state).add(city);
        }
      }

      if (city) {
        citiesSet.add(city);
      }
    });

    const states = Array.from(statesSet).sort((a, b) => a.localeCompare(b));
    const cities = Array.from(citiesSet).sort((a, b) => a.localeCompare(b));
    const locations = Array.from(stateCitiesMap.entries()).map(([st, cSet]) => ({
      state: st,
      cities: Array.from(cSet).sort((a, b) => a.localeCompare(b))
    })).sort((a, b) => a.state.localeCompare(b.state));

    return {
      states,
      cities,
      locations
    };
  }

  /**
   * Get single Branch details by ID (Tenant-Scoped)
   */
  async getBranchById(bankId, branchId) {
    const branch = await Branch.findOne({
      _id: branchId,
      bankId,
      isDeleted: { $ne: true }
    })
      .populate('branchManagerId')
      .lean();

    if (!branch) {
      throw ApiError.notFound('Branch not found or does not belong to your bank.');
    }

    return this.formatBranchResponse(branch, branch.branchManagerId);
  }

  /**
   * Update Branch details (Tenant-Scoped)
   */
  async updateBranch(bankId, branchId, payload, updaterId) {
    const branch = await Branch.findOne({
      _id: branchId,
      bankId,
      isDeleted: { $ne: true }
    });

    if (!branch) {
      throw ApiError.notFound('Branch not found or does not belong to your bank.');
    }

    const bank = await Bank.findOne({ _id: bankId, isDeleted: { $ne: true } });
    if (!bank) {
      throw ApiError.notFound('Bank record not found.');
    }

    if (payload.name) branch.name = payload.name.trim();

    if (payload.code) {
      const code = payload.code.trim().toUpperCase();
      if (code !== branch.code) {
        const existingCode = await Branch.findOne({
          bankId,
          code,
          _id: { $ne: branchId },
          isDeleted: { $ne: true }
        });
        if (existingCode) {
          throw ApiError.conflict(`Branch code [${code}] is already in use by another branch.`);
        }
        branch.code = code;
      }
    }

    if (payload.email) branch.email = payload.email.trim().toLowerCase();
    if (payload.phoneNumber) branch.phoneNumber = payload.phoneNumber.trim();
    if (payload.state) branch.state = payload.state.trim();
    if (payload.address) branch.address = { ...branch.address, ...payload.address };

    if (payload.cardStock !== undefined) {
      const newCardStock = Math.max(0, parseInt(payload.cardStock, 10) || 0);
      const oldCardStock = branch.cardStock || 0;
      const diffCards = newCardStock - oldCardStock;

      if (diffCards > 0) {
        if ((bank.availableEmiCards || 0) < diffCards) {
          throw ApiError.badRequest(
            `Insufficient available EMI Cards at Bank level. Requested additional: ${diffCards}, Available: ${bank.availableEmiCards || 0}`
          );
        }
        bank.availableEmiCards = (bank.availableEmiCards || 0) - diffCards;
      } else if (diffCards < 0) {
        bank.availableEmiCards = (bank.availableEmiCards || 0) + Math.abs(diffCards);
      }

      branch.cardStock = newCardStock;
      branch.availableEmiCards = Math.max(0, (branch.availableEmiCards || 0) + diffCards);
      branch.totalEmiCards = Math.max(0, (branch.totalEmiCards || 0) + diffCards);
    }

    if (payload.verificationCredits !== undefined) {
      const newCredits = Math.max(0, parseInt(payload.verificationCredits, 10) || 0);
      const oldCredits = branch.verificationCredits || 0;
      const diffCredits = newCredits - oldCredits;

      if (diffCredits > 0) {
        if ((bank.availableVerificationCredits || 0) < diffCredits) {
          throw ApiError.badRequest(
            `Insufficient available Verification Credits at Bank level. Requested additional: ${diffCredits}, Available: ${bank.availableVerificationCredits || 0}`
          );
        }
        bank.availableVerificationCredits = (bank.availableVerificationCredits || 0) - diffCredits;
      } else if (diffCredits < 0) {
        bank.availableVerificationCredits = (bank.availableVerificationCredits || 0) + Math.abs(diffCredits);
      }

      branch.verificationCredits = newCredits;
      branch.availableVerificationCredits = Math.max(0, (branch.availableVerificationCredits || 0) + diffCredits);
      branch.totalVerificationCredits = Math.max(0, (branch.totalVerificationCredits || 0) + diffCredits);
    }

    if (payload.status) branch.status = payload.status.toUpperCase();

    await bank.save();
    branch.updatedBy = updaterId;
    await branch.save();

    const manager = await BranchManager.findById(branch.branchManagerId).lean();
    return this.formatBranchResponse(branch, manager);
  }

  /**
   * Helper to locate BranchManager and associated User identity cleanly
   */
  async findBranchManagerAndUser(bankId, branchId) {
    const branch = await Branch.findOne({
      _id: branchId,
      bankId,
      isDeleted: { $ne: true }
    });

    if (!branch || !branch.branchManagerId) {
      throw ApiError.notFound('Branch or associated branch manager not found.');
    }

    const manager = await BranchManager.findOne({
      _id: branch.branchManagerId,
      bankId,
      isDeleted: { $ne: true }
    });

    if (!manager) {
      throw ApiError.notFound('Branch Manager profile not found.');
    }

    const user = await User.findById(manager.userId);
    if (!user) {
      throw ApiError.notFound('Branch Manager user credentials record not found.');
    }

    return { branch, manager, user };
  }

  /**
   * Get Branch Manager details for a branch (returns all 6 HR tabs)
   */
  async getBranchManager(bankId, branchId) {
    const { manager } = await this.findBranchManagerAndUser(bankId, branchId);
    return this.formatBranchManagerResponse(manager);
  }

  /**
   * Update complete Branch Manager profile or multi-section payload
   */
  async updateBranchManager(bankId, branchId, payload, updaterId) {
    const { branch, manager, user } = await this.findBranchManagerAndUser(bankId, branchId);

    // Root fields or personal details
    if (payload.fullName || payload.personalDetails?.fullName) {
      const fullName = (payload.fullName || payload.personalDetails?.fullName).trim();
      manager.fullName = fullName;
      manager.personalDetails.fullName = fullName;
      user.fullName = fullName;
    }

    if (payload.email || payload.personalDetails?.email) {
      const email = (payload.email || payload.personalDetails?.email).trim().toLowerCase();
      if (email !== manager.email) {
        const existing = await User.findOne({ email, _id: { $ne: user._id }, isDeleted: { $ne: true } });
        if (existing) {
          throw ApiError.conflict(`Email address [${email}] is already in use.`);
        }
        manager.email = email;
        manager.personalDetails.email = email;
        user.email = email;
      }
    }

    if (payload.phoneNumber || payload.personalDetails?.phoneNumber) {
      const phone = (payload.phoneNumber || payload.personalDetails?.phoneNumber).trim();
      if (phone !== manager.phoneNumber) {
        const existing = await User.findOne({ phoneNumber: phone, _id: { $ne: user._id }, isDeleted: { $ne: true } });
        if (existing) {
          throw ApiError.conflict(`Phone number [${phone}] is already in use.`);
        }
        manager.phoneNumber = phone;
        manager.personalDetails.phoneNumber = phone;
        user.phoneNumber = phone;
      }
    }

    if (payload.password && payload.password.trim().length >= 6) {
      user.passwordHash = await bcrypt.hash(payload.password.trim(), 10);
    }

    if (payload.employeeCode) manager.employeeCode = payload.employeeCode.trim();
    if (payload.status) {
      const status = payload.status.toUpperCase();
      manager.status = status;
      user.status = status;
    }

    // Merge nested HR sections if passed
    if (payload.personalDetails) {
      manager.personalDetails = { ...manager.personalDetails.toObject(), ...payload.personalDetails };
    }
    if (payload.jobDetails) {
      manager.jobDetails = { ...manager.jobDetails.toObject(), ...payload.jobDetails };
      if (payload.jobDetails.designation) {
        manager.designation = payload.jobDetails.designation;
      }
    }
    if (payload.shiftSettings) {
      manager.shiftSettings = { ...manager.shiftSettings.toObject(), ...payload.shiftSettings };
    }
    if (payload.attendanceSettings) {
      manager.attendanceSettings = { ...manager.attendanceSettings.toObject(), ...payload.attendanceSettings };
    }
    if (payload.woffHoffSettings) {
      manager.woffHoffSettings = { ...manager.woffHoffSettings.toObject(), ...payload.woffHoffSettings };
    }
    if (payload.kraSettings) {
      manager.kraSettings = { ...manager.kraSettings.toObject(), ...payload.kraSettings };
    }

    manager.updatedBy = updaterId;
    user.updatedBy = updaterId;

    await Promise.all([manager.save(), user.save()]);

    const empDoc = await SocietyEmployee.findOne({ userId: user._id, includeDeleted: true });
    if (empDoc) {
      empDoc.fullName = manager.fullName;
      empDoc.email = manager.email;
      empDoc.phoneNumber = manager.phoneNumber;
      empDoc.designation = manager.designation;
      empDoc.employeeCode = manager.employeeCode;
      empDoc.status = manager.status;
      empDoc.personalDetails = manager.personalDetails;
      empDoc.jobDetails = manager.jobDetails;
      empDoc.shiftSettings = manager.shiftSettings;
      empDoc.attendanceSettings = manager.attendanceSettings;
      empDoc.woffHoffSettings = manager.woffHoffSettings;
      empDoc.kraSettings = manager.kraSettings;
      empDoc.updatedBy = updaterId;
      await empDoc.save().catch(() => {});
    }

    return this.formatBranchResponse(branch, manager);
  }

  /**
   * Section 1: Update Personal Details Tab
   */
  async updatePersonalDetails(bankId, branchId, payload, updaterId) {
    const { manager, user } = await this.findBranchManagerAndUser(bankId, branchId);

    if (payload.fullName) {
      const fullName = payload.fullName.trim();
      manager.fullName = fullName;
      user.fullName = fullName;
      manager.personalDetails.fullName = fullName;
    }

    if (payload.email) {
      const email = payload.email.trim().toLowerCase();
      if (email !== manager.email) {
        const existing = await User.findOne({ email, _id: { $ne: user._id }, isDeleted: { $ne: true } });
        if (existing) {
          throw ApiError.conflict(`Email address [${email}] is already in use.`);
        }
        manager.email = email;
        user.email = email;
        manager.personalDetails.email = email;
      }
    }

    if (payload.phoneNumber) {
      const phone = payload.phoneNumber.trim();
      if (phone !== manager.phoneNumber) {
        const existing = await User.findOne({ phoneNumber: phone, _id: { $ne: user._id }, isDeleted: { $ne: true } });
        if (existing) {
          throw ApiError.conflict(`Phone number [${phone}] is already in use.`);
        }
        manager.phoneNumber = phone;
        user.phoneNumber = phone;
        manager.personalDetails.phoneNumber = phone;
      }
    }

    if (payload.password && payload.password.trim().length >= 6) {
      user.passwordHash = await bcrypt.hash(payload.password.trim(), 10);
    }

    if (payload.gender) manager.personalDetails.gender = payload.gender;
    if (payload.dateOfBirth) manager.personalDetails.dateOfBirth = new Date(payload.dateOfBirth);
    if (payload.address !== undefined) manager.personalDetails.address = payload.address.trim();
    if (payload.profileImage !== undefined) manager.personalDetails.profileImage = payload.profileImage;
    if (payload.profileImageKey !== undefined) manager.personalDetails.profileImageKey = payload.profileImageKey;

    manager.updatedBy = updaterId;
    user.updatedBy = updaterId;

    await Promise.all([manager.save(), user.save()]);

    return this.formatBranchManagerResponse(manager);
  }

  /**
   * Section 2: Update Job Details Tab
   */
  async updateJobDetails(bankId, branchId, payload, updaterId) {
    const { manager } = await this.findBranchManagerAndUser(bankId, branchId);

    if (payload.designation) {
      const desig = payload.designation.trim();
      manager.designation = desig;
      manager.jobDetails.designation = desig;
    }
    if (payload.state !== undefined) manager.jobDetails.state = payload.state.trim();
    if (payload.salary !== undefined) manager.jobDetails.salary = Number(payload.salary);
    if (payload.joiningDate) manager.jobDetails.joiningDate = new Date(payload.joiningDate);
    if (payload.probationPeriodMonths !== undefined)
      manager.jobDetails.probationPeriodMonths = Number(payload.probationPeriodMonths);

    manager.updatedBy = updaterId;
    await manager.save();

    return this.formatBranchManagerResponse(manager);
  }

  /**
   * Section 3: Update Shift & Weekly Off Settings Tab
   */
  async updateShiftSettings(bankId, branchId, payload, updaterId) {
    const { manager } = await this.findBranchManagerAndUser(bankId, branchId);

    const shift = manager.shiftSettings || {};
    if (payload.punchInTime) shift.punchInTime = payload.punchInTime;
    if (payload.punchOutTime) shift.punchOutTime = payload.punchOutTime;

    if (payload.weeklyOff) {
      shift.weeklyOff = {
        ...shift.weeklyOff?.toObject(),
        ...payload.weeklyOff
      };
    }

    if (payload.lateAllowedMinutes !== undefined) shift.lateAllowedMinutes = Number(payload.lateAllowedMinutes);
    if (payload.lateAllowedAsPerShift !== undefined) shift.lateAllowedAsPerShift = Boolean(payload.lateAllowedAsPerShift);
    if (payload.earlyAllowedMinutes !== undefined) shift.earlyAllowedMinutes = Number(payload.earlyAllowedMinutes);
    if (payload.earlyAllowedAsPerShift !== undefined) shift.earlyAllowedAsPerShift = Boolean(payload.earlyAllowedAsPerShift);
    if (payload.halfDayMinutes !== undefined) shift.halfDayMinutes = Number(payload.halfDayMinutes);
    if (payload.fullDayMinutes !== undefined) shift.fullDayMinutes = Number(payload.fullDayMinutes);

    manager.shiftSettings = shift;
    manager.updatedBy = updaterId;
    await manager.save();

    return this.formatBranchManagerResponse(manager);
  }

  /**
   * Section 4: Update Attendance Settings Tab
   */
  async updateAttendanceSettings(bankId, branchId, payload, updaterId) {
    const { manager } = await this.findBranchManagerAndUser(bankId, branchId);

    const att = manager.attendanceSettings || {};
    if (payload.punchType) att.punchType = payload.punchType;
    if (payload.noOutPunchAction) att.noOutPunchAction = payload.noOutPunchAction;
    if (payload.presentOnWeeklyOffHolidayAction) att.presentOnWeeklyOffHolidayAction = payload.presentOnWeeklyOffHolidayAction;

    if (payload.lateCut) {
      att.lateCut = { ...att.lateCut?.toObject(), ...payload.lateCut };
    }
    if (payload.lunchAndEarlyGoing) {
      att.lunchAndEarlyGoing = { ...att.lunchAndEarlyGoing?.toObject(), ...payload.lunchAndEarlyGoing };
    }
    if (payload.overtime) {
      att.overtime = { ...att.overtime?.toObject(), ...payload.overtime };
    }

    manager.attendanceSettings = att;
    manager.updatedBy = updaterId;
    await manager.save();

    return this.formatBranchManagerResponse(manager);
  }

  /**
   * Section 5: Update WOFF / HOFF Settings Tab
   */
  async updateWoffHoffSettings(bankId, branchId, payload, updaterId) {
    const { manager } = await this.findBranchManagerAndUser(bankId, branchId);

    const wh = manager.woffHoffSettings || {};
    if (payload.weeklyOffRules) {
      wh.weeklyOffRules = { ...wh.weeklyOffRules?.toObject(), ...payload.weeklyOffRules };
    }
    if (payload.holidayRules) {
      wh.holidayRules = { ...wh.holidayRules?.toObject(), ...payload.holidayRules };
    }
    if (payload.leaveBridgeRules) {
      wh.leaveBridgeRules = { ...wh.leaveBridgeRules?.toObject(), ...payload.leaveBridgeRules };
    }
    if (payload.leaveSettings) {
      wh.leaveSettings = { ...wh.leaveSettings?.toObject(), ...payload.leaveSettings };
    }

    manager.woffHoffSettings = wh;
    manager.updatedBy = updaterId;
    await manager.save();

    return this.formatBranchManagerResponse(manager);
  }

  /**
   * Section 6: Update KRA Settings Tab
   */
  async updateKraSettings(bankId, branchId, payload, updaterId) {
    const { manager } = await this.findBranchManagerAndUser(bankId, branchId);

    const kra = manager.kraSettings || {};
    if (payload.year !== undefined) kra.year = Number(payload.year);
    if (Array.isArray(payload.targets)) {
      kra.targets = payload.targets.map((t) => ({
        product: (t.product || '').trim(),
        productId: t.productId || null,
        targetType: t.targetType || 'AMOUNT',
        targetValue: Number(t.targetValue || 0)
      }));
    }

    manager.kraSettings = kra;
    manager.updatedBy = updaterId;
    await manager.save();

    return this.formatBranchManagerResponse(manager);
  }

  /**
   * Soft Delete / Deactivate a Branch
   */
  async deleteBranch(bankId, branchId, deleterId) {
    const branch = await Branch.findOne({
      _id: branchId,
      bankId,
      isDeleted: { $ne: true }
    });

    if (!branch) {
      throw ApiError.notFound('Branch not found or does not belong to your bank.');
    }

    branch.isDeleted = true;
    branch.deletedAt = new Date();
    branch.deletedBy = deleterId;
    branch.status = 'INACTIVE';
    await branch.save();

    // Deactivate associated BranchManager and User identity
    if (branch.branchManagerId) {
      const manager = await BranchManager.findById(branch.branchManagerId);
      if (manager) {
        manager.isDeleted = true;
        manager.deletedAt = new Date();
        manager.status = 'INACTIVE';
        await manager.save();

        await User.updateOne({ _id: manager.userId }, { status: 'INACTIVE', updatedBy: deleterId });
      }
    }

    return { id: branch._id, message: 'Branch and associated manager deactivated successfully.' };
  }
}

export const branchService = new BranchService();
