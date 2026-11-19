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

export class SalarySlipService {
  /**
   * Format currency into Indian locale format e.g. Rs. 46,800
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
    if (!dateInput) return "N/A";
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "N/A";

    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
  }

  /**
   * Get Month Name & Year e.g. "August 2026"
   */
  getMonthYearString(dateInput) {
    const d = dateInput ? new Date(dateInput) : new Date();
    const validDate = isNaN(d.getTime()) ? new Date() : d;

    return validDate.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
  }

  /**
   * Number to Words Converter for Indian Rupees
   */
  numberToWords(num) {
    if (num === null || num === undefined || isNaN(num) || num <= 0)
      return "Rupees Zero Only";

    const a = [
      "",
      "One ",
      "Two ",
      "Three ",
      "Four ",
      "Five ",
      "Six ",
      "Seven ",
      "Eight ",
      "Nine ",
      "Ten ",
      "Eleven ",
      "Twelve ",
      "Thirteen ",
      "Fourteen ",
      "Fifteen ",
      "Sixteen ",
      "Seventeen ",
      "Eighteen ",
      "Nineteen ",
    ];
    const b = [
      "",
      "",
      "Twenty",
      "Thirty",
      "Forty",
      "Fifty",
      "Sixty",
      "Seventy",
      "Eighty",
      "Ninety",
    ];

    const inWords = (n) => {
      if (n < 20) return a[n];
      if (n < 100)
        return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
      if (n < 1000)
        return (
          a[Math.floor(n / 100)] +
          "Hundred " +
          (n % 100 ? inWords(n % 100) : "")
        );
      if (n < 100000)
        return (
          inWords(Math.floor(n / 1000)) +
          "Thousand " +
          (n % 1000 ? inWords(n % 1000) : "")
        );
      if (n < 10000000)
        return (
          inWords(Math.floor(n / 100000)) +
          "Lakh " +
          (n % 100000 ? inWords(n % 100000) : "")
        );
      return (
        inWords(Math.floor(n / 10000000)) +
        "Crore " +
        (n % 10000000 ? inWords(n % 10000000) : "")
      );
    };

    return "Rupees " + inWords(Math.round(num)).trim() + " Only";
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
   * Generate sequential reference number {BANK_PREFIX}/HR/SS/{YEAR}/{MONTH}/{XXX}
   */
  async generateReferenceNumber(emp, bank, salaryDateObj) {
    const bankPrefix = this.generateBankPrefix(bank);
    const currentYear = salaryDateObj.getFullYear();
    const currentMonth = String(salaryDateObj.getMonth() + 1).padStart(2, "0");
    const prefix = `${bankPrefix}/HR/SS/${currentYear}/${currentMonth}/`;

    if (
      emp.salarySlip?.referenceNumber &&
      emp.salarySlip.referenceNumber.startsWith(prefix)
    ) {
      return emp.salarySlip.referenceNumber;
    }

    const latestEmp = await SocietyEmployee.findOne({
      bankId: bank?._id || emp.bankId,
      "salarySlip.referenceNumber": new RegExp(
        `^${bankPrefix}/HR/SS/${currentYear}/${currentMonth}/`,
        "i",
      ),
    })
      .sort({ "salarySlip.referenceNumber": -1 })
      .lean();

    let seq = 1;
    if (latestEmp?.salarySlip?.referenceNumber) {
      const match = latestEmp.salarySlip.referenceNumber.match(/\/(\d+)$/);
      if (match) {
        seq = parseInt(match[1], 10) + 1;
      }
    }

    return `${prefix}${String(seq).padStart(3, "0")}`;
  }

  /**
   * Main salary slip generation entry point
   */
  async generateSalarySlip(bankId, payload, societyContext = null) {
    const employeeId = payload.employeeId || payload.id;
    if (!employeeId) {
      throw ApiError.badRequest(
        "Employee ID is required for generating salary slip.",
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
    const cinText =
      bank?.cin && String(bank.cin).trim() ? String(bank.cin).trim() : "N/A";

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

    // Resolve Salary Date & Month
    const dateInput =
      payload.salaryDate ||
      payload.date ||
      payload.salaryMonth ||
      payload.fromMonth ||
      Date.now();
    const salaryDateObj = new Date(dateInput);
    const validSalaryDate = isNaN(salaryDateObj.getTime())
      ? new Date()
      : salaryDateObj;

    const referenceNumber = await this.generateReferenceNumber(
      emp,
      bank,
      validSalaryDate,
    );
    const payDateInput =
      payload.payDate ||
      payload.paymentDate ||
      payload.disbursementDate ||
      new Date();
    const payDate = this.formatDateIndia(payDateInput);
    const payPeriod =
      payload.payPeriod || this.getMonthYearString(validSalaryDate);

    // Resolve Employee Information
    const candidateName = emp.fullName || "Employee Name";
    const employeeCode = emp.employeeCode || String(emp._id);
    const designation =
      payload.designation || emp.designation || emp.roleId?.name || "N/A";
    const department = emp.department || emp.jobDetails?.department || "N/A";
    const branchName =
      emp.branchId?.name ||
      (emp.branchId?.address?.city
        ? `${emp.branchId.address.city} Branch`
        : "N/A");
    const joiningDate = emp.jobDetails?.joiningDate
      ? this.formatDateIndia(emp.jobDetails.joiningDate)
      : "N/A";

    // Mask Bank Account Number (Never expose full account number)
    const rawAccount = String(
      payload.accountNumber ||
        emp.bankDetails?.accountNumber ||
        emp.accountNumber ||
        "",
    ).trim();
    const maskedAccount =
      rawAccount.length >= 4
        ? `XXXX XXXX ${rawAccount.slice(-4)}`
        : rawAccount
          ? `XXXX XXXX ${rawAccount}`
          : "N/A";

    // PF/UAN Number (No fake UAN fallback!)
    const pfUan =
      payload.pfUan ||
      emp.pfUan ||
      emp.personalDetails?.pfUan ||
      emp.jobDetails?.pfUan ||
      "N/A";

    // Attendance & Pay Days Data (Optional)
    let attendanceData = null;
    if (
      payload.attendance ||
      payload.workingDays !== undefined ||
      payload.presentDays !== undefined
    ) {
      const att = payload.attendance || {};
      attendanceData = {
        workingDays: payload.workingDays ?? att.workingDays ?? "N/A",
        presentDays: payload.presentDays ?? att.presentDays ?? "N/A",
        paidDays: payload.paidDays ?? att.paidDays ?? "N/A",
        lopDays: payload.lopDays ?? att.lopDays ?? "N/A",
      };
    }

    // Earnings Processing
    let earningsList = [];
    if (
      payload.earnings &&
      Array.isArray(payload.earnings) &&
      payload.earnings.length > 0
    ) {
      earningsList = payload.earnings.map((e) => ({
        label: e.label || e.name || "Allowance",
        amount: Number(e.amount || 0),
      }));
    } else {
      const rawSalary =
        payload.grossSalary !== undefined
          ? Number(payload.grossSalary)
          : Number(emp.jobDetails?.salary || 0);

      const monthlyGross =
        rawSalary > 100000 ? Math.round(rawSalary / 12) : rawSalary;

      if (monthlyGross > 0) {
        const basic = Math.round(monthlyGross * 0.5);
        const hra = Math.round(monthlyGross * 0.2);
        const special = monthlyGross - basic - hra;

        earningsList = [
          { label: "Basic Salary", amount: basic },
          { label: "HRA", amount: hra },
          { label: "Special Allowance", amount: special },
        ];
      } else {
        earningsList = [{ label: "Basic Salary", amount: 0 }];
      }
    }

    // Deductions Processing
    let deductionsList = [];
    if (
      payload.deductions &&
      Array.isArray(payload.deductions) &&
      payload.deductions.length > 0
    ) {
      deductionsList = payload.deductions.map((d) => ({
        label: d.label || d.name || "Deduction",
        amount: Number(d.amount || 0),
      }));
    } else {
      if (payload.pfDeduction || payload.pfAmount) {
        deductionsList.push({
          label: "Employee PF",
          amount: Number(payload.pfDeduction || payload.pfAmount),
        });
      }
      if (payload.professionalTax || payload.ptAmount) {
        deductionsList.push({
          label: "Professional Tax",
          amount: Number(payload.professionalTax || payload.ptAmount),
        });
      }
      if (payload.tds || payload.incomeTax) {
        deductionsList.push({
          label: "TDS",
          amount: Number(payload.tds || payload.incomeTax),
        });
      }
      if (payload.otherDeductions) {
        deductionsList.push({
          label: "Other Deductions",
          amount: Number(payload.otherDeductions),
        });
      }
      if (deductionsList.length === 0) {
        deductionsList.push({ label: "Other Deductions", amount: 0 });
      }
    }

    // Employer Contributions (Optional, displayed separately, does NOT reduce Net Salary)
    let employerContributionsList = [];
    if (
      payload.employerContributions &&
      Array.isArray(payload.employerContributions)
    ) {
      employerContributionsList = payload.employerContributions.map((c) => ({
        label: c.label || c.name || "Employer Contribution",
        amount: Number(c.amount || 0),
      }));
    } else if (payload.employerPf) {
      employerContributionsList.push({
        label: "Employer PF",
        amount: Number(payload.employerPf),
      });
    }

    // Reconciliation Check
    const totalGrossEarnings = earningsList.reduce(
      (sum, item) => sum + item.amount,
      0,
    );
    const totalDeductions = deductionsList.reduce(
      (sum, item) => sum + item.amount,
      0,
    );
    const netSalary = totalGrossEarnings - totalDeductions;

    if (netSalary < 0) {
      throw ApiError.badRequest(
        `Invalid salary calculation: Total Deductions (${this.formatCurrency(totalDeductions)}) exceed Total Gross Earnings (${this.formatCurrency(totalGrossEarnings)}).`,
      );
    }

    const netSalaryWords = this.numberToWords(netSalary);

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
      CIN: cinText,
      COMPANY_EMAIL: bank?.email || "",
      COMPANY_WEBSITE: bank?.website || "",

      REFERENCE_NUMBER: referenceNumber,
      PAY_DATE: payDate,
      PAY_PERIOD: payPeriod,

      EMPLOYEE_NAME: candidateName,
      EMPLOYEE_ID: employeeCode,
      DESIGNATION: designation,
      DEPARTMENT: department,
      BRANCH_NAME: branchName,
      JOINING_DATE: joiningDate,
      ACCOUNT_NUMBER: maskedAccount,
      PF_UAN: pfUan,

      ATTENDANCE: attendanceData,
      EARNINGS: earningsList,
      DEDUCTIONS: deductionsList,
      EMPLOYER_CONTRIBUTIONS: employerContributionsList,

      TOTAL_GROSS: this.formatCurrency(totalGrossEarnings),
      TOTAL_DEDUCTIONS: this.formatCurrency(totalDeductions),

      NET_SALARY: this.formatCurrency(netSalary),
      NET_SALARY_WORDS: netSalaryWords,

      SIGNATORY_NAME:
        payload.signatoryName || bank?.signatoryName || "Authorized Signatory",
      SIGNATORY_DESIGNATION:
        payload.signatoryDesignation ||
        bank?.signatoryDesignation ||
        "HR & Payroll Manager",
      SIGNATURE_BUFFER: signatureBuffer,
    };

    // Render PDF buffer
    const pdfBuffer = await this.renderPdfLayout(dataMapping);

    // Upload PDF to Storage (S3 / Local)
    const fileObj = {
      buffer: pdfBuffer,
      originalname: `Salary_Slip_${referenceNumber.replace(/[\/\\]/g, "_")}.pdf`,
      mimetype: "application/pdf",
    };

    const folderPath = `society/employees/${bankId}/${emp._id}/salary-slip`;
    const uploadResult = await storageManager.uploadFile(fileObj, folderPath);

    const fileUrl = uploadResult.fileUrl || uploadResult.url;
    const fileKey = uploadResult.key || uploadResult.filePath;

    // Update Employee record in Database
    await SocietyEmployee.updateOne(
      { _id: emp._id, bankId },
      {
        $set: {
          "salarySlip.url": fileUrl,
          "salarySlip.key": fileKey,
          "salarySlip.referenceNumber": referenceNumber,
          "salarySlip.generatedAt": new Date(),
          "salarySlip.payDate": new Date(payDateInput),
          "salarySlip.payPeriod": payPeriod,
          "salarySlip.netSalary": netSalary,
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
      documentType: "Salary Slip",
      documentTypeCode: "SALARY_SLIP",
      issuedDate: new Date(),
      detailsSummary: `Period: ${payPeriod} | Net Salary: ${this.formatCurrency(netSalary)}`,
      fileUrl,
      fileKey,
      metadata: { payPeriod, netSalary, designation, branchName },
    }).catch((err) =>
      logger.error(`Failed to create Salary Slip log: ${err.message}`),
    );

    logger.info(
      `SALARY SLIP GENERATED: Reference ${referenceNumber} created for Employee ${emp._id} (${candidateName}) for ${payPeriod}. Net Salary: ${netSalary}. URL: ${fileUrl}`,
    );

    return {
      success: true,
      message: `Salary slip for ${payPeriod} generated successfully.`,
      data: {
        employeeId: emp._id,
        referenceNumber,
        fileUrl,
        fileKey,
        payPeriod,
        netSalary,
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
          `CIN: ${data.CIN} | Email: ${data.COMPANY_EMAIL} | Web: ${data.COMPANY_WEBSITE}`,
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

        // Document Title
        doc
          .fillColor(primaryColor)
          .fontSize(12)
          .font("Helvetica-Bold")
          .text("SALARY SLIP", { align: "center" });
        doc.moveDown(0.4);

        // Header Summary Info (Pay Period, Pay Date, Reference No.)
        doc.fillColor(darkColor).fontSize(8.5).font("Helvetica-Bold");
        doc.text(
          `Pay Period: ${data.PAY_PERIOD}   |   Pay Date: ${data.PAY_DATE}   |   Reference No.: ${data.REFERENCE_NUMBER}`,
          { align: "center" },
        );
        doc.moveDown(0.8);

        // Section 1: Employee Information Table Grid
        checkPageBreak(100);
        doc.x = 40;
        doc
          .fillColor(primaryColor)
          .fontSize(9.5)
          .font("Helvetica-Bold")
          .text("Employee Details", 40, doc.y);
        doc.moveDown(0.3);

        const empGrid = [
          ["Employee Name", data.EMPLOYEE_NAME, "Pay Period", data.PAY_PERIOD],
          [
            "Employee Code",
            data.EMPLOYEE_ID,
            "Date of Joining",
            data.JOINING_DATE,
          ],
          ["Designation", data.DESIGNATION, "Department", data.DEPARTMENT],
          [
            "Branch / Location",
            data.BRANCH_NAME,
            "Bank A/C No.",
            data.ACCOUNT_NUMBER,
          ],
          ["PF / UAN", data.PF_UAN, "Pay Date", data.PAY_DATE],
        ];

        let gridY = doc.y;
        empGrid.forEach(([l1, v1, l2, v2]) => {
          doc.rect(40, gridY, 110, 16).fillAndStroke(lightBg, "#CBD5E0");
          doc.rect(150, gridY, 145, 16).stroke("#CBD5E0");
          doc.rect(295, gridY, 110, 16).fillAndStroke(lightBg, "#CBD5E0");
          doc.rect(405, gridY, 150, 16).stroke("#CBD5E0");

          doc
            .fillColor(darkColor)
            .fontSize(8)
            .font("Helvetica-Bold")
            .text(l1, 45, gridY + 4, { width: 100 });
          doc.font("Helvetica").text(v1, 155, gridY + 4, { width: 135 });
          doc.font("Helvetica-Bold").text(l2, 300, gridY + 4, { width: 100 });
          doc.font("Helvetica").text(v2, 410, gridY + 4, { width: 140 });

          gridY += 16;
        });

        doc.x = 40;
        doc.y = gridY + 10;

        // Section 2: Attendance & Pay Days (Optional)
        if (data.ATTENDANCE) {
          checkPageBreak(50);
          doc.x = 40;
          doc
            .fillColor(primaryColor)
            .fontSize(9.5)
            .font("Helvetica-Bold")
            .text("Attendance & Pay Days", 40, doc.y);
          doc.moveDown(0.3);

          let attY = doc.y;
          const attGrid = [
            [
              "Working Days",
              String(data.ATTENDANCE.workingDays),
              "Present Days",
              String(data.ATTENDANCE.presentDays),
            ],
            [
              "Paid Days",
              String(data.ATTENDANCE.paidDays),
              "LOP Days",
              String(data.ATTENDANCE.lopDays),
            ],
          ];

          attGrid.forEach(([l1, v1, l2, v2]) => {
            doc.rect(40, attY, 110, 16).fillAndStroke(lightBg, "#CBD5E0");
            doc.rect(150, attY, 145, 16).stroke("#CBD5E0");
            doc.rect(295, attY, 110, 16).fillAndStroke(lightBg, "#CBD5E0");
            doc.rect(405, attY, 150, 16).stroke("#CBD5E0");

            doc
              .fillColor(darkColor)
              .fontSize(8)
              .font("Helvetica-Bold")
              .text(l1, 45, attY + 4, { width: 100 });
            doc.font("Helvetica").text(v1, 155, attY + 4, { width: 135 });
            doc.font("Helvetica-Bold").text(l2, 300, attY + 4, { width: 100 });
            doc.font("Helvetica").text(v2, 410, attY + 4, { width: 140 });

            attY += 16;
          });

          doc.x = 40;
          doc.y = attY + 10;
        }

        // Section 3: Earnings & Deductions Breakdown Table
        checkPageBreak(120);
        doc.x = 40;
        doc
          .fillColor(primaryColor)
          .fontSize(9.5)
          .font("Helvetica-Bold")
          .text("Salary Breakdown", 40, doc.y);
        doc.moveDown(0.3);

        let tableY = doc.y;

        // Table Header
        doc.rect(40, tableY, 175, 16).fillAndStroke(primaryColor, primaryColor);
        doc.rect(215, tableY, 82, 16).fillAndStroke(primaryColor, primaryColor);
        doc
          .rect(297, tableY, 175, 16)
          .fillAndStroke(primaryColor, primaryColor);
        doc.rect(472, tableY, 83, 16).fillAndStroke(primaryColor, primaryColor);

        doc.fillColor("#FFFFFF").fontSize(8).font("Helvetica-Bold");
        doc.text("EARNINGS", 45, tableY + 4, { width: 165 });
        doc.text("AMOUNT", 220, tableY + 4, { width: 75 });
        doc.text("DEDUCTIONS", 302, tableY + 4, { width: 165 });
        doc.text("AMOUNT", 477, tableY + 4, { width: 75 });

        tableY += 16;

        const maxRows = Math.max(data.EARNINGS.length, data.DEDUCTIONS.length);

        for (let i = 0; i < maxRows; i++) {
          const eItem = data.EARNINGS[i] || { label: "", amount: null };
          const dItem = data.DEDUCTIONS[i] || { label: "", amount: null };

          const bg = i % 2 === 0 ? "#FFFFFF" : "#F7FAFC";
          doc.rect(40, tableY, 175, 16).fillAndStroke(bg, "#CBD5E0");
          doc.rect(215, tableY, 82, 16).fillAndStroke(bg, "#CBD5E0");
          doc.rect(297, tableY, 175, 16).fillAndStroke(bg, "#CBD5E0");
          doc.rect(472, tableY, 83, 16).fillAndStroke(bg, "#CBD5E0");

          doc.fillColor(darkColor).fontSize(8).font("Helvetica");
          doc.text(eItem.label, 45, tableY + 4, { width: 165 });
          doc.text(
            eItem.amount !== null ? this.formatCurrency(eItem.amount) : "",
            220,
            tableY + 4,
            { width: 75 },
          );
          doc.text(dItem.label, 302, tableY + 4, { width: 165 });
          doc.text(
            dItem.amount !== null ? this.formatCurrency(dItem.amount) : "",
            477,
            tableY + 4,
            { width: 75 },
          );

          tableY += 16;
        }

        // Total Row
        doc.rect(40, tableY, 175, 16).fillAndStroke(lightBg, "#CBD5E0");
        doc.rect(215, tableY, 82, 16).fillAndStroke(lightBg, "#CBD5E0");
        doc.rect(297, tableY, 175, 16).fillAndStroke(lightBg, "#CBD5E0");
        doc.rect(472, tableY, 83, 16).fillAndStroke(lightBg, "#CBD5E0");

        doc.fillColor(primaryColor).fontSize(8).font("Helvetica-Bold");
        doc.text("Total Gross Earnings", 45, tableY + 4, { width: 165 });
        doc.text(data.TOTAL_GROSS, 220, tableY + 4, { width: 75 });
        doc.text("Total Deductions", 302, tableY + 4, { width: 165 });
        doc.text(data.TOTAL_DEDUCTIONS, 477, tableY + 4, { width: 75 });

        tableY += 16;
        doc.x = 40;
        doc.y = tableY + 10;

        // Section 4: Employer Contributions (Optional, Separate from employee deductions)
        if (
          data.EMPLOYER_CONTRIBUTIONS &&
          data.EMPLOYER_CONTRIBUTIONS.length > 0
        ) {
          checkPageBreak(50);
          doc.x = 40;
          doc
            .fillColor(primaryColor)
            .fontSize(9.5)
            .font("Helvetica-Bold")
            .text("Employer Contributions (Statutory)", 40, doc.y);
          doc.moveDown(0.3);

          let ecY = doc.y;
          doc.rect(40, ecY, 330, 16).fillAndStroke(lightBg, "#CBD5E0");
          doc.rect(370, ecY, 185, 16).fillAndStroke(lightBg, "#CBD5E0");
          doc
            .fillColor(primaryColor)
            .fontSize(8)
            .font("Helvetica-Bold")
            .text("Contribution Component", 45, ecY + 4, { width: 320 });
          doc.text("Amount", 375, ecY + 4, { width: 175 });
          ecY += 16;

          data.EMPLOYER_CONTRIBUTIONS.forEach((c) => {
            doc.rect(40, ecY, 330, 16).fillAndStroke("#FFFFFF", "#CBD5E0");
            doc.rect(370, ecY, 185, 16).fillAndStroke("#FFFFFF", "#CBD5E0");
            doc
              .fillColor(darkColor)
              .fontSize(8)
              .font("Helvetica")
              .text(c.label, 45, ecY + 4, { width: 320 });
            doc.text(this.formatCurrency(c.amount), 375, ecY + 4, {
              width: 175,
            });
            ecY += 16;
          });

          doc.x = 40;
          doc.y = ecY + 10;
        }

        // Section 5: Net Salary Summary Bar Box
        checkPageBreak(50);
        const netBoxY = doc.y;
        doc.rect(40, netBoxY, 515, 34).fillAndStroke(lightBg, primaryColor);

        doc
          .fillColor(primaryColor)
          .fontSize(10)
          .font("Helvetica-Bold")
          .text(`NET SALARY PAYABLE: ${data.NET_SALARY}`, 50, netBoxY + 5);
        doc
          .fillColor(darkColor)
          .fontSize(8.5)
          .font("Helvetica-Oblique")
          .text(`(${data.NET_SALARY_WORDS})`, 50, netBoxY + 19);

        doc.y = netBoxY + 42;

        // System Generated Note
        doc
          .fontSize(7.5)
          .font("Helvetica-Oblique")
          .fillColor("#718096")
          .text(
            "*This is a system-generated salary slip and does not require a physical signature.",
            40,
            doc.y,
            { align: "center" },
          );
        doc.moveDown(1.5);

        // Signatures Block
        checkPageBreak(80);
        const sigY = doc.y;

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
            logger.warn(`Failed to render signature image in salary slip PDF: ${sigErr.message}`);
          }
        }

        doc.text("_______________________________", 40, sigY + sigLineOffset);
        doc.text("Authorised Signatory", 40, sigY + sigLineOffset + 12);
        doc
          .font("Helvetica")
          .text(`Name: ${data.SIGNATORY_NAME}`, 40, sigY + sigLineOffset + 24);
        doc.text(`Designation: ${data.SIGNATORY_DESIGNATION}`, 40, sigY + sigLineOffset + 36);

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

export const salarySlipService = new SalarySlipService();
