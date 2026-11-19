import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
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

export class OfferLetterService {
  /**
   * Format currency into Indian locale format e.g. ₹6,00,000
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
   * Extract normalized employee address object
   */
  getEmployeeAddress(emp) {
    const rawAddr =
      emp.personalDetails?.address ||
      emp.officeAddress ||
      emp.address ||
      "";
    const pin = emp.personalDetails?.pinCode || emp.currentPinCode || "";

    const parts = rawAddr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const line1 = parts[0] || rawAddr || "Candidate Address Line 1";
    const line2 = parts.slice(1, -2).join(", ") || parts[1] || "";
    const city = parts[parts.length - 2] || "Pune";
    const state = parts[parts.length - 1] || "Maharashtra";

    return {
      line1,
      line2,
      city,
      state,
      pin: pin || "411001",
      fullAddressString: `${line1}${line2 ? ", " + line2 : ""}, ${city}, ${state}${pin ? " - " + pin : ""}`,
    };
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
   * Generate sequential reference number {BANK_PREFIX}/HR/OL/{YEAR}/{XXX}
   */
  async generateReferenceNumber(emp, bank) {
    const bankPrefix = this.generateBankPrefix(bank);
    const currentYear = new Date().getFullYear();
    const prefix = `${bankPrefix}/HR/OL/${currentYear}/`;

    if (
      emp.offerLetter?.referenceNumber &&
      emp.offerLetter.referenceNumber.startsWith(`${bankPrefix}/`)
    ) {
      return emp.offerLetter.referenceNumber;
    }

    const latestEmp = await SocietyEmployee.findOne({
      bankId: bank?._id || emp.bankId,
      "offerLetter.referenceNumber": new RegExp(
        `^${bankPrefix}/HR/OL/${currentYear}/`,
        "i",
      ),
    })
      .sort({ "offerLetter.referenceNumber": -1 })
      .lean();

    let seq = 1;
    if (latestEmp?.offerLetter?.referenceNumber) {
      const match = latestEmp.offerLetter.referenceNumber.match(/\/(\d+)$/);
      if (match) {
        seq = parseInt(match[1], 10) + 1;
      }
    }

    return `${prefix}${String(seq).padStart(3, "0")}`;
  }

  /**
   * Calculate dynamic compensation breakdown from Monthly Salary
   *
   * Note: The salary stored in the database (emp.jobDetails.salary) is on a monthly basis.
   * This method directly converts the monthly salary to annual CTC (Monthly Salary * 12)
   * and computes statutory compensation components:
   * - Basic Salary: 50% of annual CTC
   * - HRA (House Rent Allowance): 40% of Basic Salary
   * - Employer PF Contribution: 12% of Basic Salary (capped at ₹21,600/year)
   * - Gratuity: 4.81% of Basic Salary (as per Payment of Gratuity Act, 1972)
   * - Special Allowances: Remaining balancing amount (CTC - Basic - HRA - PF - Gratuity)
   */
  calculateCompensationBreakdown(monthlySalaryInput) {
    // 1. Sanitize monthly salary input (default to ₹50,000/month if invalid or zero)
    const monthlySalary = Math.max(0, Number(monthlySalaryInput) || 50000);

    // 2. Convert monthly salary directly to annual CTC by multiplying by 12 months
    const ctc = Math.round(monthlySalary * 12);

    // 3. Compute component breakdown based on annual CTC
    const basic = Math.round(ctc * 0.5); // Basic Salary = 50% of Total CTC
    const hra = Math.round(basic * 0.4); // HRA = 40% of Basic Salary
    const pf = Math.min(Math.round(basic * 0.12), 21600); // Employer PF = 12% of Basic (capped at ₹21,600/year)
    const gratuity = Math.round(basic * 0.0481); // Gratuity = 4.81% of Basic Salary
    const variablePay = 0; // Performance Incentive / Variable Pay (default ₹0)

    // 4. Special Allowances = Balancing component to match exact Total CTC
    const specialAllowances = Math.max(
      0,
      ctc - (basic + hra + pf + gratuity + variablePay),
    );

    // 5. Return structured compensation object with both numeric values and formatted INR strings
    return {
      totalCtc: ctc,
      monthlySalary,
      basic,
      hra,
      specialAllowances,
      pf,
      variablePay,
      gratuity,
      formattedTotalCtc: this.formatCurrency(ctc),
      formattedMonthlySalary: this.formatCurrency(monthlySalary),
      formattedBasic: this.formatCurrency(basic),
      formattedHra: this.formatCurrency(hra),
      formattedSpecialAllowances: this.formatCurrency(specialAllowances),
      formattedPf: this.formatCurrency(pf),
      formattedVariablePay: this.formatCurrency(variablePay),
      formattedGratuity: this.formatCurrency(gratuity),
    };
  }

  /**
   * Main offer letter generation entry point
   */
  async generateOfferLetter(bankId, payload, societyContext = null) {
    const employeeId = payload.employeeId;
    if (!employeeId) {
      throw ApiError.badRequest(
        "Employee ID is required for generating offer letter.",
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

    // Resolve Reference Number & Dates
    const referenceNumber = await this.generateReferenceNumber(emp, bank);
    const offerDate = this.formatDateIndia(new Date());
    const joiningDate = this.formatDateIndia(
      emp.jobDetails?.joiningDate || Date.now(),
    );

    // Resolve Employee Info
    const candidateName = emp.fullName || emp.personalDetails?.fullName || "Candidate Name";
    const addressInfo = this.getEmployeeAddress(emp);
    
    let rawDesignation =
      payload.designation ||
      emp.designation ||
      emp.jobDetails?.designation ||
      emp.roleId?.name ||
      "Employee";
    if (
      rawDesignation === "BRANCH_MANAGER" ||
      rawDesignation.toUpperCase() === "BRANCH_MANAGER"
    ) {
      rawDesignation = "Branch Manager";
    }
    const designation = rawDesignation;

    const department =
      payload.department ||
      emp.department ||
      emp.jobDetails?.department ||
      emp.personalDetails?.department ||
      "Operations";

    const reportingManager =
      payload.reportingManager || emp.reportingManager || "Managing Director";
    const placeOfPosting =
      emp.branchId?.name || payload.placeOfPosting || "Head Office Branch";
    const employmentType =
      emp.employmentType || payload.employmentType || "Full-Time / Permanent";

    // Resolve Compensation directly from Employee DB record (emp.jobDetails.salary)
    const salaryInput =
      emp.jobDetails?.salary !== undefined &&
      emp.jobDetails?.salary !== null &&
      emp.jobDetails?.salary > 0
        ? emp.jobDetails.salary
        : payload.salary || 600000;
    const comp = this.calculateCompensationBreakdown(salaryInput);

    const branchAddress = this.getBranchAddressString(emp.branchId);
    const companyAddress =
      branchAddress ||
      bank?.onboardingAddress ||
      "A-303, Swagat Enclave Housing Society, Jambhulwadi Road, Opp. Gawali Wada, Ambegaon Khurd, Haveli, Pune – 411046";

    // Build Data Mapping for Placeholders
    const dataMapping = {
      BANK_NAME: bankName,
      BANK_LOGO_URL: logoUrl,
      BANK_LOGO_BUFFER: logoBuffer,
      COMPANY_NAME: bankName,
      COMPANY_ADDRESS: companyAddress,
      CIN: bank?.cin || bank?.code || "[CIN No.]",
      COMPANY_EMAIL: bank?.email || "",
      COMPANY_WEBSITE: bank?.website || "www.sahayaone.com",

      REFERENCE_NUMBER: referenceNumber,
      OFFER_DATE: offerDate,

      EMPLOYEE_NAME: candidateName,
      "Candidate Name": candidateName,
      "Candidate Address, Line 1": addressInfo.line1,
      "City, State, PIN": `${addressInfo.city}, ${addressInfo.state}, ${addressInfo.pin}`,
      EMPLOYEE_ADDRESS_LINE1: addressInfo.line1,
      EMPLOYEE_ADDRESS_LINE2: addressInfo.line2,
      EMPLOYEE_CITY: addressInfo.city,
      EMPLOYEE_STATE: addressInfo.state,
      EMPLOYEE_PIN: addressInfo.pin,

      DESIGNATION: designation,
      Designation: designation,
      DEPARTMENT: department,
      "Department / Function": department,
      REPORTING_MANAGER: reportingManager,
      "Reporting Manager Name, Designation": reportingManager,
      JOINING_DATE: joiningDate,
      "Date of Joining": joiningDate,
      POSTING_LOCATION: placeOfPosting,
      "Location / Branch – e.g., Pune Head Office": placeOfPosting,
      EMPLOYMENT_TYPE: employmentType,
      "Full-Time / Permanent": employmentType,

      TOTAL_CTC: comp.formattedTotalCtc,
      "Total Annual CTC": comp.formattedTotalCtc,
      BASIC_SALARY: comp.formattedBasic,
      HRA: comp.formattedHra,
      SPECIAL_ALLOWANCES: comp.formattedSpecialAllowances,
      EMPLOYER_PF: comp.formattedPf,
      VARIABLE_PAY: comp.formattedVariablePay,
      GRATUITY: comp.formattedGratuity,

      WORKING_HOURS: "9:30 AM to 6:30 PM",
      WORKING_DAYS: "Monday to Saturday, with 2nd and 4th Saturdays off",

      PROBATION_MONTHS: `${emp.jobDetails?.probationPeriodMonths || 6} months`,
      PROBATION_EXTENSION_MONTHS: "3 months",

      PROBATION_NOTICE_PERIOD: "15 (fifteen) days",
      POST_CONFIRMATION_NOTICE_PERIOD: "30/60/90 days",

      NON_SOLICITATION_MONTHS: "12 months",

      SIGNATORY_NAME:
        payload.signatoryName || bank?.signatoryName || "Authorized Signatory",
      SIGNATORY_DESIGNATION:
        payload.signatoryDesignation ||
        bank?.signatoryDesignation ||
        "Head - Human Resources",
      SIGNATURE_BUFFER: signatureBuffer,
    };

    // Render PDF layout using PDFKit (standardized format across all employee and manager letters)
    const pdfBuffer = await this.renderPdfLayout(dataMapping);

    // Upload PDF to Storage (S3 / Local)
    const fileObj = {
      buffer: pdfBuffer,
      originalname: `Offer_Letter_${referenceNumber.replace(/[\/\\]/g, "_")}.pdf`,
      mimetype: "application/pdf",
    };

    const folderPath = `society/employees/${bankId}/${emp._id}/offer-letter`;
    const uploadResult = await storageManager.uploadFile(fileObj, folderPath);

    const fileUrl = uploadResult.fileUrl || uploadResult.url;
    const fileKey = uploadResult.key || uploadResult.filePath;

    // Update Employee / BranchManager record in Database
    const updateObj = {
      $set: {
        "offerLetter.url": fileUrl,
        "offerLetter.key": fileKey,
        "offerLetter.referenceNumber": referenceNumber,
        "offerLetter.generatedAt": new Date(),
      },
    };

    await SocietyEmployee.updateOne({ _id: emp._id }, updateObj).catch(() => {});
    await BranchManager.updateOne({ _id: emp._id }, updateObj).catch(() => {});

    // Create EmployeeLetterLog record
    const letterLog = await EmployeeLetterLog.create({
      bankId,
      branchId: emp.branchId?._id || emp.branchId || null,
      employeeId: emp._id,
      referenceNumber,
      employeeName: candidateName,
      employeeEmail: emp.email || "",
      documentType: "Offer Letter",
      documentTypeCode: "OFFER_LETTER",
      issuedDate: new Date(),
      detailsSummary: `Designation: ${designation} | CTC: ${comp.formattedTotalCtc}`,
      fileUrl,
      fileKey,
      metadata: { designation, totalCtc: comp.totalCtc, department },
    }).catch((err) =>
      logger.error(`Failed to create Offer Letter log: ${err.message}`),
    );

    logger.info(
      `OFFER LETTER GENERATED: Reference ${referenceNumber} created for Employee ${emp._id} (${candidateName}). URL: ${fileUrl}`,
    );

    return {
      success: true,
      message: "Offer letter generated successfully.",
      data: {
        employeeId: emp._id,
        referenceNumber,
        fileUrl,
        fileKey,
        candidateName,
        designation,
        totalCtc: comp.formattedTotalCtc,
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
            // Fallback if image buffer format is unsupported by PDFKit
          }
        }

        doc
          .fillColor(primaryColor)
          .fontSize(13)
          .font("Helvetica-Bold")
          .text(
            data.BANK_NAME || "CO-OPERATIVE BANK",
            titleX,
            headerY,
            { width: titleWidth, align: titleX === 40 ? "center" : "left" },
          );
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
        doc.text(`Date: ${data.OFFER_DATE}`);
        doc.moveDown(0.5);

        // Candidate Address
        doc.font("Helvetica-Bold").text("To,");
        doc.font("Helvetica-Bold").text(data.EMPLOYEE_NAME);
        doc.font("Helvetica").text(data.EMPLOYEE_ADDRESS_LINE1);
        if (data.EMPLOYEE_ADDRESS_LINE2) doc.text(data.EMPLOYEE_ADDRESS_LINE2);
        doc.text(
          `${data.EMPLOYEE_CITY}, ${data.EMPLOYEE_STATE}, ${data.EMPLOYEE_PIN}`,
        );
        doc.moveDown(0.8);

        // Title
        doc
          .fillColor(primaryColor)
          .fontSize(12)
          .font("Helvetica-Bold")
          .text("LETTER OF OFFER", { align: "center" });
        doc.moveDown(0.6);

        doc
          .fillColor(darkColor)
          .fontSize(8.5)
          .font("Helvetica")
          .text(`Dear ${data.EMPLOYEE_NAME},`);
        doc.moveDown(0.4);
        doc.text(
          `We are pleased to offer you employment with ${data.BANK_NAME} ("the Company") on the terms and conditions set out below and in the Annexure(s) enclosed with this letter.`,
        );
        doc.moveDown(0.6);

        // Section 1: Employee Details (Table 1)
        checkPageBreak(150);
        doc.x = 40;
        doc
          .fillColor(primaryColor)
          .fontSize(9.5)
          .font("Helvetica-Bold")
          .text("1. Employee Details", 40, doc.y);
        doc.moveDown(0.3);

        const details = [
          ["Employee Name", data.EMPLOYEE_NAME],
          ["Designation", data.DESIGNATION],
          ["Department / Function", data.DEPARTMENT],
          ["Reporting Manager", data.REPORTING_MANAGER],
          ["Date of Joining", data.JOINING_DATE],
          ["Place of Posting", data.POSTING_LOCATION],
          ["Employment Type", data.EMPLOYMENT_TYPE],
        ];

        let tableY = doc.y;
        details.forEach(([label, val]) => {
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

        // Section 2: Compensation Structure (Table 2)
        checkPageBreak(180);
        doc.x = 40;
        doc
          .fillColor(primaryColor)
          .fontSize(9.5)
          .font("Helvetica-Bold")
          .text("2. Compensation Structure", 40, doc.y);
        doc.moveDown(0.3);
        doc
          .fillColor(darkColor)
          .fontSize(8)
          .font("Helvetica")
          .text(
            `Your Cost to Company (CTC) will be ${data.TOTAL_CTC} per annum, structured as per the table below and further detailed in the Compensation Annexure (Annexure A). Your compensation is subject to applicable statutory deductions, including Income Tax (TDS), Provident Fund and Professional Tax, and shall be reviewed periodically as per Company policy and business performance.`,
            40,
            doc.y,
            { align: "justify", width: 515 },
          );
        doc.moveDown(0.4);

        const compRows = [
          ["Basic Salary", data.BASIC_SALARY],
          ["House Rent Allowance (HRA)", data.HRA],
          ["Special / Other Allowances", data.SPECIAL_ALLOWANCES],
          ["Employer's PF Contribution", data.EMPLOYER_PF],
          ["Performance Incentive / Variable Pay", data.VARIABLE_PAY],
          ["Gratuity (as per Payment of Gratuity Act, 1972)", data.GRATUITY],
          ["Total Annual CTC", data.TOTAL_CTC],
        ];

        let cTableY = doc.y;
        // Table Header
        doc
          .rect(40, cTableY, 330, 16)
          .fillAndStroke(primaryColor, primaryColor);
        doc
          .rect(370, cTableY, 185, 16)
          .fillAndStroke(primaryColor, primaryColor);
        doc
          .fillColor("#FFFFFF")
          .fontSize(8)
          .font("Helvetica-Bold")
          .text("Component (Annual)", 45, cTableY + 4, { width: 320 });
        doc.text("Amount (Rs.)", 375, cTableY + 4, { width: 175 });
        cTableY += 16;

        compRows.forEach(([compLabel, compVal], idx) => {
          const isTotal = idx === compRows.length - 1;
          const bg = isTotal ? lightBg : idx % 2 === 0 ? "#FFFFFF" : "#F7FAFC";
          doc.rect(40, cTableY, 330, 16).fillAndStroke(bg, "#CBD5E0");
          doc.rect(370, cTableY, 185, 16).fillAndStroke(bg, "#CBD5E0");
          doc
            .fillColor(darkColor)
            .fontSize(8)
            .font(isTotal ? "Helvetica-Bold" : "Helvetica")
            .text(compLabel, 45, cTableY + 4, { width: 320 });
          doc
            .font(isTotal ? "Helvetica-Bold" : "Helvetica")
            .text(compVal, 375, cTableY + 4, { width: 175 });
          cTableY += 16;
        });

        doc.x = 40;
        doc.y = cTableY + 10;

        // Legal Clauses Helper
        const renderClause = (title, text) => {
          checkPageBreak(40);
          doc.x = 40;
          doc
            .fillColor(primaryColor)
            .fontSize(9.5)
            .font("Helvetica-Bold")
            .text(title, 40, doc.y);
          doc.moveDown(0.2);
          doc
            .fillColor(darkColor)
            .fontSize(8)
            .font("Helvetica")
            .text(text, 40, doc.y, { align: "justify", width: 515 });
          doc.moveDown(0.5);
          doc.x = 40;
        };

        renderClause(
          "3. Working Hours",
          `Standard working hours are ${data.WORKING_HOURS}, ${data.WORKING_DAYS}, or as communicated for your specific role/location. You may be required to work additional hours, including on weekends or holidays, based on business exigencies, client servicing requirements, and month-end/regulatory reporting timelines, without additional compensation unless otherwise provided under applicable law or Company policy.`,
        );

        renderClause(
          "4. Probation Period & Confirmation Terms",
          `You will be on probation for a period of ${data.PROBATION_MONTHS} from your Date of Joining. During probation, your performance, conduct and suitability for the role will be reviewed. Based on this review, your employment may be confirmed in writing, your probation extended by a further period not exceeding ${data.PROBATION_EXTENSION_MONTHS}, or your employment terminated, in accordance with the Company's HR Policy. You will continue to be governed by the terms of this offer letter until a separate Confirmation Letter is issued.`,
        );

        renderClause(
          "5. Leave Policy",
          `You will be entitled to leave (including Casual Leave, Sick Leave, Earned/Privilege Leave, and other statutory leave such as Maternity/Paternity Leave, where applicable) in accordance with the Company's Leave Policy and applicable law, including the Maharashtra Shops and Establishments Act. Details of leave entitlement, accrual and encashment are set out in the Company's HR Policy Manual, which will be shared with you separately.`,
        );

        renderClause(
          "6. Code of Conduct",
          `You are expected to maintain the highest standards of integrity, professionalism and ethical conduct at all times, and to comply with the Company's Code of Conduct, Anti-Bribery & Anti-Corruption Policy, and Prevention of Sexual Harassment (POSH) Policy, as amended from time to time. Any breach of the Code of Conduct may result in disciplinary action, up to and including termination of employment.`,
        );

        renderClause(
          "7. Confidentiality & Non-Disclosure Agreement (NDA)",
          `You shall maintain strict confidentiality of all proprietary, technical, financial, customer, member and business information of the Company and its clients (including partner Cooperative Credit Societies, Banks, NBFCs and lending institutions), both during and after your employment, and shall not disclose such information to any third party except as required in the ordinary course of your duties or as mandated by law. You will be required to separately execute the Company's standard Non-Disclosure Agreement (Annexure B) as a condition of employment, the terms of which shall survive termination of your employment.`,
        );

        renderClause(
          "8. Non-Solicitation Clause",
          `During your employment and for a period of ${data.NON_SOLICITATION_MONTHS} following the termination or cessation of your employment for any reason, you shall not, directly or indirectly, solicit, induce or attempt to solicit or induce any employee, consultant, client, customer, member Cooperative Society, Bank, NBFC or business partner of the Company to terminate or reduce their relationship with the Company.`,
        );

        renderClause(
          "9. Intellectual Property Clause",
          `All work product, inventions, software, source code, designs, processes, documentation and other intellectual property created, developed or contributed to by you in the course of your employment (whether alone or jointly), including in relation to the Company's SaaS platform and related technology, shall be the sole and exclusive property of the Company. You hereby assign all right, title and interest in such intellectual property to the Company and agree to execute any documents necessary to give effect to such assignment.`,
        );

        renderClause(
          "10. IT Asset Policy",
          `Any laptop, mobile device, SIM card, access card, software licence, login credentials or other IT/company assets issued to you shall be used solely for official purposes, in accordance with the Company's IT Asset & Acceptable Use Policy and Information Security Policy. You shall not install unauthorised software, share login credentials, or use Company systems to access or store unlawful or non-business content. All Company assets and confidential materials must be returned in good working condition upon separation, and final settlement shall be subject to such return.`,
        );

        renderClause(
          "11. Data Privacy Obligations",
          `In the course of your employment, you may have access to personal data and sensitive personal data of the Company's employees, customers and member Cooperative Society/Bank/NBFC stakeholders. You shall process such data strictly in accordance with the Digital Personal Data Protection Act, 2023, the Information Technology Act, 2000 (including applicable SPDI Rules), and the Company's Data Privacy and Information Security Policies, and shall not access, use or disclose such data other than as required for your official duties.`,
        );

        renderClause(
          "12. Termination Conditions",
          `During probation, either party may terminate this employment by giving ${data.PROBATION_NOTICE_PERIOD} written notice or pay in lieu thereof. Post confirmation, the notice period shall be ${data.POST_CONFIRMATION_NOTICE_PERIOD} or pay in lieu thereof, as specified in your Confirmation Letter. Notwithstanding the above, the Company may terminate your employment without notice or payment in lieu thereof in cases of misconduct, breach of the Code of Conduct, breach of confidentiality/NDA obligations, or any act of fraud, dishonesty or negligence. Upon termination, you shall complete a full handover and exit clearance, including return of all Company assets and confidential material, as a condition of full and final settlement.`,
        );

        renderClause(
          "13. Governing Law & Jurisdiction",
          `This letter, and the terms of employment/engagement recorded herein, shall be governed by and construed in accordance with the laws of India, including without limitation the Companies Act, 2013; the Indian Contract Act, 1872; the applicable Shops and Establishments Act of the State of Maharashtra; the Payment of Wages Act, 1936; the Minimum Wages Act, 1948; the Industrial Employment (Standing Orders) Act, 1946; the Employees' Provident Funds and Miscellaneous Provisions Act, 1952; the Employees' State Insurance Act, 1948 (where applicable); the Payment of Bonus Act, 1965; the Payment of Gratuity Act, 1972; the Maternity Benefit Act, 1961; and the Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013. As the Company provides technology, distribution and support services to Cooperative Credit Societies registered under the Multi-State Cooperative Societies Act, 2002 (or the respective State Cooperative Societies Act), and to Banks, NBFCs and other regulated lending institutions, employees engaged in credit, collections, operations, technology and compliance functions shall additionally observe the Reserve Bank of India's Fair Practices Code, Master Directions on Digital Lending and IT Outsourcing, applicable KYC/AML/PMLA guidelines, the Information Technology Act, 2000 (as applicable to the Company's SaaS/IT service offerings) and the Digital Personal Data Protection Act, 2023, in each case to the extent relevant to their role. Any dispute, difference or claim arising out of or in connection with this letter or its subject matter shall be subject to the exclusive jurisdiction of the competent courts at Pune, Maharashtra.`,
        );

        // Section 14: General Terms
        checkPageBreak(100);
        doc.x = 40;
        doc
          .fillColor(primaryColor)
          .fontSize(9.5)
          .font("Helvetica-Bold")
          .text("14. General Terms", 40, doc.y);
        doc.moveDown(0.3);

        const generalTerms = [
          "Statutory Benefits: You will be covered under Provident Fund, Gratuity (on completion of qualifying service) and, where applicable, Employees' State Insurance, in accordance with applicable law.",
          "Background Verification & Medical Fitness: This offer is contingent upon satisfactory background verification, reference checks, and your being found medically fit. The Company reserves the right to withdraw or terminate this offer if any information furnished by you is found to be false, incorrect or concealed.",
          "Conflict of Interest: You shall disclose to the Company any actual or potential conflict of interest, including relationships with clients, vendors, or partner Cooperative Societies/Banks/NBFCs, promptly upon becoming aware of the same.",
          "Anti-Bribery, Anti-Corruption & Whistleblower Policy: You shall comply with the Company's Anti-Bribery & Anti-Corruption Policy and may report any suspected misconduct in good faith under the Company's Whistleblower Policy, without fear of retaliation.",
          "Amendment: The Company reserves the right to modify, amend or introduce policies applicable to your employment from time to time, in accordance with applicable law, with reasonable notice to you.",
          "Entire Agreement & Severability: This letter, together with its Annexures and the Company's policies referred to herein, constitutes the entire agreement between you and the Company regarding your employment. If any provision is held invalid or unenforceable, the remaining provisions shall continue in full force and effect.",
          "Force Majeure: The Company shall not be liable for any delay or inability to perform its obligations under this letter due to circumstances beyond its reasonable control.",
        ];

        generalTerms.forEach((term) => {
          doc
            .fillColor(darkColor)
            .fontSize(8)
            .font("Helvetica")
            .text(`• ${term}`, 40, doc.y, { align: "justify", width: 515 });
          doc.moveDown(0.2);
        });

        doc.moveDown(0.4);
        doc.text(
          "Please sign and return the duplicate copy of this letter, along with the enclosed Annexure(s) and NDA, as a token of your acceptance of the above terms and conditions. We look forward to a long and mutually rewarding association with you.",
          40,
          doc.y,
          { align: "justify", width: 515 },
        );
        doc.moveDown(1);

        // Signatures Block
        checkPageBreak(120);
        const sigY = doc.y;

        // Left Signatory (Company)
        doc
          .fillColor(darkColor)
          .fontSize(8.5)
          .font("Helvetica-Bold")
          .text(
            `For ${data.BANK_NAME || "Sahayaone Credit Info Private Limited"}`,
            40,
            sigY,
          );

        let sigLineOffset = 30;
        if (data.SIGNATURE_BUFFER) {
          try {
            doc.image(data.SIGNATURE_BUFFER, 40, sigY + 12, { fit: [130, 32] });
            sigLineOffset = 46;
          } catch (sigErr) {
            logger.warn(`Failed to render signature image in offer letter PDF: ${sigErr.message}`);
          }
        }

        doc.text("_______________________________", 40, sigY + sigLineOffset);
        doc.text("Authorised Signatory", 40, sigY + sigLineOffset + 12);
        doc
          .font("Helvetica")
          .text(`Name: ${data.SIGNATORY_NAME}`, 40, sigY + sigLineOffset + 24);
        doc.text(`Designation: ${data.SIGNATORY_DESIGNATION}`, 40, sigY + sigLineOffset + 36);

        // Right Signatory (Candidate)
        doc
          .font("Helvetica-Bold")
          .fontSize(8.5)
          .text(
            `I, ${data.EMPLOYEE_NAME}, accept the appointment and the terms and conditions mentioned above and in the enclosed Annexure(s).`,
            300,
            sigY,
            { width: 250 },
          );
        doc.text("Signature: _______________________", 300, sigY + 42);
        doc.text("Date: _______________", 300, sigY + 66);

        doc.y = sigY + 85;
        doc.moveDown(0.8);
        doc
          .fontSize(7.5)
          .font("Helvetica-Oblique")
          .fillColor("#718096")
          .text(
            "Enclosures: Annexure A – Compensation Structure; Annexure B – Non-Disclosure Agreement; Annexure C – Company HR Policy Manual / Code of Conduct.",
            40,
            doc.y,
            { align: "center" },
          );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

export const offerLetterService = new OfferLetterService();
