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

export class SalaryIncrementLetterService {
  /**
   * Format currency into Indian locale format e.g. Rs. 6,60,000
   */
  formatCurrency(amount) {
    if (amount === null || amount === undefined || isNaN(Number(amount)))
      return "Rs. 0";
    const num = Math.round(Number(amount));
    return "Rs. " + num.toLocaleString("en-IN");
  }

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
   * Generate sequential reference number {BANK_PREFIX}/HR/SI/{YEAR}/{XXX}
   */
  async generateReferenceNumber(emp, bank) {
    const bankPrefix = this.generateBankPrefix(bank);
    const currentYear = new Date().getFullYear();
    const prefix = `${bankPrefix}/HR/SI/${currentYear}/`;

    if (
      emp.salaryIncrementLetter?.referenceNumber &&
      emp.salaryIncrementLetter.referenceNumber.startsWith(`${bankPrefix}/`)
    ) {
      return emp.salaryIncrementLetter.referenceNumber;
    }

    const latestEmp = await SocietyEmployee.findOne({
      bankId: bank?._id || emp.bankId,
      "salaryIncrementLetter.referenceNumber": new RegExp(
        `^${bankPrefix}/HR/SI/${currentYear}/`,
        "i",
      ),
    })
      .sort({ "salaryIncrementLetter.referenceNumber": -1 })
      .lean();

    let seq = 1;
    if (latestEmp?.salaryIncrementLetter?.referenceNumber) {
      const match =
        latestEmp.salaryIncrementLetter.referenceNumber.match(/\/(\d+)$/);
      if (match) {
        seq = parseInt(match[1], 10) + 1;
      }
    }

    return `${prefix}${String(seq).padStart(3, "0")}`;
  }

