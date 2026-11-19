import { OnboardingTeam } from '../../../../models/onboarding-team.model.js';
import { CashSubmission } from '../../../../models/cash-submission.model.js';
import { Bank } from '../../../../models/bank.model.js';
import { Branch } from '../../../../models/branch.model.js';
import { User } from '../../../../models/user.model.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';
import { logger } from '../../../../utils/logger.util.js';

export class CashPaymentService {
  formatCurrency(amount) {
    if (amount === null || amount === undefined) return '₹0';
    return '₹' + Number(amount).toLocaleString('en-IN');
  }

  formatDateSlash(dateObj) {
    if (!dateObj) return '';
    const d = new Date(dateObj);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  parseDate(dateStr) {
    if (!dateStr) return new Date();
    if (typeof dateStr === 'string' && dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]);
      }
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  /**
   * Helper to fetch live aggregated cash metrics for an onboarding team member
   */
  async getMemberCashAggregates(member) {
    const memberId = member._id;
    const userId = member.userId;

    const matchConditions = [{ cashCollectedByTeamId: memberId }];
    if (userId) {
      matchConditions.push({ cashCollectedBy: userId });
      matchConditions.push({ createdBy: userId, paymentMethod: 'CASH', paymentStatus: 'SUCCESS' });
    }

    // 1. Fetch all cash onboarded banks
    const banks = await Bank.find({
      $or: matchConditions,
      paymentMethod: 'CASH',
      paymentStatus: 'SUCCESS',
      isDeleted: { $ne: true }
    }).lean();

    const totalCashCollection = banks.reduce((sum, b) => sum + (b.totalAmountPaid || 0), 0);

    // 2. Fetch all verified cash submissions
    const subMatchConditions = [{ onboardingTeamId: memberId }];
    if (userId) {
      subMatchConditions.push({ employeeId: userId });
    }
    subMatchConditions.push({ employeeId: memberId });

    const submissions = await CashSubmission.find({
      $or: subMatchConditions,
      status: { $in: ['VERIFIED', 'SUBMITTED'] },
      isDeleted: { $ne: true }
    }).lean();

    const totalCashSubmitted = submissions.reduce((sum, s) => sum + (s.amountSubmitted || 0), 0);
    const totalCashPending = Math.max(0, totalCashCollection - totalCashSubmitted);

    return {
      banks,
      submissions,
      totalCashCollection,
      totalCashSubmitted,
      totalCashPending
    };
  }

