import fs from "fs";
import mongoose from "mongoose";
import { SocietyEmployee } from "../../../../models/society-employee.model.js";
import { BranchManager } from "../../../../models/branch-manager.model.js";
import { DailyWorkReport } from "../../../../models/daily-work-report.model.js";
import { Product } from "../../../../models/product.model.js";
import { Loan } from "../../../../models/loan.model.js";
import { Branch } from "../../../../models/branch.model.js";
import { Bank } from "../../../../models/bank.model.js";
import { SocietyRole } from "../../../../models/society-role.model.js";
import { SocietyReceipt } from "../../receipts/shared/receipt.model.js";
import { CashSubmission } from "../../../../models/cash-submission.model.js";
import { ApiError } from "../../../../common/api.error.js";
import { offerLetterService } from "./offer-letter.service.js";
import { confirmationLetterService } from "./confirmation-letter.service.js";
import { performanceLetterService } from "./performance-letter.service.js";
import { promotionLetterService } from "./promotion-letter.service.js";
import { transferLetterService } from "./transfer-letter.service.js";
import { salarySlipService } from "./salary-slip.service.js";
import { salaryIncrementLetterService } from "./salary-increment-letter.service.js";
import { EmployeeLetterLog } from "../../../../models/employee-letter-log.model.js";
import { hrLetterEmailService } from "./hr-letter-email.service.js";
import { storageManager } from "../../../../storage/storage.manager.js";
import { logger } from "../../../../utils/logger.util.js";

export class SocietyEmployeeHrService {
  /**
   * Helper to format currency values to INR locale strings
   */
  formatCurrency(val) {
    return "₹" + Number(val || 0).toLocaleString("en-IN");
  }

  /**
   * Helper to calculate weekly date range (Monday - Sunday)
   */
  getWeekRange(refDate = new Date()) {
    const date = new Date(refDate);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    const start = new Date(date.setDate(diff));
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  /**
   * Helper to normalize incentive type and calculate earned incentive amount
   */
  calculateEarnedIncentive(target = {}, achievedAmount = 0, achievedCount = 0, targetGoal = 0, targetType = 'AMOUNT') {
    const rawType = (target.incentiveType || 'NONE').toUpperCase();
    const value = Number(target.incentiveValue || 0);

    let normType = 'NONE';
    if (rawType === 'PRODUCT' || rawType === 'PERCENTAGE') {
      normType = 'PRODUCT';
    } else if (rawType === 'QUANTITY' || rawType === 'PER_UNIT') {
      normType = 'QUANTITY';
    }

    if (normType === 'NONE' || value <= 0) {
      return {
        type: 'NONE',
        value: 0,
        formattedValue: 'No Incentive',
        earnedAmount: 0,
        formattedEarnedAmount: '₹0',
        isTargetAchieved: false
      };
    }

    // Incentive applies ONLY IF target is set (targetGoal > 0) and employee achieves target goal or more (benchmark >= targetGoal)
    const benchmark = (targetType === 'COUNT' || normType === 'QUANTITY') ? achievedCount : achievedAmount;
    const isTargetAchieved = targetGoal > 0 ? benchmark >= targetGoal : false;

    let earnedAmount = 0;
    if (isTargetAchieved) {
      if (normType === 'PRODUCT') {
        earnedAmount = Math.round(((value / 100) * achievedAmount) * 100) / 100;
      } else if (normType === 'QUANTITY') {
        earnedAmount = Math.round((value * achievedCount) * 100) / 100;
      }
    }

    const formattedValue = normType === 'PRODUCT'
      ? `${value}% of product cost`
      : `₹${value.toLocaleString('en-IN')} per quantity`;

    return {
      type: normType,
      value,
      formattedValue,
      earnedAmount,
      formattedEarnedAmount: this.formatCurrency(earnedAmount),
      isTargetAchieved
    };
  }

  /**
   * Get list of universal product incentives configured for the bank
   */
  async getProductIncentives(bankId) {
    const bank = await Bank.findById(bankId).select("productIncentives").lean();
    if (!bank) {
      throw ApiError.notFound("Bank profile not found.");
    }

    return (bank.productIncentives || []).map((inc) => {
      const rawType = (inc.incentiveType || "NONE").toUpperCase();
      let normType = "NONE";
      if (rawType === "PRODUCT" || rawType === "PERCENTAGE") normType = "PRODUCT";
      else if (rawType === "QUANTITY" || rawType === "PER_UNIT") normType = "QUANTITY";

      let formattedValue = "No Incentive";
      if (normType === "PRODUCT") {
        formattedValue = `${inc.incentiveValue}% of product cost`;
      } else if (normType === "QUANTITY") {
        formattedValue = `₹${Number(inc.incentiveValue || 0).toLocaleString("en-IN")} per quantity`;
      }

      return {
        product: inc.product,
        incentiveType: normType,
        incentiveValue: inc.incentiveValue || 0,
        formattedIncentiveValue: formattedValue,
      };
    });
  }

  /**
   * Add or update a universal product incentive configuration for the bank
   */
  async upsertProductIncentive(bankId, payload) {
    const productName = (payload.product || "").trim();
    if (!productName) {
      throw ApiError.badRequest("Product name is required.");
    }

    const rawType = (payload.incentiveType || "NONE").toUpperCase();
    let normType = "NONE";
    if (rawType === "PRODUCT" || rawType === "PERCENTAGE") normType = "PRODUCT";
    else if (rawType === "QUANTITY" || rawType === "PER_UNIT") normType = "QUANTITY";

    const incValue = Number(payload.incentiveValue || 0);
    const safeValue = isNaN(incValue) || incValue < 0 ? 0 : incValue;

    const bank = await Bank.findById(bankId);
    if (!bank) {
      throw ApiError.notFound("Bank profile not found.");
    }

    if (!Array.isArray(bank.productIncentives)) {
      bank.productIncentives = [];
    }

    const existingIdx = bank.productIncentives.findIndex(
      (pi) => pi.product.toLowerCase() === productName.toLowerCase()
    );

    if (existingIdx !== -1) {
      bank.productIncentives[existingIdx].incentiveType = normType;
      bank.productIncentives[existingIdx].incentiveValue = safeValue;
    } else {
      bank.productIncentives.push({
        product: productName,
        incentiveType: normType,
        incentiveValue: safeValue,
      });
    }

    await bank.save();
    return this.getProductIncentives(bankId);
  }

  /**
   * Create Daily Work Report
   */
  async createDailyWorkReport(bankId, payload, creatorId) {
    let employee = await SocietyEmployee.findOne({
      _id: payload.employeeId,
      bankId,
      isDeleted: { $ne: true },
    });

    if (!employee) {
      employee = await BranchManager.findOne({
        _id: payload.employeeId,
        bankId,
        isDeleted: { $ne: true },
      });
    }

    if (!employee) {
      throw ApiError.notFound(
        "Society Employee not found under this bank context.",
      );
    }

    const report = new DailyWorkReport({
      employeeId: employee._id,
      bankId,
      branchId: employee.branchId,
      date: new Date(payload.date),
      product: payload.product.trim(),
      amount: Number(payload.amount),
      remarks: (payload.remarks || "").trim(),
      createdBy: creatorId,
    });

    await report.save();
    return report;
  }

  /**
   * List Daily Work Reports with search and multi-value filters
   */
  async listDailyWorkReports(bankId, query, branchIdFilter) {
    const page = parseInt(query.page || "1", 10);
    const limit = parseInt(query.limit || "10", 10);
    const skip = (page - 1) * limit;

    // 1. Build employee filter options
    const empFilter = { bankId, isDeleted: { $ne: true } };

    if (branchIdFilter) {
      if (Array.isArray(branchIdFilter)) {
        empFilter.branchId = { $in: branchIdFilter };
      } else {
        empFilter.branchId = branchIdFilter;
      }
    } else if (query.branchIds && (Array.isArray(query.branchIds) ? query.branchIds.length > 0 : String(query.branchIds).trim())) {
      const bIds = Array.isArray(query.branchIds) ? query.branchIds : String(query.branchIds).split(',').map(s => s.trim()).filter(Boolean);
      empFilter.branchId = { $in: bIds };
    } else if (query.branchId) {
      empFilter.branchId = query.branchId;
    }

    if (query.designations && (Array.isArray(query.designations) ? query.designations.length > 0 : String(query.designations).trim())) {
      const desigList = Array.isArray(query.designations) ? query.designations : String(query.designations).split(',').map(s => s.trim()).filter(Boolean);
      const desigRegexes = desigList.map(d => new RegExp(d, 'i'));
      empFilter.$or = [
        { designation: { $in: desigRegexes } },
        { "jobDetails.designation": { $in: desigRegexes } },
      ];
    }

    if (query.states && (Array.isArray(query.states) ? query.states.length > 0 : String(query.states).trim())) {
      const stateList = Array.isArray(query.states) ? query.states : String(query.states).split(',').map(s => s.trim()).filter(Boolean);
      const stateRegexes = stateList.map(s => new RegExp(s, 'i'));
      const matchingBranches = await Branch.find({
        bankId,
        isDeleted: { $ne: true },
        $or: [
          { state: { $in: stateRegexes } },
          { 'address.state': { $in: stateRegexes } }
        ]
      }).select('_id').lean();
      const branchIdsFromStates = matchingBranches.map(b => b._id);

      const stateConds = [
        { "jobDetails.state": { $in: stateRegexes } },
        { state: { $in: stateRegexes } },
        { branchId: { $in: branchIdsFromStates } }
      ];

      if (empFilter.$or) {
        empFilter.$and = [{ $or: empFilter.$or }, { $or: stateConds }];
        delete empFilter.$or;
      } else {
        empFilter.$or = stateConds;
      }
    }

    if (query.search && String(query.search).trim()) {
      const searchRegex = new RegExp(String(query.search).trim(), "i");
      const searchConds = [
        { fullName: searchRegex },
        { email: searchRegex },
        { phoneNumber: searchRegex },
        { employeeCode: searchRegex }
      ];

      if (empFilter.$and) {
        empFilter.$and.push({ $or: searchConds });
      } else if (empFilter.$or) {
        empFilter.$and = [{ $or: empFilter.$or }, { $or: searchConds }];
        delete empFilter.$or;
      } else {
        empFilter.$or = searchConds;
      }
    }

    const [employees, managers] = await Promise.all([
      SocietyEmployee.find(empFilter)
        .populate("branchId")
        .populate("roleId")
        .lean(),
      BranchManager.find(empFilter)
        .populate("branchId")
        .populate("roleId")
        .lean(),
    ]);

    const allEmps = [...employees, ...managers];
    const employeeMap = new Map();
    const rawIds = [];
    allEmps.forEach((e) => {
      employeeMap.set(e._id.toString(), e);
      rawIds.push(e._id);
      if (e.userId) {
        employeeMap.set(e.userId.toString(), e);
        rawIds.push(e.userId);
      }
    });
    const employeeIds = Array.from(new Set(rawIds.map((id) => id.toString())));

    // 2. Build work report filters
    const reportFilter = {
      bankId,
      employeeId: { $in: employeeIds },
      isDeleted: { $ne: true },
    };

    if (query.sourceModule && String(query.sourceModule).trim()) {
      reportFilter.sourceModule = String(query.sourceModule).trim().toUpperCase();
    }

    const dateFrom = query.dateFrom || query.startDate || query.date;
    const dateTo = query.dateTo || query.endDate || query.date;

    if (dateFrom || dateTo) {
      reportFilter.date = {};
      if (dateFrom) {
        const start = new Date(dateFrom);
        start.setHours(0, 0, 0, 0);
        reportFilter.date.$gte = start;
      }
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        reportFilter.date.$lte = end;
      }
    }

    if (query.search && String(query.search).trim()) {
      const sRegex = new RegExp(String(query.search).trim(), "i");
      reportFilter.$or = [
        { product: sRegex },
        { remarks: sRegex }
      ];
    }

    const totalRecords = await DailyWorkReport.countDocuments(reportFilter);

    // 3. Compute stats summary across all matching work reports
    // Cast string IDs to mongoose.Types.ObjectId for native aggregation matching
    const objectIdEmployeeIds = employeeIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const targetBankId = mongoose.Types.ObjectId.isValid(bankId)
      ? new mongoose.Types.ObjectId(bankId)
      : bankId;

    const statsMatchFilter = {
      ...reportFilter,
      bankId: targetBankId,
      employeeId: { $in: objectIdEmployeeIds }
    };

    const statsAgg = await DailyWorkReport.aggregate([
      { $match: statsMatchFilter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          autoCount: {
            $sum: { $cond: [{ $eq: ["$isAutoGenerated", true] }, 1, 0] }
          },
          manualCount: {
            $sum: { $cond: [{ $ne: ["$isAutoGenerated", true] }, 1, 0] }
          }
        }
      }
    ]).catch(() => []);

