import { BaseController } from '../../../../common/base.controller.js';
import { societyReportService } from '../services/society-report.service.js';

export class SocietyReportController extends BaseController {
  constructor() {
    super();
    this.getCatalog = this.getCatalog.bind(this);
    this.getReport = this.getReport.bind(this);
    this.exportReport = this.exportReport.bind(this);
  }

  async getCatalog(req, res, next) {
    try {
      const catalog = societyReportService.getReportCatalog(req.query);
      return this.sendResponse(res, 200, { catalog }, 'Report catalog retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getReport(req, res, next) {
    try {
      const { reportType } = req.params;
      const result = await societyReportService.generateReport(reportType, req.society, req.query);
      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: `${reportType} report generated successfully.`,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async exportReport(req, res, next) {
    try {
      const { reportType } = req.params;
      const format = String(req.query.format || 'csv').toLowerCase();
      const dateStr = new Date().toISOString().slice(0, 10);

      if (format === 'pdf') {
        const pdfBuffer = await societyReportService.exportReportPdf(reportType, req.society, req.query);
        const fileName = `society-report-${String(reportType).toLowerCase()}-${dateStr}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.status(200).send(pdfBuffer);
      }

      const csv = await societyReportService.exportReportCsv(reportType, req.society, req.query);
      const fileName = `society-report-${String(reportType).toLowerCase()}-${dateStr}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.status(200).send(csv);
    } catch (error) {
      next(error);
    }
  }
}

export const societyReportController = new SocietyReportController();
