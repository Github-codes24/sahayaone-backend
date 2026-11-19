import mongoose from 'mongoose';
import { CustomerProfile } from '../../../../models/customer-profile.model.js';
import { User } from '../../../../models/user.model.js';
import { Loan } from '../../../../models/loan.model.js';
import { MerchantProfile } from '../../../../models/merchant-profile.model.js';
import { SocietyEmployee } from '../../../../models/society-employee.model.js';
import { BranchManager } from '../../../../models/branch-manager.model.js';
import { Bank } from '../../../../models/bank.model.js';
import { Branch } from '../../../../models/branch.model.js';
import { UserRole, UserType } from '../../../../constants/user-role.constant.js';
import { storageManager } from '../../../../storage/storage.manager.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';

export class CustomersService {
  /**
   * Helper method to parse date strings (supports DD/MM/YYYY and YYYY-MM-DD / ISO)
   */
  parseDob(dobStr) {
    if (!dobStr) return null;
    if (dobStr instanceof Date) return dobStr;
    const cleanStr = String(dobStr).trim();
    const ddmmyyyyRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match = cleanStr.match(ddmmyyyyRegex);
    if (match) {
      const day = match[1].padStart(2, '0');
      const month = match[2].padStart(2, '0');
      const year = match[3];
      return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
    }
    const dateObj = new Date(cleanStr);
    return isNaN(dateObj.getTime()) ? null : dateObj;
  }

  /**
   * Helper method to parse filter date string (supports ISO, YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY)
   */
  parseFilterDate(dateStr, endOfDay = false) {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    const cleanStr = String(dateStr).trim();
    if (!cleanStr) return null;

    const ddmmyyyyRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match = cleanStr.match(ddmmyyyyRegex);
    let dateObj = null;

    if (match) {
      const day = match[1].padStart(2, '0');
      const month = match[2].padStart(2, '0');
      const year = match[3];
      dateObj = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
    } else {
      dateObj = new Date(cleanStr);
    }

    if (isNaN(dateObj.getTime())) return null;

    if (endOfDay) {
      dateObj.setUTCHours(23, 59, 59, 999);
    } else {
      dateObj.setUTCHours(0, 0, 0, 0);
    }

    return dateObj;
  }

