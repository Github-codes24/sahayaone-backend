import { Banner } from '../../../../models/banner.model.js';
import { storageManager } from '../../../../storage/storage.manager.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';

export class BannersService {
  /**
   * Retrieves a paginated list of banners
   */
  async listBanners(queryOptions) {
    const page = parseInt(queryOptions.page || '1', 10);
    const limit = parseInt(queryOptions.limit || '10', 10);
    const search = queryOptions.search || '';
    const skip = (page - 1) * limit;

    const filter = {
      isDeleted: { $ne: true }
    };

    if (queryOptions.portalType) {
      filter.portalType = queryOptions.portalType;
    }

    if (queryOptions.bannerType) {
      filter.bannerType = queryOptions.bannerType;
    }

    if (queryOptions.status) {
      filter.status = queryOptions.status;
    }

    if (search) {
      filter.$or = [
        { portalType: { $regex: search, $options: 'i' } },
        { bannerType: { $regex: search, $options: 'i' } }
      ];
    }

    const [items, totalRecords] = await Promise.all([
      Banner.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Banner.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalRecords / limit);

    return {
      items,
      meta: {
        totalRecords,
        limit,
        page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    };
  }

  /**
   * Retrieves details of a specific banner by ID
   */
  async getBannerById(id) {
    const banner = await Banner.findOne({
      _id: id,
      isDeleted: { $ne: true }
    }).lean();

    if (!banner) {
      throw ApiError.notFound('Banner not found in system storage.');
    }

    return banner;
  }

  /**
   * Creates a new banner record
   */
  async createBanner(payload, file, creatorId) {
    if (!file) {
      throw ApiError.badRequest('Banner image file is required.', ErrorCode.VALIDATION_ERROR);
    }

    const { portalType, bannerType } = payload;
    const normalizedPortalType = String(portalType || '').trim().toUpperCase();

    // Upload file to S3
    const uploadResult = await storageManager.uploadFile(file);
    if (!uploadResult || !uploadResult.fileUrl) {
      throw ApiError.internal('Failed to upload banner image to remote storage.');
    }

    const banner = new Banner({
      portalType: normalizedPortalType,
      bannerType,
      imageUrl: uploadResult.fileUrl,
      imageKey: uploadResult.filePath,
      status: 'ACTIVE',
      createdBy: creatorId
    });

    await banner.save();
    return banner;
  }

  /**
   * Updates an existing banner record
   */
  async updateBanner(id, payload, file, updaterId) {
    const banner = await Banner.findOne({
      _id: id,
      isDeleted: { $ne: true }
    });

    if (!banner) {
      throw ApiError.notFound('Banner not found for updates.');
    }

    const { portalType, bannerType, status } = payload;

    if (portalType) {
      banner.portalType = String(portalType).trim().toUpperCase();
    }

    if (bannerType) {
      banner.bannerType = bannerType;
    }

    if (status) {
      banner.status = status;
    }

    // If a new image is provided, upload it and delete the old one
    if (file) {
      const oldImageKey = banner.imageKey;

      // Upload new file
      const uploadResult = await storageManager.uploadFile(file);
      if (!uploadResult || !uploadResult.fileUrl) {
        throw ApiError.internal('Failed to upload new banner image to remote storage.');
      }

      banner.imageUrl = uploadResult.fileUrl;
      banner.imageKey = uploadResult.filePath;

      // Safe clean up of the old S3 object
      if (oldImageKey) {
        try {
          await storageManager.deleteFile(oldImageKey);
        } catch (err) {
          // Log and proceed so we don't block updates if deletion fails
          console.error(`Failed to delete old S3 object ${oldImageKey}: ${err.message}`);
        }
      }
    }

    banner.updatedBy = updaterId;
    await banner.save();

    return banner;
  }

  /**
   * Soft deletes a banner record and removes image from S3
   */
  async deleteBanner(id, deleterId) {
    const banner = await Banner.findOne({
      _id: id,
      isDeleted: { $ne: true }
    });

    if (!banner) {
      throw ApiError.notFound('Banner not found for deletion.');
    }

    // Delete S3 object
    if (banner.imageKey) {
      try {
        await storageManager.deleteFile(banner.imageKey);
      } catch (err) {
        // Log delete failure but still proceed with DB deletion
        console.error(`Failed to delete S3 object ${banner.imageKey} on banner deletion: ${err.message}`);
      }
    }

    banner.isDeleted = true;
    banner.deletedAt = new Date();
    banner.deletedBy = deleterId;
    await banner.save();

    return banner;
  }
}

export const bannersService = new BannersService();
