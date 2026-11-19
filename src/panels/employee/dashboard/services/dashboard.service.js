import { Banner } from '../../../../models/banner.model.js';
import { Loan } from '../../../../models/loan.model.js';
import { CustomerProfile } from '../../../../models/customer-profile.model.js';
import { PigmyCustomer } from '../../../../models/pigmy-customer.model.js';
import { MerchantProfile } from '../../../../models/merchant-profile.model.js';
import { SocietyEmployee } from '../../../../models/society-employee.model.js';
import { EmployeeProfile } from '../../../../models/employee-profile.model.js';
import { employeeKpaService } from '../../kpa/services/employee-kpa.service.js';
import { getISTDayRange } from '../../../../utils/date.util.js';
import mongoose from 'mongoose';

export class EmployeeDashboardService {
  /**
   * Retrieves active banners for the Executive App (supports optional bannerType filter)
   */
  async getBanners(queryOptions = {}) {
    const { bannerType, portalType } = queryOptions;

    // Strictly filter banners assigned to EXECUTIVE_APP (unless explicitly overridden by portalType query)
    const targetPortal = portalType && typeof portalType === 'string' && portalType.trim()
      ? portalType.trim().toUpperCase()
      : 'EXECUTIVE_APP';

    const filter = {
      isDeleted: { $ne: true },
      status: 'ACTIVE',
      portalType: {
        $in: [
          targetPortal,
          ...(targetPortal === 'EXECUTIVE_APP' ? ['LOAN_EXECUTIVE_APP', 'Loan Executive App', 'Executive App'] : [])
        ]
      }
    };

    if (bannerType && typeof bannerType === 'string' && bannerType.trim()) {
      filter.bannerType = new RegExp(`^${bannerType.trim()}$`, 'i');
    }

    const banners = await Banner.find(filter)
      .sort({ createdAt: -1 })
      .select('_id portalType bannerType imageUrl imageKey status createdAt')
      .lean();

    return {
      banners,
      count: banners.length
    };
  }

