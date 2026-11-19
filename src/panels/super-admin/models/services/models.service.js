import { Variant } from '../../../../models/variant.model.js';
import { Product } from '../../../../models/product.model.js';
import { storageManager } from '../../../../storage/storage.manager.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';

export class ModelsService {
  /**
   * Retrieves a paginated list of models (variants), supporting category/brand/product filters and searches
   */
  async listModels(queryOptions) {
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

    if (queryOptions.productId) {
      if (Array.isArray(queryOptions.productId)) {
        filter.productId = { $in: queryOptions.productId };
      } else if (typeof queryOptions.productId === 'string' && queryOptions.productId.includes(',')) {
        filter.productId = { $in: queryOptions.productId.split(',') };
      } else {
        filter.productId = queryOptions.productId;
      }
    }

    let productFilter = {};
    if (queryOptions.brandId) {
      productFilter.brandId = queryOptions.brandId;
    }
    if (queryOptions.category) {
      productFilter.category = queryOptions.category;
    }

    if (Object.keys(productFilter).length > 0) {
      productFilter.isDeleted = { $ne: true };
      const matchingProducts = await Product.find(productFilter).select('_id').lean();
      const productIds = matchingProducts.map((p) => p._id);
      filter.productId = { $in: productIds };
    }

    const [itemsRaw, totalRecords] = await Promise.all([
      Variant.find(filter)
        .populate({
          path: 'productId',
          select: 'name category brandId',
          populate: {
            path: 'brandId',
            select: 'name logo'
          }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Variant.countDocuments(filter)
    ]);

    const items = itemsRaw.map((v) => {
      const product = v.productId || {};
      const brand = product.brandId || {};
      return {
        _id: v._id,
        name: v.name,
        description: v.description || '',
        brand: brand.name || '',
        product: product.name || '',
        category: product.category || '',
        image: v.image,
        color: v.color,
        storage: v.storage,
        warranty: v.warranty,
        price: v.price,
        createdAt: v.createdAt
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
   * Retrieves model (variant) by ID
   */
  async getModelById(id) {
    const variant = await Variant.findOne({
      _id: id,
      isDeleted: { $ne: true }
    })
      .populate({
        path: 'productId',
        select: 'name category brandId',
        populate: {
          path: 'brandId',
          select: 'name logo'
        }
      })
      .lean();

    if (!variant) {
      throw ApiError.notFound('Model not found.');
    }

    return variant;
  }

  /**
   * Creates a new model (variant)
   */
  async createModel(payload, file, creatorId) {
    if (!file) {
      throw ApiError.badRequest('Model image is required.', ErrorCode.VALIDATION_ERROR);
    }

    const { productId, name, description, color, storage, warranty } = payload;

    const product = await Product.findOne({ _id: productId, isDeleted: { $ne: true } });
    if (!product) {
      throw ApiError.notFound('Product not found.');
    }

    const uploadResult = await storageManager.uploadFile(file);
    if (!uploadResult || !uploadResult.fileUrl) {
      throw ApiError.internal('Failed to upload model image.');
    }

    const variant = new Variant({
      productId,
      name: name.trim(),
      description: description ? description.trim() : '',
      color: color ? color.trim() : 'Default',
      storage: storage ? storage.trim() : 'Default',
      warranty: warranty ? warranty.trim() : '1 Year',
      image: uploadResult.fileUrl,
      createdBy: creatorId
    });

    await variant.save();
    return variant;
  }

  /**
   * Updates an existing model (variant)
   */
  async updateModel(id, payload, file, updaterId) {
    const variant = await Variant.findOne({
      _id: id,
      isDeleted: { $ne: true }
    });

    if (!variant) {
      throw ApiError.notFound('Model not found.');
    }

    if (payload.productId && payload.productId.toString() !== variant.productId.toString()) {
      const product = await Product.findOne({ _id: payload.productId, isDeleted: { $ne: true } });
      if (!product) {
        throw ApiError.notFound('Product not found.');
      }
      variant.productId = payload.productId;
    }

    if (payload.name) variant.name = payload.name.trim();
    if (payload.description !== undefined) variant.description = payload.description.trim();
    if (payload.color) variant.color = payload.color.trim();
    if (payload.storage) variant.storage = payload.storage.trim();
    if (payload.warranty) variant.warranty = payload.warranty.trim();

    if (file) {
      const uploadResult = await storageManager.uploadFile(file);
      if (uploadResult && uploadResult.fileUrl) {
        variant.image = uploadResult.fileUrl;
      }
    }

    variant.updatedBy = updaterId;
    await variant.save();

    return variant;
  }

  /**
   * Soft deletes a model (variant)
   */
  async deleteModel(id, deleterId) {
    const variant = await Variant.findOne({
      _id: id,
      isDeleted: { $ne: true }
    });

    if (!variant) {
      throw ApiError.notFound('Model not found for deletion.');
    }

    variant.isDeleted = true;
    variant.deletedAt = new Date();
    variant.deletedBy = deleterId;
    await variant.save();

    return variant;
  }
}

export const modelsService = new ModelsService();
