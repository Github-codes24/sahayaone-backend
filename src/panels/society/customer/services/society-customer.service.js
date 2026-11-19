import mongoose from 'mongoose';
import { SocietyCustomerLink } from '../../../../models/society-customer-link.model.js';
import { CustomerProfile } from '../../../../models/customer-profile.model.js';
import { MerchantProfile } from '../../../../models/merchant-profile.model.js';
import { Loan } from '../../../../models/loan.model.js';
import { PigmyCustomer } from '../../../../models/pigmy-customer.model.js';
import { EmiCard } from '../../../../models/emi-card.model.js';
import { User } from '../../../../models/user.model.js';
import { SocietyEmployee } from '../../../../models/society-employee.model.js';
import { BranchManager } from '../../../../models/branch-manager.model.js';
import { ApiError } from '../../../../common/api.error.js';

class SocietyCustomerService {
  /**
   * Helper: Check if user role has bank-wide visibility across all branches
   */
  isBankWideRole(societyContext) {
    const roleUpper = (societyContext?.role || '').trim().toUpperCase();
    return (
      societyContext?.isBankOwner ||
      ['SUPER_ADMIN', 'BANK_OWNER', 'BANK_ADMIN', 'SOCIETY_ADMIN', 'OWNER', 'ADMIN', 'BANK_RECEIPT_MANAGER', 'RECEIPT_MANAGER'].includes(roleUpper)
    );
  }

  /**
   * Helper: Resolve creator details (Name, Role, Employee ID / Code, Phone)
   */
  async resolveCreatorDetails(onboardedByObj, createdByUserId, bankId) {
    let creatorId = onboardedByObj?.id || onboardedByObj?.userId || createdByUserId;
    let name = onboardedByObj?.name || 'N/A';
    let role = onboardedByObj?.role || 'EXECUTIVE';
    let phone = onboardedByObj?.phone || '';
    let employeeId = onboardedByObj?.employeeId || onboardedByObj?.employeeCode || '';

    if (creatorId && mongoose.Types.ObjectId.isValid(creatorId)) {
      try {
        const creatorUser = await User.findById(creatorId).lean();
        if (creatorUser) {
          if (!name || name === 'N/A') {
            name = creatorUser.fullName || `${creatorUser.firstName || ''} ${creatorUser.lastName || ''}`.trim() || creatorUser.name || 'N/A';
          }
          if (!role || role === 'EXECUTIVE') {
            role = creatorUser.role || 'EXECUTIVE';
          }
          if (!phone) {
            phone = creatorUser.phoneNumber || creatorUser.phone || '';
          }
          if (!employeeId) {
            employeeId = creatorUser.employeeCode || creatorUser.userCode || creatorUser.onboardingTeamCode || '';
          }
        }

        // Search SocietyEmployee for employeeCode
        if (!employeeId && bankId) {
          const emp = await SocietyEmployee.findOne({ userId: creatorId, bankId, isDeleted: { $ne: true } }).lean();
          if (emp) {
            employeeId = emp.employeeCode || emp.personalDetails?.employeeId || '';
            if (emp.fullName) name = emp.fullName;
          }
        }

        // Search BranchManager if applicable
        if (!employeeId) {
          const bm = await BranchManager.findOne({ userId: creatorId, isDeleted: { $ne: true } }).lean();
          if (bm) {
            employeeId = bm.employeeCode || bm.managerCode || '';
            if (bm.fullName) name = bm.fullName;
          }
        }
      } catch (err) {
        // Fallback to existing values on query failure
      }
    }

    return {
      id: creatorId || null,
      name,
      role,
      phone,
      employeeId: employeeId || 'EMP-N/A'
    };
  }

