import fs from "fs";
import { panelControlConfig } from "../../../../config/panel-control.config.js";
import { mailer } from "../../../../emails/mailer.util.js";
import { SocietyEmployee } from "../../../../models/society-employee.model.js";
import { BranchManager } from "../../../../models/branch-manager.model.js";
import { EmployeeLetterLog } from "../../../../models/employee-letter-log.model.js";
import { Bank } from "../../../../models/bank.model.js";
import { Branch } from "../../../../models/branch.model.js";
import { logger } from "../../../../utils/logger.util.js";
import { ApiError } from "../../../../common/api.error.js";

class HrLetterEmailService {
  /**
   * Maps document type codes to MSG91 template IDs defined in panelControlConfig.SOCIETY_PANEL
   */
  getTemplateId(docCode) {
    const code = (docCode || "").toUpperCase();
    const panelTemplates = panelControlConfig.SOCIETY_PANEL || {};

    const mapping = {
      OFFER_LETTER:
        panelTemplates.OFFER_LETTER || "hr_employee_offer_letter_notification",
      CONFIRMATION_LETTER:
        panelTemplates.CONFIRMATION_LETTER ||
        "hr_employee_confirmation_letter_notification",
      PERFORMANCE_LETTER:
        panelTemplates.PERFORMANCE_LETTER || "template_20_08_2026_16_08",
      PROMOTION_LETTER:
        panelTemplates.PROMOTION_LETTER ||
        "hr_employee_promotion_letter_notification",
      TRANSFER_LETTER:
        panelTemplates.TRANSFER_LETTER ||
        "hr_employee_transfer_letter_notification",
      SALARY_SLIP:
        panelTemplates.SALARY_SLIP || "hr_employee_salary_slip_notification_2",
      INCREMENT_LETTER:
        panelTemplates.INCREMENT_LETTER ||
        "hr_employee_salary_increment_notification",
      SALARY_INCREMENT:
        panelTemplates.INCREMENT_LETTER ||
        "hr_employee_salary_increment_notification",
      TERMINATION_LETTER:
        panelTemplates.TERMINATION_LETTER ||
        "hr_employee_termination_letter_notification",
    };

    return mapping[code] || null;
  }

