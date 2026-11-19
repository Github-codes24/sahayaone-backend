import { PigmyCustomer } from '../../../../models/pigmy-customer.model.js';
import { User } from '../../../../models/user.model.js';
import { CustomerProfile } from '../../../../models/customer-profile.model.js';
import '../../../../models/bank.model.js';
import '../../../../models/branch.model.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';

export class CustomerPigmyService {
  /**
   * Helper to resolve user, profile and phone numbers for customer
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
   * List all pigmy accounts for the customer across all banks
   * Supports individual and merchant pigmy accounts
   */
  async getPigmyAccounts(customerId, filters = {}) {
    const { candidateIds, cleanPhone } = await this.getCandidateCustomerIds(customerId);

    const query = {
      $or: [
        { userId: { $in: candidateIds } },
        ...(cleanPhone ? [{ phoneNumber: cleanPhone }, { primaryPhoneNumber: cleanPhone }] : [])
      ],
      isDeleted: { $ne: true }
    };

    if (filters.bankId) {
      query.bankId = filters.bankId;
    }
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.customerType) {
      query.customerType = filters.customerType; // 'INDIVIDUAL' or 'MERCHANT'
    }

    const accounts = await PigmyCustomer.find(query)
      .populate({ path: 'bankId', select: 'name code bankName logo', strictPopulate: false })
      .populate({ path: 'branchId', select: 'name branchName code ifsc', strictPopulate: false })
      .sort({ createdAt: -1 })
      .lean();

    const activeAccounts = accounts.filter(a => a.status === 'ACTIVE' || a.approvalStatus === 'APPROVED');
    const totalDailyDeposit = activeAccounts.reduce((sum, a) => sum + (a.dailyDepositAmount || 0), 0);
    const totalMaturityAmount = accounts.reduce((sum, a) => sum + (a.maturityAmount || 0), 0);
    const individualAccounts = accounts.filter(a => a.customerType !== 'MERCHANT');
    const merchantAccounts = accounts.filter(a => a.customerType === 'MERCHANT');

    const formattedAccounts = accounts.map(acc => {
      const bankName = acc.bankName || acc.bankId?.name || acc.bankId?.bankName || 'Bank';
      const branchName = acc.branchName || acc.branchId?.name || acc.branchId?.branchName || 'Branch';

      return {
        id: acc._id,
        _id: acc._id,
        accountNumber: acc.accountNumber || null,
        pigmyCustomerCode: acc.pigmyCustomerCode || acc.code || null,
        fullName: acc.fullName,
        customerType: acc.customerType || 'INDIVIDUAL',
        isMerchant: acc.customerType === 'MERCHANT' || !!acc.isMerchant,
        shopName: acc.shopName || null,
        bankId: acc.bankId?._id || acc.bankId || null,
        bankName,
        branchId: acc.branchId?._id || acc.branchId || null,
        branchName,
        dailyDepositAmount: acc.dailyDepositAmount || 0,
        depositFrequency: acc.depositFrequency || 'DAILY',
        tenureMonths: acc.tenureMonths || 12,
        interestRate: acc.interestRate || 0,
        maturityAmount: acc.maturityAmount || 0,
        startDate: acc.startDate || null,
        endDate: acc.endDate || null,
        status: acc.status || 'INACTIVE',
        approvalStatus: acc.approvalStatus || 'PENDING_BRANCH_APPROVAL',
        savingsAccountOption: acc.savingsAccountOption || 'EXISTING',
        savingsAccountNumber: acc.societyAccount?.societyAccountNumber || acc.existingSavingsAccountNumber || null,
        mandateStatus: acc.mandateDetails?.mandateStatus || 'PENDING_SETUP',
        createdAt: acc.createdAt
      };
    });

    return {
      summary: {
        totalAccountsCount: accounts.length,
        activeAccountsCount: activeAccounts.length,
        totalDailyDeposit,
        totalMaturityAmount,
        individualAccountsCount: individualAccounts.length,
        merchantAccountsCount: merchantAccounts.length
      },
      accounts: formattedAccounts
    };
  }

  /**
   * Get single pigmy account details
   */
  async getPigmyAccountDetails(customerId, accountId) {
    const { candidateIds, cleanPhone } = await this.getCandidateCustomerIds(customerId);

    const account = await PigmyCustomer.findOne({
      _id: accountId,
      $or: [
        { userId: { $in: candidateIds } },
        ...(cleanPhone ? [{ phoneNumber: cleanPhone }, { primaryPhoneNumber: cleanPhone }] : [])
      ],
      isDeleted: { $ne: true }
    })
      .populate({ path: 'bankId', strictPopulate: false })
      .populate({ path: 'branchId', strictPopulate: false })
      .lean();

    if (!account) {
      throw ApiError.notFound('Pigmy account record not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const bankName = account.bankName || account.bankId?.name || account.bankId?.bankName || 'Bank';
    const branchName = account.branchName || account.branchId?.name || account.branchId?.branchName || 'Branch';

    return {
      id: account._id,
      _id: account._id,
      accountNumber: account.accountNumber || null,
      pigmyCustomerCode: account.pigmyCustomerCode || account.code || null,
      fullName: account.fullName,
      ownerName: account.ownerName || null,
      customerType: account.customerType || 'INDIVIDUAL',
      isMerchant: account.customerType === 'MERCHANT' || !!account.isMerchant,
      shopName: account.shopName || null,
      shopAddress: account.shopAddress || null,
      phoneNumber: account.phoneNumber || account.primaryPhoneNumber,
      address: account.address,
      bankId: account.bankId?._id || account.bankId || null,
      bankName,
      branchId: account.branchId?._id || account.branchId || null,
      branchName,
      dailyDepositAmount: account.dailyDepositAmount || 0,
      depositFrequency: account.depositFrequency || 'DAILY',
      tenureMonths: account.tenureMonths || 12,
      interestRate: account.interestRate || 0,
      maturityAmount: account.maturityAmount || 0,
      startDate: account.startDate || null,
      endDate: account.endDate || null,
      status: account.status || 'INACTIVE',
      approvalStatus: account.approvalStatus || 'PENDING_BRANCH_APPROVAL',
      rejectionReason: account.rejectionReason || null,
      societyAccount: account.societyAccount || null,
      bankAccountDetails: account.bankAccountDetails || null,
      mandateDetails: account.mandateDetails || null,
      documents: {
        profilePhoto: account.profilePhoto || account.documents?.profilePhoto || null,
        aadhaarImage: account.aadhaarImage || account.documents?.ownerAadhaar || null,
        panImage: account.panImage || account.documents?.ownerPan || null,
        shopPhoto: account.shopPhoto || account.documents?.shopPhoto || null,
        businessProofImage: account.businessProofImage || account.documents?.businessProof || null
      },
      agreements: account.agreements || null,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt
    };
  }
}

export const customerPigmyService = new CustomerPigmyService();
