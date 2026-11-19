import { BaseController } from '../../../../common/base.controller.js';
import { productsService } from '../services/products.service.js';

export class ProductsController extends BaseController {
  constructor() {
    super();
    this.listProducts = this.catchAsync(this.listProducts.bind(this));
    this.getProductById = this.catchAsync(this.getProductById.bind(this));
    this.createProduct = this.catchAsync(this.createProduct.bind(this));
    this.updateProduct = this.catchAsync(this.updateProduct.bind(this));
    this.deleteProduct = this.catchAsync(this.deleteProduct.bind(this));
    this.listProductsDropdown = this.catchAsync(this.listProductsDropdown.bind(this));
  }

  async listProducts(req, res, next) {
    const result = await productsService.listProducts(req.query);
    return this.sendPaginated(res, result.items, result.meta, 'Products list retrieved successfully.');
  }

  async getProductById(req, res, next) {
    const result = await productsService.getProductById(req.params.id);
    return this.sendResponse(res, 200, result, 'Product details retrieved successfully.');
  }

  async createProduct(req, res, next) {
    const creatorId = req.user?.id || null;
    const result = await productsService.createProduct(req.body, req.file, creatorId);
    return this.sendCreated(res, result, 'Product created successfully.');
  }

  async updateProduct(req, res, next) {
    const updaterId = req.user?.id || null;
    const result = await productsService.updateProduct(req.params.id, req.body, req.file, updaterId);
    return this.sendResponse(res, 200, result, 'Product updated successfully.');
  }

  async deleteProduct(req, res, next) {
    const deleterId = req.user?.id || null;
    await productsService.deleteProduct(req.params.id, deleterId);
    return this.sendResponse(res, 200, null, 'Product deleted successfully.');
  }

  async listProductsDropdown(req, res, next) {
    const result = await productsService.listProductsDropdown(req.query);
    return this.sendResponse(res, 200, result, 'Active products dropdown retrieved successfully.');
  }
}

export const productsController = new ProductsController();
