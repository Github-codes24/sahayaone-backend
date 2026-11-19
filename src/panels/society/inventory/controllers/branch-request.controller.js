import { BaseController } from '../../../../common/base.controller.js';
import { branchRequestService } from '../services/branch-request.service.js';

export class BranchRequestController extends BaseController {
  constructor() {
    super();
    for (const method of [
      'createRequest',
      'listRequests',
      'getRequestById',
      'approveRequest',
      'rejectRequest',
      'cancelRequest',
      'fulfillRequest',
      'directIssue'
    ]) {
      this[method] = this[method].bind(this);
    }
  }

  async createRequest(req, res, next) {
    try {
      const request = await branchRequestService.createRequest(req.society, req.body);
      return this.sendCreated(res, request, 'Branch requisition created successfully.');
    } catch (error) {
      next(error);
    }
  }

  async listRequests(req, res, next) {
    try {
      const result = await branchRequestService.listRequests(req.society, req.query);
      return this.sendPaginated(res, result.items, result.meta, 'Branch requisitions retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getRequestById(req, res, next) {
    try {
      const request = await branchRequestService.getRequestById(req.society, req.params.id);
      return this.sendSuccess(res, request, 'Branch requisition details retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async approveRequest(req, res, next) {
    try {
      const request = await branchRequestService.approveRequest(req.society, req.params.id, req.body);
      return this.sendSuccess(res, request, 'Branch requisition approved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async rejectRequest(req, res, next) {
    try {
      const request = await branchRequestService.rejectRequest(req.society, req.params.id, req.body);
      return this.sendSuccess(res, request, 'Branch requisition rejected successfully.');
    } catch (error) {
      next(error);
    }
  }

  async cancelRequest(req, res, next) {
    try {
      const request = await branchRequestService.cancelRequest(req.society, req.params.id, req.body);
      return this.sendSuccess(res, request, 'Requisition request cancelled successfully.');
    } catch (error) {
      next(error);
    }
  }

  async fulfillRequest(req, res, next) {
    try {
      const result = await branchRequestService.fulfillRequest(req.society, req.params.id, req.body);
      return this.sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async directIssue(req, res, next) {
    try {
      const result = await branchRequestService.directIssue(req.society, req.body);
      return this.sendSuccess(res, result, 'Inventory stock/asset directly issued successfully.');
    } catch (error) {
      next(error);
    }
  }
}

export const branchRequestController = new BranchRequestController();
