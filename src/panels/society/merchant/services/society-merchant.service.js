import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { MerchantProfile } from "../../../../models/merchant-profile.model.js";
import { User } from "../../../../models/user.model.js";
import { Branch } from "../../../../models/branch.model.js";
import { SocietyCustomerLink } from "../../../../models/society-customer-link.model.js";
import {
  UserRole,
  UserType,
} from "../../../../constants/user-role.constant.js";
import { storageManager } from "../../../../storage/storage.manager.js";
import { ApiError } from "../../../../common/api.error.js";
import { ErrorCode } from "../../../../constants/error-code.constant.js";
import {
  isBranchManagerRole,
  isQualityCheckRole,
} from "../../../../constants/society-role.constant.js";
import { societyLeadEmailService } from "../../services/society-lead-email.service.js";
import { resolveExistingCustomerKyc } from "../../../../utils/customer-kyc-resolver.util.js";

export class SocietyMerchantService {
  /**
   * Check if a bank account number already exists in DB (across Merchant Profiles and Society Customer Accounts)
   */
  async checkBankAccountExists(accountNumber, excludeMerchantId = null) {
    if (!accountNumber || !String(accountNumber).trim()) return false;
    const cleanAcc = String(accountNumber).trim();

    const merchantQuery = {
      "bankDetails.accountNumber": cleanAcc,
      isDeleted: { $ne: true },
    };
    if (excludeMerchantId) {
      merchantQuery._id = { $ne: excludeMerchantId };
    }

    const existingMerchantAcc = await MerchantProfile.findOne(merchantQuery)
      .select("shopName ownerName bankDetails")
      .lean();
    if (existingMerchantAcc) {
      throw ApiError.conflict(
        `Bank Account Number '${cleanAcc}' already exists in database for merchant "${existingMerchantAcc.shopName}".`,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const existingSocietyCustomerLink = await SocietyCustomerLink.findOne({
      societyAccountNumber: cleanAcc,
    })
      .select("customerId societyAccountNumber")
      .lean();
    if (existingSocietyCustomerLink) {
      throw ApiError.conflict(
        `Bank Account Number '${cleanAcc}' already exists in society customer accounts database.`,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    return false;
  }

  /**
   * Standardize merchant object output matching UI spec
   */
  formatMerchantResponse(merchant, societyLink = null, fallbackKyc = null) {
    if (!merchant) return null;

    const docs = merchant.documents || {};
    const branchObj = merchant.branchId;

    let branchName = "N/A";
    let branchId = null;
    if (branchObj && typeof branchObj === "object") {
      branchName = branchObj.name || "N/A";
      branchId = branchObj._id;
    } else if (branchObj) {
      branchId = branchObj;
    }

    const onboardedByInfo = merchant.onboardedBy || {};
    let onboardedByName =
      onboardedByInfo.name || merchant.createdBy?.fullName || "Loan Executive";
    let onboardedByPhone =
      onboardedByInfo.phone || merchant.createdBy?.phoneNumber || "";
    let onboardedByRole =
      onboardedByInfo.role || merchant.createdBy?.role || "LOAN_EXECUTIVE";

    const generatedCode =
      merchant.merchantCode ||
      merchant.code ||
      `MER-${merchant._id.toString().slice(-6).toUpperCase()}`;

    // Effective bank details: prioritize official societyAccount / SocietyCustomerLink
    const resolvedSocietyAccNum =
      (merchant.societyAccount?.societyAccountNumber &&
        String(merchant.societyAccount.societyAccountNumber).trim()) ||
      (societyLink?.societyAccountNumber &&
        String(societyLink.societyAccountNumber).trim()) ||
      null;

    const resolvedSocietyAccount = resolvedSocietyAccNum
      ? {
          societyAccountNumber: resolvedSocietyAccNum,
          ifscCode:
            merchant.societyAccount?.ifscCode || societyLink?.ifscCode || "",
          accountHolderName:
            merchant.societyAccount?.accountHolderName ||
            societyLink?.accountHolderName ||
            merchant.ownerName ||
            "",
          bankBranchName:
            merchant.societyAccount?.bankBranchName ||
            societyLink?.bankBranchName ||
            branchName ||
            "",
        }
      : null;

    const effectiveBankDetails = resolvedSocietyAccount
      ? {
          accountHolderName: resolvedSocietyAccount.accountHolderName,
          accountNumber: resolvedSocietyAccount.societyAccountNumber,
          ifscCode: resolvedSocietyAccount.ifscCode,
          bankName: merchant.bankId?.name || "Cooperative Society Bank",
          branchName: resolvedSocietyAccount.bankBranchName,
          accountType: "SAVINGS",
        }
      : {
          accountHolderName: merchant.bankDetails?.accountHolderName || null,
          accountNumber: merchant.bankDetails?.accountNumber || null,
          ifscCode: merchant.bankDetails?.ifscCode || null,
          bankName: merchant.bankDetails?.bankName || null,
          branchName: merchant.bankDetails?.branchName || null,
          accountType: merchant.bankDetails?.accountType || "CURRENT",
        };

    const effectiveAadhaarNum =
      merchant.aadhaarNumber || fallbackKyc?.aadhaarNumber || "";
    const effectivePanNum =
      merchant.panNumber || fallbackKyc?.panNumber || "";
    const effectiveAadhaarDoc =
      docs.ownerAadhaar || merchant.aadhaarImage || fallbackKyc?.ownerAadhaar || null;
    const effectivePanDoc =
      docs.ownerPan || merchant.panImage || fallbackKyc?.ownerPan || null;

    return {
      id: merchant._id,
      merchantId: merchant._id,
      merchantCode: generatedCode,
      code: generatedCode,
      userId: merchant.userId,
      bankId: merchant.bankId?._id || merchant.bankId || null,
      branchId: branchId,
      branchName: branchName,
      branch: branchName,
      shopName: merchant.shopName,
      ownerName: merchant.ownerName,
      shopOwnerName: merchant.ownerName,
      primaryPhoneNumber: merchant.phoneNumber || merchant.primaryPhoneNumber,
      phoneNumber: merchant.phoneNumber || merchant.primaryPhoneNumber,
      phone: merchant.phoneNumber || merchant.primaryPhoneNumber,
      secondaryPhoneNumber: merchant.secondaryPhoneNumber || null,
      email: merchant.email,
      shopAddress: merchant.shopAddress || "",
      aadhaarNumber: effectiveAadhaarNum,
      ownerAadharNumber: effectiveAadhaarNum,
      ownerAadhaarNumber: effectiveAadhaarNum,
      panNumber: effectivePanNum,
      ownerPanNumber: effectivePanNum,
      gstinNumber: merchant.gstinNumber || merchant.businessProofNumber || "",
      gstin: merchant.gstinNumber || merchant.businessProofNumber || "",
      businessProofType: merchant.businessProofType || null,
      businessProofNumber:
        merchant.businessProofNumber || merchant.gstinNumber || null,
      bankDetails: effectiveBankDetails,
      societyAccount: resolvedSocietyAccount,
      accountHolderName: effectiveBankDetails.accountHolderName,
      bankAccountNumber: effectiveBankDetails.accountNumber,
      accountNumber: effectiveBankDetails.accountNumber,
      societyAccountNumber: resolvedSocietyAccNum,
      ifscCode: effectiveBankDetails.ifscCode,
      bankName: effectiveBankDetails.bankName,
      bankBranchName: effectiveBankDetails.branchName,
      accountType: effectiveBankDetails.accountType,
      documents: {
        ownerAadhaar: effectiveAadhaarDoc
          ? { filename: "owner_aadhaar.pdf", url: effectiveAadhaarDoc }
          : null,
        ownerPan: effectivePanDoc
          ? { filename: "owner_pan.jpg", url: effectivePanDoc }
          : null,
        businessProof: docs.businessProof
          ? { filename: "business_proof.jpg", url: docs.businessProof }
          : null,
        shopPhoto: docs.shopPhoto
          ? { filename: "shop_photo.jpg", url: docs.shopPhoto }
          : null,
        shopRegistrationCertificate: docs.shopRegistrationCertificate
          ? {
              filename: "shop_registration.pdf",
              url: docs.shopRegistrationCertificate,
            }
          : null,
        gstCertificate: docs.gstCertificate
          ? { filename: "gst_certificate.pdf", url: docs.gstCertificate }
          : null,
      },
      aadhaarImage: effectiveAadhaarDoc,
      panImage: effectivePanDoc,
      businessProofImage:
        docs.businessProof ||
        docs.gstCertificate ||
        docs.shopRegistrationCertificate ||
        null,
      shopPhoto: docs.shopPhoto || null,
      approvalStatus:
        merchant.approvalStatus ||
        (merchant.status === "ACTIVE" ? "APPROVED" : "PENDING_BRANCH_APPROVAL"),
      rejectionReason: merchant.rejectionReason || null,
      status: merchant.status || "INACTIVE",
      onboardedBy: {
        id: onboardedByInfo.id || onboardedByInfo.userId || merchant.createdBy,
        userId:
          onboardedByInfo.userId || onboardedByInfo.id || merchant.createdBy,
        name: onboardedByInfo.name || "Executive",
        phone: onboardedByInfo.phone || "",
        role: onboardedByInfo.role || "LOAN_EXECUTIVE",
      },
      approvedAt: merchant.approvedAt || null,
      rejectedAt: merchant.rejectedAt || null,
      createdAt: merchant.createdAt,
      updatedAt: merchant.updatedAt,
    };
  }

  /**
   * Helper to process file upload for a document key
   */
  async processFileUpload(fileArray, folder = "merchants") {
    if (!fileArray || fileArray.length === 0) return { url: null, key: null };
    const file = fileArray[0];
    const uploadResult = await storageManager.uploadFile(file, folder);
    return {
      url: uploadResult?.fileUrl || uploadResult?.url || null,
      key: uploadResult?.key || uploadResult?.filePath || null,
    };
  }

  /**
   * List Merchants for the authenticated Society Bank / Branch
   */
  async listMerchants(societyContext, queryOptions = {}) {
    const bankId = societyContext?.bankId;
    if (!bankId && societyContext?.role !== UserRole.SUPER_ADMIN) {
      throw ApiError.forbidden("A valid society bank context is required.");
    }

    const page = parseInt(queryOptions.page || "1", 10);
    const limit = parseInt(queryOptions.limit || "10", 10);
    const search = (queryOptions.search || "").trim();
    const statusParam = queryOptions.status || queryOptions.approvalStatus;
    const targetStatus =
      statusParam &&
      statusParam.toUpperCase() !== "ALL" &&
      statusParam.toLowerCase() !== "all"
        ? statusParam.toUpperCase()
        : null;
    const skip = (page - 1) * limit;

    const filter = {};
    if (
      queryOptions.isDeleted === true ||
      queryOptions.isDeleted === "true" ||
      queryOptions.status === "DELETED" ||
      queryOptions.status === "deleted"
    ) {
      filter.isDeleted = true;
    } else if (
      queryOptions.isDeleted === "all" ||
      queryOptions.isDeleted === "ALL" ||
      queryOptions.includeDeleted === true ||
      queryOptions.includeDeleted === "true"
    ) {
      // Return both active and deleted merchants
    } else {
      filter.isDeleted = { $ne: true };
    }

    if (bankId) {
      filter.bankId = bankId;
    }

    // 1. Branch ID / Branch IDs scoping
    const scopedBranchId = societyContext?.branchId || queryOptions.branchId;
    if (scopedBranchId) {
      filter.branchId = scopedBranchId;
    } else if (
      queryOptions.branchIds &&
      (Array.isArray(queryOptions.branchIds)
        ? queryOptions.branchIds.length > 0
        : String(queryOptions.branchIds).trim())
    ) {
      const bIds = Array.isArray(queryOptions.branchIds)
        ? queryOptions.branchIds
        : String(queryOptions.branchIds)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
      filter.branchId = { $in: bIds };
    }

    // 2. City & State branch filter lookup
    const cityInput = queryOptions.cities || queryOptions.city;
    const stateInput = queryOptions.states || queryOptions.state;

    if (cityInput || stateInput) {
      const branchQuery = { isDeleted: { $ne: true } };
      if (bankId) branchQuery.bankId = bankId;

      if (cityInput) {
        const cityList = Array.isArray(cityInput)
          ? cityInput
          : String(cityInput)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
        const cityRegexes = cityList.map((c) => new RegExp(c, "i"));
        branchQuery.$or = [
          { "address.city": { $in: cityRegexes } },
          { city: { $in: cityRegexes } },
        ];
      }

      if (stateInput) {
        const stateList = Array.isArray(stateInput)
          ? stateInput
          : String(stateInput)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
        const stateRegexes = stateList.map((s) => new RegExp(s, "i"));
        const stateConds = [
          { state: { $in: stateRegexes } },
          { "address.state": { $in: stateRegexes } },
        ];

        if (branchQuery.$or) {
          branchQuery.$and = [{ $or: branchQuery.$or }, { $or: stateConds }];
          delete branchQuery.$or;
        } else {
          branchQuery.$or = stateConds;
        }
      }

      const matchingBranches = await Branch.find(branchQuery)
        .select("_id")
        .lean();
      const branchIdsFromLocation = matchingBranches.map((b) => b._id);

      if (filter.branchId) {
        const existingBranchFilter = Array.isArray(filter.branchId.$in)
          ? filter.branchId.$in
          : [filter.branchId];
        filter.branchId = {
          $in: existingBranchFilter.filter((id) =>
            branchIdsFromLocation.some((bId) => String(bId) === String(id)),
          ),
        };
      } else {
        filter.branchId = { $in: branchIdsFromLocation };
      }
    }

    // 3. Status & Approval Status filter
    if (targetStatus) {
      if (
        ["PENDING_BRANCH_APPROVAL", "APPROVED", "REJECTED", "PENDING"].includes(
          targetStatus,
        )
      ) {
        filter.approvalStatus = targetStatus;
      } else if (["ACTIVE", "INACTIVE", "BLOCKED"].includes(targetStatus)) {
        filter.status = targetStatus;
      } else {
        filter.$or = [
          { approvalStatus: targetStatus },
          { status: targetStatus },
        ];
      }
    }

    // 4. Creation Date Range Filter (createdAt) & CreatedBy Filter
    const dateFromInput =
      queryOptions.dateFrom ||
      queryOptions.startDate ||
      queryOptions.fromDate ||
      queryOptions.createdFrom ||
      queryOptions.from ||
      queryOptions.date;

    const dateToInput =
      queryOptions.dateTo ||
      queryOptions.endDate ||
      queryOptions.toDate ||
      queryOptions.createdTo ||
      queryOptions.to ||
      queryOptions.date;

    if (dateFromInput || dateToInput) {
      filter.createdAt = {};
      if (dateFromInput) {
        const start = new Date(dateFromInput);
        if (!isNaN(start.getTime())) {
          start.setHours(0, 0, 0, 0);
          filter.createdAt.$gte = start;
        }
      }
      if (dateToInput) {
        const end = new Date(dateToInput);
        if (!isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          filter.createdAt.$lte = end;
        }
      }
    }

    const createdByInput = queryOptions.createdBy || queryOptions.onboardedBy;
    if (createdByInput && mongoose.Types.ObjectId.isValid(String(createdByInput).trim())) {
      const cId = new mongoose.Types.ObjectId(String(createdByInput).trim());
      const creatorConds = [
        { createdBy: cId },
        { "onboardedBy.id": cId },
        { "onboardedBy.userId": cId }
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: creatorConds }];
        delete filter.$or;
      } else {
        filter.$or = creatorConds;
      }
    }

    // 5. Keyword Search Filter
    if (search) {
      const searchRegex = new RegExp(search, "i");
      const searchBranchQuery = {
        isDeleted: { $ne: true },
        $or: [{ name: searchRegex }, { code: searchRegex }],
      };
      if (bankId) searchBranchQuery.bankId = bankId;

      const searchBranches = await Branch.find(searchBranchQuery)
        .select("_id")
        .lean();
      const searchBranchIds = searchBranches.map((b) => b._id);

      const searchConditions = [
        { shopName: searchRegex },
        { ownerName: searchRegex },
        { email: searchRegex },
        { phoneNumber: searchRegex },
        { gstinNumber: searchRegex },
        { panNumber: searchRegex },
        { aadhaarNumber: searchRegex },
        { branchId: { $in: searchBranchIds } },
      ];

      filter.$or = [...(filter.$or || []), ...searchConditions];
    }

    const sortField = queryOptions.sortBy || "createdAt";
    const sortOrder =
      (queryOptions.sortOrder || "desc").toLowerCase() === "asc" ? 1 : -1;

    // 6. Compute Stats summary across all matching merchants
    const statsFilter = { ...filter };
    delete statsFilter.status;
    delete statsFilter.approvalStatus;
    statsFilter.isDeleted = { $in: [true, false] };

    const statsAgg = await MerchantProfile.aggregate([
      { $match: statsFilter },
      {
        $group: {
          _id: null,
          totalAll: { $sum: 1 },
          totalNonDeleted: {
            $sum: { $cond: [{ $ne: ["$isDeleted", true] }, 1, 0] },
          },
          active: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", "ACTIVE"] },
                    { $ne: ["$isDeleted", true] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          inactive: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", "INACTIVE"] },
                    { $ne: ["$isDeleted", true] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          pending: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$approvalStatus", "PENDING_BRANCH_APPROVAL"] },
                    { $ne: ["$isDeleted", true] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          approved: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$approvalStatus", "APPROVED"] },
                    { $ne: ["$isDeleted", true] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          rejected: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$approvalStatus", "REJECTED"] },
                    { $ne: ["$isDeleted", true] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          blocked: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", "BLOCKED"] },
                    { $ne: ["$isDeleted", true] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          deleted: {
            $sum: { $cond: [{ $eq: ["$isDeleted", true] }, 1, 0] },
          },
        },
      },
    ]).catch(() => []);

    const totalNonDeleted = statsAgg[0]?.totalNonDeleted || 0;
    const activeMerchants = statsAgg[0]?.active || 0;
    const inactiveMerchants = statsAgg[0]?.inactive || 0;
    const pendingMerchants = statsAgg[0]?.pending || 0;
    const approvedMerchants = statsAgg[0]?.approved || 0;
    const rejectedMerchants = statsAgg[0]?.rejected || 0;
    const blockedMerchants = statsAgg[0]?.blocked || 0;
    const deletedMerchants = statsAgg[0]?.deleted || 0;

    const stats = {
      totalMerchants: totalNonDeleted,
      total: totalNonDeleted,
      activeMerchants,
      pendingMerchants,
      pending: pendingMerchants,
      approvedMerchants,
      approved: approvedMerchants,
      rejectedMerchants,
      rejected: rejectedMerchants,
      inactiveMerchants,
      blockedMerchants,
      deletedMerchants,
    };

    const totalRecords = await MerchantProfile.countDocuments(filter);

    const merchants = await MerchantProfile.find(filter)
      .populate("branchId", "name code state address")
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean();

    // Fallback resolution for merchants where branchId was saved as null
    for (const m of merchants) {
      if (!m.branchId && m.bankId) {
        const defaultBranch = await Branch.findOne({
          bankId: m.bankId,
          isDeleted: { $ne: true },
        })
          .select("name code state address")
          .lean();
        if (defaultBranch) {
          m.branchId = defaultBranch;
          MerchantProfile.updateOne(
            { _id: m._id },
            { branchId: defaultBranch._id },
          ).catch(() => {});
        }
      }
    }

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    const merchantUserIds = merchants.map((m) => m.userId).filter(Boolean);
    const merchantPhones = merchants
      .map((m) => m.phoneNumber || m.primaryPhoneNumber)
      .filter(Boolean);

    const societyLinks =
      merchantUserIds.length > 0 || merchantPhones.length > 0
        ? await SocietyCustomerLink.find({
            $or: [
              ...(merchantUserIds.length > 0
                ? [{ userId: { $in: merchantUserIds } }]
                : []),
              ...(merchantPhones.length > 0
                ? [{ phoneNumber: { $in: merchantPhones } }]
                : []),
            ],
            societyAccountNumber: { $ne: null },
          }).lean()
        : [];

    const socMap = new Map();
    societyLinks.forEach((l) => {
      if (l.userId) socMap.set(String(l.userId), l);
    });

    const items = merchants.map((m, idx) => ({
      srNo: skip + idx + 1,
      ...this.formatMerchantResponse(m, socMap.get(String(m.userId))),
    }));

    return {
      stats,
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
   * Get single Merchant by ID (scoped to society bank)
   */
  async getMerchantById(societyContext, id) {
    const bankId = societyContext?.bankId;
    const query = { _id: id, isDeleted: { $ne: true } };

    if (bankId) {
      query.bankId = bankId;
    }

    if (societyContext?.branchId) {
      query.branchId = societyContext.branchId;
    }

    const merchant = await MerchantProfile.findOne(query)
      .populate("branchId", "name code")
      .lean();

    if (!merchant) {
      throw ApiError.notFound("Merchant account not found.");
    }

    if (!merchant.branchId && merchant.bankId) {
      const defaultBranch = await Branch.findOne({
        bankId: merchant.bankId,
        isDeleted: { $ne: true },
      })
        .select("name code")
        .lean();
      if (defaultBranch) {
        merchant.branchId = defaultBranch;
        MerchantProfile.updateOne(
          { _id: merchant._id },
          { branchId: defaultBranch._id },
        ).catch(() => {});
      }
    }

    let societyLink = null;
    if (merchant.userId || merchant.phoneNumber) {
      societyLink = await SocietyCustomerLink.findOne({
        $or: [
          ...(merchant.userId ? [{ userId: merchant.userId }] : []),
          ...(merchant.phoneNumber
            ? [{ phoneNumber: merchant.phoneNumber }]
            : []),
        ],
        ...(merchant.bankId ? { bankId: merchant.bankId } : {}),
        societyAccountNumber: { $ne: null },
      }).lean();
      if (!societyLink) {
        societyLink = await SocietyCustomerLink.findOne({
          $or: [
            ...(merchant.userId ? [{ userId: merchant.userId }] : []),
            ...(merchant.phoneNumber
              ? [{ phoneNumber: merchant.phoneNumber }]
              : []),
          ],
          societyAccountNumber: { $ne: null },
        })
          .sort({ lastKycDate: -1, createdAt: -1 })
          .lean();
      }
    }

    let fallbackKyc = null;
    if (
      !merchant.aadhaarNumber ||
      !merchant.panNumber ||
      !merchant.documents?.ownerAadhaar ||
      !merchant.documents?.ownerPan
    ) {
      fallbackKyc = await resolveExistingCustomerKyc({
        phoneNumber: merchant.phoneNumber || merchant.primaryPhoneNumber,
        userId: merchant.userId,
      });

      const updateFields = {};
      if (!merchant.aadhaarNumber && fallbackKyc.aadhaarNumber)
        updateFields.aadhaarNumber = fallbackKyc.aadhaarNumber;
      if (!merchant.panNumber && fallbackKyc.panNumber)
        updateFields.panNumber = fallbackKyc.panNumber;
      if (!merchant.documents?.ownerAadhaar && fallbackKyc.ownerAadhaar)
        updateFields["documents.ownerAadhaar"] = fallbackKyc.ownerAadhaar;
      if (!merchant.documents?.ownerPan && fallbackKyc.ownerPan)
        updateFields["documents.ownerPan"] = fallbackKyc.ownerPan;

      if (Object.keys(updateFields).length > 0) {
        MerchantProfile.updateOne(
          { _id: merchant._id },
          { $set: updateFields },
        ).catch(() => {});
      }
    }

    return this.formatMerchantResponse(merchant, societyLink, fallbackKyc);
  }

  /**
   * Create a new Merchant associated with a Bank Branch
   */
  async createMerchant(societyContext, payload, files = {}, creatorId) {
    const bankId = societyContext?.bankId || payload.bankId;
    if (!bankId) {
      throw ApiError.badRequest(
        "Society Bank context is required to register a merchant account.",
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Resolve target branchId
    let targetBranchId = societyContext?.branchId || payload.branchId;

    if (!targetBranchId) {
      const activeBranches = await Branch.find({
        bankId,
        isDeleted: { $ne: true },
        status: "ACTIVE",
      }).lean();
      if (activeBranches.length === 1) {
        targetBranchId = activeBranches[0]._id;
      } else if (activeBranches.length === 0) {
        throw ApiError.badRequest(
          "No active bank branch found for this bank. Please create a branch first.",
          ErrorCode.VALIDATION_ERROR,
        );
      } else {
        throw ApiError.badRequest(
          "Please select a Bank Branch to associate with this merchant account.",
          ErrorCode.VALIDATION_ERROR,
        );
      }
    }

    // Verify branch exists and belongs to this bank
    const branch = await Branch.findOne({
      _id: targetBranchId,
      bankId,
      isDeleted: { $ne: true },
    });
    if (!branch) {
      throw ApiError.badRequest(
        "Selected bank branch is invalid or does not belong to your bank organization.",
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const shopName = (payload.shopName || "").trim();
    const ownerName = (payload.ownerName || payload.shopOwnerName || "").trim();
    const email = (payload.email || "").trim().toLowerCase();
    const phoneNumber = (payload.phoneNumber || payload.phone || "").trim();
    const aadhaarNumber = (
      payload.aadhaarNumber ||
      payload.ownerAadharNumber ||
      payload.ownerAadhaarNumber ||
      ""
    ).trim();
    const panNumber = (payload.panNumber || payload.ownerPanNumber || "")
      .trim()
      .toUpperCase();
    const gstinNumber = (payload.gstinNumber || payload.gstin || "")
      .trim()
      .toUpperCase();
    const password = payload.password ? String(payload.password).trim() : null;

    if (!shopName) {
      throw ApiError.badRequest(
        "Shop Name is required.",
        ErrorCode.VALIDATION_ERROR,
      );
    }

    if (!ownerName) {
      throw ApiError.badRequest(
        "Shop Owner Name is required.",
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Determine creator role
    const creatorRole = (societyContext?.role || "").trim().toUpperCase();
    const isLoanExecutiveCreator =
      creatorRole === "LOAN_EXECUTIVE" || creatorRole.includes("LOAN");

    let initialApprovalStatus = "PENDING_BRANCH_APPROVAL";
    let initialStatus = "INACTIVE";
    let bankDetails = null;
    let societyAccount = null;

    if (isLoanExecutiveCreator) {
      // Loan Executive CANNOT fill bank details. Bank details and society bank details are automatically set to null at creation time.
      bankDetails = null;
      societyAccount = null;
      initialApprovalStatus = "PENDING_BRANCH_APPROVAL";
      initialStatus = "INACTIVE";
    } else {
      if (
        societyContext?.isBankOwner ||
        societyContext?.isBranchManager ||
        societyContext?.isQualityCheck ||
        creatorRole.includes("HEAD") ||
        creatorRole.includes("OWNER") ||
        creatorRole.includes("AUTHORIZED") ||
        isBranchManagerRole(creatorRole) ||
        isQualityCheckRole(creatorRole)
      ) {
        initialApprovalStatus = payload.approvalStatus
          ? payload.approvalStatus.toUpperCase()
          : "APPROVED";
        initialStatus = payload.status
          ? payload.status.toUpperCase()
          : "ACTIVE";
      }

      // Process commercial bank details if supplied by Authorized Person
      if (payload.bankDetails && typeof payload.bankDetails === "object") {
        const bd = payload.bankDetails;
        const accountNumber = (bd.accountNumber || "").trim();
        if (accountNumber) {
          await this.checkBankAccountExists(accountNumber);
          bankDetails = {
            accountHolderName: (bd.accountHolderName || ownerName || "").trim(),
            accountNumber,
            ifscCode: (bd.ifscCode || "").trim().toUpperCase(),
            bankName: (bd.bankName || "").trim(),
            branchName: (bd.branchName || bd.bankBranchName || "").trim(),
            accountType: ["SAVINGS", "CURRENT", "CC", "OD"].includes(
              (bd.accountType || "").toUpperCase()
            )
              ? bd.accountType.toUpperCase()
              : "CURRENT",
          };
        }
      }

      // Process society bank account details if supplied by Authorized Person
      const socPayload = payload.societyAccount || payload.societyBankAccount || {};
      const socAccNum = (
        payload.societyAccountNumber ||
        socPayload.societyAccountNumber ||
        socPayload.accountNumber ||
        ""
      ).trim();
      if (socAccNum) {
        societyAccount = {
          societyAccountNumber: socAccNum,
          ifscCode: (payload.societyIfscCode || socPayload.ifscCode || "").trim().toUpperCase(),
          accountHolderName: (payload.societyAccountHolderName || socPayload.accountHolderName || ownerName || "").trim(),
          bankBranchName: (payload.societyBankBranchName || socPayload.bankBranchName || socPayload.branchName || "").trim(),
        };
      }
    }

    // Check duplicate email or phone within active merchant records in this bank
    const existingEmail = await MerchantProfile.findOne({
      email,
      bankId,
      isDeleted: { $ne: true },
    });
    if (existingEmail) {
      throw ApiError.conflict(
        "A Merchant with this email address already exists in this Bank.",
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const existingPhone = await MerchantProfile.findOne({
      phoneNumber,
      bankId,
      isDeleted: { $ne: true },
    });
    if (existingPhone) {
      throw ApiError.conflict(
        "Customer is already an onboarded Merchant in this Bank. Only 1 Merchant profile is allowed per Bank.",
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Process document uploads
    const aadhaarUpload = await this.processFileUpload(
      files.ownerAadhaar || files.ownerAadhar,
    );
    const panUpload = await this.processFileUpload(files.ownerPan);
    const regCertUpload = await this.processFileUpload(
      files.shopRegistrationCertificate,
    );
    const gstCertUpload = await this.processFileUpload(files.gstCertificate);

    // Create User login credentials for Merchant Partner
    let merchantUser = null;
    if (phoneNumber) {
      merchantUser = await User.findOne({
        phoneNumber,
        isDeleted: { $ne: true },
      });
    }
    if (!merchantUser && email) {
      merchantUser = await User.findOne({ email, isDeleted: { $ne: true } });
    }

    const defaultPassword = password || "Merchant@123";
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    if (!merchantUser) {
      merchantUser = new User({
        email: email || undefined,
        phoneNumber,
        fullName: ownerName,
        passwordHash,
        role: UserRole.MERCHANT,
        userType: UserType.PARTNER,
        profileModel: "MerchantProfile",
        status: initialStatus,
        createdBy: creatorId,
      });
      await merchantUser.save();
    } else {
      merchantUser.fullName = ownerName || merchantUser.fullName;
      if (password) {
        merchantUser.passwordHash = passwordHash;
      }
      if (
        merchantUser.role !== UserRole.VENDOR &&
        merchantUser.role !== UserRole.MERCHANT
      ) {
        merchantUser.role = UserRole.MERCHANT;
      }
      merchantUser.userType = UserType.PARTNER;
      merchantUser.profileModel = "MerchantProfile";
      if (!merchantUser.phoneNumber && phoneNumber) {
        merchantUser.phoneNumber = phoneNumber;
      }
      if (merchantUser.status !== "ACTIVE") {
        merchantUser.status = initialStatus;
      }
      await merchantUser.save();
    }

    // Create MerchantProfile linked to Bank & Branch
    const merchant = new MerchantProfile({
      userId: merchantUser._id,
      bankId,
      branchId: targetBranchId,
      shopName,
      ownerName,
      email,
      phoneNumber,
      aadhaarNumber,
      panNumber,
      gstinNumber,
      bankDetails,
      societyAccount,
      approvalStatus: initialApprovalStatus,
      status: initialStatus,
      onboardedBy: {
        id: creatorId || societyContext?.userId || null,
        userId: creatorId || societyContext?.userId || null,
        name: societyContext?.userName || ownerName || "Executive",
        phone: societyContext?.userPhone || phoneNumber || "",
        role: creatorRole || "LOAN_EXECUTIVE",
      },
      documents: {
        ownerAadhaar: aadhaarUpload.url,
        ownerAadhaarKey: aadhaarUpload.key,
        ownerPan: panUpload.url,
        ownerPanKey: panUpload.key,
        shopRegistrationCertificate: regCertUpload.url,
        shopRegistrationCertificateKey: regCertUpload.key,
        gstCertificate: gstCertUpload.url,
        gstCertificateKey: gstCertUpload.key,
      },
      createdBy: creatorId,
    });

    await merchant.save();

    merchantUser.profileId = merchant._id;
    await merchantUser.save();

    // Sync SocietyCustomerLink if bankDetails / societyAccount exist
    if (merchantUser && bankDetails?.accountNumber) {
      let societyLink = await SocietyCustomerLink.findOne({
        userId: merchantUser._id,
        bankId: bankId,
      });

      if (!societyLink) {
        societyLink = new SocietyCustomerLink({
          userId: merchantUser._id,
          customerId: `CUST-${merchantUser._id.toString().slice(-6).toUpperCase()}`,
          bankId: bankId,
          branchId: targetBranchId,
          firstOnboardedAt: new Date(),
          kycStatus: "VERIFIED",
        });
      }

      societyLink.societyAccountNumber = bankDetails.accountNumber;
      if (bankDetails.ifscCode) societyLink.ifscCode = bankDetails.ifscCode;
      if (bankDetails.accountHolderName)
        societyLink.accountHolderName = bankDetails.accountHolderName;
      if (bankDetails.branchName)
        societyLink.bankBranchName = bankDetails.branchName;
      if (targetBranchId) societyLink.branchId = targetBranchId;

      await societyLink.save();
    }

    const populatedMerchant = await MerchantProfile.findById(merchant._id)
      .populate("branchId", "name code")
      .lean();

    return this.formatMerchantResponse(populatedMerchant || merchant);
  }

  /**
   * Update existing Merchant details
   */
  async updateMerchant(societyContext, id, payload, files = {}, updaterId) {
    const bankId = societyContext?.bankId;
    const query = { _id: id, isDeleted: { $ne: true } };

    if (bankId) {
      query.bankId = bankId;
    }

    if (societyContext?.branchId) {
      query.branchId = societyContext.branchId;
    }

    const merchant = await MerchantProfile.findOne(query);
    if (!merchant) {
      throw ApiError.notFound("Merchant record not found for update.");
    }

    if (payload.branchId && payload.branchId !== String(merchant.branchId)) {
      const targetBankId = bankId || merchant.bankId;
      const branch = await Branch.findOne({
        _id: payload.branchId,
        bankId: targetBankId,
        isDeleted: { $ne: true },
      });
      if (!branch) {
        throw ApiError.badRequest(
          "Selected bank branch is invalid or does not belong to your bank organization.",
        );
      }
      merchant.branchId = branch._id;
    }

    if (payload.shopName) merchant.shopName = payload.shopName.trim();
    if (payload.ownerName || payload.shopOwnerName) {
      merchant.ownerName = (payload.ownerName || payload.shopOwnerName).trim();
    }
    if (payload.email) merchant.email = payload.email.trim().toLowerCase();
    if (payload.phoneNumber || payload.phone) {
      merchant.phoneNumber = (payload.phoneNumber || payload.phone).trim();
    }

    if (
      payload.aadhaarNumber !== undefined ||
      payload.ownerAadharNumber !== undefined ||
      payload.ownerAadhaarNumber !== undefined
    ) {
      merchant.aadhaarNumber = (
        payload.aadhaarNumber ||
        payload.ownerAadharNumber ||
        payload.ownerAadhaarNumber ||
        ""
      ).trim();
    }

    if (
      payload.panNumber !== undefined ||
      payload.ownerPanNumber !== undefined
    ) {
      merchant.panNumber = (payload.panNumber || payload.ownerPanNumber || "")
        .trim()
        .toUpperCase();
    }

    if (payload.gstinNumber !== undefined || payload.gstin !== undefined) {
      merchant.gstinNumber = (payload.gstinNumber || payload.gstin || "")
        .trim()
        .toUpperCase();
    }

    if (payload.status) {
      merchant.status = payload.status.toUpperCase();
    }

    // Process bank details update
    const bankDetailsPayload = payload.bankDetails;
    if (
      bankDetailsPayload !== undefined ||
      payload.accountHolderName !== undefined ||
      payload.accountNumber !== undefined ||
      payload.ifscCode !== undefined ||
      payload.bankName !== undefined ||
      payload.branchName !== undefined ||
      payload.accountType !== undefined
    ) {
      const updaterRole = (societyContext?.role || "").trim().toUpperCase();
      const isLoanExecutiveUpdater =
        updaterRole === "LOAN_EXECUTIVE" || updaterRole.includes("LOAN");

      if (isLoanExecutiveUpdater) {
        throw ApiError.forbidden(
          "Loan Executives are not authorized to fill or update merchant bank account details. Only authorized personnel (Branch Manager, Bank Owner, Quality Check) can manage bank account details.",
        );
      }

      const existingBankDetails = merchant.bankDetails || {};
      const newHolderName = (
        payload.accountHolderName ||
        bankDetailsPayload?.accountHolderName ||
        existingBankDetails.accountHolderName ||
        merchant.ownerName ||
        ""
      ).trim();
      const newAccNum = (
        payload.accountNumber ||
        bankDetailsPayload?.accountNumber ||
        existingBankDetails.accountNumber ||
        ""
      ).trim();
      const newIfsc = (
        payload.ifscCode ||
        bankDetailsPayload?.ifscCode ||
        existingBankDetails.ifscCode ||
        ""
      )
        .trim()
        .toUpperCase();
      const newBankName = (
        payload.bankName ||
        bankDetailsPayload?.bankName ||
        existingBankDetails.bankName ||
        ""
      ).trim();
      const newBranchName = (
        payload.branchName ||
        bankDetailsPayload?.branchName ||
        existingBankDetails.branchName ||
        ""
      ).trim();
      const newAccType = (
        payload.accountType ||
        bankDetailsPayload?.accountType ||
        existingBankDetails.accountType ||
        "CURRENT"
      )
        .trim()
        .toUpperCase();

      if (
        !newHolderName ||
        !newAccNum ||
        !newIfsc ||
        !newBankName ||
        !newBranchName
      ) {
        throw ApiError.badRequest(
          "Updating merchant bank account details requires all mandatory fields (Account Holder Name, Account Number, IFSC Code, Bank Name, and Branch Name) as per co-operative bank standards.",
          ErrorCode.VALIDATION_ERROR,
        );
      }

      if (newAccNum !== (existingBankDetails.accountNumber || "")) {
        await this.checkBankAccountExists(newAccNum, merchant._id);
      }

      merchant.bankDetails = {
        accountHolderName: newHolderName,
        accountNumber: newAccNum,
        ifscCode: newIfsc,
        bankName: newBankName,
        branchName: newBranchName,
        accountType: ["SAVINGS", "CURRENT", "CC", "OD"].includes(newAccType)
          ? newAccType
          : "CURRENT",
      };
    }

    if (payload.password && merchant.userId) {
      const password = String(payload.password).trim();
      if (password.length >= 6) {
        const passwordHash = await bcrypt.hash(password, 10);
        await User.updateOne(
          { _id: merchant.userId },
          { passwordHash, updatedBy: updaterId },
        );
      }
    }

    const docs = merchant.documents || {};

    if (files.ownerAadhaar || files.ownerAadhar) {
      const upload = await this.processFileUpload(
        files.ownerAadhaar || files.ownerAadhar,
      );
      if (upload.url) {
        docs.ownerAadhaar = upload.url;
        docs.ownerAadhaarKey = upload.key;
      }
    }

    if (files.ownerPan) {
      const upload = await this.processFileUpload(files.ownerPan);
      if (upload.url) {
        docs.ownerPan = upload.url;
        docs.ownerPanKey = upload.key;
      }
    }

    if (files.shopRegistrationCertificate) {
      const upload = await this.processFileUpload(
        files.shopRegistrationCertificate,
      );
      if (upload.url) {
        docs.shopRegistrationCertificate = upload.url;
        docs.shopRegistrationCertificateKey = upload.key;
      }
    }

    if (files.gstCertificate) {
      const upload = await this.processFileUpload(files.gstCertificate);
      if (upload.url) {
        docs.gstCertificate = upload.url;
        docs.gstCertificateKey = upload.key;
      }
    }

    merchant.documents = docs;
    merchant.updatedBy = updaterId;
    await merchant.save();

    const updatedPopulated = await MerchantProfile.findById(merchant._id)
      .populate("branchId", "name code")
      .lean();

    return this.formatMerchantResponse(updatedPopulated || merchant);
  }

  /**
   * Soft delete Merchant
   */
  async deleteMerchant(societyContext, id, deleterId) {
    const bankId = societyContext?.bankId;
    const query = { _id: id, isDeleted: { $ne: true } };

    if (bankId) {
      query.bankId = bankId;
    }

    if (societyContext?.branchId) {
      query.branchId = societyContext.branchId;
    }

    const merchant = await MerchantProfile.findOne(query);
    if (!merchant) {
      throw ApiError.notFound("Merchant not found for deletion.");
    }

    merchant.isDeleted = true;
    merchant.deletedAt = new Date();
    merchant.deletedBy = deleterId;
    await merchant.save();

    if (merchant.userId) {
      await User.updateOne(
        { _id: merchant.userId },
        { isDeleted: true, deletedAt: new Date(), deletedBy: deleterId },
      );
    }

    return { id: merchant._id, message: "Merchant soft-deleted successfully." };
  }

  /**
   * Restore a soft-deleted Merchant Partner Profile and User account
   */
  async restoreMerchant(societyContext, id, restorerId) {
    const bankId = societyContext?.bankId;
    const query = { _id: id, includeDeleted: true };

    if (bankId) {
      query.bankId = bankId;
    }

    if (societyContext?.branchId) {
      query.branchId = societyContext.branchId;
    }

    const merchant = await MerchantProfile.findOne(query);
    if (!merchant) {
      throw ApiError.notFound("Merchant profile not found.");
    }

    if (!merchant.isDeleted) {
      throw ApiError.badRequest("Merchant account is not deleted.");
    }

    merchant.isDeleted = false;
    merchant.deletedAt = null;
    merchant.deletedBy = null;
    merchant.status = "ACTIVE";
    merchant.updatedBy = restorerId;
    await merchant.save();

    if (merchant.userId) {
      await User.updateOne(
        { _id: merchant.userId },
        {
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
          status: "ACTIVE",
        },
      );
    }

    const restoredMerchant = await MerchantProfile.findById(merchant._id)
      .populate("branchId", "name code")
      .lean();

    return this.formatMerchantResponse(restoredMerchant || merchant);
  }

  /**
   * Permanently (Hard) Delete a Merchant Partner Profile & User Account
   */
  async permanentDeleteMerchant(societyContext, id, deleterId) {
    const bankId = societyContext?.bankId;
    const query = { _id: id, includeDeleted: true };

    if (bankId) {
      query.bankId = bankId;
    }

    if (societyContext?.branchId) {
      query.branchId = societyContext.branchId;
    }

    const merchant = await MerchantProfile.findOne(query);
    if (!merchant) {
      throw ApiError.notFound(
        "Merchant profile not found for permanent deletion.",
      );
    }

    if (merchant.userId) {
      await User.deleteOne({ _id: merchant.userId });
    }

    await MerchantProfile.deleteOne({ _id: id });

    return {
      id: merchant._id,
      message: "Merchant permanently deleted successfully.",
    };
  }

  /**
   * List active merchants for dropdown selections scoped to tenant bank/branch
   */
  async listMerchantsDropdown(societyContext, queryOptions = {}) {
    const bankId = societyContext?.bankId;
    const filter = { isDeleted: { $ne: true }, status: "ACTIVE" };

    if (bankId) {
      filter.bankId = bankId;
    }

    const scopedBranchId = societyContext?.branchId || queryOptions.branchId;
    if (scopedBranchId) {
      filter.branchId = scopedBranchId;
    }

    const merchants = await MerchantProfile.find(filter)
      .select(
        "_id shopName ownerName email phoneNumber gstinNumber bankId branchId",
      )
      .populate("branchId", "name code")
      .sort({ shopName: 1 })
      .lean();

    return merchants.map((m) => ({
      id: m._id,
      merchantId: m._id,
      shopName: m.shopName,
      ownerName: m.ownerName,
      label: `${m.shopName} (${m.ownerName})`,
      phoneNumber: m.phoneNumber,
      email: m.email,
      branchId: m.branchId?._id || m.branchId,
      branchName: m.branchId?.name || "N/A",
    }));
  }

  /**
   * Approve Onboarded Merchant (Branch Owner / Manager / QC)
   */
  async approveMerchant(societyContext, merchantId, approvedByUserId) {
    const approverRole = (societyContext?.role || "").trim().toUpperCase();
    const isAuthorizedApprover =
      societyContext?.isBankOwner ||
      societyContext?.isBranchManager ||
      societyContext?.isQualityCheck ||
      isBranchManagerRole(approverRole) ||
      isQualityCheckRole(approverRole) ||
      [
        "SUPER_ADMIN",
        "BANK_OWNER",
        "SOCIETY_ADMIN",
        "MANAGER",
        "BRANCH_MANAGER",
        "QC",
        "QUALITY_CHECK",
      ].includes(approverRole);

    if (!isAuthorizedApprover) {
      throw ApiError.forbidden(
        "Access denied. Only Branch Manager, Bank Owner, or Quality Check (QC) role can approve merchant applications.",
      );
    }

    const targetId = merchantId || societyContext?.merchantId;
    if (!targetId) {
      throw ApiError.badRequest("Merchant ID is required for approval.");
    }

    const bankId = societyContext?.bankId;
    const query = { _id: targetId, isDeleted: { $ne: true } };

    if (bankId) {
      query.bankId = bankId;
    }

    if (societyContext?.branchId) {
      query.branchId = societyContext.branchId;
    }

    const merchant = await MerchantProfile.findOne(query).populate(
      "branchId",
      "name code",
    );

    if (!merchant) {
      throw ApiError.notFound("Merchant profile not found for approval.");
    }

    if (!merchant.branchId && merchant.bankId) {
      const defaultBranch = await Branch.findOne({
        bankId: merchant.bankId,
        isDeleted: { $ne: true },
      })
        .select("name code")
        .lean();
      if (defaultBranch) {
        merchant.branchId = defaultBranch._id;
      }
    }

    // Mandatory Society Account Check: Ensure society account is linked before approving merchant
    let societyLink = null;
    if (merchant.userId) {
      societyLink = await SocietyCustomerLink.findOne({
        userId: merchant.userId,
        ...(merchant.bankId ? { bankId: merchant.bankId } : {}),
      }).lean();
    }

    const bd = merchant.bankDetails || {};
    const sa = merchant.societyAccount || {};
    const existingAccNum = (
      sa.societyAccountNumber ||
      merchant.societyAccount?.societyAccountNumber ||
      societyLink?.societyAccountNumber ||
      ""
    ).trim();

    const holderName = (
      sa.accountHolderName ||
      merchant.societyAccount?.accountHolderName ||
      societyLink?.accountHolderName ||
      merchant.ownerName ||
      ""
    ).trim();
    const ifscCode = (
      sa.ifscCode ||
      merchant.societyAccount?.ifscCode ||
      societyLink?.ifscCode ||
      ""
    ).trim();
    const branchName = (
      sa.bankBranchName ||
      merchant.societyAccount?.bankBranchName ||
      societyLink?.bankBranchName ||
      merchant.branchId?.name ||
      "Main Branch"
    ).trim();

    if (!existingAccNum) {
      throw ApiError.badRequest(
        `Cannot approve Merchant [${merchant.merchantCode || merchant.code || merchant.shopName}]: Merchant society account number is missing or does not exist. Please add society account details first before approval.`,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    merchant.societyAccount = {
      societyAccountNumber: existingAccNum,
      ifscCode: ifscCode,
      accountHolderName: holderName,
      bankBranchName: branchName,
    };

    // Update MerchantProfile status
    merchant.approvalStatus = "APPROVED";
    merchant.status = "ACTIVE"; 
    merchant.approvedAt = new Date();
    merchant.approvedBy = approvedByUserId || societyContext?.userId || null;
    merchant.rejectionReason = null;
    await merchant.save();

    // Update associated User account status
    if (merchant.userId) {
      const user = await User.findById(merchant.userId);
      if (user) {
        user.status = "ACTIVE";
        user.isApproved = true;
        await user.save();
      }
    }

    const updatedPopulated = await MerchantProfile.findById(merchant._id)
      .populate("branchId", "name code")
      .lean();

    // Dispatch MSG91 email notifications to customer and creating executive
    societyLeadEmailService
      .sendMerchantApprovalEmails({
        merchant: updatedPopulated || merchant,
        societyContext,
      })
      .catch(() => {});

    return {
      message: `Merchant "${merchant.shopName}" has been approved successfully. Merchant can now login.`,
      merchant: this.formatMerchantResponse(updatedPopulated || merchant),
    };
  }

  /**
   * Reject Onboarded Merchant (Branch Owner / Manager / QC)
   */
  async rejectMerchant(societyContext, merchantId, reason, rejectedByUserId) {
    const approverRole = (societyContext?.role || "").trim().toUpperCase();
    const isAuthorizedApprover =
      societyContext?.isBankOwner ||
      societyContext?.isBranchManager ||
      societyContext?.isQualityCheck ||
      isBranchManagerRole(approverRole) ||
      isQualityCheckRole(approverRole) ||
      [
        "SUPER_ADMIN",
        "BANK_OWNER",
        "SOCIETY_ADMIN",
        "MANAGER",
        "BRANCH_MANAGER",
        "QC",
        "QUALITY_CHECK",
      ].includes(approverRole);

    if (!isAuthorizedApprover) {
      throw ApiError.forbidden(
        "Access denied. Only Branch Manager, Bank Owner, or Quality Check (QC) role can reject merchant applications.",
      );
    }

    const targetId = merchantId || societyContext?.merchantId;
    if (!targetId) {
      throw ApiError.badRequest("Merchant ID is required for rejection.");
    }

    const cleanReason = String(reason || "").trim();
    if (!cleanReason) {
      throw ApiError.badRequest(
        "Rejection reason (reason) is required to reject Merchant application.",
      );
    }

    const bankId = societyContext?.bankId;
    const query = { _id: targetId, isDeleted: { $ne: true } };

    if (bankId) {
      query.bankId = bankId;
    }

    if (societyContext?.branchId) {
      query.branchId = societyContext.branchId;
    }

    const merchant = await MerchantProfile.findOne(query).populate(
      "branchId",
      "name code",
    );

    if (!merchant) {
      throw ApiError.notFound("Merchant profile not found for rejection.");
    }

    if (!merchant.branchId && merchant.bankId) {
      const defaultBranch = await Branch.findOne({
        bankId: merchant.bankId,
        isDeleted: { $ne: true },
      })
        .select("name code")
        .lean();
      if (defaultBranch) {
        merchant.branchId = defaultBranch._id;
      }
    }

    // Update MerchantProfile status
    merchant.approvalStatus = "REJECTED";
    merchant.status = "INACTIVE";
    merchant.rejectionReason = reason.trim();
    merchant.rejectedAt = new Date();
    merchant.rejectedBy = rejectedByUserId || societyContext?.userId || null;
    await merchant.save();

    // Update associated User account status
    if (merchant.userId) {
      const user = await User.findById(merchant.userId);
      if (user) {
        user.status = "REJECTED";
        user.isApproved = false;
        await user.save();
      }
    }

    const updatedPopulated = await MerchantProfile.findById(merchant._id)
      .populate("branchId", "name code")
      .lean();

    // Dispatch MSG91 email notifications to customer and creating executive
    societyLeadEmailService
      .sendMerchantRejectionEmails({
        merchant: updatedPopulated || merchant,
        reason: cleanReason,
        societyContext,
      })
      .catch(() => {});

    return {
      message: `Merchant onboarding for "${merchant.shopName}" has been rejected.`,
      merchant: this.formatMerchantResponse(updatedPopulated || merchant),
    };
  }

  /**
   * Link / Add Society Bank Account details for Merchant Partner (Pigmy API pattern)
   * POST /api/v1/society/merchants/:id/society-account
   * POST /api/v1/society/merchants/:id/link-bank
   */
  async linkBankAccount(societyContext, merchantIdOrPayload, payload = {}) {
    let targetId = merchantIdOrPayload;
    let dataPayload = payload;

    if (
      typeof merchantIdOrPayload === "object" &&
      merchantIdOrPayload !== null
    ) {
      targetId =
        merchantIdOrPayload.merchantId ||
        merchantIdOrPayload.id ||
        merchantIdOrPayload.customerId ||
        merchantIdOrPayload.userId;
      dataPayload = merchantIdOrPayload;
    }

    // Support nested societyAccount / societyBankAccount / bankDetails or top-level body keys
    const nestedBank =
      dataPayload.societyAccount ||
      dataPayload.societyBankAccount ||
      dataPayload.bankDetails ||
      {};

    const accountNumber = String(
      dataPayload.societyAccountNumber ||
        dataPayload.accountNumber ||
        nestedBank.societyAccountNumber ||
        nestedBank.accountNumber ||
        "",
    ).trim();

    if (!accountNumber) {
      throw ApiError.badRequest(
        "Society Bank Account Number (societyAccountNumber or accountNumber) is required to link bank account.",
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const lookupId =
      targetId ||
      dataPayload.merchantId ||
      dataPayload.id ||
      dataPayload.customerId ||
      dataPayload.userId ||
      dataPayload.phoneNumber;

    if (!lookupId) {
      throw ApiError.badRequest(
        "Merchant ID, User ID, or Phone Number is required to locate merchant record.",
        ErrorCode.VALIDATION_ERROR,
      );
    }

    const trimmedId = String(lookupId).trim();
    const isObjectId = mongoose.Types.ObjectId.isValid(trimmedId);

    const bankId = societyContext?.bankId;
    const query = {
      $or: [
        ...(isObjectId
          ? [
              { _id: new mongoose.Types.ObjectId(trimmedId) },
              { userId: new mongoose.Types.ObjectId(trimmedId) },
            ]
          : []),
        { merchantCode: trimmedId.toUpperCase() },
        { code: trimmedId.toUpperCase() },
        { email: trimmedId.toLowerCase() },
        { phoneNumber: trimmedId },
        { primaryPhoneNumber: trimmedId },
      ],
      isDeleted: { $ne: true },
    };

    if (bankId) {
      query.bankId = bankId;
    }

    if (societyContext?.branchId) {
      query.branchId = societyContext.branchId;
    }

    const merchant = await MerchantProfile.findOne(query).populate(
      "branchId",
      "name code",
    );

    if (!merchant) {
      throw ApiError.notFound(
        `Merchant profile not found for identifier [${lookupId}].`,
      );
    }

    // Check duplicate bank account number across DB excluding this merchant
    await this.checkBankAccountExists(accountNumber, merchant._id);

    const ifscCode = String(
      dataPayload.ifscCode ||
        nestedBank.ifscCode ||
        merchant.societyAccount?.ifscCode ||
        "",
    )
      .trim()
      .toUpperCase();

    const accountHolderName = String(
      dataPayload.accountHolderName ||
        nestedBank.accountHolderName ||
        merchant.societyAccount?.accountHolderName ||
        merchant.ownerName ||
        "",
    ).trim();

    const branchName = String(
      dataPayload.branchName ||
        dataPayload.bankBranchName ||
        nestedBank.branchName ||
        nestedBank.bankBranchName ||
        merchant.societyAccount?.bankBranchName ||
        merchant.branchId?.name ||
        "",
    ).trim();

    // Standard bank validation for co-operative bank
    if (
      !accountHolderName ||
      !accountNumber ||
      !ifscCode ||
      !branchName
    ) {
      throw ApiError.badRequest(
        "Society Bank account details (Account Holder Name, Society Account Number, IFSC Code, and Branch Name) are required to link society bank account.",
        ErrorCode.VALIDATION_ERROR,
      );
    }

    merchant.societyAccount = {
      societyAccountNumber: accountNumber,
      ifscCode,
      accountHolderName,
      bankBranchName: branchName,
    };

    await merchant.save();

    // Sync SocietyCustomerLink
    if (merchant.userId) {
      let societyLink = await SocietyCustomerLink.findOne({
        userId: merchant.userId,
        bankId: merchant.bankId,
      });

      if (!societyLink) {
        societyLink = new SocietyCustomerLink({
          userId: merchant.userId,
          customerId: `CUST-${merchant.userId.toString().slice(-6).toUpperCase()}`,
          bankId: merchant.bankId,
          branchId: merchant.branchId?._id || merchant.branchId,
          firstOnboardedAt: new Date(),
          kycStatus: "VERIFIED",
        });
      }

      societyLink.societyAccountNumber = accountNumber;
      if (ifscCode) societyLink.ifscCode = ifscCode;
      if (accountHolderName) societyLink.accountHolderName = accountHolderName;
      if (branchName) societyLink.bankBranchName = branchName;
      if (merchant.branchId)
        societyLink.branchId = merchant.branchId?._id || merchant.branchId;

      await societyLink.save();
    }

    const updatedPopulated = await MerchantProfile.findById(merchant._id)
      .populate("branchId", "name code")
      .lean();

    let fallbackKyc = null;
    if (
      !merchant.aadhaarNumber ||
      !merchant.panNumber ||
      !merchant.documents?.ownerAadhaar ||
      !merchant.documents?.ownerPan
    ) {
      fallbackKyc = await resolveExistingCustomerKyc({
        phoneNumber: merchant.phoneNumber || merchant.primaryPhoneNumber,
        userId: merchant.userId,
      });

      const updateFields = {};
      if (!merchant.aadhaarNumber && fallbackKyc.aadhaarNumber)
        updateFields.aadhaarNumber = fallbackKyc.aadhaarNumber;
      if (!merchant.panNumber && fallbackKyc.panNumber)
        updateFields.panNumber = fallbackKyc.panNumber;
      if (!merchant.documents?.ownerAadhaar && fallbackKyc.ownerAadhaar)
        updateFields["documents.ownerAadhaar"] = fallbackKyc.ownerAadhaar;
      if (!merchant.documents?.ownerPan && fallbackKyc.ownerPan)
        updateFields["documents.ownerPan"] = fallbackKyc.ownerPan;

      if (Object.keys(updateFields).length > 0) {
        MerchantProfile.updateOne(
          { _id: merchant._id },
          { $set: updateFields },
        ).catch(() => {});
      }
    }

    return {
      message: `Society Bank Account linked successfully for merchant "${merchant.shopName}".`,
      merchant: this.formatMerchantResponse(updatedPopulated || merchant, null, fallbackKyc),
      societyAccount: {
        societyAccountNumber: accountNumber,
        ifscCode,
        accountHolderName,
        bankBranchName: branchName,
      },
    };
  }
}

export const societyMerchantService = new SocietyMerchantService();