  /**
   * Format Date object into DD/MM/YYYY format string
   */
  formatDob(date) {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Format Date object into readable registered date string e.g. "January 1, 2026"
   */
  formatRegisteredDate(date) {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  }

  /**
   * Format Currency into INR locale format e.g. ₹51,500
   */
  formatCurrency(amount) {
    if (amount === null || amount === undefined) return '₹0';
    return '₹' + Number(amount).toLocaleString('en-IN');
  }

  /**
   * Format Date object into short date string e.g. "10 Jan 2026"
   */
  formatDateShort(date) {
    if (!date) return 'NA';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'NA';
    const day = d.getUTCDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthStr = months[d.getUTCMonth()];
    const year = d.getUTCFullYear();
    return `${day} ${monthStr} ${year}`;
  }

  /**
   * Format Date object into ordinal date string e.g. "1st Aug 2026"
   */
  formatDateOrdinal(date) {
    if (!date) return 'NA';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'NA';
    
    const day = d.getUTCDate();
    let ordinal = 'th';
    if (day % 10 === 1 && day !== 11) ordinal = 'st';
    else if (day % 10 === 2 && day !== 12) ordinal = 'nd';
    else if (day % 10 === 3 && day !== 13) ordinal = 'rd';

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthStr = months[d.getUTCMonth()];
    const year = d.getUTCFullYear();

    return `${day}${ordinal} ${monthStr} ${year}`;
  }

  /**
   * Helper method to enrich onboardedBy object with merchant, bank, and branch details
   */
  async populateOnboardedByInfo(profile, user, lookupMaps = null) {
    const onboardingSource =
      profile?.onboardingSource ||
      user?.onboardingSource ||
      (profile?.createdByMerchantId ? 'MERCHANT' : profile?.createdByExecutiveId ? 'EXECUTIVE' : 'SELF');

    let onboardedBy = profile?.onboardedBy || user?.onboardedBy || null;
    if (!onboardedBy || typeof onboardedBy !== 'object') {
      onboardedBy = {};
    } else {
      onboardedBy = { ...onboardedBy };
    }

    const firstName = profile?.firstName || '';
    const lastName = profile?.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();

    if (!onboardedBy.role && !onboardedBy.type) {
      if (onboardingSource === 'SELF') {
        onboardedBy.id = onboardedBy.id || user?._id || profile?.userId;
        onboardedBy.userId = onboardedBy.userId || user?._id || profile?.userId;
        onboardedBy.name = onboardedBy.name || fullName || 'Self Onboarding';
        onboardedBy.phone = onboardedBy.phone || user?.phoneNumber || '';
        onboardedBy.role = 'CUSTOMER';
        onboardedBy.type = 'SELF';
      } else if (onboardingSource === 'EXECUTIVE' && profile?.createdByExecutiveId) {
        onboardedBy.id = onboardedBy.id || profile.createdByExecutiveId;
        onboardedBy.userId = onboardedBy.userId || profile.createdByExecutiveId;
        onboardedBy.role = 'LOAN_EXECUTIVE';
        onboardedBy.type = 'EXECUTIVE';
      } else if (onboardingSource === 'MERCHANT' && (profile?.createdByMerchantId || profile?.merchantId)) {
        onboardedBy.id = onboardedBy.id || profile.merchantId || profile.createdByMerchantId;
        onboardedBy.userId = onboardedBy.userId || profile.createdByMerchantId;
        onboardedBy.role = 'MERCHANT';
        onboardedBy.type = 'MERCHANT';
      }
    }

    let merchantDoc = null;
    let bankDoc = null;
    let branchDoc = null;

    const merchantIdStr = (profile?.merchantId || onboardedBy.merchantId || (onboardedBy.role === 'MERCHANT' ? onboardedBy.id : null))?.toString();
    const creatorUserIdStr = (profile?.createdByMerchantId || profile?.createdByExecutiveId || onboardedBy.userId || onboardedBy.id)?.toString();

    if (lookupMaps) {
      if (merchantIdStr && lookupMaps.merchantByIdMap?.has(merchantIdStr)) {
        merchantDoc = lookupMaps.merchantByIdMap.get(merchantIdStr);
      } else if (creatorUserIdStr && lookupMaps.merchantByUserIdMap?.has(creatorUserIdStr)) {
        merchantDoc = lookupMaps.merchantByUserIdMap.get(creatorUserIdStr);
      }
    } else {
      if (merchantIdStr && mongoose.Types.ObjectId.isValid(merchantIdStr)) {
        merchantDoc = await MerchantProfile.findById(merchantIdStr).lean();
      }
      if (!merchantDoc && creatorUserIdStr && mongoose.Types.ObjectId.isValid(creatorUserIdStr)) {
        merchantDoc = await MerchantProfile.findOne({ userId: creatorUserIdStr }).lean();
      }
    }

    if (merchantDoc) {
      onboardedBy.role = 'MERCHANT';
      onboardedBy.type = 'MERCHANT';
      onboardedBy.merchantId = merchantDoc._id;
      if (!onboardedBy.shopName) onboardedBy.shopName = merchantDoc.shopName || merchantDoc.ownerName || 'Merchant Shop';
      if (!onboardedBy.name) onboardedBy.name = merchantDoc.ownerName || merchantDoc.shopName || 'Merchant';
      if (!onboardedBy.phone) onboardedBy.phone = merchantDoc.phoneNumber || '';
      if (!onboardedBy.email) onboardedBy.email = merchantDoc.email || '';

      if (!onboardedBy.bankId && merchantDoc.bankId) onboardedBy.bankId = merchantDoc.bankId;
      if (!onboardedBy.branchId && merchantDoc.branchId) onboardedBy.branchId = merchantDoc.branchId;
    }

    if ((!onboardedBy.bankId || !onboardedBy.branchId) && creatorUserIdStr) {
      if (lookupMaps) {
        const societyDoc = lookupMaps.societyByUserIdMap?.get(creatorUserIdStr);
        if (societyDoc) {
          if (!onboardedBy.bankId && societyDoc.bankId) onboardedBy.bankId = societyDoc.bankId;
          if (!onboardedBy.branchId && societyDoc.branchId) onboardedBy.branchId = societyDoc.branchId;
        }
        const bmDoc = lookupMaps.branchManagerByUserIdMap?.get(creatorUserIdStr);
        if (bmDoc) {
          if (!onboardedBy.bankId && bmDoc.bankId) onboardedBy.bankId = bmDoc.bankId;
          if (!onboardedBy.branchId && bmDoc.branchId) onboardedBy.branchId = bmDoc.branchId;
        }
      } else {
        if (mongoose.Types.ObjectId.isValid(creatorUserIdStr)) {
          const societyDoc = await SocietyEmployee.findOne({ userId: creatorUserIdStr }).lean();
          if (societyDoc) {
            if (!onboardedBy.bankId && societyDoc.bankId) onboardedBy.bankId = societyDoc.bankId;
            if (!onboardedBy.branchId && societyDoc.branchId) onboardedBy.branchId = societyDoc.branchId;
          } else {
            const bmDoc = await BranchManager.findOne({ userId: creatorUserIdStr }).lean();
            if (bmDoc) {
              if (!onboardedBy.bankId && bmDoc.bankId) onboardedBy.bankId = bmDoc.bankId;
              if (!onboardedBy.branchId && bmDoc.branchId) onboardedBy.branchId = bmDoc.branchId;
            }
          }
        }
      }
    }

    // Resolve Bank Name & Branch Name
    if (onboardedBy.bankId) {
      const bId = onboardedBy.bankId.toString();
      if (lookupMaps && lookupMaps.bankMap?.has(bId)) {
        bankDoc = lookupMaps.bankMap.get(bId);
      } else if (!lookupMaps && mongoose.Types.ObjectId.isValid(bId)) {
        bankDoc = await Bank.findById(bId).select('name code').lean();
      }
      if (bankDoc) {
        onboardedBy.bankName = bankDoc.name;
        onboardedBy.bank = bankDoc.name;
      }
    }

    if (onboardedBy.branchId) {
      const brId = onboardedBy.branchId.toString();
      if (lookupMaps && lookupMaps.branchMap?.has(brId)) {
        branchDoc = lookupMaps.branchMap.get(brId);
      } else if (!lookupMaps && mongoose.Types.ObjectId.isValid(brId)) {
        branchDoc = await Branch.findById(brId).select('name code').lean();
      }
      if (branchDoc) {
        onboardedBy.branchName = branchDoc.name;
        onboardedBy.branch = branchDoc.name;
      }
    }

    return onboardedBy;
  }

  /**
   * Standardize customer object output for API responses matching UI spec
   */
  formatCustomerResponse(profile, user, loansCount = 0, onboardedByEnriched = null) {
    const firstName = profile.firstName || '';
    const lastName = profile.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    
    let displayGender = profile.gender || 'OTHER';
    if (displayGender === 'MALE') displayGender = 'Male';
    else if (displayGender === 'FEMALE') displayGender = 'Female';
    else if (displayGender === 'OTHER') displayGender = 'Other';

    const onboardingSource = profile.onboardingSource || user?.onboardingSource || (profile.createdByMerchantId ? 'MERCHANT' : profile.createdByExecutiveId ? 'EXECUTIVE' : 'SELF');
    
    let onboardedBy = onboardedByEnriched || profile.onboardedBy || user?.onboardedBy || null;
    if (!onboardedBy) {
      if (onboardingSource === 'SELF') {
        onboardedBy = {
          id: user?._id || profile.userId,
          userId: user?._id || profile.userId,
          name: fullName || 'Self Onboarding',
          phone: user?.phoneNumber || '',
          role: 'CUSTOMER',
          type: 'SELF'
        };
      } else if (onboardingSource === 'EXECUTIVE' && profile.createdByExecutiveId) {
        onboardedBy = {
          id: profile.createdByExecutiveId,
          userId: profile.createdByExecutiveId,
          role: 'LOAN_EXECUTIVE',
          type: 'EXECUTIVE'
        };
      } else if (onboardingSource === 'MERCHANT' && (profile.createdByMerchantId || profile.merchantId)) {
        onboardedBy = {
          id: profile.merchantId || profile.createdByMerchantId,
          userId: profile.createdByMerchantId,
          role: 'MERCHANT',
          type: 'MERCHANT'
        };
      }
    }

    return {
      id: profile._id,
      profileId: profile._id,
      userId: user?._id || profile.userId,
      fullName,
      firstName,
      lastName,
      profileImage: profile.profileImage || null,
      gender: profile.gender || null,
      displayGender,
      dob: profile.dob || null,
      formattedDob: this.formatDob(profile.dob),
      phoneNumber: user?.phoneNumber || '',
      phone: user?.phoneNumber || '',
      email: user?.email || '',
      address: profile.activeAddress?.addressLine || '',
      activeAddress: profile.activeAddress || { addressLine: '' },
      kycStatus: profile.kycStatus || 'PENDING',
      status: user?.status || 'ACTIVE',
      roleTag: 'Customer',
      onboardingSource,
      onboardedBy,
      createdBy: profile.createdByExecutiveId || profile.createdByMerchantId || profile.createdById || user?.createdBy || null,
      registeredOn: profile.createdAt,
      registeredOnFormatted: this.formatRegisteredDate(profile.createdAt),
      loansCount,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt
    };
  }

  /**
   * Format single loan card item object for UI listing
   */
  formatLoanItemResponse(loan) {
    const variant = loan.variantId || {};
    const product = variant.productId || {};

    const productName = product.name || variant.name || 'Device Loan';
    const storage = variant.storage && variant.storage !== 'Default' ? variant.storage : '';
    const color = variant.color && variant.color !== 'Default' ? variant.color : '';

    let productTitle = productName;
    const titleParts = [storage, color].filter(Boolean);
    if (titleParts.length > 0) {
      productTitle += ` - ${titleParts.join(' - ')}`;
    }

    const productImage = variant.image || product.image || null;

    const status = loan.status || 'NEW';
    let statusDisplay = 'New';
    if (status === 'ACTIVE') statusDisplay = 'Active';
    else if (status === 'COMPLETED') statusDisplay = 'Completed';
    else if (status === 'REJECTED') statusDisplay = 'Rejected';

    const totalLoanAmount = loan.totalLoanAmount || loan.totalPayableAmount || loan.totalAmount || 0;
    const outstandingAmount = status === 'COMPLETED' ? 0 : (loan.outstandingAmount !== undefined ? loan.outstandingAmount : totalLoanAmount);
    const emiAmount = loan.emiAmount || 0;

    const tenureMonths = loan.tenureMonths || 0;
    const paidEmisCount = loan.paidEmisCount || 0;

    let progressPercentage = 0;
    if (status === 'COMPLETED') {
      progressPercentage = 100;
    } else if (tenureMonths > 0) {
      progressPercentage = Math.min(100, Math.round((paidEmisCount / tenureMonths) * 100));
    }

    const emisPaidText = `${paidEmisCount} of ${tenureMonths} EMIs paid`;
    const progressText = `${progressPercentage}% Completed`;

    const disbursedOnFormatted = loan.disbursedAt ? this.formatDateShort(loan.disbursedAt) : 'NA';
    const nextEmiDueDateFormatted = (status === 'COMPLETED' || status === 'REJECTED' || !loan.nextEmiDueDate)
      ? 'NA'
      : this.formatDateOrdinal(loan.nextEmiDueDate);

    return {
      id: loan._id,
      loanId: loan._id,
      applicationId: loan.applicationId,
      productTitle,
      productName,
      productImage,
      storage,
      color,
      status,
      statusDisplay,
      disbursedAt: loan.disbursedAt,
      disbursedOnFormatted,
      loanAmount: totalLoanAmount,
      formattedLoanAmount: this.formatCurrency(totalLoanAmount),
      outstandingAmount,
      formattedOutstanding: this.formatCurrency(outstandingAmount),
      emiAmount,
      formattedEmiAmount: this.formatCurrency(emiAmount),
      nextEmiDueDate: loan.nextEmiDueDate,
      nextEmiDueDateFormatted,
      progressPercentage,
      progressText,
      emisPaidText,
      paidEmisCount,
      tenureMonths,
      createdAt: loan.createdAt,
      updatedAt: loan.updatedAt
    };
  }

  /**
   * List customers with pagination, search, and filtering
   */
  async listCustomers(queryOptions) {
    const page = parseInt(queryOptions.page || '1', 10);
    const limit = parseInt(queryOptions.limit || '10', 10);
    const search = (queryOptions.search || '').trim();
    const gender = queryOptions.gender ? queryOptions.gender.toUpperCase() : null;
    const status = queryOptions.status ? queryOptions.status.toUpperCase() : null;
    const bankFilterParam = queryOptions.bankId || queryOptions.bank;
    const skip = (page - 1) * limit;

    const fromDateStr = queryOptions.fromDate || queryOptions.startDate || queryOptions.createdFrom || queryOptions.from;
    const toDateStr = queryOptions.toDate || queryOptions.endDate || queryOptions.createdTo || queryOptions.to;

    const fromDate = this.parseFilterDate(fromDateStr, false);
    const toDate = this.parseFilterDate(toDateStr, true);

    const profileFilter = {
      isDeleted: { $ne: true }
    };

    if (gender) {
      profileFilter.gender = gender;
    }

    if (fromDate || toDate) {
      profileFilter.createdAt = {};
      if (fromDate) profileFilter.createdAt.$gte = fromDate;
      if (toDate) profileFilter.createdAt.$lte = toDate;
    }

    const pipeline = [
      { $match: profileFilter },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: false } },
      {
        $match: {
          'userInfo.isDeleted': { $ne: true },
          ...(status ? { 'userInfo.status': status } : {})
        }
      }
    ];

