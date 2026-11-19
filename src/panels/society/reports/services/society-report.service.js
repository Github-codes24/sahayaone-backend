import mongoose from 'mongoose';
import PDFDocument from 'pdfkit';
import { ApiError } from '../../../../common/api.error.js';
import { SocietyReceipt } from '../../receipts/shared/receipt.model.js';
import { Branch } from '../../../../models/branch.model.js';
import { SocietyEmployee } from '../../../../models/society-employee.model.js';
import { BranchManager } from '../../../../models/branch-manager.model.js';
import { Attendance } from '../../../../models/attendance.model.js';
import { DailyWorkReport } from '../../../../models/daily-work-report.model.js';
import { CreditReportRequest } from '../../../../models/cibilReport.model.js';
import { MerchantProfile } from '../../../../models/merchant-profile.model.js';
import { Loan } from '../../../../models/loan.model.js';
import { LoanApplication } from '../../../../models/loan-application.model.js';
import { CardCreditUsage } from '../../../../models/card-credit-usage.model.js';
import { CardCreditPurchase } from '../../../../models/card-credit-purchase.model.js';
import { CardCreditTransfer } from '../../../../models/card-credit-transfer.model.js';
import { REPORT_TYPES } from '../validators/society-report.validator.js';
import { getISTDayRange, getISTMonthRange, formatDateString } from '../../../../utils/date.util.js';

const toObjectId = (val) => {
  if (!val) return val;
  if (val instanceof mongoose.Types.ObjectId) return val;
  if (typeof val === 'string' && mongoose.Types.ObjectId.isValid(val) && /^[0-9a-fA-F]{24}$/.test(val)) {
    return new mongoose.Types.ObjectId(val);
  }
  return val;
};

export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0.00';
  const num = Number(amount);
  const formatted = Math.abs(num).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  if (num < 0) return `-₹${formatted}`;
  return `₹${formatted}`;
};

