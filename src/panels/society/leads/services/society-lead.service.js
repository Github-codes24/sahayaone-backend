import { Loan } from '../../../../models/loan.model.js';
import { CustomerProfile } from '../../../../models/customer-profile.model.js';
import { User } from '../../../../models/user.model.js';
import { Branch } from '../../../../models/branch.model.js';
import { Bank } from '../../../../models/bank.model.js';
import { BankAccount } from '../../../../models/bank-account.model.js';
import { EmployeeProfile } from '../../../../models/employee-profile.model.js';
import { SocietyEmployee } from '../../../../models/society-employee.model.js';
import { Variant } from '../../../../models/variant.model.js';
import { EmiSlab } from '../../../../models/emi-slab.model.js';
import { EmiCard } from '../../../../models/emi-card.model.js';
import { Setting } from '../../../../models/setting.model.js';
import { CreditLog } from '../../../../models/credit-log.model.js';
import { CardCreditUsage } from '../../../../models/card-credit-usage.model.js';
import { MerchantProfile } from '../../../../models/merchant-profile.model.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';
import { storageManager } from '../../../../storage/storage.manager.js';
import { smsManager } from '../../../../sms/sms.manager.js';
import { smsConfig } from '../../../../config/sms.config.js';
import { generateOtp } from '../../../../utils/otp.util.js';
import { envConfig } from '../../../../config/env.config.js';
import { panelControlConfig } from '../../../../config/panel-control.config.js';

const parseBase64ToMulterFile = (base64String, fieldName, identifier) => {
  const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw ApiError.badRequest('Invalid base64 digital signature format.');
  }
  const buffer = Buffer.from(matches[2], 'base64');
  return {
    fieldname: fieldName,
    originalname: `${identifier}_${fieldName}.png`,
    encoding: '7bit',
    mimetype: matches[1],
    buffer,
    size: buffer.length
  };
};

const getSettingValue = async (key, defaultValue) => {
  const doc = await Setting.findOne({ key: key.toUpperCase() });
  return doc ? doc.value : defaultValue;
};

const isCardExpired = (validThru) => {
  if (!validThru) return true;
  const parts = validThru.split('/');
  if (parts.length !== 2) return true;
  const month = parseInt(parts[0], 10);
  const year = parseInt('20' + parts[1], 10);
  const now = new Date();
  const expiry = new Date(year, month - 1, 28);
  return now > expiry;
};

const extendValidity = (validThru, years) => {
  if (!validThru) return '12/31';
  const parts = validThru.split('/');
  if (parts.length !== 2) return '12/31';
  const month = parts[0];
  const year = parseInt(parts[1], 10) + years;
  return `${month}/${year}`;
};

const maskCardNumber = (cardNumber) => {
  if (!cardNumber) return '';
  const cleaned = cardNumber.replace(/\s+/g, '');
  if (cleaned.length < 6) return cardNumber;
  const visible = cleaned.slice(-6);
  const masked = 'X'.repeat(cleaned.length - 6);
  const combined = masked + visible;
  return combined.replace(/(.{4})/g, '$1 ').trim();
};

export class SocietyLeadService {
  async buildScope(context, queryBranchId = null, queryBranchIds = null) {
    if (!context?.bankId) {
      throw ApiError.forbidden('A valid society bank context is required.');
    }

    let branchId = context.branchId || null;

    if (!branchId) {
      if (queryBranchId) {
        branchId = queryBranchId;
      } else if (queryBranchIds) {
        if (Array.isArray(queryBranchIds)) {
          branchId = { $in: queryBranchIds };
        } else if (typeof queryBranchIds === 'string' && queryBranchIds.includes(',')) {
          branchId = { $in: queryBranchIds.split(',').map((s) => s.trim()) };
        } else {
          branchId = queryBranchIds;
        }
      }
    }

    const directScope = { assignedBankId: context.bankId };
    if (branchId) {
      directScope.branchId = branchId;
    }

    // Resolve executive user IDs belonging to this bank/branch for fallback lookup
    const branchQuery = { bankId: context.bankId };
    if (branchId) {
      branchQuery._id = branchId;
    }

    const [matchingBranches, societyEmployees, merchantProfiles] = await Promise.all([
      Branch.find(branchQuery).select('_id').lean(),
      SocietyEmployee.find({
        bankId: context.bankId,
        ...(branchId ? { branchId } : {})
      }).select('userId').lean(),
      MerchantProfile.find({
        bankId: context.bankId,
        ...(branchId ? { branchId } : {})
      }).select('_id userId branchId').lean()
    ]);

    const branchIds = matchingBranches.map((b) => b._id);
    const employeeProfiles = await EmployeeProfile.find({
      branchId: { $in: branchIds }
    }).select('userId').lean();

    const executiveUserIds = [
      ...societyEmployees.map((e) => e.userId),
      ...employeeProfiles.map((e) => e.userId)
    ].filter(Boolean);

    const merchantIds = merchantProfiles.map((m) => m._id);
    const merchantUserIds = merchantProfiles.map((m) => m.userId).filter(Boolean);

    const scopeConditions = [directScope];
    
    if (executiveUserIds.length > 0) {
      scopeConditions.push({ createdByExecutiveId: { $in: executiveUserIds } });
    }

    if (merchantIds.length > 0) {
      scopeConditions.push({ merchantId: { $in: merchantIds } });
    }

    if (merchantUserIds.length > 0) {
      scopeConditions.push({ createdByMerchantId: { $in: merchantUserIds } });
    }

    const createdByDetailsCond = { 'createdByDetails.bankId': context.bankId };
    if (branchId) createdByDetailsCond['createdByDetails.branchId'] = branchId;
    scopeConditions.push(createdByDetailsCond);

    return { $or: scopeConditions };
  }