    if (bankFilterParam) {
      let bankObjId = null;
      if (mongoose.Types.ObjectId.isValid(bankFilterParam)) {
        bankObjId = new mongoose.Types.ObjectId(bankFilterParam);
      } else {
        const matchedBank = await Bank.findOne({
          $or: [{ code: bankFilterParam.toUpperCase() }, { name: new RegExp(bankFilterParam, 'i') }],
          isDeleted: { $ne: true }
        }).lean();
        if (matchedBank) {
          bankObjId = matchedBank._id;
        }
      }

      if (bankObjId) {
        const merchantProfiles = await MerchantProfile.find({ bankId: bankObjId }).select('_id userId').lean();
        const merchantIds = merchantProfiles.map(m => m._id);
        const merchantUserIds = merchantProfiles.map(m => m.userId).filter(Boolean);

        const societyEmployees = await SocietyEmployee.find({ bankId: bankObjId }).select('userId').lean();
        const societyUserIds = societyEmployees.map(s => s.userId).filter(Boolean);

        const branchManagers = await BranchManager.find({ bankId: bankObjId }).select('userId').lean();
        const branchManagerUserIds = branchManagers.map(b => b.userId).filter(Boolean);

        const bankLoans = await Loan.find({ assignedBankId: bankObjId, isDeleted: { $ne: true } }).select('customerId').lean();
        const loanCustomerUserIds = bankLoans.map(l => l.customerId).filter(Boolean);

        const allOnboarderUserIds = [...merchantUserIds, ...societyUserIds, ...branchManagerUserIds];

        pipeline.push({
          $match: {
            $or: [
              { 'onboardedBy.bankId': bankObjId },
              { 'onboardedBy.bankId': bankObjId.toString() },
              { merchantId: { $in: merchantIds } },
              { createdByMerchantId: { $in: merchantUserIds } },
              { createdByExecutiveId: { $in: allOnboarderUserIds } },
              { userId: { $in: loanCustomerUserIds } }
            ]
          }
        });
      } else {
        pipeline.push({ $match: { _id: null } });
      }
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      pipeline.push({
        $match: {
          $or: [
            { firstName: searchRegex },
            { lastName: searchRegex },
            { 'userInfo.phoneNumber': searchRegex },
            { 'userInfo.email': searchRegex }
          ]
        }
      });
    }

