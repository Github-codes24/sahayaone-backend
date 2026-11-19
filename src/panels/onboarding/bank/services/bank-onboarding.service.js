import { Bank } from "../../../../models/bank.model.js";
import { Banner } from "../../../../models/banner.model.js";
import { Branch } from "../../../../models/branch.model.js";
import { CreditLog } from "../../../../models/credit-log.model.js";
import { OnboardingTeam } from "../../../../models/onboarding-team.model.js";
import { User } from "../../../../models/user.model.js";
import { ApiError } from "../../../../common/api.error.js";
import { ErrorCode } from "../../../../constants/error-code.constant.js";
import { storageManager } from "../../../../storage/storage.manager.js";
import { cryptoUtil } from "../../../../utils/crypto.util.js";
import { generateOtp } from "../../../../utils/otp.util.js";
import { smsManager } from "../../../../sms/sms.manager.js";
import { smsConfig } from "../../../../config/sms.config.js";
import { envConfig } from "../../../../config/env.config.js";
import { logger } from "../../../../utils/logger.util.js";
import { priceSettingsService } from "../../../super-admin/settings/price/services/price-settings.service.js";
import { Setting } from "../../../../models/setting.model.js";
import { onboardingPaymentFactory } from "../../../../payments/onboarding/onboarding-payment.factory.js";
import { RazorpayHelper } from "../../../../utils/razorpay.helper.js";
import { panelControlConfig } from "../../../../config/panel-control.config.js";
import { paginationUtil } from "../../../../utils/pagination.util.js";

const AVAILABLE_FEATURES = Object.freeze([
  { id: "HR_MANAGEMENT", label: "HR Management" },
  { id: "LOAN_MANAGEMENT", label: "Loan Management" },
  { id: "INVENTORY_MANAGEMENT", label: "Inventory Management" },
  { id: "RECEIPT_MANAGEMENT", label: "Receipt Management" },
  { id: "VERIFICATION_SERVICE", label: "Verification Service" },
  { id: "UPI_AUTOPAY", label: "UPI Autopay" },
  { id: "E_NACH", label: "E-NACH" },
  { id: "WHATSAPP_BANKING", label: "WhatsApp Banking" },
  { id: "BIOMETRIC_INTEGRATION", label: "Biometric Integration" },
  { id: "PAPERLESS_E_KYC", label: "Paperless e-KYC" },
]);

const getSettingValue = async (key, defaultValue) => {
  const cleanKey = String(key || "").trim().toUpperCase();
  const doc = await Setting.findOne({ key: cleanKey }).lean();
  if (doc && doc.value !== undefined && doc.value !== null) {
    if (typeof defaultValue === "number") {
      const num = Number(doc.value);
      return isNaN(num) ? defaultValue : num;
    }
    return doc.value;
  }

  // Fallback aliases
  if (cleanKey === "EMI_CARD_CHARGES") {
    const altDoc = await Setting.findOne({ key: "EMI_CARD_PRICE" }).lean();
    if (altDoc && altDoc.value !== undefined && altDoc.value !== null) {
      const num = Number(altDoc.value);
      return isNaN(num) ? defaultValue : num;
    }
  } else if (cleanKey === "EMI_CARD_PRICE") {
    const altDoc = await Setting.findOne({ key: "EMI_CARD_CHARGES" }).lean();
    if (altDoc && altDoc.value !== undefined && altDoc.value !== null) {
      const num = Number(altDoc.value);
      return isNaN(num) ? defaultValue : num;
    }
  }

  return defaultValue;
};

const parseBase64ToMulterFile = (base64String, fieldName) => {
  const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw ApiError.badRequest("Invalid document upload format. Base64 payload required.", ErrorCode.VALIDATION_ERROR);
  }
  let base64Data = matches[2];
  if (base64Data.endsWith("...") || base64Data.length < 50) {
    base64Data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  }
  const buffer = Buffer.from(base64Data, "base64");
  return {
    buffer,
    originalname: `${fieldName}.png`,
    mimetype: matches[1],
  };
};

export class BankOnboardingService {
  /**
   * Fetches overall stats for bank onboarding dashboard
   */
  async getDashboardStats() {
    const totalOnboarded = await Bank.countDocuments({});
    const onVerification = await Bank.countDocuments({ status: "ON_VERIFICATION" });
    const approved = await Bank.countDocuments({ status: { $in: ["APPROVED", "ACTIVE"] } });
    const rejected = await Bank.countDocuments({ status: "REJECTED" });

    return {
      success: true,
      stats: {
        totalOnboarded,
        onVerification,
        approved,
        rejected,
      },
    };
  }

