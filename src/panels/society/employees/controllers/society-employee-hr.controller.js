import { BaseController } from '../../../../common/base.controller.js';
import { societyEmployeeHrService } from '../services/society-employee-hr.service.js';
import { hrLetterEmailService } from '../services/hr-letter-email.service.js';

export class SocietyEmployeeHrController extends BaseController {
  constructor() {
    super();
    this.createDailyWorkReport = this.catchAsync(this.createDailyWorkReport.bind(this));
    this.listDailyWorkReports = this.catchAsync(this.listDailyWorkReports.bind(this));
    this.exportDailyWorkReports = this.catchAsync(this.exportDailyWorkReports.bind(this));
    this.listKpaReports = this.catchAsync(this.listKpaReports.bind(this));
    this.exportKpaReports = this.catchAsync(this.exportKpaReports.bind(this));
    this.getKpaReportDetail = this.catchAsync(this.getKpaReportDetail.bind(this));
    this.addKpaTarget = this.catchAsync(this.addKpaTarget.bind(this));
    this.updateKpaTarget = this.catchAsync(this.updateKpaTarget.bind(this));
    this.getProductIncentives = this.catchAsync(this.getProductIncentives.bind(this));
    this.upsertProductIncentive = this.catchAsync(this.upsertProductIncentive.bind(this));
    this.listImportantDates = this.catchAsync(this.listImportantDates.bind(this));
    this.getEmployeeBreakdown = this.catchAsync(this.getEmployeeBreakdown.bind(this));
    this.listLetterHistory = this.catchAsync(this.listLetterHistory.bind(this));
    this.sendLetterEmail = this.catchAsync(this.sendLetterEmail.bind(this));

    // PDF generators
    this.generateOfferLetter = this.catchAsync(this.generateOfferLetter.bind(this));
    this.generateConfirmationLetter = this.catchAsync(this.generateConfirmationLetter.bind(this));
    this.generatePerformanceLetter = this.catchAsync(this.generatePerformanceLetter.bind(this));
    this.generatePromotionLetter = this.catchAsync(this.generatePromotionLetter.bind(this));
    this.generateTransferLetter = this.catchAsync(this.generateTransferLetter.bind(this));
    this.generateSalarySlip = this.catchAsync(this.generateSalarySlip.bind(this));
    this.generateSalaryIncrement = this.catchAsync(this.generateSalaryIncrement.bind(this));
    this.generateTerminationLetter = this.catchAsync(this.generateTerminationLetter.bind(this));

    // Bank Signature
    this.updateBankSignature = this.catchAsync(this.updateBankSignature.bind(this));
    this.getBankSignature = this.catchAsync(this.getBankSignature.bind(this));
  }

  async createDailyWorkReport(req, res, next) {
    const bankId = req.society.bankId;
    const creatorId = req.user.id;
    const result = await societyEmployeeHrService.createDailyWorkReport(bankId, req.body, creatorId);
    return this.sendCreated(res, result, 'Daily Work Report logged successfully.');
  }

  async listDailyWorkReports(req, res, next) {
    const bankId = req.society.bankId;
    const branchIdFilter = req.society.branchId || req.query.branchId || req.query.branchIds || null;
    const result = await societyEmployeeHrService.listDailyWorkReports(bankId, req.query, branchIdFilter);
    return this.sendResponse(res, 200, result, 'Daily Work Reports list retrieved successfully.');
  }

  async exportDailyWorkReports(req, res, next) {
    const bankId = req.society.bankId;
    const branchIdFilter = req.society.branchId || req.query.branchId || req.query.branchIds || null;
    const buffer = await societyEmployeeHrService.exportDailyWorkReports(bankId, req.query, branchIdFilter);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=daily_work_report.csv');
    return res.send(buffer);
  }

  async listKpaReports(req, res, next) {
    const bankId = req.society.bankId;
    const branchIdFilter = req.society.branchId || req.query.branchId || req.query.branchIds || null;
    const result = await societyEmployeeHrService.listKpaReports(bankId, req.query, branchIdFilter);
    return this.sendResponse(res, 200, result, 'KPA Employee list retrieved successfully.');
  }

  async exportKpaReports(req, res, next) {
    const bankId = req.society.bankId;
    const branchIdFilter = req.society.branchId || req.query.branchId || req.query.branchIds || null;
    const buffer = await societyEmployeeHrService.exportKpaReports(bankId, req.query, branchIdFilter);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=kpa_reports_overview.csv');
    return res.send(buffer);
  }

