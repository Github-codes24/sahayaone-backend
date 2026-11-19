import mongoose from 'mongoose';
import { Loan } from '../../../../models/loan.model.js';
import { User } from '../../../../models/user.model.js';
import { Transaction } from '../../../../models/transaction.model.js';
import { CustomerProfile } from '../../../../models/customer-profile.model.js';
import { Bank } from '../../../../models/bank.model.js';
import { BankAccount } from '../../../../models/bank-account.model.js';
import { EmiSlab } from '../../../../models/emi-slab.model.js';
import { EmiCard } from '../../../../models/emi-card.model.js';
import { Setting } from '../../../../models/setting.model.js';
import { PriceSetting } from '../../../../models/price-setting.model.js';
import { Branch } from '../../../../models/branch.model.js';
import { EmployeeProfile } from '../../../../models/employee-profile.model.js';
import { BranchManager } from '../../../../models/branch-manager.model.js';
import { SocietyEmployee } from '../../../../models/society-employee.model.js';
import { CreditLog } from '../../../../models/credit-log.model.js';
import { CardCreditUsage } from '../../../../models/card-credit-usage.model.js';
import { CashCollection } from '../../../../models/cash-collection.model.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';
import { UserRole } from '../../../../constants/user-role.constant.js';
import { logger } from '../../../../utils/logger.util.js';
import { easebuzzHelper } from '../../../../utils/easebuzz.helper.js';
import { envConfig } from '../../../../config/env.config.js';
import { smsManager } from '../../../../sms/sms.manager.js';
import { paginationUtil } from '../../../../utils/pagination.util.js';
import { smsConfig } from '../../../../config/sms.config.js';
import { generateOtp } from '../../../../utils/otp.util.js';
import { storageManager } from '../../../../storage/storage.manager.js';
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

export const isCardExpired = (validThru) => {
  if (!validThru) return true;
  const parts = validThru.split('/');
  if (parts.length !== 2) return true;
  const month = parseInt(parts[0], 10);
  const year = parseInt("20" + parts[1], 10);
  const now = new Date();
  const expiry = new Date(year, month - 1, 28);
  return now > expiry;
};

export const extendValidity = (validThru, years) => {
  if (!validThru) return "12/31";
  const parts = validThru.split('/');
  if (parts.length !== 2) return "12/31";
  const month = parts[0];
  const year = parseInt(parts[1], 10) + years;
  return `${month}/${year}`;
};

export const maskCardNumber = (cardNumber) => {
  if (!cardNumber) return "";
  const cleaned = cardNumber.replace(/\s+/g, '');
  if (cleaned.length < 6) return cardNumber;
  const visible = cleaned.slice(-6);
  const masked = 'X'.repeat(cleaned.length - 6);
  const combined = masked + visible;
  return combined.replace(/(.{4})/g, '$1 ').trim();
};

export class EmployeeLoansService {
  /**
   * Dynamically resolves tenant and access scope for any authenticated user
   * (Bank Owner, Society Admin, Branch Manager, Society Employee, Loan Executive, Super Admin)
   */
  async buildUserLoanScope(userId) {
    if (!userId) return {};
    const user = await User.findById(userId).lean();
    if (!user) throw ApiError.unauthorized('User identity not found.');

    const role = (user.role || '').toUpperCase();
    const isBankOwner = [UserRole.BANK_OWNER, UserRole.SOCIETY_ADMIN, UserRole.VENDOR, UserRole.SUPER_ADMIN].includes(role);
    const isBranchManager = role === UserRole.BRANCH_MANAGER;

    if (role === UserRole.SUPER_ADMIN) {
      return {};
    }

    if (isBankOwner) {
      const bank = await Bank.findOne({
        $or: [{ userId }, { email: user.email?.toLowerCase() }],
        isDeleted: { $ne: true }
      }).lean();

      if (bank) {
        return { assignedBankId: bank._id };
      }
    }

    if (isBranchManager) {
      const manager = await BranchManager.findOne({ userId, isDeleted: { $ne: true } }).lean();
      if (manager) {
        return { assignedBankId: manager.bankId, branchId: manager.branchId };
      }
    }

    const [employeeProfile, societyEmployee] = await Promise.all([
      EmployeeProfile.findOne({ userId }).lean(),
      SocietyEmployee.findOne({ userId, isDeleted: { $ne: true } }).lean()
    ]);

    let branchId = employeeProfile?.branchId || societyEmployee?.branchId || null;
    let bankId = societyEmployee?.bankId || null;

    if (branchId && !bankId) {
      const branch = await Branch.findById(branchId).lean();
      if (branch) bankId = branch.bankId;
    }

    const conditions = [{ createdByExecutiveId: userId }];

    if (bankId) {
      const scope = { assignedBankId: bankId };
      if (branchId) scope.branchId = branchId;
      conditions.push(scope);
    }

    return conditions.length === 1 ? conditions[0] : { $or: conditions };
  }

  /**
   * Retrieves EMI slabs available for a specific product price threshold
   */
  async getEligibleSlabs(productPrice, options = {}) {
    return this.calculateEmiSlabs(productPrice, options);
  }

