import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import PDFDocument from "pdfkit";
import { SocietyEmployee } from "../../../../models/society-employee.model.js";
import { BranchManager } from "../../../../models/branch-manager.model.js";
import { Bank } from "../../../../models/bank.model.js";
import { Branch } from "../../../../models/branch.model.js";
import { EmployeeLetterLog } from "../../../../models/employee-letter-log.model.js";
import { storageManager } from "../../../../storage/storage.manager.js";
import { logger } from "../../../../utils/logger.util.js";
import { ApiError } from "../../../../common/api.error.js";
import { hrLetterEmailService } from "./hr-letter-email.service.js";
import { societyEmployeeHrService } from "./society-employee-hr.service.js";

const execAsync = promisify(exec);

export class TransferLetterService {
  /**
   * Format Date into Indian format DD/MM/YYYY in Asia/Kolkata timezone
   */
  formatDateIndia(dateInput) {
    if (!dateInput) return "-";
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "-";

    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
  }

  /**
   * Format Branch Address Object into single-line string
   */
  getBranchAddressString(branch) {
    if (!branch) return null;

    if (typeof branch.address === "string" && branch.address.trim()) {
      return branch.address.trim();
    }

    if (branch.address && typeof branch.address === "object") {
      const parts = [
        branch.address.addressLine1,
        branch.address.addressLine2,
        branch.address.city,
        branch.address.district,
        branch.address.state,
        branch.address.pincode ? `- ${branch.address.pincode}` : "",
      ]
        .map((s) => (s || "").trim())
        .filter(Boolean);

      if (parts.length > 0) {
        return parts.join(", ").replace(", -", " -");
      }
    }

    return null;
  }

  /**
   * Derive clean Bank Code / Prefix for Reference Numbers
   */
  generateBankPrefix(bank) {
    if (bank?.code && typeof bank.code === "string") {
      const cleanCode = bank.code
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
      if (cleanCode) return cleanCode;
    }

    if (bank?.name && typeof bank.name === "string") {
      const words = bank.name.trim().toUpperCase().split(/\s+/).filter(Boolean);
      if (words.length === 1) {
        return words[0].substring(0, 6).replace(/[^A-Z0-9]/g, "");
      }
      return words
        .map((w) => w[0])
        .join("")
        .substring(0, 6)
        .replace(/[^A-Z0-9]/g, "");
    }

    return "BANK";
  }

  /**
   * Generate sequential reference number {BANK_PREFIX}/HR/TL/{YEAR}/{XXX}
   */
  async generateReferenceNumber(emp, bank) {
    const bankPrefix = this.generateBankPrefix(bank);
    const currentYear = new Date().getFullYear();
    const prefix = `${bankPrefix}/HR/TL/${currentYear}/`;

    if (
      emp.transferLetter?.referenceNumber &&
      emp.transferLetter.referenceNumber.startsWith(`${bankPrefix}/`)
    ) {
      return emp.transferLetter.referenceNumber;
    }

    const latestEmp = await SocietyEmployee.findOne({
      bankId: bank?._id || emp.bankId,
      "transferLetter.referenceNumber": new RegExp(
        `^${bankPrefix}/HR/TL/${currentYear}/`,
        "i",
      ),
    })
      .sort({ "transferLetter.referenceNumber": -1 })
      .lean();

    let seq = 1;
    if (latestEmp?.transferLetter?.referenceNumber) {
      const match = latestEmp.transferLetter.referenceNumber.match(/\/(\d+)$/);
      if (match) {
        seq = parseInt(match[1], 10) + 1;
      }
    }

    return `${prefix}${String(seq).padStart(3, "0")}`;
  }

