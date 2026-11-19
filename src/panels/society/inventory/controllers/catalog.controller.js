import { BaseController } from '../../../../common/base.controller.js';
import { catalogService } from '../services/catalog.service.js';

export class CatalogController extends BaseController {
  constructor() {
    super();
    for (const method of [
      'createCategory',
      'getCategoryById',
      'updateCategory',
      'deleteCategory',
      'listCategories',
      'createSubcategory',
      'getSubcategoryById',
      'updateSubcategory',
      'deleteSubcategory',
      'listSubcategories',
      'createItem',
      'getItemById',
      'updateItem',
      'deleteItem',
      'listItems'
    ]) {
      this[method] = this[method].bind(this);
    }
  }

  // --- Categories ---
  async createCategory(req, res, next) {
    try {
      const category = await catalogService.createCategory(req.society, req.body);
      return this.sendCreated(res, category, 'Inventory category created successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getCategoryById(req, res, next) {
    try {
      const category = await catalogService.getCategoryById(req.society, req.params.id);
      return this.sendSuccess(res, category, 'Inventory category retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async updateCategory(req, res, next) {
    try {
      const category = await catalogService.updateCategory(req.society, req.params.id, req.body);
      return this.sendSuccess(res, category, 'Inventory category updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  async deleteCategory(req, res, next) {
    try {
      const result = await catalogService.deleteCategory(req.society, req.params.id);
      return this.sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async listCategories(req, res, next) {
    try {
      const result = await catalogService.listCategories(req.society, req.query);
      return this.sendPaginated(res, result.items, result.meta, 'Inventory categories retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  // --- Subcategories ---
  async createSubcategory(req, res, next) {
    try {
      const subcategory = await catalogService.createSubcategory(req.society, req.body);
      return this.sendCreated(res, subcategory, 'Inventory subcategory created successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getSubcategoryById(req, res, next) {
    try {
      const subcategory = await catalogService.getSubcategoryById(req.society, req.params.id);
      return this.sendSuccess(res, subcategory, 'Inventory subcategory retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async updateSubcategory(req, res, next) {
    try {
      const subcategory = await catalogService.updateSubcategory(req.society, req.params.id, req.body);
      return this.sendSuccess(res, subcategory, 'Inventory subcategory updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  async deleteSubcategory(req, res, next) {
    try {
      const result = await catalogService.deleteSubcategory(req.society, req.params.id);
      return this.sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async listSubcategories(req, res, next) {
    try {
      const result = await catalogService.listSubcategories(req.society, req.query);
      return this.sendPaginated(res, result.items, result.meta, 'Inventory subcategories retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  // --- Items ---
  async createItem(req, res, next) {
    try {
      const item = await catalogService.createItem(req.society, req.body);
      return this.sendCreated(res, item, 'Inventory SKU item created successfully.');
    } catch (error) {
      next(error);
    }
  }

  async getItemById(req, res, next) {
    try {
      const item = await catalogService.getItemById(req.society, req.params.id);
      return this.sendSuccess(res, item, 'Inventory SKU item retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }

  async updateItem(req, res, next) {
    try {
      const item = await catalogService.updateItem(req.society, req.params.id, req.body);
      return this.sendSuccess(res, item, 'Inventory SKU item updated successfully.');
    } catch (error) {
      next(error);
    }
  }

  async deleteItem(req, res, next) {
    try {
      const result = await catalogService.deleteItem(req.society, req.params.id);
      return this.sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  async listItems(req, res, next) {
    try {
      const result = await catalogService.listItems(req.society, req.query);
      return this.sendPaginated(res, result.items, result.meta, 'Inventory SKU items retrieved successfully.');
    } catch (error) {
      next(error);
    }
  }
}

export const catalogController = new CatalogController();

