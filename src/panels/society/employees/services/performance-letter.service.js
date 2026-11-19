import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import PDFDocument from "pdfkit";
import { SocietyEmployee } from "../../../../models/society-employee.model.js";
import { BranchManager } from "../../../../models/branch-manager.model.js";
import { Bank } from "../../../../models/bank.model.js";
import { EmployeeLetterLog } from "../../../../models/employee-letter-log.model.js";
import { storageManager } from "../../../../storage/storage.manager.js";
import { logger } from "../../../../utils/logger.util.js";
import { ApiError } from "../../../../common/api.error.js";
import { hrLetterEmailService } from "./hr-letter-email.service.js";
import { societyEmployeeHrService } from "./society-employee-hr.service.js";

const execAsync = promisify(exec);

export class PerformanceLetterService {
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
   * Generate sequential reference number {BANK_PREFIX}/HR/PA/{YEAR}/{XXX}
   */
  async generateReferenceNumber(emp, bank) {
    const bankPrefix = this.generateBankPrefix(bank);
    const currentYear = new Date().getFullYear();
    const prefix = `${bankPrefix}/HR/PA/${currentYear}/`;

    if (
      emp.performanceLetter?.referenceNumber &&
      emp.performanceLetter.referenceNumber.startsWith(`${bankPrefix}/`)
    ) {
      return emp.performanceLetter.referenceNumber;
    }

    const latestEmp = await SocietyEmployee.findOne({
      bankId: bank?._id || emp.bankId,
      "performanceLetter.referenceNumber": new RegExp(
        `^${bankPrefix}/HR/PA/${currentYear}/`,
        "i",
      ),
    })
      .sort({ "performanceLetter.referenceNumber": -1 })
      .lean();

    let seq = 1;
    if (latestEmp?.performanceLetter?.referenceNumber) {
      const match =
        latestEmp.performanceLetter.referenceNumber.match(/\/(\d+)$/);
      if (match) {
        seq = parseInt(match[1], 10) + 1;
      }
    }

    return `${prefix}${String(seq).padStart(3, "0")}`;
  }

