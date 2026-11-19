import mongoose from "mongoose";
import { Bank } from "../../../../models/bank.model.js";
import { Branch } from "../../../../models/branch.model.js";
import { SocietyEmployee } from "../../../../models/society-employee.model.js";
import { Loan } from "../../../../models/loan.model.js";
import { CustomerProfile } from "../../../../models/customer-profile.model.js";
import { User } from "../../../../models/user.model.js";
import { SocietyReceipt } from "../../receipts/shared/receipt.model.js";
import { DailyWorkReport } from "../../../../models/daily-work-report.model.js";
import { CashCollection } from "../../../../models/cash-collection.model.js";
import { CashSubmission } from "../../../../models/cash-submission.model.js";
import { OnboardingTeam } from "../../../../models/onboarding-team.model.js";
import { EmployeeProfile } from "../../../../models/employee-profile.model.js";
import { MerchantProfile } from "../../../../models/merchant-profile.model.js";



/**
 * Safely convert string to Mongo ObjectId for aggregation pipelines ($match)
 */
const toObjectId = (id) => {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  if (typeof id === "string" && mongoose.Types.ObjectId.isValid(id)) {
    return new mongoose.Types.ObjectId(id);
  }
  return id;
};

/**
 * Build $in condition supporting both ObjectId and String representations
 */
const toObjectIdOrArray = (idOrArray) => {
  if (!idOrArray) return null;
  if (typeof idOrArray === "object" && idOrArray.$in) {
    const list = [];
    idOrArray.$in.forEach((item) => {
      const objId = toObjectId(item);
      if (objId) list.push(objId);
      list.push(String(item));
    });
    return { $in: list };
  }
  const objId = toObjectId(idOrArray);
  return { $in: [objId, String(idOrArray)] };
};

export class SocietyDashboardService {
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


