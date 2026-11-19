import mongoose from 'mongoose';
import { User } from '../../../../models/user.model.js';
import { CustomerProfile } from '../../../../models/customer-profile.model.js';
import { SocietyCustomerLink } from '../../../../models/society-customer-link.model.js';
import { MerchantProfile } from '../../../../models/merchant-profile.model.js';
import { PigmyCustomer } from '../../../../models/pigmy-customer.model.js';
import { Loan } from '../../../../models/loan.model.js';
import { Branch } from '../../../../models/branch.model.js';
import { Bank } from '../../../../models/bank.model.js';
import { CreditLog } from '../../../../models/credit-log.model.js';
import { CardCreditUsage } from '../../../../models/card-credit-usage.model.js';
import { BankAccount } from '../../../../models/bank-account.model.js';
import { EmiCard } from '../../../../models/emi-card.model.js';
import { Banner } from '../../../../models/banner.model.js';
import { ApiError } from '../../../../common/api.error.js';

const KYC_VALIDITY_DAYS = 30;
const KYC_VALIDITY_MS = KYC_VALIDITY_DAYS * 24 * 60 * 60 * 1000;

export class OnboardingEngineService {
  /**
   * Pre-onboarding customer lookup by phone number
   * Auto-fills global profile details, society bank account, KYC status, and checks product limits.
   */
  static async lookupCustomerByPhone({ phoneNumber, bankId, branchId, productType }) {
    if (!phoneNumber) {
      throw ApiError.badRequest('Customer phone number is required for lookup.');
    }

    const cleanPhone = String(phoneNumber).trim();

    // 1. Find global user
    const user = await User.findOne({ phoneNumber: cleanPhone, isDeleted: { $ne: true } }).lean();

    if (!user) {
      return {
        isExistingGlobalUser: false,
        isExistingSocietyCustomer: false,
        userProfile: null,
        societyAccount: null,
        savedBankAccounts: [],
        cardInfo: { exists: false, expired: false },
        emiCard: null,
        kycStatus: {
          lastKycDate: null,
          isKycValid: false,
          requiresManualUploads: true,
          requiresKycVerification: true
        },
        cibilStatus: {
          isCibilRequired: String(productType).toUpperCase() === 'LOAN',
          lastCibilScore: null
        },
        productEligibility: {
          canApply: true,
          reason: null
        }
      };
    }

    // 2. Fetch customer profile details
    const customerProfile = await CustomerProfile.findOne({
      $or: [
        ...(user.profileId ? [{ _id: user.profileId }] : []),
        { userId: user._id },
        { phoneNumber: cleanPhone }
      ]
    }).lean();

    // 3. Search for SocietyCustomerLink in this specific bank or latest link for user
    let societyLink = null;
    if (bankId) {
      societyLink = await SocietyCustomerLink.findOne({
        userId: user._id,
        bankId
      }).lean();
    }
    if (!societyLink) {
      societyLink = await SocietyCustomerLink.findOne({
        userId: user._id
      }).sort({ lastKycDate: -1, createdAt: -1 }).lean();
    }

    // 4. Calculate KYC Validity (30 days window)
    const now = Date.now();
    let isKycValid = false;
    let lastKycDate = null;

    if (societyLink && societyLink.lastKycDate) {
      lastKycDate = societyLink.lastKycDate;
      const kycAgeMs = now - new Date(lastKycDate).getTime();
      isKycValid = kycAgeMs <= KYC_VALIDITY_MS;
    } else if (customerProfile && (customerProfile.kycVerifiedAt || customerProfile.kycStatus === 'VERIFIED')) {
      lastKycDate = customerProfile.kycVerifiedAt || customerProfile.updatedAt || customerProfile.createdAt;
      const kycAgeMs = now - new Date(lastKycDate).getTime();
      isKycValid = kycAgeMs <= KYC_VALIDITY_MS;
    }

    // 5. Evaluate Product Eligibility & Limits per Bank
    const targetProduct = String(productType || 'LOAN').toUpperCase();
    let canApply = true;
    let limitReason = null;

    // CIBIL validity & cooldown check for LOAN (30-day validity window)
    const lastCibilDate = customerProfile?.lastCibilCheckDate || customerProfile?.cibilFetchedAt || societyLink?.lastCibilDate || null;
    const lastCibilScore = customerProfile?.creditScore || societyLink?.lastCibilScore || customerProfile?.cibilScore || null;
    let isCibilValid = false;
    let isCibilRejected = false;
    let remainingCibilDays = 0;

    if (targetProduct === 'LOAN' && lastCibilDate) {
      const cibilAgeDays = Math.floor((now - new Date(lastCibilDate).getTime()) / (1000 * 60 * 60 * 24));
      if (cibilAgeDays < 30) {
        if (customerProfile?.cibilStatus === 'REJECTED' || (lastCibilScore && lastCibilScore < 650)) {
          isCibilRejected = true;
          remainingCibilDays = 30 - cibilAgeDays;
          canApply = false;
          limitReason = `Your CIBIL score is low. Please try again after ${remainingCibilDays} days.`;
        } else if (customerProfile?.cibilStatus === 'APPROVED' || (lastCibilScore && lastCibilScore >= 650)) {
          isCibilValid = true;
        }
      }
    }

    if (targetProduct === 'MERCHANT' && bankId) {
      // Check if user is already an onboarded merchant in this bank
      const existingMerchant = await MerchantProfile.findOne({
        $or: [
          { userId: user._id },
          { phoneNumber: cleanPhone },
          { primaryPhoneNumber: cleanPhone }
        ],
        bankId,
        isDeleted: { $ne: true }
      }).lean();

      if (existingMerchant) {
        canApply = false;
        limitReason = 'Customer is already an onboarded Merchant in this Bank. Only 1 Merchant profile is allowed per Bank.';
      }
    }

    // 6. Build Auto-filled Profile Object
    const resolvedAddress = customerProfile?.activeAddress?.addressLine || customerProfile?.address || customerProfile?.currentAddress || '';
    const resolvedPincode = customerProfile?.residentialPincode || customerProfile?.currentPinCode || societyLink?.pincode || customerProfile?.activeAddress?.pinCode || customerProfile?.pincode || '';

    let resolvedCity = customerProfile?.city || '';
    let resolvedState = customerProfile?.state || '';
    if ((!resolvedCity || !resolvedState) && resolvedAddress) {
      const parts = resolvedAddress.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const lastPart = parts[parts.length - 1];
        const secondLastPart = parts[parts.length - 2];
        if (/^\d{6}$/.test(lastPart)) {
          if (!resolvedState) resolvedState = secondLastPart;
          if (!resolvedCity && parts.length >= 3) resolvedCity = parts[parts.length - 3];
        } else {
          if (!resolvedState) resolvedState = lastPart.replace(/\d+/g, '').trim();
          if (!resolvedCity) resolvedCity = secondLastPart;
        }
      }
    }

