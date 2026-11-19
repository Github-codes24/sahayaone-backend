import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { Bank } from "../../../../models/bank.model.js";
import { User } from "../../../../models/user.model.js";
import { Branch } from "../../../../models/branch.model.js";
import { BranchManager } from "../../../../models/branch-manager.model.js";
import { SocietyEmployee } from "../../../../models/society-employee.model.js";
import { SocietyRole } from "../../../../models/society-role.model.js";
import { societyRoleService } from "../../../society/roles/services/society-role.service.js";
import { OnboardingTeam } from "../../../../models/onboarding-team.model.js";
import {
  UserRole,
  UserType,
} from "../../../../constants/user-role.constant.js";
import { storageManager } from "../../../../storage/storage.manager.js";
import { ApiError } from "../../../../common/api.error.js";
import { ErrorCode } from "../../../../constants/error-code.constant.js";
import { CreditLog } from "../../../../models/credit-log.model.js";
import { generateOtp } from "../../../../utils/otp.util.js";
import { cryptoUtil } from "../../../../utils/crypto.util.js";
import { smsManager } from "../../../../sms/sms.manager.js";
import { smsConfig } from "../../../../config/sms.config.js";
import { RazorpayHelper } from "../../../../utils/razorpay.helper.js";
import { logger } from "../../../../utils/logger.util.js";
import { PriceSetting } from "../../../../models/price-setting.model.js";
import { Setting } from "../../../../models/setting.model.js";

const mapPaymentMethod = (method) => {
  if (!method) return null;
  const normalized = String(method).trim().toUpperCase();
  if (normalized === "CASH") return "CASH";
  if (normalized.includes("UPI")) return "UPI";
  if (
    normalized.includes("CARD") ||
    normalized.includes("CREDIT") ||
    normalized.includes("DEBIT") ||
    normalized.includes("ATM")
  )
    return "CARD";
  if (normalized.includes("BANK") || normalized.includes("TRANSFER"))
    return "BANK_TRANSFER";
  if (normalized === "ONLINE") return "ONLINE";
  return normalized;
};

const parseBankAccountDetails = (payload) => {
  const bankDetailsObj =
    payload.bankAccountDetails || payload.bankDetails || {};
  const bankName =
    payload.accountBankName ||
    payload.bankAccountName ||
    payload.bankDetailsBankName ||
    bankDetailsObj.bankName ||
    null;
  const accountNumber =
    payload.accountNumber || bankDetailsObj.accountNumber || null;
  const ifsc = payload.ifsc || payload.ifscCode || bankDetailsObj.ifsc || null;
  const accountHolder =
    payload.accountHolderName ||
    payload.accountHolder ||
    bankDetailsObj.accountHolderName ||
    bankDetailsObj.accountHolder ||
    null;

  return {
    bankName: bankName ? String(bankName).trim() : null,
    accountNumber: accountNumber ? String(accountNumber).trim() : null,
    ifsc: ifsc ? String(ifsc).trim().toUpperCase() : null,
    accountHolder: accountHolder ? String(accountHolder).trim() : null,
  };
};

