import { BaseController } from '../../../../common/base.controller.js';
import { brandsService } from '../services/brands.service.js';

export class BrandsController extends BaseController {
  constructor() {
    super();
    this.listBrands = this.catchAsync(this.listBrands.bind(this));
    this.getBrandById = this.catchAsync(this.getBrandById.bind(this));
    this.createBrand = this.catchAsync(this.createBrand.bind(this));
    this.updateBrand = this.catchAsync(this.updateBrand.bind(this));
    this.deleteBrand = this.catchAsync(this.deleteBrand.bind(this));
    this.listBrandsDropdown = this.catchAsync(this.listBrandsDropdown.bind(this));
  }

  async listBrands(req, res, next) {
    const result = await brandsService.listBrands(req.query);
    return this.sendPaginated(res, result.items, result.meta, 'Brands list retrieved successfully.');
  }

  async getBrandById(req, res, next) {
    const result = await brandsService.getBrandById(req.params.id);
    return this.sendResponse(res, 200, result, 'Brand details retrieved successfully.');
  }

  async createBrand(req, res, next) {
    const creatorId = req.user?.id || null;
    const result = await brandsService.createBrand(req.body, req.file, creatorId);
    return this.sendCreated(res, result, 'Brand created successfully.');
  }

  async updateBrand(req, res, next) {
    const updaterId = req.user?.id || null;
    const result = await brandsService.updateBrand(req.params.id, req.body, req.file, updaterId);
    return this.sendResponse(res, 200, result, 'Brand updated successfully.');
  }

  async deleteBrand(req, res, next) {
    const deleterId = req.user?.id || null;
    await brandsService.deleteBrand(req.params.id, deleterId);
    return this.sendResponse(res, 200, null, 'Brand deleted successfully.');
  }

  async listBrandsDropdown(req, res, next) {
    const result = await brandsService.listBrandsDropdown(req.query);
    return this.sendResponse(res, 200, result, 'Active brands dropdown retrieved successfully.');
  }
}

export const brandsController = new BrandsController();