    const autoFilledProfile = {
      userId: user._id,
      customerId: customerProfile?.customerUniqueId || user.customerUniqueId || customerProfile?.customerId || `CUST-${user._id.toString().slice(-6).toUpperCase()}`,
      fullName: user.fullName || (customerProfile ? `${customerProfile.firstName || ''} ${customerProfile.lastName || ''}`.trim() : '') || customerProfile?.fullName || '',
      phoneNumber: user.phoneNumber,
      email: user.email || customerProfile?.email || '',
      dateOfBirth: customerProfile?.dob || customerProfile?.dateOfBirth || null,
      gender: customerProfile?.gender || '',
      fatherName: customerProfile?.fatherName || '',
      address: resolvedAddress,
      city: resolvedCity,
      state: resolvedState,
      pincode: resolvedPincode,
      panNumber: customerProfile?.panNumber || customerProfile?.panCardNumber || '',
      aadhaarNumber: customerProfile?.aadhaarNumber || customerProfile?.aadhaarCardNumber || '',
      aadhaarPicUrl: customerProfile?.aadhaarImage || societyLink?.aadhaarPicUrl || customerProfile?.aadhaarPicUrl || '',
      panPicUrl: customerProfile?.panImage || societyLink?.panPicUrl || customerProfile?.panPicUrl || '',
      livePicUrl: customerProfile?.livePhoto || societyLink?.livePicUrl || customerProfile?.livePicUrl || ''
    };

