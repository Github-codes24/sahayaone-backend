import { CashCollection } from "../../../../models/cash-collection.model.js";
import { CashSubmission } from "../../../../models/cash-submission.model.js";
import { OnboardingTeam } from "../../../../models/onboarding-team.model.js";
import { SocietyEmployee } from "../../../../models/society-employee.model.js";
import { EmployeeProfile } from "../../../../models/employee-profile.model.js";
import { Branch } from "../../../../models/branch.model.js";
import { User } from "../../../../models/user.model.js";
import { ApiError } from "../../../../common/api.error.js";
import { dailyWorkReportAutomationService } from "../../employees/services/daily-work-report-automation.service.js";
import { logger } from "../../../../utils/logger.util.js";

class CashPaymentService {
  /**
   * Format numbers into INR currency string e.g. ₹1,02,50,987
   */
  formatCurrency(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) return "₹0";
    const num = Number(amount);
    if (num < 0) {
      return "-₹" + Math.abs(num).toLocaleString("en-IN");
    }
    return "₹" + num.toLocaleString("en-IN");
  }

  // ===========================
  // List Employees
  // ===========================
  async listCashPayments(context, query = {}) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const bankId = context?.bankId || null;
    const effectiveBranchId = context?.branchId || query?.branchId || null;

    // 1. Resolve Branch Filtering & Branch Name Search
    const branchFilter = { isDeleted: { $ne: true } };
    if (bankId) {
      branchFilter.bankId = bankId;
    }

    if (query.city) {
      branchFilter.$or = [
        { "address.city": { $regex: query.city, $options: "i" } },
        { city: { $regex: query.city, $options: "i" } }
      ];
    }

    if (query.state) {
      const stateConditions = [
        { "address.state": { $regex: query.state, $options: "i" } },
        { state: { $regex: query.state, $options: "i" } }
      ];
      if (branchFilter.$or) {
        branchFilter.$and = [
          { $or: branchFilter.$or },
          { $or: stateConditions }
        ];
        delete branchFilter.$or;
      } else {
        branchFilter.$or = stateConditions;
      }
    }

    if (query.branchIds) {
      const cleanIds = Array.isArray(query.branchIds)
        ? query.branchIds
        : String(query.branchIds).split(",").map(s => s.trim()).filter(Boolean);
      if (cleanIds.length > 0) {
        branchFilter._id = { $in: cleanIds };
      }
    }

    const branches = await Branch.find(branchFilter).lean();
    const branchMap = new Map();
    const branchIdsFromFilter = [];

    branches.forEach((b) => {
      const bIdStr = String(b._id);
      branchIdsFromFilter.push(b._id);
      branchMap.set(bIdStr, {
        branchId: b._id,
        branchName: b.name || b.branchName || "Main Branch",
        city: b.address?.city || b.city || null,
        state: b.address?.state || b.state || null
      });
    });

    // Resolve matching branch IDs for branch name search
    let searchBranchIds = [];
    if (query.search) {
      const searchBranches = await Branch.find({
        ...(bankId ? { bankId } : {}),
        isDeleted: { $ne: true },
        name: { $regex: query.search, $options: "i" }
      }).select("_id").lean();
      searchBranchIds = searchBranches.map((b) => b._id);
    }

    // 2. Build Employee Filter
    const filter = {
      isDeleted: { $ne: true },
    };

    if (bankId) {
      filter.bankId = bankId;
    }

    if (effectiveBranchId) {
      filter.branchId = effectiveBranchId;
    } else if (query.city || query.state || query.branchIds) {
      filter.branchId = { $in: branchIdsFromFilter };
    }

    if (query.search) {
      const searchConditions = [
        { fullName: { $regex: query.search, $options: "i" } },
        { name: { $regex: query.search, $options: "i" } },
        { firstName: { $regex: query.search, $options: "i" } },
        { lastName: { $regex: query.search, $options: "i" } }
      ];
      if (searchBranchIds.length > 0) {
        searchConditions.push({ branchId: { $in: searchBranchIds } });
      }
      filter.$or = searchConditions;
    }

    const [societyEmployees, onboardingEmployees, regularEmployees] = await Promise.all([
      SocietyEmployee.find(filter).populate("branchId", "name address state city").lean(),
      OnboardingTeam.find(filter).populate("branchId", "name address state city").lean(),
      EmployeeProfile.find(filter).populate("branchId", "name address state city").lean()
    ]);

    // Also fetch any Executive User profiles who have records in CashCollection
    const cashCollectionEmpIds = await CashCollection.distinct("employeeId", {
      isDeleted: { $ne: true },
      ...(bankId ? { bankId } : {}),
      ...(effectiveBranchId ? { branchId: effectiveBranchId } : {})
    });

    const userFilter = {
      _id: { $in: cashCollectionEmpIds },
      isDeleted: { $ne: true }
    };
    if (query.search) {
      userFilter.fullName = { $regex: query.search, $options: "i" };
    }
    const executiveUsers = await User.find(userFilter).lean();

    // Map and deduplicate employee list by userId / _id
    const employeeMap = new Map();

    const addEmployee = (e, defaultRole) => {
      const id = e._id;
      const userId = e.userId || id;
      const key = String(userId || id);

      if (!employeeMap.has(key)) {
        const branchObj = e.branchId && typeof e.branchId === "object" ? e.branchId : null;
        const bIdStr = branchObj ? String(branchObj._id) : String(e.branchId || "");
        const mappedBranch = branchMap.get(bIdStr);

        employeeMap.set(key, {
          _id: id,
          userId,
          fullName: e.fullName || (e.firstName ? `${e.firstName} ${e.lastName || ''}`.trim() : e.name) || "Field Executive",
          designation: e.designation || e.role || defaultRole,
          phoneNumber: e.phoneNumber || e.mobile || null,
          email: e.email || null,
          branchId: branchObj?._id || e.branchId || mappedBranch?.branchId || null,
          branchName: branchObj?.name || mappedBranch?.branchName || "Main Branch",
          city: branchObj?.address?.city || branchObj?.city || mappedBranch?.city || null,
          state: branchObj?.address?.state || branchObj?.state || mappedBranch?.state || null
        });
      }
    };

    societyEmployees.forEach((e) => addEmployee(e, "Society Staff"));
    onboardingEmployees.forEach((e) => addEmployee(e, "Onboarding Staff"));
    regularEmployees.forEach((e) => addEmployee(e, "Loan Executive"));
    executiveUsers.forEach((u) => addEmployee(u, u.role || "Loan Executive"));

    const employees = Array.from(employeeMap.values());
    const totalRecords = employees.length;
    const paginatedEmployees = employees.slice(skip, skip + limit);

    // 3. Build Date Range Filter for Collections and Submissions
    const startDateRaw = query.startDate || query.fromDate || query.dateFrom || null;
    const endDateRaw = query.endDate || query.toDate || query.dateTo || null;

    const startDate = startDateRaw ? new Date(startDateRaw) : null;
    const endDate = endDateRaw ? new Date(endDateRaw) : null;

    if (startDate && !isNaN(startDate.getTime())) startDate.setHours(0, 0, 0, 0);
    if (endDate && !isNaN(endDate.getTime())) endDate.setHours(23, 59, 59, 999);

    const collectionDateFilter = {};
    if (startDate || endDate) {
      collectionDateFilter.collectionDate = {};
      if (startDate && !isNaN(startDate.getTime())) collectionDateFilter.collectionDate.$gte = startDate;
      if (endDate && !isNaN(endDate.getTime())) collectionDateFilter.collectionDate.$lte = endDate;
    }

    const submissionDateFilter = {};
    if (startDate || endDate) {
      submissionDateFilter.date = {};
      if (startDate && !isNaN(startDate.getTime())) submissionDateFilter.date.$gte = startDate;
      if (endDate && !isNaN(endDate.getTime())) submissionDateFilter.date.$lte = endDate;
    }

    // 4. Calculate Collections & Submissions per Employee
    const items = [];

    for (const employee of paginatedEmployees) {
      const empIds = [employee._id, employee.userId].filter(Boolean);

      const collection = await CashCollection.aggregate([
        {
          $match: {
            $or: [
              { employeeId: { $in: empIds } },
              { onboardingTeamId: { $in: empIds } },
              { createdBy: { $in: empIds } }
            ],
            isDeleted: { $ne: true },
            ...collectionDateFilter
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amountCollected" },
          },
        },
      ]);

      const submission = await CashSubmission.aggregate([
        {
          $match: {
            $or: [
              { employeeId: { $in: empIds } },
              { onboardingTeamId: { $in: empIds } },
              { createdBy: { $in: empIds } }
            ],
            isDeleted: { $ne: true },
            ...submissionDateFilter
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amountSubmitted" },
          },
        },
      ]);

      const totalCollection = collection[0]?.total || 0;
      const totalSubmitted = submission[0]?.total || 0;

      items.push({
        employeeId: employee._id,
        userId: employee.userId,
        employeeName: employee.fullName,
        designation: employee.designation,
        phoneNumber: employee.phoneNumber,
        email: employee.email,
        branchId: employee.branchId,
        branchName: employee.branchName,
        city: employee.city,
        state: employee.state,
        totalCashCollection: totalCollection,
        totalCashSubmitted: totalSubmitted,
        totalCashPending: Math.max(0, totalCollection - totalSubmitted),
      });
    }

    // 5. Calculate Overall Summary Stats across all paginated/filtered items
    const totalCollectionSum = items.reduce((acc, i) => acc + i.totalCashCollection, 0);
    const totalSubmittedSum = items.reduce((acc, i) => acc + i.totalCashSubmitted, 0);
    const totalPendingSum = items.reduce((acc, i) => acc + i.totalCashPending, 0);

    const stats = {
      totalCashCollection: totalCollectionSum,
      totalCashSubmitted: totalSubmittedSum,
      totalCashPending: totalPendingSum,
      formattedTotalCashCollection: this.formatCurrency(totalCollectionSum),
      formattedTotalCashSubmitted: this.formatCurrency(totalSubmittedSum),
      formattedTotalCashPending: this.formatCurrency(totalPendingSum)
    };

    return {
      stats,
      items,
      meta: {
        page,
        limit,
        totalRecords,
        totalPages: Math.max(1, Math.ceil(totalRecords / limit)),
      },
    };
  }

  // ======================================
  // Employee Details
  // ======================================
  async getCashPaymentDetails(context, employeeId, query) {
    let employee = await SocietyEmployee.findById(employeeId).lean().populate('branchId', 'name address state city') ||
                   await OnboardingTeam.findById(employeeId).lean().populate('branchId', 'name address state city') ||
                   await EmployeeProfile.findById(employeeId).lean().populate('branchId', 'name address state city') ||
                   await EmployeeProfile.findOne({ userId: employeeId }).lean().populate('branchId', 'name address state city') ||
                   await User.findById(employeeId).lean().populate('branchId', 'name address state city');

    if (!employee) {
      throw ApiError.notFound("Employee profile not found");
    }

    const empIds = [employee._id, employee.userId].filter(Boolean);

    const collection = await CashCollection.aggregate([
      {
        $match: {
          $or: [
            { employeeId: { $in: empIds } },
            { onboardingTeamId: { $in: empIds } },
            { createdBy: { $in: empIds } }
          ],
          isDeleted: { $ne: true },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amountCollected" },
        },
      },
    ]);

    const submission = await CashSubmission.aggregate([
      {
        $match: {
          $or: [
            { employeeId: { $in: empIds } },
            { onboardingTeamId: { $in: empIds } },
            { createdBy: { $in: empIds } }
          ],
          isDeleted: { $ne: true },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amountSubmitted" },
        },
      },
    ]);

    const totalCollection = collection[0]?.total || 0;
    const totalSubmitted = submission[0]?.total || 0;

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const historyFilter = {
      $or: [
        { employeeId: { $in: empIds } },
        { onboardingTeamId: { $in: empIds } },
        { createdBy: { $in: empIds } }
      ],
      isDeleted: { $ne: true },
    };

    if (query.fromDate || query.toDate) {
      historyFilter.date = {};
      if (query.fromDate) historyFilter.date.$gte = new Date(query.fromDate);
      if (query.toDate) historyFilter.date.$lte = new Date(query.toDate);
    }

    const collectionsHistory = await CashCollection.find({
      $or: [
        { employeeId: { $in: empIds } },
        { onboardingTeamId: { $in: empIds } },
        { createdBy: { $in: empIds } }
      ],
      isDeleted: { $ne: true }
    })
      .populate('loanId', 'applicationId productPrice downPayment')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const history = await CashSubmission.find(historyFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalHistory = await CashSubmission.countDocuments(historyFilter);

    const branchObj = employee.branchId && typeof employee.branchId === "object" ? employee.branchId : null;

    return {
      employee: {
        _id: employee._id,
        userId: employee.userId || employee._id,
        fullName: employee.fullName || (employee.firstName ? `${employee.firstName} ${employee.lastName}`.trim() : employee.name) || "Employee",
        designation: employee.designation || employee.role || "Staff",
        phoneNumber: employee.phoneNumber || employee.mobile || null,
        email: employee.email || null,
        branchId: branchObj?._id || employee.branchId || null,
        branchName: branchObj?.name || "Main Branch",
        city: branchObj?.address?.city || branchObj?.city || null,
        state: branchObj?.address?.state || branchObj?.state || null
      },
      summary: {
        totalCashCollection: totalCollection,
        totalCashSubmitted: totalSubmitted,
        totalCashPending: Math.max(0, totalCollection - totalSubmitted),
      },
      collections: collectionsHistory,
      submissions: history,
      history,
      meta: {
        page,
        limit,
        totalRecords: totalHistory,
        totalPages: Math.max(1, Math.ceil(totalHistory / limit)),
      },
    };
  }

  // ======================================
  // Submit Cash
  // ======================================
  async submitCash(employeeId, body, userId) {
    let employee = await SocietyEmployee.findById(employeeId) ||
                   await OnboardingTeam.findById(employeeId) ||
                   await EmployeeProfile.findById(employeeId) ||
                   await EmployeeProfile.findOne({ userId: employeeId }) ||
                   await User.findById(employeeId);

    if (!employee) {
      throw ApiError.notFound("Employee not found");
    }

    const empIds = [employee._id, employee.userId].filter(Boolean);

    // Calculate total collections for this employee
    const collectionAgg = await CashCollection.aggregate([
      {
        $match: {
          $or: [
            { employeeId: { $in: empIds } },
            { onboardingTeamId: { $in: empIds } },
            { createdBy: { $in: empIds } }
          ],
          isDeleted: { $ne: true },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amountCollected" },
        },
      },
    ]);

    // Calculate total submissions for this employee
    const submissionAgg = await CashSubmission.aggregate([
      {
        $match: {
          $or: [
            { employeeId: { $in: empIds } },
            { onboardingTeamId: { $in: empIds } },
            { createdBy: { $in: empIds } }
          ],
          isDeleted: { $ne: true },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amountSubmitted" },
        },
      },
    ]);

    const totalCollection = collectionAgg[0]?.total || 0;
    const totalSubmitted = submissionAgg[0]?.total || 0;
    const pendingAmount = Math.max(0, totalCollection - totalSubmitted);

    const amountSubmitted = Number(body.amountSubmitted || 0);

    if (amountSubmitted <= 0) {
      throw ApiError.badRequest("Submitted cash amount must be greater than 0.");
    }

    if (amountSubmitted > pendingAmount) {
      throw ApiError.badRequest(
        `Submitted cash amount (₹${amountSubmitted.toLocaleString('en-IN')}) cannot exceed pending cash amount (₹${pendingAmount.toLocaleString('en-IN')}).`
      );
    }

    const submission = await CashSubmission.create({
      employeeId: employee.userId || employee._id,
      onboardingTeamId: employee._id,
      employeeName: employee.fullName || (employee.firstName ? `${employee.firstName} ${employee.lastName}` : employee.name) || "Employee",
      date: body.date || new Date(),
      amountSubmitted,
      remarks: body.remarks,
      createdBy: userId,
    });

    if (submission) {
      dailyWorkReportAutomationService.recordWorkReport({
        bankId: employee.bankId,
        branchId: employee.branchId,
        employeeId: employee.userId || employee._id,
        date: body.date || new Date(),
        product: "Cash Collection",
        amount: amountSubmitted,
        sourceModule: "CASH_COLLECTION",
        referenceId: submission._id,
        createdBy: userId,
      }).catch((err) =>
        logger.error(`Auto work report error for cash submission ${submission._id}: ${err.message}`)
      );
    }

    return submission;
  }

  // ======================================
  // List Available States and Cities
  // ======================================
  async getLocations(context) {
    const filter = { isDeleted: { $ne: true } };
    if (context?.bankId) {
      filter.bankId = context.bankId;
    }

    const branches = await Branch.find(filter).select("state city address").lean();

    const statesSet = new Set();
    const citiesSet = new Set();
    const stateCitiesMap = {};

    branches.forEach((b) => {
      const stateName = (b.address?.state || b.state || "").trim();
      const cityName = (b.address?.city || b.city || "").trim();

      if (stateName) {
        statesSet.add(stateName);
        if (!stateCitiesMap[stateName]) {
          stateCitiesMap[stateName] = new Set();
        }
        if (cityName) stateCitiesMap[stateName].add(cityName);
      }

      if (cityName) {
        citiesSet.add(cityName);
      }
    });

    const states = Array.from(statesSet).sort();
    const cities = Array.from(citiesSet).sort();
    const locations = Object.keys(stateCitiesMap).map((st) => ({
      state: st,
      cities: Array.from(stateCitiesMap[st]).sort(),
    }));

    return {
      states,
      cities,
      locations,
    };
  }
}

export const cashPaymentService = new CashPaymentService();