  /**
   * Helper: Resolve total loans for a user/customer
   */
  async resolveLoansSummary(userId, bankId, merchantProfileId = null) {
    if (!userId && !merchantProfileId) {
      return { count: 0, activeCount: 0, totalAmount: 0, outstandingAmount: 0, loansList: [] };
    }

    const loanQuery = { isDeleted: { $ne: true } };
    const orConditions = [];

    if (userId) {
      orConditions.push({ customerId: userId });
      orConditions.push({ createdBy: userId });
    }
    if (merchantProfileId) {
      orConditions.push({ merchantId: merchantProfileId });
    }
    if (orConditions.length > 0) {
      loanQuery.$or = orConditions;
    }
    if (bankId) {
      loanQuery.assignedBankId = bankId;
    }

    const loans = await Loan.find(loanQuery)
      .select('applicationId status totalLoanAmount outstandingAmount emiAmount createdAt')
      .lean();

    const count = loans.length;
    const activeLoans = loans.filter((l) => ['APPROVED', 'ACTIVE', 'PENDING_DOWN_PAYMENT', 'READY_FOR_DISBURSAL'].includes((l.status || '').toUpperCase()));
    const activeCount = activeLoans.length;
    const totalAmount = loans.reduce((sum, l) => sum + (Number(l.totalLoanAmount) || 0), 0);
    const outstandingAmount = loans.reduce((sum, l) => sum + (Number(l.outstandingAmount) || 0), 0);

    const loansList = loans.map((l) => ({
      id: l._id,
      applicationId: l.applicationId,
      status: l.status,
      totalLoanAmount: l.totalLoanAmount || 0,
      outstandingAmount: l.outstandingAmount || 0,
      emiAmount: l.emiAmount || 0,
      createdAt: l.createdAt
    }));

    return {
      count,
      activeCount,
      totalAmount,
      outstandingAmount,
      loansList
    };
  }

  /**
   * Helper: Resolve Pigmy accounts for a user/customer
   */
  async resolvePigmySummary(userId, bankId, phoneNumber = null, customerId = null) {
    if (!userId && !phoneNumber && !customerId) {
      return { count: 0, activeCount: 0, totalBalance: 0, pigmyList: [] };
    }

    const pigmyQuery = { isDeleted: { $ne: true } };
    const orConditions = [];

    if (userId) orConditions.push({ userId });
    if (customerId) orConditions.push({ customerId });
    if (phoneNumber) orConditions.push({ mobileNumber: phoneNumber });

    if (orConditions.length > 0) {
      pigmyQuery.$or = orConditions;
    }
    if (bankId) {
      pigmyQuery.bankId = bankId;
    }

    const pigmyAccounts = await PigmyCustomer.find(pigmyQuery)
      .populate('schemeId', 'schemeName schemeCode depositAmount interestRate')
      .select('pigmyAccountNumber customerName mobileNumber status currentBalance totalDepositAmount agentId createdAt schemeSnapshot schemeId')
      .lean();

    const count = pigmyAccounts.length;
    const activeAccounts = pigmyAccounts.filter((p) => (p.status || '').toUpperCase() === 'ACTIVE');
    const activeCount = activeAccounts.length;
    const totalBalance = pigmyAccounts.reduce((sum, p) => sum + (Number(p.currentBalance) || Number(p.totalDepositAmount) || 0), 0);

    const pigmyList = pigmyAccounts.map((p) => ({
      id: p._id,
      pigmyAccountNumber: p.pigmyAccountNumber || 'N/A',
      schemeName: p.schemeSnapshot?.schemeName || p.schemeId?.schemeName || 'Pigmy Deposit Scheme',
      depositAmount: p.schemeSnapshot?.depositAmount || p.schemeId?.depositAmount || 0,
      currentBalance: p.currentBalance || p.totalDepositAmount || 0,
      status: p.status,
      createdAt: p.createdAt
    }));

    return {
      count,
      activeCount,
      totalBalance,
      pigmyList
    };
  }

  /**
   * Helper: Resolve EMI Card details and expiry for a user
   */
  async resolveEmiCardDetails(userId, bankId) {
    if (!userId) {
      return null;
    }

    const emiCard = await EmiCard.findOne({
      customerId: userId,
      bankId,
      isDeleted: { $ne: true }
    }).lean();

    if (!emiCard) {
      return null;
    }

    // Process expiry date from validThru string (e.g., "12/28" or "10/2030")
    let expiryDate = null;
    if (emiCard.validThru) {
      const parts = String(emiCard.validThru).split('/');
      if (parts.length === 2) {
        const month = parseInt(parts[0], 10);
        let year = parseInt(parts[1], 10);
        if (year < 100) year += 2000;
        if (!isNaN(month) && !isNaN(year)) {
          expiryDate = new Date(year, month, 0).toISOString();
        }
      }
    }

    return {
      id: emiCard._id,
      cardNumber: emiCard.cardNumber,
      cardHolderName: emiCard.cardHolderName,
      validThru: emiCard.validThru,
      expiryDate,
      cardLimit: emiCard.cardLimit || 0,
      availableLimit: emiCard.availableLimit || 0,
      status: emiCard.status,
      allotmentStatus: emiCard.allotmentStatus
    };
  }

