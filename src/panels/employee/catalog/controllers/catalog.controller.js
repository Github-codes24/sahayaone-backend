import { BaseController } from '../../../../common/base.controller.js';
import { customerCatalogService } from '../../../customer-mobile/catalog/services/catalog.service.js';

export class EmployeeCatalogController extends BaseController {
  constructor() {
    super();
    this.getCatalogServices = this.catchAsync(this.getCatalogServices.bind(this));
    this.getCatalogCategories = this.catchAsync(this.getCatalogCategories.bind(this));
    this.getCatalogBrands = this.catchAsync(this.getCatalogBrands.bind(this));
    this.getCatalogProducts = this.catchAsync(this.getCatalogProducts.bind(this));
    this.getCatalogVariants = this.catchAsync(this.getCatalogVariants.bind(this));
  }

  async getCatalogServices(req, res, next) {
    const result = await customerCatalogService.getServices();
    return this.sendResponse(res, 200, result, 'Catalog services retrieved.');
  }

  async getCatalogCategories(req, res, next) {
    const result = await customerCatalogService.getLoanCategories();
    return this.sendResponse(res, 200, result, 'Catalog categories retrieved.');
  }

  async getCatalogBrands(req, res, next) {
    const result = await customerCatalogService.getBrands();
    return this.sendResponse(res, 200, result, 'Catalog brands retrieved.');
  }

  async getCatalogProducts(req, res, next) {
    const { brandId } = req.query;
    const result = await customerCatalogService.getProducts(brandId);
    return this.sendResponse(res, 200, result, 'Catalog products retrieved.');
  }

  async getCatalogVariants(req, res, next) {
    const { id } = req.params;
    const result = await customerCatalogService.getProductVariants(id);
    return this.sendResponse(res, 200, result, 'Catalog product variants retrieved.');
  }
}

export const employeeCatalogController = new EmployeeCatalogController();
