import { MerchantProfile } from '../../../../models/merchant-profile.model.js';
import { PigmyCustomer } from '../../../../models/pigmy-customer.model.js';
import { Loan } from '../../../../models/loan.model.js';
import { User } from '../../../../models/user.model.js';
import { CustomerProfile } from '../../../../models/customer-profile.model.js';
import '../../../../models/bank.model.js';
import '../../../../models/branch.model.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';

export class CustomerMerchantService {
  /**
   * Helper to resolve candidate customer IDs / phone
   */
  async getCandidateCustomerIds(customerId) {
    const user = await User.findById(customerId).lean();
    const cleanPhone = String(user?.phoneNumber || '').replace(/\D/g, '').slice(-10);

    const profile = await CustomerProfile.findOne({
      $or: [
        { userId: customerId },
        ...(user?.profileId ? [{ _id: user.profileId }] : []),
        ...(cleanPhone ? [{ phoneNumber: cleanPhone }] : [])
      ]
    }).lean();

    const candidateIds = [
      customerId,
      ...(user?._id ? [user._id] : []),
      ...(profile?._id ? [profile._id] : []),
      ...(profile?.userId ? [profile.userId] : [])
    ];

    return {
      candidateIds,
      cleanPhone: cleanPhone || String(profile?.phoneNumber || '').replace(/\D/g, '').slice(-10)
    };
  }

  /**
   * Get merchant profile(s) for logged-in customer showing where all they are registered as a merchant
   */
  async getMerchantProfile(customerId) {
    const { candidateIds, cleanPhone } = await this.getCandidateCustomerIds(customerId);

    const merchants = await MerchantProfile.find({
      $or: [
        { userId: { $in: candidateIds } },
        ...(cleanPhone ? [{ phoneNumber: cleanPhone }, { primaryPhoneNumber: cleanPhone }] : [])
      ],
      isDeleted: { $ne: true }
    })
      .populate({ path: 'bankId', select: 'name code bankName logo', strictPopulate: false })
      .populate({ path: 'branchId', select: 'name branchName code ifsc', strictPopulate: false })
      .sort({ createdAt: -1 })
      .lean();

    if (!merchants || merchants.length === 0) {
      return {
        isMerchant: false,
        totalShopsCount: 0,
        shops: [],
        merchant: null,
        message: 'Customer is not registered as a merchant.'
      };
    }

    const formattedShops = merchants.map(merchant => ({
      id: merchant._id,
      _id: merchant._id,
      merchantCode: merchant.merchantCode || merchant.code || null,
      shopName: merchant.shopName,
      ownerName: merchant.ownerName || merchant.fullName || null,
      phoneNumber: merchant.phoneNumber || merchant.primaryPhoneNumber,
      email: merchant.email || null,
      businessCategory: merchant.businessCategory || null,
      businessProofType: merchant.businessProofType || null,
      businessProofNumber: merchant.businessProofNumber || null,
      gstinNumber: merchant.gstinNumber || null,
      address: merchant.address || merchant.shopAddress || null,
      shopAddress: merchant.shopAddress || merchant.address || null,
      pincode: merchant.pincode || null,
      bankId: merchant.bankId?._id || merchant.bankId || null,
      bankName: merchant.bankId?.name || merchant.bankId?.bankName || 'Bank',
      branchId: merchant.branchId?._id || merchant.branchId || null,
      branchName: merchant.branchId?.name || merchant.branchId?.branchName || 'Branch',
      status: merchant.status || 'ACTIVE',
      approvalStatus: merchant.approvalStatus || 'APPROVED',
      qrCodeUrl: merchant.qrCodeUrl || null,
      upiId: merchant.upiId || null,
      createdAt: merchant.createdAt
    }));

    return {
      isMerchant: true,
      totalShopsCount: formattedShops.length,
      shops: formattedShops,
      merchant: formattedShops[0]
    };
  }