    const sortField = queryOptions.sortBy || 'createdAt';
    const sortOrder = (queryOptions.sortOrder || 'desc').toLowerCase() === 'asc' ? 1 : -1;
    pipeline.push({ $sort: { [sortField]: sortOrder } });

    const countPipeline = [...pipeline, { $count: 'total' }];

    pipeline.push({ $skip: skip }, { $limit: limit });

    const [profiles, countResult] = await Promise.all([
      CustomerProfile.aggregate(pipeline),
      CustomerProfile.aggregate(countPipeline)
    ]);

    const totalRecords = countResult[0]?.total || 0;
    const totalPages = Math.ceil(totalRecords / limit);

    const userIds = profiles.map(p => p.userId);
    const loanCounts = await Loan.aggregate([
      { $match: { customerId: { $in: userIds }, isDeleted: { $ne: true } } },
      { $group: { _id: '$customerId', count: { $sum: 1 } } }
    ]);
    const loanCountMap = new Map(loanCounts.map(l => [l._id.toString(), l.count]));

    // Batch resolve Merchant, Bank, and Branch lookup maps for onboardedBy enrichment
    const merchantIdsToFetch = new Set();
    const userIdsToFetchMerchants = new Set();
    const userIdsToFetchExecutives = new Set();

    for (const p of profiles) {
      if (p.merchantId) merchantIdsToFetch.add(p.merchantId.toString());
      if (p.createdByMerchantId) userIdsToFetchMerchants.add(p.createdByMerchantId.toString());
      if (p.createdByExecutiveId) userIdsToFetchExecutives.add(p.createdByExecutiveId.toString());
      if (p.onboardedBy?.merchantId) merchantIdsToFetch.add(p.onboardedBy.merchantId.toString());
      if (p.onboardedBy?.id && (p.onboardedBy?.role === 'MERCHANT' || p.onboardedBy?.type === 'MERCHANT')) merchantIdsToFetch.add(p.onboardedBy.id.toString());
      if (p.onboardedBy?.userId) userIdsToFetchMerchants.add(p.onboardedBy.userId.toString());
    }

