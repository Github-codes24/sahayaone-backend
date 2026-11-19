import { Category } from '../../../../models/category.model.js';
import { Brand } from '../../../../models/brand.model.js';
import { Product } from '../../../../models/product.model.js';
import { Variant } from '../../../../models/variant.model.js';
import { storageManager } from '../../../../storage/storage.manager.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';

export class CategoriesService {
  /**
   * Retrieves a paginated list of categories with total brands & models counts
   */
  async listCategories(queryOptions) {
    const page = parseInt(queryOptions.page || '1', 10);
    const limit = parseInt(queryOptions.limit || '10', 10);
    const search = queryOptions.search || '';
    const skip = (page - 1) * limit;

    const filter = {
      isDeleted: { $ne: true }
    };

    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    const [itemsRaw, totalRecords] = await Promise.all([
      Category.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Category.countDocuments(filter)
    ]);

    const categoryNames = itemsRaw.map((item) => item.name);

    let brandCounts = [];
    let modelCounts = [];

    if (categoryNames.length > 0) {
      [brandCounts, modelCounts] = await Promise.all([
        Brand.aggregate([
          { $match: { isDeleted: { $ne: true } } },
          { $unwind: '$categoryNames' },
          { $match: { categoryNames: { $in: categoryNames } } },
          { $group: { _id: '$categoryNames', count: { $addToSet: '$name' } } },
          { $project: { _id: 1, count: { $size: '$count' } } }
        ]),
        Product.aggregate([
          { $match: { category: { $in: categoryNames }, isDeleted: { $ne: true } } },
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
          { $group: { _id: '$category', count: { $sum: 1 } } }
        ])
      ]);
    }

    const brandCountMap = brandCounts.reduce((map, item) => {
      map[item._id] = item.count;
      return map;
    }, {});

    const modelCountMap = modelCounts.reduce((map, item) => {
      map[item._id] = item.count;
      return map;
    }, {});

    const items = itemsRaw.map((item) => ({
      ...item,
      totalBrands: brandCountMap[item.name] || 0,
      totalModels: modelCountMap[item.name] || 0
    }));

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
   * Retrieves category by ID
   */
  async getCategoryById(id) {
    const category = await Category.findOne({
      _id: id,
      isDeleted: { $ne: true }
    }).lean();

    if (!category) {
      throw ApiError.notFound('Category not found.');
    }

    return category;
  }

  /**
   * Creates a new category
   */
  async createCategory(payload, file, creatorId) {
    if (!file) {
      throw ApiError.badRequest('Category image is required.', ErrorCode.VALIDATION_ERROR);
    }

    const name = payload.name?.trim();

    const existing = await Category.findOne({
      name: { $regex: `^${name}$`, $options: 'i' },
      isDeleted: { $ne: true }
    });

    if (existing) {
      throw ApiError.conflict('Category with this name already exists.', ErrorCode.VALIDATION_ERROR);
    }

    const uploadResult = await storageManager.uploadFile(file);
    if (!uploadResult || !uploadResult.fileUrl) {
      throw ApiError.internal('Failed to upload category image.');
    }

    const category = new Category({
      name,
      image: uploadResult.fileUrl,
      createdBy: creatorId
    });

    await category.save();
    return category;
  }

  /**
   * Updates an existing category
   */
  async updateCategory(id, payload, file, updaterId) {
    const category = await Category.findOne({
      _id: id,
      isDeleted: { $ne: true }
    });

    if (!category) {
      throw ApiError.notFound('Category not found.');
    }

    if (payload.name) {
      const name = payload.name.trim();
      if (name.toLowerCase() !== category.name.toLowerCase()) {
        const existing = await Category.findOne({
          name: { $regex: `^${name}$`, $options: 'i' },
          isDeleted: { $ne: true }
        });

        if (existing) {
          throw ApiError.conflict('Category with this name already exists.', ErrorCode.VALIDATION_ERROR);
        }
      }
      category.name = name;
    }

    if (file) {
      const uploadResult = await storageManager.uploadFile(file);
      if (!uploadResult || !uploadResult.fileUrl) {
        throw ApiError.internal('Failed to upload new category image.');
      }
      category.image = uploadResult.fileUrl;
    }

    category.updatedBy = updaterId;
    await category.save();

    return category;
  }

  /**
   * Soft deletes a category
   */
  async deleteCategory(id, deleterId) {
    const category = await Category.findOne({
      _id: id,
      isDeleted: { $ne: true }
    });

    if (!category) {
      throw ApiError.notFound('Category not found for deletion.');
    }

    category.isDeleted = true;
    category.deletedAt = new Date();
    category.deletedBy = deleterId;
    await category.save();

    return category;
  }

  /**
   * Retrieves active categories for dropdown
   */
  async listCategoriesDropdown() {
    return Category.find({
      isDeleted: { $ne: true }
    })
      .select('_id name image')
      .sort({ name: 1 })
      .lean();
  }
}

export const categoriesService = new CategoriesService();