  /**
   * List Cash Payments for all Onboarding Team Employees (Overview Table)
   */
  async listCashPayments(queryOptions) {
    const page = parseInt(queryOptions.page || '1', 10);
    const limit = parseInt(queryOptions.limit || '10', 10);
    const search = (queryOptions.search || '').trim();
    const skip = (page - 1) * limit;

    const filter = { isDeleted: { $ne: true } };

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [
        { fullName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { onboardingTeamType: searchRegex }
      ];
    }

    const [members, totalRecords] = await Promise.all([
      OnboardingTeam.find(filter)
        .populate('branchId', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      OnboardingTeam.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    // Process live dynamic cash collections per employee
    const items = await Promise.all(
      members.map(async (m, idx) => {
        const { totalCashCollection, totalCashSubmitted, totalCashPending } =
          await this.getMemberCashAggregates(m);

        return {
          srNo: skip + idx + 1,
          id: m._id,
          employeeId: m._id,
          employeeName: m.fullName,
          fullName: m.fullName,
          profileImage: m.profileImage || null,
          designation: m.onboardingTeamType || 'Onboarding Team',
          phoneNumber: m.phone,
          email: m.email,
          totalCashCollection,
          formattedTotalCashCollection: this.formatCurrency(totalCashCollection),
          totalCashSubmitted,
          formattedTotalCashSubmitted: this.formatCurrency(totalCashSubmitted),
          totalCashPending,
          formattedTotalCashPending: this.formatCurrency(totalCashPending)
        };
      })
    );

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
   * Get View Details & Bank-Wise Breakdown for a single Employee
   */
  async getCashPaymentDetails(employeeId, queryOptions = {}) {
    const page = parseInt(queryOptions.page || '1', 10);
    const limit = parseInt(queryOptions.limit || '10', 10);
    const skip = (page - 1) * limit;

    let member = await OnboardingTeam.findOne({
      $or: [{ _id: employeeId }, { userId: employeeId }],
      isDeleted: { $ne: true }
    })
      .populate('branchId', 'name code')
      .lean();

    if (!member) {
      const user = await User.findById(employeeId).lean();
      if (user) {
        member = {
          _id: user._id,
          userId: user._id,
          fullName: user.fullName,
          phone: user.phoneNumber,
          email: user.email,
          onboardingTeamType: 'Onboarding Team'
        };
      }
    }

    if (!member) {
      throw ApiError.notFound('Onboarding team employee not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const employeeName = member.fullName || 'Onboarding Executive';
    const designation = member.onboardingTeamType || 'Onboarding Team';
    const phone = member.phone || '';
    const email = member.email || '';
    const branchName = member?.branchId?.name || 'Head Office';
    const profileImage = member?.profileImage || null;

    // 1. Fetch live metrics and bank collections
    const { banks, totalCashCollection, totalCashSubmitted, totalCashPending } =
      await this.getMemberCashAggregates(member);

    // 2. Format bank collections breakdown list
    const bankCollections = banks.map((b) => {
      const amount = b.totalAmountPaid || 0;
      const settledAmount = b.cashSettledAmount || (b.cashSettledStatus === 'SETTLED' ? amount : 0);
      const pendingAmount = b.cashPendingAmount !== undefined ? b.cashPendingAmount : (b.cashSettledStatus === 'SETTLED' ? 0 : amount);
      const status = b.cashSettledStatus || (pendingAmount === 0 ? 'SETTLED' : 'UNSETTLED');

      return {
        bankId: b._id,
        bankName: b.name,
        bankCode: b.code,
        uboName: b.ubo,
        phoneNumber: b.phoneNumber,
        cashCollectedAt: b.cashCollectedAt || b.createdAt,
        formattedDate: this.formatDateSlash(b.cashCollectedAt || b.createdAt),
        amountCollected: amount,
        formattedAmount: this.formatCurrency(amount),
        settledAmount,
        formattedSettledAmount: this.formatCurrency(settledAmount),
        pendingAmount,
        formattedPendingAmount: this.formatCurrency(pendingAmount),
        status
      };
    });

    // 3. Date range filter for submission history
    const historyFilter = {
      $or: [
        { onboardingTeamId: member._id },
        { employeeId: member._id },
        ...(member.userId ? [{ employeeId: member.userId }, { onboardingTeamId: member.userId }] : [])
      ],
      isDeleted: { $ne: true }
    };

    if (queryOptions.fromDate || queryOptions.toDate) {
      historyFilter.date = {};
      if (queryOptions.fromDate) {
        historyFilter.date.$gte = this.parseDate(queryOptions.fromDate);
      }
      if (queryOptions.toDate) {
        const toD = this.parseDate(queryOptions.toDate);
        toD.setHours(23, 59, 59, 999);
        historyFilter.date.$lte = toD;
      }
    }

    const [historyRecords, totalHistoryCount] = await Promise.all([
      CashSubmission.find(historyFilter)
        .populate('bankIds', 'name code')
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CashSubmission.countDocuments(historyFilter)
    ]);

    const totalPages = Math.ceil(totalHistoryCount / limit) || 1;

    const historyItems = historyRecords.map((h, idx) => ({
      srNo: skip + idx + 1,
      id: h._id,
      submissionId: h._id,
      date: this.formatDateSlash(h.date),
      formattedDate: this.formatDateSlash(h.date),
      amountSubmitted: h.amountSubmitted,
      formattedAmountSubmitted: this.formatCurrency(h.amountSubmitted),
      paymentMode: h.paymentMode || 'CASH',
      receiptNumber: h.receiptNumber || '',
      receiptUrl: h.receiptUrl || null,
      remarks: h.remarks || '',
      status: h.status || 'VERIFIED',
      settledBanks: (h.bankIds || []).map(b => ({
        bankId: b._id,
        bankName: b.name,
        bankCode: b.code
      }))
    }));

    return {
      employee: {
        id: member._id,
        employeeId: member._id,
        employeeName,
        fullName: employeeName,
        designation,
        tagPill: designation,
        phone,
        phoneNumber: phone,
        email,
        branch: branchName,
        profileImage
      },
      summaryCards: {
        totalCashCollected: {
          amount: totalCashCollection,
          formattedAmount: this.formatCurrency(totalCashCollection)
        },
        totalCashSubmitted: {
          amount: totalCashSubmitted,
          formattedAmount: this.formatCurrency(totalCashSubmitted)
        },
        totalCashPending: {
          amount: totalCashPending,
          formattedAmount: this.formatCurrency(totalCashPending)
        }
      },
      bankCollections,
      cashSubmitHistory: {
        items: historyItems,
        meta: {
          totalRecords: totalHistoryCount,
          limit,
          page,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    };
  }

  /**
   * Submit Cash entry and settle bank collections
   */
  async submitCash(employeeId, payload, submitterId = null) {
    const rawAmount = payload.amount || payload.amountSubmitted;
    if (!rawAmount || parseFloat(rawAmount) <= 0) {
      throw ApiError.badRequest('Amount is required and must be greater than 0.', ErrorCode.VALIDATION_ERROR);
    }

    const amount = parseFloat(rawAmount);
    const date = this.parseDate(payload.date);
    const remarks = (payload.remarks || '').trim();
    const paymentMode = payload.paymentMode || 'CASH';
    const receiptNumber = (payload.receiptNumber || '').trim();
    const receiptUrl = payload.receiptUrl || null;
    const requestedBankIds = Array.isArray(payload.bankIds) ? payload.bankIds : [];

    let member = await OnboardingTeam.findOne({
      $or: [{ _id: employeeId }, { userId: employeeId }],
      isDeleted: { $ne: true }
    });

    if (!member) {
      const user = await User.findById(employeeId);
      if (user) {
        member = {
          _id: user._id,
          userId: user._id,
          fullName: user.fullName,
          phone: user.phoneNumber,
          email: user.email
        };
      }
    }

    if (!member) {
      throw ApiError.notFound('Onboarding team employee not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    // 1. Create CashSubmission document
    const submission = new CashSubmission({
      onboardingTeamId: member._id,
      employeeId: member.userId || member._id,
      employeeName: member.fullName || 'Onboarding Executive',
      date,
      amountSubmitted: amount,
      paymentMode,
      receiptNumber,
      receiptUrl,
      remarks,
      bankIds: requestedBankIds,
      status: 'VERIFIED',
      verifiedBy: submitterId,
      verifiedAt: new Date(),
      createdBy: submitterId
    });

    await submission.save();

    // 2. Perform Settlement on Bank Collection Records
    const settledBanks = [];

    if (requestedBankIds.length > 0) {
      // Settle specifically requested banks
      const targetBanks = await Bank.find({
        _id: { $in: requestedBankIds },
        isDeleted: { $ne: true }
      });

      let remainingToSettle = amount;

      for (const targetBank of targetBanks) {
        const pendingOnBank = targetBank.cashPendingAmount !== undefined ? targetBank.cashPendingAmount : (targetBank.cashSettledStatus === 'SETTLED' ? 0 : targetBank.totalAmountPaid);
        const allocate = Math.min(pendingOnBank, remainingToSettle);

        targetBank.cashSettledAmount = (targetBank.cashSettledAmount || 0) + allocate;
        targetBank.cashPendingAmount = Math.max(0, (targetBank.totalAmountPaid || 0) - targetBank.cashSettledAmount);
        targetBank.cashSettledStatus = targetBank.cashPendingAmount === 0 ? 'SETTLED' : 'PARTIALLY_SETTLED';

        if (!targetBank.cashSettlementHistory) {
          targetBank.cashSettlementHistory = [];
        }
        targetBank.cashSettlementHistory.push({
          submissionId: submission._id,
          amount: allocate,
          date,
          settledBy: submitterId,
          remarks,
          receiptNumber
        });

        await targetBank.save();
        remainingToSettle -= allocate;

        settledBanks.push({
          bankId: targetBank._id,
          bankName: targetBank.name,
          amountSettled: allocate,
          newStatus: targetBank.cashSettledStatus
        });
      }
    } else {
      // Auto-settle outstanding unsettled banks in FIFO order
      const matchConditions = [{ cashCollectedByTeamId: member._id }];
      if (member.userId) {
        matchConditions.push({ cashCollectedBy: member.userId });
        matchConditions.push({ createdBy: member.userId, paymentMethod: 'CASH', paymentStatus: 'SUCCESS' });
      }

      const unsettledBanks = await Bank.find({
        $or: matchConditions,
        paymentMethod: 'CASH',
        paymentStatus: 'SUCCESS',
        cashSettledStatus: { $in: ['UNSETTLED', 'PARTIALLY_SETTLED', null] },
        isDeleted: { $ne: true }
      }).sort({ cashCollectedAt: 1, createdAt: 1 });

      let remainingToSettle = amount;

      for (const b of unsettledBanks) {
        if (remainingToSettle <= 0) break;

        const pendingOnBank = b.cashPendingAmount !== undefined && b.cashPendingAmount > 0 ? b.cashPendingAmount : (b.cashSettledStatus === 'SETTLED' ? 0 : (b.totalAmountPaid || 0));
        if (pendingOnBank <= 0) continue;

        const allocate = Math.min(pendingOnBank, remainingToSettle);
        b.cashSettledAmount = (b.cashSettledAmount || 0) + allocate;
        b.cashPendingAmount = Math.max(0, (b.totalAmountPaid || 0) - b.cashSettledAmount);
        b.cashSettledStatus = b.cashPendingAmount === 0 ? 'SETTLED' : 'PARTIALLY_SETTLED';

        if (!b.cashSettlementHistory) {
          b.cashSettlementHistory = [];
        }
        b.cashSettlementHistory.push({
          submissionId: submission._id,
          amount: allocate,
          date,
          settledBy: submitterId,
          remarks,
          receiptNumber
        });

        await b.save();
        remainingToSettle -= allocate;

        settledBanks.push({
          bankId: b._id,
          bankName: b.name,
          amountSettled: allocate,
          newStatus: b.cashSettledStatus
        });

        if (!submission.bankIds.includes(b._id)) {
          submission.bankIds.push(b._id);
        }
      }

      await submission.save();
    }

    // 3. Fetch fresh balance
    const { totalCashCollection, totalCashSubmitted, totalCashPending } =
      await this.getMemberCashAggregates(member);

    logger.info(`CASH PAYMENT: Submitted ₹${amount} for executive [${member.fullName}], remaining pending: ₹${totalCashPending}`);

    return {
      submissionId: submission._id,
      employeeId: member._id,
      employeeName: member.fullName,
      amountSubmitted: submission.amountSubmitted,
      formattedAmountSubmitted: this.formatCurrency(submission.amountSubmitted),
      paymentMode: submission.paymentMode,
      receiptNumber: submission.receiptNumber,
      date: this.formatDateSlash(submission.date),
      remarks: submission.remarks,
      settledBanks,
      summary: {
        totalCashCollected: totalCashCollection,
        totalCashSubmitted,
        totalCashPending
      },
      message: 'Cash submitted and bank settlement status updated successfully.'
    };
  }
}

export const cashPaymentService = new CashPaymentService();
