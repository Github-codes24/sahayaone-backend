import { MerchantCreditRequest } from '../../../../models/merchant-credit-request.model.js';
import { MerchantProfile } from '../../../../models/merchant-profile.model.js';
import { Bank } from '../../../../models/bank.model.js';
import { Branch } from '../../../../models/branch.model.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';
import { logger } from '../../../../utils/logger.util.js';

export class MerchantVerificationCreditsService {
  async getMerchantProfile(merchantUser) {
    const userId = merchantUser?.id || merchantUser?._id || merchantUser?.userId;
    let merchant = null;
    if (merchantUser?.merchantId) {
      merchant = await MerchantProfile.findById(merchantUser.merchantId);
    }
    if (!merchant && userId) {
      merchant = await MerchantProfile.findOne({ userId, isDeleted: { $ne: true } });
    }
    return { userId, merchant };
  }

  /**
   * Merchant requests verification credits from associated bank
   */
  async requestCredits({ creditQuantity, notes }, merchantUser) {
    const { userId, merchant } = await this.getMerchantProfile(merchantUser);

    if (!merchant) {
      throw ApiError.notFound('Merchant profile not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (!merchant.bankId) {
      throw ApiError.badRequest('Merchant is not associated with any Co-operative Bank / Society.');
    }

    const qty = parseInt(creditQuantity, 10);
    if (!qty || qty < 1) {
      throw ApiError.badRequest('Requested credit quantity must be at least 1.');
    }

    const creditRequest = await MerchantCreditRequest.create({
      merchantId: merchant._id,
      bankId: merchant.bankId,
      branchId: merchant.branchId || null,
      requestedBy: userId,
      creditQuantity: qty,
      notes: notes ? notes.trim() : null,
      status: 'PENDING'
    });

    logger.info(`MERCHANT CREDIT REQUEST: Merchant [${merchant.shopName}] requested ${qty} credits from Bank ID: ${merchant.bankId}`);

    return {
      success: true,
      requestId: creditRequest._id,
      merchantId: merchant._id,
      shopName: merchant.shopName,
      bankId: merchant.bankId,
      creditQuantity: qty,
      status: creditRequest.status,
      createdAt: creditRequest.createdAt,
      message: `Successfully submitted request for ${qty} verification credits to your associated Bank/Society.`
    };
  }

  /**
   * Get history of merchant credit requests
   */
  async getRequestHistory(merchantUser, queryParams = {}) {
    const { userId, merchant } = await this.getMerchantProfile(merchantUser);

    const page = Math.max(1, parseInt(queryParams.page || 1, 10));
    const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit || 10, 10)));
    const skip = (page - 1) * limit;

    const filter = {
      $or: [
        { requestedBy: userId },
        ...(merchant ? [{ merchantId: merchant._id }] : [])
      ]
    };

    if (queryParams.status && queryParams.status.toUpperCase() !== 'ALL') {
      filter.status = queryParams.status.toUpperCase();
    }

    if (queryParams.startDate || queryParams.endDate) {
      filter.createdAt = {};
      if (queryParams.startDate) {
        filter.createdAt.$gte = new Date(queryParams.startDate);
      }
      if (queryParams.endDate) {
        filter.createdAt.$lte = new Date(queryParams.endDate);
      }
    }

    const [items, total] = await Promise.all([
      MerchantCreditRequest.find(filter)
        .populate('bankId', 'name code logo')
        .populate('branchId', 'name code')
        .populate('approvedBy', 'fullName email')
        .populate('rejectedBy', 'fullName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MerchantCreditRequest.countDocuments(filter)
    ]);

    const formattedItems = items.map(req => ({
      id: req._id,
      requestId: req._id,
      creditQuantity: req.creditQuantity,
      notes: req.notes,
      status: req.status,
      approvedQuantity: req.approvedQuantity || 0,
      bank: req.bankId ? { id: req.bankId._id, name: req.bankId.name, code: req.bankId.code } : null,
      branch: req.branchId ? { id: req.branchId._id, name: req.branchId.name, code: req.branchId.code } : null,
      responseRemarks: req.responseRemarks || null,
      approvedAt: req.approvedAt || null,
      rejectedAt: req.rejectedAt || null,
      createdAt: req.createdAt,
      updatedAt: req.updatedAt
    }));

    return {
      success: true,
      items: formattedItems,
      requests: formattedItems,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      },
      message: 'Merchant verification credit requests retrieved successfully.'
    };
  }

  /**
   * Get Merchant / Branch Available Verification Credits Balance
   */
  async getCreditBalance(merchantUser) {
    const { userId, merchant } = await this.getMerchantProfile(merchantUser);

    if (!merchant) {
      throw ApiError.notFound('Merchant profile not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const branchId = merchant.branchId || merchantUser?.branchId || null;
    let branch = null;
    if (branchId) {
      branch = await Branch.findById(branchId).select('name code verificationCredits availableVerificationCredits totalVerificationCredits').lean();
    }

    const bankId = merchant.bankId || merchantUser?.bankId || null;
    let bank = null;
    if (bankId) {
      bank = await Bank.findById(bankId).select('name code').lean();
    }

    const availableVerificationCredits = branch
      ? (branch.availableVerificationCredits ?? branch.verificationCredits ?? 0)
      : 0;

    const totalVerificationCredits = branch
      ? (branch.totalVerificationCredits ?? branch.verificationCredits ?? 0)
      : 0;

    const usedVerificationCredits = Math.max(0, totalVerificationCredits - availableVerificationCredits);

    return {
      availableVerificationCredits,
      totalVerificationCredits,
      usedVerificationCredits,
      merchant: {
        id: merchant._id,
        shopName: merchant.shopName,
        merchantName: merchant.merchantName
      },
      branch: branch ? {
        id: branch._id,
        name: branch.name,
        code: branch.code
      } : null,
      bank: bank ? {
        id: bank._id,
        name: bank.name,
        code: bank.code
      } : null
    };
  }
}

export const merchantVerificationCreditsService = new MerchantVerificationCreditsService();
