import { Brand } from '../../../../models/brand.model.js';
import { Product } from '../../../../models/product.model.js';
import { storageManager } from '../../../../storage/storage.manager.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';

export class BrandsService {
  /**
   * Retrieves a paginated list of brands, unwinding categories and computing model counts
   */
  async listBrands(queryOptions) {
    const page = parseInt(queryOptions.page || '1', 10);
    const limit = parseInt(queryOptions.limit || '10', 10);
    const search = queryOptions.search || '';
    const skip = (page - 1) * limit;

    const matchFilter = { isDeleted: { $ne: true } };

    if (search) {
      matchFilter.name = { $regex: search, $options: 'i' };
    }

    let categoryFilter = null;
    if (queryOptions.category) {
      if (Array.isArray(queryOptions.category)) {
        categoryFilter = { $in: queryOptions.category };
      } else if (typeof queryOptions.category === 'string' && queryOptions.category.includes(',')) {
        categoryFilter = { $in: queryOptions.category.split(',') };
      } else {
        categoryFilter = queryOptions.category;
      }
    }

    const pipeline = [
      { $match: matchFilter },
      {
        $project: {
          name: 1,
          logo: 1,
          createdAt: 1,
          categoryNames: {
            $cond: {
              if: { $gt: [{ $size: { $ifNull: ['$categoryNames', []] } }, 0] },
              then: '$categoryNames',
              else: [null]
            }
          }
        }
      },
      { $unwind: '$categoryNames' }
    ];

    if (categoryFilter) {
      pipeline.push({ $match: { categoryNames: categoryFilter } });
    }

    const countPipeline = [...pipeline, { $count: 'totalRecords' }];
    const countResult = await Brand.aggregate(countPipeline);
    const totalRecords = countResult[0]?.totalRecords || 0;

    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    const itemsRaw = await Brand.aggregate(pipeline);

    const brandIds = itemsRaw.map((b) => b._id);

    let modelCounts = [];
    if (brandIds.length > 0) {
      modelCounts = await Product.aggregate([
        {
          $match: {
            brandId: { $in: brandIds },
            isDeleted: { $ne: true }
          }
        },
        {
          $lookup: {
            from: 'variants',
            localField: '_id',
            foreignField: 'productId',
            as: 'variants'
          }
        },
        { $unwind: '$variants' },
        { $match: { 'variants.isDeleted': { $ne: true } } },
        {
          $group: {
            _id: { brandId: '$brandId', category: '$category' },
            count: { $sum: 1 }
          }
        }
      ]);
    }

    const countMap = modelCounts.reduce((map, item) => {
      const key = `${item._id.brandId.toString()}_${item._id.category}`;
      map[key] = item.count;
      return map;
    }, {});

    const items = itemsRaw.map((item) => {
      const categoryName = item.categoryNames || null;
      const key = `${item._id.toString()}_${categoryName || ''}`;
      return {
        _id: item._id,
        name: item.name,
        logo: item.logo,
        category: categoryName,
        totalModels: countMap[key] || 0,
        createdAt: item.createdAt
      };
    });

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
   * Retrieves detailed brand by ID
   */
  async getBrandById(id) {
    const brand = await Brand.findOne({
      _id: id,
      isDeleted: { $ne: true }
    }).lean();

    if (!brand) {
      throw ApiError.notFound('Brand not found.');
    }

    return brand;
  }

  /**
   * Creates a new brand or associates a new category to an existing brand
   */
  async createBrand(payload, file, creatorId) {
    const name = payload.name?.trim();
    const category = payload.category?.trim();

    let brand = await Brand.findOne({
      name: { $regex: `^${name}$`, $options: 'i' },
      isDeleted: { $ne: true }
    });

    if (!brand) {
      if (!file) {
        throw ApiError.badRequest('Brand logo image is required when creating a new brand.', ErrorCode.VALIDATION_ERROR);
      }

      const uploadResult = await storageManager.uploadFile(file);
      if (!uploadResult || !uploadResult.fileUrl) {
        throw ApiError.internal('Failed to upload brand logo image.');
      }

      brand = new Brand({
        name,
        logo: uploadResult.fileUrl,
        categoryNames: category ? [category] : [],
        createdBy: creatorId
      });
    } else {
      if (category) {
        if (brand.categoryNames.includes(category)) {
          throw ApiError.conflict('Brand with this name already exists in this category.', ErrorCode.VALIDATION_ERROR);
        }
        brand.categoryNames.push(category);
      }

      if (file) {
        const uploadResult = await storageManager.uploadFile(file);
        if (uploadResult && uploadResult.fileUrl) {
          brand.logo = uploadResult.fileUrl;
        }
      }
    }

    await brand.save();
    return brand;
  }

  /**
   * Updates an existing brand
   */
  async updateBrand(id, payload, file, updaterId) {
    const brand = await Brand.findOne({
      _id: id,
      isDeleted: { $ne: true }
    });

    if (!brand) {
      throw ApiError.notFound('Brand not found.');
    }

    if (payload.name) {
      const name = payload.name.trim();
      if (name.toLowerCase() !== brand.name.toLowerCase()) {
        const existing = await Brand.findOne({
          name: { $regex: `^${name}$`, $options: 'i' },
          isDeleted: { $ne: true }
        });

        if (existing) {
          throw ApiError.conflict('Another brand with this name already exists.', ErrorCode.VALIDATION_ERROR);
        }
      }
      brand.name = name;
    }

    if (payload.category) {
      const cat = payload.category.trim();
      if (!brand.categoryNames.includes(cat)) {
        brand.categoryNames.push(cat);
      }
    }

    if (file) {
      const uploadResult = await storageManager.uploadFile(file);
      if (uploadResult && uploadResult.fileUrl) {
        brand.logo = uploadResult.fileUrl;
      }
    }

    brand.updatedBy = updaterId;
    await brand.save();

    return brand;
  }

  /**
   * Soft deletes a brand
   */
  async deleteBrand(id, deleterId) {
    const brand = await Brand.findOne({
      _id: id,
      isDeleted: { $ne: true }
    });

    if (!brand) {
      throw ApiError.notFound('Brand not found for deletion.');
    }

    brand.isDeleted = true;
    brand.deletedAt = new Date();
    brand.deletedBy = deleterId;
    await brand.save();

    return brand;
  }

  /**
   * Retrieves active brands for dropdown filter
   */
  async listBrandsDropdown(queryOptions) {
    const filter = {
      isDeleted: { $ne: true }
    };

    if (queryOptions.category) {
      filter.categoryNames = queryOptions.category;
    }

    return Brand.find(filter)
      .select('_id name logo categoryNames')
      .sort({ name: 1 })
      .lean();
  }
}

export const brandsService = new BrandsService();