  /**
   * Main performance appraisal letter generation entry point
   */
  async generatePerformanceLetter(bankId, payload, societyContext = null) {
    const employeeId = payload.employeeId;
    if (!employeeId) {
      throw ApiError.badRequest(
        "Employee ID is required for generating performance appraisal letter.",
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

    const currentYear = new Date().getFullYear();
    const reviewPeriod =
      payload.reviewPeriod ||
      `FY ${currentYear - 1}–${String(currentYear).slice(2)}`;

    // Resolve Employee Info
    const candidateName = emp.fullName || "Employee Name";
    const employeeCode = emp.employeeCode || String(emp._id);
    const designation =
      payload.designation ||
      emp.designation ||
      emp.roleId?.name ||
      "Branch Executive";
    const department =
      payload.department ||
      emp.department ||
      emp.jobDetails?.department ||
      "Operations";

    const branchAddress = this.getBranchAddressString(emp.branchId);
    const companyAddress =
      branchAddress ||
      bank?.onboardingAddress ||
      "A-303, Swagat Enclave Housing Society, Jambhulwadi Road, Opp. Gawali Wada, Ambegaon Khurd, Haveli, Pune – 411046";

    // Key Result Areas (KRAs)
    const kras =
      payload.kras && Array.isArray(payload.kras) && payload.kras.length > 0
        ? payload.kras
        : [
            {
              kra: "Business / Portfolio Growth",
              target: "Achieve 100% target",
              achievement: "105% achieved",
              rating: "4.5",
            },
            {
              kra: "Collections / NPA Management",
              target: "NPA < 2.0%",
              achievement: "NPA at 1.4%",
              rating: "4.5",
            },
            {
              kra: "Compliance & Process Adherence",
              target: "Zero audit observations",
              achievement: "100% compliant",
              rating: "4.0",
            },
            {
              kra: "Team / Stakeholder Management",
              target: "Effective team coordination",
              achievement: "Excellent feedback",
              rating: "4.0",
            },
          ];

    const overallRating = payload.overallRating || "4.25 / 5.0";
    const ratingLabel =
      payload.ratingLabel || payload.overallRating || "Exceeds Expectations";

    const managerComments =
      payload.managerComments ||
      payload.letterText ||
      "Demonstrated outstanding dedication, strong business execution, and excellent leadership in achieving operational and collection targets during the review period. Key strengths include proactive risk management and strong client engagement.";

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
      DEPARTMENT: department,

      REVIEW_PERIOD: reviewPeriod,
      KRAS: kras,
      OVERALL_RATING: overallRating,
      RATING_LABEL: ratingLabel,
      MANAGER_COMMENTS: managerComments,

      SIGNATORY_NAME:
        payload.signatoryName || bank?.signatoryName || "Authorized Signatory",
      SIGNATORY_DESIGNATION:
        payload.signatoryDesignation ||
        bank?.signatoryDesignation ||
        "Reporting Manager / HR Head",
      SIGNATURE_BUFFER: signatureBuffer,
    };

    // Render PDF buffer
    const pdfBuffer = await this.renderPdfLayout(dataMapping);

    // Upload PDF to Storage (S3 / Local)
    const fileObj = {
      buffer: pdfBuffer,
      originalname: `Performance_Letter_${referenceNumber.replace(/[\/\\]/g, "_")}.pdf`,
      mimetype: "application/pdf",
    };

    const folderPath = `society/employees/${bankId}/${emp._id}/performance-letter`;
    const uploadResult = await storageManager.uploadFile(fileObj, folderPath);

    const fileUrl = uploadResult.fileUrl || uploadResult.url;
    const fileKey = uploadResult.key || uploadResult.filePath;

    // Update Employee record in Database
    await SocietyEmployee.updateOne(
      { _id: emp._id, bankId },
      {
        $set: {
          "performanceLetter.url": fileUrl,
          "performanceLetter.key": fileKey,
          "performanceLetter.referenceNumber": referenceNumber,
          "performanceLetter.generatedAt": new Date(),
          "performanceLetter.reviewPeriod": reviewPeriod,
          "performanceLetter.overallRating": overallRating,
        },
      },
    );

    // Create EmployeeLetterLog record
    const letterLog = await EmployeeLetterLog.create({
      bankId,
      branchId: emp.branchId?._id || emp.branchId || null,
      employeeId: emp._id,
      referenceNumber,
      employeeName: candidateName,
      employeeEmail: emp.email || "",
      documentType: "Performance Letter",
      documentTypeCode: "PERFORMANCE_LETTER",
      issuedDate: new Date(),
      detailsSummary: `Review: ${reviewPeriod} | Rating: ${overallRating}`,
      fileUrl,
      fileKey,
      metadata: { reviewPeriod, overallRating, designation },
    }).catch((err) =>
      logger.error(`Failed to create Performance Letter log: ${err.message}`),
    );

    logger.info(
      `PERFORMANCE APPRAISAL LETTER GENERATED: Reference ${referenceNumber} created for Employee ${emp._id} (${candidateName}). URL: ${fileUrl}`,
    );

    return {
      success: true,
      message: "Performance appraisal letter generated successfully.",
      data: {
        employeeId: emp._id,
        referenceNumber,
        fileUrl,
        fileKey,
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
        doc.text(`${data.DESIGNATION} – ${data.DEPARTMENT}`);
        doc.moveDown(0.8);

        // Title
        doc
          .fillColor(primaryColor)
          .fontSize(12)
          .font("Helvetica-Bold")
          .text("PERFORMANCE APPRAISAL LETTER", { align: "center" });
        doc.moveDown(0.6);

        doc
          .fillColor(darkColor)
          .fontSize(8.5)
          .font("Helvetica")
          .text(`Dear ${data.EMPLOYEE_NAME},`);
        doc.moveDown(0.4);
        doc.fontSize(8).text(
          `This letter is to communicate the outcome of your Performance Appraisal for the review period ${data.REVIEW_PERIOD}, carried out in accordance with the Company's Performance Management Policy.`,
          40,
          doc.y,
          { align: "justify", width: 515 },
        );
        doc.moveDown(0.8);

        // Section 1: Performance Summary Table
        checkPageBreak(150);
        doc.x = 40;
        doc
          .fillColor(primaryColor)
          .fontSize(9.5)
          .font("Helvetica-Bold")
          .text("Performance Summary", 40, doc.y);
        doc.moveDown(0.3);

        let tableY = doc.y;

        // Table Header
        doc.rect(40, tableY, 170, 16).fillAndStroke(primaryColor, primaryColor);
        doc
          .rect(210, tableY, 110, 16)
          .fillAndStroke(primaryColor, primaryColor);
        doc
          .rect(320, tableY, 130, 16)
          .fillAndStroke(primaryColor, primaryColor);
        doc
          .rect(450, tableY, 105, 16)
          .fillAndStroke(primaryColor, primaryColor);

        doc.fillColor("#FFFFFF").fontSize(8).font("Helvetica-Bold");
        doc.text("Key Result Area (KRA)", 45, tableY + 4, { width: 160 });
        doc.text("Target", 215, tableY + 4, { width: 100 });
        doc.text("Achievement", 325, tableY + 4, { width: 120 });
        doc.text("Rating (1–5)", 455, tableY + 4, { width: 95 });

        tableY += 16;

        // Table Rows
        data.KRAS.forEach((item, idx) => {
          const bg = idx % 2 === 0 ? "#FFFFFF" : "#F7FAFC";
          doc.rect(40, tableY, 170, 16).fillAndStroke(bg, "#CBD5E0");
          doc.rect(210, tableY, 110, 16).fillAndStroke(bg, "#CBD5E0");
          doc.rect(320, tableY, 130, 16).fillAndStroke(bg, "#CBD5E0");
          doc.rect(450, tableY, 105, 16).fillAndStroke(bg, "#CBD5E0");

          doc.fillColor(darkColor).fontSize(8).font("Helvetica");
          doc.text(item.kra || "-", 45, tableY + 4, { width: 160 });
          doc.text(item.target || "-", 215, tableY + 4, { width: 100 });
          doc.text(item.achievement || "-", 325, tableY + 4, { width: 120 });
          doc
            .font("Helvetica-Bold")
            .text(item.rating || "-", 455, tableY + 4, { width: 95 });

          tableY += 16;
        });

        // Summary Row: Overall Rating
        doc.rect(40, tableY, 410, 18).fillAndStroke(lightBg, "#CBD5E0");
        doc.rect(450, tableY, 105, 18).fillAndStroke(lightBg, "#CBD5E0");
        doc.fillColor(primaryColor).fontSize(8.5).font("Helvetica-Bold");
        doc.text("Overall Rating", 45, tableY + 4, { width: 400 });
        doc.text(data.OVERALL_RATING, 455, tableY + 4, { width: 95 });

        doc.x = 40;
        doc.y = tableY + 26;

        // Section 2: Manager's Comments
        checkPageBreak(60);
        doc.x = 40;
        doc
          .fillColor(primaryColor)
          .fontSize(9.5)
          .font("Helvetica-Bold")
          .text("Manager's Comments", 40, doc.y);
        doc.moveDown(0.3);
        doc
          .fillColor(darkColor)
          .fontSize(8)
          .font("Helvetica")
          .text(data.MANAGER_COMMENTS, 40, doc.y, {
            align: "justify",
            width: 515,
          });
        doc.moveDown(0.6);

        // Section 3: Outcome
        checkPageBreak(60);
        doc.x = 40;
        doc
          .fillColor(primaryColor)
          .fontSize(9.5)
          .font("Helvetica-Bold")
          .text("Outcome", 40, doc.y);
        doc.moveDown(0.3);

        const outcomeBullets = [
          `Overall Performance Rating: ${data.RATING_LABEL}`,
          `Any resultant change in compensation, designation or role shall be communicated separately, where applicable, through a Salary Increment Letter and/or Promotion Letter.`,
          `Your Individual Development Plan / Goals for the forthcoming review period are enclosed as Annexure A.`,
        ];

        outcomeBullets.forEach((bullet) => {
          doc
            .fillColor(darkColor)
            .fontSize(8)
            .font("Helvetica")
            .text(`• ${bullet}`, 40, doc.y, { align: "justify", width: 515 });
          doc.moveDown(0.3);
        });

        doc.moveDown(0.5);

        // Section 4: Governing Law & Jurisdiction
        checkPageBreak(100);
        doc.x = 40;
        doc
          .fillColor(primaryColor)
          .fontSize(9.5)
          .font("Helvetica-Bold")
          .text("Governing Law & Jurisdiction", 40, doc.y);
        doc.moveDown(0.3);
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
            `We appreciate your contribution to the Company and look forward to your continued performance in line with the Company's growth objectives, including its engagements with partner Cooperative Credit Societies, Banks and NBFCs.`,
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
            logger.warn(`Failed to render signature image in performance letter PDF: ${sigErr.message}`);
          }
        }

        doc.text("_______________________________", 40, sigY + sigLineOffset);
        doc.text("Reporting Manager / HR Authorised Signatory", 40, sigY + sigLineOffset + 12);
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

export const performanceLetterService = new PerformanceLetterService();
