import { mailer } from "../../../emails/mailer.util.js";
import { msg91TemplateConfig } from "../../../config/panel-control.config.js";
import { Bank } from "../../../models/bank.model.js";
import { Branch } from "../../../models/branch.model.js";
import { User } from "../../../models/user.model.js";
import { SocietyEmployee } from "../../../models/society-employee.model.js";
import { BranchManager } from "../../../models/branch-manager.model.js";
import { logger } from "../../../utils/logger.util.js";

class SocietyLeadEmailService {
  /**
   * Format date values into clean string (DD MMM YYYY)
   */
  formatDate(dateVal) {
    if (!dateVal)
      return new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  /**
   * Helper to resolve Executive email and name from createdBy / onboardedBy fields
   */
  async resolveExecutiveInfo(onboardedBy = {}, createdBy = null) {
    let executiveEmail = null;
    let executiveName = onboardedBy?.name || "Executive";
    let executiveRole = onboardedBy?.role || "Field Executive";

    const targetUserId = createdBy || onboardedBy?.userId || onboardedBy?.id;

    if (targetUserId) {
      try {
        const userDoc = await User.findById(targetUserId).lean();
        if (userDoc) {
          executiveEmail = userDoc.email || null;
          executiveName = userDoc.fullName || userDoc.name || executiveName;
          executiveRole = userDoc.role || executiveRole;
        }
      } catch (err) {
        logger.warn(
          `Failed resolving User for executive ID [${targetUserId}]: ${err.message}`,
        );
      }
    }

    // Fallback: If no email found yet, check SocietyEmployee or BranchManager by phone or ID
    if (!executiveEmail && onboardedBy?.phone) {
      try {
        const empDoc = await SocietyEmployee.findOne({
          $or: [
            { phoneNumber: onboardedBy.phone },
            { primaryPhoneNumber: onboardedBy.phone },
          ],
          isDeleted: { $ne: true },
        }).lean();

        if (empDoc) {
          executiveEmail =
            empDoc.email || empDoc.personalDetails?.email || null;
          executiveName = empDoc.fullName || executiveName;
        }
      } catch (err) {
        logger.warn(
          `Failed resolving SocietyEmployee by phone [${onboardedBy.phone}]: ${err.message}`,
        );
      }
    }

    if (!executiveEmail && onboardedBy?.phone) {
      try {
        const mgrDoc = await BranchManager.findOne({
          $or: [
            { phoneNumber: onboardedBy.phone },
            { primaryPhoneNumber: onboardedBy.phone },
          ],
          isDeleted: { $ne: true },
        }).lean();

        if (mgrDoc) {
          executiveEmail = mgrDoc.email || null;
          executiveName = mgrDoc.fullName || executiveName;
        }
      } catch (err) {
        logger.warn(
          `Failed resolving BranchManager by phone [${onboardedBy.phone}]: ${err.message}`,
        );
      }
    }

    return {
      email: executiveEmail,
      name: executiveName,
      role: executiveRole,
    };
  }

  /**
   * Resolve Bank and Branch names for email notifications
   */
  async resolveBankAndBranchNames(bankId, branchId) {
    let bankName = "Co-operative Society Bank";
    let branchName = "Main Branch";

    if (bankId) {
      try {
        if (typeof bankId === "object" && bankId.name) {
          bankName = bankId.name;
        } else {
          const bankDoc = await Bank.findById(bankId).select("name").lean();
          if (bankDoc?.name) bankName = bankDoc.name;
        }
      } catch (err) {
        logger.warn(
          `Error resolving Bank name for [${bankId}]: ${err.message}`,
        );
      }
    }

    if (branchId) {
      try {
        if (typeof branchId === "object" && branchId.name) {
          branchName = branchId.name;
        } else {
          const branchDoc = await Branch.findById(branchId)
            .select("name")
            .lean();
          if (branchDoc?.name) branchName = branchDoc.name;
        }
      } catch (err) {
        logger.warn(
          `Error resolving Branch name for [${branchId}]: ${err.message}`,
        );
      }
    }

    return { bankName, branchName };
  }

  /**
   * Dispatch Merchant Lead Approval Emails to Customer & Executive
   */
  async sendMerchantApprovalEmails({ merchant, societyContext }) {
    if (!merchant) return;

    try {
      const { bankName, branchName } = await this.resolveBankAndBranchNames(
        merchant.bankId || societyContext?.bankId,
        merchant.branchId || societyContext?.branchId,
      );

      const approverName =
        societyContext?.userName ||
        societyContext?.fullName ||
        "Branch Manager";
      const approverRole = societyContext?.role || "BRANCH_MANAGER";
      const approvedDateStr = this.formatDate(
        merchant.approvedAt || new Date(),
      );
      const merchantCode =
        merchant.merchantCode || merchant.code || String(merchant._id);
      const ownerName =
        merchant.ownerName || merchant.shopName || "Valued Merchant";
      const shopName = merchant.shopName || "Merchant Store";

      const templates = msg91TemplateConfig.SOCIETY_PANEL || {};
      const customerTemplateId =
        templates.MERCHANT_APPROVAL_CUSTOMER ||
        "society_merchant_lead_approval_customer";
      const executiveTemplateId =
        templates.MERCHANT_APPROVAL_EXECUTIVE ||
        "society_merchant_lead_approval_executive";

      // 1. Dispatch Email to Merchant Customer
      if (merchant?.email) {
        try {
          await mailer.sendMail({
            to: merchant.email,
            name: ownerName,
            subject: `Merchant Onboarding Application Approved - ${bankName}`,
            templateId: customerTemplateId,
            variables: {
              customerName: ownerName,
              ownerName: ownerName,
              shopName: shopName,
              merchantCode: merchantCode,
              bankName: bankName,
              branchName: branchName,
              approvedDate: approvedDateStr,
              loginUrl: "https://sahayaone-partner-panel.netlify.app",
              supportEmail: "info@sahayaone.com",
            },
          });
          logger.info(
            `MERCHANT APPROVAL EMAIL SUCCESS: Dispatched to customer [${merchant.email}]`,
          );
        } catch (custErr) {
          logger.error(
            `MERCHANT APPROVAL EMAIL FAILED (Customer [${merchant.email}]): ${custErr.message}`,
          );
        }
      } else {
        logger.warn(
          `MERCHANT APPROVAL EMAIL SKIPPED: Customer email missing for Merchant [${merchantCode}]`,
        );
      }

      // 2. Dispatch Email to Executive (Lead Creator)
      const execInfo = await this.resolveExecutiveInfo(
        merchant.onboardedBy,
        merchant.createdBy,
      );
      if (execInfo?.email) {
        try {
          await mailer.sendMail({
            to: execInfo.email,
            name: execInfo.name,
            subject: `Merchant Lead Approved: ${shopName} - ${bankName}`,
            templateId: executiveTemplateId,
            variables: {
              executiveName: execInfo.name,
              merchantCode: merchantCode,
              shopName: shopName,
              ownerName: ownerName,
              bankName: bankName,
              branchName: branchName,
              approvedByName: approverName,
              approvedByRole: approverRole,
              approvedDate: approvedDateStr,
            },
          });
          logger.info(
            `MERCHANT APPROVAL EMAIL SUCCESS: Dispatched to executive [${execInfo.email}]`,
          );
        } catch (execErr) {
          logger.error(
            `MERCHANT APPROVAL EMAIL FAILED (Executive [${execInfo.email}]): ${execErr.message}`,
          );
        }
      } else {
        logger.info(
          `MERCHANT APPROVAL EMAIL SKIPPED: Executive email not found for Merchant [${merchantCode}]`,
        );
      }
    } catch (err) {
      logger.error(
        `SOCIETY LEAD EMAIL ERROR (Merchant Approval): ${err.message}`,
      );
    }
  }

  /**
   * Dispatch Merchant Lead Rejection Emails to Customer & Executive
   */
  async sendMerchantRejectionEmails({ merchant, reason, societyContext }) {
    if (!merchant) return;

    try {
      const { bankName, branchName } = await this.resolveBankAndBranchNames(
        merchant.bankId || societyContext?.bankId,
        merchant.branchId || societyContext?.branchId,
      );

      const rejecterName =
        societyContext?.userName ||
        societyContext?.fullName ||
        "Branch Manager";
      const rejectedDateStr = this.formatDate(
        merchant.rejectedAt || new Date(),
      );
      const merchantCode =
        merchant.merchantCode || merchant.code || String(merchant._id);
      const ownerName =
        merchant.ownerName || merchant.shopName || "Valued Merchant";
      const shopName = merchant.shopName || "Merchant Store";
      const cleanReason = (
        reason ||
        merchant.rejectionReason ||
        "Requirements not met"
      ).trim();

      const templates = msg91TemplateConfig.SOCIETY_PANEL || {};
      const customerTemplateId =
        templates.MERCHANT_REJECTION_CUSTOMER ||
        "society_merchant_lead_rejection_customer";
      const executiveTemplateId =
        templates.MERCHANT_REJECTION_EXECUTIVE ||
        "society_merchant_lead_rejection_executive";

      // 1. Dispatch Email to Merchant Customer
      if (merchant?.email) {
        try {
          await mailer.sendMail({
            to: merchant.email,
            name: ownerName,
            subject: `Merchant Onboarding Application Status Update - ${bankName}`,
            templateId: customerTemplateId,
            variables: {
              customerName: ownerName,
              ownerName: ownerName,
              shopName: shopName,
              merchantCode: merchantCode,
              bankName: bankName,
              branchName: branchName,
              rejectionReason: cleanReason,
              reason: cleanReason,
              supportEmail: "info@sahayaone.com",
            },
          });
          logger.info(
            `MERCHANT REJECTION EMAIL SUCCESS: Dispatched to customer [${merchant.email}]`,
          );
        } catch (custErr) {
          logger.error(
            `MERCHANT REJECTION EMAIL FAILED (Customer [${merchant.email}]): ${custErr.message}`,
          );
        }
      }

      // 2. Dispatch Email to Executive (Lead Creator)
      const execInfo = await this.resolveExecutiveInfo(
        merchant.onboardedBy,
        merchant.createdBy,
      );
      if (execInfo?.email) {
        try {
          await mailer.sendMail({
            to: execInfo.email,
            name: execInfo.name,
            subject: `Merchant Lead Rejected: ${shopName} - ${bankName}`,
            templateId: executiveTemplateId,
            variables: {
              executiveName: execInfo.name,
              merchantCode: merchantCode,
              shopName: shopName,
              ownerName: ownerName,
              bankName: bankName,
              branchName: branchName,
              rejectionReason: cleanReason,
              reason: cleanReason,
              rejectedByName: rejecterName,
              rejectedDate: rejectedDateStr,
            },
          });
          logger.info(
            `MERCHANT REJECTION EMAIL SUCCESS: Dispatched to executive [${execInfo.email}]`,
          );
        } catch (execErr) {
          logger.error(
            `MERCHANT REJECTION EMAIL FAILED (Executive [${execInfo.email}]): ${execErr.message}`,
          );
        }
      }
    } catch (err) {
      logger.error(
        `SOCIETY LEAD EMAIL ERROR (Merchant Rejection): ${err.message}`,
      );
    }
  }

  /**
   * Dispatch Pigmy Deposit Lead Approval Emails to Customer & Executive
   */
  async sendPigmyApprovalEmails({ pigmyCustomer, societyUser }) {
    if (!pigmyCustomer) return;

    try {
      const { bankName, branchName } = await this.resolveBankAndBranchNames(
        pigmyCustomer.bankId,
        pigmyCustomer.branchId,
      );

      const approverName =
        societyUser?.fullName || societyUser?.name || "Branch Manager";
      const approvedDateStr = this.formatDate(
        pigmyCustomer.approvedAt || new Date(),
      );
      const pigmyCode =
        pigmyCustomer.pigmyCustomerCode ||
        pigmyCustomer.code ||
        String(pigmyCustomer._id);
      const customerName =
        pigmyCustomer.fullName || pigmyCustomer.ownerName || "Valued Customer";
      const societyAccNum =
        pigmyCustomer.societyAccount?.societyAccountNumber ||
        pigmyCustomer.existingSavingsAccountNumber ||
        "N/A";
      const dailyDeposit = String(pigmyCustomer.dailyDepositAmount || 100);
      const tenure = String(pigmyCustomer.tenureMonths || 12);
      const startDateStr = this.formatDate(pigmyCustomer.startDate);
      const endDateStr = this.formatDate(pigmyCustomer.endDate);

      const templates = msg91TemplateConfig.SOCIETY_PANEL || {};
      const customerTemplateId =
        templates.PIGMY_APPROVAL_CUSTOMER ||
        "society_pigmy_lead_approval_customer";
      const executiveTemplateId =
        templates.PIGMY_APPROVAL_EXECUTIVE ||
        "society_pigmy_lead_approval_executive";

      // 1. Dispatch Email to Pigmy Customer
      if (pigmyCustomer?.email) {
        try {
          await mailer.sendMail({
            to: pigmyCustomer.email,
            name: customerName,
            subject: `Pigmy Deposit Account Approved & Activated - ${bankName}`,
            templateId: customerTemplateId,
            variables: {
              customerName: customerName,
              pigmyCustomerCode: pigmyCode,
              societyAccountNumber: societyAccNum,
              dailyDepositAmount: dailyDeposit,
              tenureMonths: tenure,
              startDate: startDateStr,
              endDate: endDateStr,
              bankName: bankName,
              branchName: branchName,
              approvedDate: approvedDateStr,
            },
          });
          logger.info(
            `PIGMY APPROVAL EMAIL SUCCESS: Dispatched to customer [${pigmyCustomer.email}]`,
          );
        } catch (custErr) {
          logger.error(
            `PIGMY APPROVAL EMAIL FAILED (Customer [${pigmyCustomer.email}]): ${custErr.message}`,
          );
        }
      } else {
        logger.info(
          `PIGMY APPROVAL EMAIL SKIPPED: Customer email missing for Pigmy [${pigmyCode}]`,
        );
      }

      // 2. Dispatch Email to Executive (Lead Creator)
      const execInfo = await this.resolveExecutiveInfo(
        pigmyCustomer.onboardedBy,
        pigmyCustomer.createdBy,
      );
      if (execInfo?.email) {
        try {
          await mailer.sendMail({
            to: execInfo.email,
            name: execInfo.name,
            subject: `Pigmy Customer Lead Approved: ${customerName} - ${bankName}`,
            templateId: executiveTemplateId,
            variables: {
              executiveName: execInfo.name,
              customerName: customerName,
              pigmyCustomerCode: pigmyCode,
              dailyDepositAmount: dailyDeposit,
              tenureMonths: tenure,
              bankName: bankName,
              branchName: branchName,
              approvedByName: approverName,
              approvedDate: approvedDateStr,
            },
          });
          logger.info(
            `PIGMY APPROVAL EMAIL SUCCESS: Dispatched to executive [${execInfo.email}]`,
          );
        } catch (execErr) {
          logger.error(
            `PIGMY APPROVAL EMAIL FAILED (Executive [${execInfo.email}]): ${execErr.message}`,
          );
        }
      } else {
        logger.info(
          `PIGMY APPROVAL EMAIL SKIPPED: Executive email not found for Pigmy [${pigmyCode}]`,
        );
      }
    } catch (err) {
      logger.error(`SOCIETY LEAD EMAIL ERROR (Pigmy Approval): ${err.message}`);
    }
  }

  /**
   * Dispatch Pigmy Deposit Lead Rejection Emails to Customer & Executive
   */
  async sendPigmyRejectionEmails({ pigmyCustomer, reason, societyUser }) {
    if (!pigmyCustomer) return;

    try {
      const { bankName, branchName } = await this.resolveBankAndBranchNames(
        pigmyCustomer.bankId,
        pigmyCustomer.branchId,
      );

      const rejecterName =
        societyUser?.fullName || societyUser?.name || "Branch Manager";
      const rejectedDateStr = this.formatDate(
        pigmyCustomer.rejectedAt || new Date(),
      );
      const pigmyCode =
        pigmyCustomer.pigmyCustomerCode ||
        pigmyCustomer.code ||
        String(pigmyCustomer._id);
      const customerName =
        pigmyCustomer.fullName || pigmyCustomer.ownerName || "Valued Customer";
      const cleanReason = (
        reason ||
        pigmyCustomer.rejectionReason ||
        "Application requirements not satisfied"
      ).trim();

      const templates = msg91TemplateConfig.SOCIETY_PANEL || {};
      const customerTemplateId =
        templates.PIGMY_REJECTION_CUSTOMER ||
        "society_pigmy_lead_rejection_customer";
      const executiveTemplateId =
        templates.PIGMY_REJECTION_EXECUTIVE ||
        "society_pigmy_lead_rejection_executive";

      // 1. Dispatch Email to Pigmy Customer
      if (pigmyCustomer?.email) {
        try {
          await mailer.sendMail({
            to: pigmyCustomer.email,
            name: customerName,
            subject: `Pigmy Deposit Application Status Update - ${bankName}`,
            templateId: customerTemplateId,
            variables: {
              customerName: customerName,
              pigmyCustomerCode: pigmyCode,
              bankName: bankName,
              branchName: branchName,
              rejectionReason: cleanReason,
              reason: cleanReason,
              supportEmail: "info@sahayaone.com",
            },
          });
          logger.info(
            `PIGMY REJECTION EMAIL SUCCESS: Dispatched to customer [${pigmyCustomer.email}]`,
          );
        } catch (custErr) {
          logger.error(
            `PIGMY REJECTION EMAIL FAILED (Customer [${pigmyCustomer.email}]): ${custErr.message}`,
          );
        }
      }

      // 2. Dispatch Email to Executive (Lead Creator)
      const execInfo = await this.resolveExecutiveInfo(
        pigmyCustomer.onboardedBy,
        pigmyCustomer.createdBy,
      );
      if (execInfo?.email) {
        try {
          await mailer.sendMail({
            to: execInfo.email,
            name: execInfo.name,
            subject: `Pigmy Lead Rejected: ${customerName} - ${bankName}`,
            templateId: executiveTemplateId,
            variables: {
              executiveName: execInfo.name,
              customerName: customerName,
              pigmyCustomerCode: pigmyCode,
              bankName: bankName,
              branchName: branchName,
              rejectionReason: cleanReason,
              reason: cleanReason,
              rejectedByName: rejecterName,
              rejectedDate: rejectedDateStr,
            },
          });
          logger.info(
            `PIGMY REJECTION EMAIL SUCCESS: Dispatched to executive [${execInfo.email}]`,
          );
        } catch (execErr) {
          logger.error(
            `PIGMY REJECTION EMAIL FAILED (Executive [${execInfo.email}]): ${execErr.message}`,
          );
        }
      }
    } catch (err) {
      logger.error(
        `SOCIETY LEAD EMAIL ERROR (Pigmy Rejection): ${err.message}`,
      );
    }
  }
}

export const societyLeadEmailService = new SocietyLeadEmailService();