  /**
   * Retrieves business overview cards (CD Loan, Smart Pigmy, Merchant Onboard) for Executive App
   */
  async getBusinessCards(executiveId, userContext = {}) {
    const execUserId = String(executiveId || userContext.id || userContext._id || '').trim();
    const execObjId = mongoose.Types.ObjectId.isValid(execUserId) ? new mongoose.Types.ObjectId(execUserId) : null;

    // Resolve all possible ID aliases for this executive (User ID, SocietyEmployee ID, EmployeeProfile ID)
    const idMatches = [];
    if (execUserId) idMatches.push(execUserId);
    if (execObjId) idMatches.push(execObjId);

    const [societyEmployee, empProfile] = await Promise.all([
      execUserId ? SocietyEmployee.findOne({ userId: execUserId, isDeleted: { $ne: true } }).lean() : null,
      execUserId ? EmployeeProfile.findOne({ userId: execUserId, isDeleted: { $ne: true } }).lean() : null
    ]);

    if (societyEmployee?._id) {
      idMatches.push(societyEmployee._id.toString());
      idMatches.push(societyEmployee._id);
    }
    if (empProfile?._id) {
      idMatches.push(empProfile._id.toString());
      idMatches.push(empProfile._id);
    }

    const branchId = userContext.branchId || societyEmployee?.branchId || null;
    const isManagerRole = ['BRANCH_MANAGER', 'BANK_OWNER', 'SOCIETY_ADMIN', 'SUPER_ADMIN'].includes(userContext.role);

    // 1. CD Loan Count (Excludes incomplete/draft loan applications to match leads listing)
    const loanFilter = {
      isDeleted: { $ne: true },
      status: { $nin: ['DRAFT', 'INCOMPLETE', 'CANCELLED', 'EXPIRED', 'LOOKUP_DONE', 'OTP_VERIFIED'] },
      currentStep: { $nin: ['LOOKUP', 'PRODUCT_DETAILS', 'SLABS', 'CALCULATE', 'LOAN_CALCULATED'] },
      $or: [
        { createdByExecutiveId: { $in: idMatches } },
        { assignedEmployeeId: { $in: idMatches } },
        { createdBy: { $in: idMatches } },
        { 'executive.id': { $in: idMatches } },
        { 'executive.userId': { $in: idMatches } },
        { 'createdByDetails.id': { $in: idMatches } },
        { 'createdByDetails.userId': { $in: idMatches } }
      ]
    };
    let totalLoans = await Loan.countDocuments(loanFilter);
    if (totalLoans === 0 && isManagerRole && branchId) {
      totalLoans = await Loan.countDocuments({
        branchId,
        isDeleted: { $ne: true },
        status: { $nin: ['DRAFT', 'INCOMPLETE', 'CANCELLED', 'EXPIRED', 'LOOKUP_DONE', 'OTP_VERIFIED'] },
        currentStep: { $nin: ['LOOKUP', 'PRODUCT_DETAILS', 'SLABS', 'CALCULATE', 'LOAN_CALCULATED'] }
      });
    }

    // 2. Smart Pigmy Count
    const pigmyFilter = {
      isDeleted: { $ne: true },
      $or: [
        { 'onboardedBy.id': { $in: idMatches } },
        { 'onboardedBy.userId': { $in: idMatches } },
        { createdBy: { $in: idMatches } },
        { executiveId: { $in: idMatches } }
      ]
    };
    let totalPigmy = await PigmyCustomer.countDocuments(pigmyFilter);
    if (totalPigmy === 0 && isManagerRole && branchId) {
      totalPigmy = await PigmyCustomer.countDocuments({ branchId, isDeleted: { $ne: true } });
    }

    // 3. Merchant Onboard Count
    const merchantFilter = {
      isDeleted: { $ne: true },
      $or: [
        { 'onboardedBy.id': { $in: idMatches } },
        { 'onboardedBy.userId': { $in: idMatches } },
        { createdBy: { $in: idMatches } }
      ]
    };
    let totalMerchants = await MerchantProfile.countDocuments(merchantFilter);
    if (totalMerchants === 0 && isManagerRole && branchId) {
      totalMerchants = await MerchantProfile.countDocuments({ branchId, isDeleted: { $ne: true } });
    }

    const cards = [
      {
        id: 'cd_loan',
        key: 'cdLoan',
        title: 'CD Loan',
        subtitle: 'View Customer Loan data',
        label: 'Total Loan',
        count: totalLoans,
        total: totalLoans,
        formattedText: `Total Loan: ${totalLoans}`,
        route: '/loans'
      },
      {
        id: 'smart_pigmy',
        key: 'smartPigmy',
        title: 'Smart Pigmy',
        subtitle: 'View Smart Pigmy data',
        label: 'Total Pigmy',
        count: totalPigmy,
        total: totalPigmy,
        formattedText: `Total Pigmy: ${totalPigmy}`,
        route: '/pigmy'
      },
      {
        id: 'merchant_onboard',
        key: 'merchantOnboard',
        title: 'Merchant Onboard',
        subtitle: 'View merchant data',
        label: 'Total Merchant',
        count: totalMerchants,
        total: totalMerchants,
        formattedText: `Total Merchant: ${totalMerchants}`,
        route: '/merchants'
      }
    ];

    return {
      totalLoans,
      totalPigmy,
      totalMerchants,
      cdLoan: {
        title: 'CD Loan',
        subtitle: 'View Customer Loan data',
        label: 'Total Loan',
        count: totalLoans,
        totalLoan: totalLoans
      },
      smartPigmy: {
        title: 'Smart Pigmy',
        subtitle: 'View Smart Pigmy data',
        label: 'Total Pigmy',
        count: totalPigmy,
        totalPigmy: totalPigmy
      },
      merchantOnboard: {
        title: 'Merchant Onboard',
        subtitle: 'View merchant data',
        label: 'Total Merchant',
        count: totalMerchants,
        totalMerchant: totalMerchants
      },
      cards
    };
  }