    // 7. Auto-fetch Society Bank Account details if present
    const societyAccount = societyLink && societyLink.societyAccountNumber ? {
      societyAccountNumber: societyLink.societyAccountNumber,
      ifscCode: societyLink.ifscCode || '',
      accountHolderName: societyLink.accountHolderName || autoFilledProfile.fullName,
      bankBranchName: societyLink.bankBranchName || ''
    } : null;

    // 8. Auto-fetch Customer's saved commercial Bank Accounts
    const savedBankAccountsDocs = user ? await BankAccount.find({ userId: user._id, isDeleted: false }).lean() : [];
    const savedBankAccounts = savedBankAccountsDocs.map(acc => ({
      id: acc._id,
      bankAccountId: acc._id,
      bankName: acc.bankName,
      accountNumber: acc.accountNumber,
      ifscCode: acc.ifsc,
      accountHolderName: acc.accountHolder,
      isPrimary: acc.isPrimary
    }));

    // 9. Auto-fetch Customer's EMI Card if present
    const emiCardDoc = user ? await EmiCard.findOne({
      $or: [
        { customerId: user._id },
        ...(customerProfile ? [{ customerId: customerProfile._id }] : [])
      ],
      status: { $ne: 'CANCELLED' }
    })
      .populate('bankId')
      .populate('branchId')
      .sort({ createdAt: -1 })
      .lean() : null;

    const maskedCard = emiCardDoc?.cardNumber
      ? `XXXX XXXX XX${emiCardDoc.cardNumber.slice(-6, -4)} ${emiCardDoc.cardNumber.slice(-4)}`
      : '';
    const societyLogo = emiCardDoc?.bankId?.logo || "https://s3-noi.aces3.ai/sahayaone/society/avatars/user_6a7c15aa266474a6d606d2e5/1788860755500-608169862.jpg";

    const cardInfo = emiCardDoc ? {
      exists: true,
      expired: emiCardDoc.status === 'EXPIRED',
      cardNumber: maskedCard,
      cardHolderName: emiCardDoc.cardHolderName,
      validThru: emiCardDoc.validThru,
      brandLogo: "https://sahayaone-backend.onrender.com/public/mocks/logo-sahayaone.png",
      bankLogo: societyLogo
    } : {
      exists: false,
      expired: false
    };

    const emiCard = emiCardDoc ? {
      exists: true,
      id: emiCardDoc._id,
      cardNumber: emiCardDoc.cardNumber,
      maskedCardNumber: maskedCard,
      cardHolderName: emiCardDoc.cardHolderName,
      validThru: emiCardDoc.validThru,
      status: emiCardDoc.status,
      allotmentStatus: emiCardDoc.allotmentStatus,
      cardLimit: emiCardDoc.cardLimit || 100000,
      availableLimit: emiCardDoc.availableLimit || 100000,
      bankName: emiCardDoc.bankId?.name || null,
      bankLogo: societyLogo
    } : null;

