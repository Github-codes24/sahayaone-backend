import { BaseController } from '../../../../common/base.controller.js';
import { customerCatalogService } from '../services/catalog.service.js';

export class CustomerCatalogController extends BaseController {
  constructor() {
    super();
    this.getBanners = this.catchAsync(this.getBanners.bind(this));
    this.getServices = this.catchAsync(this.getServices.bind(this));
    this.getLoanCategories = this.catchAsync(this.getLoanCategories.bind(this));
    this.getBrands = this.catchAsync(this.getBrands.bind(this));
    this.getProducts = this.catchAsync(this.getProducts.bind(this));
    this.getProductVariants = this.catchAsync(this.getProductVariants.bind(this));
    this.search = this.catchAsync(this.search.bind(this));
  }

  async getBanners(req, res, next) {
    const result = await customerCatalogService.getBanners(req.query);
    return this.sendResponse(res, 200, result, 'Customer banners retrieved successfully.');
  }

  async getServices(req, res, next) {
    const result = await customerCatalogService.getServices();
    return this.sendResponse(res, 200, result, 'Services menu list retrieved successfully.');
  }

  async getLoanCategories(req, res, next) {
    const result = await customerCatalogService.getLoanCategories();
    return this.sendResponse(res, 200, result, 'Loan categories list retrieved successfully.');
  }

  async getBrands(req, res, next) {
    const result = await customerCatalogService.getBrands();
    return this.sendResponse(res, 200, result, 'Brands list retrieved successfully.');
  }

  async getProducts(req, res, next) {
    const { brandId } = req.query;
    const result = await customerCatalogService.getProducts(brandId);
    return this.sendResponse(res, 200, result, 'Products retrieved successfully.');
  }

  async getProductVariants(req, res, next) {
    const { id } = req.params;
    const result = await customerCatalogService.getProductVariants(id);
    return this.sendResponse(res, 200, result, 'Variants retrieved successfully.');
  }

  async search(req, res, next) {
    const { q } = req.query;
    const result = await customerCatalogService.searchCatalog(q);
    return this.sendResponse(res, 200, result, 'Search results retrieved successfully.');
  }
}

export const customerCatalogController = new CustomerCatalogController();
