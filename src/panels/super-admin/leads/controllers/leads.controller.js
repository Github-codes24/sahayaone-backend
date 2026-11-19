import { BaseController } from '../../../../common/base.controller.js';
import { superAdminLeadsService } from '../services/leads.service.js';

export class SuperAdminLeadsController extends BaseController {
  constructor() {
    super();
    this.listLeads = this.catchAsync(this.listLeads.bind(this));
    this.getLeadById = this.catchAsync(this.getLeadById.bind(this));
    this.assignLead = this.catchAsync(this.assignLead.bind(this));
    this.assignBank = this.catchAsync(this.assignBank.bind(this));
    this.getFilterDropdowns = this.catchAsync(this.getFilterDropdowns.bind(this));
  }

  async listLeads(req, res, next) {
    const result = await superAdminLeadsService.listLeads(req.query);
    return this.sendPaginated(res, result.items, result.meta, 'Leads list retrieved successfully.');
  }

  async getLeadById(req, res, next) {
    const result = await superAdminLeadsService.getLeadById(req.params.id);
    return this.sendResponse(res, 200, result, 'Lead details retrieved successfully.');
  }

  async assignLead(req, res, next) {
    const assignerId = req.user?.id || null;
    const result = await superAdminLeadsService.assignLead(req.params.id, req.body.employeeId, assignerId);
    return this.sendResponse(res, 200, result, 'Lead assigned to employee successfully.');
  }

  async assignBank(req, res, next) {
    const result = await superAdminLeadsService.assignBank(req.params.id, req.body.bankId);
    return this.sendResponse(res, 200, result, 'Lead assigned to cooperative bank successfully.');
  }

  async getFilterDropdowns(req, res, next) {
    const result = await superAdminLeadsService.getFilterDropdowns();
    return this.sendResponse(res, 200, result, 'Filter dropdown options retrieved successfully.');
  }
}

export const superAdminLeadsController = new SuperAdminLeadsController();