  /**
   * Main transfer letter generation entry point
   */
  async generateTransferLetter(bankId, payload, societyContext = null) {
    const employeeId = payload.employeeId || payload.id;
    if (!employeeId) {
      throw ApiError.badRequest(
        "Employee ID is required for generating transfer letter.",
      );
    }

    let emp = await SocietyEmployee.findOne({
      _id: employeeId,
      bankId,
      isDeleted: { $ne: true },
    })
      .populate("branchId")
      .populate("roleId")
      .lean();

    if (!emp && bankId) {
      emp = await SocietyEmployee.findOne({
        _id: employeeId,
        isDeleted: { $ne: true },
      })
        .populate("branchId")
        .populate("roleId")
        .lean();
    }

    if (!emp) {
      emp = await BranchManager.findOne({
        _id: employeeId,
        bankId,
        isDeleted: { $ne: true },
      })
        .populate("branchId")
        .populate("roleId")
        .lean();

      if (!emp && bankId) {
        emp = await BranchManager.findOne({
          _id: employeeId,
          isDeleted: { $ne: true },
        })
          .populate("branchId")
          .populate("roleId")
          .lean();
      }
    }

    if (!emp) {
      throw ApiError.notFound(
        "Society Employee not found or does not belong to this bank.",
      );
    }

    if (
      societyContext &&
      !societyContext.isBankOwner &&
      societyContext.branchId
    ) {
      const empBranchStr = (emp.branchId?._id || emp.branchId || "").toString();
      const userBranchStr = societyContext.branchId.toString();
      if (empBranchStr && empBranchStr !== userBranchStr) {
        throw ApiError.forbidden(
          "Access denied. You can only manage employees associated with your branch.",
        );
      }
    }

    // Resolve Target Branch details
    const targetBranchId =
      payload.transferToBranchId || payload.branchId || payload.targetBranchId;
    let targetBranch = null;
    if (targetBranchId) {
      targetBranch = await Branch.findOne({
        _id: targetBranchId,
        bankId,
        isDeleted: { $ne: true },
      }).lean();
    }

    // Resolve Bank details
    const bank = await Bank.findById(bankId).lean();
    const bankName = bank?.name || "CO-OPERATIVE BANK";

    let logoBuffer = null;
    const logoUrl = payload.bankLogo || bank?.logo || null;
    if (logoUrl) {
      try {
        if (
          typeof logoUrl === "string" &&
          (logoUrl.startsWith("http://") || logoUrl.startsWith("https://"))
        ) {
          const response = await fetch(logoUrl);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            logoBuffer = Buffer.from(arrayBuffer);
          }
        } else if (typeof logoUrl === "string" && fs.existsSync(logoUrl)) {
          logoBuffer = fs.readFileSync(logoUrl);
        }
      } catch (logoErr) {
        logger.warn(
          `Failed to fetch bank logo from ${logoUrl}: ${logoErr.message}`,
        );
      }
    }

    // Resolve Reference Number & Dates
    const referenceNumber = await this.generateReferenceNumber(emp, bank);
    const letterDate = this.formatDateIndia(new Date());

    const effectiveDateInput =
      payload.effectiveDate || payload.transferDate || Date.now();
    const effectiveDate = this.formatDateIndia(effectiveDateInput);

    // Calculate reporting date (default effective date + 7 days if not provided)
    let defaultReportDate = new Date(effectiveDateInput);
    if (!isNaN(defaultReportDate.getTime())) {
      defaultReportDate.setDate(defaultReportDate.getDate() + 7);
    }
    const reportingDate = this.formatDateIndia(
      payload.reportingDate || defaultReportDate,
    );

    // Resolve Employee Info & Locations
    const candidateName = emp.fullName || "Employee Name";
    const employeeCode = emp.employeeCode || String(emp._id);

    const designation =
      payload.designation ||
      emp.designation ||
      emp.roleId?.name ||
      "Branch Executive";
    const currentLocation =
      emp.branchId?.name ||
      (emp.branchId?.address?.city
        ? `${emp.branchId.address.city} Branch`
        : "Current Branch");
    const newLocation =
      targetBranch?.name ||
      (targetBranch?.address?.city
        ? `${targetBranch.address.city} Branch`
        : "Target Branch");

    const newReportingManager =
      payload.newReportingManager ||
      (targetBranch?.managerName
        ? `${targetBranch.managerName}, Branch Manager`
        : "Branch Manager");
    const handoverTo =
      payload.handoverTo ||
      emp.reportingManager ||
      "Relieving Branch Officer / Manager";

    const branchAddress = this.getBranchAddressString(emp.branchId);
    const companyAddress =
      branchAddress ||
      bank?.onboardingAddress ||
      "A-303, Swagat Enclave Housing Society, Jambhulwadi Road, Opp. Gawali Wada, Ambegaon Khurd, Haveli, Pune – 411046";

    // Resolve Signature Image Buffer
    const signatureInput =
      payload.signatureUrl ||
      payload.signatureBase64 ||
      payload.signatureImage ||
      bank?.signatureUrl ||
      null;
    const signatureBuffer = await societyEmployeeHrService.resolveImageBuffer(
      signatureInput,
    );

    if (!signatureBuffer) {
      throw ApiError.badRequest(
        "Official Bank Authorized Signature image is required to generate employee letters. Please upload the bank signature first.",
      );
    }

