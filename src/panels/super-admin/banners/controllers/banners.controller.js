import { BaseController } from '../../../../common/base.controller.js';
import { bannersService } from '../services/banners.service.js';

export class BannersController extends BaseController {
  constructor() {
    super();
    this.listBanners = this.catchAsync(this.listBanners.bind(this));
    this.getBannerById = this.catchAsync(this.getBannerById.bind(this));
    this.createBanner = this.catchAsync(this.createBanner.bind(this));
    this.updateBanner = this.catchAsync(this.updateBanner.bind(this));
    this.deleteBanner = this.catchAsync(this.deleteBanner.bind(this));
  }

  /**
   * HTTP Handler to retrieve list of banners
   */
  async listBanners(req, res, next) {
    const result = await bannersService.listBanners(req.query);
    return this.sendPaginated(res, result.items, result.meta, 'Banners list retrieved successfully.');
  }

  /**
   * HTTP Handler to retrieve details of a specific banner
   */
  async getBannerById(req, res, next) {
    const result = await bannersService.getBannerById(req.params.id);
    return this.sendResponse(res, 200, result, 'Banner details retrieved successfully.');
  }

  /**
   * HTTP Handler to create a new banner
   */
  async createBanner(req, res, next) {
    const creatorId = req.user?.id || null;
    const result = await bannersService.createBanner(req.body, req.file, creatorId);
    return this.sendCreated(res, result, 'Banner created successfully.');
  }

  /**
   * HTTP Handler to update a banner
   */
  async updateBanner(req, res, next) {
    const updaterId = req.user?.id || null;
    const result = await bannersService.updateBanner(req.params.id, req.body, req.file, updaterId);
    return this.sendResponse(res, 200, result, 'Banner updated successfully.');
  }

  /**
   * HTTP Handler to delete a banner
   */
  async deleteBanner(req, res, next) {
    const deleterId = req.user?.id || null;
    await bannersService.deleteBanner(req.params.id, deleterId);
    return this.sendResponse(res, 200, null, 'Banner deleted successfully.');
  }
}

export const bannersController = new BannersController();
