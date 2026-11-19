import mongoose from 'mongoose';
import { SocietyReceipt } from './receipt.model.js';
import { Branch } from '../../../../models/branch.model.js';
import { ApiError } from '../../../../common/api.error.js';
import { storageManager } from '../../../../storage/storage.manager.js';
import {
  RECEIPT_PREFIX_BY_TYPE,
  RECEIPT_EDITABLE_FIELDS,
  escapeSearchText,
  nextReceiptNumber,
  formatReceipt,
  formatCurrency,
  receiptsToCsv
} from './receipt.logic.js';
import { dailyWorkReportAutomationService } from '../../employees/services/daily-work-report-automation.service.js';
import { logger } from '../../../../utils/logger.util.js';

const toObjectId = (val) => {
  if (!val) return val;
  if (val instanceof mongoose.Types.ObjectId) return val;
  if (typeof val === 'string' && mongoose.Types.ObjectId.isValid(val) && /^[0-9a-fA-F]{24}$/.test(val)) {
    return new mongoose.Types.ObjectId(val);
  }
  return val;
};

export class SocietyReceiptService {
  constructor(receiptType) {
    this.receiptType = receiptType;
    this.prefix = RECEIPT_PREFIX_BY_TYPE[receiptType];
  }

  buildScope(context, includeBranch = true, queryBranchId = null) {
    if (!context?.bankId) {
      throw ApiError.forbidden('A valid society bank context is required.');
    }

    const scope = { bankId: toObjectId(context.bankId), receiptType: this.receiptType };

    // Bank Owner and Bank Receipt Manager (RECEIPT_MANAGER) operate bank-wide across all branches unless queryBranchId is explicitly passed
    const roleUpper = String(context?.role || '').toUpperCase();
    const isBankWide = Boolean(
      context?.isBankOwner ||
      context?.isBankWideReceiptManager ||
      roleUpper === 'RECEIPT_MANAGER' ||
      roleUpper === 'BANK_RECEIPT_MANAGER'
    );

    const targetBranchId = isBankWide ? (queryBranchId || null) : (context.branchId || queryBranchId || null);
    if (includeBranch && targetBranchId) scope.branchId = toObjectId(targetBranchId);
    return scope;
  }

  format(receipt, srNo = null) {
    return formatReceipt(receipt, srNo);
  }

  async generateReceiptNumber(bankId) {
    const latest = await SocietyReceipt.findOne({
      includeDeleted: true,
      bankId,
      receiptType: this.receiptType,
      receiptNo: new RegExp(`^${this.prefix}-\\d{6}$`)
    })
      .sort({ receiptNo: -1 })
      .select('receiptNo')
      .lean();

    return nextReceiptNumber(this.receiptType, latest?.receiptNo || null);
  }

  async buildQueryFilter(context, query = {}) {
    const filter = this.buildScope(context, true, query.branchId);

    if (query.status) {
      filter.status = query.status;
    }

    // Date Range Filter (supports dateFrom/dateTo or startDate/endDate)
    const dateFrom = query.dateFrom || query.startDate;
    const dateTo = query.dateTo || query.endDate;
    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setUTCHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    if (query.city || query.state) {
      const branchCond = { bankId: toObjectId(context.bankId), isDeleted: { $ne: true } };
      if (query.state) {
        const sRegex = new RegExp(escapeSearchText(query.state), 'i');
        branchCond.$or = [{ state: sRegex }, { 'address.state': sRegex }];
      }
      if (query.city) {
        const cRegex = new RegExp(escapeSearchText(query.city), 'i');
        const cConditions = [{ city: cRegex }, { 'address.city': cRegex }];
        if (branchCond.$or) {
          branchCond.$and = [{ $or: branchCond.$or }, { $or: cConditions }];
          delete branchCond.$or;
        } else {
          branchCond.$or = cConditions;
        }
      }

      const matchingBranches = await Branch.find(branchCond).select('_id').lean();
      const branchIds = matchingBranches.map((b) => b._id);

      if (filter.branchId) {
        if (!branchIds.some(id => id.toString() === filter.branchId.toString())) {
          filter.branchId = null; // Forces 0 results if specific branch doesn't match city/state
        }
      } else {
        filter.branchId = { $in: branchIds };
      }
    }

    if (query.search) {
      const search = new RegExp(escapeSearchText(query.search), 'i');

      const searchBranches = await Branch.find({
        bankId: toObjectId(context.bankId),
        isDeleted: { $ne: true },
        name: search
      }).select('_id').lean();
      const searchBranchIds = searchBranches.map((b) => b._id);

      const searchConditions = [
        { receiptNo: search },
        { name: search },
        { glHead: search },
        { glHeadName: search },
        { accountNumber: search }
      ];

      if (searchBranchIds.length > 0) {
        searchConditions.push({ branchId: { $in: searchBranchIds } });
      }

      filter.$or = searchConditions;
    }

    return filter;
  }