    const dataMapping = {
      BANK_NAME: bankName,
      BANK_LOGO_URL: logoUrl,
      BANK_LOGO_BUFFER: logoBuffer,
      COMPANY_NAME: bankName,
      COMPANY_ADDRESS: companyAddress,
      CIN: bank?.cin || bank?.code || "[CIN No.]",
      COMPANY_EMAIL: bank?.email || "",
      COMPANY_WEBSITE: bank?.website || "",

      REFERENCE_NUMBER: referenceNumber,
      LETTER_DATE: letterDate,

      EMPLOYEE_NAME: candidateName,
      EMPLOYEE_ID: employeeCode,

      DESIGNATION: designation,
      CURRENT_LOCATION: currentLocation,
      NEW_LOCATION: newLocation,
      NEW_REPORTING_MANAGER: newReportingManager,
      EFFECTIVE_DATE: effectiveDate,

      REPORTING_DATE: reportingDate,
      HANDOVER_TO: handoverTo,

      SIGNATORY_NAME:
        payload.signatoryName || bank?.signatoryName || "Authorized Signatory",
      SIGNATORY_DESIGNATION:
        payload.signatoryDesignation ||
        bank?.signatoryDesignation ||
        "Head - Human Resources",
      SIGNATURE_BUFFER: signatureBuffer,
    };

    // Render PDF buffer
    const pdfBuffer = await this.renderPdfLayout(dataMapping);

    // Upload PDF to Storage (S3 / Local)
    const fileObj = {
      buffer: pdfBuffer,
      originalname: `Transfer_Letter_${referenceNumber.replace(/[\/\\]/g, "_")}.pdf`,
      mimetype: "application/pdf",
    };

    const folderPath = `society/employees/${bankId}/${emp._id}/transfer-letter`;
    const uploadResult = await storageManager.uploadFile(fileObj, folderPath);

    const fileUrl = uploadResult.fileUrl || uploadResult.url;
    const fileKey = uploadResult.key || uploadResult.filePath;

    // Update Employee record in Database
    const updateData = {
      "transferLetter.url": fileUrl,
      "transferLetter.key": fileKey,
      "transferLetter.referenceNumber": referenceNumber,
      "transferLetter.generatedAt": new Date(),
      "transferLetter.effectiveDate": new Date(effectiveDateInput),
      "transferLetter.fromBranch": currentLocation,
      "transferLetter.toBranch": newLocation,
    };

    if (targetBranch?._id) {
      updateData.branchId = targetBranch._id;
    }

    await SocietyEmployee.updateOne(
      { _id: emp._id, bankId },
      { $set: updateData },
    );

    // Create EmployeeLetterLog record
    const letterLog = await EmployeeLetterLog.create({
      bankId,
      branchId: targetBranch?._id || emp.branchId?._id || emp.branchId || null,
      employeeId: emp._id,
      referenceNumber,
      employeeName: candidateName,
      employeeEmail: emp.email || "",
      documentType: "Transfer Letter",
      documentTypeCode: "TRANSFER_LETTER",
      issuedDate: new Date(),
      detailsSummary: `Transferred To: ${newLocation} | Effective: ${effectiveDate}`,
      fileUrl,
      fileKey,
      metadata: { currentLocation, newLocation, effectiveDate },
    }).catch((err) =>
      logger.error(`Failed to create Transfer Letter log: ${err.message}`),
    );

    logger.info(
      `TRANSFER LETTER GENERATED: Reference ${referenceNumber} created for Employee ${emp._id} (${candidateName}). Transferred to ${newLocation}. URL: ${fileUrl}`,
    );