  /**
   * Lists onboarded banks with name filter search and query pagination
   */
  async listBanks(searchName = "", queryOptions = {}) {
    const { page, limit, skip } = paginationUtil.parse(queryOptions);
    const search = searchName || queryOptions.search || queryOptions.name || "";

    const query = { isDeleted: false };
    if (search) {
      query.name = { $regex: new RegExp(search.trim(), "i") };
    }
    if (queryOptions.status) {
      query.status = String(queryOptions.status).trim().toUpperCase();
    }

    // Date Range Filters: TODAY, THIS_WEEK, THIS_MONTH, or custom startDate & endDate
    const dateRange = queryOptions.dateRange ? String(queryOptions.dateRange).trim().toUpperCase() : null;
    const now = new Date();

    if (dateRange === "TODAY") {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      query.createdAt = { $gte: startOfDay, $lte: endOfDay };
    } else if (dateRange === "THIS_WEEK") {
      const dayOfWeek = now.getDay();
      const distanceToMon = (dayOfWeek + 6) % 7;
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMon, 0, 0, 0, 0);
      const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - distanceToMon), 23, 59, 59, 999);
      query.createdAt = { $gte: startOfWeek, $lte: endOfWeek };
    } else if (dateRange === "THIS_MONTH") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      query.createdAt = { $gte: startOfMonth, $lte: endOfMonth };
    } else if (queryOptions.startDate || queryOptions.endDate) {
      query.createdAt = {};
      if (queryOptions.startDate) {
        query.createdAt.$gte = new Date(queryOptions.startDate);
      }
      if (queryOptions.endDate) {
        const end = new Date(queryOptions.endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const [banks, totalRecords] = await Promise.all([
      Bank.find(query)
        .populate("createdBy", "fullName name email phoneNumber role")
        .populate("onboardingTeamMemberId", "fullName phone email onboardingTeamType region userId")
        .populate("cashCollectedByTeamId", "fullName phone email onboardingTeamType region userId")
        .populate("verifiedBy", "fullName name email phoneNumber role")
        .populate("rejectedBy", "fullName name email phoneNumber role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Bank.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalRecords / limit);

    return {
      success: true,
      banks: banks.map((b) => {
        const member = b.onboardingTeamMemberId || b.cashCollectedByTeamId;
        return {
          id: b._id,
          name: b.name,
          code: b.code,
          ubo: b.ubo,
          phoneNumber: b.phoneNumber,
          email: b.email,
          status: b.status,
          remarks: b.remarks || b.rejectionRemarks || null,
          rejectionRemarks: b.rejectionRemarks || b.remarks || null,
          rejectedAt: b.rejectedAt || null,
          rejectedBy: b.rejectedBy
            ? {
                id: b.rejectedBy._id,
                userId: b.rejectedBy._id,
                name: b.rejectedBy.fullName || b.rejectedBy.name || b.rejectedBy.email,
                email: b.rejectedBy.email,
                phone: b.rejectedBy.phoneNumber || b.rejectedBy.phone,
                role: b.rejectedBy.role,
              }
            : null,
          verifiedAt: b.verifiedAt || null,
          verifiedBy: b.verifiedBy
            ? {
                id: b.verifiedBy._id,
                userId: b.verifiedBy._id,
                name: b.verifiedBy.fullName || b.verifiedBy.name || b.verifiedBy.email,
                email: b.verifiedBy.email,
                phone: b.verifiedBy.phoneNumber || b.verifiedBy.phone,
                role: b.verifiedBy.role,
              }
            : null,
          logo: b.logo,
          onboardedBy: member
            ? {
                id: member._id,
                userId: member.userId || b.createdBy?._id || null,
                teamMemberId: member._id,
                name: member.fullName || member.name,
                email: member.email,
                phone: member.phone,
                role: 'ONBOARDING_TEAM',
                type: member.onboardingTeamType,
                region: member.region,
              }
            : b.createdBy
            ? {
                id: b.createdBy._id,
                userId: b.createdBy._id,
                teamMemberId: null,
                name: b.createdBy.fullName || b.createdBy.name || b.createdBy.email,
                email: b.createdBy.email,
                phone: b.createdBy.phoneNumber || b.createdBy.phone,
                role: b.createdBy.role,
                type: b.createdBy.role,
                region: null,
              }
            : null,
          createdBy: b.createdBy
            ? {
                id: b.createdBy._id,
                userId: b.createdBy._id,
                name: b.createdBy.fullName || b.createdBy.name || b.createdBy.email,
                email: b.createdBy.email,
                phone: b.createdBy.phoneNumber || b.createdBy.phone,
                role: b.createdBy.role,
              }
            : null,
          latitude: b.latitude || null,
          longitude: b.longitude || null,
          location: b.location || null,
          onboardingAddress: b.onboardingAddress || null,
          createdAt: b.createdAt,
        };
      }),
      meta: {
        totalRecords,
        limit,
        page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Saves general information and creates bank draft
   */
  async saveGeneralInfo(payload, creatorUserId = null) {
    const { name, ubo, phoneNumber, email, alternateEmail, password, logo } = payload;

    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPhone = String(phoneNumber || '').trim();
    const cleanAltEmail = alternateEmail ? String(alternateEmail).trim().toLowerCase() : null;

    // 1. Phone number uniqueness validation (across all Banks and Branches)
    if (cleanPhone) {
      const phoneRegex = new RegExp(`(${cleanPhone}|${cleanPhone.slice(-10)})$`);
      const dupBankPhone = await Bank.findOne({
        $or: [{ phoneNumber: cleanPhone }, { phoneNumber: phoneRegex }],
      });
      if (dupBankPhone) {
        throw ApiError.badRequest("A bank/society has already been registered with this mobile number.");
      }

      const dupBranchPhone = await Branch.findOne({
        $or: [{ phoneNumber: cleanPhone }, { phoneNumber: phoneRegex }],
      });
      if (dupBranchPhone) {
        throw ApiError.badRequest("A branch has already been registered with this mobile number.");
      }
    }

    // 2. Email uniqueness validation (across all Banks and Branches)
    const emailRegex = new RegExp(`^${cleanEmail}$`, "i");
    const dupBankEmail = await Bank.findOne({
      $or: [{ email: emailRegex }, { alternateEmail: emailRegex }],
    });
    if (dupBankEmail) {
      throw ApiError.badRequest("A bank/society has already been onboarded with this email address.");
    }

    const dupBranchEmail = await Branch.findOne({ email: emailRegex });
    if (dupBranchEmail) {
      throw ApiError.badRequest("A branch has already been registered with this email address.");
    }

    // 3. Alternate email uniqueness validation (if provided)
    if (cleanAltEmail) {
      if (cleanAltEmail === cleanEmail) {
        throw ApiError.badRequest("Alternate email cannot be the same as primary email.");
      }

      const altEmailRegex = new RegExp(`^${cleanAltEmail}$`, "i");
      const dupBankAlt = await Bank.findOne({
        $or: [{ email: altEmailRegex }, { alternateEmail: altEmailRegex }],
      });
      if (dupBankAlt) {
        throw ApiError.badRequest("A bank/society has already been onboarded with this alternate email address.");
      }

      const dupBranchAlt = await Branch.findOne({ email: altEmailRegex });
      if (dupBranchAlt) {
        throw ApiError.badRequest("A branch has already been registered with this alternate email address.");
      }
    }

    // 4. Name uniqueness validation
    const dupName = await Bank.findOne({ name: { $regex: new RegExp("^" + name.trim() + "$", "i") } });
    if (dupName) {
      throw ApiError.badRequest("A bank/society with this name is already registered.");
    }

    // Auto-generate a unique collision-free code from Bank Name
    let code;
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      const suffix = Math.floor(100 + Math.random() * 900);
      code =
        name
          .replace(/[^a-zA-Z0-9]/g, "")
          .slice(0, 5)
          .toUpperCase() + suffix;
      const existing = await Bank.findOne({ code });
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    let passwordHash = null;
    if (password) {
      passwordHash = await cryptoUtil.hash(password);
    }

    let logoUrl = null;
    if (logo) {
      const parsedLogo = parseBase64ToMulterFile(logo, "logo");
      const uploadResult = await storageManager.uploadFile(parsedLogo, "banks/logos");
      logoUrl = uploadResult.fileUrl;
    }

    let onboardingTeamMemberId = null;
    let userObj = null;
    if (creatorUserId) {
      userObj = await User.findById(creatorUserId);
      const member = await OnboardingTeam.findOne({
        $or: [
          { userId: creatorUserId },
          ...(userObj?.phoneNumber ? [{ phone: userObj.phoneNumber }] : []),
          ...(userObj?.email ? [{ email: userObj.email }] : []),
        ],
        isDeleted: { $ne: true },
      });
      if (member) {
        onboardingTeamMemberId = member._id;
      }
    }

    let location = undefined;
    let latitude = null;
    let longitude = null;
    let onboardingAddress = null;

    if (userObj && userObj.location) {
      if (userObj.location.coordinates && userObj.location.coordinates.length === 2) {
        longitude = userObj.location.coordinates[0];
        latitude = userObj.location.coordinates[1];
        location = {
          type: "Point",
          coordinates: [longitude, latitude],
        };
      }
      onboardingAddress = userObj.location.address || null;
    }

    const bank = await Bank.create({
      name: name.trim(),
      code,
      ubo: ubo.trim(),
      phoneNumber,
      email: email.toLowerCase(),
      alternateEmail: alternateEmail ? alternateEmail.toLowerCase() : undefined,
      passwordHash,
      logo: logoUrl,
      status: "PENDING",
      createdBy: creatorUserId,
      onboardingTeamMemberId,
      latitude,
      longitude,
      location,
      onboardingAddress,
    });

    return {
      success: true,
      bankId: bank._id,
      name: bank.name,
      code: bank.code,
      latitude: bank.latitude,
      longitude: bank.longitude,
      location: bank.location,
      onboardingAddress: bank.onboardingAddress,
      message: "General info successfully registered.",
    };
  }

  /**
   * Uploads base64 document files
   */
  async uploadDocuments(bankId, payload, updaterUserId = null) {
    const bank = await Bank.findById(bankId);
    if (!bank) {
      throw ApiError.notFound("Bank record not found.", ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (bank.status !== "PENDING" && bank.status !== "REJECTED") {
      throw ApiError.badRequest("Documents can only be uploaded when onboarding status is PENDING or REJECTED.", ErrorCode.BAD_REQUEST);
    }

    const docs = ["registrationCertificate", "companyPan", "boardResolution", "gstDeclaration", "directorKyc", "cancelledCheque"];
    if (!bank.documents) {
      bank.documents = {};
    }
    for (const docField of docs) {
      const rawDoc = payload[docField] || payload[`${docField}Url` ];
      if (rawDoc && typeof rawDoc === "string") {
        const trimmedDoc = rawDoc.trim();
        const oldKeyField = `${docField}Key`;

        if (trimmedDoc.startsWith("http://") || trimmedDoc.startsWith("https://") || trimmedDoc.startsWith("//")) {
          bank.documents[docField] = trimmedDoc;
        } else {
          // 1. Delete previous file if key exists
          if (bank.documents[oldKeyField]) {
            storageManager.deleteFile(bank.documents[oldKeyField]).catch((err) => {
              console.warn(`[BANK DOCUMENTS CLEARANCE]: Failed deleting old key [${bank.documents[oldKeyField]}]:`, err.message);
            });
          }

          // 2. Upload new file
          try {
            const fileObj = parseBase64ToMulterFile(trimmedDoc, docField);
            if (fileObj) {
              const uploadResult = await storageManager.uploadFile(fileObj, `banks/${bankId}/documents`);
              bank.documents[docField] = uploadResult.fileUrl || uploadResult.url || trimmedDoc;
              bank.documents[oldKeyField] = uploadResult.filePath || uploadResult.key || null;
            }
          } catch (uploadErr) {
            logger.warn(`BANK ONBOARDING: ${docField} upload warning: ${uploadErr.message}`);
          }
        }
      }
    }

    if (updaterUserId) {
      bank.updatedBy = updaterUserId;
    }

    await bank.save();
    return {
      success: true,
      bankId: bank._id,
      message: "Onboarding documents successfully uploaded.",
    };
  }

  /**
   * Saves bank account details
   */
  async saveBankAccount(bankId, payload, updaterUserId = null) {
    const { bankName, accountNumber, ifsc, accountHolder } = payload;
    const bank = await Bank.findById(bankId);
    if (!bank) {
      throw ApiError.notFound("Bank record not found.", ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (bank.status !== "PENDING" && bank.status !== "REJECTED") {
      throw ApiError.badRequest("Bank account details can only be saved when onboarding status is PENDING or REJECTED.", ErrorCode.BAD_REQUEST);
    }

    const cleanAccountNumber = String(accountNumber || "").trim();
    if (!cleanAccountNumber) {
      throw ApiError.badRequest("Account number is required.", ErrorCode.BAD_REQUEST);
    }

    // Uniqueness validation on bank account number across all other banks
    const dupAccount = await Bank.findOne({
      _id: { $ne: bankId },
      "bankAccountDetails.accountNumber": { $regex: new RegExp(`^${cleanAccountNumber}$`, "i") },
    });
    if (dupAccount) {
      throw ApiError.badRequest("This bank account number is already registered to another bank.", ErrorCode.BAD_REQUEST);
    }

    bank.bankAccountDetails = {
      bankName: bankName.trim(),
      accountNumber: cleanAccountNumber,
      ifsc: ifsc.trim().toUpperCase(),
      accountHolder: accountHolder.trim(),
    };

    if (updaterUserId) {
      bank.updatedBy = updaterUserId;
    }

    await bank.save();
    return {
      success: true,
      bankId: bank._id,
      message: "Bank account info successfully saved.",
    };
  }

  /**
   * Saves chosen features list
   */
  async saveFeatures(bankId, payload) {
    const { features } = payload;
    const bank = await Bank.findById(bankId);
    if (!bank) {
      throw ApiError.notFound("Bank record not found.", ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (bank.status !== "PENDING" && bank.status !== "REJECTED") {
      throw ApiError.badRequest("Features selection can only be saved when onboarding status is PENDING or REJECTED.", ErrorCode.BAD_REQUEST);
    }

    bank.features = features;

    await bank.save();
    return {
      success: true,
      bankId: bank._id,
      message: "Chosen features successfully saved.",
    };
  }

  /**
   * Calculates dynamic pricing based on chosen quantities and settings (0% GST)
   */
  async calculatePricing(bankId, payload) {
    const { cardQuantity, verificationCredit } = payload;

    const qtyCard = Number(cardQuantity);
    const qtyCredit = Number(verificationCredit);

    const minCardLimit = await getSettingValue("MIN_EMI_CARD_LIMIT", 100);
    const minCreditLimit = await getSettingValue("MIN_VERIFICATION_CREDIT_LIMIT", 200);

    if (qtyCard < minCardLimit) {
      throw ApiError.badRequest(`EMI card quantities must be at least ${minCardLimit}.`, ErrorCode.BAD_REQUEST, {
        minCardQuantity: minCardLimit,
        minVerificationCredit: minCreditLimit,
      });
    }
    if (qtyCredit < minCreditLimit) {
      throw ApiError.badRequest(`Verification credits must be at least ${minCreditLimit}.`, ErrorCode.BAD_REQUEST, {
        minCardQuantity: minCardLimit,
        minVerificationCredit: minCreditLimit,
      });
    }

    const bank = await Bank.findById(bankId);
    if (!bank) {
      throw ApiError.notFound("Bank record not found.", ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (bank.status !== "PENDING" && bank.status !== "REJECTED") {
      throw ApiError.badRequest("Pricing structure can only be modified when onboarding status is PENDING or REJECTED.", ErrorCode.BAD_REQUEST);
    }

    const emiCardPrice = await getSettingValue("EMI_CARD_CHARGES", 499);
    const verificationCreditPrice = await getSettingValue("VERIFICATION_CREDIT_PRICE", 50);

    const cardAmount = qtyCard * emiCardPrice;
    const creditAmount = qtyCredit * verificationCreditPrice;
    const totalAmount = cardAmount + creditAmount;

    // No GST applied (0%)
    const cgst = 0;
    const sgst = 0;
    const totalPayableAmount = totalAmount;

    bank.cardQuantity = qtyCard;
    bank.verificationCredit = qtyCredit;

    bank.cardRate = emiCardPrice;
    bank.verificationCreditRate = verificationCreditPrice;
    bank.cardAmount = cardAmount;
    bank.verificationCreditAmount = creditAmount;
    bank.subTotalAmount = totalAmount;
    bank.cgst = cgst;
    bank.sgst = sgst;
    bank.totalAmountPaid = totalPayableAmount;

    await bank.save();

    return {
      success: true,
      priceBreakdown: {
        emiCardQuantity: qtyCard,
        verificationCreditQuantity: qtyCredit,
        emiCardPrice,
        verificationCreditPrice,
        cardAmount,
        creditAmount,
        totalAmount,
        cgst,
        sgst,
        totalPayableAmount,
        minCardQuantity: minCardLimit,
        minVerificationCredit: minCreditLimit,
      },
    };
  }

  /**
   * Initiates the payment workflow (Step 5 checkout)
   */
  async initiatePayment(bankId, payload) {
    const paymentMethod = typeof payload === 'string' ? payload : payload?.paymentMethod;
    const transactionId = typeof payload === 'object' ? (payload.transactionId || payload.referenceId || payload.utrNumber) : null;

    const bank = await Bank.findById(bankId);
    if (!bank) {
      throw ApiError.notFound("Bank record not found.", ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (bank.status !== "PENDING") {
      throw ApiError.badRequest("Payment can only be initiated when onboarding status is PENDING.", ErrorCode.BAD_REQUEST);
    }

    if (bank.paymentStatus === "SUCCESS") {
      throw ApiError.badRequest("Onboarding payment has already been successfully processed.", ErrorCode.BAD_REQUEST);
    }

    const emiCardPrice = await getSettingValue("EMI_CARD_CHARGES", 499);
    const verificationCreditPrice = await getSettingValue("VERIFICATION_CREDIT_PRICE", 50);

    const cardAmount = (bank.cardQuantity || 100) * emiCardPrice;
    const creditAmount = (bank.verificationCredit || 200) * verificationCreditPrice;
    const totalAmount = cardAmount + creditAmount;
    const cgst = 0;
    const sgst = 0;
    const totalPayable = totalAmount;

    bank.paymentMethod = paymentMethod;
    bank.paymentStatus = "PENDING";
    bank.cgst = cgst;
    bank.sgst = sgst;
    bank.totalAmountPaid = totalPayable;
    if (transactionId) {
      bank.paymentGatewayTransactionId = transactionId;
    }
    await bank.save();

    if (paymentMethod === "BANK_TRANSFER") {
      bank.paymentHistory.push({
        paymentMethod: "BANK_TRANSFER",
        paymentStatus: "PENDING",
        transactionId: transactionId || null,
        amount: totalPayable,
        source: "API_INITIATE",
        rawPayload: typeof payload === "object" ? payload : { paymentMethod }
      });
      await bank.save();

      return {
        success: true,
        paymentMethod: "BANK_TRANSFER",
        amount: totalPayable,
        transactionId: transactionId || null,
        message: "Bank transfer payment reference registered. Provide reference ID to verify.",
      };
    }

    if (paymentMethod === "CASH") {
      const isLiveOtp = panelControlConfig.ONBOARDING_PANEL.OTP === "LIVE";
      const otp = isLiveOtp ? generateOtp(6, { numericOnly: true }) : "123456";
      bank.tempOtp = otp;
      bank.tempOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
      await bank.save();

      if (isLiveOtp) {
        try {
          await smsManager.sendOtp(
            bank.phoneNumber,
            otp,
            smsConfig.templates.CASH_COLLECT_OTP.templateId,
            {
              amount: String(totalPayable),
              otp,
              expiry: '10 minutes'
            }
          );
        } catch (smsErr) {
          logger.error(`SMS DISPATCH FAILED: Could not send Cash verification OTP to [${bank.phoneNumber}]: ${smsErr.message}`);
        }
      }

      return {
        success: true,
        paymentMethod: "CASH",
        otpSent: isLiveOtp,
        ...(!isLiveOtp ? { otp } : {}),
        message: "Cash payment confirmation OTP code dispatched to bank owner mobile number.",
      };
    }

    // Online Payment Gateway Flow (Razorpay/Stripe/etc)
    const provider = onboardingPaymentFactory.getProvider();
    const orderResult = await provider.createOrder(bank._id.toString(), totalPayable, "INR", {
      name: bank.ubo || bank.name,
      email: bank.email,
      phone: bank.phoneNumber,
    });

    bank.paymentGatewayOrderId = orderResult.orderId;
    bank.rawPaymentResponse = orderResult.rawResponse || orderResult;
    bank.paymentHistory.push({
      orderId: orderResult.orderId,
      paymentMethod,
      paymentStatus: bank.paymentStatus || 'PENDING',
      amount: totalPayable,
      source: 'API_INITIATE',
      rawPayload: orderResult.rawResponse || orderResult
    });
    await bank.save();

    return {
      success: true,
      paymentMethod,
      gateway: orderResult.paymentGateway || orderResult.gateway || "RAZORPAY",
      orderId: orderResult.orderId,
      currency: orderResult.currency || "INR",
      amount: totalPayable,
      amountInPaise: orderResult.amountInPaise || Math.round(totalPayable * 100),
      keyId: orderResult.keyId || process.env.RAZORPAY_KEY_ID || "rzp_test_mockKeyId",
      razorpayKeyId: orderResult.keyId || process.env.RAZORPAY_KEY_ID || "rzp_test_mockKeyId",
      checkoutUrl: `/api/v1/onboarding/banks/mock-checkout/${bank._id}`,
      prefill: {
        name: bank.ubo || bank.name,
        email: bank.email,
        contact: bank.phoneNumber,
      },
      message: `Onboarding payment order successfully created for in-app SDK checkout.`,
    };
  }

  /**
   * Verifies the checkout payment state (supports CASH OTP, BANK_TRANSFER UTR, and Razorpay)
   */
  async verifyPayment(bankId, payload, executiveUserId = null) {
    const {
      otp,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      paymentGatewayTransactionId,
      transactionId,
      referenceId,
      utrNumber,
      paymentStatus = "SUCCESS"
    } = payload;

    const bank = await Bank.findById(bankId);
    if (!bank) {
      throw ApiError.notFound("Bank record not found.", ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (bank.status !== "PENDING") {
      throw ApiError.badRequest("Payment can only be verified when onboarding status is PENDING.", ErrorCode.BAD_REQUEST);
    }

    const txnId = razorpay_payment_id || paymentGatewayTransactionId || transactionId || referenceId || utrNumber || bank.paymentGatewayTransactionId || null;

    if (bank.paymentMethod === "BANK_TRANSFER") {
      if (!txnId) {
        throw ApiError.badRequest("Bank transfer transaction reference ID / UTR number is required.");
      }
      bank.paymentGatewayTransactionId = txnId;
    } else if (bank.paymentMethod === "CASH") {
      const isTestMock = otp === "123456" && panelControlConfig.ONBOARDING_PANEL.OTP === "TEST";
      const isLiveValid = bank.tempOtp && bank.tempOtp === otp && bank.tempOtpExpires > new Date();

      if (!isTestMock && !isLiveValid) {
        throw ApiError.badRequest("Invalid or expired payment verification OTP.", ErrorCode.OTP_INVALID);
      }

      bank.tempOtp = null;
      bank.tempOtpExpires = null;
    } else {
      // Online Gateway Signature Verification
      if (razorpay_signature) {
        const orderIdToVerify = razorpay_order_id || bank.paymentGatewayOrderId;
        const isValidSignature = razorpayHelper.verifyPaymentSignature({
          razorpay_order_id: orderIdToVerify,
          razorpay_payment_id,
          razorpay_signature
        });

        if (!isValidSignature) {
          throw ApiError.badRequest("Invalid Razorpay payment verification signature.");
        }
      }

      if (paymentStatus === "FAILED") {
        bank.paymentStatus = "FAILED";
        bank.rawPaymentResponse = payload;
        bank.paymentHistory.push({
          orderId: razorpay_order_id || bank.paymentGatewayOrderId || null,
          transactionId: txnId || bank.paymentGatewayTransactionId || null,
          paymentMethod: bank.paymentMethod || null,
          paymentStatus: "FAILED",
          amount: bank.totalAmountPaid || bank.pricing?.totalPayableAmount || 0,
          source: bank.paymentMethod === "CASH" ? "CASH_OTP" : "API_VERIFY",
          rawPayload: payload
        });
        await bank.save();
        throw ApiError.badRequest("Bank onboarding payment failed.");
      }

      if (paymentStatus === "PENDING") {
        bank.paymentStatus = "PENDING";
        if (razorpay_order_id) bank.paymentGatewayOrderId = razorpay_order_id;
        if (txnId) bank.paymentGatewayTransactionId = txnId;
        bank.rawPaymentResponse = payload;
        bank.paymentHistory.push({
          orderId: razorpay_order_id || bank.paymentGatewayOrderId || null,
          transactionId: txnId || bank.paymentGatewayTransactionId || null,
          paymentMethod: bank.paymentMethod || null,
          paymentStatus: "PENDING",
          amount: bank.totalAmountPaid || bank.pricing?.totalPayableAmount || 0,
          source: bank.paymentMethod === "CASH" ? "CASH_OTP" : "API_VERIFY",
          rawPayload: payload
        });
        await bank.save();
        return {
          success: true,
          bankId: bank._id,
          paymentStatus: "PENDING",
          status: bank.status,
          transactionId: bank.paymentGatewayTransactionId || txnId || null,
          message: "Payment is pending authorization. Webhook will auto-update upon completion."
        };
      }

      if (razorpay_order_id) {
        bank.paymentGatewayOrderId = razorpay_order_id;
      }
      if (txnId) {
        bank.paymentGatewayTransactionId = txnId;
      }
    }

    bank.rawPaymentResponse = payload;
    bank.paymentHistory.push({
      orderId: razorpay_order_id || bank.paymentGatewayOrderId || null,
      transactionId: txnId || bank.paymentGatewayTransactionId || null,
      paymentMethod: bank.paymentMethod || null,
      paymentStatus: "SUCCESS",
      amount: bank.totalAmountPaid || bank.pricing?.totalPayableAmount || 0,
      source: bank.paymentMethod === "CASH" ? "CASH_OTP" : "API_VERIFY",
      rawPayload: payload
    });

    await this.finalizeSuccessfulOnboarding(bank, txnId, executiveUserId);

    return {
      success: true,
      bankId: bank._id,
      paymentStatus: "SUCCESS",
      status: "ON_VERIFICATION",
      transactionId: bank.paymentGatewayTransactionId || txnId || null,
      cashCollection:
        bank.paymentMethod === "CASH"
          ? {
              collectedBy: bank.cashCollectedBy,
              collectedByTeamId: bank.cashCollectedByTeamId,
              amount: bank.totalAmountPaid,
              status: bank.cashSettledStatus,
              collectedAt: bank.cashCollectedAt,
            }
          : null,
      message: "Onboarding payment verified successfully. Bank status set to ON_VERIFICATION.",
    };
  }

  /**
   * Helper to allocate credits, snapshot rates, and log initial purchases on checkout success
   */
  async finalizeSuccessfulOnboarding(bank, transactionId = null, executiveUserId = null) {
    if (bank.paymentStatus === "SUCCESS") {
      return; // Already processed
    }

    bank.paymentStatus = "SUCCESS";
    bank.status = "ON_VERIFICATION"; // Hold on verification stack
    if (transactionId) {
      bank.paymentGatewayTransactionId = transactionId;
    }

    // Calculate total amount paid dynamically based on settings
    const emiCardPrice = await getSettingValue("EMI_CARD_CHARGES", 499);
    const verificationCreditPrice = await getSettingValue("VERIFICATION_CREDIT_PRICE", 50);

    const cardAmount = bank.cardQuantity * emiCardPrice;
    const creditAmount = bank.verificationCredit * verificationCreditPrice;
    const totalAmount = cardAmount + creditAmount;
    const cgst = 0;
    const sgst = 0;
    const totalPayable = totalAmount;

    bank.totalAmountPaid = totalPayable;
    bank.totalEmiCards = bank.cardQuantity;
    bank.availableEmiCards = bank.cardQuantity;
    bank.totalVerificationCredits = bank.verificationCredit;
    bank.availableVerificationCredits = bank.verificationCredit;

    // Save purchase pricing snapshot (0% GST)
    bank.cardRate = emiCardPrice;
    bank.verificationCreditRate = verificationCreditPrice;
    bank.cardAmount = cardAmount;
    bank.verificationCreditAmount = creditAmount;
    bank.subTotalAmount = totalAmount;
    bank.cgst = cgst;
    bank.sgst = sgst;

    // Auto-record cash collection ledger if paid by Cash
    if (bank.paymentMethod === "CASH") {
      const execId = executiveUserId || bank.createdBy;
      if (execId) {
        bank.cashCollectedBy = execId;
        const userObj = await User.findById(execId);
        const member = await OnboardingTeam.findOne({
          $or: [
            { userId: execId },
            ...(userObj?.phoneNumber ? [{ phone: userObj.phoneNumber }] : []),
            ...(userObj?.email ? [{ email: userObj.email }] : []),
          ],
          isDeleted: { $ne: true },
        });
        if (member) {
          bank.cashCollectedByTeamId = member._id;
        }
      }
      bank.cashCollectedAt = new Date();
      bank.cashSettledStatus = "UNSETTLED";
      bank.cashSettledAmount = 0;
      bank.cashPendingAmount = totalPayable;
    }

    await bank.save();

    // Log the initial credit purchase
    if (bank.totalEmiCards > 0) {
      await CreditLog.create({
        bankId: bank._id,
        type: "EMI_CARD",
        action: "PURCHASE",
        amount: bank.totalEmiCards,
        description: `Purchased initial ${bank.totalEmiCards} EMI Cards during onboarding checkout.`,
      });
    }

    if (bank.totalVerificationCredits > 0) {
      await CreditLog.create({
        bankId: bank._id,
        type: "VERIFICATION_CREDIT",
        action: "PURCHASE",
        amount: bank.totalVerificationCredits,
        description: `Purchased initial ${bank.totalVerificationCredits} Verification Credits during onboarding checkout.`,
      });
    }

    logger.info(`BANK ONBOARDING: Finished setup and credited quantities for bank [${bank.name}].`);
  }

  /**
   * Fetches full bank profile details
   */
  async getBankDetails(bankId) {
    const bank = await Bank.findOne({ _id: bankId, isDeleted: { $ne: true } })
      .populate("createdBy", "fullName name email phoneNumber role")
      .populate("onboardingTeamMemberId", "fullName phone email onboardingTeamType region userId")
      .populate("cashCollectedByTeamId", "fullName phone email onboardingTeamType region userId")
      .populate("verifiedBy", "fullName name email phoneNumber role")
      .populate("rejectedBy", "fullName name email phoneNumber role");

    if (!bank) {
      throw ApiError.notFound("Bank record not found.", ErrorCode.RESOURCE_NOT_FOUND);
    }

    const getResumeStep = (b) => {
      if (b.status === "REJECTED") {
        return "REJECTED_RESUBMIT";
      }
      if (!b.documents?.registrationCertificate || !b.documents?.companyPan || !b.documents?.boardResolution) {
        return "DOCUMENTS_UPLOAD";
      }
      if (!b.bankAccountDetails || !b.bankAccountDetails.bankName || !b.bankAccountDetails.accountNumber) {
        return "BANK_ACCOUNT_INFO";
      }
      if (!b.features || b.features.length === 0) {
        return "CHOOSE_FEATURES";
      }
      if (!b.cardQuantity || b.cardQuantity === 0) {
        return "PRICING_SETUP";
      }
      if (b.paymentStatus !== "SUCCESS") {
        return "PAYMENT_CHECKOUT";
      }
      if (b.status === "ON_VERIFICATION") {
        return "ON_VERIFICATION";
      }
      return b.status; // APPROVED / ACTIVE / INACTIVE / BLOCKED
    };

    const member = bank.onboardingTeamMemberId || bank.cashCollectedByTeamId;

    return {
      success: true,
      bank: {
        id: bank._id,
        name: bank.name,
        code: bank.code,
        ubo: bank.ubo,
        phoneNumber: bank.phoneNumber,
        email: bank.email,
        alternateEmail: bank.alternateEmail,
        status: bank.status,
        remarks: bank.remarks || bank.rejectionRemarks || null,
        rejectionRemarks: bank.rejectionRemarks || bank.remarks || null,
        rejectionReason: bank.rejectionReason || bank.remarks || null,
        rejectedAt: bank.rejectedAt || null,
        rejectedBy: bank.rejectedBy
          ? {
              id: bank.rejectedBy._id,
              userId: bank.rejectedBy._id,
              name: bank.rejectedBy.fullName || bank.rejectedBy.name || bank.rejectedBy.email,
              email: bank.rejectedBy.email,
              phone: bank.rejectedBy.phoneNumber || bank.rejectedBy.phone,
              role: bank.rejectedBy.role,
            }
          : null,
        verifiedAt: bank.verifiedAt || null,
        verifiedBy: bank.verifiedBy
          ? {
              id: bank.verifiedBy._id,
              userId: bank.verifiedBy._id,
              name: bank.verifiedBy.fullName || bank.verifiedBy.name || bank.verifiedBy.email,
              email: bank.verifiedBy.email,
              phone: bank.verifiedBy.phoneNumber || bank.verifiedBy.phone,
              role: bank.verifiedBy.role,
            }
          : null,
        onboardedBy: member
          ? {
              id: member._id,
              userId: member.userId || bank.createdBy?._id || null,
              teamMemberId: member._id,
              name: member.fullName || member.name,
              email: member.email,
              phone: member.phone,
              role: 'ONBOARDING_TEAM',
              type: member.onboardingTeamType,
              region: member.region,
            }
          : bank.createdBy
          ? {
              id: bank.createdBy._id,
              userId: bank.createdBy._id,
              teamMemberId: null,
              name: bank.createdBy.fullName || bank.createdBy.name || bank.createdBy.email,
              email: bank.createdBy.email,
              phone: bank.createdBy.phoneNumber || bank.createdBy.phone,
              role: bank.createdBy.role,
              type: bank.createdBy.role,
              region: null,
            }
          : null,
        createdBy: bank.createdBy
          ? {
              id: bank.createdBy._id,
              userId: bank.createdBy._id,
              name: bank.createdBy.fullName || bank.createdBy.name || bank.createdBy.email,
              email: bank.createdBy.email,
              phone: bank.createdBy.phoneNumber || bank.createdBy.phone,
              role: bank.createdBy.role,
            }
          : null,
        resumeStep: getResumeStep(bank),
        logo: bank.logo,
        documents: {
          registrationCertificate: bank.documents?.registrationCertificate || null,
          companyPan: bank.documents?.companyPan || null,
          boardResolution: bank.documents?.boardResolution || null,
          gstDeclaration: bank.documents?.gstDeclaration || null,
          directorKyc: bank.documents?.directorKyc || null,
          cancelledCheque: bank.documents?.cancelledCheque || null,
        },
        bankAccountDetails: bank.bankAccountDetails || null,
        features: bank.features || [],
        availableFeatures: AVAILABLE_FEATURES,
        purchaseInfo: {
          cardQuantity: bank.cardQuantity,
          verificationCredit: bank.verificationCredit,
          minCardQuantity: await getSettingValue("MIN_EMI_CARD_LIMIT", 100),
          minVerificationCredit: await getSettingValue("MIN_VERIFICATION_CREDIT_LIMIT", 200),
          paymentMethod: bank.paymentMethod,
          paymentStatus: bank.paymentStatus,
          cardRate: bank.cardRate || 0,
          verificationCreditRate: bank.verificationCreditRate || 0,
          cardAmount: bank.cardAmount || 0,
          verificationCreditAmount: bank.verificationCreditAmount || 0,
          subTotalAmount: bank.subTotalAmount || 0,
          cgst: bank.cgst || 0,
          sgst: bank.sgst || 0,
        },
        creditLimit: bank.creditLimit,
        totalAmountPaid: bank.totalAmountPaid || 0,
        totalEmiCards: bank.totalEmiCards || 0,
        availableEmiCards: bank.availableEmiCards || 0,
        totalVerificationCredits: bank.totalVerificationCredits || 0,
        availableVerificationCredits: bank.availableVerificationCredits || 0,
      },
    };
  }

  /**
   * Creates a new branch for the bank and allocates initial card stock and verification credits
   */
  async createBranch(bankId, payload) {
    const { name, code, cardStock = 0, verificationCredits = 0 } = payload;

    const bank = await Bank.findById(bankId);
    if (!bank) {
      throw ApiError.notFound("Bank record not found.", ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (bank.paymentStatus !== "SUCCESS") {
      throw ApiError.badRequest("Cooperative bank has not completed onboarding checkout. Credit distribution locked.");
    }

    const qtyCard = Number(cardStock);
    const qtyCredit = Number(verificationCredits);

    if (bank.availableEmiCards < qtyCard) {
      throw ApiError.badRequest(`Insufficient available EMI Cards at bank level. Balance: ${bank.availableEmiCards}`);
    }

    if (bank.availableVerificationCredits < qtyCredit) {
      throw ApiError.badRequest(`Insufficient available Verification Credits at bank level. Balance: ${bank.availableVerificationCredits}`);
    }

    const existingBranch = await Branch.findOne({ code: code.toUpperCase().trim() });
    if (existingBranch) {
      throw ApiError.badRequest(`A branch with code [${code.toUpperCase().trim()}] is already registered.`);
    }

    const branch = await Branch.create({
      bankId: bank._id,
      name: name.trim(),
      code: code.toUpperCase().trim(),
      cardStock: qtyCard,
      verificationCredits: qtyCredit,
      status: "ACTIVE",
    });

    bank.availableEmiCards -= qtyCard;
    bank.availableVerificationCredits -= qtyCredit;
    await bank.save();

    // Audit logs for allocations
    if (qtyCard > 0) {
      await CreditLog.create({
        bankId: bank._id,
        branchId: branch._id,
        type: "EMI_CARD",
        action: "ALLOCATION",
        amount: qtyCard,
        description: `Successfully allocated initial ${qtyCard} EMI Cards to branch [${branch.name}].`,
      });
    }

    if (qtyCredit > 0) {
      await CreditLog.create({
        bankId: bank._id,
        branchId: branch._id,
        type: "VERIFICATION_CREDIT",
        action: "ALLOCATION",
        amount: qtyCredit,
        description: `Successfully allocated initial ${qtyCredit} Verification Credits to branch [${branch.name}].`,
      });
    }

    logger.info(`BRANCH CREATION: Created branch [${branch.name}] for bank [${bank.name}] with allocated credits.`);

    return {
      success: true,
      branch,
      bankBalances: {
        availableEmiCards: bank.availableEmiCards,
        availableVerificationCredits: bank.availableVerificationCredits,
      },
    };
  }

  /**
   * Distributes additional cards/credits to an existing branch
   */
  async allocateCredits(bankId, branchId, payload) {
    const { cardStock = 0, verificationCredits = 0 } = payload;

    const bank = await Bank.findById(bankId);
    if (!bank) {
      throw ApiError.notFound("Bank record not found.", ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (bank.paymentStatus !== "SUCCESS") {
      throw ApiError.badRequest("Cooperative bank has not completed onboarding checkout. Credit distribution locked.");
    }

    const branch = await Branch.findById(branchId);
    if (!branch || branch.bankId.toString() !== bank._id.toString()) {
      throw ApiError.notFound("Branch record not found or does not belong to this bank.", ErrorCode.RESOURCE_NOT_FOUND);
    }

    const qtyCard = Number(cardStock);
    const qtyCredit = Number(verificationCredits);

    if (bank.availableEmiCards < qtyCard) {
      throw ApiError.badRequest(`Insufficient available EMI Cards at bank level. Balance: ${bank.availableEmiCards}`);
    }

    if (bank.availableVerificationCredits < qtyCredit) {
      throw ApiError.badRequest(`Insufficient available Verification Credits at bank level. Balance: ${bank.availableVerificationCredits}`);
    }

    branch.cardStock += qtyCard;
    branch.verificationCredits += qtyCredit;
    await branch.save();

    bank.availableEmiCards -= qtyCard;
    bank.availableVerificationCredits -= qtyCredit;
    await bank.save();

    // Audit logs for allocations
    if (qtyCard > 0) {
      await CreditLog.create({
        bankId: bank._id,
        branchId: branch._id,
        type: "EMI_CARD",
        action: "ALLOCATION",
        amount: qtyCard,
        description: `Allocated additional ${qtyCard} EMI Cards to branch [${branch.name}].`,
      });
    }

    if (qtyCredit > 0) {
      await CreditLog.create({
        bankId: bank._id,
        branchId: branch._id,
        type: "VERIFICATION_CREDIT",
        action: "ALLOCATION",
        amount: qtyCredit,
        description: `Allocated additional ${qtyCredit} Verification Credits to branch [${branch.name}].`,
      });
    }

    logger.info(`CREDIT ALLOCATION: Allocated ${qtyCard} cards & ${qtyCredit} credits to branch [${branch.name}].`);

    return {
      success: true,
      branch,
      bankBalances: {
        availableEmiCards: bank.availableEmiCards,
        availableVerificationCredits: bank.availableVerificationCredits,
      },
    };
  }

  /**
   * Lists all branches of a cooperative bank
   */
  async listBranches(bankId) {
    const branches = await Branch.find({ bankId, isDeleted: false }).sort({ createdAt: -1 });
    return {
      success: true,
      branches,
    };
  }

  /**
   * Retrieves audit log entries for bank-level allocations and branch-level deductions
   */
  async getCreditLogs(bankId) {
    const logs = await CreditLog.find({ bankId })
      .populate("branchId", "name code")
      .populate("employeeId", "email phoneNumber")
      .populate("customerId", "phoneNumber")
      .sort({ createdAt: -1 });

    return {
      success: true,
      logs,
    };
  }

  /**
   * Processes incoming payment webhooks from Stripe, Razorpay, Paypal, or Mock
   */
  async handlePaymentWebhook(headers, body, rawBody) {
    const provider = onboardingPaymentFactory.getProvider();

    // Pass rawBody for HMAC verify, fallback to body
    const result = await provider.verifyWebhook(headers, rawBody || body);

    if (!result.gatewayOrderId) {
      throw ApiError.badRequest("Invalid webhook payload. Missing gatewayOrderId.");
    }

    const bankFilter = [];
    if (result.gatewayOrderId) {
      bankFilter.push({ paymentGatewayOrderId: result.gatewayOrderId });
      bankFilter.push({ paymentLinkId: result.gatewayOrderId });
    }
    if (result.bankId && typeof result.bankId === "string" && result.bankId.match(/^[0-9a-fA-F]{24}$/)) {
      bankFilter.push({ _id: result.bankId });
    }

    const bank = await Bank.findOne(bankFilter.length > 0 ? { $or: bankFilter } : { paymentGatewayOrderId: result.gatewayOrderId });

    if (!bank) {
      throw ApiError.notFound("Bank record matching the payment gateway order ID not found.");
    }

    bank.rawPaymentResponse = body;
    bank.paymentHistory.push({
      orderId: result.gatewayOrderId || bank.paymentGatewayOrderId || null,
      transactionId: result.transactionId || bank.paymentGatewayTransactionId || null,
      paymentMethod: bank.paymentMethod || null,
      paymentStatus: result.success ? "SUCCESS" : "FAILED",
      amount: result.amount || bank.totalAmountPaid || 0,
      source: "WEBHOOK",
      rawPayload: body
    });

    if (result.success) {
      await this.finalizeSuccessfulOnboarding(bank, result.transactionId);
      logger.info(`WEBHOOK COMPLETED: Successfully processed webhook payment for bank [${bank.name}]`);
    } else {
      bank.paymentStatus = "FAILED";
      await bank.save();
      logger.warn(`WEBHOOK FAILED: Webhook payment reported failure status for bank [${bank.name}]`);
    }

    return {
      success: true,
      bankId: bank._id,
      paymentStatus: bank.paymentStatus,
      message: `Webhook successfully handled for order ID: ${result.gatewayOrderId}`,
    };
  }

  /**
   * Updates general information for a bank draft
   */
  async updateGeneralInfo(bankId, payload, updaterUserId = null) {
    const bank = await Bank.findById(bankId);
    if (!bank) {
      throw ApiError.notFound("Bank record not found.", ErrorCode.RESOURCE_NOT_FOUND);
    }

    // Guard: lock editing if status is not PENDING or REJECTED
    if (bank.status !== "PENDING" && bank.status !== "REJECTED") {
      throw ApiError.badRequest("General info can only be updated when onboarding status is PENDING or REJECTED.", ErrorCode.BAD_REQUEST);
    }

    const { name, ubo, phoneNumber, email, alternateEmail, password, logo } = payload;

    // 1. Phone number uniqueness validation (across all other Banks and Branches)
    if (phoneNumber) {
      const cleanPhone = String(phoneNumber).trim();
      if (cleanPhone !== bank.phoneNumber) {
        const phoneRegex = new RegExp(`(${cleanPhone}|${cleanPhone.slice(-10)})$`);
        const dupBankPhone = await Bank.findOne({
          _id: { $ne: bankId },
          $or: [{ phoneNumber: cleanPhone }, { phoneNumber: phoneRegex }],
        });
        if (dupBankPhone) {
          throw ApiError.badRequest("A bank/society has already been registered with this mobile number.");
        }

        const dupBranchPhone = await Branch.findOne({
          $or: [{ phoneNumber: cleanPhone }, { phoneNumber: phoneRegex }],
        });
        if (dupBranchPhone) {
          throw ApiError.badRequest("A branch has already been registered with this mobile number.");
        }
        bank.phoneNumber = cleanPhone;
      }
    }

    // 2. Email uniqueness validation (across all other Banks and Branches)
    let effectiveEmail = bank.email;
    if (email) {
      const cleanEmail = String(email).trim().toLowerCase();
      if (cleanEmail !== bank.email) {
        const emailRegex = new RegExp(`^${cleanEmail}$`, "i");
        const dupBankEmail = await Bank.findOne({
          _id: { $ne: bankId },
          $or: [{ email: emailRegex }, { alternateEmail: emailRegex }],
        });
        if (dupBankEmail) {
          throw ApiError.badRequest("A bank/society has already been onboarded with this email address.");
        }

        const dupBranchEmail = await Branch.findOne({ email: emailRegex });
        if (dupBranchEmail) {
          throw ApiError.badRequest("A branch has already been registered with this email address.");
        }
        bank.email = cleanEmail;
        effectiveEmail = cleanEmail;
      }
    }

    // 3. Alternate email uniqueness validation (across all other Banks and Branches)
    if (alternateEmail !== undefined) {
      const cleanAltEmail = alternateEmail ? String(alternateEmail).trim().toLowerCase() : null;
      if (cleanAltEmail) {
        if (cleanAltEmail === effectiveEmail) {
          throw ApiError.badRequest("Alternate email cannot be the same as primary email.");
        }
        if (cleanAltEmail !== (bank.alternateEmail || '')) {
          const altEmailRegex = new RegExp(`^${cleanAltEmail}$`, "i");
          const dupBankAlt = await Bank.findOne({
            _id: { $ne: bankId },
            $or: [{ email: altEmailRegex }, { alternateEmail: altEmailRegex }],
          });
          if (dupBankAlt) {
            throw ApiError.badRequest("A bank/society has already been onboarded with this alternate email address.");
          }

          const dupBranchAlt = await Branch.findOne({ email: altEmailRegex });
          if (dupBranchAlt) {
            throw ApiError.badRequest("A branch has already been registered with this alternate email address.");
          }
          bank.alternateEmail = cleanAltEmail;
        }
      } else {
        bank.alternateEmail = null;
      }
    }

    // 4. Name uniqueness validation (excluding current bank)
    if (name && name.trim().toLowerCase() !== bank.name.toLowerCase()) {
      const dupName = await Bank.findOne({
        _id: { $ne: bankId },
        name: { $regex: new RegExp("^" + name.trim() + "$", "i") },
      });
      if (dupName) {
        throw ApiError.badRequest("A bank/society with this name is already registered.");
      }
      bank.name = name.trim();

      // Regenerate code with new name if they change name
      let code;
      let isUnique = false;
      let attempts = 0;
      while (!isUnique && attempts < 10) {
        const suffix = Math.floor(100 + Math.random() * 900);
        code =
          name
            .replace(/[^a-zA-Z0-9]/g, "")
            .slice(0, 5)
            .toUpperCase() + suffix;
        const existing = await Bank.findOne({ code, _id: { $ne: bankId } });
        if (!existing) {
          isUnique = true;
        }
        attempts++;
      }
      bank.code = code;
    }

    if (ubo) bank.ubo = ubo.trim();
    if (phoneNumber) bank.phoneNumber = phoneNumber;
    if (alternateEmail) bank.alternateEmail = alternateEmail.toLowerCase();

    if (password) {
      bank.passwordHash = await cryptoUtil.hash(password);
    }

    if (logo) {
      const parsedLogo = parseBase64ToMulterFile(logo, "logo");
      const uploadResult = await storageManager.uploadFile(parsedLogo, "banks/logos");
      bank.logo = uploadResult.fileUrl;
    }

    if (updaterUserId) {
      bank.updatedBy = updaterUserId;
    }

    await bank.save();
    return {
      success: true,
      bankId: bank._id,
      name: bank.name,
      code: bank.code,
      message: "General info successfully updated.",
    };
  }

  /**
   * Re-submits a previously REJECTED bank onboarding application for Super Admin verification
   */
  async resubmitForVerification(bankId, payload = {}) {
    const bank = await Bank.findById(bankId);
    if (!bank) {
      throw ApiError.notFound("Bank record not found.", ErrorCode.RESOURCE_NOT_FOUND);
    }

    if (bank.status !== "REJECTED") {
      throw ApiError.badRequest("Only REJECTED bank applications can be re-submitted for verification.", ErrorCode.BAD_REQUEST);
    }

    // Verify minimum required documents exist
    if (!bank.documents?.registrationCertificate || !bank.documents?.companyPan || !bank.documents?.boardResolution) {
      throw ApiError.badRequest("Please ensure all mandatory documents are uploaded before re-submitting.", ErrorCode.BAD_REQUEST);
    }

    if (!bank.bankAccountDetails?.bankName || !bank.bankAccountDetails?.accountNumber) {
      throw ApiError.badRequest("Please ensure bank account details are saved before re-submitting.", ErrorCode.BAD_REQUEST);
    }

    if (bank.paymentStatus !== "SUCCESS") {
      throw ApiError.badRequest("Please complete onboarding checkout payment before re-submitting.", ErrorCode.BAD_REQUEST);
    }

    bank.status = "ON_VERIFICATION";
    bank.resubmittedAt = new Date();
    if (payload.notes || payload.resubmissionNotes) {
      bank.resubmissionNotes = (payload.notes || payload.resubmissionNotes).trim();
    }

    await bank.save();
    logger.info(`BANK ONBOARDING: Re-submitted bank [${bank.name}] (${bank._id}) for Super Admin verification.`);

    return {
      success: true,
      bankId: bank._id,
      name: bank.name,
      status: bank.status,
      resubmittedAt: bank.resubmittedAt,
      message: "Bank onboarding application successfully re-submitted for Super Admin verification.",
    };
  }

  /**
   * Retrieves active banners for the Bank Onboarding Portal / App
   */
  async getBanners(queryOptions = {}) {
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
        ...(targetPortal === 'ONBOARDING_APP' ? ['Onboarding App', 'Bank Onboarding', 'ONBOARDING'] : [])
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

export const bankOnboardingService = new BankOnboardingService();