  /**
   * Main salary increment letter generation entry point
   */
  async generateSalaryIncrement(bankId, payload, societyContext = null) {
    const employeeId = payload.employeeId || payload.id;
    if (!employeeId) {
      throw ApiError.badRequest(
        "Employee ID is required for generating salary increment letter.",
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

    const effectiveDateInput =
      payload.effectiveDate || payload.fromMonth || Date.now();
    const effectiveDate = this.formatDateIndia(effectiveDateInput);

    // Resolve Employee Info & Department
    const candidateName = emp.fullName || "Employee Name";
    const employeeCode = emp.employeeCode || String(emp._id);
    const designation =
      payload.designation ||
      emp.designation ||
      emp.roleId?.name ||
      "Branch Officer";
    const department =
      payload.department ||
      emp.department ||
      emp.jobDetails?.department ||
      "Operations & Credit";
    const reviewPeriod = payload.reviewPeriod || "FY 2025–26";

    // Financial Computations for Current vs Revised CTC
    let currentCtcInput = Number(
      payload.currentCtc ||
        payload.oldSalary ||
        emp.jobDetails?.salary ||
        600000,
    );
    if (currentCtcInput > 0 && currentCtcInput < 100000) {
      currentCtcInput = currentCtcInput * 12; // convert monthly to annual if less than 100k
    }

    let revisedCtcInput = Number(
      payload.revisedCtc || payload.newSalary || payload.revisedAnnualCtc || 0,
    );
    if (revisedCtcInput === 0) {
      const incPercent = Number(
        payload.incrementPercentage || payload.incrementPercent || 10,
      );
      revisedCtcInput = Math.round(currentCtcInput * (1 + incPercent / 100));
    }

    const calculatedIncrementPercent = Number(
      payload.incrementPercentage ||
        payload.incrementPercent ||
        Math.round(
          ((revisedCtcInput - currentCtcInput) / currentCtcInput) * 100,
        ),
    );

    // Calculate Breakup for Table Grid
    const calculateBreakup = (annualCtc) => {
      const basic = Math.round(annualCtc * 0.5);
      const hra = Math.round(annualCtc * 0.2);
      const employerPf = Math.round(basic * 0.12);
      const special = Math.round(annualCtc * 0.18);
      const variablePay = annualCtc - basic - hra - employerPf - special;

      return {
        basic,
        hra,
        special: special > 0 ? special : 0,
        employerPf,
        variablePay: variablePay > 0 ? variablePay : 0,
        total: annualCtc,
      };
    };

    const currentBreakup = calculateBreakup(currentCtcInput);
    const revisedBreakup = calculateBreakup(revisedCtcInput);

    const branchAddress = this.getBranchAddressString(emp.branchId);
    const companyAddress =
      branchAddress ||
      bank?.onboardingAddress ||
      "A-303, Swagat Enclave Housing Society, Jambhulwadi Road, Opp. Gawali Wada, Ambegaon Khurd, Haveli, Pune – 411046";

    const signatureBuffer = await societyEmployeeHrService.resolveImageBuffer(
      payload.signatureUrl ||
        payload.signatureBase64 ||
        payload.signatureImage ||
        bank?.signatureUrl ||
        null,
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
      EFFECTIVE_DATE: effectiveDate,

      INCREMENT_PERCENTAGE: calculatedIncrementPercent,
      REVISED_ANNUAL_CTC: this.formatCurrency(revisedCtcInput),

      CURRENT_BREAKUP: currentBreakup,
      REVISED_BREAKUP: revisedBreakup,

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
      originalname: `Salary_Increment_Letter_${referenceNumber.replace(/[\/\\]/g, "_")}.pdf`,
      mimetype: "application/pdf",
    };

    const folderPath = `society/employees/${bankId}/${emp._id}/salary-increment`;
    const uploadResult = await storageManager.uploadFile(fileObj, folderPath);

    const fileUrl = uploadResult.fileUrl || uploadResult.url;
    const fileKey = uploadResult.key || uploadResult.filePath;

    // Update Employee record in Database
    await SocietyEmployee.updateOne(
      { _id: emp._id, bankId },
      {
        $set: {
          "salaryIncrementLetter.url": fileUrl,
          "salaryIncrementLetter.key": fileKey,
          "salaryIncrementLetter.referenceNumber": referenceNumber,
          "salaryIncrementLetter.generatedAt": new Date(),
          "salaryIncrementLetter.effectiveDate": new Date(effectiveDateInput),
          "salaryIncrementLetter.previousCtc": currentCtcInput,
          "salaryIncrementLetter.revisedCtc": revisedCtcInput,
          "salaryIncrementLetter.incrementPercentage":
            calculatedIncrementPercent,
          "jobDetails.salary": revisedCtcInput,
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
      documentType: "Salary Increment",
      documentTypeCode: "SALARY_INCREMENT",
      issuedDate: new Date(),
      detailsSummary: `Increment: ${calculatedIncrementPercent}% | Revised CTC: ${this.formatCurrency(revisedCtcInput)}`,
      fileUrl,
      fileKey,
      metadata: {
        previousCtc: currentCtcInput,
        revisedCtc: revisedCtcInput,
        incrementPercentage: calculatedIncrementPercent,
      },
    }).catch((err) =>
      logger.error(`Failed to create Salary Increment log: ${err.message}`),
    );

    logger.info(
      `SALARY INCREMENT LETTER GENERATED: Reference ${referenceNumber} created for Employee ${emp._id} (${candidateName}). Revised CTC: ${revisedCtcInput} (+${calculatedIncrementPercent}%). URL: ${fileUrl}`,
    );

    return {
      success: true,
      message: "Salary increment letter generated successfully.",
      data: {
        employeeId: emp._id,
        referenceNumber,
        fileUrl,
        fileKey,
        previousCtc: currentCtcInput,
        revisedCtc: revisedCtcInput,
        incrementPercentage: calculatedIncrementPercent,
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
          .text("SALARY INCREMENT LETTER", { align: "center" });
        doc.moveDown(0.6);

        doc
          .fillColor(darkColor)
          .fontSize(8.5)
          .font("Helvetica")
          .text(`Dear ${data.EMPLOYEE_NAME},`);
        doc.moveDown(0.4);
        doc.fontSize(8).text(
          `We are pleased to inform you that, in recognition of your performance and contribution during the period ${data.REVIEW_PERIOD}, the Management has approved a revision in your compensation. Your revised Cost to Company (CTC) will be ${data.REVISED_ANNUAL_CTC} per annum, an increase of ${data.INCREMENT_PERCENTAGE}% over your current CTC, effective from ${data.EFFECTIVE_DATE}.`,
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

        // Revised Compensation Structure Table
        renderSectionHeader("Revised Compensation Structure");

        let tableY = doc.y;

        // Table Header
        doc.rect(40, tableY, 235, 16).fillAndStroke(primaryColor, primaryColor);
        doc
          .rect(275, tableY, 140, 16)
          .fillAndStroke(primaryColor, primaryColor);
        doc
          .rect(415, tableY, 140, 16)
          .fillAndStroke(primaryColor, primaryColor);

        doc.fillColor("#FFFFFF").fontSize(8).font("Helvetica-Bold");
        doc.text("Component (Annual)", 45, tableY + 4, { width: 225 });
        doc.text("Current CTC (Rs.)", 280, tableY + 4, { width: 130 });
        doc.text("Revised CTC (Rs.)", 420, tableY + 4, { width: 130 });

        tableY += 16;

        const tableRows = [
          [
            "Basic Salary",
            this.formatCurrency(data.CURRENT_BREAKUP.basic),
            this.formatCurrency(data.REVISED_BREAKUP.basic),
          ],
          [
            "House Rent Allowance (HRA)",
            this.formatCurrency(data.CURRENT_BREAKUP.hra),
            this.formatCurrency(data.REVISED_BREAKUP.hra),
          ],
          [
            "Special / Other Allowances",
            this.formatCurrency(data.CURRENT_BREAKUP.special),
            this.formatCurrency(data.REVISED_BREAKUP.special),
          ],
          [
            "Employer's PF Contribution",
            this.formatCurrency(data.CURRENT_BREAKUP.employerPf),
            this.formatCurrency(data.REVISED_BREAKUP.employerPf),
          ],
          [
            "Performance Incentive / Variable Pay",
            this.formatCurrency(data.CURRENT_BREAKUP.variablePay),
            this.formatCurrency(data.REVISED_BREAKUP.variablePay),
          ],
        ];

        tableRows.forEach(([component, curVal, revVal], idx) => {
          const bg = idx % 2 === 0 ? "#FFFFFF" : "#F7FAFC";
          doc.rect(40, tableY, 235, 16).fillAndStroke(bg, "#CBD5E0");
          doc.rect(275, tableY, 140, 16).fillAndStroke(bg, "#CBD5E0");
          doc.rect(415, tableY, 140, 16).fillAndStroke(bg, "#CBD5E0");

          doc.fillColor(darkColor).fontSize(8).font("Helvetica");
          doc.text(component, 45, tableY + 4, { width: 225 });
          doc.text(curVal, 280, tableY + 4, { width: 130 });
          doc.text(revVal, 420, tableY + 4, { width: 130 });

          tableY += 16;
        });

        // Total Row
        doc.rect(40, tableY, 235, 16).fillAndStroke(lightBg, "#CBD5E0");
        doc.rect(275, tableY, 140, 16).fillAndStroke(lightBg, "#CBD5E0");
        doc.rect(415, tableY, 140, 16).fillAndStroke(lightBg, "#CBD5E0");

        doc.fillColor(primaryColor).fontSize(8).font("Helvetica-Bold");
        doc.text("Total Annual CTC", 45, tableY + 4, { width: 225 });
        doc.text(
          this.formatCurrency(data.CURRENT_BREAKUP.total),
          280,
          tableY + 4,
          { width: 130 },
        );
        doc.text(
          this.formatCurrency(data.REVISED_BREAKUP.total),
          420,
          tableY + 4,
          { width: 130 },
        );

        tableY += 16;
        doc.x = 40;
        doc.y = tableY + 10;

        // Terms
        renderSectionHeader("Terms");
        doc.fillColor(darkColor).fontSize(8).font("Helvetica");
        doc.text(
          "1. The revised compensation is subject to applicable statutory deductions, including Income Tax (TDS), Provident Fund and Professional Tax, as applicable.",
          40,
          doc.y,
          { align: "justify", width: 515 },
        );
        doc.moveDown(0.2);
        doc.text(
          "2. All other terms and conditions of your employment remain unchanged, save as expressly modified herein.",
          40,
          doc.y,
          { align: "justify", width: 515 },
        );
        doc.moveDown(0.2);
        doc.text(
          "3. A detailed revised salary breakup will also reflect in your subsequent monthly salary slip.",
          40,
          doc.y,
          { align: "justify", width: 515 },
        );
        doc.moveDown(0.6);

        // Governing Law & Jurisdiction
        renderSectionHeader("Governing Law & Jurisdiction");
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
            `We appreciate your continued commitment and look forward to your ongoing contribution to the Company's growth, including its partnerships with Cooperative Credit Societies, Banks and NBFCs.`,
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
            logger.warn(`Failed to render signature image in salary increment letter PDF: ${sigErr.message}`);
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

export const salaryIncrementLetterService = new SalaryIncrementLetterService();