  /**
   * List Customers and Merchants (Unified List API with Pigmy & Loan Filtering)
   */
  async listCustomers(societyContext, queryOptions = {}) {
    const bankId = societyContext?.bankId;
    if (!bankId) {
      throw ApiError.badRequest('Bank context is missing. Cannot fetch customer list.');
    }

    const page = Math.max(1, parseInt(queryOptions.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(queryOptions.limit, 10) || 10));
    const skip = (page - 1) * limit;
    const requestedType = (queryOptions.type || 'ALL').trim().toUpperCase();
    const search = (queryOptions.search || '').trim();

    // Parse Pigmy / Loan Filter options
    const productFilter = (queryOptions.product || '').trim().toUpperCase();

    let hasPigmyFilter = null; // null: no filter, true: must have pigmy, false: must NOT have pigmy
    if (queryOptions.hasPigmy === true || queryOptions.hasPigmy === 'true' || queryOptions.hasPigmy === '1') {
      hasPigmyFilter = true;
    } else if (queryOptions.hasPigmy === false || queryOptions.hasPigmy === 'false' || queryOptions.hasPigmy === '0') {
      hasPigmyFilter = false;
    }

    let hasLoansFilter = null; // null: no filter, true: must have loans, false: must NOT have loans
    if (queryOptions.hasLoans === true || queryOptions.hasLoans === 'true' || queryOptions.hasLoans === '1') {
      hasLoansFilter = true;
    } else if (queryOptions.hasLoans === false || queryOptions.hasLoans === 'false' || queryOptions.hasLoans === '0') {
      hasLoansFilter = false;
    }

    if (productFilter === 'PIGMY') {
      hasPigmyFilter = true;
    } else if (productFilter === 'LOAN') {
      hasLoansFilter = true;
    } else if (productFilter === 'BOTH') {
      hasPigmyFilter = true;
      hasLoansFilter = true;
    } else if (productFilter === 'NONE') {
      hasPigmyFilter = false;
      hasLoansFilter = false;
    }

    const pigmyStatusReq = (queryOptions.pigmyStatus || '').trim().toUpperCase();
    const loanStatusReq = (queryOptions.loanStatus || '').trim().toUpperCase();

    // Branch scoping
    const isBankWide = this.isBankWideRole(societyContext);
    const scopedBranchId = !isBankWide && societyContext?.branchId ? societyContext.branchId : queryOptions.branchId;

    // Fetch Customers (SocietyCustomerLink)
    let customersList = [];
    if (requestedType === 'CUSTOMER' || requestedType === 'ALL') {
      const linkFilter = { bankId, isDeleted: { $ne: true } };
      if (scopedBranchId) {
        linkFilter.branchId = scopedBranchId;
      }
      if (queryOptions.dateFrom || queryOptions.startDate) {
        linkFilter.createdAt = {
          $gte: new Date(queryOptions.dateFrom || queryOptions.startDate)
        };
      }
      if (queryOptions.dateTo || queryOptions.endDate) {
        linkFilter.createdAt = linkFilter.createdAt || {};
        linkFilter.createdAt.$lte = new Date(queryOptions.dateTo || queryOptions.endDate);
      }

      let links = await SocietyCustomerLink.find(linkFilter)
        .populate('userId', 'firstName lastName fullName email phoneNumber status role')
        .populate('branchId', 'name code state address')
        .sort({ createdAt: -1 })
        .lean();

      // Fetch linked CustomerProfile for each user
      const userIds = links.map((l) => l.userId?._id || l.userId).filter(Boolean);
      const profiles = await CustomerProfile.find({ userId: { $in: userIds } }).lean();
      const profileMap = new Map(profiles.map((p) => [String(p.userId), p]));

      for (const link of links) {
        const uId = link.userId?._id || link.userId;
        const profile = profileMap.get(String(uId));
        const user = link.userId || {};

        const firstName = profile?.firstName || user.firstName || '';
        const lastName = profile?.lastName || user.lastName || '';
        const name = `${firstName} ${lastName}`.trim() || user.fullName || profile?.customerUniqueId || link.customerId || 'Customer';
        const phone = profile?.phoneNumber || user.phoneNumber || link.phoneNumber || '';
        const email = user.email || profile?.email || '';

        // Keyword Search Filter
        if (search) {
          const sLower = search.toLowerCase();
          const matches =
            name.toLowerCase().includes(sLower) ||
            phone.toLowerCase().includes(sLower) ||
            email.toLowerCase().includes(sLower) ||
            (link.societyAccountNumber || '').toLowerCase().includes(sLower) ||
            (link.customerId || '').toLowerCase().includes(sLower);
          if (!matches) continue;
        }

        customersList.push({
          rawId: link._id,
          userId: uId,
          customerId: link.customerId,
          name,
          entityType: 'CUSTOMER',
          phoneNumber: phone,
          email,
          status: link.kycStatus || user.status || 'ACTIVE',
          branchId: link.branchId?._id || link.branchId,
          branchName: link.branchId?.name || 'N/A',
          createdAt: link.createdAt || link.firstOnboardedAt,
          onboardedByRaw: link.onboardedByExecutive,
          createdByUserId: profile?.createdByExecutiveId || profile?.createdById,
          societyAccountDetails: {
            accountNumber: link.societyAccountNumber || '',
            accountHolderName: link.accountHolderName || name,
            ifscCode: link.ifscCode || '',
            bankName: link.bankBranchName || '',
            branchName: link.branchId?.name || '',
            pincode: link.pincode || ''
          }
        });
      }
    }

    // Fetch Merchants (MerchantProfile)
    let merchantsList = [];
    if (requestedType === 'MERCHANT' || requestedType === 'ALL') {
      const merchantFilter = { bankId, isDeleted: { $ne: true } };
      if (scopedBranchId) {
        merchantFilter.branchId = scopedBranchId;
      }
      if (queryOptions.dateFrom || queryOptions.startDate) {
        merchantFilter.createdAt = {
          $gte: new Date(queryOptions.dateFrom || queryOptions.startDate)
        };
      }
      if (queryOptions.dateTo || queryOptions.endDate) {
        merchantFilter.createdAt = merchantFilter.createdAt || {};
        merchantFilter.createdAt.$lte = new Date(queryOptions.dateTo || queryOptions.endDate);
      }

      let merchants = await MerchantProfile.find(merchantFilter)
        .populate('userId', 'email phoneNumber status role')
        .populate('branchId', 'name code state address')
        .sort({ createdAt: -1 })
        .lean();

      const merchantUserIds = merchants.map(m => m.userId?._id || m.userId).filter(Boolean);
      const merchantSocLinks = merchantUserIds.length > 0
        ? await SocietyCustomerLink.find({ userId: { $in: merchantUserIds }, societyAccountNumber: { $ne: null } }).lean()
        : [];
      const merchantSocMap = new Map();
      merchantSocLinks.forEach(l => merchantSocMap.set(String(l.userId), l));

      for (const m of merchants) {
        const name = m.shopName ? `${m.shopName} (${m.ownerName})` : m.ownerName || 'Merchant';
        const phone = m.phoneNumber || m.primaryPhoneNumber || '';
        const email = m.email || '';

        const mUserId = String(m.userId?._id || m.userId);
        const socLink = merchantSocMap.get(mUserId);
        const socAccNum = socLink?.societyAccountNumber || '';

        // Keyword Search Filter
        if (search) {
          const sLower = search.toLowerCase();
          const matches =
            name.toLowerCase().includes(sLower) ||
            phone.toLowerCase().includes(sLower) ||
            email.toLowerCase().includes(sLower) ||
            (m.merchantCode || '').toLowerCase().includes(sLower) ||
            (m.bankDetails?.accountNumber || '').toLowerCase().includes(sLower) ||
            socAccNum.toLowerCase().includes(sLower);
          if (!matches) continue;
        }

        const societyAccountDetails = socLink?.societyAccountNumber ? {
          accountNumber: socLink.societyAccountNumber,
          accountHolderName: socLink.accountHolderName || m.ownerName || '',
          ifscCode: socLink.ifscCode || '',
          bankName: socLink.bankBranchName || '',
          branchName: m.branchId?.name || '',
          pincode: socLink.pincode || ''
        } : null;

        merchantsList.push({
          rawId: m._id,
          userId: m.userId?._id || m.userId,
          merchantCode: m.merchantCode || m.code,
          name,
          shopName: m.shopName,
          ownerName: m.ownerName,
          entityType: 'MERCHANT',
          phoneNumber: phone,
          email,
          status: m.approvalStatus === 'APPROVED' ? 'ACTIVE' : m.approvalStatus || m.status,
          branchId: m.branchId?._id || m.branchId,
          branchName: m.branchId?.name || 'N/A',
          createdAt: m.createdAt,
          onboardedByRaw: m.onboardedBy,
          createdByUserId: m.createdBy,
          merchantProfileId: m._id,
          societyAccountDetails
        });
      }
    }

    // Combine & Sort by creation date
    const combinedList = [...customersList, ...merchantsList].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    // Concurrently enrich items with Total Loans, Total Pigmy, EMI Card, and Creator Details
    const allEnrichedItems = await Promise.all(
      combinedList.map(async (item) => {
        const [totalLoans, totalPigmy, emiCardDetails, createdBy] = await Promise.all([
          this.resolveLoansSummary(item.userId, bankId, item.merchantProfileId),
          this.resolvePigmySummary(item.userId, bankId, item.phoneNumber, item.customerId),
          this.resolveEmiCardDetails(item.userId, bankId),
          this.resolveCreatorDetails(item.onboardedByRaw, item.createdByUserId, bankId)
        ]);

        return {
          id: item.rawId,
          userId: item.userId,
          customerId: item.customerId || item.merchantCode || null,
          name: item.name,
          shopName: item.shopName || null,
          ownerName: item.ownerName || null,
          entityType: item.entityType,
          phoneNumber: item.phoneNumber,
          email: item.email,
          status: item.status,
          branchId: item.branchId,
          branchName: item.branchName,
          totalLoans: {
            count: totalLoans.count,
            activeCount: totalLoans.activeCount,
            totalAmount: totalLoans.totalAmount,
            outstandingAmount: totalLoans.outstandingAmount
          },
          totalPigmy: {
            count: totalPigmy.count,
            activeCount: totalPigmy.activeCount,
            totalBalance: totalPigmy.totalBalance
          },
          createdBy,
          createdAt: item.createdAt,
          emiCardDetails,
          societyAccountDetails: item.societyAccountDetails
        };
      })
    );

    // Apply Pigmy & Loan Filters
    const filteredItems = allEnrichedItems.filter((item) => {
      // Pigmy Filter
      if (hasPigmyFilter === true) {
        if (item.totalPigmy.count === 0) return false;
        if (pigmyStatusReq && item.totalPigmy.activeCount === 0) return false;
      } else if (hasPigmyFilter === false) {
        if (item.totalPigmy.count > 0) return false;
      }

      // Loans Filter
      if (hasLoansFilter === true) {
        if (item.totalLoans.count === 0) return false;
        if (loanStatusReq && item.totalLoans.activeCount === 0) return false;
      } else if (hasLoansFilter === false) {
        if (item.totalLoans.count > 0) return false;
      }

      return true;
    });

    const totalRecords = filteredItems.length;
    const paginatedItems = filteredItems.slice(skip, skip + limit).map((item, idx) => ({
      srNo: skip + idx + 1,
      ...item
    }));

    return {
      stats: {
        totalRecords,
        totalCustomers: filteredItems.filter((i) => i.entityType === 'CUSTOMER').length,
        totalMerchants: filteredItems.filter((i) => i.entityType === 'MERCHANT').length,
        pigmyCustomersCount: filteredItems.filter((i) => i.totalPigmy.count > 0).length,
        loanCustomersCount: filteredItems.filter((i) => i.totalLoans.count > 0).length,
        totalLoansCount: filteredItems.reduce((acc, curr) => acc + curr.totalLoans.count, 0),
        totalPigmyCount: filteredItems.reduce((acc, curr) => acc + curr.totalPigmy.count, 0)
      },
      items: paginatedItems,
      meta: {
        totalRecords,
        limit,
        page,
        totalPages: Math.ceil(totalRecords / limit) || 1,
        hasNextPage: page * limit < totalRecords,
        hasPrevPage: page > 1
      }
    };
  }