  /**
   * Lists active, completed, or rejected loan books accessible by the user
   */
  async listLoans(userId, filters = {}) {
    const { status, search, page = 1, limit = 20 } = filters;
    const scope = await this.buildUserLoanScope(userId);

    const queryFilter = { ...scope };

    if (status) {
      const upperStatus = status.trim().toUpperCase();
      if (upperStatus !== 'ALL' && upperStatus !== 'ALL LOANS') {
        queryFilter.status = upperStatus;
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const skipCount = (pageNum - 1) * limitNum;

    const totalCount = await Loan.countDocuments(queryFilter);
    const pagination = paginationUtil.getPaginationMeta(totalCount, pageNum, limitNum);

    let loans = await Loan.find(queryFilter)
      .populate({
        path: 'customerId',
        populate: { path: 'profileId' }
      })
      .populate({
        path: 'variantId',
        populate: { path: 'productId' }
      })
      .sort({ updatedAt: -1 })
      .skip(skipCount)
      .limit(limitNum);

    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      loans = loans.filter(loan => {
        const profile = loan.customerId?.profileId;
        const nameMatch = profile ? `${profile.firstName} ${profile.lastName}`.match(searchRegex) : false;
        const phoneMatch = loan.customerId?.phoneNumber?.match(searchRegex);
        const appMatch = loan.applicationId?.match(searchRegex);
        return nameMatch || phoneMatch || appMatch;
      });
    }

    const items = loans.map(loan => {
      const profile = loan.customerId?.profileId;
      const product = loan.variantId?.productId;

      let age = null;
      if (profile?.dob) {
        const ageDiff = Date.now() - new Date(profile.dob).getTime();
        age = Math.abs(new Date(ageDiff).getUTCFullYear() - 1970);
      }

      return {
        id: loan._id,
        applicationId: loan.applicationId,
        status: loan.status,
        disbursedAt: loan.disbursedAt,
        customer: {
          id: loan.customerId?._id,
          customerId: loan.customerId?._id,
          fullName: profile ? `${profile.firstName} ${profile.lastName}` : (loan.customerId?.fullName || 'N/A'),
          phoneNumber: loan.customerId?.phoneNumber,
          age,
          address: profile?.activeAddress?.addressLine || 'N/A',
          onboardingSource: profile?.onboardingSource || loan.customerId?.onboardingSource || 'SELF',
          onboardedBy: profile?.onboardedBy || loan.customerId?.onboardedBy || null
        },
        product: {
          name: product?.name || 'Smart Phone',
          variant: loan.variantId ? `${loan.variantId.color} - ${loan.variantId.storage}` : 'N/A',
          price: loan.productPrice,
          image: loan.variantId?.image || null
        },
        emiAmount: loan.emiAmount,
        outstandingAmount: loan.outstandingAmount,
        totalPayableAmount: loan.totalPayableAmount,
        sourceType: loan.sourceType || 'EXECUTIVE',
        createdBy: loan.createdByDetails || loan.createdByExecutiveId || null,
        disbursedBy: loan.disbursedByDetails || loan.disbursedBy || null,
        createdAt: loan.createdAt
      };
    });

    return {
      items,
      loans: items,
      data: items,
      pagination,
      meta: pagination
    };
  }

  /**
   * Fetches full loan detail breakdown
   */
  async getLoanDetails(loanId, userId) {
    const scope = await this.buildUserLoanScope(userId);
    const isObjectId = mongoose.Types.ObjectId.isValid(loanId);

    const identifierQuery = isObjectId
      ? { $or: [{ _id: loanId }, { customerId: loanId }, { applicationId: loanId }] }
      : { applicationId: loanId };

    let loan = await Loan.findOne({
      $and: [
        identifierQuery,
        scope
      ]
    })
      .populate({
        path: 'customerId',
        populate: { path: 'profileId' }
      })
      .populate({
        path: 'variantId',
        populate: { path: 'productId' }
      });

    if (!loan) {
      loan = await Loan.findOne(identifierQuery)
        .populate({
          path: 'customerId',
          populate: { path: 'profileId' }
        })
        .populate({
          path: 'variantId',
          populate: { path: 'productId' }
        });
    }

    if (!loan) {
      throw ApiError.notFound('Loan book record not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    let profile = loan.customerId?.profileId;
    if (!profile || typeof profile === 'string' || profile instanceof mongoose.Types.ObjectId || !profile.firstName) {
      if (loan.customerId?._id) {
        profile = await CustomerProfile.findOne({ userId: loan.customerId._id });
        if (profile) {
          await User.updateOne(
            { _id: loan.customerId._id, profileModel: { $ne: 'CustomerProfile' } },
            { $set: { profileId: profile._id, profileModel: 'CustomerProfile' } }
          );
        }
      }
    }
    const product = loan.variantId?.productId;

    // Fetch existing primary bank account if none linked to this specific loan yet
    let bankInfo = null;
    if (loan.repaymentBankAccount?.accountNumber) {
      bankInfo = {
        bankName: loan.repaymentBankAccount.bankName,
        accountNumber: loan.repaymentBankAccount.accountNumber,
        ifsc: loan.repaymentBankAccount.ifsc,
        accountHolder: loan.repaymentBankAccount.accountHolder
      };
    } else if (loan.customerId) {
      const primaryBank = await BankAccount.findOne({ userId: loan.customerId._id, isPrimary: true, isDeleted: false });
      if (primaryBank) {
        bankInfo = {
          bankName: primaryBank.bankName,
          accountNumber: primaryBank.accountNumber,
          ifsc: primaryBank.ifsc,
          accountHolder: primaryBank.accountHolder
        };
      }
    }

    // Fetch existing EMI card details
    let cardInfo = { exists: false, expired: false };
    if (loan.customerId) {
      const card = await EmiCard.findOne({ customerId: loan.customerId._id }).populate('bankId');
      if (card) {
        const isExpired = card.status === 'EXPIRED' || (card.validThru && isCardExpired(card.validThru));
        cardInfo = {
          exists: true,
          expired: isExpired,
          cardNumber: maskCardNumber(card.cardNumber),
          cardHolderName: card.cardHolderName,
          validThru: card.validThru,
          brandLogo: "https://sahayaone-backend.onrender.com/public/mocks/logo-sahayaone.png",
          bankLogo: card.bankId?.logo || "https://sahayaone-backend.onrender.com/public/mocks/logo-society.png"
        };
      }
    }

    // Fetch all existing non-deleted bank accounts for this customer
    const existingBankAccounts = loan.customerId
      ? await BankAccount.find({ userId: loan.customerId._id, isDeleted: false }).sort({ createdAt: -1 })
      : [];

    const customerIdVal = loan.customerId?._id || loan.customerId || null;

    return {
      id: loan._id,
      applicationId: loan.applicationId,
      customerId: customerIdVal,
      status: loan.status,
      disbursedAt: loan.disbursedAt,
      customer: {
        id: customerIdVal,
        customerId: customerIdVal,
        fullName: profile ? `${profile.firstName} ${profile.lastName}` : (loan.customerId?.fullName || 'N/A'),
        phoneNumber: loan.customerId?.phoneNumber || 'N/A',
        onboardingSource: profile?.onboardingSource || loan.customerId?.onboardingSource || 'SELF',
        onboardedBy: profile?.onboardedBy || loan.customerId?.onboardedBy || null
      },
      personalInformation: {
        id: customerIdVal,
        customerId: customerIdVal,
        fullName: profile ? `${profile.firstName} ${profile.lastName}` : (loan.customerId?.fullName || 'N/A'),
        phoneNumber: loan.customerId?.phoneNumber || 'N/A',
        gender: profile?.gender,
        dob: profile?.dob,
        panNumber: profile?.panNumber,
        aadhaarNumber: profile?.aadhaarNumber,
        address: profile?.activeAddress?.addressLine || 'N/A',
        onboardingSource: profile?.onboardingSource || loan.customerId?.onboardingSource || 'SELF',
        onboardedBy: profile?.onboardedBy || loan.customerId?.onboardedBy || null
      },
      documents: {
        panCardUrl: profile?.panImage,
        aadhaarCardUrl: profile?.aadhaarImage,
        digitalSignatureUrl: loan.digitalSignature
      },
      bankInformation: bankInfo,
      existingBankAccounts: existingBankAccounts.map(b => ({
        id: b._id,
        bankName: b.bankName,
        accountNumber: b.accountNumber,
        ifsc: b.ifsc,
        accountHolder: b.accountHolder,
        isPrimary: b.isPrimary
      })),
      loanInformation: {
        productName: product?.name || 'Smart Phone',
        variantName: loan.variantId ? `${loan.variantId.color} - ${loan.variantId.storage}` : 'N/A',
        productPrice: loan.productPrice,
        downPayment: loan.downPayment || 0,
        downPaymentAmount: loan.downPayment || 0,
        tenureMonths: loan.tenureMonths,
        emiAmount: loan.emiAmount,
        totalAmount: loan.totalAmount,
        totalPayableAmount: loan.totalPayableAmount,
        outstandingAmount: loan.outstandingAmount,
        schedule: loan.schedule,
        cardInfo
      },
      sourceType: loan.sourceType || 'EXECUTIVE',
      createdBy: loan.createdByDetails || loan.createdByExecutiveId || null,
      disbursedBy: loan.disbursedByDetails || loan.disbursedBy || null
    };
  }

  async calculateLoan(payload, userId) {
    const { productPrice, tenureMonths, purchaseEmiCard, purchaseInsurance, customerId } = payload;

    const emiCardFee = await getSettingValue('EMI_CARD_CHARGES', 499);
    const insuranceFee = await getSettingValue('LOAN_INSURANCE_AMOUNT', 550);

    let cardInfo = { exists: false, expired: false };
    let shouldPurchaseCard = purchaseEmiCard !== undefined ? purchaseEmiCard : true;
    let draftBranchId = null;

    if (customerId) {
      const draftLoan = await Loan.findOne({ customerId, status: 'NEW' });
      if (draftLoan) {
        draftLoan.currentStep = 'CALCULATE';
        draftBranchId = draftLoan.branchId;
        await draftLoan.save();
      }

      const card = await EmiCard.findOne({ customerId }).populate('bankId');
      if (card) {
        const isExpired = card.status === 'EXPIRED' || (card.validThru && isCardExpired(card.validThru));
        
        if (!isExpired) {
          shouldPurchaseCard = false;
          cardInfo = {
            exists: true,
            expired: false,
            cardNumber: maskCardNumber(card.cardNumber),
            cardHolderName: card.cardHolderName,
            validThru: card.validThru,
            brandLogo: "https://sahayaone-backend.onrender.com/public/mocks/logo-sahayaone.png",
            bankLogo: card.bankId?.logo || "https://sahayaone-backend.onrender.com/public/mocks/logo-society.png"
          };
        } else {
          shouldPurchaseCard = true;
          cardInfo = {
            exists: true,
            expired: true,
            cardNumber: maskCardNumber(card.cardNumber),
            cardHolderName: card.cardHolderName,
            validThru: extendValidity(card.validThru, 5),
            brandLogo: "https://sahayaone-backend.onrender.com/public/mocks/logo-sahayaone.png",
            bankLogo: card.bankId?.logo || "https://sahayaone-backend.onrender.com/public/mocks/logo-society.png"
          };
        }
      } else {
        shouldPurchaseCard = true;
        cardInfo = {
          exists: false,
          expired: false
        };
      }
    }

    // Branch card stock check if new card is being purchased or expired card is being renewed
    if (shouldPurchaseCard && userId) {
      const employeeProfile = await EmployeeProfile.findOne({ userId });
      const societyEmployee = await SocietyEmployee.findOne({ userId });
      const manager = await BranchManager.findOne({ userId });
      const branchId = draftBranchId || employeeProfile?.branchId || societyEmployee?.branchId || manager?.branchId;

      if (branchId) {
        const branch = await Branch.findById(branchId);
        if (branch && branch.cardStock <= 0) {
          throw ApiError.badRequest('No EMI cards available in branch stock. Please contact your branch manager to request card allocation.');
        }
      }
    }

    const emiCardCharges = shouldPurchaseCard ? emiCardFee : 0;
    const insuranceAmount = purchaseInsurance === true ? insuranceFee : 0;
    const membershipFee = 110;

    // Total factor map for scheme (e.g. 6m -> 8, 9m -> 11, 12m -> 14, 15m -> 17, 18m -> 20, 24m -> 26)
    const factorMap = { 3: 5, 6: 8, 9: 11, 12: 14, 15: 17, 18: 20, 24: 26 };
    const totalFactor = factorMap[tenureMonths] || (tenureMonths + 2);

    // 1. Calculate Base EMI Amount
    const emiAmountBase = productPrice / totalFactor;
    
    // 2. Base Down Payment (2 advance EMIs)
    const baseDownPayment = Math.round(emiAmountBase * 2);
    
    // 3. Net Product Principal
    const netProductPrincipal = productPrice - baseDownPayment;
    
    // 4. DBD (Dealer Buy Down) - 8% of Net Product Principal as per reference calculation table
    const dbdCharges = Math.round(netProductPrincipal * 0.08);
    const interestAmount = dbdCharges;

    // 5. Total Loan Amount (Insurance Amount is added to Loan Amount instead of Down Payment)
    const totalLoanAmount = netProductPrincipal + insuranceAmount;

    // 6. Repayment Months (Capped at 15 max)
    const repaymentMonths = Math.min(tenureMonths, 15);
    
    // 7. EMI Per Month (Calculated on totalLoanAmount including insurance)
    const emiAmount = Math.round(totalLoanAmount / repaymentMonths);

    // 8. Total Down Payment (includes membershipFee 110; insurance is NO LONGER in down payment)
    const totalDownPayment = baseDownPayment + emiCardCharges + dbdCharges + membershipFee;

    // Total cost/value includes basic price + emiCard + DBD + insurance + membershipFee
    const totalAmount = productPrice + emiCardCharges + dbdCharges + insuranceAmount + membershipFee;

    return {
      productPrice,
      emiCardCharges,
      membershipFee,
      interestPercentage: 8,
      processingFees: 0,
      totalAmount,
      downPayment: totalDownPayment, // customer's total upfront down payment
      baseDownPayment,               // advance 2 EMIs component
      dbdCharges,                    // Dealer Buy Down amount
      dbd: dbdCharges,
      totalLoanAmount,               // loan principal (includes insuranceAmount)
      interestAmount,                // interest (mapped to DBD)
      insuranceAmount,
      totalPayableAmount: totalLoanAmount,
      emiAmount,                     // monthly EMI payment
      monthlyEmi: emiAmount,
      tenureMonths,
      repaymentMonths,               // actual monthly payments count (max 15)
      cardInfo,
      emiDateOption: "2nd or 5th"
    };
  }

  /**
   * Helper method to generate month-wise EMI Slabs matching exact reference table
   */
  async calculateEmiSlabs(productPrice, options = {}) {
    const { shouldPurchaseCard = true, purchaseInsurance = false } = options;
    const emiCardFee = await getSettingValue('EMI_CARD_CHARGES', 499);
    const insuranceFee = await getSettingValue('LOAN_INSURANCE_AMOUNT', 550);
    const membershipFee = 110;

    const emiCardCharges = shouldPurchaseCard ? emiCardFee : 0;
    const insuranceAmount = purchaseInsurance === true ? insuranceFee : 0;

    const slabsConfig = [
      { tenureMonths: 6, scheme: '8/6', totalFactor: 8, minProductPrice: 0 },
      { tenureMonths: 9, scheme: '11/9', totalFactor: 11, minProductPrice: 25001 },
      { tenureMonths: 12, scheme: '14/12', totalFactor: 14, minProductPrice: 50001 },
      { tenureMonths: 15, scheme: '17/15', totalFactor: 17, minProductPrice: 75001 },
      { tenureMonths: 18, scheme: '20/18', totalFactor: 20, minProductPrice: 100001 },
      { tenureMonths: 24, scheme: '26/24', totalFactor: 26, minProductPrice: 130001 }
    ];

    const price = Number(productPrice);

    // Filter slabs where productPrice is greater than or equal to minimum product price requirement
    const eligibleSlabs = slabsConfig.filter(slab => price >= slab.minProductPrice);

    return eligibleSlabs.map(slab => {
      const { tenureMonths, totalFactor, minProductPrice } = slab;

      const emiAmountBase = price / totalFactor;
      const baseDownPayment = Math.round(emiAmountBase * 2);
      const netProductPrincipal = price - baseDownPayment;
      const dbdCharges = Math.round(netProductPrincipal * 0.08);
      const totalLoanAmount = netProductPrincipal + insuranceAmount;
      const repaymentMonths = Math.min(tenureMonths, 15);
      const emiAmount = Math.round(totalLoanAmount / repaymentMonths);
      const totalDownPayment = baseDownPayment + emiCardCharges + dbdCharges + membershipFee;

      return {
        tenureMonths,
        interestPercentage: 8,
        minProductPrice,
        emiAmount,
        amountPerMonth: emiAmount,
        totalDownPayment
      };
    });
  }

  /**
   * Sends OTP for loan disbursal authorization
   */
  async sendDisbursalOtp(loanId, userId) {
    const scope = await this.buildUserLoanScope(userId);
    const loan = await Loan.findOne({ _id: loanId, $and: [scope] }).populate('customerId');
    if (!loan) {
      throw ApiError.notFound('Loan application not found.', ErrorCode.RESOURCE_NOT_FOUND);
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

  /**
   * Disburses the EMI setup structure for a lead after signature and OTP check
   */
  async setupEmi(leadId, payload, userId) {
    const { 
      productPrice, 
      tenureMonths, 
      purchaseEmiCard, 
      purchaseInsurance, 
      otp,
      signature
    } = payload;

    const scope = await this.buildUserLoanScope(userId);
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

    // 1. Verify Disbursal OTP code
    const isTestMock = otp === '123456' && panelControlConfig.EMPLOYEE_PANEL.OTP === 'TEST';
    const isLiveValid = customerUser.tempOtp && customerUser.tempOtp === otp && customerUser.tempOtpExpires > new Date();

    if (!isTestMock && !isLiveValid) {
      throw ApiError.badRequest('The disbursal verification OTP code is incorrect or expired.', ErrorCode.OTP_INVALID);
    }

    // Clear temp OTP on success
    customerUser.tempOtp = null;
    customerUser.tempOtpExpires = null;
    await customerUser.save();

    // 2. Upload digital signature base64 image
    const signatureFile = parseBase64ToMulterFile(signature, 'digitalSignature', lead.applicationId);
    const signatureUpload = await storageManager.uploadFile(signatureFile, 'loans');
    const signatureUrl = signatureUpload.url;

    // 3. Calculation matrices
    const emiCardFee = await getSettingValue('EMI_CARD_CHARGES', 499);
    const insuranceFee = await getSettingValue('LOAN_INSURANCE_AMOUNT', 550);

    let shouldPurchaseCard = purchaseEmiCard !== undefined ? purchaseEmiCard : true;
    let existingCard = await EmiCard.findOne({ customerId: customerUser._id });
    let branch = null;

    if (existingCard) {
      const isExpired = existingCard.status === 'EXPIRED' || (existingCard.validThru && isCardExpired(existingCard.validThru));
      if (!isExpired) {
        shouldPurchaseCard = false;
      } else {
        shouldPurchaseCard = true;
      }
    } else {
      shouldPurchaseCard = true;
    }

    const employeeProfile = userId ? await EmployeeProfile.findOne({ userId }) : null;
    const societyEmployee = userId ? await SocietyEmployee.findOne({ userId }) : null;
    const manager = userId ? await BranchManager.findOne({ userId }) : null;

    // Branch card stock check if new card is being purchased or expired card is being renewed
    if (shouldPurchaseCard && userId) {
      const branchId = lead.branchId || employeeProfile?.branchId || societyEmployee?.branchId || manager?.branchId;

      if (branchId) {
        branch = await Branch.findById(branchId);
        if (branch && branch.cardStock <= 0) {
          throw ApiError.badRequest('No EMI cards available in branch stock. Please contact your branch manager to request card allocation.');
        }
      }
    }

    // Apply Card updates in database
    if (shouldPurchaseCard) {
      const customerProfile = await CustomerProfile.findOne({ userId: customerUser._id });
      const cardHolderName = (customerUser.fullName && customerUser.fullName.trim()) 
        || (customerProfile ? `${customerProfile.firstName} ${customerProfile.lastName}`.trim() : 'Customer User');

      const isRenewal = Boolean(existingCard);

      if (existingCard) {
        const previousValidThru = existingCard.validThru;
        const newValidThru = extendValidity(previousValidThru, 1);

        const renewalEntry = {
          renewedAt: new Date(),
          previousValidThru,
          newValidThru,
          renewedByUserId: userId,
          loanId: lead._id,
          branchId: branch?._id || lead.branchId || existingCard.branchId,
          bankId: branch?.bankId || lead.assignedBankId || existingCard.bankId,
          fee: emiCardFee
        };

        if (!existingCard.renewalHistory) {
          existingCard.renewalHistory = [];
        }
        existingCard.renewalHistory.push(renewalEntry);

        // Renew card validity by 1 year and activate
        existingCard.validThru = newValidThru;
        existingCard.cardHolderName = cardHolderName;
        existingCard.status = 'ACTIVE';
        await existingCard.save();
      } else {
        // Create new card for new user
        const targetBranchId = lead.branchId || branch?._id || employeeProfile?.branchId || societyEmployee?.branchId || manager?.branchId;
        const targetBranch = targetBranchId ? await Branch.findById(targetBranchId) : await Branch.findOne({ status: 'ACTIVE' });
        
        let targetBankId = lead.assignedBankId;
        if (!targetBankId && targetBranch) {
          targetBankId = targetBranch.bankId;
        }
        if (!targetBankId) {
          const activeBank = await Bank.findOne({ status: { $in: ['ACTIVE', 'APPROVED'] } });
          targetBankId = activeBank?._id;
        }

        const now = new Date();
        const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
        const currentYearShort = String(now.getFullYear()).slice(-2);
        const formattedCurrent = `${currentMonth}/${currentYearShort}`;
        const initialValidThru = extendValidity(formattedCurrent, 1);

        const generatedNum = `52461245${Math.floor(10000000 + Math.random() * 90000000)}`;
        await EmiCard.create({
          bankId: targetBankId,
          branchId: targetBranch?._id || null,
          customerId: customerUser._id,
          cardNumber: generatedNum,
          cardHolderName,
          validThru: initialValidThru,
          cvv: `${Math.floor(100 + Math.random() * 900)}`,
          cardLimit: 100000,
          availableLimit: 100000,
          status: 'ACTIVE',
          allotmentStatus: 'ALLOTTED',
          allottedAt: new Date()
        });
      }

      // Decrement stock from the branch
      if (branch) {
        const balanceBefore = branch.availableEmiCards || branch.cardStock || 0;
        branch.cardStock = Math.max(0, branch.cardStock - 1);
        branch.availableEmiCards = Math.max(0, balanceBefore - 1);
        await branch.save();

        // Audit log the card deduction in CreditLog
        const logDescription = isRenewal
          ? `EMI Card renewal (${existingCard?.validThru}): Stock decremented for customer ${cardHolderName}`
          : `New EMI Card issued: Stock decremented for customer ${cardHolderName}`;

        await CreditLog.create({
          bankId: branch.bankId,
          branchId: branch._id,
          type: 'EMI_CARD',
          action: 'DEDUCTION',
          amount: 1,
          employeeId: userId,
          customerId: customerUser._id,
          description: logDescription
        });

        // Log credit usage in CardCreditUsage with purpose
        await CardCreditUsage.create({
          bankId: branch.bankId,
          branchId: branch._id,
          loanId: lead._id,
          type: 'EMI_CARD',
          purpose: isRenewal ? 'RENEWAL' : 'NEW_PURCHASE',
          quantity: 1,
          balanceBefore,
          balanceAfter: branch.availableEmiCards,
          createdBy: userId
        });
      }
    }

    const emiCardCharges = shouldPurchaseCard ? emiCardFee : 0;
    const insuranceAmount = purchaseInsurance === true ? insuranceFee : 0;

    // 1. Calculate Base EMI Amount
    const emiAmountBase = productPrice / (tenureMonths + 2);
    
    // 2. Base Down Payment (2 advance EMIs)
    const baseDownPayment = Math.round(emiAmountBase * 2);
    
    // 3. Net Product Principal
    const netProductPrincipal = productPrice - baseDownPayment;
    
    // 4. DBD (Dealer Buy Down) - 8% of Net Product Principal
    const dbdCharges = Math.round(netProductPrincipal * 0.08);
    const interestAmount = dbdCharges;

    // 5. Total Loan Amount (Insurance Amount added to Loan Amount)
    const totalLoanAmount = netProductPrincipal + insuranceAmount;

    // 6. Repayment Months (Capped at 15)
    const repaymentMonths = Math.min(tenureMonths, 15);
    
    // 7. EMI Per Month
    const emiAmount = Math.round(totalLoanAmount / repaymentMonths);

    // 8. Total Down Payment (Insurance no longer in Down Payment)
    const totalDownPayment = baseDownPayment + emiCardCharges + dbdCharges;
    const totalPayableAmount = totalLoanAmount;

    // 4. Generate sliding installment calendar dates
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

    // 5. Commit state changes
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
    lead.emiSetupByUserId = userId;
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

  /**
   * Links customer repayment bank account and maps it to the active Loan
   */
  async addBankAccount(loanId, payload, userId) {
    const { bankAccountId, bankName, accountNumber, ifsc, accountHolder } = payload;
    const scope = await this.buildUserLoanScope(userId);

    const loan = await Loan.findOne({ _id: loanId, $and: [scope] });
    if (!loan) {
      throw ApiError.notFound('Loan book record not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    let bankAccount;

    if (bankAccountId) {
      // Flow 1: Proceed with existing bank account by ID
      bankAccount = await BankAccount.findOne({
        _id: bankAccountId,
        userId: loan.customerId,
        isDeleted: false
      });
      if (!bankAccount) {
        throw ApiError.notFound('Selected bank account not found or unauthorized for this customer.', ErrorCode.RESOURCE_NOT_FOUND);
      }

      bankAccount.isPrimary = true;
      await bankAccount.save();
    } else {
      // Flow 2: Add a new bank account
      // Enforce the 3-bank-accounts limit constraint
      const existingAccountsCount = await BankAccount.countDocuments({
        userId: loan.customerId,
        isDeleted: false
      });
      if (existingAccountsCount >= 3) {
        throw ApiError.badRequest('A customer cannot have more than 3 bank accounts registered.', ErrorCode.VALIDATION_ERROR);
      }

      const normalizedBankName = bankName.trim();

      // Enforce "one bank one user" validation constraint
      const existingSameBank = await BankAccount.findOne({
        userId: loan.customerId,
        bankName: { $regex: new RegExp('^' + normalizedBankName + '$', 'i') },
        isDeleted: false
      });

      if (existingSameBank) {
        if (existingSameBank.accountNumber !== accountNumber) {
          throw ApiError.badRequest(`A bank account is already registered for this customer with ${normalizedBankName}. Only one account per bank is allowed.`);
        }
      }

      bankAccount = await BankAccount.findOne({
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
      } else {
        bankAccount.isPrimary = true;
        await bankAccount.save();
      }
    }

    // Set other bank accounts of this user to isPrimary: false
    await BankAccount.updateMany(
      { userId: loan.customerId, _id: { $ne: bankAccount._id } },
      { $set: { isPrimary: false } }
    );

    // Map repayment details to Loan
    loan.repaymentBankAccount = {
      bankName: bankAccount.bankName,
      accountNumber: bankAccount.accountNumber,
      ifsc: bankAccount.ifsc,
      accountHolder: bankAccount.accountHolder
    };
    loan.currentStep = 'BANK_ACCOUNT';
    await loan.save();

    // Update embedded customer profile array preventing duplicates and validating constraints
    const profile = await CustomerProfile.findOne({ userId: loan.customerId });
    if (profile) {
      profile.bankDetails.forEach(b => {
        b.isPrimary = false;
      });

      const existingProfileBank = profile.bankDetails.find(b => 
        b.bankName.toLowerCase() === bankAccount.bankName.toLowerCase()
      );

      if (existingProfileBank) {
        existingProfileBank.accountNumber = bankAccount.accountNumber;
        existingProfileBank.ifscCode = bankAccount.ifsc;
        existingProfileBank.isPrimary = true;
      } else {
        profile.bankDetails.push({
          bankName: bankAccount.bankName,
          accountNumber: bankAccount.accountNumber,
          ifscCode: bankAccount.ifsc,
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
        bankName: bankAccount.bankName,
        accountNumber: bankAccount.accountNumber,
        ifsc: bankAccount.ifsc,
        accountHolder: bankAccount.accountHolder
      },
      message: 'Repayment bank account successfully registered and linked to loan.'
    };
  }

  /**
   * PDF Document Downloader mock helpers
   */
  async getAgreement(loanId, userId) {
    if (userId) {
      const scope = await this.buildUserLoanScope(userId);
      const loan = await Loan.findOne({ _id: loanId, $and: [scope] });
      if (!loan) {
        throw ApiError.notFound('Loan book record not found.', ErrorCode.RESOURCE_NOT_FOUND);
      }
    }
    return {
      success: true,
      url: 'https://sahayaone-backend.onrender.com/public/mocks/loan-agreement.pdf',
      message: 'Loan agreement document url retrieved.'
    };
  }

  async getAccountForm(loanId, userId) {
    if (userId) {
      const scope = await this.buildUserLoanScope(userId);
      const loan = await Loan.findOne({ _id: loanId, $and: [scope] });
      if (!loan) {
        throw ApiError.notFound('Loan book record not found.', ErrorCode.RESOURCE_NOT_FOUND);
      }
    }
    return {
      success: true,
      url: 'https://sahayaone-backend.onrender.com/public/mocks/repayment-form.pdf',
      message: 'Repayment account form document url retrieved.'
    };
  }

  async getMembershipForm(loanId, userId) {
    if (userId) {
      const scope = await this.buildUserLoanScope(userId);
      const loan = await Loan.findOne({ _id: loanId, $and: [scope] });
      if (!loan) {
        throw ApiError.notFound('Loan book record not found.', ErrorCode.RESOURCE_NOT_FOUND);
      }
    }
    return {
      success: true,
      url: 'https://sahayaone-backend.onrender.com/public/mocks/membership-form.pdf',
      message: 'Cooperative society membership form document url retrieved.'
    };
  }

  /**
   * Initiates down payment collection for a loan in PENDING_DOWN_PAYMENT status
   */
  async initiateDownPayment(loanId, paymentMethod, userId) {
    const scope = await this.buildUserLoanScope(userId);
    const loan = await Loan.findOne({ _id: loanId, $and: [scope] }).populate('customerId');
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
      // Generate OTP and store in User model
      const otp = generateOtp();
      customerUser.tempDownPaymentOtp = otp;
      customerUser.tempDownPaymentOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
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

    // Dynamic QR generation logic for online payment gateways (e.g. UPI QR payload supporting > 1 Lakh)
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

  /**
   * Verifies payment status and completes loan activation disbursal
   */
  async verifyDownPayment(loanId, payload, userId) {
    const { otp, paymentStatus = 'SUCCESS' } = payload;

    const scope = await this.buildUserLoanScope(userId);
    const loan = await Loan.findOne({ _id: loanId, $and: [scope] }).populate('customerId');
    if (!loan) {
      throw ApiError.notFound('Loan book record not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (loan.status !== 'PENDING_DOWN_PAYMENT') {
      throw ApiError.badRequest(`Down payment verification is only valid for loans in PENDING_DOWN_PAYMENT state.`);
    }

    const customerUser = loan.customerId;
    if (!customerUser) {
      throw ApiError.notFound('Customer user profile not linked.');
    }

    // 1. Verify Cash OTP code if method is CASH
    if (loan.paymentMethod === 'CASH') {
      const isTestMock = otp === '123456' && panelControlConfig.EMPLOYEE_PANEL.OTP === 'TEST';
      const isLiveValid = customerUser.tempDownPaymentOtp && customerUser.tempDownPaymentOtp === otp && customerUser.tempDownPaymentOtpExpires > new Date();

      if (!isTestMock && !isLiveValid) {
        throw ApiError.badRequest('The cash down payment confirmation OTP code is incorrect or expired.', ErrorCode.OTP_INVALID);
      }

      // Clear OTP details upon success
      customerUser.tempDownPaymentOtp = null;
      customerUser.tempDownPaymentOtpExpires = null;
      await customerUser.save();
    } else {
      // 2. Validate Mock online payment gateways state query
      if (paymentStatus === 'FAILED') {
        loan.paymentStatus = 'FAILED';
        await loan.save();
        throw ApiError.badRequest('The down payment gateway transaction failed. Please try again.');
      }

      if (paymentStatus === 'PENDING') {
        return {
          success: true,
          status: 'PENDING_DOWN_PAYMENT',
          paymentStatus: 'PENDING',
          message: 'The transaction is still pending processing. Verify status again shortly.'
        };
      }
    }

    // 3. Mark Loan as ACTIVE (Disbursed) upon successful payment confirmation
    const disburserUser = await User.findById(userId);
    const disburserProfile = await EmployeeProfile.findOne({ userId }) || await SocietyEmployee.findOne({ userId });
    const disburserDetails = {
      id: disburserProfile?._id || userId,
      userId,
      name: disburserProfile?.fullName || (disburserProfile?.firstName ? `${disburserProfile.firstName || ''} ${disburserProfile.lastName || ''}`.trim() : (disburserUser?.fullName || 'Loan Executive')),
      phone: disburserProfile?.phoneNumber || disburserUser?.phoneNumber || '',
      email: disburserProfile?.email || disburserUser?.email || '',
      role: disburserUser?.role || 'LOAN_EXECUTIVE',
      type: 'EXECUTIVE'
    };

    loan.status = 'ACTIVE';
    loan.currentStep = 'COMPLETED';
    loan.paymentStatus = 'SUCCESS';
    loan.downPaymentPaidAt = new Date();
    loan.downPaymentVerifiedByUserId = userId;
    loan.disbursedAt = new Date();
    loan.disbursedBy = userId;
    loan.disbursedByUserId = userId;
    loan.disbursedByDetails = disburserDetails;

    if (loan.schedule && loan.schedule.length > 0) {
      loan.schedule[0].status = 'DUE';
    }

    await loan.save();

    // 4. Record Cash Collection entry for executive cash accounting if payment method is CASH
    if (loan.paymentMethod === 'CASH' && loan.downPayment > 0) {
      try {
        await CashCollection.create({
          employeeId: userId,
          bankId: loan.bankId || disburserProfile?.bankId || null,
          branchId: loan.branchId || disburserProfile?.branchId || null,
          loanId: loan._id,
          amountCollected: loan.downPayment,
          collectionType: 'DOWN_PAYMENT',
          description: `Down payment cash collection for loan ${loan.applicationId || loan._id}`,
          collectionDate: new Date(),
          createdBy: userId
        });
        logger.info(`CASH COLLECTION RECORDED: ₹${loan.downPayment} collected by executive ${userId} for loan ${loan._id}`);
      } catch (cashErr) {
        logger.error(`CASH COLLECTION LOG ERROR: ${cashErr.message}`);
      }
    }

    return {
      success: true,
      status: 'ACTIVE',
      currentStep: 'COMPLETED',
      disbursedAt: loan.disbursedAt,
      disbursedBy: disburserDetails,
      paymentMethod: loan.paymentMethod,
      message: 'Down payment successfully verified. Loan is now ACTIVE and disbursed.'
    };
  }

  /**
   * Retrieves decorated EMI schedule details for the collection UI screen
   */
  async getEmiCollectionSchedule(loanId, userId) {
    const scope = await this.buildUserLoanScope(userId);
    const loan = await Loan.findOne({ _id: loanId, $and: [scope] });
    if (!loan) {
      throw ApiError.notFound('Loan record not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    // Sort the schedule by due date
    const sortedSchedule = [...loan.schedule].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    // Fetch active pending online/cash payments initiated within the last 15 minutes to lock them
    const lockExpiryTime = new Date(Date.now() - 15 * 60 * 1000);
    const activePendingTxns = await Transaction.find({
      loanId,
      status: 'PENDING',
      createdAt: { $gte: lockExpiryTime }
    });

    const lockedInstallments = new Set();
    activePendingTxns.forEach(tx => {
      tx.installmentIds.forEach(id => lockedInstallments.add(id.toString()));
    });

    const decoratedSchedule = sortedSchedule.map((inst, index) => {
      const dueDate = new Date(inst.dueDate);
      const year = dueDate.getFullYear();
      const month = String(dueDate.getMonth() + 1).padStart(2, '0');
      
      const isPaid = inst.status === 'PAID';
      const isLocked = lockedInstallments.has(inst._id.toString());
      const isOverdue = !isPaid && !isLocked && new Date() > dueDate;
      
      // Grace period window (2nd to 5th of that month)
      const graceStart = `02/${month}/${year}`;
      const graceEnd = `05/${month}/${year}`;
      
      let displayStatus = inst.status; // PAID, DUE, UPCOMING
      if (isLocked) {
        displayStatus = 'PROCESSING';
      } else if (isOverdue) {
        displayStatus = 'OVERDUE';
      }

      // Checkability helper: Unpaid item is checkable if it is the first unpaid, OR all prior unpaid items are selected.
      // This helps the UI dynamically validate check eligibility sequentially.
      let isCheckable = !isPaid && !isLocked;
      if (isCheckable) {
        for (let i = 0; i < index; i++) {
          if (sortedSchedule[i].status !== 'PAID' && !lockedInstallments.has(sortedSchedule[i]._id.toString())) {
            // There is a prior unpaid, unlocked item.
            // In the UI sequential selection, this item becomes checkable only when the prior items are checked.
            isCheckable = true; // Can be toggled sequentially
          }
        }
      }

      return {
        id: inst._id,
        monthName: inst.monthName,
        amount: inst.amount,
        dueDate: inst.dueDate,
        dueDateFormatted: dueDate.toLocaleDateString('en-GB'),
        graceWindow: `${graceStart} - ${graceEnd}`,
        status: displayStatus,
        isPaid,
        isDisabled: isPaid || isLocked, // disabled if already paid or processing
        isCheckable,
        isOverdue
      };
    });

    return {
      success: true,
      loanId: loan._id,
      applicationId: loan.applicationId,
      outstandingAmount: loan.outstandingAmount,
      emiAmount: loan.emiAmount,
      schedule: decoratedSchedule
    };
  }

  /**
   * Initiates EMI collection for selected installments
   */
  async initiateEmiCollection(loanId, installmentIds, paymentMethod, userId) {
    const scope = await this.buildUserLoanScope(userId);
    const lead = await Loan.findOne({ _id: loanId, $and: [scope] }).populate('customerId');
    if (!lead) {
      throw ApiError.notFound('Loan record not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (lead.status !== 'ACTIVE') {
      throw ApiError.badRequest('EMI collections are only supported for ACTIVE loans.');
    }

    // 1. Check double payment / processing lock
    const lockExpiryTime = new Date(Date.now() - 15 * 60 * 1000);
    const activePendingTxns = await Transaction.find({
      loanId,
      status: 'PENDING',
      createdAt: { $gte: lockExpiryTime }
    });

    const lockedIds = new Set(activePendingTxns.flatMap(tx => tx.installmentIds.map(id => id.toString())));
    for (const id of installmentIds) {
      if (lockedIds.has(id.toString())) {
        throw ApiError.badRequest('One or more selected installments are currently processing payment. Please wait 15 minutes and try again.', ErrorCode.BAD_REQUEST);
      }
    }

    // 2. Sequence validation: Must pay the oldest unpaid installments first
    const sortedSchedule = [...lead.schedule].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    const firstUnpaidIdx = sortedSchedule.findIndex(inst => inst.status !== 'PAID');
    
    if (firstUnpaidIdx !== -1) {
      let maxSelectedIdx = -1;
      installmentIds.forEach(id => {
        const idx = sortedSchedule.findIndex(inst => inst._id.toString() === id.toString());
        if (idx > maxSelectedIdx) {
          maxSelectedIdx = idx;
        }
      });
      
      for (let i = firstUnpaidIdx; i <= maxSelectedIdx; i++) {
        const inst = sortedSchedule[i];
        if (inst.status !== 'PAID' && !installmentIds.includes(inst._id.toString())) {
          throw ApiError.badRequest(`Sequence error: You cannot skip unpaid installments. You must pay the oldest unpaid EMI (${inst.monthName} due on ${new Date(inst.dueDate).toLocaleDateString()}) first.`, ErrorCode.BAD_REQUEST);
        }
      }
    }

    // 3. Calculate total amount
    let totalAmount = 0;
    const selectedMonths = [];
    lead.schedule.forEach(inst => {
      if (installmentIds.includes(inst._id.toString())) {
        if (inst.status === 'PAID') {
          throw ApiError.badRequest(`Installment for ${inst.monthName} is already PAID.`);
        }
        totalAmount += inst.amount;
        selectedMonths.push(inst.monthName);
      }
    });

    if (totalAmount === 0) {
      throw ApiError.badRequest('No valid installments selected for collection.');
    }

    const customerUser = lead.customerId;
    if (!customerUser) {
      throw ApiError.notFound('Customer user profile not linked.');
    }

    // Grace period calculations (Repayment window between 2nd and 5th of every month)
    const today = new Date();
    const currentDay = today.getDate();
    const isWithinGraceWindow = currentDay >= 2 && currentDay <= 5;
    const gracePeriodStatus = isWithinGraceWindow ? 'WITHIN_GRACE_PERIOD' : 'OUTSIDE_GRACE_PERIOD';
    const gracePeriodMessage = isWithinGraceWindow 
      ? 'Payment is within the regular monthly 2nd-5th grace window.' 
      : 'Payment is outside the regular monthly 2nd-5th grace window. Late charges may apply.';

    const transactionId = `txn_emi_${Math.floor(10000000 + Math.random() * 90000000)}`;

    if (paymentMethod === 'CASH') {
      const isLiveOtp = panelControlConfig.EMPLOYEE_PANEL.OTP === 'LIVE';
      const otp = isLiveOtp ? generateOtp(6, { numericOnly: true }) : '123456';
      
      // Save Transaction Entry
      await Transaction.create({
        loanId: lead._id,
        installmentIds,
        paymentMethod: 'CASH',
        amount: totalAmount,
        transactionId,
        status: 'PENDING',
        type: 'EMI_COLLECTION',
        otp,
        otpExpires: new Date(Date.now() + 10 * 60 * 1000),
        createdByUserId: userId
      });

      await smsManager.sendOtp(
        customerUser.phoneNumber,
        otp,
        smsConfig.templates.GENERAL_ALERT.templateId,
        { amount: String(totalAmount), date: new Date().toLocaleDateString('en-IN'), loanId: String(loan._id) }
      );

      return {
        success: true,
        paymentMethod: 'CASH',
        otpSent: true,
        amount: totalAmount,
        transactionId,
        gracePeriod: {
          window: '2nd to 5th of every month',
          status: gracePeriodStatus,
          message: gracePeriodMessage
        },
        message: `Cash collection initiated. Verification OTP code sent to customer mobile ending in ${customerUser.phoneNumber.slice(-4)}.`,
        ...(!isLiveOtp ? { otp } : {})
      };
    }

    // Online Payments (e.g. UPI)
    await Transaction.create({
      loanId: lead._id,
      installmentIds,
      paymentMethod,
      amount: totalAmount,
      transactionId,
      status: 'PENDING',
      type: 'EMI_COLLECTION',
      createdByUserId: userId
    });

    const upiUrl = `upi://pay?pa=sahayaone@icici&pn=SahayaoneFinance&am=${totalAmount}&tr=${transactionId}&cu=INR`;

    return {
      success: true,
      paymentMethod,
      transactionId,
      amount: totalAmount,
      upiDeepLink: paymentMethod === 'UPI' ? upiUrl : null,
      qrCodeUrl: paymentMethod === 'UPI' ? upiUrl : null,
      checkoutUrl: `https://sahayaone-backend.onrender.com/api/v1/employee/loans/${loanId}/collect-emi/checkout?amount=${totalAmount}&tx=${transactionId}`,
      gracePeriod: {
        window: '2nd to 5th of every month',
        status: gracePeriodStatus,
        message: gracePeriodMessage
      },
      message: `EMI collection of ₹${totalAmount} initiated successfully via ${paymentMethod}.`
    };
  }

  /**
   * Verifies and completes selected EMI installments payment collection
   */
  async verifyEmiCollection(loanId, installmentIds, paymentMethod, payload, userId) {
    const { otp, paymentStatus } = payload;
    
    const scope = await this.buildUserLoanScope(userId);
    const lead = await Loan.findOne({ _id: loanId, $and: [scope] }).populate('customerId');
    if (!lead) {
      throw ApiError.notFound('Loan record not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (lead.status !== 'ACTIVE') {
      throw ApiError.badRequest('EMI collections are only supported for ACTIVE loans.');
    }

    const customerUser = lead.customerId;
    if (!customerUser) {
      throw ApiError.notFound('Customer user profile not linked.');
    }

    // 1. Retrieve the pending Transaction
    const transaction = await Transaction.findOne({
      loanId: lead._id,
      paymentMethod,
      status: 'PENDING'
    });

    if (!transaction) {
      throw ApiError.notFound('No pending payment transaction found for this collection request.');
    }

    if (paymentMethod === 'CASH') {
      const isTestMock = otp === '123456' && panelControlConfig.EMPLOYEE_PANEL.OTP === 'TEST';
      const isLiveValid = transaction.otp && transaction.otp === otp && transaction.otpExpires > new Date();

      if (!isTestMock && !isLiveValid) {
        throw ApiError.badRequest('Invalid or expired confirmation OTP code.', ErrorCode.OTP_INVALID);
      }

      transaction.status = 'SUCCESS';
      transaction.verifiedByUserId = userId;
      await transaction.save();
    } else {
      if (paymentStatus === 'SUCCESS') {
        transaction.status = 'SUCCESS';
        transaction.verifiedByUserId = userId;
        await transaction.save();
      } else {
        transaction.status = 'FAILED';
        transaction.verifiedByUserId = userId;
        await transaction.save();
        throw ApiError.badRequest('Payment verification failed or pending.');
      }
    }

    // 2. Perform sequence validation
    const sortedSchedule = [...lead.schedule].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    const firstUnpaidIdx = sortedSchedule.findIndex(inst => inst.status !== 'PAID');
    
    if (firstUnpaidIdx !== -1) {
      let maxSelectedIdx = -1;
      installmentIds.forEach(id => {
        const idx = sortedSchedule.findIndex(inst => inst._id.toString() === id.toString());
        if (idx > maxSelectedIdx) {
          maxSelectedIdx = idx;
        }
      });
      
      for (let i = firstUnpaidIdx; i <= maxSelectedIdx; i++) {
        const inst = sortedSchedule[i];
        if (inst.status !== 'PAID' && !installmentIds.includes(inst._id.toString())) {
          throw ApiError.badRequest(`Sequence error: You cannot skip unpaid installments. You must pay the oldest unpaid EMI (${inst.monthName} due on ${new Date(inst.dueDate).toLocaleDateString()}) first.`, ErrorCode.BAD_REQUEST);
        }
      }
    }

    // 3. Mark installments as PAID
    let collectedAmount = 0;
    let matchCount = 0;
    const paidMonths = [];

    lead.schedule.forEach(inst => {
      if (installmentIds.includes(inst._id.toString()) && inst.status !== 'PAID') {
        inst.status = 'PAID';
        inst.paidAt = new Date();
        collectedAmount += inst.amount;
        matchCount++;
        paidMonths.push(inst.monthName);
      }
    });

    if (matchCount === 0) {
      throw ApiError.badRequest('None of the selected installments were valid for collection.');
    }

    lead.paidEmisCount += matchCount;
    lead.outstandingAmount = Math.max(0, lead.outstandingAmount - collectedAmount);

    const allPaid = lead.schedule.every(inst => inst.status === 'PAID');
    if (allPaid) {
      lead.status = 'COMPLETED';
    }

    await lead.save();

    // Send confirmation SMS
    const confirmMsg = `Payment of ₹${collectedAmount} for Sahayaone EMI Month(s): ${paidMonths.join(', ')} successful. Your remaining outstanding balance is ₹${lead.outstandingAmount}.`;
    await smsManager.sendSms(customerUser.phoneNumber, confirmMsg);

    return {
      success: true,
      leadId: lead._id,
      status: lead.status,
      collectedAmount,
      outstandingAmount: lead.outstandingAmount,
      message: allPaid ? 'All installments collected. Loan status changed to COMPLETED.' : 'Selected installments successfully collected.'
    };
  }

  /**
   * Universal Webhook handler to settle online EMI payments
   */
  async handlePaymentWebhook(headers, body) {
    let transactionId = null;
    let paymentSuccess = false;
    let rawStatus = null;

    // Detect if Easebuzz
    const isEasebuzz = body.txnid && body.status && body.hash;
    
    // Detect if Razorpay
    const isRazorpay = body.event && body.payload?.payment?.entity;

    if (isEasebuzz) {
      const isValidSignature = easebuzzHelper.verifyResponseHash(body);
      if (!isValidSignature) {
        logger.error('PAYMENT WEBHOOK: Invalid Easebuzz signature hash.');
        return { success: false, message: 'Invalid signature hash.' };
      }
      transactionId = body.txnid;
      paymentSuccess = (body.status || '').toLowerCase() === 'success';
      rawStatus = body.status;
    } else if (isRazorpay) {
      const paymentEntity = body.payload.payment.entity;
      transactionId = paymentEntity.notes?.transactionId || paymentEntity.receipt;
      paymentSuccess = body.event === 'payment.captured';
      rawStatus = body.event;
    } else {
      // Direct mock/manual simulation support
      transactionId = body.transactionId;
      paymentSuccess = body.status === 'SUCCESS';
      rawStatus = body.status;
    }

    if (!transactionId) {
      return { success: false, message: 'Webhook payload missing transaction ID.' };
    }

    const transaction = await Transaction.findOne({ transactionId, status: 'PENDING' });
    if (!transaction) {
      return { success: false, message: 'Transaction record not found or already processed.' };
    }

    const lead = await Loan.findById(transaction.loanId).populate('customerId');
    if (!lead) {
      return { success: false, message: 'Linked loan account not found.' };
    }

    if (paymentSuccess) {
      transaction.status = 'SUCCESS';
      await transaction.save();

      let collectedAmount = 0;
      let matchCount = 0;
      const paidMonths = [];

      lead.schedule.forEach(inst => {
        if (transaction.installmentIds.map(id => id.toString()).includes(inst._id.toString()) && inst.status !== 'PAID') {
          inst.status = 'PAID';
          inst.paidAt = new Date();
          collectedAmount += inst.amount;
          matchCount++;
          paidMonths.push(inst.monthName);
        }
      });

      lead.paidEmisCount += matchCount;
      lead.outstandingAmount = Math.max(0, lead.outstandingAmount - collectedAmount);

      const allPaid = lead.schedule.every(inst => inst.status === 'PAID');
      if (allPaid) {
        lead.status = 'COMPLETED';
      }

      await lead.save();

      // Send SMS
      if (lead.customerId?.phoneNumber) {
        const confirmMsg = `Payment of ₹${collectedAmount} for Sahayaone EMI Month(s): ${paidMonths.join(', ')} successful. Your remaining outstanding balance is ₹${lead.outstandingAmount}.`;
        await smsManager.sendSms(lead.customerId.phoneNumber, confirmMsg);
      }

      return { success: true, message: 'Payment successfully processed and settled via webhook.' };
    } else {
      transaction.status = 'FAILED';
      await transaction.save();
      return { success: true, message: `Payment reported as failed (${rawStatus}). Transaction log updated.` };
    }
  }

  /**
   * Retrieves registered EMI card details for a specific loan customer
   */
  async getEmiCardDetails(loanId, userId) {
    const scope = await this.buildUserLoanScope(userId);
    const loan = await Loan.findOne({ _id: loanId, $and: [scope] });
    if (!loan) {
      throw ApiError.notFound('Loan book record not found.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const card = await EmiCard.findOne({ customerId: loan.customerId })
      .populate('bankId', 'name logo')
      .populate('renewalHistory.renewedByUserId', 'fullName email phoneNumber')
      .populate('renewalHistory.branchId', 'name code');

    if (!card) {
      throw ApiError.notFound('No EMI card registered for this customer.', ErrorCode.RESOURCE_NOT_FOUND);
    }

    const isExpired = card.status === 'EXPIRED' || (card.validThru && isCardExpired(card.validThru));

    return {
      success: true,
      cardId: card._id,
      cardNumber: card.cardNumber,
      cardNumberFormatted: maskCardNumber(card.cardNumber),
      cardHolderName: card.cardHolderName,
      validThru: card.validThru,
      cvv: card.cvv,
      status: card.status,
      isExpired,
      cardLimit: card.cardLimit,
      availableLimit: card.availableLimit,
      allottedAt: card.allottedAt,
      renewalHistory: (card.renewalHistory || []).map(r => ({
        renewedAt: r.renewedAt,
        previousValidThru: r.previousValidThru,
        newValidThru: r.newValidThru,
        fee: r.fee,
        renewedBy: r.renewedByUserId ? {
          id: r.renewedByUserId._id,
          fullName: r.renewedByUserId.fullName
        } : null,
        branch: r.branchId ? {
          id: r.branchId._id,
          name: r.branchId.name,
          code: r.branchId.code
        } : null
      })),
      bank: card.bankId ? {
        id: card.bankId._id,
        name: card.bankId.name,
        logo: card.bankId.logo
      } : null
    };
  }
}

export const employeeLoansService = new EmployeeLoansService();