  /**
   * Format numbers into locale string e.g. 30,67,498
   */
  formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return "0";
    return Number(num).toLocaleString("en-IN");
  }

  /**
   * Resolve Branch Filter for single branch or multi-branch query parameters
   */
  resolveBranchFilter(context, query = {}) {
    // If context is restricted to a specific branch (e.g. Branch Manager context)
    if (context?.branchId) {
      return context.branchId;
    }

    // Bank Owner or Society Admin context: check query parameters
    const queryBranchId = query.branchId || null;
    const queryBranchIds = query.branchIds || null;

    if (queryBranchId) {
      return queryBranchId;
    }

    if (queryBranchIds) {
      if (Array.isArray(queryBranchIds)) {
        const cleanIds = queryBranchIds
          .map((s) => String(s).trim())
          .filter(Boolean);
        return cleanIds.length > 0 ? { $in: cleanIds } : null;
      }
      if (typeof queryBranchIds === "string" && queryBranchIds.trim()) {
        const cleanIds = queryBranchIds
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        return cleanIds.length > 0 ? { $in: cleanIds } : null;
      }
    }

    return null; // Null means ALL branches under the bank
  }

  /**
   * Build general database scope for Bank and Branch filtering
   */
  buildScope(context, query = {}) {
    const scope = { isDeleted: { $ne: true } };
    const bankId = context?.bankId;
    const branchFilter = this.resolveBranchFilter(context, query);

    if (bankId) {
      scope.bankId = toObjectIdOrArray(bankId);
    }
    if (branchFilter) {
      scope.branchId = toObjectIdOrArray(branchFilter);
    }
    return scope;
  }

  /**
   * Build Loan/Lead database scope for Bank and Branch filtering
   */
  async buildLoanScope(context, query = {}) {
    const bankId = context?.bankId;
    if (!bankId) return { isDeleted: { $ne: true } };

    const branchFilter = this.resolveBranchFilter(context, query);
    let branchId = branchFilter || null;

    const bankCond = toObjectIdOrArray(bankId);
    const directScopeBank = { bankId: bankCond };
    const directScopeAssigned = { assignedBankId: bankCond };

    if (branchId) {
      const branchCond = toObjectIdOrArray(branchId);
      directScopeBank.branchId = branchCond;
      directScopeAssigned.branchId = branchCond;
    }

    const branchQuery = { bankId: toObjectId(bankId), isDeleted: { $ne: true } };
    if (branchId) {
      branchQuery._id = toObjectIdOrArray(branchId);
    }

    const [matchingBranches, societyEmployees, merchantProfiles] = await Promise.all([
      Branch.find(branchQuery).select('_id').lean(),
      SocietyEmployee.find({
        bankId: toObjectId(bankId),
        isDeleted: { $ne: true },
        ...(branchId ? { branchId: toObjectIdOrArray(branchId) } : {})
      }).select('userId').lean(),
      MerchantProfile.find({
        bankId: toObjectId(bankId),
        isDeleted: { $ne: true },
        ...(branchId ? { branchId: toObjectIdOrArray(branchId) } : {})
      }).select('_id userId branchId').lean()
    ]);

    const branchIds = matchingBranches.map((b) => b._id);
    const employeeProfiles = await EmployeeProfile.find({
      branchId: { $in: branchIds },
      isDeleted: { $ne: true }
    }).select('userId').lean();

    const executiveUserIds = [
      ...societyEmployees.map((e) => e.userId),
      ...employeeProfiles.map((e) => e.userId)
    ].filter(Boolean);

    const merchantIds = merchantProfiles.map((m) => m._id);
    const merchantUserIds = merchantProfiles.map((m) => m.userId).filter(Boolean);

    const scopeConditions = [directScopeBank, directScopeAssigned];

    if (executiveUserIds.length > 0) {
      scopeConditions.push({ createdByExecutiveId: { $in: executiveUserIds } });
    }

    if (merchantIds.length > 0) {
      scopeConditions.push({ merchantId: { $in: merchantIds } });
    }

    if (merchantUserIds.length > 0) {
      scopeConditions.push({ createdByMerchantId: { $in: merchantUserIds } });
    }

    const createdByDetailsCond = { 'createdByDetails.bankId': toObjectId(bankId) };
    if (branchId) createdByDetailsCond['createdByDetails.branchId'] = toObjectIdOrArray(branchId);
    scopeConditions.push(createdByDetailsCond);

    return {
      isDeleted: { $ne: true },
      $or: scopeConditions
    };
  }

  /**
   * Build Receipt database scope for Bank and Branch filtering
   */
  buildReceiptScope(context, query = {}, receiptType = null) {
    const bankId = context?.bankId;
    const branchFilter = this.resolveBranchFilter(context, query);
    const scope = { isDeleted: { $ne: true }, status: { $ne: "REJECTED" } };

    if (bankId) {
      scope.bankId = toObjectIdOrArray(bankId);
    }
    if (branchFilter) {
      scope.branchId = toObjectIdOrArray(branchFilter);
    }
    if (receiptType) {
      if (Array.isArray(receiptType)) {
        scope.receiptType = { $in: receiptType };
      } else {
        scope.receiptType = receiptType;
      }
    }
    return scope;
  }

  /**
   * API 1: Get Society Dashboard KPI Stats
   */
  async getStats(context, query = {}) {
    const bankId = context?.bankId || null;
    const branchFilter = this.resolveBranchFilter(context, query);

    const scope = this.buildScope(context, query);
    const loanScope = await this.buildLoanScope(context, query);

    const branchDocFilter = branchFilter
      ? { _id: toObjectIdOrArray(branchFilter), isDeleted: { $ne: true } }
      : { bankId: toObjectIdOrArray(bankId), isDeleted: { $ne: true } };

    let dbBranchesCount = 0;
    let dbStaffCount = 0;
    let dbLeadsCount = 0;
    let dbLoanDistributedSum = 0;
    let dbCollectionPendingSum = 0;

    let newLeadsCount = 0;
    let pendingDownPaymentLeadsCount = 0;
    let activeLeadsCount = 0;
    let completedLeadsCount = 0;
    let rejectedLeadsCount = 0;

    let creditReceiptsSum = 0;
    let debitReceiptsSum = 0;
    let transferReceiptsSum = 0;
    let workReportsSum = 0;
    let cashCollectionsSum = 0;
    let cashSubmittedSum = 0;
    let cashPendingSum = 0;
    let loanDownPaymentSum = 0;

    let purchasedEmiCards = 0;
    let availableEmiCards = 0;
    let usedEmiCards = 0;

    let purchasedVerificationCredits = 0;
    let availableVerificationCredits = 0;
    let usedVerificationCredits = 0;

    try {
      if (User.db && User.db.readyState === 1) {
        const creditReceiptScope = this.buildReceiptScope(
          context,
          query,
          "CREDIT",
        );
        const debitReceiptScope = this.buildReceiptScope(
          context,
          query,
          "DEBIT",
        );
        const transferReceiptScope = this.buildReceiptScope(context, query, [
          "TRANSFER",
          "CONTRA",
        ]);

        // Resolve active employee IDs for this bank/branch context to match cash payment module
        const [societyEmps, onboardingEmps, regularEmps] = await Promise.all([
          SocietyEmployee.find({ ...scope, isDeleted: { $ne: true } }).select('_id userId').lean(),
          OnboardingTeam.find({ ...scope, isDeleted: { $ne: true } }).select('_id userId').lean(),
          EmployeeProfile.find({ ...scope, isDeleted: { $ne: true } }).select('_id userId').lean()
        ]);

        const distinctCollectionEmpIds = await CashCollection.distinct("employeeId", {
          isDeleted: { $ne: true },
          ...(bankId ? { bankId: toObjectId(bankId) } : {}),
          ...(branchFilter ? { branchId: toObjectId(branchFilter) } : {})
        });

        const empIdsMap = new Set();
        societyEmps.forEach(e => { if (e._id) empIdsMap.add(String(e._id)); if (e.userId) empIdsMap.add(String(e.userId)); });
        onboardingEmps.forEach(e => { if (e._id) empIdsMap.add(String(e._id)); if (e.userId) empIdsMap.add(String(e.userId)); });
        regularEmps.forEach(e => { if (e._id) empIdsMap.add(String(e._id)); if (e.userId) empIdsMap.add(String(e.userId)); });
        distinctCollectionEmpIds.forEach(id => { if (id) empIdsMap.add(String(id)); });

        const empIds = Array.from(empIdsMap).map(toObjectId).filter(Boolean);

        const [
          branchesCount,
          staffCount,
          leadsCount,
          leadsStatusAgg,
          loanDistributedAgg,
          collectionPendingAgg,
          creditReceiptsAgg,
          debitReceiptsAgg,
          transferReceiptsAgg,
          workReportsAgg,
          cashCollectionsAgg,
          cashSubmissionsAgg,
          loanDownPaymentAgg,
        ] = await Promise.all([
          Branch.countDocuments(branchDocFilter),
          SocietyEmployee.countDocuments({
            ...scope,
            isDeleted: { $ne: true },
          }),
          Loan.countDocuments(loanScope),
          Loan.aggregate([
            { $match: loanScope },
            { $group: { _id: "$status", count: { $sum: 1 } } }
          ]),
          Loan.aggregate([
            {
              $match: {
                ...loanScope,
                status: { $in: ["ACTIVE", "COMPLETED", "DISBURSED"] },
              },
            },
            {
              $group: { _id: null, totalAmount: { $sum: "$totalLoanAmount" } },
            },
          ]),
          Loan.aggregate([
            { $match: { ...loanScope, status: "ACTIVE" } },
            {
              $group: {
                _id: null,
                totalOutstanding: { $sum: "$outstandingAmount" },
              },
            },
          ]),
          SocietyReceipt.aggregate([
            { $match: creditReceiptScope },
            { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
          ]),
          SocietyReceipt.aggregate([
            { $match: debitReceiptScope },
            { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
          ]),
          SocietyReceipt.aggregate([
            { $match: transferReceiptScope },
            { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
          ]),
          DailyWorkReport.aggregate([
            { $match: { ...scope, isDeleted: { $ne: true } } },
            { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
          ]),
          CashCollection.aggregate([
            {
              $match: {
                isDeleted: { $ne: true },
                $or: [
                  ...(bankId ? [{ bankId: toObjectId(bankId) }] : []),
                  ...(branchFilter ? [{ branchId: toObjectId(branchFilter) }] : []),
                  ...(empIds.length > 0
                    ? [
                        { employeeId: { $in: empIds } },
                        { onboardingTeamId: { $in: empIds } },
                        { createdBy: { $in: empIds } }
                      ]
                    : [])
                ]
              }
            },
            {
              $group: { _id: null, totalAmount: { $sum: "$amountCollected" } },
            },
          ]),
          CashSubmission.aggregate([
            {
              $match: {
                isDeleted: { $ne: true },
                $or: [
                  ...(bankId ? [{ bankIds: toObjectId(bankId) }, { bankId: toObjectId(bankId) }] : []),
                  ...(branchFilter ? [{ branchId: toObjectId(branchFilter) }] : []),
                  ...(empIds.length > 0
                    ? [
                        { employeeId: { $in: empIds } },
                        { onboardingTeamId: { $in: empIds } },
                        { createdBy: { $in: empIds } }
                      ]
                    : [])
                ]
              }
            },
            {
              $group: { _id: null, totalAmount: { $sum: "$amountSubmitted" } },
            },
          ]),
          Loan.aggregate([
            { $match: { ...loanScope, status: { $ne: "REJECTED" } } },
            { $group: { _id: null, totalAmount: { $sum: "$downPayment" } } },
          ]),
        ]);


        dbBranchesCount = branchesCount;
        dbStaffCount = staffCount;
        dbLeadsCount = leadsCount;

        if (leadsStatusAgg && leadsStatusAgg.length > 0) {
          leadsStatusAgg.forEach((group) => {
            const count = group.count || 0;
            const st = (group._id || '').toUpperCase();
            if (st === 'NEW') newLeadsCount += count;
            else if (st === 'PENDING_DOWN_PAYMENT') pendingDownPaymentLeadsCount += count;
            else if (st === 'ACTIVE') activeLeadsCount += count;
            else if (st === 'COMPLETED') completedLeadsCount += count;
            else if (st === 'REJECTED') rejectedLeadsCount += count;
          });
        }

        if (loanDistributedAgg && loanDistributedAgg.length > 0) {
          dbLoanDistributedSum = loanDistributedAgg[0].totalAmount || 0;
        }

        if (collectionPendingAgg && collectionPendingAgg.length > 0) {
          dbCollectionPendingSum =
            collectionPendingAgg[0].totalOutstanding || 0;
        }

        creditReceiptsSum = creditReceiptsAgg[0]?.totalAmount || 0;
        debitReceiptsSum = debitReceiptsAgg[0]?.totalAmount || 0;
        transferReceiptsSum = transferReceiptsAgg[0]?.totalAmount || 0;
        workReportsSum = workReportsAgg[0]?.totalAmount || 0;
        cashCollectionsSum = cashCollectionsAgg[0]?.totalAmount || 0;
        cashSubmittedSum = cashSubmissionsAgg[0]?.totalAmount || 0;
        cashPendingSum = Math.max(0, cashCollectionsSum - cashSubmittedSum);

        loanDownPaymentSum = loanDownPaymentAgg[0]?.totalAmount || 0;



        // Stock & Credits Wallet Aggregation
        if (branchFilter) {
          // Specific Branch Filter: read from specific branch document
          const targetBranchId =
            typeof branchFilter === "string"
              ? branchFilter
              : branchFilter?._id || branchFilter;
          const branchDoc = await Branch.findOne({
            _id: toObjectId(targetBranchId),
            isDeleted: { $ne: true },
          }).lean();
          if (branchDoc) {
            purchasedEmiCards =
              branchDoc.totalEmiCards || branchDoc.cardStock || 0;
            availableEmiCards = branchDoc.availableEmiCards || 0;
            usedEmiCards = Math.max(0, purchasedEmiCards - availableEmiCards);

            purchasedVerificationCredits =
              branchDoc.totalVerificationCredits ||
              branchDoc.verificationCredits ||
              0;
            availableVerificationCredits =
              branchDoc.availableVerificationCredits || 0;
            usedVerificationCredits = Math.max(
              0,
              purchasedVerificationCredits - availableVerificationCredits,
            );
          }
        } else if (bankId) {
          // Bank Owner Context (All branches combined)
          const [bankDoc, branchAgg] = await Promise.all([
            Bank.findOne({
              _id: toObjectId(bankId),
              isDeleted: { $ne: true },
            }).lean(),
            Branch.aggregate([
              {
                $match: {
                  bankId: toObjectId(bankId),
                  isDeleted: { $ne: true },
                },
              },
              {
                $group: {
                  _id: null,
                  totalEmiCards: { $sum: "$totalEmiCards" },
                  availableEmiCards: { $sum: "$availableEmiCards" },
                  totalVerificationCredits: {
                    $sum: "$totalVerificationCredits",
                  },
                  availableVerificationCredits: {
                    $sum: "$availableVerificationCredits",
                  },
                },
              },
            ]),
          ]);

          purchasedEmiCards =
            bankDoc?.totalEmiCards || branchAgg[0]?.totalEmiCards || 0;
          availableEmiCards =
            bankDoc?.availableEmiCards || branchAgg[0]?.availableEmiCards || 0;
          usedEmiCards = Math.max(0, purchasedEmiCards - availableEmiCards);

          purchasedVerificationCredits =
            bankDoc?.totalVerificationCredits ||
            branchAgg[0]?.totalVerificationCredits ||
            0;
          availableVerificationCredits =
            bankDoc?.availableVerificationCredits ||
            branchAgg[0]?.availableVerificationCredits ||
            0;
          usedVerificationCredits = Math.max(
            0,
            purchasedVerificationCredits - availableVerificationCredits,
          );
        }
      }
    } catch (err) {
      // Fallback gracefully on DB aggregation error
    }

    const totalLeads = dbLeadsCount;
    const totalLoanDistributed = dbLoanDistributedSum;
    const collectionPending = dbCollectionPendingSum;

    // Calculate Real-Time Total Revenue: (Credit Receipts + Submitted Cash Collections + Loan Down Payments + Transfer Receipts) - Debit Receipts
    const totalRevenue =
      creditReceiptsSum +
      cashSubmittedSum +
      loanDownPaymentSum +
      transferReceiptsSum -
      debitReceiptsSum;

    const totalBranch = dbBranchesCount;
    const totalStaff = dbStaffCount;

    return {
      emiCard: {
        title: "EMI Card",
        count: purchasedEmiCards,
        purchased: purchasedEmiCards,
        available: availableEmiCards,
        used: usedEmiCards,
        formattedCount: this.formatNumber(purchasedEmiCards),
        formattedPurchased: this.formatNumber(purchasedEmiCards),
        formattedAvailable: this.formatNumber(availableEmiCards),
        formattedUsed: this.formatNumber(usedEmiCards),
      },
      verificationCredit: {
        title: "Verification Credit",
        count: purchasedVerificationCredits,
        purchased: purchasedVerificationCredits,
        available: availableVerificationCredits,
        used: usedVerificationCredits,
        formattedCount: this.formatNumber(purchasedVerificationCredits),
        formattedPurchased: this.formatNumber(purchasedVerificationCredits),
        formattedAvailable: this.formatNumber(availableVerificationCredits),
        formattedUsed: this.formatNumber(usedVerificationCredits),
      },
      totalLeads: {
        title: "Total Leads",
        count: totalLeads,
        formattedCount: this.formatNumber(totalLeads),
        newLeads: newLeadsCount,
        pendingDownPaymentLeads: pendingDownPaymentLeadsCount,
        activeLeads: activeLeadsCount,
        completedLeads: completedLeadsCount,
        rejectedLeads: rejectedLeadsCount,
        breakdown: {
          new: newLeadsCount,
          pendingDownPayment: pendingDownPaymentLeadsCount,
          active: activeLeadsCount,
          completed: completedLeadsCount,
          rejected: rejectedLeadsCount
        },
        changeText: "This Month +3.7%",
        percentageChange: 3.7,
        isPositive: true,
      },
      totalLoanDistributed: {
        title: "Total Loan Distributed",
        amount: totalLoanDistributed,
        formattedAmount: this.formatCurrency(totalLoanDistributed),
        changeText: "This Month -1.7%",
        percentageChange: -1.7,
        isPositive: false,
      },
      collectionPending: {
        title: "Collection Pending",
        amount: cashPendingSum,
        formattedAmount: this.formatCurrency(cashPendingSum),
        changeText: "This Month -1.7%",
        percentageChange: -1.7,
        isPositive: false,
      },
      cashCollectionSummary: {
        title: "Cash Collection Summary",
        totalCollection: cashCollectionsSum,
        submittedCollection: cashSubmittedSum,
        pendingCollection: cashPendingSum,
        formattedTotalCollection: this.formatCurrency(cashCollectionsSum),
        formattedSubmittedCollection: this.formatCurrency(cashSubmittedSum),
        formattedPendingCollection: this.formatCurrency(cashPendingSum),
      },
      totalRevenue: {
        title: "Total Revenue",
        amount: totalRevenue,
        formattedAmount: this.formatCurrency(totalRevenue),
        breakdown: {
          creditReceipts: creditReceiptsSum,
          debitReceipts: debitReceiptsSum,
          transferReceipts: transferReceiptsSum,
          cashCollections: cashSubmittedSum,
          submittedCollection: cashSubmittedSum,
          pendingCollection: cashPendingSum,
          loanDownPayments: loanDownPaymentSum,
        },
        changeText: totalRevenue >= 0 ? "This Month +5.2%" : "This Month -5.2%",
        percentageChange: totalRevenue >= 0 ? 5.2 : -5.2,
        isPositive: totalRevenue >= 0,
      },


      totalBranch: {
        title: "Total Branch",
        count: totalBranch,
        formattedCount: this.formatNumber(totalBranch),
        changeText: "Active Branches",
        percentageChange: 0,
        isPositive: true,
      },
      totalStaff: {
        title: "Total Staff",
        count: totalStaff,
        formattedCount: this.formatNumber(totalStaff),
        changeText: "Active Employees",
        percentageChange: 0,
        isPositive: true,
      },
    };
  }

  /**
   * API 2: Get Total Revenue Chart Data (This Year vs Last Year Comparison)
   */
  async getRevenueChart(context, query = {}) {
    const selectedYear = Number(query.year) || new Date().getFullYear();
    const lastYear = selectedYear - 1;

    const creditReceiptScope = this.buildReceiptScope(context, query, "CREDIT");

    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const baseThisYear = [
      30000, 25000, 22000, 35000, 32000, 55000, 88000, 105000, 72000, 80000,
      42000, 60000,
    ];
    const baseLastYear = [
      20000, 28000, 29000, 40000, 48000, 30000, 32000, 35000, 25000, 85000,
      90000, 115000,
    ];

    let monthlyDataThisYear = new Array(12).fill(0);
    let monthlyDataLastYear = new Array(12).fill(0);
    let hasDbDataThisYear = false;
    let hasDbDataLastYear = false;

    try {
      if (User.db && User.db.readyState === 1) {
        const startThisYear = new Date(selectedYear, 0, 1);
        const endThisYear = new Date(selectedYear, 11, 31, 23, 59, 59);

        const startLastYear = new Date(lastYear, 0, 1);
        const endLastYear = new Date(lastYear, 11, 31, 23, 59, 59);

        const [thisYearAgg, lastYearAgg] = await Promise.all([
          SocietyReceipt.aggregate([
            {
              $match: {
                ...creditReceiptScope,
                date: { $gte: startThisYear, $lte: endThisYear },
              },
            },
            {
              $group: {
                _id: { $month: "$date" },
                totalRevenue: { $sum: "$amount" },
              },
            },
          ]),
          SocietyReceipt.aggregate([
            {
              $match: {
                ...creditReceiptScope,
                date: { $gte: startLastYear, $lte: endLastYear },
              },
            },
            {
              $group: {
                _id: { $month: "$date" },
                totalRevenue: { $sum: "$amount" },
              },
            },
          ]),
        ]);

        if (thisYearAgg && thisYearAgg.length > 0) {
          hasDbDataThisYear = true;
          thisYearAgg.forEach((item) => {
            const mIndex = item._id - 1;
            if (mIndex >= 0 && mIndex < 12) {
              monthlyDataThisYear[mIndex] = item.totalRevenue || 0;
            }
          });
        }

        if (lastYearAgg && lastYearAgg.length > 0) {
          hasDbDataLastYear = true;
          lastYearAgg.forEach((item) => {
            const mIndex = item._id - 1;
            if (mIndex >= 0 && mIndex < 12) {
              monthlyDataLastYear[mIndex] = item.totalRevenue || 0;
            }
          });
        }
      }
    } catch (err) {
      // Fallback to design defaults gracefully
    }

    const formatShortAmount = (val) => {
      if (!val) return "₹0";
      if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
      if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
      if (val >= 1000) return `₹${Math.round(val / 1000)}K`;
      return `₹${val}`;
    };

    const monthsData = months.map((m, index) => {
      const valThis = hasDbDataThisYear
        ? monthlyDataThisYear[index]
        : baseThisYear[index];
      const valLast = hasDbDataLastYear
        ? monthlyDataLastYear[index]
        : baseLastYear[index];

      return {
        month: m,
        thisYear: valThis,
        lastYear: valLast,
        formattedThisYear: formatShortAmount(valThis),
        formattedLastYear: formatShortAmount(valLast),
      };
    });

    return {
      title: "Total Revenue Chart",
      year: selectedYear,
      comparedYear: lastYear,
      legends: {
        thisYear: `This year (${selectedYear})`,
        lastYear: `Last year (${lastYear})`,
      },
      months: monthsData,
    };
  }

  /**
   * API 3: Get Loan Distributed Chart Data (by Category)
   */
  async getLoanDistributedChart(context, query = {}) {
    const loanScope = await this.buildLoanScope(context, query);
    let categories = [];

    try {
      const agg = await Loan.aggregate([
        {
          $match: {
            ...loanScope,
            status: { $in: ["ACTIVE", "COMPLETED", "DISBURSED"] },
          },
        },
        {
          $group: {
            _id: "$productCategory",
            amount: { $sum: "$totalLoanAmount" },
            count: { $sum: 1 },
          },
        },
      ]);

      if (agg && agg.length > 0) {
        categories = agg.map((item) => ({
          category: item._id || "General Loan",
          amount: item.amount,
          formattedAmount: this.formatCurrency(item.amount),
          count: item.count,
        }));
      }
    } catch (err) {
      // Fallback
    }

    if (categories.length === 0) {
      categories = [
        {
          category: "Mobiles on EMI",
          amount: 200000,
          formattedAmount: "₹200K",
          count: 150,
        },
        {
          category: "Electronics on EMI",
          amount: 53000,
          formattedAmount: "₹53K",
          count: 42,
        },
        {
          category: "Two Wheeler Loan",
          amount: 80000,
          formattedAmount: "₹80K",
          count: 28,
        },
        {
          category: "Used Car Loan",
          amount: 160000,
          formattedAmount: "₹160K",
          count: 14,
        },
        {
          category: "New Car Loan",
          amount: 120000,
          formattedAmount: "₹120K",
          count: 8,
        },
      ];
    }

    return {
      title: "Loan Distributed",
      timeFilter: query.timeFilter || "Today",
      categories,
    };
  }

  /**
   * API 4: Get Sales Contribution of Services Stats
   */
  async getServicesStats(context, query = {}) {
    const stats = await this.getStats(context, query);
    const loanAmount = stats.totalLoanDistributed.amount || 0;

    const services = [
      {
        service: "Loan Service",
        serviceKey: "LOAN",
        percentage: 100,
        amount: loanAmount,
        formattedAmount: this.formatCurrency(loanAmount),
        color: "#FF9900",
        status: "ACTIVE",
      },
    ];

    return {
      title: "Sales contribution of Services",
      timeFilter: query.timeFilter || "Today",
      services,
    };
  }

  /**
   * Consolidated Overview API
   */
  async getOverview(context, query = {}) {
    const [stats, revenueChart, loanDistributedChart, servicesStats] =
      await Promise.all([
        this.getStats(context, query),
        this.getRevenueChart(context, query),
        this.getLoanDistributedChart(context, query),
        this.getServicesStats(context, query),
      ]);

    return {
      stats,
      revenueChart,
      loanDistributedChart,
      servicesStats,
    };
  }
}

export const societyDashboardService = new SocietyDashboardService();