  /**
   * Get single merchant shop details by shopId
   */
  async getShopDetails(customerId, shopId) {
    const { candidateIds, cleanPhone } = await this.getCandidateCustomerIds(customerId);

    const merchant = await MerchantProfile.findOne({
      _id: shopId,
      $or: [
        { userId: { $in: candidateIds } },
        ...(cleanPhone ? [{ phoneNumber: cleanPhone }, { primaryPhoneNumber: cleanPhone }] : [])
      ],
      isDeleted: { $ne: true }
    })
      .populate({ path: 'bankId', select: 'name code bankName logo', strictPopulate: false })
      .populate({ path: 'branchId', select: 'name branchName code ifsc', strictPopulate: false })
      .lean();

    if (!merchant) {
      throw ApiError.notFound('Merchant shop profile not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    return {
      id: merchant._id,
      _id: merchant._id,
      merchantCode: merchant.merchantCode || merchant.code || null,
      shopName: merchant.shopName,
      ownerName: merchant.ownerName || merchant.fullName || null,
      phoneNumber: merchant.phoneNumber || merchant.primaryPhoneNumber,
      email: merchant.email || null,
      businessCategory: merchant.businessCategory || null,
      businessProofType: merchant.businessProofType || null,
      businessProofNumber: merchant.businessProofNumber || null,
      gstinNumber: merchant.gstinNumber || null,
      address: merchant.address || merchant.shopAddress || null,
      shopAddress: merchant.shopAddress || merchant.address || null,
      pincode: merchant.pincode || null,
      bankId: merchant.bankId?._id || merchant.bankId || null,
      bankName: merchant.bankId?.name || merchant.bankId?.bankName || 'Bank',
      branchId: merchant.branchId?._id || merchant.branchId || null,
      branchName: merchant.branchId?.name || merchant.branchId?.branchName || 'Branch',
      status: merchant.status || 'ACTIVE',
      approvalStatus: merchant.approvalStatus || 'APPROVED',
      qrCodeUrl: merchant.qrCodeUrl || null,
      upiId: merchant.upiId || null,
      createdAt: merchant.createdAt
    };
  }

  /**
   * Get merchant summary (merchant pigmy accounts, merchant loans)
   */
  async getMerchantSummary(customerId) {
    const { candidateIds, cleanPhone } = await this.getCandidateCustomerIds(customerId);

    const merchants = await MerchantProfile.find({
      $or: [
        { userId: { $in: candidateIds } },
        ...(cleanPhone ? [{ phoneNumber: cleanPhone }, { primaryPhoneNumber: cleanPhone }] : [])
      ],
      isDeleted: { $ne: true }
    })
      .populate({ path: 'bankId', select: 'name code bankName', strictPopulate: false })
      .populate({ path: 'branchId', select: 'name branchName code', strictPopulate: false })
      .lean();

    if (!merchants || merchants.length === 0) {
      return {
        isMerchant: false,
        totalShopsCount: 0,
        shops: [],
        summary: null,
        message: 'Customer is not registered as a merchant.'
      };
    }

    const merchantIds = merchants.map(m => m._id);
    const shopNames = merchants.map(m => m.shopName).filter(Boolean);

    // 1. Fetch merchant pigmy accounts
    const pigmyAccounts = await PigmyCustomer.find({
      $or: [
        { userId: { $in: candidateIds } },
        ...(cleanPhone ? [{ phoneNumber: cleanPhone }, { primaryPhoneNumber: cleanPhone }] : []),
        { shopName: { $in: shopNames } }
      ],
      customerType: 'MERCHANT',
      isDeleted: { $ne: true }
    })
      .populate({ path: 'bankId', select: 'name code bankName', strictPopulate: false })
      .populate({ path: 'branchId', select: 'name branchName code', strictPopulate: false })
      .sort({ createdAt: -1 })
      .lean();

    // 2. Fetch merchant loans
    const loans = await Loan.find({
      $or: [
        { merchantId: { $in: merchantIds } },
        { customerId: { $in: candidateIds } }
      ],
      isDeleted: { $ne: true }
    })
      .populate({ path: 'assignedBankId', select: 'name code bankName', strictPopulate: false })
      .populate({ path: 'branchId', select: 'name branchName code', strictPopulate: false })
      .sort({ createdAt: -1 })
      .lean();

    const activePigmy = pigmyAccounts.filter(p => p.status === 'ACTIVE');
    const totalPigmyDailyDeposit = activePigmy.reduce((sum, p) => sum + (p.dailyDepositAmount || 0), 0);

    return {
      isMerchant: true,
      totalShopsCount: merchants.length,
      shops: merchants.map(m => ({
        id: m._id,
        shopName: m.shopName,
        merchantCode: m.merchantCode || m.code || null,
        bankName: m.bankId?.name || m.bankId?.bankName || 'Bank',
        branchName: m.branchId?.name || m.branchId?.branchName || 'Branch'
      })),
      summary: {
        shopsCount: merchants.length,
        pigmyAccountsCount: pigmyAccounts.length,
        activePigmyAccountsCount: activePigmy.length,
        totalPigmyDailyDeposit,
        loansCount: loans.length
      },
      merchantPigmyAccounts: pigmyAccounts.map(p => ({
        id: p._id,
        accountNumber: p.accountNumber,
        shopName: p.shopName || null,
        bankName: p.bankName || p.bankId?.name || 'Bank',
        branchName: p.branchName || p.branchId?.name || 'Branch',
        dailyDepositAmount: p.dailyDepositAmount,
        tenureMonths: p.tenureMonths,
        status: p.status
      })),
      merchantLoans: loans.map(l => ({
        id: l._id,
        applicationId: l.applicationId,
        bankName: l.assignedBankId?.name || 'Bank',
        totalAmount: l.totalAmount,
        outstandingAmount: l.outstandingAmount,
        status: l.status
      }))
    };
  }
}

export const customerMerchantService = new CustomerMerchantService();
