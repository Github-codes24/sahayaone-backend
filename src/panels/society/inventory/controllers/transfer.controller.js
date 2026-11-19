import { BaseController } from '../../../../common/base.controller.js';
import { transferService } from '../services/transfer.service.js';

export class TransferController extends BaseController {
  constructor() {
    super();
    for (const method of [
      'createTransfer',
      'listTransfers',
      'getTransferById',
      'approveTransfer',
      'rejectTransfer',
      'dispatchTransfer',
      'receiveTransfer'
    ]) {
      this[method] = this[method].bind(this);
    }
  }

  async createTransfer(req, res, next) {
    try {
      const transfer = await transferService.createTransfer(req.society, req.body);
      return this.sendCreated(res, transfer, 'Inter-location transfer request created successfully.');
    } catch (error) {
      next(error);
    }
  }

  async listTransfers(req, res, next) {
    try {
      const result = await transferService.listTransfers(req.society, req.query);
      return this.sendPaginated(res, result.items, result.meta, 'Transfers retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getTransferById(req, res, next) {
    try {
      const transfer = await transferService.getTransferById(req.society, req.params.id);
      return this.sendSuccess(res, transfer, 'Transfer details retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async approveTransfer(req, res, next) {
    try {
      const transfer = await transferService.approveTransfer(req.society, req.params.id, req.body);
      return this.sendSuccess(res, transfer, 'Transfer approved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async rejectTransfer(req, res, next) {
    try {
      const transfer = await transferService.rejectTransfer(req.society, req.params.id, req.body);
      return this.sendSuccess(res, transfer, 'Transfer rejected successfully.');
    } catch (error) {
      next(error);
    }
  }

  async dispatchTransfer(req, res, next) {
    try {
      const transfer = await transferService.dispatchTransfer(req.society, req.params.id, req.body);
      return this.sendSuccess(res, transfer, 'Transfer dispatched successfully from origin.');
    } catch (error) {
      next(error);
    }
  }

  async receiveTransfer(req, res, next) {
    try {
      const transfer = await transferService.receiveTransfer(req.society, req.params.id, req.body);
      return this.sendSuccess(res, transfer, 'Transfer received successfully at destination.');
    } catch (error) {
      next(error);
    }
  }
}

export const transferController = new TransferController();
