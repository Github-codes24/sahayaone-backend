import { CustomerProfile } from "../models/customer-profile.model.js";
import { SocietyCustomerLink } from "../models/society-customer-link.model.js";
import { Loan } from "../models/loan.model.js";
import { CreditReportRequest } from "../models/cibilReport.model.js";
import { MerchantProfile } from "../models/merchant-profile.model.js";
import { PigmyCustomer } from "../models/pigmy-customer.model.js";
import { User } from "../models/user.model.js";
import { logger } from "./logger.util.js";

/**
 * Resolves existing customer Aadhaar and PAN numbers and document URLs
 * across all existing platform entities (CustomerProfile, SocietyCustomerLink,
 * Loan, CreditReportRequest, MerchantProfile, PigmyCustomer, User).
 *
 * @param {Object} params
 * @param {string} [params.phoneNumber]
 * @param {string|mongoose.Types.ObjectId} [params.userId]
 * @param {string|mongoose.Types.ObjectId} [params.customerId]
 * @returns {Promise<{
 *   aadhaarNumber: string|null,
 *   panNumber: string|null,
 *   ownerAadhaar: string|null,
 *   ownerPan: string|null
 * }>}
 */
export async function resolveExistingCustomerKyc({ phoneNumber, userId, customerId } = {}) {
  const cleanPhone = phoneNumber ? String(phoneNumber).trim() : null;
  const phone10 = cleanPhone ? (cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone) : null;

  let resolvedAadhaarNumber = null;
  let resolvedPanNumber = null;
  let resolvedOwnerAadhaar = null;
  let resolvedOwnerPan = null;

  try {
    // 1. Check CustomerProfile (Primary source for KYC / DigiLocker / Loan verification)
    const profileOr = [
      ...(userId ? [{ userId }] : []),
      ...(cleanPhone ? [{ phoneNumber: cleanPhone }, { phone: cleanPhone }, ...(phone10 ? [{ phoneNumber: phone10 }, { phone: phone10 }] : [])] : []),
      ...(customerId ? [{ _id: customerId }, { customerUniqueId: customerId }] : [])
    ];
    if (profileOr.length > 0) {
      const profile = await CustomerProfile.findOne({ $or: profileOr, isDeleted: { $ne: true } })
        .sort({ updatedAt: -1 })
        .lean();

      if (profile) {
        if (!resolvedAadhaarNumber) {
          resolvedAadhaarNumber = profile.aadhaarNumber || profile.aadhaarCardNumber || profile.rawKycData?.aadhaarNumber || profile.rawKycData?.uid || profile.rawKycData?.maskedAadhaar || null;
        }
        if (!resolvedPanNumber) {
          resolvedPanNumber = profile.panNumber || profile.panCardNumber || profile.rawKycData?.panNumber || profile.rawKycData?.pan || null;
        }
        if (!resolvedOwnerAadhaar) {
          resolvedOwnerAadhaar = profile.aadhaarImage || profile.documents?.ownerAadhaar || profile.documents?.aadhaarFront || profile.aadhaarPicUrl || null;
        }
        if (!resolvedOwnerPan) {
          resolvedOwnerPan = profile.panImage || profile.documents?.ownerPan || profile.documents?.panCard || profile.panPicUrl || null;
        }
      }
    }

    // If both numbers and both documents resolved, return early
    if (resolvedAadhaarNumber && resolvedPanNumber && resolvedOwnerAadhaar && resolvedOwnerPan) {
      return {
        aadhaarNumber: resolvedAadhaarNumber ? String(resolvedAadhaarNumber).trim() : null,
        panNumber: resolvedPanNumber ? String(resolvedPanNumber).trim().toUpperCase() : null,
        ownerAadhaar: resolvedOwnerAadhaar || null,
        ownerPan: resolvedOwnerPan || null
      };
    }

    // 2. Check SocietyCustomerLink
    const linkOr = [
      ...(userId ? [{ userId }] : []),
      ...(cleanPhone ? [{ phoneNumber: cleanPhone }, ...(phone10 ? [{ phoneNumber: phone10 }] : [])] : [])
    ];
    if (linkOr.length > 0) {
      const societyLink = await SocietyCustomerLink.findOne({ $or: linkOr })
        .sort({ updatedAt: -1 })
        .lean();

      if (societyLink) {
        if (!resolvedAadhaarNumber && societyLink.aadhaarNumber) {
          resolvedAadhaarNumber = societyLink.aadhaarNumber;
        }
        if (!resolvedPanNumber && societyLink.panNumber) {
          resolvedPanNumber = societyLink.panNumber;
        }
        if (!resolvedOwnerAadhaar && societyLink.aadhaarPicUrl) {
          resolvedOwnerAadhaar = societyLink.aadhaarPicUrl;
        }
        if (!resolvedOwnerPan && societyLink.panPicUrl) {
          resolvedOwnerPan = societyLink.panPicUrl;
        }
      }
    }

    // 3. Check Loan applications
    const loanOr = [
      ...(userId ? [{ customerId: userId }, { applicantId: userId }] : []),
      ...(cleanPhone ? [{ customerMobile: cleanPhone }, ...(phone10 ? [{ customerMobile: phone10 }] : [])] : [])
    ];
    if (loanOr.length > 0) {
      const loan = await Loan.findOne({ $or: loanOr })
        .sort({ createdAt: -1 })
        .lean();

      if (loan) {
        if (!resolvedAadhaarNumber) {
          resolvedAadhaarNumber = loan.aadhaarNumber || loan.applicantAadhaar || null;
        }
        if (!resolvedPanNumber) {
          resolvedPanNumber = loan.panNumber || loan.applicantPan || null;
        }
        if (!resolvedOwnerAadhaar) {
          resolvedOwnerAadhaar = loan.documents?.aadhaarFront || loan.documents?.aadhaarCardUrl || null;
        }
        if (!resolvedOwnerPan) {
          resolvedOwnerPan = loan.documents?.panCard || loan.documents?.panCardUrl || null;
        }
      }
    }

    // 4. Check CreditReportRequest (for PAN)
    if (!resolvedPanNumber) {
      const creditOr = [
        ...(userId ? [{ userId }] : []),
        ...(cleanPhone ? [{ mobile: cleanPhone }, { phoneNumber: cleanPhone }, ...(phone10 ? [{ mobile: phone10 }, { phoneNumber: phone10 }] : [])] : [])
      ];
      if (creditOr.length > 0) {
        const creditReq = await CreditReportRequest.findOne({ $or: creditOr })
          .sort({ createdAt: -1 })
          .lean();
        if (creditReq && (creditReq.pan || creditReq.panNumber)) {
          resolvedPanNumber = creditReq.pan || creditReq.panNumber;
        }
      }
    }

    // 5. Check MerchantProfile (if existing merchant)
    const merchantOr = [
      ...(userId ? [{ userId }] : []),
      ...(cleanPhone ? [{ phoneNumber: cleanPhone }, { primaryPhoneNumber: cleanPhone }, ...(phone10 ? [{ phoneNumber: phone10 }, { primaryPhoneNumber: phone10 }] : [])] : [])
    ];
    if (merchantOr.length > 0) {
      const merchant = await MerchantProfile.findOne({ $or: merchantOr, isDeleted: { $ne: true } })
        .sort({ updatedAt: -1 })
        .lean();

      if (merchant) {
        if (!resolvedAadhaarNumber) {
          resolvedAadhaarNumber = merchant.aadhaarNumber || null;
        }
        if (!resolvedPanNumber) {
          resolvedPanNumber = merchant.panNumber || null;
        }
        if (!resolvedOwnerAadhaar) {
          resolvedOwnerAadhaar = merchant.documents?.ownerAadhaar || merchant.aadhaarImage || null;
        }
        if (!resolvedOwnerPan) {
          resolvedOwnerPan = merchant.documents?.ownerPan || merchant.panImage || null;
        }
      }
    }

    // 6. Check PigmyCustomer (if existing pigmy customer)
    const pigmyOr = [
      ...(userId ? [{ userId }] : []),
      ...(cleanPhone ? [{ phoneNumber: cleanPhone }, { primaryPhoneNumber: cleanPhone }, ...(phone10 ? [{ phoneNumber: phone10 }, { primaryPhoneNumber: phone10 }] : [])] : [])
    ];
    if (pigmyOr.length > 0) {
      const pigmy = await PigmyCustomer.findOne({ $or: pigmyOr, isDeleted: { $ne: true } })
        .sort({ updatedAt: -1 })
        .lean();

      if (pigmy) {
        if (!resolvedAadhaarNumber) {
          resolvedAadhaarNumber = pigmy.aadhaarNumber || null;
        }
        if (!resolvedPanNumber) {
          resolvedPanNumber = pigmy.panNumber || null;
        }
        if (!resolvedOwnerAadhaar) {
          resolvedOwnerAadhaar = pigmy.documents?.ownerAadhaar || pigmy.aadhaarImage || null;
        }
        if (!resolvedOwnerPan) {
          resolvedOwnerPan = pigmy.documents?.ownerPan || pigmy.panImage || null;
        }
      }
    }

    // 7. Check User record
    if ((!resolvedAadhaarNumber || !resolvedPanNumber) && (userId || cleanPhone)) {
      const userOr = [
        ...(userId ? [{ _id: userId }] : []),
        ...(cleanPhone ? [{ phoneNumber: cleanPhone }, ...(phone10 ? [{ phoneNumber: phone10 }] : [])] : [])
      ];
      const userDoc = await User.findOne({ $or: userOr, isDeleted: { $ne: true } }).lean();
      if (userDoc) {
        if (!resolvedAadhaarNumber) {
          resolvedAadhaarNumber = userDoc.aadhaarNumber || userDoc.aadhaar || null;
        }
        if (!resolvedPanNumber) {
          resolvedPanNumber = userDoc.panNumber || userDoc.pan || null;
        }
        if (!resolvedOwnerAadhaar) {
          resolvedOwnerAadhaar = userDoc.aadhaarImage || null;
        }
        if (!resolvedOwnerPan) {
          resolvedOwnerPan = userDoc.panImage || null;
        }
      }
    }
  } catch (err) {
    logger.warn(`[CUSTOMER KYC RESOLVER] Error resolving KYC details: ${err.message}`);
  }

  return {
    aadhaarNumber: resolvedAadhaarNumber ? String(resolvedAadhaarNumber).trim() : null,
    panNumber: resolvedPanNumber ? String(resolvedPanNumber).trim().toUpperCase() : null,
    ownerAadhaar: resolvedOwnerAadhaar || null,
    ownerPan: resolvedOwnerPan || null
  };
}