  async getKpaReportDetail(req, res, next) {
    const bankId = req.society.bankId;
    const employeeId = req.params.id;
    const branchIdFilter = req.society.branchId || req.query.branchId || req.query.branchIds || null;
    const result = await societyEmployeeHrService.getKpaReportDetail(bankId, employeeId, req.query, branchIdFilter);
    return this.sendResponse(res, 200, result, 'Employee KPA targets details retrieved successfully.');
  }

  async addKpaTarget(req, res, next) {
    const bankId = req.society.bankId;
    const employeeId = req.params.id || req.body.employeeId || req.body.id;
    const branchIdFilter = req.society.branchId || req.query.branchId || req.query.branchIds || null;
    const result = await societyEmployeeHrService.addKpaTarget(bankId, employeeId, req.body, branchIdFilter);
    return this.sendCreated(res, result, 'KPA performance target added successfully.');
  }

  async updateKpaTarget(req, res, next) {
    const bankId = req.society.bankId;
    const employeeId = req.params.id || req.body.employeeId || req.body.id;
    const branchIdFilter = req.society.branchId || req.query.branchId || req.query.branchIds || null;
    const result = await societyEmployeeHrService.updateKpaTarget(bankId, employeeId, req.body, branchIdFilter);
    return this.sendResponse(res, 200, result, 'KPA performance target updated successfully.');
  }

  async getProductIncentives(req, res, next) {
    const bankId = req.society.bankId;
    const result = await societyEmployeeHrService.getProductIncentives(bankId);
    return this.sendResponse(res, 200, result, 'Universal product incentives list retrieved successfully.');
  }

  async upsertProductIncentive(req, res, next) {
    const bankId = req.society.bankId;
    const result = await societyEmployeeHrService.upsertProductIncentive(bankId, req.body);
    return this.sendResponse(res, 200, result, 'Universal product incentive updated successfully.');
  }

  async listImportantDates(req, res, next) {
    const bankId = req.society.bankId;
    const branchIdFilter = req.society.branchId || req.query.branchId || req.query.branchIds || null;
    const result = await societyEmployeeHrService.listImportantDates(bankId, queryObjWithDefaults(req.query), branchIdFilter);
    return this.sendResponse(res, 200, result, 'Important Dates feed retrieved successfully.');
  }

  async getEmployeeBreakdown(req, res, next) {
    const bankId = req.society.bankId;
    const branchIdFilter = req.society.branchId || req.query.branchId || req.query.branchIds || null;
    const result = await societyEmployeeHrService.getEmployeeBreakdown(bankId, req.query, branchIdFilter);
    return this.sendResponse(res, 200, result, 'Employee breakdown statistics and list retrieved successfully.');
  }

  async listLetterHistory(req, res, next) {
    const bankId = req.society.bankId;
    const result = await societyEmployeeHrService.listLetterHistory(bankId, req.query, req.society);
    return this.sendPaginated(res, result.items, result.meta, 'Employee letter history logs retrieved successfully.');
  }

  // PDF download wrappers
  async generateOfferLetter(req, res, next) {
    const bankId = req.society.bankId;
    const result = await societyEmployeeHrService.generateOfferLetter(bankId, req.body, req.society);

    if (req.headers.accept === 'application/json' || req.query.format === 'json') {
      return this.sendResponse(res, 200, result.data, result.message);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Offer_Letter_${req.body.employeeId}.pdf`);
    if (result.data?.fileUrl) {
      res.setHeader('X-File-Url', result.data.fileUrl);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-File-Url');
    }
    return res.send(result.pdfBuffer || result);
  }

  async generateConfirmationLetter(req, res, next) {
    const bankId = req.society.bankId;
    const result = await societyEmployeeHrService.generateConfirmationLetter(bankId, req.body, req.society);

    if (req.headers.accept === 'application/json' || req.query.format === 'json') {
      return this.sendResponse(res, 200, result.data, result.message);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Confirmation_Letter_${req.body.employeeId}.pdf`);
    if (result.data?.fileUrl) {
      res.setHeader('X-File-Url', result.data.fileUrl);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-File-Url');
    }
    return res.send(result.pdfBuffer || result);
  }