  /**
   * Get Customer or Merchant Details by ID
   */
  async getCustomerById(societyContext, id, queryType = null) {
    const bankId = societyContext?.bankId;
    if (!bankId) {
      throw ApiError.badRequest('Bank context is missing.');
    }

    const isBankWide = this.isBankWideRole(societyContext);
    const scopedBranchId = !isBankWide ? societyContext?.branchId : null;

    let memberItem = null;
    let entityType = queryType ? queryType.toUpperCase() : null;

    // Try finding as Customer (SocietyCustomerLink)
    if (!entityType || entityType === 'CUSTOMER') {
      let linkFilter = { bankId, isDeleted: { $ne: true } };
      if (scopedBranchId) linkFilter.branchId = scopedBranchId;

      let link = null;

      if (mongoose.Types.ObjectId.isValid(id)) {
        link = await SocietyCustomerLink.findOne({
          ...linkFilter,
          $or: [{ _id: id }, { userId: id }]
        })
          .populate('userId', 'firstName lastName fullName email phoneNumber status role')
          .populate('branchId', 'name code state address')
          .lean();
      }

      if (!link) {
        link = await SocietyCustomerLink.findOne({
          ...linkFilter,
          customerId: id
        })
          .populate('userId', 'firstName lastName fullName email phoneNumber status role')
          .populate('branchId', 'name code state address')
          .lean();
      }

      // If still not found by link ID/userId/customerId, check if `id` is a CustomerProfile ID
      if (!link && mongoose.Types.ObjectId.isValid(id)) {
        const custProfile = await CustomerProfile.findById(id).lean();
        if (custProfile?.userId) {
          link = await SocietyCustomerLink.findOne({
            ...linkFilter,
            userId: custProfile.userId
          })
            .populate('userId', 'firstName lastName fullName email phoneNumber status role')
            .populate('branchId', 'name code state address')
            .lean();
        }
      }

      if (link) {
        const uId = link.userId?._id || link.userId;
        const profile = await CustomerProfile.findOne({ userId: uId }).lean();
        const user = link.userId || {};

        const firstName = profile?.firstName || user.firstName || '';
        const lastName = profile?.lastName || user.lastName || '';
        const name = `${firstName} ${lastName}`.trim() || user.fullName || link.customerId || 'Customer';

        memberItem = {
          rawId: link._id,
          userId: uId,
          customerId: link.customerId,
          name,
          entityType: 'CUSTOMER',
          phoneNumber: profile?.phoneNumber || user.phoneNumber || link.phoneNumber || '',
          email: user.email || profile?.email || '',
          status: link.kycStatus || user.status || 'ACTIVE',
          branchId: link.branchId?._id || link.branchId,
          branchName: link.branchId?.name || 'N/A',
          createdAt: link.createdAt || link.firstOnboardedAt,
          onboardedByRaw: link.onboardedByExecutive,
          createdByUserId: profile?.createdByExecutiveId || profile?.createdById,
          link,
          profile,
          personalDetails: {
            firstName,
            lastName,
            fullName: name,
            phoneNumber: profile?.phoneNumber || user.phoneNumber || link.phoneNumber || '',
            email: user.email || profile?.email || '',
            gender: profile?.gender || null,
            dob: profile?.dob || null,
            panNumber: profile?.panNumber || '',
            aadhaarNumber: profile?.aadhaarNumber || '',
            kycStatus: link.kycStatus || profile?.kycStatus || 'PENDING',
            creditScore: profile?.creditScore || link.lastCibilScore || null,
            cibilStatus: profile?.cibilStatus || 'PENDING',
            onboardingStage: profile?.onboardingStage || 'COMPLETED',
            residentialPincode: profile?.residentialPincode || link.pincode || '',
            currentPinCode: profile?.currentPinCode || profile?.activeAddress?.pinCode || link.pincode || '',
            activeAddress: profile?.activeAddress || (link.pincode ? { pinCode: link.pincode } : null),
            addressHistory: profile?.addressHistory || []
          },
          documents: {
            panImage: profile?.panImage || link.panPicUrl || null,
            aadhaarImage: profile?.aadhaarImage || link.aadhaarPicUrl || null,
            livePhoto: profile?.livePhoto || profile?.avatar || link.livePicUrl || null,
            profileImage: profile?.profileImage || profile?.avatar || null,
            avatar: profile?.avatar || profile?.profileImage || null,
            cibilReportUrl: profile?.cibilReportUrl || null,
            rawKycData: profile?.rawKycData || null,
            rawCibilData: profile?.rawCibilData || null
          },
          bankDetails: profile?.bankDetails && profile.bankDetails.length > 0
            ? profile.bankDetails
            : [
                {
                  accountNumber: link.societyAccountNumber || '',
                  accountHolderName: link.accountHolderName || name,
                  ifscCode: link.ifscCode || '',
                  bankName: link.bankBranchName || '',
                  branchName: link.branchId?.name || '',
                  pincode: link.pincode || ''
                }
              ],
          societyAccountDetails: {
            accountNumber: link.societyAccountNumber || '',
            accountHolderName: link.accountHolderName || name,
            ifscCode: link.ifscCode || '',
            bankName: link.bankBranchName || '',
            branchName: link.branchId?.name || '',
            pincode: link.pincode || ''
          }
        };
      }
    }

    // Try finding as Merchant (MerchantProfile)
    if (!memberItem && (!entityType || entityType === 'MERCHANT')) {
      let merchantFilter = { bankId, isDeleted: { $ne: true } };
      if (scopedBranchId) merchantFilter.branchId = scopedBranchId;

      let m = null;
      if (mongoose.Types.ObjectId.isValid(id)) {
        m = await MerchantProfile.findOne({
          ...merchantFilter,
          $or: [{ _id: id }, { userId: id }]
        })
          .populate('userId', 'email phoneNumber status role')
          .populate('branchId', 'name code state address')
          .lean();
      }

      if (!m) {
        m = await MerchantProfile.findOne({
          ...merchantFilter,
          $or: [{ merchantCode: id }, { code: id }]
        })
          .populate('userId', 'email phoneNumber status role')
          .populate('branchId', 'name code state address')
          .lean();
      }

      if (m) {
        const docs = m.documents || {};
        memberItem = {
          rawId: m._id,
          userId: m.userId?._id || m.userId,
          merchantCode: m.merchantCode || m.code,
          name: m.shopName ? `${m.shopName} (${m.ownerName})` : m.ownerName || 'Merchant',
          shopName: m.shopName,
          ownerName: m.ownerName,
          entityType: 'MERCHANT',
          phoneNumber: m.phoneNumber || m.primaryPhoneNumber || '',
          email: m.email || '',
          status: m.approvalStatus === 'APPROVED' ? 'ACTIVE' : m.approvalStatus || m.status,
          branchId: m.branchId?._id || m.branchId,
          branchName: m.branchId?.name || 'N/A',
          createdAt: m.createdAt,
          onboardedByRaw: m.onboardedBy,
          createdByUserId: m.createdBy,
          merchantProfileId: m._id,
          personalDetails: {
            ownerName: m.ownerName,
            shopName: m.shopName,
            phoneNumber: m.phoneNumber || m.primaryPhoneNumber || '',
            secondaryPhoneNumber: m.secondaryPhoneNumber || null,
            email: m.email || '',
            shopAddress: m.shopAddress || null,
            panNumber: m.panNumber || '',
            aadhaarNumber: m.aadhaarNumber || '',
            gstinNumber: m.gstinNumber || '',
            businessProofType: m.businessProofType || null,
            businessProofNumber: m.businessProofNumber || null,
            approvalStatus: m.approvalStatus,
            rejectionReason: m.rejectionReason || null
          },
          documents: {
            ownerAadhaar: docs.ownerAadhaar || null,
            ownerPan: docs.ownerPan || null,
            businessProof: docs.businessProof || null,
            shopPhoto: docs.shopPhoto || null,
            shopRegistrationCertificate: docs.shopRegistrationCertificate || null,
            gstCertificate: docs.gstCertificate || null,
            aadhaarImage: docs.ownerAadhaar || null,
            panImage: docs.ownerPan || null
          },
          bankDetails: (m.bankDetails?.accountNumber && (!m.societyAccount?.societyAccountNumber || m.bankDetails.accountNumber.toUpperCase() !== m.societyAccount.societyAccountNumber.toUpperCase())) ? m.bankDetails : {},
          societyAccountDetails: await (async () => {
            const mUserId = m.userId?._id || m.userId;
            if (!mUserId) return null;
            const socLink = await SocietyCustomerLink.findOne({
              userId: mUserId,
              bankId,
              societyAccountNumber: { $ne: null }
            }).lean() || await SocietyCustomerLink.findOne({
              userId: mUserId,
              societyAccountNumber: { $ne: null }
            }).sort({ lastKycDate: -1, createdAt: -1 }).lean();
            if (!socLink?.societyAccountNumber) return null;
            return {
              accountNumber: socLink.societyAccountNumber,
              accountHolderName: socLink.accountHolderName || m.ownerName || '',
              ifscCode: socLink.ifscCode || '',
              bankName: socLink.bankBranchName || '',
              branchName: m.branchId?.name || '',
              pincode: socLink.pincode || ''
            };
          })()
        };
      }
    }

    if (!memberItem) {
      throw ApiError.notFound('Customer or Merchant profile not found for the given ID.');
    }

    // Concurrently aggregate detailed summaries
    const [totalLoans, totalPigmy, emiCardDetails, createdBy] = await Promise.all([
      this.resolveLoansSummary(memberItem.userId, bankId, memberItem.merchantProfileId),
      this.resolvePigmySummary(memberItem.userId, bankId, memberItem.phoneNumber, memberItem.customerId),
      this.resolveEmiCardDetails(memberItem.userId, bankId),
      this.resolveCreatorDetails(memberItem.onboardedByRaw, memberItem.createdByUserId, bankId)
    ]);

    return {
      id: memberItem.rawId,
      userId: memberItem.userId,
      customerId: memberItem.customerId || memberItem.merchantCode || null,
      name: memberItem.name,
      shopName: memberItem.shopName || null,
      ownerName: memberItem.ownerName || null,
      entityType: memberItem.entityType,
      phoneNumber: memberItem.phoneNumber,
      email: memberItem.email,
      status: memberItem.status,
      branchId: memberItem.branchId,
      branchName: memberItem.branchName,
      personalDetails: memberItem.personalDetails,
      documents: memberItem.documents,
      bankDetails: memberItem.bankDetails,
      totalLoans,
      totalPigmy,
      createdBy,
      createdAt: memberItem.createdAt,
      emiCardDetails,
      societyAccountDetails: memberItem.societyAccountDetails
    };
  }