    return {
      isExistingGlobalUser: true,
      isExistingSocietyCustomer: !!societyLink,
      userProfile: autoFilledProfile,
      societyAccount,
      savedBankAccounts,
      cardInfo,
      emiCard,
      kycStatus: {
        lastKycDate,
        isKycValid,
        requiresManualUploads: !societyLink, // manual uploads required only if new to society
        requiresKycVerification: !isKycValid // DigiLocker API check required if > 30 days or new
      },
      cibilStatus: {
        isCibilRequired: targetProduct === 'LOAN',
        lastCibilScore,
        lastCibilDate,
        isCibilValid: targetProduct === 'LOAN' ? isCibilValid : true,
        isCibilRejected: targetProduct === 'LOAN' ? isCibilRejected : false,
        requiresCibilCheck: targetProduct === 'LOAN' && !isCibilValid && !isCibilRejected
      },
      productEligibility: {
        canApply,
        reason: limitReason
      }
    };
  }

  /**
   * Process Society Customer Link creation/update, KYC status, CIBIL check, and Credit Deductions
   */
  static async processSocietyOnboardingAndCredits({
    user,
    bankId,
    branchId,
    productType,
    executiveUser,
    manualUploads = {},
    cibilScore = null
  }) {
    if (!bankId || !branchId) {
      throw ApiError.badRequest('bankId and branchId are required for society onboarding.');
    }

    const targetProduct = String(productType || 'LOAN').toUpperCase();
    const now = new Date();

    // 1. Check existing SocietyCustomerLink
    let societyLink = await SocietyCustomerLink.findOne({ userId: user._id, bankId });
    const isNewToSociety = !societyLink;

    // Evaluate KYC validity
    let isKycValid = false;
    if (societyLink && societyLink.lastKycDate) {
      const kycAgeMs = now.getTime() - new Date(societyLink.lastKycDate).getTime();
      isKycValid = kycAgeMs <= KYC_VALIDITY_MS;
    }

    const requiresKycCredit = isNewToSociety || !isKycValid;
    const requiresCibilCredit = targetProduct === 'LOAN';
    const requiresSocietyCredit = isNewToSociety;

    // 2. Fetch Branch Verification Credits Balance
    const branch = await Branch.findById(branchId);
    let requiredCredits = 0;
    if (requiresSocietyCredit) requiredCredits += 1;
    if (requiresKycCredit) requiredCredits += 1;
    if (requiresCibilCredit) requiredCredits += 1;

    const branchAvailable = branch ? (branch.availableVerificationCredits ?? branch.verificationCreditStock ?? 0) : 0;

    if (branch && branchAvailable >= requiredCredits) {
      // Deduct credits from Branch
      const balanceBefore = branchAvailable;
      branch.availableVerificationCredits = Math.max(0, balanceBefore - requiredCredits);
      if (branch.verificationCreditStock !== undefined) {
        branch.verificationCreditStock = branch.availableVerificationCredits;
      }
      await branch.save();

      // Log credit usage
      if (requiredCredits > 0) {
        await CreditLog.create({
          bankId,
          branchId,
          type: 'VERIFICATION_CREDIT',
          action: 'DEDUCTION',
          amount: requiredCredits,
          employeeId: executiveUser?._id,
          customerId: user._id,
          description: `Credit deduction for ${targetProduct} onboarding: Society Entry (${requiresSocietyCredit ? 1 : 0}), KYC (${requiresKycCredit ? 1 : 0}), CIBIL (${requiresCibilCredit ? 1 : 0})`
        });

        await CardCreditUsage.create({
          bankId,
          branchId,
          type: 'VERIFICATION_CREDIT',
          quantity: requiredCredits,
          balanceBefore,
          balanceAfter: branch.availableVerificationCredits,
          createdBy: executiveUser?._id
        });
      }
    } else {
      // Check if Bank has sufficient verification credits
      const bank = await Bank.findById(bankId);
      const bankAvailable = bank?.verificationCredit ?? bank?.availableVerificationCredits ?? 0;
      if (bank && bankAvailable >= requiredCredits) {
        const balanceBefore = bankAvailable;
        bank.verificationCredit = Math.max(0, balanceBefore - requiredCredits);
        if (bank.availableVerificationCredits !== undefined) {
          bank.availableVerificationCredits = bank.verificationCredit;
        }
        await bank.save();

        if (requiredCredits > 0) {
          await CreditLog.create({
            bankId,
            branchId: branchId || null,
            type: 'VERIFICATION_CREDIT',
            action: 'DEDUCTION',
            amount: requiredCredits,
            employeeId: executiveUser?._id,
            customerId: user._id,
            description: `Credit deduction for ${targetProduct} onboarding from Bank credits: Society Entry (${requiresSocietyCredit ? 1 : 0}), KYC (${requiresKycCredit ? 1 : 0}), CIBIL (${requiresCibilCredit ? 1 : 0})`
          });

          await CardCreditUsage.create({
            bankId,
            branchId: branchId || null,
            type: 'VERIFICATION_CREDIT',
            quantity: requiredCredits,
            balanceBefore,
            balanceAfter: bank.verificationCredit,
            createdBy: executiveUser?._id
          });
        }
      } else {
        throw ApiError.forbidden(
          `Insufficient Society Verification Credits in Branch or Bank. Required: ${requiredCredits}, Branch Available: ${branchAvailable}, Bank Available: ${bankAvailable}. Please recharge credits.`
        );
      }
    }

    // 3. Upsert SocietyCustomerLink Record
    const customerId = user.customerId || `CUST-${user._id.toString().slice(-6).toUpperCase()}`;

    if (!societyLink) {
      societyLink = new SocietyCustomerLink({
        userId: user._id,
        customerId,
        bankId,
        branchId,
        pincode: manualUploads.pincode || '',
        aadhaarPicUrl: manualUploads.aadhaarPicUrl || '',
        panPicUrl: manualUploads.panPicUrl || '',
        livePicUrl: manualUploads.livePicUrl || '',
        firstOnboardedAt: now,
        lastKycDate: now,
        kycStatus: 'VERIFIED',
        onboardedProducts: [targetProduct],
        onboardedByExecutive: {
          id: executiveUser._id,
          name: executiveUser.fullName || executiveUser.name || 'Executive',
          phone: executiveUser.phoneNumber || '',
          role: executiveUser.userType || executiveUser.role || 'EXECUTIVE'
        }
      });
    } else {
      // Update existing society link
      societyLink.lastKycDate = now;
      societyLink.kycStatus = 'VERIFIED';

      if (manualUploads.pincode) societyLink.pincode = manualUploads.pincode;
      if (manualUploads.aadhaarPicUrl) societyLink.aadhaarPicUrl = manualUploads.aadhaarPicUrl;
      if (manualUploads.panPicUrl) societyLink.panPicUrl = manualUploads.panPicUrl;
      if (manualUploads.livePicUrl) societyLink.livePicUrl = manualUploads.livePicUrl;

      if (!societyLink.onboardedProducts.includes(targetProduct)) {
        societyLink.onboardedProducts.push(targetProduct);
      }
    }

    // If CIBIL was run, store CIBIL score
    if (requiresCibilCredit && cibilScore !== null) {
      societyLink.lastCibilScore = cibilScore;
      societyLink.lastCibilDate = now;
    }

    // NOTE: societyAccountNumber is strictly managed via linkSocietyAccount API only.
    // General onboarding flows must NOT set or mutate societyLink.societyAccountNumber.
    await societyLink.save();

    return {
      societyLink,
      isNewToSociety,
      isKycValid,
      executiveDetails: {
        id: executiveUser._id,
        name: executiveUser.fullName || executiveUser.name || 'Executive',
        phone: executiveUser.phoneNumber || '',
        role: executiveUser.userType || executiveUser.role || 'EXECUTIVE'
      }
    };
  }

  /**
   * Branch Authorized Person links / updates Society Bank Account details for a customer.
   * Single source of truth: Links to User/SocietyCustomerLink under the bank and synchronizes across all products (Loan, Merchant, Pigmy).
   */
  static async linkSocietyAccount({
    phoneNumber,
    userId,
    customerId,
    loanId,
    pigmyCustomerId,
    merchantId,
    id,
    bankId,
    branchId,
    societyAccountNumber,
    ifscCode,
    accountHolderName,
    bankBranchName,
    authorizedUser
  }) {
    if (!societyAccountNumber || !String(societyAccountNumber).trim()) {
      throw ApiError.badRequest('societyAccountNumber is required to link society bank account.');
    }

    const cleanPhone = phoneNumber ? String(phoneNumber).replace(/\D/g, '').slice(-10) : null;
    const directId = userId || id;

    // 1. Resolve target customer (User) across all possible identifiers and entities
    let queryUser = null;
    if (directId && mongoose.Types.ObjectId.isValid(directId)) {
      queryUser = await User.findById(directId);
      if (!queryUser) {
        const custProfile = await CustomerProfile.findById(directId);
        if (custProfile?.userId) queryUser = await User.findById(custProfile.userId);
      }
      if (!queryUser) {
        const pigmy = await PigmyCustomer.findById(directId);
        if (pigmy?.userId) queryUser = await User.findById(pigmy.userId);
      }
      if (!queryUser) {
        const merchant = await MerchantProfile.findById(directId);
        if (merchant?.userId) queryUser = await User.findById(merchant.userId);
      }
      if (!queryUser) {
        const loan = await Loan.findById(directId);
        if (loan?.customerId) queryUser = await User.findById(loan.customerId);
      }
      if (!queryUser) {
        const socLink = await SocietyCustomerLink.findById(directId);
        if (socLink?.userId) queryUser = await User.findById(socLink.userId);
      }
    }

    if (!queryUser && customerId) {
      const trimmedCustomerId = String(customerId).trim();
      if (mongoose.Types.ObjectId.isValid(trimmedCustomerId)) {
        queryUser = await User.findById(trimmedCustomerId);
        if (!queryUser) {
          const custProfile = await CustomerProfile.findById(trimmedCustomerId);
          if (custProfile?.userId) queryUser = await User.findById(custProfile.userId);
        }
        if (!queryUser) {
          const pigmy = await PigmyCustomer.findById(trimmedCustomerId);
          if (pigmy?.userId) queryUser = await User.findById(pigmy.userId);
        }
        if (!queryUser) {
          const merchant = await MerchantProfile.findById(trimmedCustomerId);
          if (merchant?.userId) queryUser = await User.findById(merchant.userId);
        }
        if (!queryUser) {
          const loan = await Loan.findById(trimmedCustomerId);
          if (loan?.customerId) queryUser = await User.findById(loan.customerId);
        }
        if (!queryUser) {
          const socLink = await SocietyCustomerLink.findById(trimmedCustomerId);
          if (socLink?.userId) queryUser = await User.findById(socLink.userId);
        }
      }
      if (!queryUser) {
        const custProfile = await CustomerProfile.findOne({ customerUniqueId: trimmedCustomerId });
        if (custProfile?.userId) queryUser = await User.findById(custProfile.userId);
      }
      if (!queryUser) {
        const pigmy = await PigmyCustomer.findOne({
          $or: [
            { pigmyCustomerCode: trimmedCustomerId },
            { code: trimmedCustomerId },
            { accountNumber: trimmedCustomerId }
          ]
        });
        if (pigmy?.userId) queryUser = await User.findById(pigmy.userId);
      }
      if (!queryUser) {
        const merchant = await MerchantProfile.findOne({
          $or: [
            { merchantCode: trimmedCustomerId.toUpperCase() },
            { code: trimmedCustomerId.toUpperCase() }
          ]
        });
        if (merchant?.userId) queryUser = await User.findById(merchant.userId);
      }
      if (!queryUser) {
        const loan = await Loan.findOne({ applicationId: trimmedCustomerId });
        if (loan?.customerId) queryUser = await User.findById(loan.customerId);
      }
    }

    if (!queryUser && loanId) {
      const trimmedLoanId = String(loanId).trim();
      const loan = mongoose.Types.ObjectId.isValid(trimmedLoanId)
        ? await Loan.findById(trimmedLoanId)
        : await Loan.findOne({ applicationId: trimmedLoanId });
      if (loan?.customerId) queryUser = await User.findById(loan.customerId);
    }

    if (!queryUser && pigmyCustomerId) {
      const trimmedPigmyId = String(pigmyCustomerId).trim();
      const pigmy = mongoose.Types.ObjectId.isValid(trimmedPigmyId)
        ? await PigmyCustomer.findById(trimmedPigmyId)
        : await PigmyCustomer.findOne({
            $or: [{ pigmyCustomerCode: trimmedPigmyId }, { code: trimmedPigmyId }, { accountNumber: trimmedPigmyId }]
          });
      if (pigmy?.userId) queryUser = await User.findById(pigmy.userId);
    }

    if (!queryUser && merchantId) {
      const trimmedMerchantId = String(merchantId).trim();
      const merchant = mongoose.Types.ObjectId.isValid(trimmedMerchantId)
        ? await MerchantProfile.findById(trimmedMerchantId)
        : await MerchantProfile.findOne({
            $or: [{ merchantCode: trimmedMerchantId.toUpperCase() }, { code: trimmedMerchantId.toUpperCase() }]
          });
      if (merchant?.userId) queryUser = await User.findById(merchant.userId);
    }

    if (!queryUser && cleanPhone) {
      queryUser = await User.findOne({ phoneNumber: cleanPhone, isDeleted: { $ne: true } });
      if (!queryUser) {
        const pigmy = await PigmyCustomer.findOne({
          $or: [{ phoneNumber: cleanPhone }, { primaryPhoneNumber: cleanPhone }]
        });
        if (pigmy?.userId) queryUser = await User.findById(pigmy.userId);
      }
      if (!queryUser) {
        const merchant = await MerchantProfile.findOne({
          $or: [{ phoneNumber: cleanPhone }, { primaryPhoneNumber: cleanPhone }]
        });
        if (merchant?.userId) queryUser = await User.findById(merchant.userId);
      }
    }

    if (!queryUser) {
      throw ApiError.notFound('Customer record not found. Please onboard the customer first.');
    }

    // 2. Resolve bankId and branchId from authorizedUser if not provided
    const targetBankId = bankId || authorizedUser?.bankId;
    const targetBranchId = branchId || authorizedUser?.branchId;

    if (!targetBankId) {
      throw ApiError.badRequest('Bank context (bankId) is required to link society bank account.');
    }

    // 3. Upsert primary SocietyCustomerLink record
    let societyLink = await SocietyCustomerLink.findOne({
      userId: queryUser._id,
      bankId: targetBankId
    });

    if (!societyLink) {
      societyLink = new SocietyCustomerLink({
        userId: queryUser._id,
        customerId: queryUser.customerUniqueId || `CUST-${queryUser._id.toString().slice(-6).toUpperCase()}`,
        bankId: targetBankId,
        branchId: targetBranchId,
        firstOnboardedAt: new Date(),
        kycStatus: 'VERIFIED'
      });
    }

    const cleanAccNum = String(societyAccountNumber).trim();
    const cleanIfsc = ifscCode ? String(ifscCode).trim().toUpperCase() : (societyLink.ifscCode || '');
    const cleanHolder = accountHolderName ? String(accountHolderName).trim() : (societyLink.accountHolderName || queryUser.fullName || '');
    const cleanBranch = bankBranchName ? String(bankBranchName).trim() : (societyLink.bankBranchName || '');

    societyLink.societyAccountNumber = cleanAccNum;
    societyLink.ifscCode = cleanIfsc;
    societyLink.accountHolderName = cleanHolder;
    societyLink.bankBranchName = cleanBranch;
    if (targetBranchId) societyLink.branchId = targetBranchId;

    await societyLink.save();

    // 4. Synchronize linked society account across all PigmyCustomer & MerchantProfile records for this customer & bank
    await Promise.all([
      PigmyCustomer.updateMany(
        {
          $or: [
            { userId: queryUser._id },
            { primaryPhoneNumber: queryUser.phoneNumber },
            { phoneNumber: queryUser.phoneNumber }
          ],
          ...(targetBankId ? { bankId: targetBankId } : {})
        },
        {
          $set: {
            societyAccount: {
              societyAccountNumber: cleanAccNum,
              ifscCode: cleanIfsc,
              accountHolderName: cleanHolder,
              bankBranchName: cleanBranch
            }
          }
        }
      ),
      MerchantProfile.updateMany(
        {
          $or: [
            { userId: queryUser._id },
            { primaryPhoneNumber: queryUser.phoneNumber },
            { phoneNumber: queryUser.phoneNumber }
          ],
          ...(targetBankId ? { bankId: targetBankId } : {})
        },
        {
          $set: {
            societyAccount: {
              societyAccountNumber: cleanAccNum,
              ifscCode: cleanIfsc,
              accountHolderName: cleanHolder,
              bankBranchName: cleanBranch
            }
          }
        }
      )
    ]);

    return {
      success: true,
      customerId: societyLink.customerId,
      userId: queryUser._id,
      societyAccount: {
        societyAccountNumber: societyLink.societyAccountNumber,
        ifscCode: societyLink.ifscCode,
        accountHolderName: societyLink.accountHolderName,
        bankBranchName: societyLink.bankBranchName
      },
      linkedBy: {
        id: authorizedUser?._id || authorizedUser?.id,
        name: authorizedUser?.fullName || 'Branch Authorized Staff',
        role: authorizedUser?.role || authorizedUser?.userType || 'BRANCH_STAFF'
      },
      message: 'Society bank account successfully linked to customer and synced across products.'
    };
  }

  /**
   * Retrieves active banners for Onboarding App / Customer Flow
   */
  static async getBanners(queryOptions = {}) {
    const { bannerType, portalType } = queryOptions;

    const filter = {
      isDeleted: { $ne: true },
      status: 'ACTIVE'
    };

    // Strictly filter banners assigned to ONBOARDING_APP (unless explicitly requested otherwise)
    const targetPortal = portalType && typeof portalType === 'string' && portalType.trim()
      ? portalType.trim().toUpperCase()
      : 'ONBOARDING_APP';

    filter.portalType = {
      $in: [
        targetPortal,
        ...(targetPortal === 'ONBOARDING_APP' ? ['Onboarding App', 'ONBOARDING'] : [])
      ]
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
}