    const [merchantsById, merchantsByUserId, societyEmployees, branchManagers] = await Promise.all([
      MerchantProfile.find({ _id: { $in: Array.from(merchantIdsToFetch) } }).lean(),
      MerchantProfile.find({ userId: { $in: Array.from(userIdsToFetchMerchants) } }).lean(),
      SocietyEmployee.find({ userId: { $in: Array.from(userIdsToFetchExecutives) } }).lean(),
      BranchManager.find({ userId: { $in: Array.from(userIdsToFetchExecutives) } }).lean()
    ]);

    const merchantByIdMap = new Map(merchantsById.map(m => [m._id.toString(), m]));
    const merchantByUserIdMap = new Map(merchantsByUserId.map(m => [m.userId.toString(), m]));
    const societyByUserIdMap = new Map(societyEmployees.map(s => [s.userId.toString(), s]));
    const branchManagerByUserIdMap = new Map(branchManagers.map(b => [b.userId.toString(), b]));

    const bankIdsToFetch = new Set();
    const branchIdsToFetch = new Set();

    for (const m of [...merchantsById, ...merchantsByUserId]) {
      if (m.bankId) bankIdsToFetch.add(m.bankId.toString());
      if (m.branchId) branchIdsToFetch.add(m.branchId.toString());
    }
    for (const s of societyEmployees) {
      if (s.bankId) bankIdsToFetch.add(s.bankId.toString());
      if (s.branchId) branchIdsToFetch.add(s.branchId.toString());
    }
    for (const b of branchManagers) {
      if (b.bankId) bankIdsToFetch.add(b.bankId.toString());
      if (b.branchId) branchIdsToFetch.add(b.branchId.toString());
    }
    for (const p of profiles) {
      if (p.onboardedBy?.bankId) bankIdsToFetch.add(p.onboardedBy.bankId.toString());
      if (p.onboardedBy?.branchId) branchIdsToFetch.add(p.onboardedBy.branchId.toString());
    }