    const totalAmountSum = statsAgg[0]?.totalAmount || 0;
    const autoGeneratedCount = statsAgg[0]?.autoCount || 0;
    const manualCount = statsAgg[0]?.manualCount || 0;

    const stats = {
      totalWorkReports: totalRecords,
      totalAmount: totalAmountSum,
      formattedTotalAmount: this.formatCurrency(totalAmountSum),
      autoGeneratedCount,
      manualCount
    };

    const reports = await DailyWorkReport.find(reportFilter)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const items = reports.map((r, idx) => {
      const emp = employeeMap.get(r.employeeId.toString());
      return {
        srNo: skip + idx + 1,
        id: r._id,
        employeeId: r.employeeId,
        employeeName: emp?.fullName || "N/A",
        designation: emp?.designation || emp?.roleId?.name || "N/A",
        branch: emp?.branchId?.name || "N/A",
        product: r.product,
        amount: r.amount,
        formattedAmount: this.formatCurrency(r.amount),
        isAutoGenerated: Boolean(r.isAutoGenerated),
        sourceModule: r.sourceModule || "MANUAL",
        remarks: r.remarks || "",
        date: r.date,
      };
    });

    const totalPages = Math.ceil(totalRecords / limit);

    return {
      stats,
      items,
      meta: {
        totalRecords,
        limit,
        page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Export Daily Work Reports as CSV
   */
  async exportDailyWorkReports(bankId, query, branchIdFilter) {
    // Re-use filter criteria without skip/limit pagination
    const empFilter = { bankId, isDeleted: { $ne: true } };

    if (branchIdFilter) {
      if (Array.isArray(branchIdFilter)) {
        empFilter.branchId = { $in: branchIdFilter };
      } else {
        empFilter.branchId = branchIdFilter;
      }
    } else if (query.branchIds && query.branchIds.length > 0) {
      empFilter.branchId = { $in: query.branchIds };
    } else if (query.branchId) {
      empFilter.branchId = query.branchId;
    }

    if (query.designations && query.designations.length > 0) {
      empFilter.$or = [
        { designation: { $in: query.designations } },
        { "jobDetails.designation": { $in: query.designations } },
      ];
    }

    if (query.states && query.states.length > 0) {
      empFilter["jobDetails.state"] = { $in: query.states };
    }

    if (query.search) {
      const searchRegex = new RegExp(query.search, "i");
      empFilter.$or = [
        ...(empFilter.$or || []),
        { fullName: searchRegex },
        { email: searchRegex },
        { phoneNumber: searchRegex },
      ];
    }

    const [employees, managers] = await Promise.all([
      SocietyEmployee.find(empFilter)
        .populate("branchId")
        .populate("roleId")
        .lean(),
      BranchManager.find(empFilter)
        .populate("branchId")
        .populate("roleId")
        .lean(),
    ]);

    const allEmps = [...employees, ...managers];
    const employeeMap = new Map();
    allEmps.forEach((e) => {
      employeeMap.set(e._id.toString(), e);
      if (e.userId) employeeMap.set(e.userId.toString(), e);
    });
    const employeeIds = Array.from(new Set(allEmps.map((e) => e._id)));

    const reportFilter = {
      bankId,
      employeeId: { $in: employeeIds },
      isDeleted: { $ne: true },
    };

    if (query.date) {
      const startOfDay = new Date(query.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(query.date);
      endOfDay.setHours(23, 59, 59, 999);
      reportFilter.date = { $gte: startOfDay, $lte: endOfDay };
    }

    const reports = await DailyWorkReport.find(reportFilter)
      .sort({ date: -1 })
      .lean();

    let csvContent =
      "Sr.No.,Employee Name,Designation,Branch,Product,Amount,Remarks,Date\n";
    reports.forEach((r, idx) => {
      const emp = employeeMap.get(r.employeeId.toString());
      const dateStr = new Date(r.date).toLocaleDateString();
      const row = [
        idx + 1,
        `"${emp?.fullName || "N/A"}"`,
        `"${emp?.designation || emp?.roleId?.name || "N/A"}"`,
        `"${emp?.branchId?.name || "N/A"}"`,
        `"${r.product}"`,
        r.amount,
        `"${(r.remarks || "").replace(/"/g, '""')}"`,
        `"${dateStr}"`,
      ];
      csvContent += row.join(",") + "\n";
    });

    return Buffer.from(csvContent, "utf-8");
  }

  /**
   * List KPA reports overview (targets overview per employee)
   */
  async listKpaReports(bankId, query, branchIdFilter) {
    const page = parseInt(query.page || "1", 10);
    const limit = parseInt(query.limit || "10", 10);
    const skip = (page - 1) * limit;

    const filter = { bankId, isDeleted: { $ne: true } };

    // 1. Branch Filtering
    if (branchIdFilter) {
      if (Array.isArray(branchIdFilter)) {
        filter.branchId = { $in: branchIdFilter };
      } else {
        filter.branchId = branchIdFilter;
      }
    } else if (query.branchIds && (Array.isArray(query.branchIds) ? query.branchIds.length > 0 : String(query.branchIds).trim())) {
      const bIds = Array.isArray(query.branchIds) ? query.branchIds : String(query.branchIds).split(',').map(s => s.trim()).filter(Boolean);
      filter.branchId = { $in: bIds };
    } else if (query.branchId) {
      filter.branchId = query.branchId;
    }

    // 2. States Filtering (employee state or branch state)
    if (query.states && (Array.isArray(query.states) ? query.states.length > 0 : String(query.states).trim())) {
      const stateList = Array.isArray(query.states) ? query.states : String(query.states).split(',').map(s => s.trim()).filter(Boolean);
      const stateRegexes = stateList.map(s => new RegExp(s, 'i'));
      const matchingBranches = await Branch.find({
        bankId,
        isDeleted: { $ne: true },
        $or: [
          { state: { $in: stateRegexes } },
          { 'address.state': { $in: stateRegexes } }
        ]
      }).select('_id').lean();
      const branchIdsFromStates = matchingBranches.map(b => b._id);

      const stateConditions = [
        { 'jobDetails.state': { $in: stateRegexes } },
        { state: { $in: stateRegexes } },
        { branchId: { $in: branchIdsFromStates } }
      ];

      filter.$or = [
        ...(filter.$or || []),
        ...stateConditions
      ];
    }

    // 3. Designations Filtering
    if (query.designations && (Array.isArray(query.designations) ? query.designations.length > 0 : String(query.designations).trim())) {
      const desigList = Array.isArray(query.designations) ? query.designations : String(query.designations).split(',').map(s => s.trim()).filter(Boolean);
      const desigRegexes = desigList.map(d => new RegExp(d, 'i'));
      const desigConditions = [
        { designation: { $in: desigRegexes } },
        { 'jobDetails.designation': { $in: desigRegexes } }
      ];

      if (filter.$or) {
        filter.$and = filter.$and || [];
        filter.$and.push({ $or: filter.$or }, { $or: desigConditions });
        delete filter.$or;
      } else if (filter.$and) {
        filter.$and.push({ $or: desigConditions });
      } else {
        filter.$or = desigConditions;
      }
    }

    // 4. Search Filter
    if (query.search && String(query.search).trim()) {
      const searchRegex = new RegExp(String(query.search).trim(), "i");
      const searchConditions = [
        { fullName: searchRegex },
        { email: searchRegex },
        { phoneNumber: searchRegex },
        { employeeCode: searchRegex }
      ];

      if (filter.$and) {
        filter.$and.push({ $or: searchConditions });
      } else if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
        delete filter.$or;
      } else {
        filter.$or = searchConditions;
      }
    }

    const [employees, managers] = await Promise.all([
      SocietyEmployee.find(filter)
        .populate("branchId")
        .populate("roleId")
        .lean(),
      BranchManager.find(filter).populate("branchId").populate("roleId").lean(),
    ]);

    const userSeen = new Set();
    const allEmps = [];
    [...employees, ...managers].forEach((e) => {
      const key = e.userId ? e.userId.toString() : e._id.toString();
      if (!userSeen.has(key)) {
        userSeen.add(key);
        allEmps.push(e);
      }
    });

    const totalRecords = allEmps.length;
    const pagedEmps = allEmps.slice(skip, skip + limit);

    // Calculate overall stats across all filtered employees
    let totalTargetSum = 0;
    const empIds = [];
    allEmps.forEach((e) => {
      empIds.push(e._id);
      if (e.userId) empIds.push(e.userId);
      const targets = e.kraSettings?.targets || [];
      targets.forEach((t) => {
        totalTargetSum += (t.targetValue || 0);
      });
    });

    const objectIdEmpIds = empIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const targetBankId = mongoose.Types.ObjectId.isValid(bankId)
      ? new mongoose.Types.ObjectId(bankId)
      : bankId;

    const workReportAgg = await DailyWorkReport.aggregate([
      {
        $match: {
          bankId: targetBankId,
          employeeId: { $in: objectIdEmpIds },
          isDeleted: { $ne: true },
        },
      },
      {
        $group: {
          _id: null,
          totalAchieved: { $sum: "$amount" },
        },
      },
    ]).catch(() => []);

    const totalAchievedSum = workReportAgg[0]?.totalAchieved || 0;
    const overallPct = totalTargetSum > 0 ? Math.min(100, Math.round((totalAchievedSum / totalTargetSum) * 100)) : 0;

    const stats = {
      totalEmployees: totalRecords,
      totalTargetAmount: totalTargetSum,
      formattedTotalTargetAmount: this.formatCurrency(totalTargetSum),
      totalAchievedAmount: totalAchievedSum,
      formattedTotalAchievedAmount: this.formatCurrency(totalAchievedSum),
      overallPercentage: overallPct,
    };

    const bankDoc = await Bank.findById(bankId).select("productIncentives").lean();
    const productIncentivesMap = new Map();
    (bankDoc?.productIncentives || []).forEach((pi) => {
      productIncentivesMap.set(pi.product.toLowerCase(), pi);
    });

    const items = pagedEmps.map((emp, idx) => {
      const targets = (emp.kraSettings?.targets || []).map((t) => {
        const universalIncRule = productIncentivesMap.get(t.product.toLowerCase()) || t;
        const inc = this.calculateEarnedIncentive(universalIncRule, 0, 0);
        return {
          product: t.product,
          targetType: t.targetType || "AMOUNT",
          targetValue: t.targetValue || 0,
          formattedTargetValue: t.targetType === "COUNT" ? String(t.targetValue || 0) : this.formatCurrency(t.targetValue || 0),
          incentiveType: inc.type,
          incentiveValue: inc.value,
          formattedIncentiveValue: inc.formattedValue,
        };
      });

      return {
        srNo: skip + idx + 1,
        id: emp._id,
        employeeName: emp.fullName,
        designation: emp.designation || emp.roleId?.name || "N/A",
        branch: emp.branchId?.name || "N/A",
        phoneNumber: emp.phoneNumber || "",
        email: emp.email || "",
        targets,
      };
    });

    const totalPages = Math.ceil(totalRecords / limit);

    return {
      stats,
      items,
      meta: {
        totalRecords,
        limit,
        page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Export KPA Reports Overview as CSV
   */
  async exportKpaReports(bankId, query, branchIdFilter) {
    const filter = { bankId, isDeleted: { $ne: true } };

    if (branchIdFilter) {
      if (Array.isArray(branchIdFilter)) {
        filter.branchId = { $in: branchIdFilter };
      } else {
        filter.branchId = branchIdFilter;
      }
    } else if (query.branchIds && query.branchIds.length > 0) {
      filter.branchId = { $in: query.branchIds };
    } else if (query.branchId) {
      filter.branchId = query.branchId;
    }

    if (query.designations && query.designations.length > 0) {
      filter.$or = [
        { designation: { $in: query.designations } },
        { "jobDetails.designation": { $in: query.designations } },
      ];
    }

    if (query.states && query.states.length > 0) {
      filter["jobDetails.state"] = { $in: query.states };
    }

    if (query.search) {
      const searchRegex = new RegExp(query.search, "i");
      filter.$or = [
        ...(filter.$or || []),
        { fullName: searchRegex },
        { email: searchRegex },
        { phoneNumber: searchRegex },
      ];
    }

    const [employees, managers] = await Promise.all([
      SocietyEmployee.find(filter)
        .populate("branchId")
        .populate("roleId")
        .lean(),
      BranchManager.find(filter).populate("branchId").populate("roleId").lean(),
    ]);

    const userSeen = new Set();
    const allEmps = [];
    [...employees, ...managers].forEach((e) => {
      const key = e.userId ? e.userId.toString() : e._id.toString();
      if (!userSeen.has(key)) {
        userSeen.add(key);
        allEmps.push(e);
      }
    });

    const bankDoc = await Bank.findById(bankId).select("productIncentives").lean();
    const productIncentivesMap = new Map();
    (bankDoc?.productIncentives || []).forEach((pi) => {
      productIncentivesMap.set(pi.product.toLowerCase(), pi);
    });

    let csvContent =
      "Sr.No.,Employee Name,Designation,Branch,Phone Number,Email,KPA Target Products,Incentive Configuration\n";
    allEmps.forEach((emp, idx) => {
      const targets = emp.kraSettings?.targets || [];
      const targetSummary = targets.map(t => `${t.product} (${t.targetType}: ${t.targetValue})`).join(" | ") || "N/A";
      const incSummary = targets.map(t => {
        const universalIncRule = productIncentivesMap.get(t.product.toLowerCase()) || t;
        const inc = this.calculateEarnedIncentive(universalIncRule, 0, 0);
        return `${t.product}: ${inc.formattedValue}`;
      }).join(" | ") || "No Incentive Configured";

      const row = [
        idx + 1,
        `"${(emp.fullName || "").replace(/"/g, '""')}"`,
        `"${(emp.designation || emp.roleId?.name || "N/A").replace(/"/g, '""')}"`,
        `"${(emp.branchId?.name || "N/A").replace(/"/g, '""')}"`,
        `"${emp.phoneNumber || ""}"`,
        `"${emp.email || ""}"`,
        `"${targetSummary.replace(/"/g, '""')}"`,
        `"${incSummary.replace(/"/g, '""')}"`,
      ];
      csvContent += row.join(",") + "\n";
    });

    return Buffer.from(csvContent, "utf-8");
  }

  /**
   * Get KPA report details for a specific employee & product
   */
  async getKpaReportDetail(bankId, employeeId, query, branchIdFilter = null) {
    const empQuery = {
      _id: employeeId,
      bankId,
      isDeleted: { $ne: true },
    };

    const targetBranch = branchIdFilter || query.branchId || null;
    if (targetBranch) {
      if (Array.isArray(targetBranch)) {
        empQuery.branchId = { $in: targetBranch };
      } else {
        empQuery.branchId = targetBranch;
      }
    }

    let employee = await SocietyEmployee.findOne(empQuery)
      .populate("branchId")
      .populate("roleId")
      .lean();

    if (!employee) {
      employee = await BranchManager.findOne(empQuery)
        .populate("branchId")
        .lean();
    }

    if (!employee) {
      throw ApiError.notFound("Society Employee not found.");
    }

    const year = parseInt(query.year || new Date().getFullYear(), 10);
    const productFilter = (query.product || "").trim();

    // 1. Resolve KRA Settings
    const kra = employee.kraSettings || {};
    const targets = kra.targets || [];

    // Find matching target (fallback to first target if no match)
    let selectedTarget = targets.find(
      (t) => t.product.toLowerCase() === productFilter.toLowerCase(),
    );
    if (!selectedTarget && targets.length > 0) {
      selectedTarget = targets[0];
    }

    const product =
      selectedTarget?.product || productFilter || "Loan Disbursement";
    const yearlyTarget = selectedTarget?.targetValue || 0;

    // Derived goals (Yearly, Monthly = Y/12, Weekly = M/4, Daily = W/5)
    const yearlyGoal = yearlyTarget;
    const monthlyGoal = Math.round(yearlyGoal / 12);
    const weeklyGoal = Math.round(monthlyGoal / 4);
    const dailyGoal = Math.round(weeklyGoal / 5);

    // 2. Compute Achievements
    const now = new Date();

    // Ranges
    // Fiscal Year starting April 1
    const fyStart = new Date(year, 3, 1);
    const fyEnd = new Date(year + 1, 2, 31, 23, 59, 59, 999);

    // Monthly Range
    const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const mEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    // Weekly Range
    const { start: wStart, end: wEnd } = this.getWeekRange(now);

    // Daily Range
    const dStart = new Date(now);
    dStart.setHours(0, 0, 0, 0);
    const dEnd = new Date(now);
    dEnd.setHours(23, 59, 59, 999);

    // Query Work Reports matching employee & product category (e.g. Deposit Collection, Cash Collections, Receipts)
    const empIds = [employee._id, employee.userId].filter(Boolean);
    const escapedProduct = product.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const pNorm = product.toLowerCase();
    const isDepositCategory = pNorm.includes("deposit") || pNorm.includes("collection") || pNorm.includes("receipt");

    const productConditions = [
      { product: { $regex: new RegExp(`^${escapedProduct}$`, "i") } }
    ];

    if (productFilter) {
      const escapedFilter = productFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      productConditions.push({ product: { $regex: new RegExp(`^${escapedFilter}$`, "i") } });
    }

    if (isDepositCategory) {
      productConditions.push(
        { sourceModule: { $in: ['RECEIPT', 'CASH_COLLECTION'] } },
        { product: { $regex: /deposit|collection|receipt|cash|gl-/i } }
      );
    }

    const workReports = await DailyWorkReport.find({
      employeeId: { $in: empIds },
      bankId,
      $or: productConditions,
      isDeleted: { $ne: true },
    }).lean();

    const sumAmountInRange = (start, end) => {
      return workReports
        .filter((r) => r.date >= start && r.date <= end)
        .reduce((sum, r) => sum + r.amount, 0);
    };

    let yearlyAchieved = sumAmountInRange(fyStart, fyEnd);
    let monthlyAchieved = sumAmountInRange(mStart, mEnd);
    let weeklyAchieved = sumAmountInRange(wStart, wEnd);
    let dailyAchieved = sumAmountInRange(dStart, dEnd);

    // If product is Lead Generation, also count actual loans/leads generated by executive
    if (product.toLowerCase() === 'lead generation') {
      const empUserId = employee.userId || employee._id;
      const countLeadsInRange = async (start, end) => {
        try {
          return await Loan.countDocuments({
            $or: [{ createdByExecutiveId: empUserId }, { assignedEmployeeId: empUserId }],
            createdAt: { $gte: start, $lte: end },
            isDeleted: { $ne: true }
          });
        } catch (e) {
          return 0;
        }
      };

      const [yLeads, mLeads, wLeads, dLeads] = await Promise.all([
        countLeadsInRange(fyStart, fyEnd),
        countLeadsInRange(mStart, mEnd),
        countLeadsInRange(wStart, wEnd),
        countLeadsInRange(dStart, dEnd)
      ]);

      yearlyAchieved += yLeads;
      monthlyAchieved += mLeads;
      weeklyAchieved += wLeads;
      dailyAchieved += dLeads;
    }

    const countReportsInRange = (start, end) => {
      return workReports.filter((r) => r.date >= start && r.date <= end).length;
    };

    let yearlyCount = countReportsInRange(fyStart, fyEnd);
    let monthlyCount = countReportsInRange(mStart, mEnd);
    let weeklyCount = countReportsInRange(wStart, wEnd);
    let dailyCount = countReportsInRange(dStart, dEnd);

    if (product.toLowerCase() === 'lead generation') {
      yearlyCount += (yLeads || 0);
      monthlyCount += (mLeads || 0);
      weeklyCount += (wLeads || 0);
      dailyCount += (dLeads || 0);
    }

    const bankDoc = await Bank.findById(bankId).select("productIncentives").lean();
    const universalIncRule = (bankDoc?.productIncentives || []).find(
      (pi) => pi.product.toLowerCase() === product.toLowerCase()
    ) || selectedTarget || {};

    const targetType = selectedTarget?.targetType || 'AMOUNT';
    const yearlyIncentive = this.calculateEarnedIncentive(universalIncRule, yearlyAchieved, yearlyCount || yearlyAchieved, yearlyGoal, targetType);
    const monthlyIncentive = this.calculateEarnedIncentive(universalIncRule, monthlyAchieved, monthlyCount || monthlyAchieved, monthlyGoal, targetType);
    const weeklyIncentive = this.calculateEarnedIncentive(universalIncRule, weeklyAchieved, weeklyCount || weeklyAchieved, weeklyGoal, targetType);
    const dailyIncentive = this.calculateEarnedIncentive(universalIncRule, dailyAchieved, dailyCount || dailyAchieved, dailyGoal, targetType);

    const calcPct = (achieved, goal) => {
      if (goal <= 0) return 0;
      const pct = Math.round((achieved / goal) * 100);
      return Math.min(pct, 100); // capped at 100% for progress bars
    };

    // 3. Compute Granular Source Breakdown Metrics across all modules
    const [allReceipts, allCashSubmissions, allLoans, leadCount] = await Promise.all([
      SocietyReceipt.find({
        $or: [{ createdBy: { $in: empIds } }, { approvedBy: { $in: empIds } }],
        bankId,
        isDeleted: { $ne: true }
      }).select('receiptType amount status').lean().catch(() => []),

      CashSubmission.find({
        $or: [{ employeeId: { $in: empIds } }, { onboardingTeamId: { $in: empIds } }, { createdBy: { $in: empIds } }],
        isDeleted: { $ne: true }
      }).select('amountSubmitted').lean().catch(() => []),

      Loan.find({
        $or: [{ createdByExecutiveId: { $in: empIds } }, { assignedEmployeeId: { $in: empIds } }],
        isDeleted: { $ne: true }
      }).select('disbursementAmount status').lean().catch(() => []),

      Loan.countDocuments({
        $or: [{ createdByExecutiveId: { $in: empIds } }, { assignedEmployeeId: { $in: empIds } }],
        isDeleted: { $ne: true }
      }).catch(() => 0)
    ]);

    let creditCount = 0, creditAmount = 0;
    let debitCount = 0, debitAmount = 0;

    (allReceipts || []).forEach(r => {
      if (r.receiptType === 'CREDIT' || !r.receiptType) {
        creditCount++;
        creditAmount += (r.amount || 0);
      } else if (r.receiptType === 'DEBIT') {
        debitCount++;
        debitAmount += (r.amount || 0);
      }
    });

    if (creditCount === 0 && creditAmount === 0) {
      workReports.filter(w => w.sourceModule === 'RECEIPT').forEach(w => {
        creditCount++;
        creditAmount += (w.amount || 0);
      });
    }

    let cashSubCount = 0, cashSubAmount = 0;
    (allCashSubmissions || []).forEach(c => {
      cashSubCount++;
      cashSubAmount += (c.amountSubmitted || 0);
    });

    let loansCount = 0, loansAmount = 0;
    (allLoans || []).forEach(l => {
      loansCount++;
      loansAmount += (l.disbursementAmount || 0);
    });

    let manualCount = 0, manualAmount = 0;
    workReports.filter(w => w.sourceModule === 'MANUAL').forEach(w => {
      manualCount++;
      manualAmount += (w.amount || 0);
    });

    const breakdown = {
      creditReceipts: {
        count: creditCount,
        amount: creditAmount,
        formattedAmount: this.formatCurrency(creditAmount)
      },
      debitReceipts: {
        count: debitCount,
        amount: debitAmount,
        formattedAmount: this.formatCurrency(debitAmount)
      },
      cashSubmissions: {
        count: cashSubCount,
        amount: cashSubAmount,
        formattedAmount: this.formatCurrency(cashSubAmount)
      },
      loansDisbursed: {
        count: loansCount,
        amount: loansAmount,
        formattedAmount: this.formatCurrency(loansAmount)
      },
      leadsGenerated: {
        count: leadCount
      },
      manualEntries: {
        count: manualCount,
        amount: manualAmount,
        formattedAmount: this.formatCurrency(manualAmount)
      }
    };

    return {
      employee: {
        id: employee._id,
        fullName: employee.fullName,
        designation: employee.designation || employee.roleId?.name || "N/A",
        phoneNumber: employee.phoneNumber || "",
        email: employee.email || "",
        branchName: employee.branchId?.name || "N/A",
      },
      product,
      year,
      incentive: {
        type: yearlyIncentive.type,
        value: yearlyIncentive.value,
        formattedValue: yearlyIncentive.formattedValue
      },
      yearly: {
        goal: yearlyGoal,
        formattedGoal: this.formatCurrency(yearlyGoal),
        achieved: yearlyAchieved,
        formattedAchieved: this.formatCurrency(yearlyAchieved),
        percentage: calcPct(yearlyAchieved, yearlyGoal),
        earnedIncentive: yearlyIncentive.earnedAmount,
        formattedEarnedIncentive: yearlyIncentive.formattedEarnedAmount
      },
      monthly: {
        goal: monthlyGoal,
        formattedGoal: this.formatCurrency(monthlyGoal),
        achieved: monthlyAchieved,
        formattedAchieved: this.formatCurrency(monthlyAchieved),
        percentage: calcPct(monthlyAchieved, monthlyGoal),
        earnedIncentive: monthlyIncentive.earnedAmount,
        formattedEarnedIncentive: monthlyIncentive.formattedEarnedAmount
      },
      weekly: {
        goal: weeklyGoal,
        formattedGoal: this.formatCurrency(weeklyGoal),
        achieved: weeklyAchieved,
        formattedAchieved: this.formatCurrency(weeklyAchieved),
        percentage: calcPct(weeklyAchieved, weeklyGoal),
        earnedIncentive: weeklyIncentive.earnedAmount,
        formattedEarnedIncentive: weeklyIncentive.formattedEarnedAmount
      },
      daily: {
        goal: dailyGoal,
        formattedGoal: this.formatCurrency(dailyGoal),
        achieved: dailyAchieved,
        formattedAchieved: this.formatCurrency(dailyAchieved),
        percentage: calcPct(dailyAchieved, dailyGoal),
        earnedIncentive: dailyIncentive.earnedAmount,
        formattedEarnedIncentive: dailyIncentive.formattedEarnedAmount
      },
      breakdown,
    };
  }

  /**
   * Add a new KPA performance target for an employee
   */
  async addKpaTarget(bankId, employeeId, payload, branchIdFilter = null) {
    const targetEmpId = employeeId || payload.employeeId || payload.id;
    if (!targetEmpId) {
      throw ApiError.badRequest("Employee ID is required for adding KPA target.");
    }

    const empQuery = {
      _id: targetEmpId,
      bankId,
      isDeleted: { $ne: true },
    };

    if (branchIdFilter) {
      if (Array.isArray(branchIdFilter)) {
        empQuery.branchId = { $in: branchIdFilter };
      } else {
        empQuery.branchId = branchIdFilter;
      }
    }

    let employee = await SocietyEmployee.findOne(empQuery);
    if (!employee) {
      employee = await BranchManager.findOne(empQuery);
    }

    if (!employee) {
      throw ApiError.notFound("Society Employee not found under this bank context.");
    }

    const productName = (payload.product || "").trim();
    if (!productName) {
      throw ApiError.badRequest("Target product name is required.");
    }

    const targetValue = Number(payload.targetValue || 0);
    if (isNaN(targetValue) || targetValue < 0) {
      throw ApiError.badRequest("Target value must be a non-negative number.");
    }

    const year = parseInt(payload.year || new Date().getFullYear(), 10);
    const targetType = (payload.targetType || "AMOUNT").toUpperCase();

    if (!employee.kraSettings) {
      employee.kraSettings = { year, targets: [] };
    }
    if (!Array.isArray(employee.kraSettings.targets)) {
      employee.kraSettings.targets = [];
    }

    const existingTargetIndex = employee.kraSettings.targets.findIndex(
      (t) => t.product.toLowerCase() === productName.toLowerCase()
    );

    if (existingTargetIndex !== -1) {
      throw ApiError.conflict(
        `KPA target for product "${productName}" already exists for this employee. Please use the update KPA target endpoint.`
      );
    }

    const newTarget = {
      product: productName,
      productId: payload.productId || null,
      targetType,
      targetValue,
    };

    employee.kraSettings.year = year;
    employee.kraSettings.targets.push(newTarget);
    employee.markModified("kraSettings");
    await employee.save();

    return this.getKpaReportDetail(
      bankId,
      employee._id,
      { year, product: productName },
      branchIdFilter
    );
  }

  /**
   * Update an existing KPA performance target for an employee (with Upsert support)
   */
  async updateKpaTarget(bankId, employeeId, payload, branchIdFilter = null) {
    const targetEmpId = employeeId || payload.employeeId || payload.id;
    if (!targetEmpId) {
      throw ApiError.badRequest("Employee ID is required for updating KPA target.");
    }

    const empQuery = {
      _id: targetEmpId,
      bankId,
      isDeleted: { $ne: true },
    };

    if (branchIdFilter) {
      if (Array.isArray(branchIdFilter)) {
        empQuery.branchId = { $in: branchIdFilter };
      } else {
        empQuery.branchId = branchIdFilter;
      }
    }

    let employee = await SocietyEmployee.findOne(empQuery);
    if (!employee) {
      employee = await BranchManager.findOne(empQuery);
    }

    if (!employee) {
      throw ApiError.notFound("Society Employee not found under this bank context.");
    }

    const productName = (payload.product || "").trim();
    if (!productName) {
      throw ApiError.badRequest("Target product name is required.");
    }

    const targetValue = Number(payload.targetValue || 0);
    if (isNaN(targetValue) || targetValue < 0) {
      throw ApiError.badRequest("Target value must be a non-negative number.");
    }

    const year = parseInt(
      payload.year || employee.kraSettings?.year || new Date().getFullYear(),
      10
    );
    const targetType = (payload.targetType || "AMOUNT").toUpperCase();

    const rawIncType = payload.incentiveType ? String(payload.incentiveType).toUpperCase() : null;
    let normIncType = null;
    if (rawIncType) {
      if (rawIncType === "PRODUCT" || rawIncType === "PERCENTAGE") normIncType = "PRODUCT";
      else if (rawIncType === "QUANTITY" || rawIncType === "PER_UNIT") normIncType = "QUANTITY";
      else normIncType = "NONE";
    }
    const incValue = payload.incentiveValue !== undefined && payload.incentiveValue !== null ? Number(payload.incentiveValue) : null;

    if (!employee.kraSettings) {
      employee.kraSettings = { year, targets: [] };
    }
    if (!Array.isArray(employee.kraSettings.targets)) {
      employee.kraSettings.targets = [];
    }

    employee.kraSettings.year = year;

    const existingTargetIndex = employee.kraSettings.targets.findIndex(
      (t) => t.product.toLowerCase() === productName.toLowerCase()
    );

    if (existingTargetIndex !== -1) {
      employee.kraSettings.targets[existingTargetIndex].targetValue = targetValue;
      if (payload.targetType) {
        employee.kraSettings.targets[existingTargetIndex].targetType = targetType;
      }
      if (payload.productId) {
        employee.kraSettings.targets[existingTargetIndex].productId = payload.productId;
      }
    } else {
      employee.kraSettings.targets.push({
        product: productName,
        productId: payload.productId || null,
        targetType,
        targetValue,
      });
    }

    employee.markModified("kraSettings");
    await employee.save();

    return this.getKpaReportDetail(
      bankId,
      employee._id,
      { year, product: productName },
      branchIdFilter
    );
  }

  /**
   * Helper to return ordinal numbers (1st, 2nd, 3rd, 4th, etc.)
   */
  getOrdinal(n) {
    if (n <= 0) return "";
    let suffix = "th";
    if (n % 10 === 1 && n % 100 !== 11) suffix = "st";
    else if (n % 10 === 2 && n % 100 !== 12) suffix = "nd";
    else if (n % 10 === 3 && n % 100 !== 13) suffix = "rd";
    return `${n}${suffix}`;
  }

  /**
   * Important Dates
   */
  /**
   * Important Dates
   */
  async listImportantDates(bankId, query, branchIdFilter) {
    const filter = { bankId, isDeleted: { $ne: true } };

    // Flexible Branch ID Resolver (handles ObjectIds, strings, arrays, comma-separated values & populated branch objects)
    const branchIdsToMatch = [];
    const extractBranchId = (val) => {
      if (!val) return;
      if (Array.isArray(val)) {
        val.forEach(extractBranchId);
        return;
      }
      let rawStr = '';
      if (typeof val === 'object' && val !== null) {
        rawStr = (val._id || val.id || val).toString().trim();
      } else {
        rawStr = String(val).trim();
      }
      if (!rawStr) return;
      if (rawStr.includes(',')) {
        rawStr.split(',').forEach((s) => extractBranchId(s.trim()));
        return;
      }
      if (mongoose.Types.ObjectId.isValid(rawStr)) {
        branchIdsToMatch.push(new mongoose.Types.ObjectId(rawStr));
      }
      branchIdsToMatch.push(rawStr);
    };

    if (branchIdFilter) {
      extractBranchId(branchIdFilter);
    } else if (
      query.branchIds &&
      (Array.isArray(query.branchIds)
        ? query.branchIds.length > 0
        : String(query.branchIds).trim().length > 0)
    ) {
      extractBranchId(query.branchIds);
    } else if (query.branchId) {
      extractBranchId(query.branchId);
    }

    if (branchIdsToMatch.length > 0) {
      filter.branchId = { $in: branchIdsToMatch };
    }
    

    const andConditions = [];

    if (query.designation) {
      const desigRegex = new RegExp(String(query.designation).trim(), 'i');
      andConditions.push({
        $or: [
          { designation: desigRegex },
          { 'jobDetails.designation': desigRegex },
        ],
      });
    }

    if (query.state) {
      const stateRegex = new RegExp(String(query.state).trim(), 'i');
      andConditions.push({
        $or: [
          { 'jobDetails.state': stateRegex },
          { 'personalDetails.state': stateRegex },
        ],
      });
    }

    if (query.search) {
      const searchRegex = new RegExp(String(query.search).trim(), 'i');
      andConditions.push({
        $or: [
          { fullName: searchRegex },
          { email: searchRegex },
          { phoneNumber: searchRegex },
          { employeeCode: searchRegex },
        ],
      });
    }

    if (andConditions.length > 0) {
      filter.$and = andConditions;
    }

    const employees = await SocietyEmployee.find(filter)
      .populate('branchId')
      .populate('roleId')
      .lean();

    const managers = await BranchManager.find(filter)
      .populate('branchId')
      .lean();

    const userSeen = new Set();
    const allProfiles = [];
    [
      ...managers.map((m) => ({
        ...m,
        type: 'BRANCH_MANAGER',
        designation: m.designation || m.jobDetails?.designation || 'Branch Manager',
      })),
      ...employees.map((e) => ({ ...e, type: 'EMPLOYEE' })),
    ].forEach((p) => {
      const key = p.userId ? p.userId.toString() : p._id.toString();
      if (!userSeen.has(key)) {
        userSeen.add(key);
        allProfiles.push(p);
      }
    });

    const celebrationTypes = query.celebrationTypes || [
      'Birthday',
      'Work Anniversary',
      'Marriage Anniversary',
    ];

    // Helper for robust parsing of dates (ISO, timestamps, Indian DD/MM/YYYY, etc.)
    const parseFlexibleDate = (val) => {
      if (!val) return null;
      if (val instanceof Date && !isNaN(val.getTime())) return val;
      if (typeof val === 'number') {
        const d = new Date(val);
        return !isNaN(d.getTime()) ? d : null;
      }
      if (typeof val === 'string') {
        const str = val.trim();
        if (!str) return null;

        // Standard JS / ISO parse attempt
        const isoDate = new Date(str);
        if (!isNaN(isoDate.getTime())) return isoDate;

        // Try Indian format: DD/MM/YYYY, DD-MM-YYYY, or DD.MM.YYYY
        const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
        if (dmyMatch) {
          const day = parseInt(dmyMatch[1], 10);
          const month = parseInt(dmyMatch[2], 10) - 1;
          const year = parseInt(dmyMatch[3], 10);
          const parsed = new Date(year, month, day);
          if (!isNaN(parsed.getTime())) return parsed;
        }
      }
      return null;
    };

    let filterMonth = null;
    let refDate = new Date();

    if (query.date) {
      const parsedRef = parseFlexibleDate(query.date);
      if (parsedRef) {
        refDate = parsedRef;
        filterMonth = refDate.getMonth();
      }
    } else if (query.month) {
      const parsedMonth = parseInt(query.month, 10);
      if (!isNaN(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12) {
        filterMonth = parsedMonth - 1;
        // Avoid day-of-month overflow by anchoring to the 1st
        refDate = new Date(refDate.getFullYear(), filterMonth, 1);
      }
    }

    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const celebrations = [];

    allProfiles.forEach((emp) => {
      // 1. Birthday
      const dobVal =
        emp.personalDetails?.dateOfBirth ||
        emp.personalDetails?.dob ||
        emp.dateOfBirth ||
        emp.dob;
      const dob = parseFlexibleDate(dobVal);

      if (dob && celebrationTypes.includes('Birthday')) {
        const eventMonth = dob.getMonth();
        if (filterMonth === null || eventMonth === filterMonth) {
          const age = refDate.getFullYear() - dob.getFullYear();
          const ageText = age > 0 ? `${this.getOrdinal(age)} ` : '';

          celebrations.push({
            id: `${emp._id}_bday`,
            employeeId: emp._id,
            employeeName: emp.fullName || 'N/A',
            designation:
              emp.designation ||
              emp.jobDetails?.designation ||
              emp.roleId?.name ||
              (emp.type === 'BRANCH_MANAGER' ? 'Branch Manager' : 'Employee'),
            state: emp.jobDetails?.state || emp.personalDetails?.state || emp.branchId?.state || emp.branchId?.address?.state || 'N/A',
            branch: emp.branchId?.name || 'N/A',
            type: 'Birthday',
            celebration: `${ageText}Birthday`,
            date: dob,
            day: dob.getDate(),
            monthIndex: eventMonth,
            monthName: monthNames[eventMonth],
          });
        }
      }

      // 2. Work Anniversary
      const joiningVal =
        emp.jobDetails?.joiningDate ||
        emp.joiningDate ||
        emp.dateOfJoining ||
        emp.createdAt;
      const joining = parseFlexibleDate(joiningVal);

      if (joining && celebrationTypes.includes('Work Anniversary')) {
        const eventMonth = joining.getMonth();
        if (filterMonth === null || eventMonth === filterMonth) {
          const years = refDate.getFullYear() - joining.getFullYear();
          const yearText =
            years > 0 ? `${years} Year${years > 1 ? 's' : ''}` : 'Joining';

          celebrations.push({
            id: `${emp._id}_work`,
            employeeId: emp._id,
            employeeName: emp.fullName || 'N/A',
            designation:
              emp.designation ||
              emp.jobDetails?.designation ||
              emp.roleId?.name ||
              (emp.type === 'BRANCH_MANAGER' ? 'Branch Manager' : 'Employee'),
            state: emp.jobDetails?.state || emp.personalDetails?.state || emp.branchId?.state || emp.branchId?.address?.state || 'N/A',
            branch: emp.branchId?.name || 'N/A',
            type: 'Work Anniversary',
            celebration: `${yearText} Work Anniversary`,
            date: joining,
            day: joining.getDate(),
            monthIndex: eventMonth,
            monthName: monthNames[eventMonth],
          });
        }
      }

      // 3. Marriage Anniversary
      const marriageVal =
        emp.marriageAnniversaryDate ||
        emp.marriageAnniversary ||
        emp.personalDetails?.marriageAnniversaryDate ||
        emp.personalDetails?.marriageAnniversary;
      const marriage = parseFlexibleDate(marriageVal);

      if (marriage && celebrationTypes.includes('Marriage Anniversary')) {
        const eventMonth = marriage.getMonth();
        if (filterMonth === null || eventMonth === filterMonth) {
          const years = refDate.getFullYear() - marriage.getFullYear();
          const yearText = years > 0 ? `${this.getOrdinal(years)} ` : '';

          celebrations.push({
            id: `${emp._id}_marriage`,
            employeeId: emp._id,
            employeeName: emp.fullName || 'N/A',
            designation:
              emp.designation ||
              emp.jobDetails?.designation ||
              emp.roleId?.name ||
              (emp.type === 'BRANCH_MANAGER' ? 'Branch Manager' : 'Employee'),
            state: emp.jobDetails?.state || emp.personalDetails?.state || emp.branchId?.state || emp.branchId?.address?.state || 'N/A',
            branch: emp.branchId?.name || 'N/A',
            type: 'Marriage Anniversary',
            celebration: `${yearText}Marriage Anniversary`,
            date: marriage,
            day: marriage.getDate(),
            monthIndex: eventMonth,
            monthName: monthNames[eventMonth],
          });
        }
      }
    });

    // Sort by Month Index ascending, then Day of month ascending
    celebrations.sort((a, b) => {
      if (a.monthIndex !== b.monthIndex) return a.monthIndex - b.monthIndex;
      return a.day - b.day;
    });

    // Add Sr.No.
    return celebrations.map((c, idx) => ({
      srNo: idx + 1,
      ...c,
    }));
  }

  /**
   * PDF Document Layout Generation Helpers
   */
  async getEmployeeContext(bankId, employeeId, societyContext = null) {
    let employee = await SocietyEmployee.findOne({
      _id: employeeId,
      bankId,
      isDeleted: { $ne: true },
    })
      .populate("branchId")
      .populate("roleId")
      .lean();

    if (!employee && bankId) {
      employee = await SocietyEmployee.findOne({
        _id: employeeId,
        isDeleted: { $ne: true },
      })
        .populate("branchId")
        .populate("roleId")
        .lean();
    }

    if (!employee) {
      employee = await BranchManager.findOne({
        _id: employeeId,
        bankId,
        isDeleted: { $ne: true },
      })
        .populate("branchId")
        .populate("roleId")
        .lean();

      if (!employee && bankId) {
        employee = await BranchManager.findOne({
          _id: employeeId,
          isDeleted: { $ne: true },
        })
          .populate("branchId")
          .populate("roleId")
          .lean();
      }
    }

    if (!employee) {
      throw ApiError.notFound("Society Employee not found.");
    }

    if (
      societyContext &&
      !societyContext.isBankOwner &&
      societyContext.branchId
    ) {
      const empBranchStr = (
        employee.branchId?._id ||
        employee.branchId ||
        ""
      ).toString();
      const userBranchStr = societyContext.branchId.toString();
      if (empBranchStr && empBranchStr !== userBranchStr) {
        throw ApiError.forbidden(
          "Access denied. You can only manage employees associated with your branch.",
        );
      }
    }

    return employee;
  }

  async generateOfferLetter(bankId, payload, societyContext = null) {
    return offerLetterService.generateOfferLetter(
      bankId,
      payload,
      societyContext,
    );
  }

  async generateConfirmationLetter(bankId, payload, societyContext = null) {
    return confirmationLetterService.generateConfirmationLetter(
      bankId,
      payload,
      societyContext,
    );
  }

  async generatePerformanceLetter(bankId, payload, societyContext = null) {
    return performanceLetterService.generatePerformanceLetter(
      bankId,
      payload,
      societyContext,
    );
  }

  async generatePromotionLetter(bankId, payload, societyContext = null) {
    return promotionLetterService.generatePromotionLetter(
      bankId,
      payload,
      societyContext,
    );
  }

  async generateTransferLetter(bankId, payload, societyContext = null) {
    return transferLetterService.generateTransferLetter(
      bankId,
      payload,
      societyContext,
    );
  }

  async generateSalarySlip(bankId, payload, societyContext = null) {
    return salarySlipService.generateSalarySlip(
      bankId,
      payload,
      societyContext,
    );
  }

  async generateSalaryIncrement(bankId, payload, societyContext = null) {
    return salaryIncrementLetterService.generateSalaryIncrement(
      bankId,
      payload,
      societyContext,
    );
  }

  async generateTerminationLetter(bankId, payload, societyContext = null) {
    const emp = await this.getEmployeeContext(
      bankId,
      payload.employeeId,
      societyContext,
    );
    const bank = await Bank.findById(bankId)
      .select("name signatoryName signatoryDesignation signatureUrl")
      .lean();
    const bankName = bank?.name || "Sahayaone Credit Co-operative Bank";

    const termDate = new Date(
      payload.terminationDate || Date.now(),
    ).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const reasonText =
      payload.reason || "Administrative / Management Decision";
    const noticeDays =
      payload.noticePeriodDays !== undefined &&
      payload.noticePeriodDays !== null
        ? `${payload.noticePeriodDays} Days`
        : "As per company policy";
    const refNo = `TERM/${new Date().getFullYear()}/${emp._id.toString().slice(-4)}`;
    const letterDate = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const signatoryName =
      payload.signatoryName || bank?.signatoryName || "Authorized Signatory";
    const signatoryDesignation =
      payload.signatoryDesignation ||
      bank?.signatoryDesignation ||
      "Head - Human Resources";

    // Resolve Signature Image Buffer
    const signatureInput =
      payload.signatureUrl ||
      payload.signatureBase64 ||
      payload.signatureImage ||
      bank?.signatureUrl ||
      null;
    const signatureBuffer = await this.resolveImageBuffer(signatureInput);

    if (!signatureBuffer) {
      throw ApiError.badRequest(
        "Official Bank Authorized Signature image is required to generate employee letters. Please upload the bank signature first.",
      );
    }

    // Generate PDF via PDFKit
    const PDFDocument = (await import("pdfkit")).default;
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const buffers = [];
    doc.on("data", (chunk) => buffers.push(chunk));

    const candidateName = emp.fullName || "Employee";
    const designation =
      payload.designation ||
      emp.designation ||
      emp.roleId?.name ||
      "Staff Member";

    // Header
    doc
      .fillColor("#0F172A")
      .fontSize(16)
      .font("Helvetica-Bold")
      .text(bankName.toUpperCase(), { align: "center" });
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("EMPLOYMENT TERMINATION NOTICE", { align: "center" });
    doc.moveDown(1);

    doc.fontSize(9).font("Helvetica").text(`Ref No: ${refNo}`, 40, doc.y);
    doc.text(`Date: ${letterDate}`, 400, doc.y - 12, { align: "right" });
    doc.moveDown(1.5);

    doc.font("Helvetica-Bold").text(`To,\n${candidateName}`);
    doc
      .font("Helvetica")
      .text(
        `Designation: ${designation}\nBranch: ${emp.branchId?.name || "Main Branch"}`,
      );
    doc.moveDown(1);

    doc.font("Helvetica").text(`Dear ${candidateName},`);
    doc.moveDown(0.5);

    doc.text(
      `We regret to inform you that your employment with ${bankName} stands terminated effective from ${termDate}.`,
      { align: "justify" },
    );
    doc.moveDown(0.5);

    doc.text(`Termination Details:`);
    doc
      .font("Helvetica-Bold")
      .text(`• Effective Date of Termination: `, { continued: true })
      .font("Helvetica")
      .text(termDate);
    doc
      .font("Helvetica-Bold")
      .text(`• Notice Period: `, { continued: true })
      .font("Helvetica")
      .text(noticeDays);
    doc
      .font("Helvetica-Bold")
      .text(`• Reason for Termination: `, { continued: true })
      .font("Helvetica")
      .text(reasonText);
    doc.moveDown(1);

    doc
      .font("Helvetica")
      .text(
        `You are requested to complete your exit clearance, handover your duties, and return all company assets, badges, and confidential documents to the HR department on or before your last working day. Your full and final settlement will be processed as per society bank guidelines.`,
        { align: "justify" },
      );
    doc.moveDown(2);

    // Signature Block
    const sigY = doc.y;
    doc.font("Helvetica-Bold").fontSize(9).text(`For ${bankName}`, 40, sigY);

    let sigLineOffset = 30;
    if (signatureBuffer) {
      try {
        doc.image(signatureBuffer, 40, sigY + 12, { fit: [130, 32] });
        sigLineOffset = 46;
      } catch (err) {
        logger.warn(
          `Failed to render signature in termination letter: ${err.message}`,
        );
      }
    }

    doc.text("_______________________________", 40, sigY + sigLineOffset);
    doc.text("Authorised Signatory", 40, sigY + sigLineOffset + 12);
    doc
      .font("Helvetica")
      .text(`Name: ${signatoryName}`, 40, sigY + sigLineOffset + 24);
    doc
      .text(
        `Designation: ${signatoryDesignation}`,
        40,
        sigY + sigLineOffset + 36,
      );

    doc.end();

    const pdfBuffer = await new Promise((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(buffers)));
    });

    // Upload Document to Storage (S3 / Local)
    const fileObj = {
      buffer: pdfBuffer,
      originalname: `Termination_Letter_${refNo.replace(/[\/\\]/g, "_")}.pdf`,
      mimetype: "application/pdf",
    };

    const folderPath = `society/employees/${bankId}/${emp._id}/termination-letter`;
    const uploadResult = await storageManager
      .uploadFile(fileObj, folderPath)
      .catch((err) => {
        logger.warn(
          `Failed to upload termination letter to storage: ${err.message}`,
        );
        return {};
      });

    const fileUrl = uploadResult?.fileUrl || uploadResult?.url || "";
    const fileKey = uploadResult?.key || uploadResult?.filePath || "";

    // Create EmployeeLetterLog record
    const letterLog = await EmployeeLetterLog.create({
      bankId,
      branchId: emp.branchId?._id || emp.branchId || null,
      employeeId: emp._id,
      referenceNumber: refNo,
      employeeName: emp.fullName,
      employeeEmail: emp.email || "",
      documentType: "Termination Letter",
      documentTypeCode: "TERMINATION_LETTER",
      issuedDate: new Date(),
      detailsSummary: `Effective: ${termDate} | Notice: ${noticeDays}`,
      fileUrl,
      fileKey,
      metadata: {
        terminationDate: payload.terminationDate,
        noticePeriodDays: payload.noticePeriodDays,
        reason: payload.reason,
      },
    }).catch((err) =>
      logger.error(`Failed to create Termination Letter log: ${err.message}`),
    );

    return {
      success: true,
      message: "Termination letter generated successfully.",
      data: {
        employeeId: emp._id,
        referenceNumber: refNo,
        fileUrl,
        fileKey,
        generatedAt: new Date(),
      },
      pdfBuffer: buffer,
    };
  }

  /**
   * Format Date into Indian format DD/MM/YYYY in Asia/Kolkata timezone
   */
  formatDateIndia(dateInput) {
    if (!dateInput) return "-";
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "-";

    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
  }

  /**
   * Seed initial sample letter history logs if bank has 0 logs
   */
  async seedSampleLetterLogs(bankId) {
    try {
      const employees = await SocietyEmployee.find({
        bankId,
        isDeleted: { $ne: true },
      })
        .populate("branchId")
        .limit(10)
        .lean();

      if (!employees || employees.length === 0) return;

      const sampleLogs = [];
      const currentYear = new Date().getFullYear();

      employees.forEach((emp, i) => {
        const empBranch = emp.branchId?._id || null;
        const branchCode = emp.branchId?.name
          ? emp.branchId.name
              .toUpperCase()
              .substring(0, 6)
              .replace(/[^A-Z]/g, "")
          : "KHAMLA";

        // 1. Offer Letter
        sampleLogs.push({
          bankId,
          branchId: empBranch,
          employeeId: emp._id,
          referenceNumber: `${branchCode}/HR/OL/${currentYear}/${String(i + 1).padStart(3, "0")}`,
          employeeName: emp.fullName || "Employee Name",
          employeeEmail: emp.email || "",
          documentType: "Offer Letter",
          documentTypeCode: "OFFER_LETTER",
          issuedDate: new Date(Date.now() - (30 - i) * 86400000),
          detailsSummary: `Designation: ${emp.designation || "Senior Officer"} | CTC: ₹${Number(emp.jobDetails?.salary || 450000).toLocaleString("en-IN")}`,
          fileUrl: emp.offerLetter?.url || "",
          metadata: {
            designation: emp.designation,
            totalCtc: emp.jobDetails?.salary,
          },
        });

        // 2. Salary Slip
        sampleLogs.push({
          bankId,
          branchId: empBranch,
          employeeId: emp._id,
          referenceNumber: `${branchCode}/HR/SS/${currentYear}/08/${String(i + 1).padStart(3, "0")}`,
          employeeName: emp.fullName || "Employee Name",
          employeeEmail: emp.email || "",
          documentType: "Salary Slip",
          documentTypeCode: "SALARY_SLIP",
          issuedDate: new Date(Date.now() - (15 - i) * 86400000),
          detailsSummary: `Period: August ${currentYear} | Net Salary: ₹${Number(Math.round((emp.jobDetails?.salary || 450000) / 12)).toLocaleString("en-IN")}`,
          fileUrl: emp.salarySlip?.url || "",
          metadata: { payPeriod: `August ${currentYear}` },
        });

        // 3. Confirmation Letter
        sampleLogs.push({
          bankId,
          branchId: empBranch,
          employeeId: emp._id,
          referenceNumber: `${branchCode}/HR/CL/${currentYear}/${String(i + 1).padStart(3, "0")}`,
          employeeName: emp.fullName || "Employee Name",
          employeeEmail: emp.email || "",
          documentType: "Confirmation Letter",
          documentTypeCode: "CONFIRMATION_LETTER",
          issuedDate: new Date(Date.now() - (5 - i) * 86400000),
          detailsSummary: `Confirmation: 01/08/${currentYear} | Notice: 60 Days`,
          fileUrl: emp.confirmationLetter?.url || "",
          metadata: { noticePeriodDays: 60 },
        });
      });

      if (sampleLogs.length > 0) {
        await EmployeeLetterLog.insertMany(sampleLogs).catch(() => {});
      }
    } catch (err) {
      // ignore seeding errors
    }
  }

  /**
   * List Employee Letter History Logs
   * Filters: employeeId, branchId, city, state, documentType/documentTypeCode, search
   * Access: Bank Owner can view across ALL branches. Branch Manager is scoped to their assigned branch.
   */
  async listLetterHistory(bankId, queryOptions = {}, societyContext = {}) {
    const isBankOwner = Boolean(societyContext.isBankOwner);
    const isBranchManager = Boolean(societyContext.isBranchManager);
    const userBranchId = societyContext.branchId || null;

    const page = parseInt(queryOptions.page || "1", 10);
    const limit = parseInt(queryOptions.limit || "10", 10);
    const skip = (page - 1) * limit;

    // Parse location filters (city and state)
    const parseLocationFilter = (val) => {
      if (!val) return [];
      if (Array.isArray(val))
        return val.map((s) => String(s).trim()).filter(Boolean);
      return String(val)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    };

    const cityFilters = parseLocationFilter(queryOptions.city);
    const stateFilters = parseLocationFilter(queryOptions.state);

    // 1. Resolve location branch IDs if city or state filters are present
    let locationBranchIds = null;
    if (cityFilters.length > 0 || stateFilters.length > 0) {
      const branchQuery = { bankId, isDeleted: { $ne: true } };
      const andConditions = [];

      if (cityFilters.length > 0) {
        const cityRegexes = cityFilters.map(
          (c) => new RegExp(c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
        );
        andConditions.push({
          $or: [
            { city: { $in: cityRegexes } },
            { "address.city": { $in: cityRegexes } },
          ],
        });
      }

      if (stateFilters.length > 0) {
        const stateRegexes = stateFilters.map(
          (s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
        );
        andConditions.push({
          $or: [
            { state: { $in: stateRegexes } },
            { "address.state": { $in: stateRegexes } },
          ],
        });
      }

      if (andConditions.length > 0) {
        branchQuery.$and = andConditions;
      }

      const matchingBranches = await Branch.find(branchQuery)
        .select("_id")
        .lean();
      locationBranchIds = matchingBranches.map((b) => b._id.toString());
    }

    // 2. Build Base Filter for EmployeeLetterLog
    const filter = { bankId, isDeleted: { $ne: true } };

    // Branch Scoping:
    // Bank Owner can access all branches unless specific branchId/city/state filter is requested
    const requestedBranchId =
      queryOptions.branchId || queryOptions.branch || null;
    if (isBankOwner) {
      if (requestedBranchId) {
        filter.branchId = requestedBranchId;
      } else if (locationBranchIds !== null) {
        filter.branchId = { $in: locationBranchIds };
      }
    } else {
      // Non Bank Owner (e.g. Branch Manager): Scoped to their assigned branch
      if (userBranchId) {
        if (
          locationBranchIds !== null &&
          !locationBranchIds.includes(userBranchId.toString())
        ) {
          filter.branchId = { $in: [] };
        } else {
          filter.branchId = userBranchId;
        }
      } else if (requestedBranchId) {
        filter.branchId = requestedBranchId;
      } else if (locationBranchIds !== null) {
        filter.branchId = { $in: locationBranchIds };
      }
    }

    // Filter by Employee ID
    const employeeIdFilter = queryOptions.employeeId || queryOptions.id || null;
    if (employeeIdFilter) {
      filter.employeeId = employeeIdFilter;
    }

    // Filter by Document Type / Document Type Code
    const docTypeFilter = (
      queryOptions.documentType ||
      queryOptions.documentTypeCode ||
      queryOptions.type ||
      ""
    ).trim();
    if (docTypeFilter && docTypeFilter.toUpperCase() !== "ALL") {
      const typeCodeMap = {
        "OFFER LETTER": "OFFER_LETTER",
        "CONFIRMATION LETTER": "CONFIRMATION_LETTER",
        "PERFORMANCE LETTER": "PERFORMANCE_LETTER",
        "PROMOTION LETTER": "PROMOTION_LETTER",
        "TRANSFER LETTER": "TRANSFER_LETTER",
        "SALARY SLIP": "SALARY_SLIP",
        "SALARY INCREMENT": "SALARY_INCREMENT",
        "TERMINATION LETTER": "TERMINATION_LETTER",
      };

      const codeUpper =
        typeCodeMap[docTypeFilter.toUpperCase()] || docTypeFilter.toUpperCase();
      filter.$or = [
        { documentTypeCode: codeUpper },
        { documentType: new RegExp(docTypeFilter, "i") },
      ];
    }

    // Search Filter
    if (queryOptions.search && queryOptions.search.trim()) {
      const searchRegex = new RegExp(
        queryOptions.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );
      const searchConditions = [
        { referenceNumber: searchRegex },
        { employeeName: searchRegex },
        { employeeEmail: searchRegex },
        { detailsSummary: searchRegex },
        { documentType: searchRegex },
      ];

      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
        delete filter.$or;
      } else {
        filter.$or = searchConditions;
      }
    }

    // Seed sample history if 0 logs exist in DB for this bank
    const totalCountInBank = await EmployeeLetterLog.countDocuments({
      bankId,
      isDeleted: { $ne: true },
    });
    if (totalCountInBank === 0) {
      await this.seedSampleLetterLogs(bankId);
    }

    const totalRecords = await EmployeeLetterLog.countDocuments(filter);
    const sortBy = queryOptions.sortBy || "issuedDate";
    const sortOrder = queryOptions.sortOrder === "asc" ? 1 : -1;

    const logs = await EmployeeLetterLog.find(filter)
      .populate("branchId", "name city state address")
      .populate(
        "employeeId",
        "fullName email employeeCode branchId designation",
      )
      .sort({ [sortBy]: sortOrder, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const items = logs.map((log, idx) => ({
      srNo: skip + idx + 1,
      id: log._id,
      referenceNumber: log.referenceNumber,
      employeeId: log.employeeId?._id || log.employeeId,
      employeeName: log.employeeName || log.employeeId?.fullName || "N/A",
      employeeEmail: log.employeeEmail || log.employeeId?.email || "",
      employeeCode: log.employeeId?.employeeCode || "",
      branchId: log.branchId?._id || log.branchId || null,
      branchName: log.branchId?.name || "Head Office Branch",
      branchCity: log.branchId?.address?.city || log.branchId?.city || "",
      branchState: log.branchId?.address?.state || log.branchId?.state || "",
      documentType: log.documentType,
      documentTypeCode: log.documentTypeCode,
      issuedDate: log.issuedDate || log.createdAt,
      formattedIssuedDate: this.formatDateIndia(
        log.issuedDate || log.createdAt,
      ),
      detailsSummary: log.detailsSummary || "",
      fileUrl: log.fileUrl || "",
      fileKey: log.fileKey || "",
      metadata: log.metadata || {},
      createdAt: log.createdAt,
    }));

    const totalPages = Math.ceil(totalRecords / limit);

    return {
      items,
      meta: {
        totalRecords,
        limit,
        page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Get Employee Breakdown summary metrics and full employee list (unpaginated)
   * Filters: search, employeeId / employeeCode, branchId / branchIds, status, department, designations, states
   * Note: For Branch Users (Branch Manager), branchIdFilter is locked to their assigned branch.
   */
  async getEmployeeBreakdown(bankId, query, branchIdFilter) {
    const filter = { bankId };

    // 1. Status Filter
    if (query.status && query.status.toUpperCase() !== "ALL") {
      if (query.status.toUpperCase() === "DELETED") {
        filter.isDeleted = true;
      } else {
        filter.status = query.status.toUpperCase();
        filter.isDeleted = { $ne: true };
      }
    } else {
      filter.isDeleted = { $ne: true };
    }

    // 2. Branch Filter (context branch lock takes precedence for branch users)
    if (branchIdFilter) {
      if (Array.isArray(branchIdFilter)) {
        filter.branchId = { $in: branchIdFilter };
      } else {
        filter.branchId = branchIdFilter;
      }
    } else if (query.branchIds && query.branchIds.length > 0) {
      filter.branchId = { $in: query.branchIds };
    } else if (query.branchId) {
      filter.branchId = query.branchId;
    }

    // 3. Department Filter
    if (query.department && query.department.length > 0) {
      const depts = Array.isArray(query.department)
        ? query.department
        : [query.department];
      filter.$or = [
        { department: { $in: depts } },
        { "jobDetails.department": { $in: depts } },
        { "personalDetails.department": { $in: depts } },
      ];
    }

    // 4. Designations Filter
    if (query.designations && query.designations.length > 0) {
      const desgs = Array.isArray(query.designations)
        ? query.designations
        : [query.designations];
      const desgConditions = [
        { designation: { $in: desgs } },
        { "jobDetails.designation": { $in: desgs } },
      ];
      if (filter.$or) {
        filter.$and = filter.$and || [];
        filter.$and.push({ $or: filter.$or });
        filter.$and.push({ $or: desgConditions });
        delete filter.$or;
      } else {
        filter.$or = desgConditions;
      }
    }

    // 5. States Filter
    if (query.states && query.states.length > 0) {
      const states = Array.isArray(query.states)
        ? query.states
        : [query.states];
      filter["jobDetails.state"] = { $in: states };
    }

    // 6. Search by Employee ID / Employee Code
    const empIdFilter = (query.employeeId || query.employeeCode || "").trim();
    if (empIdFilter) {
      const empIdConditions = [{ employeeCode: new RegExp(empIdFilter, "i") }];
      if (/^[0-9a-fA-F]{24}$/.test(empIdFilter)) {
        empIdConditions.push({ _id: empIdFilter });
      }

      if (filter.$and) {
        filter.$and.push({ $or: empIdConditions });
      } else if (filter.$or) {
        const existingOr = filter.$or;
        delete filter.$or;
        filter.$and = [{ $or: existingOr }, { $or: empIdConditions }];
      } else {
        filter.$or = empIdConditions;
      }
    }

    // 7. General Search filter (fullName, employeeCode, email, phoneNumber)
    const searchFilter = (query.search || "").trim();
    if (searchFilter) {
      const searchRegex = new RegExp(searchFilter, "i");
      const searchConditions = [
        { fullName: searchRegex },
        { employeeCode: searchRegex },
        { email: searchRegex },
        { phoneNumber: searchRegex },
      ];

      if (filter.$and) {
        filter.$and.push({ $or: searchConditions });
      } else if (filter.$or) {
        const existingOr = filter.$or;
        delete filter.$or;
        filter.$and = [{ $or: existingOr }, { $or: searchConditions }];
      } else {
        filter.$or = searchConditions;
      }
    }

    // Sorting
    const sortField = query.sortBy || "createdAt";
    const sortOrder =
      (query.sortOrder || "desc").toLowerCase() === "asc" ? 1 : -1;

    // Fetch all matching employees (unpaginated)
    const employees = await SocietyEmployee.find(filter)
      .populate("branchId", "name code state address")
      .populate("roleId", "name code")
      .sort({ [sortField]: sortOrder })
      .lean();

    // Compute aggregate breakdown stats
    let activeCount = 0;
    let inactiveCount = 0;
    let totalSalaryBudget = 0;
    let validSalaryCount = 0;
    let minSalary = Infinity;
    let maxSalary = 0;

    const departmentMap = {};
    const designationMap = {};
    const branchMap = {};
    const genderMap = { MALE: 0, FEMALE: 0, OTHER: 0 };

    employees.forEach((emp) => {
      if (emp.status === "ACTIVE") activeCount++;
      else if (emp.status === "INACTIVE") inactiveCount++;

      const dept =
        emp.department ||
        emp.jobDetails?.department ||
        emp.personalDetails?.department ||
        "Unassigned";
      departmentMap[dept] = (departmentMap[dept] || 0) + 1;

      const desg =
        emp.designation ||
        emp.roleId?.name ||
        emp.jobDetails?.designation ||
        "EMPLOYEE";
      designationMap[desg] = (designationMap[desg] || 0) + 1;

      const branchName = emp.branchId?.name || "Unassigned";
      branchMap[branchName] = (branchMap[branchName] || 0) + 1;

      const gender = (
        emp.personalDetails?.gender ||
        emp.gender ||
        "MALE"
      ).toUpperCase();
      if (genderMap[gender] !== undefined) {
        genderMap[gender]++;
      } else {
        genderMap.OTHER = (genderMap.OTHER || 0) + 1;
      }

      const sal = Number(emp.jobDetails?.salary || emp.salary || 0);
      if (sal > 0) {
        totalSalaryBudget += sal;
        validSalaryCount++;
        if (sal < minSalary) minSalary = sal;
        if (sal > maxSalary) maxSalary = sal;
      }
    });

    const totalCount = employees.length;
    const avgSalary =
      validSalaryCount > 0
        ? Math.round(totalSalaryBudget / validSalaryCount)
        : 0;
    if (minSalary === Infinity) minSalary = 0;

    const formatBreakdownMap = (mapObj) => {
      const result = {};
      Object.keys(mapObj).forEach((key) => {
        const count = mapObj[key];
        const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
        result[key] = { count, percentage: pct };
      });
      return result;
    };

    const breakdown = {
      totalEmployees: totalCount,
      activeEmployees: activeCount,
      inactiveEmployees: inactiveCount,
      departmentWise: formatBreakdownMap(departmentMap),
      designationWise: formatBreakdownMap(designationMap),
      branchWise: formatBreakdownMap(branchMap),
      genderRatio: genderMap,
      salarySummary: {
        totalMonthlyBudget: totalSalaryBudget,
        formattedTotalMonthlyBudget: this.formatCurrency(totalSalaryBudget),
        averageSalary: avgSalary,
        formattedAverageSalary: this.formatCurrency(avgSalary),
        minSalary,
        formattedMinSalary: this.formatCurrency(minSalary),
        maxSalary,
        formattedMaxSalary: this.formatCurrency(maxSalary),
      },
    };

    const items = employees.map((emp, idx) => {
      const dept =
        emp.department ||
        emp.jobDetails?.department ||
        emp.personalDetails?.department ||
        "N/A";
      const desg =
        emp.designation ||
        emp.roleId?.name ||
        emp.jobDetails?.designation ||
        "N/A";
      const sal = Number(emp.jobDetails?.salary || emp.salary || 0);
      const joiningDate =
        emp.jobDetails?.joiningDate || emp.joiningDate || emp.createdAt;

      return {
        srNo: idx + 1,
        id: emp._id,
        employeeCode: emp.employeeCode || emp._id,
        employeeId: emp.employeeCode || emp._id,
        fullName: emp.fullName,
        email: emp.email,
        phoneNumber: emp.phoneNumber,
        designation: desg,
        department: dept,
        branch: {
          id: emp.branchId?._id || emp.branchId || null,
          name: emp.branchId?.name || "N/A",
          code: emp.branchId?.code || "",
          state: emp.branchId?.state || emp.branchId?.address?.state || "",
        },
        status: emp.status || "ACTIVE",
        salary: sal,
        formattedSalary: this.formatCurrency(sal),
        joiningDate,
        dutyHours:
          emp.dutyHours || emp.personalDetails?.dutyHours || "09:30 to 18:30",
        weeklyOff: emp.weeklyOff || emp.personalDetails?.weeklyOff || "Sunday",
      };
    });

    return {
      breakdown,
      items,
      totalRecords: totalCount,
    };
  }

  /**
   * Helper to resolve an Image URL, local file path, or Base64 string into a Buffer for PDFKit
   */
  async resolveImageBuffer(imageInput) {
    if (!imageInput) return null;
    try {
      if (Buffer.isBuffer(imageInput)) {
        return imageInput;
      }

      if (typeof imageInput === "string") {
        const str = imageInput.trim();

        // 1. Data URI / Base64 String
        if (str.startsWith("data:") || str.includes(";base64,")) {
          const base64Data = str.includes(";base64,") ? str.split(";base64,")[1] : str;
          return Buffer.from(base64Data, "base64");
        }

        // 2. HTTP / HTTPS Remote URL (S3, Cloudinary, CDN)
        if (str.startsWith("http://") || str.startsWith("https://")) {
          const res = await fetch(str);
          if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            return Buffer.from(arrayBuffer);
          }
        }

        // 3. Local File System Path
        if (fs.existsSync(str)) {
          return fs.readFileSync(str);
        }
      }
    } catch (err) {
      logger.warn(`resolveImageBuffer: Failed to resolve image buffer: ${err.message}`);
    }
    return null;
  }

  /**
   * Update Bank Signature Image & Signatory Profile Settings
   */
  async updateBankSignature(bankId, payload = {}, file = null) {
    if (!bankId) {
      throw ApiError.badRequest("Bank ID is required.");
    }

    const bank = await Bank.findOne({ _id: bankId, isDeleted: { $ne: true } });
    if (!bank) {
      throw ApiError.notFound("Co-operative Bank record not found.");
    }

    let signatureUrl = payload.signatureUrl || payload.signatureImage || bank.signatureUrl || null;
    let signatureKey = bank.signatureKey || null;

    // Delete existing signature file from storage/S3 if a new file or base64 is being uploaded
    if ((file || payload.signatureBase64) && bank.signatureKey) {
      try {
        await storageManager.deleteFile(bank.signatureKey);
        logger.info(`Deleted existing bank signature file from S3: ${bank.signatureKey}`);
      } catch (delErr) {
        logger.warn(`Failed to delete existing bank signature file ${bank.signatureKey}: ${delErr.message}`);
      }
    }

    // Handle File Upload if passed via Multer (req.file)
    if (file) {
      const folderPath = `society/banks/${bankId}/signature`;
      const fileObj = {
        buffer: file.buffer,
        originalname: file.originalname || "bank_signature.png",
        mimetype: file.mimetype || "image/png",
      };
      const uploadResult = await storageManager.uploadFile(fileObj, folderPath);
      signatureUrl = uploadResult.fileUrl || uploadResult.url || signatureUrl;
      signatureKey = uploadResult.key || uploadResult.filePath || signatureKey;
    } else if (payload.signatureBase64) {
      // Handle Base64 Upload
      const base64Str = payload.signatureBase64.includes(";base64,")
        ? payload.signatureBase64.split(";base64,")[1]
        : payload.signatureBase64;
      const fileBuffer = Buffer.from(base64Str, "base64");
      const folderPath = `society/banks/${bankId}/signature`;
      const fileObj = {
        buffer: fileBuffer,
        originalname: "bank_signature.png",
        mimetype: "image/png",
      };
      const uploadResult = await storageManager.uploadFile(fileObj, folderPath);
      signatureUrl = uploadResult.fileUrl || uploadResult.url || signatureUrl;
      signatureKey = uploadResult.key || uploadResult.filePath || signatureKey;
    }

    if (payload.signatoryName) {
      bank.signatoryName = payload.signatoryName.trim();
    }
    if (payload.signatoryDesignation) {
      bank.signatoryDesignation = payload.signatoryDesignation.trim();
    }
    if (signatureUrl) {
      bank.signatureUrl = signatureUrl;
    }
    if (signatureKey) {
      bank.signatureKey = signatureKey;
    }

    await bank.save();

    return {
      bankId: bank._id,
      bankName: bank.name,
      signatoryName: bank.signatoryName,
      signatoryDesignation: bank.signatoryDesignation,
      signatureUrl: bank.signatureUrl,
      signatureKey: bank.signatureKey,
      updatedAt: bank.updatedAt,
    };
  }

  /**
   * Get Bank Signature & Signatory Profile Settings
   */
  async getBankSignature(bankId) {
    if (!bankId) {
      throw ApiError.badRequest("Bank ID is required.");
    }

    const bank = await Bank.findOne({ _id: bankId, isDeleted: { $ne: true } })
      .select("name signatoryName signatoryDesignation signatureUrl signatureKey")
      .lean();

    if (!bank) {
      throw ApiError.notFound("Co-operative Bank record not found.");
    }

    return {
      bankId: bank._id,
      bankName: bank.name,
      signatoryName: bank.signatoryName || "Authorized Signatory",
      signatoryDesignation: bank.signatoryDesignation || "Head - Human Resources",
      signatureUrl: bank.signatureUrl || null,
      signatureKey: bank.signatureKey || null,
    };
  }
}

export const societyEmployeeHrService = new SocietyEmployeeHrService();
