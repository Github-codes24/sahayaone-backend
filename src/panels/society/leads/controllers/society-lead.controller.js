import { BaseController } from '../../../../common/base.controller.js';
import { societyLeadService } from '../services/society-lead.service.js';

export class SocietyLeadController extends BaseController {
  constructor() {
    super();
    this.list = this.catchAsync(this.list.bind(this));
    this.getById = this.catchAsync(this.getById.bind(this));
    this.remove = this.catchAsync(this.remove.bind(this));
    this.exportCsv = this.catchAsync(this.exportCsv.bind(this));
    this.getLocations = this.catchAsync(this.getLocations.bind(this));
  }

  async list(req, res) {
    const result = await societyLeadService.list(req.society, req.query);
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Leads retrieved successfully.',
      data: result.items,
      stats: result.stats,
      meta: result.meta
    });
  }

  async getLocations(req, res) {
    const result = await societyLeadService.getLocations(req.society);
    return this.sendResponse(res, 200, result, 'Locations dropdown retrieved successfully.');
  }

  async getById(req, res) {
    const result = await societyLeadService.getById(req.society, req.params.id);
    return this.sendResponse(res, 200, result, 'Lead retrieved successfully.');
  }

  async remove(req, res) {
    const result = await societyLeadService.remove(req.society, req.params.id, req.user.id);
    return this.sendResponse(res, 200, result, 'Lead deleted successfully.');
  }

  async exportCsv(req, res) {
    const csv = await societyLeadService.exportCsv(req.society, req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
    return res.status(200).send(csv);
  }
}

export const societyLeadController = new SocietyLeadController();
