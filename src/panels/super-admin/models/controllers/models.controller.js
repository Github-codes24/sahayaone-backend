import { BaseController } from '../../../../common/base.controller.js';
import { modelsService } from '../services/models.service.js';

export class ModelsController extends BaseController {
  constructor() {
    super();
    this.listModels = this.catchAsync(this.listModels.bind(this));
    this.getModelById = this.catchAsync(this.getModelById.bind(this));
    this.createModel = this.catchAsync(this.createModel.bind(this));
    this.updateModel = this.catchAsync(this.updateModel.bind(this));
    this.deleteModel = this.catchAsync(this.deleteModel.bind(this));
  }

  async listModels(req, res, next) {
    const result = await modelsService.listModels(req.query);
    return this.sendPaginated(res, result.items, result.meta, 'Models list retrieved successfully.');
  }

  async getModelById(req, res, next) {
    const result = await modelsService.getModelById(req.params.id);
    return this.sendResponse(res, 200, result, 'Model details retrieved successfully.');
  }

  async createModel(req, res, next) {
    const creatorId = req.user?.id || null;
    const result = await modelsService.createModel(req.body, req.file, creatorId);
    return this.sendCreated(res, result, 'Model created successfully.');
  }

  async updateModel(req, res, next) {
    const updaterId = req.user?.id || null;
    const result = await modelsService.updateModel(req.params.id, req.body, req.file, updaterId);
    return this.sendResponse(res, 200, result, 'Model updated successfully.');
  }

  async deleteModel(req, res, next) {
    const deleterId = req.user?.id || null;
    await modelsService.deleteModel(req.params.id, deleterId);
    return this.sendResponse(res, 200, null, 'Model deleted successfully.');
  }
}

export const modelsController = new ModelsController();