    return {
      success: true,
      message: "Transfer letter generated successfully.",
      data: {
        employeeId: emp._id,
        referenceNumber,
        fileUrl,
        fileKey,
        currentLocation,
        newLocation,
        generatedAt: new Date(),
      },
      pdfBuffer,
    };
  }

  /**
   * Render structured PDF layout using PDFKit
   */
  renderPdfLayout(data) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: "A4",
          margin: 40,
          autoFirstPage: true,
        });
        const buffers = [];

        doc.on("data", (chunk) => buffers.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(buffers)));

        const primaryColor = "#003366"; // Premium Deep Blue
        const darkColor = "#000000"; // Pure Black for body text
        const lightBg = "#EDF2F7";

        const checkPageBreak = (neededHeight = 40) => {
          if (
            doc.y + neededHeight >
            doc.page.height - doc.page.margins.bottom
          ) {
            doc.addPage();
          }
        };

        // Header
        const headerY = 40;
        let titleX = 40;
        let titleWidth = 515;

        if (data.BANK_LOGO_BUFFER) {
          try {
            doc.image(data.BANK_LOGO_BUFFER, 40, headerY, { fit: [100, 50] });
            titleX = 150;
            titleWidth = 405;
          } catch (imgErr) {
            // Fallback if logo buffer format is unsupported
          }
        }

        doc
          .fillColor(primaryColor)
          .fontSize(13)
          .font("Helvetica-Bold")
          .text(data.BANK_NAME || "CO-OPERATIVE BANK", titleX, headerY, {
            width: titleWidth,
            align: titleX === 40 ? "center" : "left",
          });
        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor("#4A5568")
          .text(data.COMPANY_ADDRESS, titleX, doc.y, {
            width: titleWidth,
            align: titleX === 40 ? "center" : "left",
          });
        doc.text(
          `Email: ${data.COMPANY_EMAIL} | Web: ${data.COMPANY_WEBSITE}`,
          titleX,
          doc.y,
          { width: titleWidth, align: titleX === 40 ? "center" : "left" },
        );

        doc.y = Math.max(doc.y, headerY + 45);
        doc.moveDown(0.4);
        doc
          .strokeColor(primaryColor)
          .lineWidth(1.2)
          .moveTo(40, doc.y)
          .lineTo(555, doc.y)
          .stroke();
        doc.moveDown(0.5);
        doc.x = 40;

        // Reference & Date
        doc
          .fillColor(darkColor)
          .fontSize(8.5)
          .font("Helvetica-Bold")
          .text(`Ref. No.: ${data.REFERENCE_NUMBER}`);
        doc.text(`Date: ${data.LETTER_DATE}`);
        doc.moveDown(0.5);

        // Candidate Address & Info
        doc.font("Helvetica-Bold").text("To,");
        doc.font("Helvetica-Bold").text(data.EMPLOYEE_NAME);
        doc.font("Helvetica").text(`Employee ID: ${data.EMPLOYEE_ID}`);
        doc.moveDown(0.8);

        // Title
        doc
          .fillColor(primaryColor)
          .fontSize(12)
          .font("Helvetica-Bold")
          .text("LETTER OF TRANSFER", { align: "center" });
        doc.moveDown(0.6);

        doc
          .fillColor(darkColor)
          .fontSize(8.5)
          .font("Helvetica")
          .text(`Dear ${data.EMPLOYEE_NAME},`);
        doc.moveDown(0.4);
        doc.fontSize(8).text(
          `This is to inform you that, in line with the Company's business and operational requirements, you are being transferred from ${data.CURRENT_LOCATION} to ${data.NEW_LOCATION}, with effect from ${data.EFFECTIVE_DATE}.`,
          40,
          doc.y,
          { align: "justify", width: 515 },
        );
        doc.moveDown(0.8);

        // Helper for Rendering Section Headings
        const renderSectionHeader = (title) => {
          checkPageBreak(40);
          doc.x = 40;
          doc
            .fillColor(primaryColor)
            .fontSize(9.5)
            .font("Helvetica-Bold")
            .text(title, 40, doc.y);
          doc.moveDown(0.3);
        };

        // Section 1: Details of Transfer (Table Grid)
        renderSectionHeader("1. Details of Transfer");

        const transferDetails = [
          [
            "Designation",
            `${data.DESIGNATION} (unchanged, unless stated otherwise)`,
          ],
          ["Current Location", data.CURRENT_LOCATION],
          ["New Location", data.NEW_LOCATION],
          ["New Reporting Manager", data.NEW_REPORTING_MANAGER],
          ["Effective Date", data.EFFECTIVE_DATE],
        ];

        let tableY = doc.y;
        transferDetails.forEach(([label, val]) => {
          doc.rect(40, tableY, 180, 16).fillAndStroke(lightBg, "#CBD5E0");
          doc.rect(220, tableY, 335, 16).stroke("#CBD5E0");
          doc
            .fillColor(darkColor)
            .fontSize(8)
            .font("Helvetica-Bold")
            .text(label, 45, tableY + 4, { width: 170 });
          doc.font("Helvetica").text(val, 225, tableY + 4, { width: 325 });
          tableY += 16;
        });

        doc.x = 40;
        doc.y = tableY + 10;

        // Section 2: Terms of Transfer
        renderSectionHeader("2. Terms of Transfer");
        doc
          .fillColor(darkColor)
          .fontSize(8)
          .font("Helvetica")
          .text(
            `Your compensation, grade and other terms of employment shall remain unchanged pursuant to this transfer, save for any applicable relocation allowance / city compensatory allowance / other change, if any. Any relocation assistance, if applicable, shall be governed by the Company's Relocation Policy.`,
            40,
            doc.y,
            { align: "justify", width: 515 },
          );
        doc.moveDown(0.6);

        // Section 3: Handover
        renderSectionHeader("3. Handover");
        doc
          .fillColor(darkColor)
          .fontSize(8)
          .font("Helvetica")
          .text(
            `You are requested to complete a proper handover of your current responsibilities to ${data.HANDOVER_TO} and report to your new location/department on or before ${data.REPORTING_DATE}. Please ensure a smooth transition of ongoing client, member society and regulatory-facing responsibilities as applicable to your role.`,
            40,
            doc.y,
            { align: "justify", width: 515 },
          );
        doc.moveDown(0.6);

        // Section 4: Continuity of Terms
        renderSectionHeader("4. Continuity of Terms");
        doc
          .fillColor(darkColor)
          .fontSize(8)
          .font("Helvetica")
          .text(
            `Except as expressly modified by this letter, all other terms and conditions of your employment as set out in your Offer/Appointment Letter and subsequent communications shall continue to remain in full force and effect.`,
            40,
            doc.y,
            { align: "justify", width: 515 },
          );
        doc.moveDown(0.6);

        // Section 5: Governing Law & Jurisdiction
        renderSectionHeader("5. Governing Law & Jurisdiction");
        doc
          .fillColor(darkColor)
          .fontSize(8)
          .font("Helvetica")
          .text(
            `This letter, and the terms of employment/engagement recorded herein, shall be governed by and construed in accordance with the laws of India, including without limitation the Companies Act, 2013; the Indian Contract Act, 1872; the applicable Shops and Establishments Act of the State of Maharashtra; the Payment of Wages Act, 1936; the Minimum Wages Act, 1948; the Industrial Employment (Standing Orders) Act, 1946; the Employees' Provident Funds and Miscellaneous Provisions Act, 1952; the Employees' State Insurance Act, 1948 (where applicable); the Payment of Bonus Act, 1965; the Payment of Gratuity Act, 1972; the Maternity Benefit Act, 1961; and the Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013. As the Company provides technology, distribution and support services to Cooperative Credit Societies registered under the Multi-State Cooperative Societies Act, 2002 (or the respective State Cooperative Societies Act), and to Banks, NBFCs and other regulated lending institutions, employees engaged in credit, collections, operations, technology and compliance functions shall additionally observe the Reserve Bank of India's Fair Practices Code, Master Directions on Digital Lending and IT Outsourcing, applicable KYC/AML/PMLA guidelines, the Information Technology Act, 2000 (as applicable to the Company's SaaS/IT service offerings) and the Digital Personal Data Protection Act, 2023, in each case to the extent relevant to their role. Any dispute, difference or claim arising out of or in connection with this letter or its subject matter shall be subject to the exclusive jurisdiction of the competent courts at Pune, Maharashtra.`,
            40,
            doc.y,
            { align: "justify", width: 515 },
          );
        doc.moveDown(0.6);

        // Closing Paragraph
        checkPageBreak(40);
        doc
          .fillColor(darkColor)
          .fontSize(8)
          .font("Helvetica")
          .text(
            `We trust that you will extend your full cooperation in this transition. Please sign and return the duplicate copy of this letter as acknowledgement.`,
            40,
            doc.y,
            { align: "justify", width: 515 },
          );
        doc.moveDown(1);

        // Signatures Block
        checkPageBreak(100);
        const sigY = doc.y;

        // Left Signatory (Company)
        doc
          .fillColor(darkColor)
          .fontSize(8.5)
          .font("Helvetica-Bold")
          .text(`For ${data.BANK_NAME || "CO-OPERATIVE BANK"}`, 40, sigY);

        let sigLineOffset = 30;
        if (data.SIGNATURE_BUFFER) {
          try {
            doc.image(data.SIGNATURE_BUFFER, 40, sigY + 12, { fit: [130, 32] });
            sigLineOffset = 46;
          } catch (sigErr) {
            logger.warn(`Failed to render signature image in transfer letter PDF: ${sigErr.message}`);
          }
        }

        doc.text("_______________________________", 40, sigY + sigLineOffset);
        doc.text("Authorised Signatory", 40, sigY + sigLineOffset + 12);
        doc
          .font("Helvetica")
          .text(`Name: ${data.SIGNATORY_NAME}`, 40, sigY + sigLineOffset + 24);
        doc.text(`Designation: ${data.SIGNATORY_DESIGNATION}`, 40, sigY + sigLineOffset + 36);

        // Right Signatory (Candidate)
        doc.font("Helvetica-Bold").fontSize(8.5).text("Acknowledged by Employee", 300, sigY);
        doc.text("Signature: _______________________", 300, sigY + 30);
        doc.text("Date: _______________", 300, sigY + 54);

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

export const transferLetterService = new TransferLetterService();