  /**
   * Helper to format date strings to DD MMM YYYY
   */
  formatDate(dateVal) {
    if (!dateVal) return "";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  /**
   * Dispatches MSG91 Email for Employee Letters
   */
  async sendLetterEmail(options = {}) {
    const {
      bankId,
      logId,
      employeeId,
      documentTypeCode,
      customEmail,
      customVariables = {},
      societyContext,
    } = options;

    let logDoc = null;
    if (logId) {
      logDoc = await EmployeeLetterLog.findById(logId).lean();
      if (!logDoc) {
        throw ApiError.notFound("Employee letter log entry not found.");
      }
    }

    const targetDocCode = (
      documentTypeCode ||
      logDoc?.documentTypeCode ||
      ""
    ).toUpperCase();
    const templateId = this.getTemplateId(targetDocCode);

    if (!templateId) {
      throw ApiError.badRequest(
        `No MSG91 email template ID configured for letter type: ${targetDocCode}`,
      );
    }

    const targetEmpId = employeeId || logDoc?.employeeId;
    let employee = null;
    if (targetEmpId) {
      employee = await SocietyEmployee.findById(targetEmpId)
        .populate("branchId", "name code state city")
        .lean();

      if (!employee) {
        employee = await BranchManager.findById(targetEmpId)
          .populate("branchId", "name code state city")
          .lean();
      }
    }

    // Branch scoping check for non-bank owners (e.g. Branch Managers or Branch Members)
    if (
      societyContext &&
      !societyContext.isBankOwner &&
      societyContext.branchId
    ) {
      const empBranchStr = (
        employee?.branchId?._id ||
        employee?.branchId ||
        logDoc?.branchId ||
        ""
      ).toString();
      const userBranchStr = societyContext.branchId.toString();
      if (empBranchStr && empBranchStr !== userBranchStr) {
        throw ApiError.forbidden(
          "Access denied. You can only manage employees associated with your branch.",
        );
      }
    }

    const recipientEmail =
      customEmail ||
      logDoc?.employeeEmail ||
      employee?.email ||
      employee?.personalDetails?.email;

    if (!recipientEmail) {
      throw ApiError.badRequest(
        "Employee email address is missing. Cannot dispatch email notification.",
      );
    }

    const targetBankId = bankId || logDoc?.bankId || employee?.bankId;
    const bankDoc = targetBankId
      ? await Bank.findById(targetBankId).select("name ubo").lean()
      : null;
    const bankName = bankDoc?.name || "Co-operative Society Bank";
    const recipientName =
      employee?.fullName ||
      employee?.personalDetails?.fullName ||
      logDoc?.employeeName ||
      "Valued Employee";
    const branchName = employee?.branchId?.name || "Main Branch";
    const pdfUrl = logDoc?.fileUrl || options.pdfUrl || "";

    // Build template variables
    const defaultVariables = {
      employeeName: recipientName,
      employeeCode: employee?.employeeCode || "",
      designation:
        employee?.designation ||
        employee?.jobDetails?.designation ||
        "Employee",
      department:
        employee?.department ||
        employee?.jobDetails?.department ||
        "Operations",
      branchName: branchName,
      bankName: bankName,
      pdfUrl: pdfUrl,
      salary: String(
        employee?.jobDetails?.salary || customVariables.salary || "",
      ),
      placeOfPosting:
        employee?.branchId?.city ||
        employee?.jobDetails?.state ||
        "Head Office",
      reportingManager: customVariables.reportingManager || "HR Manager",
      confirmationDate: this.formatDate(
        customVariables.confirmationDate || logDoc?.issuedDate || new Date(),
      ),
      letterSummary:
        logDoc?.detailsSummary ||
        customVariables.letterSummary ||
        "Official HR Letter",
      oldDesignation: customVariables.oldDesignation || "Previous Designation",
      promotedToDesignation:
        customVariables.promotedToDesignation ||
        employee?.designation ||
        "Promoted Role",
      promotionDate: this.formatDate(
        customVariables.promotionDate || new Date(),
      ),
      fromBranch: customVariables.fromBranch || branchName,
      toBranch: customVariables.toBranch || branchName,
      transferDate: this.formatDate(customVariables.transferDate || new Date()),
      fromMonth: customVariables.fromMonth || "Current Month",
      toMonth: customVariables.toMonth || "Current Month",
      incrementPercentage: String(customVariables.incrementPercentage || "0"),
      effectiveMonth: customVariables.effectiveMonth || "Effective Month",
      terminationDate: this.formatDate(
        customVariables.terminationDate || new Date(),
      ),
      noticePeriodDays: String(customVariables.noticePeriodDays || "30"),
      reason: customVariables.reason || "Management Decision",
      ...customVariables,
    };

    // Build Subject Line based on letter type
    const subjects = {
      OFFER_LETTER: `Official Employment Offer Letter - ${bankName}`,
      CONFIRMATION_LETTER: `Letter of Employment Confirmation - ${bankName}`,
      PERFORMANCE_LETTER: `Official Performance Evaluation Letter - ${bankName}`,
      PROMOTION_LETTER: `Congratulations on Your Promotion! - ${bankName}`,
      TRANSFER_LETTER: `Official Transfer Order - ${bankName}`,
      SALARY_SLIP: `Salary Slip - ${bankName}`,
      INCREMENT_LETTER: `Salary Revision & Increment Letter - ${bankName}`,
      SALARY_INCREMENT: `Salary Revision & Increment Letter - ${bankName}`,
      TERMINATION_LETTER: `Official Employment Termination Notice - ${bankName}`,
    };

    const subject =
      subjects[targetDocCode] || `Official Letter Notification - ${bankName}`;

    // Resolve PDF Buffer for Email Attachment
    let pdfBuffer = options.pdfBuffer || null;

    if (!pdfBuffer && pdfUrl) {
      try {
        if (typeof pdfUrl === "string" && (pdfUrl.startsWith("http://") || pdfUrl.startsWith("https://"))) {
          const res = await fetch(pdfUrl);
          if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            pdfBuffer = Buffer.from(arrayBuffer);
          }
        } else if (typeof pdfUrl === "string" && fs.existsSync(pdfUrl)) {
          pdfBuffer = fs.readFileSync(pdfUrl);
        }
      } catch (fetchErr) {
        logger.warn(`Failed to fetch PDF document from URL [${pdfUrl}]: ${fetchErr.message}`);
      }
    }

    // Fallback: If still no PDF buffer, dynamically generate PDF using the respective letter service
    if (!pdfBuffer && targetEmpId && targetDocCode) {
      try {
        const genPayload = { employeeId: targetEmpId, ...(customVariables || {}) };
        let genResult = null;
        switch (targetDocCode) {
          case "OFFER_LETTER": {
            const { offerLetterService } = await import("./offer-letter.service.js");
            genResult = await offerLetterService.generateOfferLetter(targetBankId, genPayload, societyContext);
            break;
          }
          case "CONFIRMATION_LETTER": {
            const { confirmationLetterService } = await import("./confirmation-letter.service.js");
            genResult = await confirmationLetterService.generateConfirmationLetter(targetBankId, genPayload, societyContext);
            break;
          }
          case "PERFORMANCE_LETTER": {
            const { performanceLetterService } = await import("./performance-letter.service.js");
            genResult = await performanceLetterService.generatePerformanceLetter(targetBankId, genPayload, societyContext);
            break;
          }
          case "PROMOTION_LETTER": {
            const { promotionLetterService } = await import("./promotion-letter.service.js");
            genResult = await promotionLetterService.generatePromotionLetter(targetBankId, genPayload, societyContext);
            break;
          }
          case "TRANSFER_LETTER": {
            const { transferLetterService } = await import("./transfer-letter.service.js");
            genResult = await transferLetterService.generateTransferLetter(targetBankId, genPayload, societyContext);
            break;
          }
          case "SALARY_SLIP": {
            const { salarySlipService } = await import("./salary-slip.service.js");
            genResult = await salarySlipService.generateSalarySlip(targetBankId, genPayload, societyContext);
            break;
          }
          case "INCREMENT_LETTER":
          case "SALARY_INCREMENT": {
            const { salaryIncrementLetterService } = await import("./salary-increment-letter.service.js");
            genResult = await salaryIncrementLetterService.generateSalaryIncrement(targetBankId, genPayload, societyContext);
            break;
          }
        }

        if (genResult?.pdfBuffer) {
          pdfBuffer = genResult.pdfBuffer;
        } else if (Buffer.isBuffer(genResult)) {
          pdfBuffer = genResult;
        }
      } catch (genErr) {
        logger.warn(`Failed to auto-generate PDF attachment for letter [${targetDocCode}]: ${genErr.message}`);
      }
    }

    // Build Attachments array
    const attachments = [];
    if (Array.isArray(options.attachments) && options.attachments.length > 0) {
      attachments.push(...options.attachments);
    }

    if (pdfBuffer && Buffer.isBuffer(pdfBuffer)) {
      const sanitizedEmpName = (recipientName || "Employee").replace(/[^a-zA-Z0-9_-]/g, "_");
      const docLabel = (targetDocCode || "LETTER").toLowerCase().replace(/_/g, "-");
      const filename = `${docLabel}_${sanitizedEmpName}.pdf`;

      attachments.push({
        name: filename,
        filename: filename,
        content: pdfBuffer,
        file: pdfBuffer.toString("base64"),
      });
    }

    logger.info(
      `SEND HR LETTER EMAIL: Template [${templateId}] to [${recipientEmail}] for [${targetDocCode}] with [${attachments.length}] attachment(s)`,
    );

    const result = await mailer.sendMail({
      to: recipientEmail,
      name: recipientName,
      subject: subject,
      templateId: templateId,
      variables: defaultVariables,
      attachments: attachments,
    });

    // Check if MSG91 provider returned a failure response
    if (result && result.success === false) {
      const errMsg = result.error || result.details || "Email delivery failed.";
      logger.error(`HR LETTER EMAIL FAILED: MSG91 returned error for [${recipientEmail}]: ${typeof errMsg === "object" ? JSON.stringify(errMsg) : errMsg}`);
      throw ApiError.internal(
        `Email delivery failed via MSG91. Error: ${typeof errMsg === "object" ? JSON.stringify(errMsg) : errMsg}`,
      );
    }

    return {
      success: true,
      message: `Email notification sent successfully to ${recipientEmail} with PDF attachment.`,
      data: {
        recipientEmail,
        templateId,
        documentTypeCode: targetDocCode,
        hasAttachment: attachments.length > 0,
        messageId: result.messageId || "success",
      },
    };
  }
}

export const hrLetterEmailService = new HrLetterEmailService();