  async list(context, query = {}) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;
    const filter = await this.buildQueryFilter(context, query);

    const baseFilter = { ...filter };
    delete baseFilter.status;

    if (baseFilter.bankId) baseFilter.bankId = toObjectId(baseFilter.bankId);
    if (baseFilter.branchId && typeof baseFilter.branchId === 'string') {
      baseFilter.branchId = toObjectId(baseFilter.branchId);
    }

    const statsAgg = await SocietyReceipt.aggregate([
      { $match: baseFilter },
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
    let pendingCount = 0;
    let pendingAmount = 0;
    let approvedCount = 0;
    let approvedAmount = 0;
    let rejectedCount = 0;
    let rejectedAmount = 0;

    statsAgg.forEach((group) => {
      const count = group.count || 0;
      const amount = group.totalAmount || 0;

      totalCount += count;
      totalAmount += amount;

      const st = (group._id || 'NEW').toUpperCase();
      if (st === 'NEW' || st === 'PENDING') {
        pendingCount += count;
        pendingAmount += amount;
      } else if (st === 'APPROVED') {
        approvedCount += count;
        approvedAmount += amount;
      } else if (st === 'REJECTED') {
        rejectedCount += count;
        rejectedAmount += amount;
      }
    });

    const stats = {
      totalReceipts: totalCount,
      totalAmount,
      formattedTotalAmount: formatCurrency(totalAmount),

      pendingReceipts: pendingCount,
      pendingAmount,
      formattedPendingAmount: formatCurrency(pendingAmount),

      approvedReceipts: approvedCount,
      approvedAmount,
      formattedApprovedAmount: formatCurrency(approvedAmount),

      rejectedReceipts: rejectedCount,
      rejectedAmount,
      formattedRejectedAmount: formatCurrency(rejectedAmount)
    };

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const [records, totalRecords] = await Promise.all([
      SocietyReceipt.find(filter)
        .populate('branchId', 'name code state address')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      SocietyReceipt.countDocuments(filter)
    ]);
    const totalPages = Math.max(1, Math.ceil(totalRecords / limit));

    return {
      stats,
      items: records.map((record, index) => this.format(record, skip + index + 1)),
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



  async create(context, payload, userId, file = null) {
    const scope = this.buildScope(context, false);

    let image = payload.image || null;
    let imageKey = null;

    if (file) {
      const uploadRes = await storageManager.uploadFile(file, 'society/receipts');
      if (uploadRes) {
        image = uploadRes.fileUrl;
        imageKey = uploadRes.key;
      }
    }

    const targetBranchId = context.branchId || payload.branchId || null;

    // Business Rule: ONLY Bank Owner & Bank Receipt Manager receipts auto-approve ('APPROVED').
    // Receipts created by Branch Managers, Executives, or other staff go to Pending ('PENDING').
    const roleUpper = String(context?.role || '').toUpperCase();
    const isAutoApproved = Boolean(
      context?.isBankOwner ||
      context?.isBankWideReceiptManager ||
      ['BANK_OWNER', 'SOCIETY_ADMIN', 'SUPER_ADMIN', 'RECEIPT_MANAGER', 'BANK_RECEIPT_MANAGER'].includes(roleUpper)
    );

    const initialStatus = payload.status
      ? (isAutoApproved ? payload.status : 'PENDING')
      : (isAutoApproved ? 'APPROVED' : 'PENDING');

    const receipt = await SocietyReceipt.create({
      ...scope,
      branchId: targetBranchId,
      receiptNo: await this.generateReceiptNumber(context.bankId),
      name: payload.name,
      glHead: payload.glHead,
      glHeadName: payload.glHeadName,
      accountNumber: payload.accountNumber,
      amount: payload.amount !== undefined ? Number(payload.amount) : 0,
      date: payload.date,
      status: initialStatus,

      image,
      imageKey,
      createdBy: userId
    });

    const createdReceipt = await SocietyReceipt.findById(receipt._id)
      .populate('branchId', 'name code state city address')
      .lean();

    if (initialStatus === 'APPROVED' && userId) {
      dailyWorkReportAutomationService.recordWorkReport({
        bankId: context.bankId,
        branchId: targetBranchId,
        employeeId: userId,
        date: payload.date || new Date(),
        product: payload.glHeadName || payload.glHead || this.receiptType || 'Receipt Collection',
        amount: payload.amount !== undefined ? Number(payload.amount) : 0,
        sourceModule: 'RECEIPT',
        referenceId: receipt._id,
        createdBy: userId
      }).catch((err) => logger.error(`Auto work report error for receipt ${receipt._id}: ${err.message}`));
    }

    return this.format(createdReceipt);
  }

  async getById(context, id) {
    const receipt = await SocietyReceipt.findOne({ _id: id, ...this.buildScope(context) })
      .populate('branchId', 'name code state city address')
      .lean();
    if (!receipt) throw ApiError.notFound('Receipt not found.');
    return this.format(receipt);
  }

  async update(context, id, payload, userId, file = null) {
    const receipt = await SocietyReceipt.findOne({ _id: id, ...this.buildScope(context) });
    if (!receipt) throw ApiError.notFound('Receipt not found.');

    if (payload.status !== undefined) {
      throw ApiError.badRequest(
        'Receipt status cannot be changed via the update endpoint. Please use the dedicated approve (/approve) or reject (/reject) endpoints.'
      );
    }

    for (const field of RECEIPT_EDITABLE_FIELDS) {
      if (payload[field] !== undefined) receipt[field] = payload[field];
    }

    if (!context.branchId && payload.branchId !== undefined) {
      receipt.branchId = payload.branchId || null;
    }

    if (file) {
      if (receipt.imageKey) {
        try {
          await storageManager.deleteFile(receipt.imageKey);
        } catch (err) {
          // ignore delete errors if key no longer exists on S3
        }
      }
      const uploadRes = await storageManager.uploadFile(file, 'society/receipts');
      if (uploadRes) {
        receipt.image = uploadRes.fileUrl;
        receipt.imageKey = uploadRes.key;
      }
    } else if (payload.image !== undefined) {
      receipt.image = payload.image || null;
    }

    // Business Rule: Updating a receipt automatically resets its status to PENDING for re-approval
    receipt.status = 'PENDING';
    receipt.rejectionReason = null;
    receipt.updatedBy = userId;

    await receipt.save();

    const updatedReceipt = await SocietyReceipt.findById(receipt._id)
      .populate('branchId', 'name code state city address')
      .lean();

    return this.format(updatedReceipt);
  }


  // ======================================
  // Approval Authorization Check Helper
  // ======================================
  checkApprovalAuthorization(context) {
    const roleUpper = String(context?.role || '').toUpperCase();
    const hasApprovePerm = Array.isArray(context?.permissions) && (
      context.permissions.includes('receipt.approve') || context.permissions.includes('*:*')
    );
    const canApproveOrReject = Boolean(
      context?.isBankOwner ||
      context?.isBankWideReceiptManager ||
      ['BANK_OWNER', 'SOCIETY_ADMIN', 'SUPER_ADMIN', 'RECEIPT_MANAGER', 'BANK_RECEIPT_MANAGER'].includes(roleUpper) ||
      hasApprovePerm
    );

    if (!canApproveOrReject) {
      throw ApiError.forbidden(
        'Access denied. Only Bank Owner or Bank Receipt Manager can approve or reject receipts.'
      );
    }
  }

  // ======================================
  // Approve Receipt Endpoint
  // ======================================
  async approve(context, id, userId) {
    this.checkApprovalAuthorization(context);

    const receipt = await SocietyReceipt.findOne({ _id: id, ...this.buildScope(context) });
    if (!receipt) throw ApiError.notFound('Receipt not found.');

    receipt.status = 'APPROVED';
    receipt.rejectionReason = null;
    receipt.approvedBy = userId;
    receipt.approvedAt = new Date();
    receipt.updatedBy = userId;

    await receipt.save();

    const updatedReceipt = await SocietyReceipt.findById(receipt._id)
      .populate('branchId', 'name code state city address')
      .lean();

    if (userId) {
      dailyWorkReportAutomationService.recordWorkReport({
        bankId: context.bankId,
        branchId: receipt.branchId,
        employeeId: receipt.createdBy || userId,
        date: receipt.date || new Date(),
        product: receipt.glHeadName || receipt.glHead || receipt.receiptType || 'Receipt Collection',
        amount: receipt.amount,
        sourceModule: 'RECEIPT',
        referenceId: receipt._id,
        createdBy: userId
      }).catch((err) => logger.error(`Auto work report error for approved receipt ${receipt._id}: ${err.message}`));
    }

    return this.format(updatedReceipt);
  }

  // ======================================
  // Reject Receipt Endpoint (With Rejection Reason)
  // ======================================
  async reject(context, id, payload, userId) {
    this.checkApprovalAuthorization(context);

    const reason = payload?.rejectionReason || payload?.reason || payload?.remarks;
    if (!reason || !String(reason).trim()) {
      throw ApiError.badRequest('Rejection reason is required when rejecting a receipt.');
    }

    const receipt = await SocietyReceipt.findOne({ _id: id, ...this.buildScope(context) });
    if (!receipt) throw ApiError.notFound('Receipt not found.');

    receipt.status = 'REJECTED';
    receipt.rejectionReason = String(reason).trim();
    receipt.rejectedBy = userId;
    receipt.rejectedAt = new Date();
    receipt.updatedBy = userId;

    await receipt.save();

    const updatedReceipt = await SocietyReceipt.findById(receipt._id)
      .populate('branchId', 'name code state city address')
      .lean();

    return this.format(updatedReceipt);
  }



  async remove(context, id, userId) {
    const receipt = await SocietyReceipt.findOne({ _id: id, ...this.buildScope(context) });
    if (!receipt) throw ApiError.notFound('Receipt not found.');

    if (receipt.imageKey) {
      try {
        await storageManager.deleteFile(receipt.imageKey);
      } catch (err) {
        // ignore delete errors if key no longer exists on S3
      }
    }

    receipt.isDeleted = true;
    receipt.deletedAt = new Date();
    receipt.deletedBy = userId;
    await receipt.save();
    return { id: receipt._id };
  }

  async exportCsv(context, query = {}) {
    const filter = await this.buildQueryFilter(context, query);
    const records = await SocietyReceipt.find(filter)
      .populate('branchId', 'name code state address')
      .sort({ createdAt: -1 })
      .lean();
    return receiptsToCsv(records);
  }

  async getLocations(context) {
    if (!context?.bankId) {
      throw ApiError.forbidden('A valid society bank context is required.');
    }

    const branches = await Branch.find({
      bankId: context.bankId,
      isDeleted: { $ne: true }
    })
      .select('state city address.city address.state')
      .lean();

    const citiesSet = new Set();
    const statesSet = new Set();
    const stateCitiesMap = {};

    branches.forEach((b) => {
      const city = b.address?.city || b.city;
      const state = b.address?.state || b.state;
      if (city && String(city).trim()) {
        const formattedCity = String(city).trim();
        citiesSet.add(formattedCity);
      }
      if (state && String(state).trim()) {
        const formattedState = String(state).trim();
        statesSet.add(formattedState);
      }
      if (state && city && String(state).trim() && String(city).trim()) {
        const s = String(state).trim();
        const c = String(city).trim();
        if (!stateCitiesMap[s]) stateCitiesMap[s] = new Set();
        stateCitiesMap[s].add(c);
      }
    });

    const formattedMap = {};
    Object.keys(stateCitiesMap).forEach((s) => {
      formattedMap[s] = Array.from(stateCitiesMap[s]).sort();
    });

    return {
      states: Array.from(statesSet).sort(),
      cities: Array.from(citiesSet).sort(),
      stateCitiesMap: formattedMap
    };
  }
}
