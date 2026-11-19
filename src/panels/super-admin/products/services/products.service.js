import { Product } from '../../../../models/product.model.js';
import { Brand } from '../../../../models/brand.model.js';
import { storageManager } from '../../../../storage/storage.manager.js';
import { ApiError } from '../../../../common/api.error.js';
import { ErrorCode } from '../../../../constants/error-code.constant.js';

export class ProductsService {
  /**
   * Retrieves a paginated list of products, supporting search and category/brand filters
   */
  async listProducts(queryOptions) {
    const page = parseInt(queryOptions.page || '1', 10);
    const limit = parseInt(queryOptions.limit || '10', 10);
    const search = queryOptions.search || '';
    const skip = (page - 1) * limit;

    const filter = {
      isDeleted: { $ne: true }
    };

    if (queryOptions.category) {
      if (Array.isArray(queryOptions.category)) {
        filter.category = { $in: queryOptions.category };
      } else if (typeof queryOptions.category === 'string' && queryOptions.category.includes(',')) {
        filter.category = { $in: queryOptions.category.split(',') };
      } else {
        filter.category = queryOptions.category;
      }
    }

    if (queryOptions.brandId) {
      if (Array.isArray(queryOptions.brandId)) {
        filter.brandId = { $in: queryOptions.brandId };
      } else if (typeof queryOptions.brandId === 'string' && queryOptions.brandId.includes(',')) {
        filter.brandId = { $in: queryOptions.brandId.split(',') };
      } else {
        filter.brandId = queryOptions.brandId;
      }
    }

    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    const [items, totalRecords] = await Promise.all([
      Product.find(filter)
        .populate('brandId', 'name logo')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter)
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
   * Retrieves product details by ID
   */
  async getProductById(id) {
    const product = await Product.findOne({
      _id: id,
      isDeleted: { $ne: true }
    })
      .populate('brandId', 'name logo')
      .lean();

    if (!product) {
      throw ApiError.notFound('Product not found.');
    }

    return product;
  }

  /**
   * Creates a new product
   */
  async createProduct(payload, file, creatorId) {
    if (!file) {
      throw ApiError.badRequest('Product image is required.', ErrorCode.VALIDATION_ERROR);
    }

    const { brandId, category } = payload;
    const name = payload.name?.trim();

    const brand = await Brand.findOne({ _id: brandId, isDeleted: { $ne: true } });
    if (!brand) {
      throw ApiError.notFound('Brand not found.');
    }

    const existing = await Product.findOne({
      name: { $regex: `^${name}$`, $options: 'i' },
      brandId,
      category,
      isDeleted: { $ne: true }
    });

    if (existing) {
      throw ApiError.conflict('Product with this name already exists for this Brand and Category.', ErrorCode.VALIDATION_ERROR);
    }

    const uploadResult = await storageManager.uploadFile(file);
    if (!uploadResult || !uploadResult.fileUrl) {
      throw ApiError.internal('Failed to upload product image.');
    }

    const product = new Product({
      name,
      brandId,
      category,
      image: uploadResult.fileUrl,
      createdBy: creatorId
    });

    await product.save();
    return product;
  }

  /**
   * Updates an existing product
   */
  async updateProduct(id, payload, file, updaterId) {
    const product = await Product.findOne({
      _id: id,
      isDeleted: { $ne: true }
    });

    if (!product) {
      throw ApiError.notFound('Product not found.');
    }

    if (payload.brandId && payload.brandId.toString() !== product.brandId.toString()) {
      const brand = await Brand.findOne({ _id: payload.brandId, isDeleted: { $ne: true } });
      if (!brand) {
        throw ApiError.notFound('Brand not found.');
      }
      product.brandId = payload.brandId;
    }

    if (payload.name) {
      product.name = payload.name.trim();
    }

    if (payload.category) {
      product.category = payload.category.trim();
    }

    if (file) {
      const uploadResult = await storageManager.uploadFile(file);
      if (uploadResult && uploadResult.fileUrl) {
        product.image = uploadResult.fileUrl;
      }
    }

    product.updatedBy = updaterId;
    await product.save();

    return product;
  }

  /**
   * Soft deletes a product
   */
  async deleteProduct(id, deleterId) {
    const product = await Product.findOne({
      _id: id,
      isDeleted: { $ne: true }
    });

    if (!product) {
      throw ApiError.notFound('Product not found for deletion.');
    }

    product.isDeleted = true;
    product.deletedAt = new Date();
    product.deletedBy = deleterId;
    await product.save();

    return product;
  }

  /**
   * Retrieves active products for dropdown selection (filterable by brandId and category)
   */
  async listProductsDropdown(queryOptions) {
    const filter = {
      isDeleted: { $ne: true }
    };

    if (queryOptions.brandId) {
      filter.brandId = queryOptions.brandId;
    }

    if (queryOptions.category) {
      filter.category = queryOptions.category;
    }

    return Product.find(filter)
      .select('_id name brandId category image')
      .sort({ name: 1 })
      .lean();
  }
}

export const productsService = new ProductsService();