  /**
   * Retrieves summary statistics for the Loan Executive's dashboard
   */
  async getStats(executiveId, userContext = {}) {
    const executiveObjectId = new mongoose.Types.ObjectId(executiveId);

    // 1. Due Accounts Count (Active loans with any unpaid 'DUE' installment)
    const dueAccounts = await Loan.countDocuments({
      $or: [{ createdByExecutiveId: executiveObjectId }, { assignedEmployeeId: executiveObjectId }],
      status: 'ACTIVE',
      'schedule.status': 'DUE',
      isDeleted: { $ne: true }
    });

    // 2. Today's Collections Amount (Sum of EMI installments paid today in IST)
    const { start: todayStart, end: todayEnd } = getISTDayRange(new Date());

    const collectionsResult = await Loan.aggregate([
      {
        $match: {
          $or: [{ createdByExecutiveId: executiveObjectId }, { assignedEmployeeId: executiveObjectId }],
          isDeleted: { $ne: true }
        }
      },
      { $unwind: '$schedule' },
      {
        $match: {
          'schedule.status': 'PAID',
          'schedule.paidAt': { $gte: todayStart, $lte: todayEnd }
        }
      },
      {
        $group: {
          _id: null,
          totalCollected: { $sum: '$schedule.amount' }
        }
      }
    ]);
    const todayCollections = collectionsResult.length > 0 ? collectionsResult[0].totalCollected : 0;

    // 3. Total Leads Count (Total loan books registered by this executive)
    const totalLeads = await Loan.countDocuments({
      createdByExecutiveId: executiveObjectId,
      isDeleted: { $ne: true }
    });

    // 4. Pending Applications (Draft/NEW status application books)
    const pendingApplications = await Loan.countDocuments({
      createdByExecutiveId: executiveObjectId,
      status: 'NEW',
      isDeleted: { $ne: true }
    });

    // 5. Pending Approvals (Applications in PENDING_DOWN_PAYMENT step)
    const pendingApprovals = await Loan.countDocuments({
      createdByExecutiveId: executiveObjectId,
      status: 'PENDING_DOWN_PAYMENT',
      isDeleted: { $ne: true }
    });

    // 6. Total Disbursal Value (Active/Completed loan principal sum)
    const disbursalResult = await Loan.aggregate([
      {
        $match: {
          createdByExecutiveId: executiveObjectId,
          status: { $in: ['ACTIVE', 'COMPLETED'] },
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: null,
          totalDisbursed: { $sum: '$totalLoanAmount' }
        }
      }
    ]);
    const disbursalValue = disbursalResult.length > 0 ? disbursalResult[0].totalDisbursed : 0;

    // 7. Account Opening Count (Total customer accounts created by this executive)
    const accountOpening = await CustomerProfile.countDocuments({
      createdByExecutiveId: executiveObjectId,
      isDeleted: { $ne: true }
    });

    // 8. Unresolved Tickets (Placeholder mock matching exact UI design)
    const unresolvedTickets = 3;

    // Currency Formatting helper e.g. 320000 -> ₹3.2L
    const formatCurrencyIndian = (num) => {
      if (num === null || num === undefined) return "₹0";
      if (num >= 100000) {
        return `₹${(num / 100000).toFixed(1).replace(/\.0$/, '')}L`;
      }
      if (num >= 1000) {
        return `₹${(num / 1000).toFixed(1).replace(/\.0$/, '')}K`;
      }
      return `₹${num}`;
    };

    // 9. Fetch KPA Report summary safely
    let kpaSummary = null;
    try {
      kpaSummary = await employeeKpaService.getMyKpaReportDetail(executiveId);
    } catch (e) {
      kpaSummary = null;
    }

    // 10. Fetch Business Overview Cards (CD Loan, Smart Pigmy, Merchant Onboard)
    let businessData = {
      totalLoans: 0,
      totalPigmy: 0,
      totalMerchants: 0,
      cdLoan: { title: 'CD Loan', subtitle: 'View Customer Loan data', label: 'Total Loan', count: 0, totalLoan: 0 },
      smartPigmy: { title: 'Smart Pigmy', subtitle: 'View Smart Pigmy data', label: 'Total Pigmy', count: 0, totalPigmy: 0 },
      merchantOnboard: { title: 'Merchant Onboard', subtitle: 'View merchant data', label: 'Total Merchant', count: 0, totalMerchant: 0 },
      cards: []
    };
    try {
      businessData = await this.getBusinessCards(executiveId, userContext);
    } catch (e) {
      // Fallback
    }

    return {
      dueAccounts,
      todayCollections: {
        raw: todayCollections,
        formatted: formatCurrencyIndian(todayCollections)
      },
      totalLeads,
      pendingApplications,
      pendingApprovals,
      disbursalValue: {
        raw: disbursalValue,
        formatted: formatCurrencyIndian(disbursalValue)
      },
      accountOpening,
      unresolvedTickets,
      kpaSummary,
      totalLoans: businessData.totalLoans,
      totalPigmy: businessData.totalPigmy,
      totalMerchants: businessData.totalMerchants,
      cdLoan: businessData.cdLoan,
      smartPigmy: businessData.smartPigmy,
      merchantOnboard: businessData.merchantOnboard,
      businessCards: businessData.cards
    };
  }
}

export const employeeDashboardService = new EmployeeDashboardService();