  async generatePerformanceLetter(req, res, next) {
    const bankId = req.society.bankId;
    const result = await societyEmployeeHrService.generatePerformanceLetter(bankId, req.body, req.society);

    if (req.headers.accept === 'application/json' || req.query.format === 'json') {
      return this.sendResponse(res, 200, result.data, result.message);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Performance_Letter_${req.body.employeeId}.pdf`);
    if (result.data?.fileUrl) {
      res.setHeader('X-File-Url', result.data.fileUrl);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-File-Url');
    }
    return res.send(result.pdfBuffer || result);
  }

  async generatePromotionLetter(req, res, next) {
    const bankId = req.society.bankId;
    const result = await societyEmployeeHrService.generatePromotionLetter(bankId, req.body, req.society);

    if (req.headers.accept === 'application/json' || req.query.format === 'json') {
      return this.sendResponse(res, 200, result.data, result.message);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Promotion_Letter_${req.body.employeeId}.pdf`);
    if (result.data?.fileUrl) {
      res.setHeader('X-File-Url', result.data.fileUrl);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-File-Url');
    }
    return res.send(result.pdfBuffer || result);
  }

  async generateTransferLetter(req, res, next) {
    const bankId = req.society.bankId;
    const empId = req.body.employeeId || req.body.id;
    const result = await societyEmployeeHrService.generateTransferLetter(bankId, req.body, req.society);

    if (req.headers.accept === 'application/json' || req.query.format === 'json') {
      return this.sendResponse(res, 200, result.data, result.message);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Transfer_Letter_${empId}.pdf`);
    if (result.data?.fileUrl) {
      res.setHeader('X-File-Url', result.data.fileUrl);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-File-Url');
    }
    return res.send(result.pdfBuffer || result);
  }

  async generateSalarySlip(req, res, next) {
    const bankId = req.society.bankId;
    const empId = req.body.employeeId || req.body.id;
    const result = await societyEmployeeHrService.generateSalarySlip(bankId, req.body, req.society);

    if (req.headers.accept === 'application/json' || req.query.format === 'json') {
      return this.sendResponse(res, 200, result.data, result.message);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Salary_Slip_${empId}.pdf`);
    if (result.data?.fileUrl) {
      res.setHeader('X-File-Url', result.data.fileUrl);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-File-Url');
    }
    return res.send(result.pdfBuffer || result);
  }

  async generateSalaryIncrement(req, res, next) {
    const bankId = req.society.bankId;
    const empId = req.body.employeeId || req.body.id;
    const result = await societyEmployeeHrService.generateSalaryIncrement(bankId, req.body, req.society);

    if (req.headers.accept === 'application/json' || req.query.format === 'json') {
      return this.sendResponse(res, 200, result.data, result.message);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Salary_Increment_${empId}.pdf`);
    if (result.data?.fileUrl) {
      res.setHeader('X-File-Url', result.data.fileUrl);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-File-Url');
    }
    return res.send(result.pdfBuffer || result);
  }

  async generateTerminationLetter(req, res, next) {
    const bankId = req.society.bankId;
    const result = await societyEmployeeHrService.generateTerminationLetter(bankId, req.body, req.society);

    if (req.headers.accept === 'application/json' || req.query.format === 'json') {
      return this.sendResponse(res, 200, result.data, result.message);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Termination_Letter_${req.body.employeeId}.pdf`);
    if (result.data?.fileUrl) {
      res.setHeader('X-File-Url', result.data.fileUrl);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-File-Url');
    }
    return res.send(result.pdfBuffer || result);
  }

  async sendLetterEmail(req, res, next) {
    const bankId = req.society.bankId;
    const logId = req.params.logId || req.body.logId || null;
    const payload = {
      bankId,
      logId,
      employeeId: req.body.employeeId,
      documentTypeCode: req.body.documentTypeCode,
      customEmail: req.body.customEmail || req.body.email,
      customVariables: req.body.variables || {},
      societyContext: req.society
    };

    const result = await hrLetterEmailService.sendLetterEmail(payload);
    return this.sendResponse(res, 200, result.data, result.message);
  }

  async updateBankSignature(req, res, next) {
    const bankId = req.society.bankId;
    const file = req.file || (req.files && req.files.signature ? req.files.signature[0] : null);
    const result = await societyEmployeeHrService.updateBankSignature(bankId, req.body, file);
    return this.sendResponse(res, 200, result, 'Bank signature and authorized signatory profile updated successfully.');
  }

  async getBankSignature(req, res, next) {
    const bankId = req.society.bankId;
    const result = await societyEmployeeHrService.getBankSignature(bankId);
    return this.sendResponse(res, 200, result, 'Bank signature and authorized signatory profile retrieved successfully.');
  }
}

// Utility to parse array fields in query parameters (which may be a string or array)
function queryObjWithDefaults(query) {
  const q = { ...query };
  if (q.celebrationTypes) {
    if (!Array.isArray(q.celebrationTypes)) {
      q.celebrationTypes = q.celebrationTypes.split(',').map(s => s.trim());
    }
  }
  return q;
}

export const societyEmployeeHrController = new SocietyEmployeeHrController();
