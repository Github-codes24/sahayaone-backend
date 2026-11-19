import { BaseController } from '../../../../common/base.controller.js';
import { customerCatalogService } from '../../../customer-mobile/catalog/services/catalog.service.js';

export class MerchantCatalogController extends BaseController {
  constructor() {
    super();
    this.getCatalogBrands = this.catchAsync(this.getCatalogBrands.bind(this));
    this.getCatalogProducts = this.catchAsync(this.getCatalogProducts.bind(this));
    this.getCatalogVariants = this.catchAsync(this.getCatalogVariants.bind(this));
  }

  /**
   * 7. GET CATALOG BRANDS
   */
  async getCatalogBrands(req, res, next) {
    const result = await customerCatalogService.getBrands();
    return this.sendResponse(res, 200, result, 'Brands fetched successfully.');
  }

  /**
   * 8. GET CATALOG PRODUCTS
   */
  async getCatalogProducts(req, res, next) {
    const { brandId } = req.query;
    const result = await customerCatalogService.getProducts(brandId);
    return this.sendResponse(res, 200, result, 'Products fetched successfully.');
  }

  /**
   * 9. GET CATALOG PRODUCT VARIANTS
   */
  async getCatalogVariants(req, res, next) {
    const { id } = req.params;
    const result = await customerCatalogService.getProductVariants(id);
    return this.sendResponse(res, 200, result, 'Product variants fetched successfully.');
  }
}

export const merchantCatalogController = new MerchantCatalogController();
