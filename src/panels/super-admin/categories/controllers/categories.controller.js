import { BaseController } from '../../../../common/base.controller.js';
import { categoriesService } from '../services/categories.service.js';

export class CategoriesController extends BaseController {
  constructor() {
    super();
    this.listCategories = this.catchAsync(this.listCategories.bind(this));
    this.getCategoryById = this.catchAsync(this.getCategoryById.bind(this));
    this.createCategory = this.catchAsync(this.createCategory.bind(this));
    this.updateCategory = this.catchAsync(this.updateCategory.bind(this));
    this.deleteCategory = this.catchAsync(this.deleteCategory.bind(this));
    this.listCategoriesDropdown = this.catchAsync(this.listCategoriesDropdown.bind(this));
  }

  async listCategories(req, res, next) {
    const result = await categoriesService.listCategories(req.query);
    return this.sendPaginated(res, result.items, result.meta, 'Categories list retrieved successfully.');
  }

  async getCategoryById(req, res, next) {
    const result = await categoriesService.getCategoryById(req.params.id);
    return this.sendResponse(res, 200, result, 'Category details retrieved successfully.');
  }

  async createCategory(req, res, next) {
    const creatorId = req.user?.id || null;
    const result = await categoriesService.createCategory(req.body, req.file, creatorId);
    return this.sendCreated(res, result, 'Category created successfully.');
  }

  async updateCategory(req, res, next) {
    const updaterId = req.user?.id || null;
    const result = await categoriesService.updateCategory(req.params.id, req.body, req.file, updaterId);
    return this.sendResponse(res, 200, result, 'Category updated successfully.');
  }

  async deleteCategory(req, res, next) {
    const deleterId = req.user?.id || null;
    await categoriesService.deleteCategory(req.params.id, deleterId);
    return this.sendResponse(res, 200, null, 'Category deleted successfully.');
  }

  async listCategoriesDropdown(req, res, next) {
    const result = await categoriesService.listCategoriesDropdown();
    return this.sendResponse(res, 200, result, 'Active categories dropdown retrieved successfully.');
  }
}

export const categoriesController = new CategoriesController();