const parseFeatures = (payload) => {
  const raw =
    payload.features !== undefined ? payload.features : payload.modules;
  if (raw === undefined || raw === null) return null;
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch (e) {
      return raw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return [];
};

export class CooperativeBankService {
  /**
   * Format Currency into INR locale string e.g. ₹50,000
   */
  formatCurrency(amount) {
    if (amount === null || amount === undefined) return "₹0";
    return "₹" + Number(amount).toLocaleString("en-IN");
  }

  /**
   * Standardize bank object output matching View / Edit / List UI spec
   */
  formatBankResponse(bank) {
    const emiCardQuantity =
      bank.pricing?.emiCardQuantity || bank.cardQuantity || 110;
    const verificationCreditQuantity =
      bank.pricing?.verificationCreditQuantity ||
      bank.verificationCredit ||
      220;
    const emiCardPrice = bank.pricing?.emiCardPrice || bank.cardRate || 11000;
    const verificationCreditPrice =
      bank.pricing?.verificationCreditPrice ||
      bank.verificationCreditRate ||
      11000;

    const totalAmount =
      bank.pricing?.totalAmount ||
      bank.subTotalAmount ||
      emiCardPrice + verificationCreditPrice;
    const cgst =
      bank.pricing?.cgst !== undefined
        ? bank.pricing.cgst
        : bank.cgst !== undefined
          ? bank.cgst
          : 0;
    const sgst =
      bank.pricing?.sgst !== undefined
        ? bank.pricing.sgst
        : bank.sgst !== undefined
          ? bank.sgst
          : 0;
    const totalPayableAmount =
      bank.pricing?.totalPayableAmount ||
      bank.totalAmountPaid ||
      totalAmount + cgst + sgst;

    const docs = bank.documents || {};
    const bankAccount = bank.bankAccountDetails || {};

    // Helper to format creator / admin user object
    const formatUserObject = (user) => {
      if (!user) return null;
      if (
        typeof user === "object" &&
        (user._id || user.id || user.fullName || user.name || user.email)
      ) {
        const idStr = String(user._id || user.id || user);
        return {
          id: idStr,
          userId: idStr,
          name: user.fullName || user.name || user.email || "Super Admin",
          email: user.email || null,
          phone: user.phoneNumber || user.phone || null,
          role: user.role || "SUPER_ADMIN",
        };
      }
      const idStr = String(user);
      return {
        id: idStr,
        userId: idStr,
        name: "Super Admin",
        email: null,
        phone: null,
        role: "SUPER_ADMIN",
      };
    };

    // Helper to format onboarding team member object
    const formatTeamMemberObject = (teamMember) => {
      if (!teamMember) return null;
      if (
        typeof teamMember === "object" &&
        (teamMember._id || teamMember.id || teamMember.fullName || teamMember.name)
      ) {
        const idStr = String(teamMember._id || teamMember.id || teamMember);
        return {
          id: idStr,
          userId: teamMember.userId
            ? String(teamMember.userId._id || teamMember.userId)
            : bank.createdBy
              ? String(bank.createdBy._id || bank.createdBy)
              : null,
          teamMemberId: idStr,
          name:
            teamMember.fullName || teamMember.name || "Onboarding Team Member",
          email: teamMember.email || null,
          phone: teamMember.phone || teamMember.phoneNumber || null,
          role: "ONBOARDING_TEAM",
          type: teamMember.onboardingTeamType || null,
          region: teamMember.region || null,
        };
      }
      const idStr = String(teamMember);
      return {
        id: idStr,
        userId: bank.createdBy
          ? String(bank.createdBy._id || bank.createdBy)
          : null,
        teamMemberId: idStr,
        name: "Onboarding Team Member",
        email: null,
        phone: null,
        role: "ONBOARDING_TEAM",
        type: null,
        region: null,
      };
    };

    const formattedCreatedBy = formatUserObject(bank.createdBy);
    const formattedOnboardedBy =
      formatTeamMemberObject(bank.onboardingTeamMemberId) ||
      formatTeamMemberObject(bank.cashCollectedByTeamId) ||
      (formattedCreatedBy
        ? {
          ...formattedCreatedBy,
          teamMemberId: null,
          type: formattedCreatedBy.role,
          region: null,
        }
        : null);

    return {
      id: bank._id,
      bankId: bank._id,
      bankName: bank.name,
      name: bank.name,
      code: bank.code,
      logo: bank.logo || null,
      email: bank.email,
      alternateEmail: bank.alternateEmail || "",
      mailIdAlternate: bank.alternateEmail || "",
      phoneNumber: bank.phoneNumber,
      phone: bank.phoneNumber,
      credit: bank.credit || 0,
      formattedCredit: this.formatCurrency(bank.credit || 0),
      ubo: bank.ubo,
      authorizedPerson: bank.ubo,
      bankAccountDetails: {
        bankName: bankAccount.bankName || null,
        accountNumber: bankAccount.accountNumber || null,
        ifsc: bankAccount.ifsc || null,
        accountHolder: bankAccount.accountHolder || null,
        accountHolderName: bankAccount.accountHolder || null,
      },
      features: bank.features || [],
      cardQuantity: bank.cardQuantity || 0,
      emiCard:
        bank.availableEmiCards !== undefined
          ? bank.availableEmiCards
          : bank.cardQuantity || 0,
      verificationCredit:
        bank.availableVerificationCredits !== undefined
          ? bank.availableVerificationCredits
          : bank.verificationCredit || 0,
      emiCardCredit: bank.availableEmiCards || 0,
      EMICardCredit: bank.availableEmiCards || 0,
      totalEmiCards: bank.totalEmiCards || 0,
      availableEmiCards: bank.availableEmiCards || 0,
      totalVerificationCredits: bank.totalVerificationCredits || 0,
      availableVerificationCredits: bank.availableVerificationCredits || 0,
      paymentMethod: bank.paymentMethod || null,
      paymentStatus: bank.paymentStatus || null,
      paymentLink: bank.paymentLink || null,
      paymentLinkId: bank.paymentLinkId || null,
      paymentTrackingStatus:
        bank.paymentStatus === "SUCCESS"
          ? "SUCCESS"
          : bank.paymentStatus === "FAILED"
            ? "FAILED"
            : bank.paymentStatus === "PENDING" && bank.paymentMethod
              ? "PENDING_VERIFICATION"
              : "NOT_INITIATED",
      totalAmountPaid: bank.totalAmountPaid || 0,
      cardRate: bank.cardRate || 0,
      verificationCreditRate: bank.verificationCreditRate || 0,
      cardAmount: bank.cardAmount || 0,
      verificationCreditAmount: bank.verificationCreditAmount || 0,
      subTotalAmount: bank.subTotalAmount || 0,
      cgst: bank.cgst || 0,
      sgst: bank.sgst || 0,
      pricing: {
        emiCardQuantity,
        emiQty: emiCardQuantity,
        verificationCreditQuantity,
        verQty: verificationCreditQuantity,
        emiCardPrice,
        formattedEmiCardPrice: this.formatCurrency(emiCardPrice),
        verificationCreditPrice,
        formattedVerificationCreditPrice: this.formatCurrency(
          verificationCreditPrice,
        ),
        totalAmount,
        formattedTotalAmount: this.formatCurrency(totalAmount),
        cgst,
        formattedCgst: `+${this.formatCurrency(cgst)}`,
        sgst,
        formattedSgst: `+${this.formatCurrency(sgst)}`,
        totalPayableAmount,
        formattedTotalPayableAmount: this.formatCurrency(totalPayableAmount),
      },
      documents: {
        bankLogo:
          docs.bankLogo || bank.logo
            ? { filename: "logo.png", url: docs.bankLogo || bank.logo }
            : null,
        registrationCertificate: docs.registrationCertificate
          ? { filename: "reg_cert_2023.pdf", url: docs.registrationCertificate }
          : null,
        companyPan: docs.companyPan
          ? { filename: "pan_card.jpg", url: docs.companyPan }
          : null,
        boardResolution: docs.boardResolution
          ? { filename: "board_res.pdf", url: docs.boardResolution }
          : null,
        gstDeclaration: docs.gstDeclaration
          ? { filename: "gst_doc.pdf", url: docs.gstDeclaration }
          : null,
        directorKyc: docs.directorKyc
          ? { filename: "dir_kyc_aadhar.pdf", url: docs.directorKyc }
          : null,
        cancelledCheque: docs.cancelledCheque
          ? { filename: "cancelled_cheque.pdf", url: docs.cancelledCheque }
          : null,
      },
      remarks: bank.remarks || bank.rejectionRemarks || null,
      rejectionRemarks: bank.rejectionRemarks || bank.remarks || null,
      rejectionReason: bank.rejectionReason || bank.remarks || null,
      rejectedAt: bank.rejectedAt || null,
      rejectedBy: formatUserObject(bank.rejectedBy),
      verifiedAt: bank.verifiedAt || null,
      verifiedBy: formatUserObject(bank.verifiedBy),
      onboardedBy: formattedOnboardedBy,
      createdBy: formattedCreatedBy,
      status: bank.status === "ACTIVE" ? "APPROVED" : (bank.status || "APPROVED"),
      latitude: bank.latitude || null,
      longitude: bank.longitude || null,
      location: bank.location || null,
      onboardingAddress: bank.onboardingAddress || null,
      createdAt: bank.createdAt,
      updatedAt: bank.updatedAt,
    };
  }

  /**
   * Helper to process file upload for a document key
   */
  async processFileUpload(fileArray, folder = "banks") {
    if (!fileArray || fileArray.length === 0) return { url: null, key: null };
    const file = fileArray[0];
    const uploadResult = await storageManager.uploadFile(file, folder);
    return {
      url: uploadResult?.fileUrl || null,
      key: uploadResult?.key || null,
    };
  }

  /**
   * List Co-operative Banks with search, status filtering, and pagination
   */
  async listCooperativeBanks(queryOptions) {
    const page = parseInt(queryOptions.page || "1", 10);
    const limit = parseInt(queryOptions.limit || "10", 10);
    const search = (queryOptions.search || "").trim();
    const status = queryOptions.status
      ? queryOptions.status.toUpperCase()
      : null;
    const skip = (page - 1) * limit;

    const filter = {
      isDeleted: { $ne: true },
    };

    if (status) {
      if (status === "APPROVED" || status === "ACTIVE") {
        filter.status = { $in: ["APPROVED", "ACTIVE"] };
      } else {
        filter.status = status;
      }
    }

    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phoneNumber: searchRegex },
        { ubo: searchRegex },
        { code: searchRegex },
      ];
    }

    const sortField = queryOptions.sortBy || "createdAt";
    const sortOrder =
      (queryOptions.sortOrder || "desc").toLowerCase() === "asc" ? 1 : -1;

    const [banks, totalRecords] = await Promise.all([
      Bank.find(filter)
        .populate("createdBy", "fullName name email phoneNumber role")
        .populate(
          "onboardingTeamMemberId",
          "fullName phone email onboardingTeamType region userId",
        )
        .populate(
          "cashCollectedByTeamId",
          "fullName phone email onboardingTeamType region userId",
        )
        .populate("verifiedBy", "fullName name email phoneNumber role")
        .populate("rejectedBy", "fullName name email phoneNumber role")
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      Bank.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalRecords / limit);

    const items = banks.map((b, idx) => ({
      srNo: skip + idx + 1,
      ...this.formatBankResponse(b),
    }));

    return {
      items,
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
   * Get single Co-operative Bank by ID
   */
  async getCooperativeBankById(id) {
    const bank = await Bank.findOne({ _id: id, isDeleted: { $ne: true } })
      .populate("createdBy", "fullName name email phoneNumber role")
      .populate(
        "onboardingTeamMemberId",
        "fullName phone email onboardingTeamType region userId",
      )
      .populate(
        "cashCollectedByTeamId",
        "fullName phone email onboardingTeamType region userId",
      )
      .populate("verifiedBy", "fullName name email phoneNumber role")
      .populate("rejectedBy", "fullName name email phoneNumber role")
      .lean();

    if (!bank) {
      throw ApiError.notFound("Co-operative Bank not found.");
    }

    return this.formatBankResponse(bank);
  }

  /**
   * Add credit to bank (+ Add Credit button on View page - Image 1)
   */
  async addCredit(id, quantity, type, adderId) {
    const bank = await Bank.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!bank) {
      throw ApiError.notFound("Co-operative Bank not found.");
    }

    const amountToAdd = parseFloat(quantity);
    if (isNaN(amountToAdd) || amountToAdd <= 0) {
      throw ApiError.badRequest("Invalid quantity. Must be greater than 0.");
    }

    const { emiCardUnitPrice, verificationCreditUnitPrice } =
      await this.getStoredPriceSettings();

    const creditType = String(type || "EMI")
      .trim()
      .toUpperCase();

    if (
      creditType === "EMI" ||
      creditType === "EMI_CARD" ||
      creditType === "EMI_CARD_CREDIT"
    ) {
      const unitPrice = emiCardUnitPrice;
      const totalPrice = amountToAdd * unitPrice;

      bank.cardQuantity = (bank.cardQuantity || 0) + amountToAdd;
      bank.totalEmiCards = (bank.totalEmiCards || 0) + amountToAdd;
      bank.availableEmiCards = (bank.availableEmiCards || 0) + amountToAdd;

      bank.cardRate = unitPrice;
      bank.cardAmount = (bank.cardAmount || 0) + totalPrice;
      bank.subTotalAmount =
        (bank.cardAmount || 0) + (bank.verificationCreditAmount || 0);
      bank.totalAmountPaid = (bank.totalAmountPaid || 0) + totalPrice;

      if (!bank.pricing) bank.pricing = {};
      bank.pricing.emiCardQuantity =
        (bank.pricing.emiCardQuantity || 0) + amountToAdd;
      bank.pricing.emiCardPrice = unitPrice;
      bank.pricing.totalAmount = bank.subTotalAmount;
      bank.pricing.totalPayableAmount =
        (bank.pricing.totalPayableAmount || 0) + totalPrice;

      await CreditLog.create({
        bankId: bank._id,
        type: "EMI_CARD",
        action: "CREDIT",
        amount: amountToAdd,
        description: `Added ${amountToAdd} EMI Card(s) manually by admin for ₹${totalPrice.toLocaleString("en-IN")} (Rate: ₹${unitPrice}/unit).`,
      });
    } else if (
      creditType === "VERIFICATION" ||
      creditType === "VERIFICATION_CREDIT"
    ) {
      const unitPrice = verificationCreditUnitPrice;
      const totalPrice = amountToAdd * unitPrice;

      bank.verificationCredit = (bank.verificationCredit || 0) + amountToAdd;
      bank.totalVerificationCredits =
        (bank.totalVerificationCredits || 0) + amountToAdd;
      bank.availableVerificationCredits =
        (bank.availableVerificationCredits || 0) + amountToAdd;

      bank.verificationCreditRate = unitPrice;
      bank.verificationCreditAmount =
        (bank.verificationCreditAmount || 0) + totalPrice;
      bank.subTotalAmount =
        (bank.cardAmount || 0) + (bank.verificationCreditAmount || 0);
      bank.totalAmountPaid = (bank.totalAmountPaid || 0) + totalPrice;

      if (!bank.pricing) bank.pricing = {};
      bank.pricing.verificationCreditQuantity =
        (bank.pricing.verificationCreditQuantity || 0) + amountToAdd;
      bank.pricing.verificationCreditPrice = unitPrice;
      bank.pricing.totalAmount = bank.subTotalAmount;
      bank.pricing.totalPayableAmount =
        (bank.pricing.totalPayableAmount || 0) + totalPrice;

      await CreditLog.create({
        bankId: bank._id,
        type: "VERIFICATION_CREDIT",
        action: "CREDIT",
        amount: amountToAdd,
        description: `Added ${amountToAdd} Verification Credit(s) manually by admin for ₹${totalPrice.toLocaleString("en-IN")} (Rate: ₹${unitPrice}/unit).`,
      });
    } else {
      bank.credit = (bank.credit || 0) + amountToAdd;
    }

    bank.updatedBy = adderId;
    await bank.save();

    return this.formatBankResponse(bank);
  }

  /**
   * Create a new Co-operative Bank (Images 2 & 3 UI)
   */
  async createCooperativeBank(payload, files = {}, creatorId) {
    const name = (payload.bankName || payload.name || "").trim();
    const ubo = (payload.authorizedPerson || payload.ubo || "").trim();
    const email = (payload.email || "").trim().toLowerCase();
    const alternateEmail =
      (payload.alternateEmail || payload.mailIdAlternate || "")
        .trim()
        .toLowerCase() || null;
    const phoneNumber = (payload.phoneNumber || payload.phone || "").trim();
    const credit = payload.credit ? parseFloat(payload.credit) : 0;
    const password = payload.password ? String(payload.password).trim() : null;

    if (!name) {
      throw ApiError.badRequest(
        "Bank name is required.",
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const existingName = await Bank.findOne({
      name: { $regex: `^${name}$`, $options: "i" },
      isDeleted: { $ne: true },
    });
    if (existingName) {
      throw ApiError.conflict(
        "A Co-operative Bank with this name already exists.",
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const existingEmail = await Bank.findOne({
      $or: [{ email }, { alternateEmail: email }],
      isDeleted: { $ne: true },
    });
    if (existingEmail) {
      throw ApiError.conflict(
        "A Co-operative Bank with this email address already exists.",
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const existingBranchEmail = await Branch.findOne({
      email: { $regex: `^${email}$`, $options: "i" },
      isDeleted: { $ne: true },
    });
    if (existingBranchEmail) {
      throw ApiError.conflict(
        "A branch with this email address already exists.",
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const cleanPhone = (payload.phoneNumber || payload.phone || "").trim();
    if (cleanPhone) {
      const phoneRegex = new RegExp(`(${cleanPhone}|${cleanPhone.slice(-10)})$`);
      const existingPhoneBank = await Bank.findOne({
        $or: [{ phoneNumber: cleanPhone }, { phoneNumber: phoneRegex }],
        isDeleted: { $ne: true },
      });
      if (existingPhoneBank) {
        throw ApiError.conflict(
          "A Co-operative Bank with this mobile number already exists.",
          ErrorCode.VALIDATION_ERROR,
        );
      }
      const existingPhoneBranch = await Branch.findOne({
        $or: [{ phoneNumber: cleanPhone }, { phoneNumber: phoneRegex }],
        isDeleted: { $ne: true },
      });
      if (existingPhoneBranch) {
        throw ApiError.conflict(
          "A branch with this mobile number already exists.",
          ErrorCode.VALIDATION_ERROR,
        );
      }
    }

    let code = (payload.code || "").trim().toUpperCase();
    if (!code) {
      const acronym =
        name
          .replace(/[^A-Za-z]/g, "")
          .substring(0, 5)
          .toUpperCase() || "BANK";
      code = `${acronym}${Math.floor(100 + Math.random() * 900)}`;
    }

    const bankAccountDetails = parseBankAccountDetails(payload);
    if (bankAccountDetails && bankAccountDetails.accountNumber) {
      const cleanAcc = String(bankAccountDetails.accountNumber).trim();
      const existingAccount = await Bank.findOne({
        "bankAccountDetails.accountNumber": { $regex: new RegExp(`^${cleanAcc}$`, "i") },
        isDeleted: { $ne: true },
      });
      if (existingAccount) {
        throw ApiError.conflict(
          "This bank account number is already registered to another bank.",
          ErrorCode.VALIDATION_ERROR,
        );
      }
    }
    const features = parseFeatures(payload) || [];

    const logoUpload = await this.processFileUpload(
      files.logo || files.bankLogo,
    );
    const regCertUpload = await this.processFileUpload(
      files.registrationCertificate,
    );
    const panUpload = await this.processFileUpload(files.companyPan);
    const boardResUpload = await this.processFileUpload(files.boardResolution);
    const gstUpload = await this.processFileUpload(files.gstDeclaration);
    const directorKycUpload = await this.processFileUpload(files.directorKyc);
    const cancelledChequeUpload = await this.processFileUpload(
      files.cancelledCheque,
    );

    const emiCardQuantity = payload.emiCardQuantity
      ? parseInt(payload.emiCardQuantity, 10)
      : 110;
    const verificationCreditQuantity = payload.verificationCreditQuantity
      ? parseInt(payload.verificationCreditQuantity, 10)
      : 220;
    const emiCardPrice = payload.emiCardPrice
      ? parseFloat(payload.emiCardPrice)
      : 11000;
    const verificationCreditPrice = payload.verificationCreditPrice
      ? parseFloat(payload.verificationCreditPrice)
      : 11000;

    const totalAmount = payload.totalAmount
      ? parseFloat(payload.totalAmount)
      : emiCardPrice + verificationCreditPrice;
    const cgst = payload.cgst ? parseFloat(payload.cgst) : 0;
    const sgst = payload.sgst ? parseFloat(payload.sgst) : 0;
    const totalPayableAmount = payload.totalPayableAmount
      ? parseFloat(payload.totalPayableAmount)
      : totalAmount + cgst + sgst;

    let bankUser = null;
    if (password) {
      const existingUser = await User.findOne({
        email,
        isDeleted: { $ne: true },
      });
      if (!existingUser) {
        const passwordHash = await bcrypt.hash(password, 10);
        bankUser = new User({
          email,
          phoneNumber,
          passwordHash,
          role: UserRole.BANK_OWNER,
          userType: UserType.PARTNER,
          status: "ACTIVE",
          createdBy: creatorId,
        });
        await bankUser.save();
      } else {
        bankUser = existingUser;
        const passwordHash = await bcrypt.hash(password, 10);
        bankUser.passwordHash = passwordHash;
        bankUser.role = UserRole.BANK_OWNER;
        bankUser.status = "ACTIVE";
        await bankUser.save();
      }
    }

    const paymentMethodMapped = mapPaymentMethod(payload.paymentMethod);
    let paymentStatusMapped = payload.paymentStatus
      ? payload.paymentStatus.toUpperCase()
      : "SUCCESS";
    let bankStatusMapped = payload.status
      ? payload.status.toUpperCase()
      : "APPROVED";
    if (bankStatusMapped === "ACTIVE") {
      bankStatusMapped = "APPROVED";
    }
    const transactionId =
      (
        payload.transactionId ||
        payload.paymentGatewayTransactionId ||
        ""
      ).trim() || null;

    let rawOtp = null;
    let tempOtpHash = null;
    let tempOtpExpires = null;
    let gatewayOrderId = null;
    let razorpayOrderDetails = null;
    let paymentLinkResult = null;

    // Payment Integration Control Flow
    if (paymentMethodMapped === "CASH") {
      paymentStatusMapped = "PENDING";
      bankStatusMapped = "PENDING";

      rawOtp = generateOtp(6, { numericOnly: true });
      tempOtpHash = await cryptoUtil.hash(rawOtp);
      tempOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      logger.info(
        `CASH PAYMENT OTP: Generated OTP [${rawOtp}] for customer ${phoneNumber}`,
      );
    } else if (
      ["UPI", "CARD", "BANK_TRANSFER", "ONLINE"].includes(paymentMethodMapped)
    ) {
      paymentStatusMapped = "PENDING";
      bankStatusMapped = "PENDING";

      const internalOrderId = `ORD_BANK_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
      const razorpayOrder = await razorpayHelper.createPaymentOrder({
        txnid: internalOrderId,
        amount: totalPayableAmount,
        receipt: internalOrderId,
        notes: { bankName: name, email, phone: phoneNumber },
      });

      gatewayOrderId = razorpayOrder.orderId;
      razorpayOrderDetails = {
        orderId: razorpayOrder.orderId,
        keyId: razorpayOrder.keyId,
        amountInPaise: razorpayOrder.amountInPaise,
        currency: razorpayOrder.currency || "INR",
      };

      try {
        paymentLinkResult = await razorpayHelper.createPaymentLink({
          txnid: internalOrderId,
          amount: totalPayableAmount,
          description: `Bank Creation Onboarding Payment - ${name}`,
          customer: {
            name: ubo || name,
            email: email,
            contact: phoneNumber,
          },
          notes: { bankName: name, email, phone: phoneNumber },
        });
      } catch (linkErr) {
        logger.warn(
          `CREATE BANK: Could not generate Razorpay payment link: ${linkErr.message}`,
        );
      }
    }

    const effectiveCreatorId =
      creatorId ||
      payload.createdBy ||
      payload.creatorId ||
      payload.userId ||
      null;

    let onboardingTeamMemberId =
      payload.onboardingTeamMemberId ||
      payload.onboardedBy ||
      payload.onboardedById ||
      null;

    if (onboardingTeamMemberId) {
      let otId = onboardingTeamMemberId;
      if (typeof otId === "object" && otId !== null) {
        otId = otId._id || otId.id || otId.teamMemberId;
      }
      const member = await OnboardingTeam.findOne({
        $or: [{ _id: otId }, { userId: otId }],
        isDeleted: { $ne: true },
      });
      if (member) {
        onboardingTeamMemberId = member._id;
      }
    }

    if (!onboardingTeamMemberId && effectiveCreatorId) {
      let cId = effectiveCreatorId;
      if (typeof cId === "object" && cId !== null) {
        cId = cId._id || cId.id || cId.userId;
      }

      let member = await OnboardingTeam.findOne({
        $or: [{ _id: cId }, { userId: cId }],
        isDeleted: { $ne: true },
      });

      if (!member && cId) {
        const userObj = await User.findById(cId);
        if (userObj) {
          member = await OnboardingTeam.findOne({
            $or: [
              { userId: cId },
              ...(userObj?.phoneNumber
                ? [{ phone: userObj.phoneNumber }]
                : []),
              ...(userObj?.email ? [{ email: userObj.email }] : []),
            ],
            isDeleted: { $ne: true },
          });
        }
      }

      if (member) {
        onboardingTeamMemberId = member._id;
      }
    }

    let finalCreatedBy = effectiveCreatorId;
    if (typeof finalCreatedBy === "object" && finalCreatedBy !== null) {
      finalCreatedBy = finalCreatedBy._id || finalCreatedBy.id || finalCreatedBy.userId;
    }
    if (finalCreatedBy) {
      const teamMember = await OnboardingTeam.findById(finalCreatedBy);
      if (teamMember && teamMember.userId) {
        finalCreatedBy = teamMember.userId;
      }
    }

    const isDirectApproved =
      bankStatusMapped === "ACTIVE" || bankStatusMapped === "APPROVED";

    const bank = new Bank({
      name,
      code,
      logo: logoUpload.url,
      logoKey: logoUpload.key,
      email,
      alternateEmail,
      phoneNumber,
      credit,
      ubo,
      userId: bankUser?._id || null,
      bankAccountDetails,
      features,
      pricing: {
        emiCardQuantity,
        verificationCreditQuantity,
        emiCardPrice,
        verificationCreditPrice,
        totalAmount,
        cgst,
        sgst,
        totalPayableAmount,
      },
      cardQuantity: emiCardQuantity,
      verificationCredit: verificationCreditQuantity,
      cardRate: emiCardPrice,
      verificationCreditRate: verificationCreditPrice,
      cardAmount: emiCardQuantity * emiCardPrice,
      verificationCreditAmount:
        verificationCreditQuantity * verificationCreditPrice,
      subTotalAmount: totalAmount,
      cgst,
      sgst,
      totalAmountPaid: totalPayableAmount,
      totalEmiCards: emiCardQuantity,
      availableEmiCards: emiCardQuantity,
      totalVerificationCredits: verificationCreditQuantity,
      availableVerificationCredits: verificationCreditQuantity,
      paymentMethod: paymentMethodMapped,
      paymentStatus: paymentStatusMapped,
      paymentGatewayOrderId: gatewayOrderId,
      paymentLinkId: paymentLinkResult?.paymentLinkId || null,
      paymentLink: paymentLinkResult?.paymentLink || null,
      paymentGatewayTransactionId: transactionId,
      tempOtp: tempOtpHash,
      tempOtpExpires,
      documents: {
        registrationCertificate: regCertUpload.url,
        registrationCertificateKey: regCertUpload.key,
        companyPan: panUpload.url,
        companyPanKey: panUpload.key,
        boardResolution: boardResUpload.url,
        boardResolutionKey: boardResUpload.key,
        gstDeclaration: gstUpload.url,
        gstDeclarationKey: gstUpload.key,
        directorKyc: directorKycUpload.url,
        directorKycKey: directorKycUpload.key,
        cancelledCheque: cancelledChequeUpload.url,
        cancelledChequeKey: cancelledChequeUpload.key,
      },
      status: bankStatusMapped,
      createdBy: finalCreatedBy,
      onboardingTeamMemberId,
      verifiedBy: isDirectApproved ? finalCreatedBy : null,
      verifiedAt: isDirectApproved ? new Date() : null,
    });

    await bank.save();

    // Auto-seed predefined roles for newly created Co-operative Bank
    try {
      await societyRoleService.ensurePredefinedRolesForBank(bank._id);
    } catch (seedErr) {
      logger.warn(`PREDEFINED ROLES SEEDING FAILED for Bank ${bank._id}: ${seedErr.message}`);
    }

    // If Cash payment, dispatch OTP via MSG91
    if (paymentMethodMapped === "CASH" && rawOtp) {
      try {
        await smsManager.sendOtp(
          phoneNumber,
          rawOtp,
          smsConfig.templates.BANK_ONBOARDING_ALERT.templateId,
        );
        logger.info(
          `CASH PAYMENT OTP DISPATCHED: MSG91 OTP sent to ${phoneNumber} for Bank [${name}]`,
        );
      } catch (smsError) {
        logger.error(`CASH PAYMENT OTP DISPATCH FAILED: ${smsError.message}`);
      }
    }

    // Log the initial credit purchase in CreditLog if already approved
    if (bankStatusMapped === "ACTIVE" || bankStatusMapped === "APPROVED") {
      if (emiCardQuantity > 0) {
        await CreditLog.create({
          bankId: bank._id,
          type: "EMI_CARD",
          action: "PURCHASE",
          amount: emiCardQuantity,
          description: `Purchased initial ${emiCardQuantity} EMI Cards during bank manual registration.`,
        });
      }

      if (verificationCreditQuantity > 0) {
        await CreditLog.create({
          bankId: bank._id,
          type: "VERIFICATION_CREDIT",
          action: "PURCHASE",
          amount: verificationCreditQuantity,
          description: `Purchased initial ${verificationCreditQuantity} Verification Credits during bank manual registration.`,
        });
      }
    }

    await bank.populate([
      { path: "createdBy", select: "fullName name email phoneNumber role" },
      {
        path: "onboardingTeamMemberId",
        select: "fullName phone email onboardingTeamType region userId",
      },
      {
        path: "cashCollectedByTeamId",
        select: "fullName phone email onboardingTeamType region userId",
      },
      { path: "verifiedBy", select: "fullName name email phoneNumber role" },
      { path: "rejectedBy", select: "fullName name email phoneNumber role" },
    ]);

    const formattedBank = this.formatBankResponse(bank);

    if (paymentMethodMapped === "CASH") {
      return {
        ...formattedBank,
        requiresOtp: true,
        otpSentTo: phoneNumber,
        message: `A 6 digit OTP has been sent to customer mobile number ${phoneNumber}`,
        otp: rawOtp,
        testOtp: "123456",
      };
    }

    if (razorpayOrderDetails || paymentLinkResult) {
      return {
        ...formattedBank,
        requiresOtp: false,
        paymentGateway: "RAZORPAY",
        paymentMethod: "RAZORPAY",
        paymentStatus: "PENDING",
        status: "PENDING",
        paymentLink: paymentLinkResult?.paymentLink || null,
        paymentLinkId: paymentLinkResult?.paymentLinkId || null,
        razorpayKeyId:
          razorpayOrderDetails?.keyId || razorpayHelper.keyId || null,
        razorpayKey:
          razorpayOrderDetails?.keyId || razorpayHelper.keyId || null,
        keyId: razorpayOrderDetails?.keyId || razorpayHelper.keyId || null,
        orderId: gatewayOrderId,
        amount: totalPayableAmount,
        amountInPaise:
          razorpayOrderDetails?.amountInPaise ||
          Math.round(totalPayableAmount * 100),
        currency: "INR",
        prefill: {
          name: ubo || name,
          email: email,
          contact: phoneNumber,
        },
        razorpayOrder: razorpayOrderDetails,
        message:
          "Bank creation initiated. Please complete online payment via link or Razorpay Checkout to approve.",
      };
    }

    return formattedBank;
  }

  /**
   * Update existing Co-operative Bank
   */
  /**
   * Update existing Co-operative Bank
   */
  async updateCooperativeBank(id, payload, files = {}, updaterId) {
    const bank = await Bank.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!bank) {
      throw ApiError.notFound("Co-operative Bank not found for update.");
    }

    const name = payload.bankName || payload.name;
    if (name) {
      const cleanName = name.trim();
      const existingName = await Bank.findOne({
        _id: { $ne: id },
        name: { $regex: `^${cleanName}$`, $options: "i" },
        isDeleted: { $ne: true },
      });
      if (existingName) {
        throw ApiError.conflict(
          "A Co-operative Bank with this name already exists.",
          ErrorCode.VALIDATION_ERROR,
        );
      }
      bank.name = cleanName;
    }

    const ubo = payload.authorizedPerson || payload.ubo;
    if (ubo) {
      bank.ubo = ubo.trim();
    }

    if (payload.code) {
      bank.code = payload.code.trim().toUpperCase();
    }

    if (payload.email) {
      const newEmail = payload.email.trim().toLowerCase();
      if (newEmail !== bank.email) {
        const existingEmailBank = await Bank.findOne({
          _id: { $ne: id },
          $or: [{ email: newEmail }, { alternateEmail: newEmail }],
          isDeleted: { $ne: true },
        });
        if (existingEmailBank) {
          throw ApiError.conflict(
            "A Co-operative Bank with this email address already exists.",
            ErrorCode.VALIDATION_ERROR,
          );
        }
        const existingBranchEmail = await Branch.findOne({
          email: { $regex: `^${newEmail}$`, $options: "i" },
          isDeleted: { $ne: true },
        });
        if (existingBranchEmail) {
          throw ApiError.conflict(
            "A branch with this email address already exists.",
            ErrorCode.VALIDATION_ERROR,
          );
        }
        bank.email = newEmail;
        if (bank.userId) {
          await User.updateOne(
            { _id: bank.userId },
            { email: newEmail, updatedBy: updaterId },
          );
        }
      }
    }

    if (
      payload.alternateEmail !== undefined ||
      payload.mailIdAlternate !== undefined
    ) {
      const alt = payload.alternateEmail || payload.mailIdAlternate;
      const cleanAlt = alt ? alt.trim().toLowerCase() : null;
      if (cleanAlt) {
        const altRegex = new RegExp(`^${cleanAlt}$`, "i");
        const existingAltBank = await Bank.findOne({
          _id: { $ne: id },
          $or: [{ email: altRegex }, { alternateEmail: altRegex }],
          isDeleted: { $ne: true },
        });
        if (existingAltBank) {
          throw ApiError.conflict(
            "A Co-operative Bank with this alternate email address already exists.",
            ErrorCode.VALIDATION_ERROR,
          );
        }
        const existingAltBranch = await Branch.findOne({
          email: altRegex,
          isDeleted: { $ne: true },
        });
        if (existingAltBranch) {
          throw ApiError.conflict(
            "A branch with this alternate email address already exists.",
            ErrorCode.VALIDATION_ERROR,
          );
        }
      }
      bank.alternateEmail = cleanAlt;
    }

    if (payload.phoneNumber || payload.phone) {
      const newPhone = (payload.phoneNumber || payload.phone).trim();
      if (newPhone !== bank.phoneNumber) {
        const phoneRegex = new RegExp(`(${newPhone}|${newPhone.slice(-10)})$`);
        const existingPhoneBank = await Bank.findOne({
          _id: { $ne: id },
          $or: [{ phoneNumber: newPhone }, { phoneNumber: phoneRegex }],
          isDeleted: { $ne: true },
        });
        if (existingPhoneBank) {
          throw ApiError.conflict(
            "A Co-operative Bank with this mobile number already exists.",
            ErrorCode.VALIDATION_ERROR,
          );
        }
        const existingPhoneBranch = await Branch.findOne({
          $or: [{ phoneNumber: newPhone }, { phoneNumber: phoneRegex }],
          isDeleted: { $ne: true },
        });
        if (existingPhoneBranch) {
          throw ApiError.conflict(
            "A branch with this mobile number already exists.",
            ErrorCode.VALIDATION_ERROR,
          );
        }
        bank.phoneNumber = newPhone;
        if (bank.userId) {
          await User.updateOne(
            { _id: bank.userId },
            { phoneNumber: newPhone, updatedBy: updaterId },
          );
        }
      }
    }

    if (payload.credit !== undefined) {
      bank.credit = parseFloat(payload.credit);
    }

    if (payload.status) {
      let st = payload.status.trim().toUpperCase();
      if (st === "ACTIVE") {
        st = "APPROVED";
      }
      bank.status = st;

      if (st === "APPROVED") {
        const existingUser = await User.findOne({
          email: bank.email,
          isDeleted: { $ne: true },
        });
        if (!existingUser) {
          const passwordHash = bank.passwordHash || (await bcrypt.hash("Password@123", 10));
          const bankUser = new User({
            email: bank.email,
            phoneNumber: bank.phoneNumber,
            passwordHash,
            role: UserRole.BANK_OWNER,
            userType: UserType.PARTNER,
            status: "ACTIVE",
            createdBy: updaterId,
          });
          await bankUser.save();
          bank.userId = bankUser._id;
        } else {
          bank.userId = existingUser._id;
          existingUser.role = UserRole.BANK_OWNER;
          if (bank.passwordHash) {
            existingUser.passwordHash = bank.passwordHash;
          }
          if (existingUser.status !== "ACTIVE") {
            existingUser.status = "ACTIVE";
          }
          await existingUser.save();
        }
      }
    }

    // Update Bank Account Details
    const accountDetailsInput = parseBankAccountDetails(payload);
    if (!bank.bankAccountDetails) {
      bank.bankAccountDetails = {};
    }
    if (accountDetailsInput.bankName !== null)
      bank.bankAccountDetails.bankName = accountDetailsInput.bankName;
    if (accountDetailsInput.accountNumber !== null) {
      const cleanAcc = String(accountDetailsInput.accountNumber).trim();
      if (cleanAcc && cleanAcc !== (bank.bankAccountDetails?.accountNumber || "")) {
        const existingAccount = await Bank.findOne({
          _id: { $ne: id },
          "bankAccountDetails.accountNumber": { $regex: new RegExp(`^${cleanAcc}$`, "i") },
          isDeleted: { $ne: true },
        });
        if (existingAccount) {
          throw ApiError.conflict(
            "This bank account number is already registered to another bank.",
            ErrorCode.VALIDATION_ERROR,
          );
        }
      }
      bank.bankAccountDetails.accountNumber = cleanAcc;
    }
    if (accountDetailsInput.ifsc !== null)
      bank.bankAccountDetails.ifsc = accountDetailsInput.ifsc;
    if (accountDetailsInput.accountHolder !== null)
      bank.bankAccountDetails.accountHolder = accountDetailsInput.accountHolder;

    // Update Features / Modules
    const parsedFeatures = parseFeatures(payload);
    if (parsedFeatures !== null) {
      bank.features = parsedFeatures;
    }

    const inputPassword = payload.password || payload.newPassword;
    if (inputPassword) {
      const password = String(inputPassword).trim();
      if (password.length >= 6) {
        const passwordHash = await bcrypt.hash(password, 10);
        bank.passwordHash = passwordHash;
        if (bank.userId) {
          await User.updateOne(
            { _id: bank.userId },
            { passwordHash, updatedBy: updaterId },
          );
        } else {
          let bankUser = await User.findOne({
            email: bank.email,
            isDeleted: { $ne: true },
          });
          if (!bankUser) {
            bankUser = new User({
              email: bank.email,
              phoneNumber: bank.phoneNumber,
              passwordHash,
              role: UserRole.VENDOR,
              userType: UserType.PARTNER,
              status: bank.status || "ACTIVE",
              createdBy: updaterId,
            });
            await bankUser.save();
          } else {
            bankUser.passwordHash = passwordHash;
            bankUser.updatedBy = updaterId;
            await bankUser.save();
          }
          bank.userId = bankUser._id;
        }
      }
    }

    if (payload.paymentMethod !== undefined) {
      bank.paymentMethod = mapPaymentMethod(payload.paymentMethod);
    }
    if (payload.paymentStatus !== undefined) {
      bank.paymentStatus = payload.paymentStatus
        ? payload.paymentStatus.toUpperCase()
        : null;
    }
    if (
      payload.transactionId !== undefined ||
      payload.paymentGatewayTransactionId !== undefined
    ) {
      bank.paymentGatewayTransactionId =
        (
          payload.transactionId ||
          payload.paymentGatewayTransactionId ||
          ""
        ).trim() || null;
    }

    if (!bank.pricing) {
      bank.pricing = {};
    }

    // Capture deltas for top level quantities
    if (payload.emiCardQuantity !== undefined) {
      const newQty = parseInt(payload.emiCardQuantity, 10);
      const oldQty = bank.cardQuantity || bank.pricing.emiCardQuantity || 0;
      const diff = newQty - oldQty;
      bank.pricing.emiCardQuantity = newQty;
      bank.cardQuantity = newQty;
      bank.totalEmiCards = (bank.totalEmiCards || 0) + diff;
      bank.availableEmiCards = (bank.availableEmiCards || 0) + diff;
      if (bank.totalEmiCards < 0) bank.totalEmiCards = 0;
      if (bank.availableEmiCards < 0) bank.availableEmiCards = 0;
    }

    if (payload.verificationCreditQuantity !== undefined) {
      const newQty = parseInt(payload.verificationCreditQuantity, 10);
      const oldQty =
        bank.verificationCredit || bank.pricing.verificationCreditQuantity || 0;
      const diff = newQty - oldQty;
      bank.pricing.verificationCreditQuantity = newQty;
      bank.verificationCredit = newQty;
      bank.totalVerificationCredits =
        (bank.totalVerificationCredits || 0) + diff;
      bank.availableVerificationCredits =
        (bank.availableVerificationCredits || 0) + diff;
      if (bank.totalVerificationCredits < 0) bank.totalVerificationCredits = 0;
      if (bank.availableVerificationCredits < 0)
        bank.availableVerificationCredits = 0;
    }

    if (payload.emiCardPrice !== undefined) {
      const price = parseFloat(payload.emiCardPrice);
      bank.pricing.emiCardPrice = price;
      bank.cardRate = price;
    }
    if (payload.verificationCreditPrice !== undefined) {
      const price = parseFloat(payload.verificationCreditPrice);
      bank.pricing.verificationCreditPrice = price;
      bank.verificationCreditRate = price;
    }

    // Recompute total amount/rates
    const cardPrice =
      bank.pricing.emiCardPrice !== undefined
        ? bank.pricing.emiCardPrice
        : bank.cardRate || 11000;
    const cardQty =
      bank.pricing.emiCardQuantity !== undefined
        ? bank.pricing.emiCardQuantity
        : bank.cardQuantity || 0;
    const creditPrice =
      bank.pricing.verificationCreditPrice !== undefined
        ? bank.pricing.verificationCreditPrice
        : bank.verificationCreditRate || 11000;
    const creditQty =
      bank.pricing.verificationCreditQuantity !== undefined
        ? bank.pricing.verificationCreditQuantity
        : bank.verificationCredit || 0;

    bank.cardAmount = cardQty * cardPrice;
    bank.verificationCreditAmount = creditQty * creditPrice;
    bank.subTotalAmount = bank.cardAmount + bank.verificationCreditAmount;

    const computedTotalAmount = bank.subTotalAmount;
    bank.pricing.totalAmount = computedTotalAmount;

    if (payload.totalAmount !== undefined) {
      bank.pricing.totalAmount = parseFloat(payload.totalAmount);
      bank.subTotalAmount = parseFloat(payload.totalAmount);
    }

    if (payload.cgst !== undefined) {
      const cgstVal = parseFloat(payload.cgst);
      bank.pricing.cgst = cgstVal;
      bank.cgst = cgstVal;
    }
    if (payload.sgst !== undefined) {
      const sgstVal = parseFloat(payload.sgst);
      bank.pricing.sgst = sgstVal;
      bank.sgst = sgstVal;
    }

    const computedTotalPayable =
      bank.pricing.totalAmount +
      (bank.pricing.cgst || 0) +
      (bank.pricing.sgst || 0);
    bank.pricing.totalPayableAmount = computedTotalPayable;
    bank.totalAmountPaid = computedTotalPayable;

    if (payload.totalPayableAmount !== undefined) {
      const payableVal = parseFloat(payload.totalPayableAmount);
      bank.pricing.totalPayableAmount = payableVal;
      bank.totalAmountPaid = payableVal;
    }

    if (files.logo || files.bankLogo) {
      const upload = await this.processFileUpload(files.logo || files.bankLogo);
      if (upload.url) {
        bank.logo = upload.url;
        bank.logoKey = upload.key;
      }
    }

    const docs = bank.documents || {};

    if (files.registrationCertificate) {
      const upload = await this.processFileUpload(
        files.registrationCertificate,
      );
      if (upload.url) {
        docs.registrationCertificate = upload.url;
        docs.registrationCertificateKey = upload.key;
      }
    }

    if (files.companyPan) {
      const upload = await this.processFileUpload(files.companyPan);
      if (upload.url) {
        docs.companyPan = upload.url;
        docs.companyPanKey = upload.key;
      }
    }

    if (files.boardResolution) {
      const upload = await this.processFileUpload(files.boardResolution);
      if (upload.url) {
        docs.boardResolution = upload.url;
        docs.boardResolutionKey = upload.key;
      }
    }

    if (files.gstDeclaration) {
      const upload = await this.processFileUpload(files.gstDeclaration);
      if (upload.url) {
        docs.gstDeclaration = upload.url;
        docs.gstDeclarationKey = upload.key;
      }
    }

    if (files.directorKyc) {
      const upload = await this.processFileUpload(files.directorKyc);
      if (upload.url) {
        docs.directorKyc = upload.url;
        docs.directorKycKey = upload.key;
      }
    }

    if (files.cancelledCheque) {
      const upload = await this.processFileUpload(files.cancelledCheque);
      if (upload.url) {
        docs.cancelledCheque = upload.url;
        docs.cancelledChequeKey = upload.key;
      }
    }

    if (payload.createdBy !== undefined || payload.creatorId !== undefined) {
      let cId = payload.createdBy || payload.creatorId;
      if (cId) {
        if (typeof cId === "object") cId = cId._id || cId.id || cId.userId;
        const teamMember = await OnboardingTeam.findById(cId);
        bank.createdBy = teamMember?.userId || cId;
      }
    }

    if (
      payload.onboardingTeamMemberId !== undefined ||
      payload.onboardedBy !== undefined
    ) {
      let otId = payload.onboardingTeamMemberId || payload.onboardedBy;
      if (otId) {
        if (typeof otId === "object") otId = otId._id || otId.id || otId.teamMemberId;
        const member = await OnboardingTeam.findOne({
          $or: [{ _id: otId }, { userId: otId }],
          isDeleted: { $ne: true },
        });
        if (member) bank.onboardingTeamMemberId = member._id;
      }
    }

    bank.documents = docs;
    bank.updatedBy = updaterId;
    if (typeof bank.markModified === "function") {
      bank.markModified("documents");
      bank.markModified("bankAccountDetails");
      bank.markModified("pricing");
    }
    await bank.save();

    await bank.populate([
      { path: "createdBy", select: "fullName name email phoneNumber role" },
      {
        path: "onboardingTeamMemberId",
        select: "fullName phone email onboardingTeamType region userId",
      },
      {
        path: "cashCollectedByTeamId",
        select: "fullName phone email onboardingTeamType region userId",
      },
      { path: "verifiedBy", select: "fullName name email phoneNumber role" },
      { path: "rejectedBy", select: "fullName name email phoneNumber role" },
    ]);

    return this.formatBankResponse(bank);
  }

  /**
   * Change password for a Co-operative Bank account
   */
  async changeBankPassword(id, payload, updaterId) {
    if (!id) {
      throw ApiError.badRequest("Bank ID is required.", ErrorCode.VALIDATION_ERROR);
    }

    const bank = await Bank.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!bank) {
      throw ApiError.notFound("Co-operative Bank not found.");
    }

    const newPwd = (payload.newPassword || payload.password || "").trim();
    if (!newPwd || newPwd.length < 6) {
      throw ApiError.badRequest(
        "New password must be at least 6 characters long.",
        ErrorCode.VALIDATION_ERROR,
      );
    }

    if (payload.confirmPassword && payload.confirmPassword.trim() !== newPwd) {
      throw ApiError.badRequest(
        "New password and confirm password do not match.",
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const passwordHash = await bcrypt.hash(newPwd, 10);
    bank.passwordHash = passwordHash;
    bank.updatedBy = updaterId;

    if (bank.userId) {
      await User.updateOne(
        { _id: bank.userId },
        { passwordHash, updatedBy: updaterId },
      );
    } else {
      let bankUser = await User.findOne({
        email: bank.email,
        isDeleted: { $ne: true },
      });
      if (!bankUser) {
        bankUser = new User({
          email: bank.email,
          phoneNumber: bank.phoneNumber,
          passwordHash,
          role: UserRole.VENDOR,
          userType: UserType.PARTNER,
          status: bank.status || "ACTIVE",
          createdBy: updaterId,
        });
        await bankUser.save();
      } else {
        bankUser.passwordHash = passwordHash;
        bankUser.updatedBy = updaterId;
        await bankUser.save();
      }
      bank.userId = bankUser._id;
    }

    await bank.save();

    return {
      id: bank._id,
      bankId: bank._id,
      bankName: bank.name,
      name: bank.name,
      email: bank.email,
      message: "Co-operative Bank password changed successfully.",
    };
  }

  /**
   * Soft delete Co-operative Bank
   */
  async deleteCooperativeBank(id, deleterId) {
    const bank = await Bank.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!bank) {
      throw ApiError.notFound("Co-operative Bank not found for deletion.");
    }

    bank.isDeleted = true;
    bank.deletedAt = new Date();
    bank.deletedBy = deleterId;
    await bank.save();

    return { id: bank._id, message: "Co-operative Bank deleted successfully." };
  }

  /**
   * Permanent (Hard) delete Co-operative Bank and associated records
   */
  async permanentDeleteCooperativeBank(id, deleterId) {
    const bank = await Bank.findById(id);
    if (!bank) {
      throw ApiError.notFound("Co-operative Bank not found for permanent deletion.");
    }

    // 1. Delete associated User account
    if (bank.userId) {
      await User.deleteOne({ _id: bank.userId });
    }
    if (bank.email) {
      await User.deleteMany({ email: bank.email.trim().toLowerCase() });
    }

    // 2. Delete associated Branches, Managers, Employees, and Roles
    await Promise.all([
      Branch.deleteMany({ bankId: bank._id }),
      BranchManager.deleteMany({ bankId: bank._id }),
      SocietyEmployee.deleteMany({ bankId: bank._id }),
      SocietyRole.deleteMany({ bankId: bank._id })
    ]);

    // 3. Permanently remove Bank document from collection
    await Bank.deleteOne({ _id: bank._id });

    logger.info(`PERMANENT DELETE: Co-operative Bank [${bank.name}] (${bank._id}) permanently deleted by User [${deleterId}]`);

    return {
      id: bank._id,
      bankName: bank.name,
      message: "Co-operative Bank and associated records permanently deleted successfully."
    };
  }

  /**
 * Get Overview statistics for Co-operative Bank panel cards
 */
  async getCooperativeBankStats() {
    const filter = { isDeleted: { $ne: true } };

    // Run a single roundtrip aggregation using $facet
    const [statsResult] = await Bank.aggregate([
      { $match: filter },
      {
        $facet: {
          statusCounts: [
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
              },
            },
          ],
          totals: [
            {
              $group: {
                _id: null,
                totalBanks: { $sum: 1 },
                totalRevenue: { $sum: { $ifNull: ['$totalAmountPaid', 0] } },
              },
            },
          ],
        },
      },
    ]);

    const statusMap = {};
    (statsResult?.statusCounts || []).forEach((item) => {
      if (item._id) {
        statusMap[item._id] = item.count;
      }
    });

    const totals = statsResult?.totals?.[0] || {};
    const totalBanks = totals.totalBanks || 0;

    const activeBanks = (statusMap['ACTIVE'] || 0) + (statusMap['APPROVED'] || 0);
    const pendingBanks = (statusMap['PENDING'] || 0) + (statusMap['ON_VERIFICATION'] || 0);
    const rejectedOrInactive =
      (statusMap['REJECTED'] || 0) +
      (statusMap['INACTIVE'] || 0) +
      (statusMap['BLOCKED'] || 0);

    const totalRevenue = totals.totalRevenue || 0;

    return {
      summaryCards: {
        totalBanks: {
          title: "Total Co-operative Banks",
          count: totalBanks,
          formattedCount: totalBanks.toLocaleString('en-IN'),
        },
        activeBanks: {
          title: "Active Banks",
          count: activeBanks,
          formattedCount: activeBanks.toLocaleString('en-IN'),
        },
        pendingApproval: {
          title: 'Pending Verification',
          count: pendingBanks,
          formattedCount: pendingBanks.toLocaleString('en-IN'),
          needsAttention: pendingBanks > 0,
        },
        rejectedOrInactive: {
          title: 'Rejected / Inactive',
          count: rejectedOrInactive,
          formattedCount: rejectedOrInactive.toLocaleString('en-IN'),
        },
        totalRevenue: {
          title: 'Total Onboarding Revenue',
          amount: totalRevenue,
          formattedAmount: this.formatCurrency(totalRevenue),
        },
      },
    };
  }


  /**
   * List active banks for dropdown selections
   */
  async listCooperativeBanksDropdown() {
    const banks = await Bank.find({
      isDeleted: { $ne: true },
      status: { $in: ["ACTIVE", "APPROVED"] },
    })
      .select("_id name code logo email phoneNumber credit ubo")
      .sort({ name: 1 })
      .lean();

    return banks.map((b) => ({
      id: b._id,
      bankId: b._id,
      name: b.name,
      code: b.code,
      label: b.name,
      credit: b.credit,
      formattedCredit: this.formatCurrency(b.credit || 0),
    }));
  }

  /**
   * Update bank status (e.g. APPROVED, REJECTED, PENDING, ON_VERIFICATION, INACTIVE, BLOCKED). If frontend passes ACTIVE, map it to APPROVED.
   */
  async updateBankStatus(id, status, updaterId, remarks = null) {
    const bank = await Bank.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!bank) {
      throw ApiError.notFound("Co-operative Bank not found.");
    }

    let newStatus = String(status).trim().toUpperCase();
    if (newStatus === "ACTIVE") {
      newStatus = "APPROVED";
    }

    const validStatuses = [
      "PENDING",
      "ON_VERIFICATION",
      "APPROVED",
      "REJECTED",
      "INACTIVE",
      "BLOCKED",
    ];
    if (!validStatuses.includes(newStatus)) {
      throw ApiError.badRequest("Invalid status value.");
    }

    if (newStatus === "REJECTED") {
      const cleanRemarks = (remarks || "").trim();
      if (!cleanRemarks) {
        throw ApiError.badRequest(
          "Remarks are mandatory when rejecting a bank onboarding request.",
          ErrorCode.VALIDATION_ERROR,
        );
      }
      bank.remarks = cleanRemarks;
      bank.rejectionRemarks = cleanRemarks;
      bank.rejectionReason = cleanRemarks;
      bank.rejectedAt = new Date();
      bank.rejectedBy = updaterId;
      bank.verifiedBy = null;
      bank.verifiedAt = null;
    } else if (newStatus === "APPROVED") {
      if (
        bank.paymentStatus === "PENDING" ||
        (bank.paymentMethod && bank.paymentStatus !== "SUCCESS")
      ) {
        throw ApiError.badRequest(
          "Cannot approve bank application while onboarding payment is pending. Payment must be completed/verified first.",
          ErrorCode.BAD_REQUEST,
        );
      }
      bank.verifiedBy = updaterId;
      bank.verifiedAt = new Date();
      bank.rejectedBy = null;
      bank.rejectedAt = null;
      if (remarks) {
        bank.remarks = remarks.trim();
      }
    }

    bank.status = newStatus;
    bank.updatedBy = updaterId;
    await bank.save();

    // If APPROVED, check if user account exists, otherwise create it
    if (newStatus === "APPROVED") {
      const existingUser = await User.findOne({
        email: bank.email,
        isDeleted: { $ne: true },
      });
      if (!existingUser) {
        const passwordHash = bank.passwordHash || (await bcrypt.hash("Password@123", 10));
        const bankUser = new User({
          email: bank.email,
          phoneNumber: bank.phoneNumber,
          passwordHash,
          role: UserRole.BANK_OWNER,
          userType: UserType.PARTNER,
          status: "ACTIVE",
          createdBy: updaterId,
        });
        await bankUser.save();
        bank.userId = bankUser._id;
        await bank.save();
      } else {
        bank.userId = existingUser._id;
        existingUser.role = UserRole.BANK_OWNER;
        if (bank.passwordHash) {
          existingUser.passwordHash = bank.passwordHash;
        }
        if (existingUser.status !== "ACTIVE") {
          existingUser.status = "ACTIVE";
        }
        await existingUser.save();
        await bank.save();
      }
    }

    await bank.populate([
      { path: "createdBy", select: "fullName name email phoneNumber role" },
      {
        path: "onboardingTeamMemberId",
        select: "fullName phone email onboardingTeamType region userId",
      },
      {
        path: "cashCollectedByTeamId",
        select: "fullName phone email onboardingTeamType region userId",
      },
      { path: "verifiedBy", select: "fullName name email phoneNumber role" },
      { path: "rejectedBy", select: "fullName name email phoneNumber role" },
    ]);

    return this.formatBankResponse(bank);
  }

  /**
   * Verify Cash OTP sent to customer phone number via MSG91
   */
  async verifyCashOtp(payload) {
    const bankId = payload.bankId || payload.id;
    const otp = (payload.otp || "").trim();

    if (!bankId) {
      throw ApiError.badRequest("Bank ID is required.");
    }
    if (!otp) {
      throw ApiError.badRequest("OTP is required.");
    }

    const bank = await Bank.findOne({ _id: bankId, isDeleted: { $ne: true } });
    if (!bank) {
      throw ApiError.notFound("Co-operative Bank not found.");
    }

    if (!bank.tempOtp || !bank.tempOtpExpires) {
      throw ApiError.badRequest(
        "No pending Cash OTP verification found for this bank.",
      );
    }

    const isTestingOtp = otp === "123456";

    if (new Date() > bank.tempOtpExpires && !isTestingOtp) {
      throw ApiError.badRequest(
        "Verification OTP has expired. Please request a new OTP.",
        ErrorCode.OTP_EXPIRED,
      );
    }

    const isValid =
      isTestingOtp || (await cryptoUtil.compare(otp, bank.tempOtp));
    if (!isValid) {
      throw ApiError.badRequest(
        "Invalid 6-digit OTP code.",
        ErrorCode.OTP_INVALID,
      );
    }

    // Mark Cash payment SUCCESS and approve bank
    bank.tempOtp = null;
    bank.tempOtpExpires = null;
    bank.paymentStatus = "SUCCESS";
    bank.status = "APPROVED";

    const existingUser = await User.findOne({
      email: bank.email,
      isDeleted: { $ne: true },
    });
    if (!existingUser) {
      const passwordHash = bank.passwordHash || (await bcrypt.hash("Password@123", 10));
      const bankUser = new User({
        email: bank.email,
        phoneNumber: bank.phoneNumber,
        passwordHash,
        role: UserRole.VENDOR,
        userType: UserType.PARTNER,
        status: "ACTIVE",
      });
      await bankUser.save();
      bank.userId = bankUser._id;
    } else {
      bank.userId = existingUser._id;
      if (bank.passwordHash) {
        existingUser.passwordHash = bank.passwordHash;
      }
      if (existingUser.status !== "ACTIVE") {
        existingUser.status = "ACTIVE";
      }
      await existingUser.save();
    }

    await bank.save();

    // Audit initial credit purchases
    const existingLog = await CreditLog.findOne({ bankId: bank._id });
    if (!existingLog) {
      if ((bank.cardQuantity || 0) > 0) {
        await CreditLog.create({
          bankId: bank._id,
          type: "EMI_CARD",
          action: "PURCHASE",
          amount: bank.cardQuantity,
          description: `Purchased initial ${bank.cardQuantity} EMI Cards via verified Cash payment.`,
        });
      }
      if ((bank.verificationCredit || 0) > 0) {
        await CreditLog.create({
          bankId: bank._id,
          type: "VERIFICATION_CREDIT",
          action: "PURCHASE",
          amount: bank.verificationCredit,
          description: `Purchased initial ${bank.verificationCredit} Verification Credits via verified Cash payment.`,
        });
      }
    }

    logger.info(
      `CASH PAYMENT VERIFIED: Bank [${bank.name}] approved successfully.`,
    );

    return {
      success: true,
      message: "Cash payment verified and bank approved successfully.",
      bank: this.formatBankResponse(bank),
    };
  }

  /**
   * Resend Cash verification OTP via MSG91
   */
  async resendCashOtp(payload) {
    const bankId = payload.bankId || payload.id;
    if (!bankId) {
      throw ApiError.badRequest("Bank ID is required.");
    }

    const bank = await Bank.findOne({ _id: bankId, isDeleted: { $ne: true } });
    if (!bank) {
      throw ApiError.notFound("Co-operative Bank not found.");
    }

    const rawOtp = generateOtp(6, { numericOnly: true });
    bank.tempOtp = await cryptoUtil.hash(rawOtp);
    bank.tempOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await bank.save();

    try {
      await smsManager.sendOtp(
        bank.phoneNumber,
        rawOtp,
        smsConfig.templates.BANK_ONBOARDING_ALERT.templateId,
      );
      logger.info(
        `CASH PAYMENT OTP RESEND: Dispatched MSG91 OTP to ${bank.phoneNumber} for Bank [${bank.name}]`,
      );
    } catch (smsError) {
      logger.error(`CASH PAYMENT OTP RESEND FAILED: ${smsError.message}`);
    }

    return {
      success: true,
      message: `A 6 digit OTP has been sent to customer mobile number ${bank.phoneNumber}`,
      otpSentTo: bank.phoneNumber,
      otp: rawOtp,
      testOtp: "123456",
    };
  }

  /**
   * Verify Online Payment (Razorpay signature / transaction confirmation)
   */
  async verifyOnlinePayment(payload) {
    const bankId = payload.bankId || payload.id;
    if (!bankId) {
      throw ApiError.badRequest("Bank ID is required.");
    }

    const bank = await Bank.findOne({ _id: bankId, isDeleted: { $ne: true } });
    if (!bank) {
      throw ApiError.notFound("Co-operative Bank not found.");
    }

    if (payload.razorpay_signature) {
      const isValid = razorpayHelper.verifyPaymentSignature(payload);
      if (!isValid) {
        throw ApiError.badRequest("Invalid Razorpay payment signature.");
      }
    }

    const txnId =
      payload.razorpay_payment_id ||
      payload.transactionId ||
      payload.paymentGatewayTransactionId ||
      `txn_${Date.now()}`;

    bank.paymentStatus = "SUCCESS";
    bank.status = "APPROVED";
    bank.paymentGatewayTransactionId = txnId;

    const existingUser = await User.findOne({
      email: bank.email,
      isDeleted: { $ne: true },
    });
    if (!existingUser) {
      const passwordHash = bank.passwordHash || (await bcrypt.hash("Password@123", 10));
      const bankUser = new User({
        email: bank.email,
        phoneNumber: bank.phoneNumber,
        passwordHash,
        role: UserRole.VENDOR,
        userType: UserType.PARTNER,
        status: "ACTIVE",
      });
      await bankUser.save();
      bank.userId = bankUser._id;
    } else {
      bank.userId = existingUser._id;
      if (bank.passwordHash) {
        existingUser.passwordHash = bank.passwordHash;
      }
      if (existingUser.status !== "ACTIVE") {
        existingUser.status = "ACTIVE";
      }
      await existingUser.save();
    }

    await bank.save();

    const existingLog = await CreditLog.findOne({ bankId: bank._id });
    if (!existingLog) {
      if ((bank.cardQuantity || 0) > 0) {
        await CreditLog.create({
          bankId: bank._id,
          type: "EMI_CARD",
          action: "PURCHASE",
          amount: bank.cardQuantity,
          description: `Purchased initial ${bank.cardQuantity} EMI Cards via verified online payment.`,
        });
      }
      if ((bank.verificationCredit || 0) > 0) {
        await CreditLog.create({
          bankId: bank._id,
          type: "VERIFICATION_CREDIT",
          action: "PURCHASE",
          amount: bank.verificationCredit,
          description: `Purchased initial ${bank.verificationCredit} Verification Credits via verified online payment.`,
        });
      }
    }

    logger.info(
      `ONLINE PAYMENT VERIFIED: Bank [${bank.name}] approved successfully.`,
    );

    return {
      success: true,
      message: "Online payment verified and bank approved successfully.",
      bank: this.formatBankResponse(bank),
    };
  }

  /**
   * Razorpay Webhook Handler for Co-operative Bank payment auto-update & approval
   */
  async handlePaymentWebhook(headers, body, rawBody) {
    const isValidSignature = razorpayHelper.verifyWebhookSignature(
      headers,
      rawBody || body,
    );
    if (!isValidSignature) {
      throw ApiError.badRequest("Invalid Razorpay webhook signature hash.");
    }

    let txnId = "";
    let isSuccess = false;

    const payload = typeof body === "object" && body !== null ? body : {};
    const payment = payload.payload?.payment?.entity;
    const order = payload.payload?.order?.entity;
    const paymentLink = payload.payload?.payment_link?.entity;

    const candidateIds = [
      paymentLink?.id,
      paymentLink?.reference_id,
      order?.receipt,
      body.paymentLinkId,
      body.razorpay_order_id,
      body.orderId,
      body.paymentOrderId,
      body.gatewayOrderId,
      order?.id,
      payment?.order_id,
      payment?.id,
      body.razorpay_payment_id,
      body.transactionId,
      body.txnid,
      body.txnId
    ].filter((id) => typeof id === "string" && id.trim().length > 0);

    const primaryOrderId = candidateIds[0] || "";
    const orderId = primaryOrderId;

    if (payload.event) {
      txnId = payment?.id || `txn_${Date.now()}`;
      isSuccess =
        payload.event === "order.paid" ||
        payload.event === "payment.captured" ||
        payload.event === "payment_link.paid" ||
        payment?.status === "captured";
    } else {
      // Direct webhook or test payload
      txnId =
        body.razorpay_payment_id ||
        body.transactionId ||
        body.txnId ||
        `txn_${Date.now()}`;
      const status = (body.status || body.event || "").toLowerCase();
      isSuccess =
        status === "success" ||
        status === "paid" ||
        status === "captured" ||
        (body.razorpay_signature &&
          razorpayHelper.verifyPaymentSignature(body));
    }

    if (candidateIds.length === 0) {
      throw ApiError.badRequest(
        "Webhook payload missing transaction ID / payment order ID / payment link ID.",
      );
    }

    const searchConditions = [
      { paymentLinkId: { $in: candidateIds } },
      { paymentGatewayOrderId: { $in: candidateIds } },
      { paymentGatewayTransactionId: { $in: candidateIds } },
    ];
    candidateIds.forEach((id) => {
      if (mongoose.Types.ObjectId.isValid(id)) {
        searchConditions.push({ _id: id });
      }
    });

    const bank = await Bank.findOne({
      $or: searchConditions,
      isDeleted: { $ne: true },
    });

    if (!bank) {
      throw ApiError.notFound(
        `Co-operative bank record for payment order references [${candidateIds.join(", ") || primaryOrderId}] not found.`,
      );
    }

    // Idempotency check: if bank paymentStatus is already SUCCESS, skip duplicate execution
    if (bank.paymentStatus === "SUCCESS") {
      logger.info(
        `CO-OPERATIVE BANK WEBHOOK: Duplicate webhook received for already completed bank payment [${orderId}]. Skipping.`,
      );
      return {
        success: true,
        orderId,
        paymentStatus: "SUCCESS",
        message: "Webhook payload already processed.",
      };
    }

    if (!isSuccess) {
      bank.paymentStatus = "FAILED";
      bank.paymentGatewayTransactionId = txnId;
      await bank.save();

      logger.warn(
        `CO-OPERATIVE BANK WEBHOOK: Payment failed reported for order [${orderId}]`,
      );
      return {
        success: false,
        orderId,
        paymentStatus: "FAILED",
        message: "Payment failure reported by gateway.",
      };
    }

    // Online Payment Verified -> Auto update paymentStatus to SUCCESS and bank status to APPROVED
    bank.paymentStatus = "SUCCESS";
    bank.status = "APPROVED";
    bank.paymentGatewayTransactionId = txnId;

    const existingUser = await User.findOne({
      email: bank.email,
      isDeleted: { $ne: true },
    });
    if (!existingUser) {
      const passwordHash = bank.passwordHash || (await bcrypt.hash("Password@123", 10));
      const bankUser = new User({
        email: bank.email,
        phoneNumber: bank.phoneNumber,
        passwordHash,
        role: UserRole.VENDOR,
        userType: UserType.PARTNER,
        status: "ACTIVE",
      });
      await bankUser.save();
      bank.userId = bankUser._id;
    } else {
      bank.userId = existingUser._id;
      if (bank.passwordHash) {
        existingUser.passwordHash = bank.passwordHash;
      }
      if (existingUser.status !== "ACTIVE") {
        existingUser.status = "ACTIVE";
      }
      await existingUser.save();
    }

    await bank.save();

    // Log initial credit purchases in CreditLog if not already logged
    const existingLog = await CreditLog.findOne({ bankId: bank._id });
    if (!existingLog) {
      if ((bank.cardQuantity || 0) > 0) {
        await CreditLog.create({
          bankId: bank._id,
          type: "EMI_CARD",
          action: "PURCHASE",
          amount: bank.cardQuantity,
          description: `Purchased initial ${bank.cardQuantity} EMI Cards via Razorpay webhook auto-update.`,
        });
      }
      if ((bank.verificationCredit || 0) > 0) {
        await CreditLog.create({
          bankId: bank._id,
          type: "VERIFICATION_CREDIT",
          action: "PURCHASE",
          amount: bank.verificationCredit,
          description: `Purchased initial ${bank.verificationCredit} Verification Credits via Razorpay webhook auto-update.`,
        });
      }
    }

    logger.info(
      `CO-OPERATIVE BANK WEBHOOK: Successfully verified payment for Bank [${bank.name}], paymentStatus updated to SUCCESS & bank status updated to APPROVED.`,
    );

    return {
      success: true,
      orderId,
      paymentStatus: "SUCCESS",
      status: "APPROVED",
      bankId: bank._id,
      message:
        "Payment status and bank approval updated successfully via webhook.",
    };
  }

  /**
   * Helper to retrieve current EMI card & verification credit prices from settings collections
   */
  async getStoredPriceSettings() {
    const parseVal = (doc) => {
      if (!doc || doc.value === undefined || doc.value === null) return null;
      const num =
        typeof doc.value === "number" ? doc.value : parseFloat(doc.value);
      return isNaN(num) ? null : num;
    };

    const [
      emiChargesSetting,
      emiPriceSetting,
      verifSetting,
      minEmiSetting,
      minVerifSetting,
      priceSetting,
    ] = await Promise.all([
      Setting.findOne({ key: "EMI_CARD_CHARGES" }).lean(),
      Setting.findOne({ key: "EMI_CARD_PRICE" }).lean(),
      Setting.findOne({ key: "VERIFICATION_CREDIT_PRICE" }).lean(),
      Setting.findOne({ key: "MIN_EMI_CARD_LIMIT" }).lean(),
      Setting.findOne({ key: "MIN_VERIFICATION_CREDIT_LIMIT" }).lean(),
      PriceSetting.findOne().lean(),
    ]);

    const emiCardUnitPrice =
      parseVal(emiChargesSetting) ??
      parseVal(emiPriceSetting) ??
      priceSetting?.emiCardPriceForBank;

    const emiCardMinQty =
      parseVal(minEmiSetting) ?? priceSetting?.emiCardMinPurchaseQuantity;

    const verificationCreditUnitPrice =
      parseVal(verifSetting) ?? priceSetting?.verificationCreditPriceForBank;

    const verificationCreditMinQty =
      parseVal(minVerifSetting) ??
      priceSetting?.verificationCreditMinPurchaseQuantity;

    return {
      emiCardUnitPrice,
      emiCardMinQty,
      verificationCreditUnitPrice,
      verificationCreditMinQty,
    };
  }

  /**
   * Calculate EMI Card total price based on quantity and database price setting (Without GST)
   */
  async calculateEmiCardPrice(payload = {}) {
    const qty = parseInt(
      payload.quantity || payload.emiCardQuantity || payload.count || 0,
      10,
    );
    if (isNaN(qty) || qty < 0) {
      throw ApiError.badRequest("Valid EMI card quantity is required.");
    }

    const { emiCardUnitPrice, emiCardMinQty } =
      await this.getStoredPriceSettings();
    const totalPrice = qty * emiCardUnitPrice;

    return {
      itemType: "EMI_CARD",
      quantity: qty,
      unitPrice: emiCardUnitPrice,
      price: totalPrice,
      totalPrice,
      totalAmount: totalPrice,
      totalPayableAmount: totalPrice,
      minPurchaseQuantity: emiCardMinQty,
    };
  }

  /**
   * Calculate Verification Credit total price based on quantity and database price setting (Without GST)
   */
  async calculateVerificationCreditPrice(payload = {}) {
    const qty = parseInt(
      payload.quantity ||
      payload.verificationCreditQuantity ||
      payload.count ||
      0,
      10,
    );
    if (isNaN(qty) || qty < 0) {
      throw ApiError.badRequest(
        "Valid verification credit quantity is required.",
      );
    }

    const { verificationCreditUnitPrice, verificationCreditMinQty } =
      await this.getStoredPriceSettings();
    const totalPrice = qty * verificationCreditUnitPrice;

    return {
      itemType: "VERIFICATION_CREDIT",
      quantity: qty,
      unitPrice: verificationCreditUnitPrice,
      price: totalPrice,
      totalPrice,
      totalAmount: totalPrice,
      totalPayableAmount: totalPrice,
      minPurchaseQuantity: verificationCreditMinQty,
    };
  }

  /**
   * Calculate combined pricing for EMI cards and verification credits (Without GST)
   */
  async calculateCombinedPrice(payload = {}) {
    const emiCardQty = parseInt(
      payload.emiCardQuantity ||
      payload.emiCardCount ||
      payload.emiQuantity ||
      0,
      10,
    );
    const verificationCreditQty = parseInt(
      payload.verificationCreditQuantity ||
      payload.verificationCreditCount ||
      payload.verificationQuantity ||
      0,
      10,
    );

    const {
      emiCardUnitPrice,
      emiCardMinQty,
      verificationCreditUnitPrice,
      verificationCreditMinQty,
    } = await this.getStoredPriceSettings();

    const emiCardTotalPrice = emiCardQty * emiCardUnitPrice;
    const verificationCreditTotalPrice =
      verificationCreditQty * verificationCreditUnitPrice;

    const totalAmount = emiCardTotalPrice + verificationCreditTotalPrice;

    return {
      emiCard: {
        quantity: emiCardQty,
        unitPrice: emiCardUnitPrice,
        totalPrice: emiCardTotalPrice,
        minPurchaseQuantity: emiCardMinQty,
      },
      verificationCredit: {
        quantity: verificationCreditQty,
        unitPrice: verificationCreditUnitPrice,
        totalPrice: verificationCreditTotalPrice,
        minPurchaseQuantity: verificationCreditMinQty,
      },
      totalAmount,
      totalPayableAmount: totalAmount,
    };
  }
}

export const cooperativeBankService = new CooperativeBankService();