    const [banks, branches] = await Promise.all([
      Bank.find({ _id: { $in: Array.from(bankIdsToFetch) } }).select('name code').lean(),
      Branch.find({ _id: { $in: Array.from(branchIdsToFetch) } }).select('name code').lean()
    ]);

    const bankMap = new Map(banks.map(b => [b._id.toString(), b]));
    const branchMap = new Map(branches.map(b => [b._id.toString(), b]));

    const lookupMaps = {
      merchantByIdMap,
      merchantByUserIdMap,
      societyByUserIdMap,
      branchManagerByUserIdMap,
      bankMap,
      branchMap
    };

    const items = await Promise.all(
      profiles.map(async (p, idx) => {
        const user = p.userInfo;
        const count = loanCountMap.get(user._id.toString()) || 0;
        const onboardedByEnriched = await this.populateOnboardedByInfo(p, user, lookupMaps);
        const formatted = this.formatCustomerResponse(p, user, count, onboardedByEnriched);
        return {
          srNo: skip + idx + 1,
          ...formatted
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
   * Get single customer profile by ID (Profile ID or User ID)
   */
  async getCustomerById(id) {
    const profile = await CustomerProfile.findOne({
      $or: [{ _id: id }, { userId: id }],
      isDeleted: { $ne: true }
    });

    if (!profile) {
      throw ApiError.notFound('Customer not found.');
    }

    const user = await User.findOne({ _id: profile.userId, isDeleted: { $ne: true } });
    if (!user) {
      throw ApiError.notFound('Associated user account not found.');
    }

    const loansCount = await Loan.countDocuments({ customerId: user._id, isDeleted: { $ne: true } });
    const onboardedByEnriched = await this.populateOnboardedByInfo(profile, user);

    return this.formatCustomerResponse(profile, user, loansCount, onboardedByEnriched);
  }

  /**
   * Create a new customer
   */
  async createCustomer(payload, file, creatorId) {
    const phoneNumber = (payload.phoneNumber || payload.phone || '').trim();
    const email = payload.email ? payload.email.trim().toLowerCase() : undefined;

    if (!phoneNumber) {
      throw ApiError.badRequest('Phone number is required.', ErrorCode.VALIDATION_ERROR);
    }

    const existingPhone = await User.findOne({ phoneNumber, isDeleted: { $ne: true } });
    if (existingPhone) {
      throw ApiError.conflict('A user with this phone number already exists.', ErrorCode.VALIDATION_ERROR);
    }

    if (email) {
      const existingEmail = await User.findOne({ email, isDeleted: { $ne: true } });
      if (existingEmail) {
        throw ApiError.conflict('A user with this email address already exists.', ErrorCode.VALIDATION_ERROR);
      }
    }

    let firstName = (payload.firstName || '').trim();
    let lastName = (payload.lastName || '').trim();
    if (payload.fullName && (!firstName || !lastName)) {
      const parts = payload.fullName.trim().split(/\s+/);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }

    if (!firstName) {
      throw ApiError.badRequest('First name / Full name is required.', ErrorCode.VALIDATION_ERROR);
    }

    const dobInput = payload.dob || payload.dateOfBirth;
    const dob = this.parseDob(dobInput);
    if (!dob) {
      throw ApiError.badRequest('Invalid Date of Birth format. Please provide DD/MM/YYYY or YYYY-MM-DD.', ErrorCode.VALIDATION_ERROR);
    }

    let profileImage = null;
    let profileImageKey = null;
    if (file) {
      const uploadResult = await storageManager.uploadFile(file, 'customers');
      if (uploadResult && uploadResult.fileUrl) {
        profileImage = uploadResult.fileUrl;
        profileImageKey = uploadResult.key || null;
      }
    }

    const adminUser = creatorId ? await User.findById(creatorId) : null;
    const onboardedByData = {
      id: creatorId || null,
      userId: creatorId || null,
      name: adminUser?.fullName || 'Super Admin',
      email: adminUser?.email || 'admin@sahayaone.com',
      phone: adminUser?.phoneNumber || '',
      role: 'SUPER_ADMIN',
      type: 'ADMIN'
    };

    const userDocData = {
      phoneNumber,
      role: UserRole.CUSTOMER,
      userType: UserType.CUSTOMER,
      status: payload.status || 'ACTIVE',
      onboardingSource: 'SUPER_ADMIN',
      createdBy: creatorId,
      onboardedBy: onboardedByData
    };
    if (email) {
      userDocData.email = email;
    }

    const user = new User(userDocData);
    await user.save();

    const profile = new CustomerProfile({
      userId: user._id,
      firstName,
      lastName,
      gender: payload.gender ? payload.gender.toUpperCase() : 'OTHER',
      dob,
      profileImage,
      profileImageKey,
      activeAddress: {
        addressLine: (payload.address || '').trim()
      },
      onboardingSource: 'SUPER_ADMIN',
      createdById: creatorId,
      createdByExecutiveId: creatorId,
      onboardedBy: onboardedByData
    });
    await profile.save();

    user.profileId = profile._id;
    user.profileModel = 'CustomerProfile';
    await user.save();

    return this.formatCustomerResponse(profile, user, 0);
  }

  /**
   * Update existing customer
   */
  async updateCustomer(id, payload, file, updaterId) {
    const profile = await CustomerProfile.findOne({
      $or: [{ _id: id }, { userId: id }],
      isDeleted: { $ne: true }
    });

    if (!profile) {
      throw ApiError.notFound('Customer profile not found.');
    }

    const user = await User.findOne({ _id: profile.userId, isDeleted: { $ne: true } });
    if (!user) {
      throw ApiError.notFound('Associated user account not found.');
    }

    const newPhone = (payload.phoneNumber || payload.phone || '').trim();
    if (newPhone && newPhone !== user.phoneNumber) {
      const existingPhone = await User.findOne({
        phoneNumber: newPhone,
        _id: { $ne: user._id },
        isDeleted: { $ne: true }
      });
      if (existingPhone) {
        throw ApiError.conflict('Another customer already exists with this phone number.', ErrorCode.VALIDATION_ERROR);
      }
      user.phoneNumber = newPhone;
    }

    if (payload.email !== undefined) {
      const newEmail = payload.email ? payload.email.trim().toLowerCase() : null;
      if (newEmail && newEmail !== user.email) {
        const existingEmail = await User.findOne({
          email: newEmail,
          _id: { $ne: user._id },
          isDeleted: { $ne: true }
        });
        if (existingEmail) {
          throw ApiError.conflict('Another customer already exists with this email address.', ErrorCode.VALIDATION_ERROR);
        }
        user.email = newEmail;
      } else if (!newEmail) {
        user.email = null;
      }
    }

    if (payload.status) {
      user.status = payload.status.toUpperCase();
    }
    user.updatedBy = updaterId;
    await user.save();

    if (payload.fullName) {
      const parts = payload.fullName.trim().split(/\s+/);
      profile.firstName = parts[0] || profile.firstName;
      profile.lastName = parts.slice(1).join(' ') || '';
    } else {
      if (payload.firstName) profile.firstName = payload.firstName.trim();
      if (payload.lastName !== undefined) profile.lastName = payload.lastName.trim();
    }

    if (payload.gender) {
      profile.gender = payload.gender.toUpperCase();
    }

    const dobInput = payload.dob || payload.dateOfBirth;
    if (dobInput) {
      const dob = this.parseDob(dobInput);
      if (dob) profile.dob = dob;
    }

    if (payload.address !== undefined) {
      profile.activeAddress = {
        ...(profile.activeAddress || {}),
        addressLine: payload.address.trim()
      };
    }

    if (file) {
      const uploadResult = await storageManager.uploadFile(file, 'customers');
      if (uploadResult && uploadResult.fileUrl) {
        profile.profileImage = uploadResult.fileUrl;
        profile.profileImageKey = uploadResult.key || null;
      }
    }

    await profile.save();

    const loansCount = await Loan.countDocuments({ customerId: user._id, isDeleted: { $ne: true } });

    return this.formatCustomerResponse(profile, user, loansCount);
  }

  /**
   * Soft delete customer
   */
  async deleteCustomer(id, deleterId) {
    const profile = await CustomerProfile.findOne({
      $or: [{ _id: id }, { userId: id }],
      isDeleted: { $ne: true }
    });

    if (!profile) {
      throw ApiError.notFound('Customer not found for deletion.');
    }

    const user = await User.findOne({ _id: profile.userId, isDeleted: { $ne: true } });

    profile.isDeleted = true;
    profile.deletedAt = new Date();
    profile.deletedBy = deleterId;
    await profile.save();

    if (user) {
      user.isDeleted = true;
      user.deletedAt = new Date();
      user.updatedBy = deleterId;
      await user.save();
    }

    return { id: profile._id, message: 'Customer deleted successfully.' };
  }

  /**
   * Get Customer Loans list with top summary card & tab filtering (New, Active, Completed, Rejected)
   */
  async getCustomerLoans(id, queryOptions = {}) {
    // 1. Locate Customer Profile & User
    const profile = await CustomerProfile.findOne({
      $or: [{ _id: id }, { userId: id }],
      isDeleted: { $ne: true }
    });

    if (!profile) {
      throw ApiError.notFound('Customer profile not found.');
    }

    const userId = profile.userId;

    // 2. Compute Summary Card Stats for Customer
    const allCustomerLoans = await Loan.find({ customerId: userId, isDeleted: { $ne: true } }).lean();

    let totalOutstanding = 0;
    let activeLoansCount = 0;
    let totalLoanAmount = 0;

    for (const l of allCustomerLoans) {
      const amt = l.totalLoanAmount || l.totalPayableAmount || l.totalAmount || 0;
      totalLoanAmount += amt;

      if (l.status === 'ACTIVE') {
        activeLoansCount += 1;
        totalOutstanding += l.outstandingAmount !== undefined ? l.outstandingAmount : amt;
      } else if (l.status === 'NEW') {
        totalOutstanding += l.outstandingAmount !== undefined ? l.outstandingAmount : amt;
      }
    }

    const summary = {
      totalOutstanding,
      formattedTotalOutstanding: this.formatCurrency(totalOutstanding),
      activeLoansCount,
      activeLoansText: `${activeLoansCount} Active Loans`,
      totalLoanAmount,
      formattedTotalLoanAmount: this.formatCurrency(totalLoanAmount)
    };

    // 3. Filter and Paginate Customer Loans
    const page = parseInt(queryOptions.page || '1', 10);
    const limit = parseInt(queryOptions.limit || '10', 10);
    const skip = (page - 1) * limit;
    const status = queryOptions.status ? queryOptions.status.toUpperCase() : 'ALL';
    const search = (queryOptions.search || '').trim();

    const loanFilter = {
      customerId: userId,
      isDeleted: { $ne: true }
    };

    if (status && status !== 'ALL') {
      loanFilter.status = status;
    }

    if (search) {
      loanFilter.applicationId = { $regex: search, $options: 'i' };
    }

    const [loans, totalRecords] = await Promise.all([
      Loan.find(loanFilter)
        .populate({
          path: 'variantId',
          select: 'name color storage price image productId',
          populate: { path: 'productId', select: 'name brandId image' }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Loan.countDocuments(loanFilter)
    ]);

    const totalPages = Math.ceil(totalRecords / limit);

    const items = loans.map(l => this.formatLoanItemResponse(l));

    return {
      summary,
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
   * Get single loan details for customer (including full EMI schedule & NOC info)
   */
  async getSingleLoan(id, loanId) {
    const profile = await CustomerProfile.findOne({
      $or: [{ _id: id }, { userId: id }],
      isDeleted: { $ne: true }
    });

    if (!profile) {
      throw ApiError.notFound('Customer profile not found.');
    }

    const loan = await Loan.findOne({
      _id: loanId,
      customerId: profile.userId,
      isDeleted: { $ne: true }
    })
      .populate({
        path: 'variantId',
        select: 'name color storage price image productId',
        populate: { path: 'productId', select: 'name brandId image' }
      })
      .lean();

    if (!loan) {
      throw ApiError.notFound('Loan details not found for this customer.');
    }

    const formattedItem = this.formatLoanItemResponse(loan);
    const customerSummary = this.formatCustomerResponse(profile, null, 0);

    return {
      ...formattedItem,
      customer: customerSummary,
      productPrice: loan.productPrice,
      emiCardCharges: loan.emiCardCharges,
      processingFees: loan.processingFees,
      totalAmount: loan.totalAmount,
      downPayment: loan.downPayment,
      totalLoanAmount: loan.totalLoanAmount,
      interestAmount: loan.interestAmount,
      insuranceAmount: loan.insuranceAmount,
      totalPayableAmount: loan.totalPayableAmount,
      nocKey: loan.nocKey || null,
      nocUrl: loan.nocKey ? storageManager.getFileUrl ? storageManager.getFileUrl(loan.nocKey) : loan.nocKey : null,
      schedule: loan.schedule || []
    };
  }
}

export const customersService = new CustomersService();