  async hydrate(loans) {
    const customerIds = [...new Set(loans.map((loan) => loan.customerId?._id?.toString() || loan.customerId?.toString()).filter(Boolean))];
    const executiveIds = [
      ...new Set(
        loans
          .flatMap((loan) => [
            loan.createdByExecutiveId?._id?.toString() || loan.createdByExecutiveId?.toString(),
            loan.assignedEmployeeId?._id?.toString() || loan.assignedEmployeeId?.toString(),
            loan.emiSetupByUserId?._id?.toString() || loan.emiSetupByUserId?.toString()
          ])
          .filter(Boolean)
      )
    ];

    const [profiles, employeeProfiles, societyEmployees, users] = await Promise.all([
      CustomerProfile.find({ userId: { $in: customerIds } }).lean(),
      EmployeeProfile.find({ userId: { $in: executiveIds } }).select('userId branchId firstName lastName').lean(),
      SocietyEmployee.find({ userId: { $in: executiveIds } }).select('userId branchId fullName name designation').lean(),
      User.find({ _id: { $in: executiveIds } }).select('_id fullName name email phoneNumber role userType').lean()
    ]);

    const execBranchIdMap = new Map();
    const execNameMap = new Map();

    users.forEach((u) => {
      if (u && u._id) {
        const uId = u._id.toString();
        const name = u.fullName || u.name;
        if (name) execNameMap.set(uId, name);
      }
    });

    employeeProfiles.forEach((ep) => {
      if (ep && ep.userId) {
        const uId = ep.userId.toString();
        const name = `${ep.firstName || ''} ${ep.lastName || ''}`.trim();
        if (name) execNameMap.set(uId, name);
        if (ep.branchId) execBranchIdMap.set(uId, ep.branchId.toString());
      }
    });

    societyEmployees.forEach((se) => {
      if (se && se.userId) {
        const uId = se.userId.toString();
        const name = se.fullName || se.name;
        if (name) execNameMap.set(uId, name);
        if (se.branchId) execBranchIdMap.set(uId, se.branchId.toString());
      }
    });

    const merchantUserIds = [
      ...new Set(
        loans
          .flatMap((loan) => [
            loan.createdByMerchantId?._id?.toString() || loan.createdByMerchantId?.toString(),
            loan.merchantId?._id?.toString() || loan.merchantId?.toString()
          ])
          .filter(Boolean)
      )
    ];

    const merchantProfiles = await MerchantProfile.find({
      $or: [
        { _id: { $in: merchantUserIds } },
        { userId: { $in: merchantUserIds } }
      ]
    }).select('_id userId shopName ownerName fullName branchId').lean();

    const merchantMap = new Map();
    merchantProfiles.forEach((mp) => {
      const name = mp.shopName || mp.ownerName || mp.fullName || 'Merchant';
      if (mp._id) merchantMap.set(mp._id.toString(), { name, branchId: mp.branchId ? mp.branchId.toString() : null });
      if (mp.userId) merchantMap.set(mp.userId.toString(), { name, branchId: mp.branchId ? mp.branchId.toString() : null });
    });

    // Collect all branch IDs (from loan.branchId or executive's/merchant's profile)
    const directBranchIds = loans.map((loan) => loan.branchId?._id?.toString() || loan.branchId?.toString()).filter(Boolean);
    const execBranchIds = Array.from(execBranchIdMap.values());
    const merchantBranchIds = Array.from(merchantMap.values()).map(m => m.branchId).filter(Boolean);
    const allBranchIds = [...new Set([...directBranchIds, ...execBranchIds, ...merchantBranchIds])];

    const branches = await Branch.find({ _id: { $in: allBranchIds } }).select('name code state address').lean();
    const branchMap = new Map(branches.map((branch) => [branch._id.toString(), branch]));

    const profileByUser = new Map(profiles.map((profile) => [profile.userId.toString(), profile]));

    return loans.map((loan) => {
      const user = loan.customerId || {};
      const profile = profileByUser.get(user._id?.toString());
      const customerName = user.fullName || [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || 'N/A';

      const execObj = loan.createdByExecutiveId || loan.assignedEmployeeId || loan.createdByMerchantId;
      const execUserId = execObj?._id?.toString() || execObj?.toString();

      let createdByName = (execObj && typeof execObj === 'object' && (execObj.fullName || execObj.name))
        ? (execObj.fullName || execObj.name)
        : (execUserId ? execNameMap.get(execUserId) : null);

      if (!createdByName && loan.createdByDetails?.shopName) {
        createdByName = `${loan.createdByDetails.shopName} (Merchant)`;
      } else if (!createdByName && loan.createdByDetails?.name) {
        createdByName = loan.createdByDetails.name;
      } else if (!createdByName && execUserId && merchantMap.has(execUserId)) {
        createdByName = `${merchantMap.get(execUserId).name} (Merchant)`;
      }

      if (!createdByName && typeof loan.createdBy === 'string') {
        createdByName = loan.createdBy;
      }
      createdByName = createdByName || 'N/A';

      // Resolve Branch Name, City & State: check loan.branchId first, fallback to executive's or merchant's branch
      const branchObj = loan.branchId && typeof loan.branchId === 'object' ? loan.branchId : (loan.branchId ? branchMap.get(loan.branchId.toString()) : null);
      let branchName = branchObj?.name || 'N/A';

      if ((!branchName || branchName === 'N/A') && execUserId) {
        const resolvedBranchId = execBranchIdMap.get(execUserId) || merchantMap.get(execUserId)?.branchId;
        if (resolvedBranchId) {
          const resolvedBranch = branchMap.get(resolvedBranchId);
          if (resolvedBranch) branchName = resolvedBranch.name;
        }
      }

      branchName = branchName || 'N/A';
      const city = branchObj?.address?.city || branchObj?.city || 'N/A';
      const state = loan.state || branchObj?.address?.state || branchObj?.state || 'N/A';

      return {
        id: loan._id,
        applicationNumber: loan.applicationId,
        customerName,
        profileImage: profile?.avatar || profile?.profileImage || null,
        phoneNumber: user.phoneNumber || '',
        address: profile?.activeAddress?.addressLine || '',
        city,
        state,
        status: loan.status,
        branchName,
        branch: branchName,
        createdBy: createdByName,
        createdByName,
        loanExecutive: {
          id: execUserId || null,
          name: createdByName,
          branchName
        }
      };
    });
  }

  async list(context, query = {}) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;

    const baseScope = await this.buildScope(context, query.branchId, query.branchIds);
    const baseConditions = [baseScope];

    if (query.sourceType && query.sourceType.toUpperCase() !== 'ALL') {
      baseConditions.push({ sourceType: query.sourceType.toUpperCase() });
    }

    if (query.dateFrom || query.dateTo) {
      const dateFilter = {};
      if (query.dateFrom) dateFilter.$gte = new Date(query.dateFrom);
      if (query.dateTo) {
        const endDate = new Date(query.dateTo);
        endDate.setHours(23, 59, 59, 999);
        dateFilter.$lte = endDate;
      }
      baseConditions.push({ createdAt: dateFilter });
    }

    if (query.city || query.state) {
      const branchCond = { bankId: context.bankId, isDeleted: { $ne: true } };
      const branchOrConds = [];

      if (query.state) {
        const sEscaped = query.state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const sRegex = new RegExp(sEscaped, 'i');
        branchOrConds.push({
          $or: [{ state: sRegex }, { 'address.state': sRegex }]
        });
      }

      if (query.city) {
        const cEscaped = query.city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const cRegex = new RegExp(cEscaped, 'i');
        branchOrConds.push({
          $or: [{ city: cRegex }, { 'address.city': cRegex }]
        });
      }

      branchCond.$and = branchOrConds;
      const matchingBranches = await Branch.find(branchCond).select('_id').lean();
      const matchingBranchIds = matchingBranches.map((b) => b._id);

      const locationOrConds = [];
      if (matchingBranchIds.length > 0) {
        locationOrConds.push({ branchId: { $in: matchingBranchIds } });
      }
      if (query.state) {
        const sEscaped = query.state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const sRegex = new RegExp(sEscaped, 'i');
        locationOrConds.push({ state: sRegex });
      }

      if (locationOrConds.length > 0) {
        baseConditions.push({ $or: locationOrConds });
      } else {
        baseConditions.push({ _id: null });
      }
    }

    if (query.search) {
      const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const search = new RegExp(escaped, 'i');
      const [matchingProfiles, matchingUsers] = await Promise.all([
        CustomerProfile.find({
          $or: [{ firstName: search }, { lastName: search }, { 'activeAddress.addressLine': search }]
        }).select('userId').lean(),
        User.find({
          $or: [{ fullName: search }, { phoneNumber: search }]
        }).select('_id').lean()
      ]);
      const matchingCustomerIds = [
        ...matchingProfiles.map((profile) => profile.userId),
        ...matchingUsers.map((user) => user._id)
      ];
      baseConditions.push({
        $or: [
          { applicationId: search },
          { customerId: { $in: matchingCustomerIds } }
        ]
      });
    }

    const baseFilter = baseConditions.length === 1 ? baseConditions[0] : { $and: baseConditions };

    // Compute stats aggregation across base filter (before filtering by status)
    const statsAgg = await Loan.aggregate([
      { $match: { ...baseFilter, isDeleted: { $ne: true } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    let totalCount = 0;
    let newCount = 0;
    let pendingDownPaymentCount = 0;
    let activeCount = 0;
    let completedCount = 0;
    let rejectedCount = 0;

    statsAgg.forEach((group) => {
      const count = group.count || 0;
      totalCount += count;
      const st = (group._id || '').toUpperCase();

      if (st === 'NEW') newCount += count;
      else if (st === 'PENDING_DOWN_PAYMENT') pendingDownPaymentCount += count;
      else if (st === 'ACTIVE') activeCount += count;
      else if (st === 'COMPLETED') completedCount += count;
      else if (st === 'REJECTED') rejectedCount += count;
    });

    const stats = {
      totalLeads: totalCount,
      newLeads: newCount,
      pendingDownPaymentLeads: pendingDownPaymentCount,
      activeLeads: activeCount,
      completedLeads: completedCount,
      rejectedLeads: rejectedCount,
      total: totalCount,
      new: newCount,
      pendingDownPayment: pendingDownPaymentCount,
      active: activeCount,
      completed: completedCount,
      rejected: rejectedCount
    };

    // Apply specific status filter if passed
    const filteredConditions = [...baseConditions];
    if (query.status && query.status.toUpperCase() !== 'ALL' && query.status.toLowerCase() !== 'all leads') {
      filteredConditions.push({ status: query.status.toUpperCase() });
    }

    const filter = filteredConditions.length === 1 ? filteredConditions[0] : { $and: filteredConditions };

    const [loans, totalRecords] = await Promise.all([
      Loan.find(filter)
        .populate('customerId', 'fullName phoneNumber')
        .populate('branchId', 'name code state address')
        .populate('createdByExecutiveId', 'fullName name phoneNumber email')
        .populate('assignedEmployeeId', 'fullName name phoneNumber email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Loan.countDocuments(filter)
    ]);
    const hydrated = await this.hydrate(loans);
    const totalPages = Math.max(1, Math.ceil(totalRecords / limit));
    return {
      stats,
      items: hydrated.map((lead, index) => ({ srNo: skip + index + 1, ...lead })),
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

  async getById(context, id) {
    const scope = await this.buildScope(context);
    const loan = await Loan.findOne({ _id: id, $and: [scope] })
      .populate({
        path: 'customerId',
        populate: { path: 'profileId' }
      })
      .populate({
        path: 'variantId',
        populate: { path: 'productId' }
      })
      .populate('branchId', 'name code')
      .populate('createdByExecutiveId', 'fullName name phoneNumber email')
      .populate('assignedEmployeeId', 'fullName name phoneNumber email')
      .lean();

    if (!loan) throw ApiError.notFound('Lead not found.');

    const hydratedBase = (await this.hydrate([loan]))[0];
    const customerUser = loan.customerId || {};
    const profile = customerUser.profileId || {};
    const variant = loan.variantId || {};
    const product = variant.productId || {};
    const fullName = customerUser.fullName || [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || 'N/A';
    const execObj = loan.createdByExecutiveId || loan.assignedEmployeeId;

    const customerIdVal = customerUser?._id || loan.customerId || null;

    return {
      ...hydratedBase,
      id: loan._id,
      applicationId: loan.applicationId,
      customerId: customerIdVal,
      status: loan.status,
      disbursedAt: loan.disbursedAt,
      customer: {
        id: customerIdVal,
        customerId: customerIdVal,
        fullName,
        phoneNumber: customerUser.phoneNumber || '',
        onboardingSource: profile?.onboardingSource || customerUser?.onboardingSource || 'SELF',
        onboardedBy: profile?.onboardedBy || customerUser?.onboardedBy || null
      },
      createdBy: hydratedBase.createdBy,
      createdByName: hydratedBase.createdByName,
      branchName: hydratedBase.branchName,
      branch: hydratedBase.branch,
      loanExecutive: {
        id: hydratedBase.loanExecutive?.id || null,
        name: hydratedBase.createdByName,
        email: (execObj && typeof execObj === 'object' && execObj.email) || null,
        phoneNumber: (execObj && typeof execObj === 'object' && (execObj.phoneNumber || execObj.phone)) || null,
        branchName: hydratedBase.branchName
      },
      createdByExecutive: {
        id: hydratedBase.loanExecutive?.id || null,
        name: hydratedBase.createdByName,
        email: (execObj && typeof execObj === 'object' && execObj.email) || null,
        phoneNumber: (execObj && typeof execObj === 'object' && (execObj.phoneNumber || execObj.phone)) || null,
        branchName: hydratedBase.branchName
      },
      personalInformation: {
        id: customerIdVal,
        customerId: customerIdVal,
        fullName,
        phoneNumber: customerUser.phoneNumber || '',
        gender: profile?.gender || null,
        dob: profile?.dob || null,
        panNumber: profile?.panNumber || '',
        aadhaarNumber: profile?.aadhaarNumber || '',
        address: profile?.activeAddress?.addressLine || 'N/A'
      },
      documents: {
        panCardUrl: profile?.panImage || null,
        aadhaarCardUrl: profile?.aadhaarImage || null,
        digitalSignatureUrl: loan.digitalSignature || null
      },
      bankInformation: loan.repaymentBankAccount?.accountNumber ? {
        bankName: loan.repaymentBankAccount.bankName,
        accountNumber: loan.repaymentBankAccount.accountNumber,
        ifsc: loan.repaymentBankAccount.ifsc,
        accountHolder: loan.repaymentBankAccount.accountHolder
      } : null,
      loanInformation: {
        productName: product?.name || 'Smart Phone',
        variantName: variant ? `${variant.color || ''} - ${variant.storage || ''}`.trim() : 'N/A',
        productPrice: loan.productPrice || 0,
        downPayment: loan.downPayment || 0,
        downPaymentAmount: loan.downPayment || 0,
        variantImage: variant.image || null,
        tenureMonths: loan.tenureMonths || 0,
        emiAmount: loan.emiAmount || 0,
        totalAmount: loan.totalAmount || 0,
        totalPayableAmount: loan.totalPayableAmount || 0,
        outstandingAmount: loan.outstandingAmount || 0,
        schedule: loan.schedule || []
      }
    };
  }

  async getEligibleSlabs(query = {}) {
    const price = Number(query.productPrice);
    if (!price || isNaN(price)) {
      throw ApiError.badRequest('Product price is required to calculate eligible EMI slabs.');
    }
    const slabs = await EmiSlab.find({ status: 'ACTIVE' }).sort({ tenureMonths: 1 });
    const eligibleSlabs = slabs.filter((slab) => price >= slab.minProductPrice);

    return eligibleSlabs.map((slab) => {
      const baseDownPayment = Math.round((price * 2) / (slab.tenureMonths + 2));
      const loanAmount = price - baseDownPayment;
      const emiAmount = Math.round(loanAmount / slab.tenureMonths);

      return {
        tenureMonths: slab.tenureMonths,
        interestPercentage: slab.interestPercentage,
        minProductPrice: slab.minProductPrice,
        emiAmount,
        amountPerMonth: emiAmount
      };
    });
  }

  async calculateEmi(context, payload) {
    const { productPrice, tenureMonths, purchaseEmiCard, purchaseInsurance, customerId } = payload;

    const emiCardFee = await getSettingValue('EMI_CARD_CHARGES', 499);
    const insuranceFee = await getSettingValue('LOAN_INSURANCE_AMOUNT', 550);

    let cardInfo = null;
    let shouldPurchaseCard = purchaseEmiCard !== undefined ? purchaseEmiCard : true;

    if (customerId) {
      const scope = await this.buildScope(context);
      const draftLoan = await Loan.findOne({ customerId, status: 'NEW', $and: [scope] });
      if (draftLoan) {
        draftLoan.currentStep = 'CALCULATE';
        await draftLoan.save();
      }

      const card = await EmiCard.findOne({ customerId }).populate('bankId');
      if (card) {
        const expired = card.status === 'EXPIRED' || (card.validThru && isCardExpired(card.validThru));
        if (!expired) {
          shouldPurchaseCard = false;
          cardInfo = {
            exists: true,
            expired: false,
            cardNumber: maskCardNumber(card.cardNumber),
            cardHolderName: card.cardHolderName,
            validThru: card.validThru,
            brandLogo: 'https://sahayaone-backend.onrender.com/public/mocks/logo-sahayaone.png',
            bankLogo: card.bankId?.logo || 'https://sahayaone-backend.onrender.com/public/mocks/logo-society.png'
          };
        } else {
          shouldPurchaseCard = true;
          cardInfo = {
            exists: true,
            expired: true,
            cardNumber: maskCardNumber(card.cardNumber),
            cardHolderName: card.cardHolderName,
            validThru: extendValidity(card.validThru, 5),
            brandLogo: 'https://sahayaone-backend.onrender.com/public/mocks/logo-sahayaone.png',
            bankLogo: card.bankId?.logo || 'https://sahayaone-backend.onrender.com/public/mocks/logo-society.png'
          };
        }
      } else {
        shouldPurchaseCard = true;
        cardInfo = { exists: false, expired: false };
      }
    }

    if (shouldPurchaseCard && context?.branchId) {
      const branch = await Branch.findById(context.branchId);
      if (branch && branch.cardStock <= 0) {
        throw ApiError.badRequest('No EMI cards available in branch stock. Please contact branch manager to request card allocation.');
      }
    }

    const emiCardCharges = shouldPurchaseCard ? emiCardFee : 0;
    const insuranceAmount = purchaseInsurance !== false ? insuranceFee : 0;

    const emiAmountBase = productPrice / (tenureMonths + 2);
    const baseDownPayment = Math.round(emiAmountBase * 2);
    const totalLoanAmount = productPrice - baseDownPayment;
    const dbdCharges = Math.round(totalLoanAmount * 0.08);
    const interestAmount = dbdCharges;
    const repaymentMonths = Math.min(tenureMonths, 15);
    const emiAmount = Math.round(totalLoanAmount / repaymentMonths);
    const totalDownPayment = baseDownPayment + emiCardCharges + dbdCharges + insuranceAmount;
    const totalAmount = productPrice + emiCardCharges + dbdCharges + insuranceAmount;

    return {
      productPrice,
      emiCardCharges,
      processingFees: 0,
      totalAmount,
      downPayment: totalDownPayment,
      baseDownPayment,
      dbdCharges,
      dbd: dbdCharges,
      totalLoanAmount,
      interestAmount,
      insuranceAmount,
      totalPayableAmount: totalLoanAmount,
      emiAmount,
      tenureMonths,
      repaymentMonths,
      cardInfo
    };
  }

  async sendDisbursalOtp(context, leadId) {
    const scope = await this.buildScope(context);
    const loan = await Loan.findOne({ _id: leadId, $and: [scope] }).populate('customerId');
    if (!loan) {
      throw ApiError.notFound('Loan application record not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const customerUser = loan.customerId;
    if (!customerUser) {
      throw ApiError.notFound('Customer profile not linked.');
    }

    const isLiveOtp = panelControlConfig.EMPLOYEE_PANEL.OTP === 'LIVE';
    const otp = isLiveOtp ? generateOtp(6, { numericOnly: true }) : '123456';
    customerUser.tempOtp = otp;
    customerUser.tempOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await customerUser.save();

    await smsManager.sendOtp(
      customerUser.phoneNumber,
      otp,
      smsConfig.templates.LOAN_DISBURSAL_OTP.templateId,
      { applicationId: String(loan._id) }
    );

    return {
      success: true,
      message: `Disbursal OTP code sent to customer mobile number ending in ${customerUser.phoneNumber.slice(-4)}.`,
      ...(!isLiveOtp ? { otp } : {})
    };
  }

  async setupEmi(context, leadId, payload, userId) {
    const { productPrice, tenureMonths, purchaseEmiCard, purchaseInsurance, otp, signature } = payload;
    const scope = await this.buildScope(context);

    const lead = await Loan.findOne({ _id: leadId, $and: [scope] }).populate('customerId');
    if (!lead) {
      throw ApiError.notFound('Lead record not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (lead.status !== 'NEW' && lead.status !== 'PENDING_DOWN_PAYMENT') {
      throw ApiError.badRequest('EMI setup parameters can only be configured for NEW or PENDING_DOWN_PAYMENT leads.');
    }

    const customerUser = lead.customerId;
    if (!customerUser) {
      throw ApiError.notFound('Customer record not linked.');
    }

    const isTestMock = otp === '123456' && panelControlConfig.EMPLOYEE_PANEL.OTP === 'TEST';
    const isLiveValid = customerUser.tempOtp && customerUser.tempOtp === otp && customerUser.tempOtpExpires > new Date();

    if (!isTestMock && !isLiveValid) {
      throw ApiError.badRequest('The disbursal verification OTP code is incorrect or expired.', ErrorCode.OTP_INVALID);
    }

    customerUser.tempOtp = null;
    customerUser.tempOtpExpires = null;
    await customerUser.save();

    const signatureFile = parseBase64ToMulterFile(signature, 'digitalSignature', lead.applicationId);
    const signatureUpload = await storageManager.uploadFile(signatureFile, 'loans');
    const signatureUrl = signatureUpload.url;

    const emiCardFee = await getSettingValue('EMI_CARD_CHARGES', 499);
    const insuranceFee = await getSettingValue('LOAN_INSURANCE_AMOUNT', 550);

    let shouldPurchaseCard = purchaseEmiCard !== undefined ? purchaseEmiCard : true;
    let existingCard = await EmiCard.findOne({ customerId: customerUser._id });

    if (existingCard) {
      const expired = existingCard.status === 'EXPIRED' || (existingCard.validThru && isCardExpired(existingCard.validThru));
      shouldPurchaseCard = expired;
    } else {
      shouldPurchaseCard = true;
    }

    const targetBranchId = context.branchId || lead.branchId;
    let branch = targetBranchId ? await Branch.findById(targetBranchId) : null;

    if (shouldPurchaseCard && branch && branch.cardStock <= 0) {
      throw ApiError.badRequest('No EMI cards available in branch stock. Please contact branch manager to request card allocation.');
    }

    if (shouldPurchaseCard) {
      if (existingCard) {
        existingCard.validThru = extendValidity(existingCard.validThru, 5);
        existingCard.status = 'ACTIVE';
        await existingCard.save();
      } else {
        const bank = await Bank.findOne({ status: { $in: ['ACTIVE', 'APPROVED'] } });
        const targetBranch = branch || (await Branch.findOne({ status: 'ACTIVE' }));
        if (bank && targetBranch) {
          const generatedNum = `52461245${Math.floor(10000000 + Math.random() * 90000000)}`;
          await EmiCard.create({
            bankId: targetBranch.bankId || bank._id,
            branchId: targetBranch._id,
            customerId: customerUser._id,
            cardNumber: generatedNum,
            cardHolderName: customerUser.fullName || 'Customer User',
            validThru: extendValidity('08/24', 5),
            cvv: `${Math.floor(100 + Math.random() * 900)}`,
            cardLimit: 100000,
            availableLimit: 100000,
            status: 'ACTIVE',
            allotmentStatus: 'ALLOTTED',
            allottedAt: new Date()
          });
        }
      }

      if (branch) {
        const balanceBefore = branch.availableEmiCards || branch.cardStock || 0;
        branch.cardStock = Math.max(0, branch.cardStock - 1);
        branch.availableEmiCards = Math.max(0, balanceBefore - 1);
        await branch.save();

        await CreditLog.create({
          bankId: branch.bankId,
          branchId: branch._id,
          type: 'EMI_CARD',
          action: 'DEDUCTION',
          amount: 1,
          employeeId: userId,
          customerId: customerUser._id,
          description: `EMI Card stock decremented for customer purchase/renewal: ${customerUser.fullName || 'Customer'}`
        });

        await CardCreditUsage.create({
          bankId: branch.bankId,
          branchId: branch._id,
          loanId: lead._id,
          type: 'EMI_CARD',
          quantity: 1,
          balanceBefore,
          balanceAfter: branch.availableEmiCards,
          createdBy: userId
        });
      }
    }

    const emiCardCharges = shouldPurchaseCard ? emiCardFee : 0;
    const insuranceAmount = purchaseInsurance !== false ? insuranceFee : 0;

    const emiAmountBase = productPrice / (tenureMonths + 2);
    const baseDownPayment = Math.round(emiAmountBase * 2);
    const totalLoanAmount = productPrice - baseDownPayment;
    const dbdCharges = Math.round(totalLoanAmount * 0.08);
    const interestAmount = dbdCharges;
    const repaymentMonths = Math.min(tenureMonths, 15);
    const emiAmount = Math.round(totalLoanAmount / repaymentMonths);
    const totalDownPayment = baseDownPayment + emiCardCharges + dbdCharges + insuranceAmount;
    const totalPayableAmount = totalLoanAmount;

    const schedule = [];
    const baseDate = new Date();
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    for (let i = 0; i < repaymentMonths; i++) {
      const dueDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1 + i, 10);
      schedule.push({
        monthName: monthNames[dueDate.getMonth()],
        amount: emiAmount,
        dueDate,
        status: i === 0 ? 'DUE' : 'UPCOMING'
      });
    }

    lead.productPrice = productPrice;
    lead.emiCardCharges = emiCardCharges;
    lead.processingFees = 0;
    lead.insuranceAmount = insuranceAmount;
    lead.totalAmount = productPrice + emiCardCharges + dbdCharges + insuranceAmount;
    lead.interestAmount = interestAmount;
    lead.dbd = dbdCharges;
    lead.totalPayableAmount = totalPayableAmount;
    lead.totalLoanAmount = totalLoanAmount;
    lead.emiAmount = emiAmount;
    lead.tenureMonths = tenureMonths;
    lead.outstandingAmount = totalPayableAmount;
    lead.downPayment = totalDownPayment;
    lead.disbursedAt = null;
    lead.status = 'PENDING_DOWN_PAYMENT';
    lead.currentStep = 'CHOOSE_PAYMENT';
    lead.schedule = schedule;
    lead.digitalSignature = signatureUrl;
    if (branch && !lead.branchId) lead.branchId = branch._id;

    await lead.save();

    return {
      success: true,
      leadId: lead._id,
      status: 'PENDING_DOWN_PAYMENT',
      currentStep: 'CHOOSE_PAYMENT',
      totalPayableAmount,
      emiAmount,
      digitalSignature: signatureUrl,
      message: 'Loan successfully signed. Repayment down payment is pending.'
    };
  }

  async addBankAccount(context, leadId, payload) {
    const { bankName, accountNumber, ifsc, accountHolder } = payload;
    const scope = await this.buildScope(context);

    const loan = await Loan.findOne({ _id: leadId, $and: [scope] });
    if (!loan) {
      throw ApiError.notFound('Loan book record not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const normalizedBankName = bankName.trim();
    const existingSameBank = await BankAccount.findOne({
      userId: loan.customerId,
      bankName: { $regex: new RegExp('^' + normalizedBankName + '$', 'i') },
      isDeleted: false
    });

    if (existingSameBank && existingSameBank.accountNumber !== accountNumber) {
      throw ApiError.badRequest(`A bank account is already registered for this customer with ${normalizedBankName}. Only one account per bank is allowed.`);
    }

    let bankAccount = await BankAccount.findOne({
      userId: loan.customerId,
      accountNumber,
      isDeleted: false
    });

    if (!bankAccount) {
      bankAccount = await BankAccount.create({
        userId: loan.customerId,
        bankName: normalizedBankName,
        accountNumber,
        ifsc: ifsc.toUpperCase(),
        accountHolder,
        isPrimary: true
      });
    }

    loan.repaymentBankAccount = {
      bankName: normalizedBankName,
      accountNumber,
      ifsc: ifsc.toUpperCase(),
      accountHolder
    };
    loan.currentStep = 'BANK_ACCOUNT';
    await loan.save();

    const profile = await CustomerProfile.findOne({ userId: loan.customerId });
    if (profile) {
      const existingProfileBank = profile.bankDetails?.find((b) => b.bankName.toLowerCase() === normalizedBankName.toLowerCase());
      if (existingProfileBank) {
        if (existingProfileBank.accountNumber !== accountNumber) {
          throw ApiError.badRequest(`A bank account is already registered for this customer with ${normalizedBankName}. Only one account per bank is allowed.`);
        }
        existingProfileBank.accountNumber = accountNumber;
        existingProfileBank.ifscCode = ifsc.toUpperCase();
        existingProfileBank.isPrimary = true;
      } else {
        profile.bankDetails = profile.bankDetails || [];
        profile.bankDetails.push({
          bankName: normalizedBankName,
          accountNumber,
          ifscCode: ifsc.toUpperCase(),
          isPrimary: true
        });
      }
      await profile.save();
    }

    return {
      success: true,
      loanId: loan._id,
      bankAccount: {
        id: bankAccount._id,
        bankName,
        accountNumber,
        ifsc: ifsc.toUpperCase(),
        accountHolder
      },
      message: 'Repayment bank account successfully registered and linked to loan.'
    };
  }

  async initiateDownPayment(context, leadId, paymentMethod, userId) {
    const scope = await this.buildScope(context);
    const loan = await Loan.findOne({ _id: leadId, $and: [scope] }).populate('customerId');

    if (!loan) {
      throw ApiError.notFound('Loan book record not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (loan.status !== 'PENDING_DOWN_PAYMENT') {
      throw ApiError.badRequest(`Down payment can only be initiated for loans in PENDING_DOWN_PAYMENT state. Current status is ${loan.status}.`);
    }

    const customerUser = loan.customerId;
    if (!customerUser) {
      throw ApiError.notFound('Customer user profile not linked.');
    }

    loan.paymentMethod = paymentMethod;
    loan.paymentStatus = 'PENDING';
    loan.paymentTransactionId = `txn_dp_${Math.floor(10000000 + Math.random() * 90000000)}`;
    await loan.save();

    if (paymentMethod === 'CASH') {
      const otp = generateOtp();
      customerUser.tempDownPaymentOtp = otp;
      customerUser.tempDownPaymentOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
      await customerUser.save();

      await smsManager.sendOtp(
        customerUser.phoneNumber,
        otp,
        smsConfig.templates.DOWN_PAYMENT_OTP.templateId,
        { loanId: String(loan._id), amount: String(loan.downPayment) }
      );

      return {
        success: true,
        paymentMethod: 'CASH',
        otpSent: true,
        ...(envConfig.nodeEnv === 'development' ? { otp } : {}),
        message: `Cash down payment confirmation OTP code sent to customer mobile number ending in ${customerUser.phoneNumber.slice(-4)}.`
      };
    }

    const upiUrl = `upi://pay?pa=sahayaonepay@ybl&pn=Sahayaone&am=${loan.downPayment}&tr=${loan.paymentTransactionId}&cu=INR`;
    return {
      success: true,
      paymentMethod,
      transactionId: loan.paymentTransactionId,
      amount: loan.downPayment,
      ...(paymentMethod === 'UPI' ? { qrCodeUrl: upiUrl } : {}),
      message: `Down payment of ₹${loan.downPayment} initiated via ${paymentMethod}.`
    };
  }

  async verifyDownPayment(context, leadId, payload) {
    const { otp, paymentStatus = 'SUCCESS' } = payload;
    const scope = await this.buildScope(context);
    const loan = await Loan.findOne({ _id: leadId, $and: [scope] }).populate('customerId');

    if (!loan) {
      throw ApiError.notFound('Loan book record not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (loan.status !== 'PENDING_DOWN_PAYMENT') {
      throw ApiError.badRequest('Down payment verification is only valid for loans in PENDING_DOWN_PAYMENT state.');
    }

    const customerUser = loan.customerId;
    if (!customerUser) {
      throw ApiError.notFound('Customer user profile not linked.');
    }

    if (loan.paymentMethod === 'CASH') {
      const isTestMock = otp === '123456' && panelControlConfig.EMPLOYEE_PANEL.OTP === 'TEST';
      const isLiveValid = customerUser.tempDownPaymentOtp && customerUser.tempDownPaymentOtp === otp && customerUser.tempDownPaymentOtpExpires > new Date();

      if (!isTestMock && !isLiveValid) {
        throw ApiError.badRequest('The cash down payment confirmation OTP code is incorrect or expired.', ErrorCode.OTP_INVALID);
      }

      customerUser.tempDownPaymentOtp = null;
      customerUser.tempDownPaymentOtpExpires = null;
      await customerUser.save();
    }

    const userId = context.userId || context.user?.id || context.id || null;
    let disburserDetails = null;
    if (userId) {
      const disburserUser = await User.findById(userId);
      const disburserProfile = (await SocietyEmployee.findOne({ userId })) || (await EmployeeProfile.findOne({ userId }));
      disburserDetails = {
        id: disburserProfile?._id || userId,
        userId,
        name: disburserProfile?.fullName || (disburserProfile?.firstName ? `${disburserProfile.firstName || ''} ${disburserProfile.lastName || ''}`.trim() : (disburserUser?.fullName || 'Society Officer')),
        phone: disburserProfile?.phoneNumber || disburserUser?.phoneNumber || '',
        email: disburserProfile?.email || disburserUser?.email || '',
        role: disburserUser?.role || 'SOCIETY',
        type: 'SOCIETY'
      };
    }

    loan.paymentStatus = paymentStatus;
    loan.status = 'ACTIVE';
    loan.disbursedAt = new Date();
    loan.disbursedBy = userId;
    loan.disbursedByUserId = userId;
    loan.disbursedByDetails = disburserDetails;
    loan.downPaymentPaidAt = new Date();
    loan.downPaymentVerifiedByUserId = userId;
    loan.currentStep = 'COMPLETED';
    await loan.save();

    return {
      success: true,
      leadId: loan._id,
      status: 'ACTIVE',
      disbursedAt: loan.disbursedAt,
      disbursedBy: disburserDetails,
      message: 'Down payment successfully verified. Loan application activated and disbursed.'
    };
  }

  async getAgreement(context, leadId) {
    const scope = await this.buildScope(context);
    const loan = await Loan.findOne({ _id: leadId, $and: [scope] });
    if (!loan) throw ApiError.notFound('Loan record not found.');
    return {
      success: true,
      url: 'https://sahayaone-backend.onrender.com/public/mocks/loan-agreement.pdf',
      message: 'Loan agreement document url retrieved.'
    };
  }

  async getAccountForm(context, leadId) {
    const scope = await this.buildScope(context);
    const loan = await Loan.findOne({ _id: leadId, $and: [scope] });
    if (!loan) throw ApiError.notFound('Loan record not found.');
    return {
      success: true,
      url: 'https://sahayaone-backend.onrender.com/public/mocks/repayment-form.pdf',
      message: 'Repayment account form document url retrieved.'
    };
  }

  async getMembershipForm(context, leadId) {
    const scope = await this.buildScope(context);
    const loan = await Loan.findOne({ _id: leadId, $and: [scope] });
    if (!loan) throw ApiError.notFound('Loan record not found.');
    return {
      success: true,
      url: 'https://sahayaone-backend.onrender.com/public/mocks/membership-form.pdf',
      message: 'Cooperative society membership form document url retrieved.'
    };
  }

  async getLocations(context) {
    if (!context?.bankId) {
      throw ApiError.forbidden('A valid society bank context is required.');
    }

    const branches = await Branch.find({
      bankId: context.bankId,
      isDeleted: { $ne: true }
    })
      .select('state address.city address.state')
      .lean();

    const loans = await Loan.find({
      assignedBankId: context.bankId,
      isDeleted: { $ne: true }
    })
      .select('state')
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

    loans.forEach((l) => {
      if (l.state && String(l.state).trim()) {
        statesSet.add(String(l.state).trim());
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

  async remove(context, id, userId) {
    const scope = await this.buildScope(context);
    const loan = await Loan.findOne({ _id: id, $and: [scope] });
    if (!loan) throw ApiError.notFound('Lead not found.');
    loan.isDeleted = true;
    loan.deletedAt = new Date();
    loan.deletedBy = userId;
    await loan.save();
    return { id: loan._id };
  }

  async exportCsv(context, query = {}) {
    const result = await this.list(context, { ...query, page: 1, limit: 100 });
    const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Sr.No.', 'Application Number', 'Customer Name', 'Phone Number', 'Address', 'City', 'State', 'Branch', 'Created By', 'Status'],
      ...result.items.map((lead) => [
        lead.srNo,
        lead.applicationNumber,
        lead.customerName,
        lead.phoneNumber,
        lead.address,
        lead.city,
        lead.state,
        lead.branchName,
        lead.createdBy,
        lead.status
      ])
    ];
    return rows.map((row) => row.map(escape).join(',')).join('\n');
  }
}

export const societyLeadService = new SocietyLeadService();
