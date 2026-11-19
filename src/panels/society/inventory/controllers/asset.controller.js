import { BaseController } from '../../../../common/base.controller.js';
import { assetService } from '../services/asset.service.js';

export class AssetController extends BaseController {
  constructor() {
    super();
    for (const method of [
      'createAsset',
      'listAssets',
      'getAssetById',
      'assignAsset',
      'returnAsset',
      'reportDamage',
      'repairComplete',
      'requestDisposal',
      'approveDisposal',
      'reportLost',
      'recoverAsset'
    ]) {
      this[method] = this[method].bind(this);
    }
  }

  async createAsset(req, res, next) {
    try {
      const asset = await assetService.createAsset(req.society, req.body);
      return this.sendCreated(res, asset, 'Asset registered successfully.');
    } catch (error) {
      next(error);
    }
  }

  async listAssets(req, res, next) {
    try {
      const result = await assetService.listAssets(req.society, req.query);
      return this.sendPaginated(res, result.items, result.meta, 'Assets retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getAssetById(req, res, next) {
    try {
      const asset = await assetService.getAssetById(req.society, req.params.id);
      return this.sendSuccess(res, asset, 'Asset details and lifecycle history retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async assignAsset(req, res, next) {
    try {
      const result = await assetService.assignAsset(req.society, req.body);
      return this.sendSuccess(res, result, 'Asset assigned to employee successfully.');
    } catch (error) {
      next(error);
    }
  }

  async returnAsset(req, res, next) {
    try {
      const asset = await assetService.returnAsset(req.society, req.params.id, req.body);
      return this.sendSuccess(res, asset, 'Asset returned and restored to available inventory.');
    } catch (error) {
      next(error);
    }
  }

  async reportDamage(req, res, next) {
    try {
      const asset = await assetService.reportDamage(req.society, req.params.id, req.body);
      return this.sendSuccess(res, asset, 'Asset marked as damaged and moved to maintenance.');
    } catch (error) {
      next(error);
    }
  }

  async repairComplete(req, res, next) {
    try {
      const asset = await assetService.repairComplete(req.society, req.params.id, req.body);
      return this.sendSuccess(res, asset, 'Asset repair completed and restored to available inventory.');
    } catch (error) {
      next(error);
    }
  }

  async requestDisposal(req, res, next) {
    try {
      const result = await assetService.requestDisposal(req.society, req.params.id, req.body);
      return this.sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async approveDisposal(req, res, next) {
    try {
      const asset = await assetService.approveDisposal(req.society, req.params.id, req.body);
      return this.sendSuccess(res, asset, 'Asset disposal approved and marked as scrapped/retired.');
    } catch (error) {
      next(error);
    }
  }

  async reportLost(req, res, next) {
    try {
      const asset = await assetService.reportLost(req.society, req.params.id, req.body);
      return this.sendSuccess(res, asset, 'Asset reported lost and moved under investigation.');
    } catch (error) {
      next(error);
    }
  }

  async recoverAsset(req, res, next) {
    try {
      const asset = await assetService.recoverAsset(req.society, req.params.id, req.body);
      return this.sendSuccess(res, asset, 'Asset recovered and restored to active inventory.');
    } catch (error) {
      next(error);
    }
  }
}

export const assetController = new AssetController();