  /**
   * Active Customers & Merchants Dropdown List
   */
  async listCustomersDropdown(societyContext, queryOptions = {}) {
    const bankId = societyContext?.bankId;
    if (!bankId) {
      throw ApiError.badRequest('Bank context missing.');
    }

    const isBankWide = this.isBankWideRole(societyContext);
    const scopedBranchId = !isBankWide ? societyContext?.branchId : queryOptions.branchId;

    const linkFilter = { bankId, isDeleted: { $ne: true } };
    if (scopedBranchId) linkFilter.branchId = scopedBranchId;

    const links = await SocietyCustomerLink.find(linkFilter)
      .populate('userId', 'firstName lastName fullName phoneNumber email')
      .populate('branchId', 'name code')
      .lean();

    const customerDropdown = links.map((l) => {
      const u = l.userId || {};
      const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.fullName || l.customerId;
      return {
        id: l._id,
        userId: u._id || l.userId,
        name,
        label: `${name} (${l.societyAccountNumber || l.customerId})`,
        entityType: 'CUSTOMER',
        phoneNumber: u.phoneNumber || l.phoneNumber || '',
        societyAccountNumber: l.societyAccountNumber || ''
      };
    });

    return customerDropdown;
  }
}

export const societyCustomerService = new SocietyCustomerService();