export const escapeSearchText = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class SocietyReportService {
  /**
   * Returns metadata catalog of all available fintech reports
   */
  getReportCatalog(query = {}) {
    const catalog = [
      {
        id: REPORT_TYPES.CREDIT_RECEIPTS,
        code: 'FIN-CR-01',
        title: 'Credit Receipts Ledger Report',
        category: 'Financial & Ledger',
        description: 'Voucher level audit of all Credit Receipts (CR) with GL Head tracking, status breakdown, and maker-checker details.',
        supportedFilters: ['dateFrom', 'dateTo', 'branchId', 'status', 'glHead', 'search'],
        exportFormats: ['CSV', 'PDF']
      },
      {
        id: REPORT_TYPES.DEBIT_RECEIPTS,
        code: 'FIN-DR-02',
        title: 'Debit Receipts Ledger Report',
        category: 'Financial & Ledger',
        description: 'Outflow voucher audit of Debit Receipts (DR) with beneficiary account number and approval audit logs.',
        supportedFilters: ['dateFrom', 'dateTo', 'branchId', 'status', 'glHead', 'search'],
        exportFormats: ['CSV', 'PDF']
      },
      {
        id: REPORT_TYPES.TRANSFER_CONTRA_RECEIPTS,
        code: 'FIN-TC-03',
        title: 'Transfer & Contra Receipts Report',
        category: 'Financial & Ledger',
        description: 'Internal fund transfers (TR) and bank contra vouchers (CT) ledger for inter-branch and cash-bank reconciliations.',
        supportedFilters: ['dateFrom', 'dateTo', 'branchId', 'receiptType', 'status', 'search'],
        exportFormats: ['CSV', 'PDF']
      },
      {
        id: REPORT_TYPES.CASH_PAYMENTS,
        code: 'FIN-CP-04',
        title: 'Cash Payment & Drawer Reconciliation Report',
        category: 'Financial & Ledger',
        description: 'Counter cash collections, field cash submissions, and opening/closing cash drawer balance report.',
        supportedFilters: ['dateFrom', 'dateTo', 'branchId', 'employeeId', 'status', 'search'],
        exportFormats: ['CSV', 'PDF']
      },
      {
        id: REPORT_TYPES.BRANCH_FINANCIAL_SUMMARY,
        code: 'FIN-BS-05',
        title: 'Multi-Branch Consolidated Financial Summary',
        category: 'Financial & Ledger',
        description: 'Executive overview of total credits, total debits, net movement, and pending approvals aggregated per branch.',
        supportedFilters: ['dateFrom', 'dateTo', 'city', 'state'],
        exportFormats: ['CSV', 'PDF']
      },
      {
        id: REPORT_TYPES.LEADS_AND_LOANS,
        code: 'BUS-LN-06',
        title: 'Leads & Loan Applications Portfolio Report',
        category: 'Loans & Business',
        description: 'Customer lead conversion tracking, loan requested amounts, verification stages, and total principal disbursed.',
        supportedFilters: ['dateFrom', 'dateTo', 'branchId', 'status', 'search'],
        exportFormats: ['CSV', 'PDF']
      },
      {
        id: REPORT_TYPES.CIBIL_ASSESSMENT_AUDIT,
        code: 'BUS-CB-07',
        title: 'CIBIL Credit Score Assessment Audit Report',
        category: 'Loans & Business',
        description: 'Audit log of customer CIBIL checks, average credit score, and risk classification (High/Medium/Low Risk).',
        supportedFilters: ['dateFrom', 'dateTo', 'branchId', 'search'],
        exportFormats: ['CSV', 'PDF']
      },
      {
        id: REPORT_TYPES.ATTENDANCE_SUMMARY,
        code: 'OPS-AT-08',
        title: 'Staff Attendance & Shift Punch Log Report',
        category: 'HR & Operations',
        description: 'Employee punch-in/out audit, late arrivals, present/absent days, working hours, and shift compliance.',
        supportedFilters: ['dateFrom', 'dateTo', 'branchId', 'employeeId', 'status'],
        exportFormats: ['CSV', 'PDF']
      },
      {
        id: REPORT_TYPES.STAFF_DIRECTORY,
        code: 'OPS-EM-09',
        title: 'Employee Directory & Role Audit Report',
        category: 'HR & Operations',
        description: 'Society staff roster, system role allocations, branch assignments, KYC status, and active employment audit.',
        supportedFilters: ['branchId', 'status', 'search'],
        exportFormats: ['CSV', 'PDF']
      },
      {
        id: REPORT_TYPES.DAILY_WORK_REPORT,
        code: 'OPS-DW-10',
        title: 'Daily Work Report (DWR) Executive Tracker',
        category: 'HR & Operations',
        description: 'Field collection and loan executive daily work logs, field visits made, customer contacts, and cash collected.',
        supportedFilters: ['dateFrom', 'dateTo', 'branchId', 'employeeId', 'search'],
        exportFormats: ['CSV', 'PDF']
      },
      {
        id: REPORT_TYPES.CARDS_CREDIT_USAGE,
        code: 'FIN-CC-11',
        title: 'Verification Credit & EMI Card Usage Report',
        category: 'Credits & Verification',
        description: 'Verification credit purchases, branch allocations, consumption audit, and issued EMI card tracking.',
        supportedFilters: ['dateFrom', 'dateTo', 'branchId', 'search'],
        exportFormats: ['CSV', 'PDF']
      },
      {
        id: REPORT_TYPES.MERCHANT_SUMMARY,
        code: 'BUS-MC-12',
        title: 'Merchant Partner & Sales Performance Report',
        category: 'Loans & Business',
        description: 'Onboarded merchant partners, active/pending verification audit, and total sales transaction volume.',
        supportedFilters: ['dateFrom', 'dateTo', 'branchId', 'status', 'search'],
        exportFormats: ['CSV', 'PDF']
      }
    ];

    if (query.category) {
      const catNorm = String(query.category).trim().toLowerCase();
      return catalog.filter(r => r.category.toLowerCase().includes(catNorm));
    }

    return catalog;
  }

  /**
   * Helper to resolve Date Range with industrial fintech defaults
   */
  resolveDateRange(query) {
    const rawFrom = query.dateFrom || query.startDate;
    const rawTo = query.dateTo || query.endDate;

    let dateFrom;
    let dateTo;

    if (rawFrom) {
      const fromStr = String(rawFrom).includes('T') ? String(rawFrom) : `${String(rawFrom).trim()}T00:00:00.000+05:30`;
      dateFrom = new Date(fromStr);
    } else {
      // Default: First day of current month in IST
      const { start } = getISTMonthRange(new Date());
      dateFrom = start;
    }

    if (rawTo) {
      const toStr = String(rawTo).includes('T') ? String(rawTo) : `${String(rawTo).trim()}T23:59:59.999+05:30`;
      dateTo = new Date(toStr);
    } else {
      // Default: Current date end of day in IST
      const { end } = getISTDayRange(new Date());
      dateTo = end;
    }

    return { dateFrom, dateTo };
  }

  /**
   * Build tenant scope filter
   */
  buildScope(context, queryBranchId = null) {
    if (!context?.bankId) {
      throw ApiError.forbidden('A valid society bank context is required to access reports.');
    }
    const scope = { bankId: toObjectId(context.bankId) };
    
    // Only Bank Owner (or Super Admin / Vendor / Society Admin) can filter by query branchId
    if (context.isBankOwner) {
      if (queryBranchId) {
        scope.branchId = toObjectId(queryBranchId);
      }
    } else {
      // Non-bank-owners (Branch Manager, Accountant, Employee) are strictly locked to their assigned session branchId
      if (context.branchId) {
        scope.branchId = toObjectId(context.branchId);
      }
    }
    return scope;
  }

  /**
   * Main Dispatcher for Report Generation
   */
  async generateReport(reportType, context, query = {}) {
    const typeUpper = String(reportType || '').toUpperCase();

    switch (typeUpper) {
      case REPORT_TYPES.CREDIT_RECEIPTS:
        return this.generateReceiptsReport(context, query, 'CREDIT');
      case REPORT_TYPES.DEBIT_RECEIPTS:
        return this.generateReceiptsReport(context, query, 'DEBIT');
      case REPORT_TYPES.TRANSFER_CONTRA_RECEIPTS:
        return this.generateTransferContraReport(context, query);
      case REPORT_TYPES.BRANCH_FINANCIAL_SUMMARY:
        return this.generateBranchFinancialSummaryReport(context, query);
      case REPORT_TYPES.ATTENDANCE_SUMMARY:
        return this.generateAttendanceReport(context, query);
      case REPORT_TYPES.STAFF_DIRECTORY:
        return this.generateStaffDirectoryReport(context, query);
      case REPORT_TYPES.DAILY_WORK_REPORT:
        return this.generateDailyWorkReport(context, query);
      case REPORT_TYPES.CIBIL_ASSESSMENT_AUDIT:
        return this.generateCibilReport(context, query);
      case REPORT_TYPES.MERCHANT_SUMMARY:
        return this.generateMerchantReport(context, query);
      case REPORT_TYPES.CARDS_CREDIT_USAGE:
        return this.generateCreditUsageReport(context, query);
      case REPORT_TYPES.LEADS_AND_LOANS:
        return this.generateLeadsAndLoansReport(context, query);
      case REPORT_TYPES.CASH_PAYMENTS:
        return this.generateReceiptsReport(context, query, 'CASH_PAYMENTS');
      default:
        throw ApiError.badRequest(`Unsupported report type: ${reportType}`);
    }
  }

  /**
   * Helper to build Fintech Response Header
   */
  buildHeaderMeta(context, query, reportTitle, reportCode, dateRange) {
    const generatedBy = context.userName || context.user?.fullName || context.user?.name || context.user?.email || 'Authorized User';
    const targetBranchId = context.isBankOwner ? (query.branchId || null) : (context.branchId || null);
    return {
      bankId: context.bankId,
      bankName: context.bank?.name || context.bank?.bankName || 'Sahayaone Co-operative Society',
      branchId: targetBranchId,
      generatedAt: new Date().toISOString(),
      generatedByUserId: context.userId,
      generatedBy,
      generatedByName: generatedBy,
      generatedByRole: context.role,
      reportCode,
      reportTitle,
      dateRange: {
        from: dateRange.dateFrom.toISOString(),
        to: dateRange.dateTo.toISOString()
      },
      appliedFilters: {
        branchId: targetBranchId ? String(targetBranchId) : 'ALL',
        status: query.status || 'ALL',
        search: query.search || null
      }
    };
  }

  // ==========================================
  // 1 & 2. Receipts Report Handler (CREDIT / DEBIT)
  // ==========================================
  async generateReceiptsReport(context, query, receiptType) {
    const { dateFrom, dateTo } = this.resolveDateRange(query);
    const scope = this.buildScope(context, query.branchId);

    const isCashOnly = receiptType === 'CASH_PAYMENTS';
    const filter = {
      ...scope,
      date: { $gte: dateFrom, $lte: dateTo }
    };

    if (!isCashOnly) {
      filter.receiptType = receiptType;
    }

    if (query.status) {
      filter.status = String(query.status).toUpperCase();
    }

    if (query.glHead) {
      filter.glHead = query.glHead;
    }

    if (query.search) {
      const searchRegex = new RegExp(escapeSearchText(query.search), 'i');
      filter.$or = [
        { receiptNo: searchRegex },
        { name: searchRegex },
        { glHead: searchRegex },
        { glHeadName: searchRegex },
        { accountNumber: searchRegex }
      ];
    }

    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;

    // Aggregate KPI Statistics
    const statsAgg = await SocietyReceipt.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    let totalCount = 0;
    let totalAmount = 0;
    let approvedAmount = 0;
    let pendingAmount = 0;
    let rejectedAmount = 0;

    statsAgg.forEach((g) => {
      const c = g.count || 0;
      const a = g.totalAmount || 0;
      totalCount += c;
      totalAmount += a;

      const st = String(g._id || '').toUpperCase();
      if (st === 'APPROVED') approvedAmount += a;
      else if (st === 'REJECTED') rejectedAmount += a;
      else pendingAmount += a;
    });

    const [records, totalRecords] = await Promise.all([
      SocietyReceipt.find(filter)
        .populate('branchId', 'name code state city')
        .populate('createdBy', 'fullName email role userType')
        .populate('approvedBy', 'fullName email role')
        .sort({ [query.sortBy || 'date']: query.sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SocietyReceipt.countDocuments(filter)
    ]);

    const reportTitle = isCashOnly
      ? 'Cash Payment & Drawer Reconciliation Report'
      : `${receiptType} Receipts Ledger Report`;
    const reportCode = isCashOnly ? 'FIN-CP-04' : (receiptType === 'CREDIT' ? 'FIN-CR-01' : 'FIN-DR-02');

    return {
      meta: this.buildHeaderMeta(context, query, reportTitle, reportCode, { dateFrom, dateTo }),
      kpiSummary: {
        totalVouchers: totalCount,
        totalAmount,
        formattedTotalAmount: formatCurrency(totalAmount),
        approvedAmount,
        formattedApprovedAmount: formatCurrency(approvedAmount),
        pendingAmount,
        formattedPendingAmount: formatCurrency(pendingAmount),
        rejectedAmount,
        formattedRejectedAmount: formatCurrency(rejectedAmount)
      },
      items: records.map((r, idx) => ({
        srNo: skip + idx + 1,
        id: r._id,
        receiptNo: r.receiptNo,
        receiptType: r.receiptType,
        date: r.date,
        name: r.name,
        accountNumber: r.accountNumber,
        glCode: r.glHead,
        glHeadName: r.glHeadName,
        amount: r.amount || 0,
        formattedAmount: formatCurrency(r.amount),
        status: r.status,
        branchCode: r.branchId?.code || null,
        branchName: r.branchId?.name || null,
        createdBy: r.createdBy?.fullName || r.createdBy?.email || 'System',
        approvedBy: r.approvedBy?.fullName || r.approvedBy?.email || null,
        rejectionReason: r.rejectionReason || null,
        createdAt: r.createdAt
      })),
      pagination: {
        totalRecords,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(totalRecords / limit))
      }
    };
  }

  // ==========================================
  // 3. Transfer & Contra Receipts Report Handler
  // ==========================================
  async generateTransferContraReport(context, query) {
    const { dateFrom, dateTo } = this.resolveDateRange(query);
    const scope = this.buildScope(context, query.branchId);

    const filter = {
      ...scope,
      receiptType: { $in: ['TRANSFER', 'CONTRA'] },
      date: { $gte: dateFrom, $lte: dateTo }
    };

    if (query.receiptType && ['TRANSFER', 'CONTRA'].includes(query.receiptType)) {
      filter.receiptType = query.receiptType;
    }

    if (query.status) {
      filter.status = String(query.status).toUpperCase();
    }

    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;

    const [records, totalRecords, statsAgg] = await Promise.all([
      SocietyReceipt.find(filter)
        .populate('branchId', 'name code')
        .populate('createdBy', 'fullName email role')
        .populate('approvedBy', 'fullName email role')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SocietyReceipt.countDocuments(filter),
      SocietyReceipt.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$receiptType',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ])
    ]);

    let transferVolume = 0;
    let contraVolume = 0;
    statsAgg.forEach(g => {
      if (g._id === 'TRANSFER') transferVolume = g.totalAmount || 0;
      if (g._id === 'CONTRA') contraVolume = g.totalAmount || 0;
    });

    return {
      meta: this.buildHeaderMeta(context, query, 'Transfer & Contra Receipts Report', 'FIN-TC-03', { dateFrom, dateTo }),
      kpiSummary: {
        totalVouchers: totalRecords,
        transferVolume,
        formattedTransferVolume: formatCurrency(transferVolume),
        contraVolume,
        formattedContraVolume: formatCurrency(contraVolume),
        netVolume: transferVolume + contraVolume,
        formattedNetVolume: formatCurrency(transferVolume + contraVolume)
      },
      items: records.map((r, idx) => ({
        srNo: skip + idx + 1,
        id: r._id,
        receiptNo: r.receiptNo,
        receiptType: r.receiptType,
        date: r.date,
        name: r.name,
        accountNumber: r.accountNumber,
        glCode: r.glHead,
        glHeadName: r.glHeadName,
        amount: r.amount || 0,
        formattedAmount: formatCurrency(r.amount),
        status: r.status,
        branchName: r.branchId?.name || null,
        createdBy: r.createdBy?.fullName || r.createdBy?.email || 'System',
        approvedBy: r.approvedBy?.fullName || r.approvedBy?.email || null
      })),
      pagination: {
        totalRecords,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(totalRecords / limit))
      }
    };
  }

  // ==========================================
  // 5. Multi-Branch Financial Summary Handler
  // ==========================================
  async generateBranchFinancialSummaryReport(context, query) {
    const { dateFrom, dateTo } = this.resolveDateRange(query);
    if (!context?.bankId) throw ApiError.forbidden('Valid bank context required.');

    const targetBranchId = context.branchId || query.branchId || null;
    const branchFilter = {
      bankId: context.bankId,
      isDeleted: { $ne: true }
    };
    if (targetBranchId) {
      branchFilter._id = targetBranchId;
    }

    const branches = await Branch.find(branchFilter).lean();

    const branchIds = branches.map(b => b._id);

    const agg = await SocietyReceipt.aggregate([
      {
        $match: {
          bankId: context.bankId,
          branchId: { $in: branchIds },
          date: { $gte: dateFrom, $lte: dateTo }
        }
      },
      {
        $group: {
          _id: { branchId: '$branchId', type: '$receiptType' },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const branchMap = {};
    branches.forEach(b => {
      branchMap[b._id.toString()] = {
        branchId: b._id,
        code: b.code || 'BR',
        name: b.name,
        city: b.address?.city || b.city || '',
        state: b.address?.state || b.state || '',
        creditAmount: 0,
        debitAmount: 0,
        transferAmount: 0,
        contraAmount: 0,
        voucherCount: 0
      };
    });

    agg.forEach(item => {
      const bId = item._id.branchId?.toString();
      if (bId && branchMap[bId]) {
        const amt = item.totalAmount || 0;
        const type = item._id.type;
        branchMap[bId].voucherCount += item.count || 0;
        if (type === 'CREDIT') branchMap[bId].creditAmount += amt;
        else if (type === 'DEBIT') branchMap[bId].debitAmount += amt;
        else if (type === 'TRANSFER') branchMap[bId].transferAmount += amt;
        else if (type === 'CONTRA') branchMap[bId].contraAmount += amt;
      }
    });

    const items = Object.values(branchMap).map((b, idx) => {
      const netCashFlow = b.creditAmount - b.debitAmount;
      return {
        srNo: idx + 1,
        branchId: b.branchId,
        code: b.code,
        name: b.name,
        city: b.city,
        state: b.state,
        creditAmount: b.creditAmount,
        formattedCreditAmount: formatCurrency(b.creditAmount),
        debitAmount: b.debitAmount,
        formattedDebitAmount: formatCurrency(b.debitAmount),
        netCashFlow,
        formattedNetCashFlow: formatCurrency(netCashFlow),
        voucherCount: b.voucherCount
      };
    });

    const totalSocietyCredit = items.reduce((acc, i) => acc + i.creditAmount, 0);
    const totalSocietyDebit = items.reduce((acc, i) => acc + i.debitAmount, 0);

    return {
      meta: this.buildHeaderMeta(context, query, 'Multi-Branch Consolidated Financial Summary', 'FIN-BS-05', { dateFrom, dateTo }),
      kpiSummary: {
        totalBranches: branches.length,
        totalSocietyCredit,
        formattedTotalCredit: formatCurrency(totalSocietyCredit),
        totalSocietyDebit,
        formattedTotalDebit: formatCurrency(totalSocietyDebit),
        netSocietyBalance: totalSocietyCredit - totalSocietyDebit,
        formattedNetBalance: formatCurrency(totalSocietyCredit - totalSocietyDebit)
      },
      items,
      pagination: {
        totalRecords: items.length,
        page: 1,
        limit: items.length,
        totalPages: 1
      }
    };
  }

  // ==========================================
  // 6. Leads & Loan Applications Handler
  // ==========================================
  async generateLeadsAndLoansReport(context, query) {
    const { dateFrom, dateTo } = this.resolveDateRange(query);
    const scope = this.buildScope(context, query.branchId);

    const filter = {
      ...scope,
      createdAt: { $gte: dateFrom, $lte: dateTo }
    };

    if (query.status) {
      filter.status = query.status;
    }

    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;

    const [loans, totalRecords] = await Promise.all([
      Loan.find(filter)
        .populate('branchId', 'name code')
        .populate('createdBy', 'fullName email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Loan.countDocuments(filter)
    ]);

    const totalDisbursed = loans.reduce((acc, l) => acc + (Number(l.amount) || 0), 0);

    return {
      meta: this.buildHeaderMeta(context, query, 'Leads & Loan Applications Portfolio Report', 'BUS-LN-06', { dateFrom, dateTo }),
      kpiSummary: {
        totalApplications: totalRecords,
        totalDisbursed,
        formattedTotalDisbursed: formatCurrency(totalDisbursed)
      },
      items: loans.map((l, idx) => ({
        srNo: skip + idx + 1,
        id: l._id,
        loanNo: l.loanNo || l.applicationNo || `LN-${l._id.toString().slice(-6)}`,
        applicantName: l.borrowerName || l.applicantName || 'N/A',
        amount: l.amount || 0,
        formattedAmount: formatCurrency(l.amount),
        status: l.status || 'PENDING',
        branchName: l.branchId?.name || null,
        createdBy: l.createdBy?.fullName || l.createdBy?.email || 'System',
        createdAt: l.createdAt
      })),
      pagination: {
        totalRecords,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(totalRecords / limit))
      }
    };
  }

  // ==========================================
  // 7. CIBIL Score Assessment Report Handler
  // ==========================================
  async generateCibilReport(context, query) {
    const { dateFrom, dateTo } = this.resolveDateRange(query);
    if (!context?.bankId) throw ApiError.forbidden('Valid bank context required.');

    const scope = this.buildScope(context, query.branchId);
    const filter = {
      societyId: context.bankId,
      createdAt: { $gte: dateFrom, $lte: dateTo }
    };

    if (scope.branchId) {
      filter.branchId = scope.branchId;
    }

    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;

    const [records, totalRecords] = await Promise.all([
      CreditReportRequest.find(filter)
        .populate('requestedBy', 'fullName email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CreditReportRequest.countDocuments(filter)
    ]);

    let sumScore = 0;
    let validCount = 0;

    records.forEach(r => {
      const score = Number(r.cibilScore || r.score || 0);
      if (score > 0) {
        sumScore += score;
        validCount++;
      }
    });

    const avgScore = validCount > 0 ? Math.round(sumScore / validCount) : 0;

    return {
      meta: this.buildHeaderMeta(context, query, 'CIBIL Credit Score Assessment Audit Report', 'BUS-CB-07', { dateFrom, dateTo }),
      kpiSummary: {
        totalChecks: totalRecords,
        averageCibilScore: avgScore
      },
      items: records.map((r, idx) => ({
        srNo: skip + idx + 1,
        id: r._id,
        customerName: r.fullName || r.customerName || 'N/A',
        panNumber: r.pan || r.panNumber || 'N/A',
        cibilScore: r.cibilScore || r.score || 0,
        riskTier: (r.cibilScore || r.score) >= 750 ? 'LOW_RISK' : ((r.cibilScore || r.score) >= 650 ? 'MEDIUM_RISK' : 'HIGH_RISK'),
        status: r.status || 'completed',
        createdBy: r.requestedBy?.fullName || r.requestedBy?.email || 'System',
        createdAt: r.createdAt
      })),
      pagination: {
        totalRecords,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(totalRecords / limit))
      }
    };
  }

  // ==========================================
  // 8. Staff Attendance Report Handler
  // ==========================================
  async generateAttendanceReport(context, query) {
    const { dateFrom, dateTo } = this.resolveDateRange(query);
    const scope = this.buildScope(context, query.branchId);

    const filter = {
      ...scope,
      date: { $gte: dateFrom, $lte: dateTo }
    };

    if (query.status) {
      filter.status = String(query.status).toUpperCase();
    }

    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;

    const [records, totalRecords] = await Promise.all([
      Attendance.find(filter)
        .populate('employeeId', 'fullName name employeeCode')
        .populate('branchId', 'name code')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Attendance.countDocuments(filter)
    ]);

    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;

    records.forEach(r => {
      const st = String(r.status || '').toUpperCase();
      if (st === 'PRESENT') presentCount++;
      else if (st === 'ABSENT') absentCount++;
      else if (st === 'LATE') lateCount++;
    });

    return {
      meta: this.buildHeaderMeta(context, query, 'Staff Attendance & Shift Punch Log Report', 'OPS-AT-08', { dateFrom, dateTo }),
      kpiSummary: {
        totalAttendanceLogs: totalRecords,
        presentCount,
        absentCount,
        lateCount
      },
      items: records.map((r, idx) => ({
        srNo: skip + idx + 1,
        id: r._id,
        date: r.date,
        employeeCode: r.employeeId?.employeeCode || 'EMP',
        employeeName: r.employeeId?.fullName || r.employeeId?.name || 'N/A',
        branchName: r.branchId?.name || null,
        punchIn: r.punchInTime || r.punchIn || null,
        punchOut: r.punchOutTime || r.punchOut || null,
        status: r.status || 'PRESENT'
      })),
      pagination: {
        totalRecords,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(totalRecords / limit))
      }
    };
  }

  // ==========================================
  // 9. Staff Directory Report Handler
  // ==========================================
  async generateStaffDirectoryReport(context, query) {
    const scope = this.buildScope(context, query.branchId);

    const filter = { ...scope };
    if (query.status) {
      filter.status = String(query.status).toUpperCase();
    }

    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;

    const [employees, totalRecords] = await Promise.all([
      SocietyEmployee.find(filter)
        .populate('branchId', 'name code')
        .populate('roleId', 'name code')
        .populate('createdBy', 'fullName email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SocietyEmployee.countDocuments(filter)
    ]);

    const activeCount = employees.filter(e => e.status === 'ACTIVE').length;

    return {
      meta: this.buildHeaderMeta(context, query, 'Employee Directory & Role Audit Report', 'OPS-EM-09', { dateFrom: new Date(0), dateTo: new Date() }),
      kpiSummary: {
        totalEmployees: totalRecords,
        activeEmployees: activeCount,
        inactiveEmployees: totalRecords - activeCount
      },
      items: employees.map((e, idx) => ({
        srNo: skip + idx + 1,
        id: e._id,
        employeeCode: e.employeeCode || `EMP-${e._id.toString().slice(-4)}`,
        name: e.fullName || e.name || 'N/A',
        email: e.email || '',
        phone: e.phone || e.mobileNumber || '',
        role: e.roleId?.name || e.designation || 'Staff',
        branchName: e.branchId?.name || null,
        status: e.status || 'ACTIVE',
        createdBy: e.createdBy?.fullName || e.createdBy?.email || 'System',
        joiningDate: e.createdAt
      })),
      pagination: {
        totalRecords,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(totalRecords / limit))
      }
    };
  }

  // ==========================================
  // 10. Daily Work Report (DWR) Handler
  // ==========================================
  async generateDailyWorkReport(context, query) {
    const { dateFrom, dateTo } = this.resolveDateRange(query);
    const scope = this.buildScope(context, query.branchId);

    const filter = {
      ...scope,
      date: { $gte: dateFrom, $lte: dateTo }
    };

    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;

    const [dwrs, totalRecords] = await Promise.all([
      DailyWorkReport.find(filter)
        .populate('employeeId', 'fullName name')
        .populate('branchId', 'name code')
        .populate('createdBy', 'fullName email role')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DailyWorkReport.countDocuments(filter)
    ]);

    let totalVisits = 0;
    dwrs.forEach(d => {
      totalVisits += Number(d.visitsCount || d.totalVisits || 0);
    });

    return {
      meta: this.buildHeaderMeta(context, query, 'Daily Work Report Executive Tracker', 'OPS-DW-10', { dateFrom, dateTo }),
      kpiSummary: {
        totalReports: totalRecords,
        totalFieldVisits: totalVisits
      },
      items: dwrs.map((d, idx) => ({
        srNo: skip + idx + 1,
        id: d._id,
        date: d.date,
        executiveName: d.employeeId?.fullName || d.employeeId?.name || 'N/A',
        branchName: d.branchId?.name || null,
        visitsCount: d.visitsCount || d.totalVisits || 0,
        createdBy: d.createdBy?.fullName || d.employeeId?.fullName || 'System',
        remarks: d.remarks || d.summary || ''
      })),
      pagination: {
        totalRecords,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(totalRecords / limit))
      }
    };
  }

  // ==========================================
  // 11. Credit Usage Report Handler
  // ==========================================
  async generateCreditUsageReport(context, query) {
    const { dateFrom, dateTo } = this.resolveDateRange(query);
    const scope = this.buildScope(context, query.branchId);

    const filter = {
      ...scope,
      createdAt: { $gte: dateFrom, $lte: dateTo }
    };

    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;

    const [usage, totalRecords] = await Promise.all([
      CardCreditUsage.find(filter)
        .populate('branchId', 'name code')
        .populate('createdBy', 'fullName email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CardCreditUsage.countDocuments(filter)
    ]);

    const totalCreditsUsed = usage.reduce((acc, u) => acc + (Number(u.credits) || 0), 0);

    return {
      meta: this.buildHeaderMeta(context, query, 'Verification Credit & EMI Card Usage Report', 'FIN-CC-11', { dateFrom, dateTo }),
      kpiSummary: {
        totalUsageLogs: totalRecords,
        totalCreditsConsumed: totalCreditsUsed
      },
      items: usage.map((u, idx) => ({
        srNo: skip + idx + 1,
        id: u._id,
        date: u.createdAt,
        branchName: u.branchId?.name || null,
        creditsConsumed: u.credits || 0,
        actionType: u.actionType || 'VERIFICATION',
        createdBy: u.createdBy?.fullName || u.createdBy?.email || 'System',
        referenceNo: u.referenceNo || 'REF'
      })),
      pagination: {
        totalRecords,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(totalRecords / limit))
      }
    };
  }

  // ==========================================
  // 12. Merchant Summary Report Handler
  // ==========================================
  async generateMerchantReport(context, query) {
    const { dateFrom, dateTo } = this.resolveDateRange(query);
    const scope = this.buildScope(context, query.branchId);

    const filter = {
      ...scope,
      createdAt: { $gte: dateFrom, $lte: dateTo }
    };

    if (query.status) filter.status = String(query.status).toUpperCase();

    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;

    const [merchants, totalRecords] = await Promise.all([
      MerchantProfile.find(filter)
        .populate('branchId', 'name code')
        .populate('createdBy', 'fullName email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MerchantProfile.countDocuments(filter)
    ]);

    const activeCount = merchants.filter(m => m.status === 'ACTIVE').length;

    return {
      meta: this.buildHeaderMeta(context, query, 'Merchant Partner & Sales Performance Report', 'BUS-MC-12', { dateFrom, dateTo }),
      kpiSummary: {
        totalMerchants: totalRecords,
        activeMerchants: activeCount,
        pendingMerchants: totalRecords - activeCount
      },
      items: merchants.map((m, idx) => ({
        srNo: skip + idx + 1,
        id: m._id,
        businessName: m.businessName || m.storeName || 'N/A',
        ownerName: m.ownerName || m.name || 'N/A',
        phone: m.phone || m.mobileNumber || '',
        branchName: m.branchId?.name || null,
        status: m.status || 'PENDING',
        createdBy: m.createdBy?.fullName || m.createdBy?.email || 'System',
        createdAt: m.createdAt
      })),
      pagination: {
        totalRecords,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(totalRecords / limit))
      }
    };
  }

  // ==========================================
  // Industrial Fintech UTF-8 BOM CSV Exporter
  // ==========================================
  async exportReportCsv(reportType, context, query = {}) {
    const fullQuery = { ...query, page: 1, limit: 5000 };
    const reportData = await this.generateReport(reportType, context, fullQuery);

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const meta = reportData.meta;
    const headerRows = [
      ['BANK NAME', meta.bankName],
      ['REPORT TITLE', meta.reportTitle],
      ['REPORT CODE', meta.reportCode],
      ['GENERATED AT', meta.generatedAt],
      ['GENERATED BY USER ID', meta.generatedByUserId],
      ['GENERATED BY', meta.generatedBy],
      ['GENERATED BY ROLE', meta.generatedByRole],
      ['DATE RANGE FROM', meta.dateRange.from],
      ['DATE RANGE TO', meta.dateRange.to],
      ['APPLIED BRANCH', meta.appliedFilters.branchId],
      []
    ];

    const items = reportData.items || [];
    let tableHeaders = [];
    let dataRows = [];

    if (items.length > 0) {
      const keys = Object.keys(items[0]).filter(k => k !== 'id');
      tableHeaders = keys.map(k => k.toUpperCase());
      dataRows = items.map(item => keys.map(k => item[k]));
    } else {
      tableHeaders = ['STATUS'];
      dataRows = [['NO DATA FOUND FOR APPLIED FILTERS']];
    }

    const csvContent = [
      ...headerRows.map(r => r.map(escapeCsv).join(',')),
      tableHeaders.map(escapeCsv).join(','),
      ...dataRows.map(r => r.map(escapeCsv).join(','))
    ].join('\n');

    // UTF-8 BOM prefix (\uFEFF) ensures Excel renders Indian Currency symbols (₹) correctly
    return '\uFEFF' + csvContent;
  }

  // ==========================================
  // Industrial Fintech PDF Exporter
  // ==========================================
  async exportReportPdf(reportType, context, query = {}) {
    const fullQuery = { ...query, page: 1, limit: 1000 };
    const reportData = await this.generateReport(reportType, context, fullQuery);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 30, bufferPages: true });
        const buffers = [];
        doc.on('data', chunk => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', err => reject(err));

        const meta = reportData.meta;
        const kpi = reportData.kpiSummary || {};
        const items = reportData.items || [];

        const C = {
          primary: '#1b3a63',
          accent: '#C09637',
          text: '#1a202c',
          muted: '#718096',
          border: '#cbd5e0',
          bgLight: '#f7fafc',
          white: '#ffffff'
        };

        const L = 30;
        const W = 535;
        let y = 30;

        // 1. BRANDING HEADER
        doc.rect(L, y, W, 45).fill(C.primary);
        doc.fontSize(13).fillColor(C.accent).font('Helvetica-Bold').text(meta.bankName || 'SAHAYAONE CO-OPERATIVE BANK', L + 12, y + 8, { width: 300 });
        doc.fontSize(8).fillColor('#A0AEC0').font('Helvetica').text('Industrial Fintech ERP — Official Audit Report', L + 12, y + 27);
        doc.fontSize(10).fillColor(C.white).font('Helvetica-Bold').text(meta.reportTitle, L + 320, y + 8, { width: 200, align: 'right' });
        doc.fontSize(7.5).fillColor('#90CDF4').font('Helvetica').text(`Code: ${meta.reportCode} | ${new Date(meta.generatedAt).toLocaleDateString('en-IN')}`, L + 320, y + 26, { width: 200, align: 'right' });

        y += 52;

        // 2. METADATA SUMMARY BAR
        doc.rect(L, y, W, 28).fill(C.bgLight).strokeColor(C.border).lineWidth(0.5).stroke();
        doc.fontSize(7.5).fillColor(C.text).font('Helvetica-Bold').text('Date Range:', L + 8, y + 6);
        doc.font('Helvetica').text(`${new Date(meta.dateRange.from).toLocaleDateString('en-IN')} - ${new Date(meta.dateRange.to).toLocaleDateString('en-IN')}`, L + 60, y + 6);

        doc.font('Helvetica-Bold').text('Applied Branch:', L + 210, y + 6);
        doc.font('Helvetica').text(String(meta.appliedFilters.branchId || 'ALL'), L + 275, y + 6);

        doc.font('Helvetica-Bold').text('Generated By:', L + 360, y + 6);
        doc.font('Helvetica').text(`${meta.generatedBy} (${meta.generatedByRole})`, L + 420, y + 6, { width: 110, height: 18, lineBreak: false });

        y += 36;

        // 3. KPI SUMMARY CARDS
        const kpiKeys = Object.keys(kpi).filter(k => !k.startsWith('formatted'));
        if (kpiKeys.length > 0) {
          doc.fontSize(8.5).fillColor(C.primary).font('Helvetica-Bold').text('KEY PERFORMANCE INDICATORS (KPI)', L, y);
          y += 12;

          const cardCount = Math.min(kpiKeys.length, 4);
          const cardW = (W - (cardCount - 1) * 8) / cardCount;

          kpiKeys.slice(0, 4).forEach((k, idx) => {
            const cx = L + idx * (cardW + 8);
            doc.rect(cx, y, cardW, 36).fill(C.white).strokeColor(C.border).lineWidth(0.5).stroke();
            doc.rect(cx, y, cardW, 2.5).fill(C.accent);

            const formattedKey = `formatted${k.charAt(0).toUpperCase() + k.slice(1)}`;
            const displayVal = kpi[formattedKey] !== undefined ? kpi[formattedKey] : kpi[k];
            const label = k.replace(/([A-Z])/g, ' $1').toUpperCase();

            doc.fontSize(9.5).fillColor(C.primary).font('Helvetica-Bold').text(String(displayVal), cx + 4, y + 8, { width: cardW - 8, align: 'center' });
            doc.fontSize(6.5).fillColor(C.muted).font('Helvetica').text(label, cx + 2, y + 24, { width: cardW - 4, align: 'center' });
          });
          y += 44;
        }

        // 4. DATA TABLE
        if (items.length > 0) {
          const keys = Object.keys(items[0]).filter(k => k !== 'id');
          const colCount = keys.length;
          const colW = W / colCount;

          // Header
          doc.rect(L, y, W, 18).fill(C.primary);
          keys.forEach((k, idx) => {
            const hText = k.replace(/([A-Z])/g, ' $1').toUpperCase();
            doc.fontSize(6.5).fillColor(C.white).font('Helvetica-Bold').text(hText, L + idx * colW + 2, y + 5, { width: colW - 4, align: 'center', lineBreak: false });
          });
          y += 18;

          // Rows
          items.forEach((item, rIdx) => {
            if (y > 760) {
              doc.addPage();
              y = 30;
              // Repeat header
              doc.rect(L, y, W, 18).fill(C.primary);
              keys.forEach((k, idx) => {
                const hText = k.replace(/([A-Z])/g, ' $1').toUpperCase();
                doc.fontSize(6.5).fillColor(C.white).font('Helvetica-Bold').text(hText, L + idx * colW + 2, y + 5, { width: colW - 4, align: 'center', lineBreak: false });
              });
              y += 18;
            }

            const rowBg = rIdx % 2 === 0 ? C.white : C.bgLight;
            doc.rect(L, y, W, 16).fill(rowBg).strokeColor(C.border).lineWidth(0.3).stroke();

            keys.forEach((k, idx) => {
              let val = item[k];
              if (val instanceof Date || (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}T/))) {
                val = new Date(val).toLocaleDateString('en-IN');
              }
              doc.fontSize(6.5).fillColor(C.text).font('Helvetica').text(val !== null && val !== undefined ? String(val) : '-', L + idx * colW + 2, y + 4, { width: colW - 4, align: 'center', lineBreak: false });
            });

            y += 16;
          });
        }

        // Add page numbers
        const totalPages = doc.bufferedPageRange().count;
        for (let i = 0; i < totalPages; i++) {
          doc.switchToPage(i);
          doc.fontSize(7).fillColor(C.muted).text(`Page ${i + 1} of ${totalPages} — Sahayaone Co-operative Banking ERP Official Report`, L, 815, { width: W, align: 'center' });
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

export const societyReportService = new SocietyReportService();
