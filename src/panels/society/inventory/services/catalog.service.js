import { ApiError } from '../../../../common/api.error.js';
import Category from '../models/category.model.js';
import Subcategory from '../models/subcategory.model.js';
import InventoryItems from '../models/inventoryItem.model.js';
import Stock from '../models/stocks.model.js';
import Asset from '../models/Itemsasset.model.js';

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class CatalogService {
  buildSocietyScope(context) {
    if (!context?.bankId) {
      throw ApiError.forbidden('A valid society bank context is required.');
    }
    return { societyId: context.bankId };
  }

  // --- Category Methods ---
  async createCategory(context, payload) {
    const scope = this.buildSocietyScope(context);
    const codeUpper = payload.code.toUpperCase();

    const existing = await Category.findOne({
      societyId: scope.societyId,
      code: codeUpper
    });
    if (existing) {
      throw ApiError.conflict(`Category with code [${codeUpper}] already exists.`);
    }

    const category = await Category.create({
      societyId: scope.societyId,
      name: payload.name,
      code: codeUpper,
      description: payload.description || ''
    });

    return category;
  }

  async getCategoryById(context, categoryId) {
    const scope = this.buildSocietyScope(context);
    const category = await Category.findOne({ _id: categoryId, societyId: scope.societyId }).lean();
    if (!category) {
      throw ApiError.notFound('Category not found for this society.');
    }
    return category;
  }

  async updateCategory(context, categoryId, payload) {
    const scope = this.buildSocietyScope(context);
    const category = await Category.findOne({ _id: categoryId, societyId: scope.societyId });
    if (!category) {
      throw ApiError.notFound('Category not found for this society.');
    }

    if (payload.code) {
      const codeUpper = payload.code.toUpperCase();
      const existing = await Category.findOne({
        societyId: scope.societyId,
        code: codeUpper,
        _id: { $ne: categoryId }
      });
      if (existing) {
        throw ApiError.conflict(`Category with code [${codeUpper}] already exists.`);
      }
      category.code = codeUpper;
    }

    if (payload.name !== undefined) category.name = payload.name;
    if (payload.description !== undefined) category.description = payload.description;
    if (payload.status !== undefined) category.status = payload.status;

    await category.save();
    return category;
  }

  async deleteCategory(context, categoryId) {
    const scope = this.buildSocietyScope(context);
    const category = await Category.findOne({ _id: categoryId, societyId: scope.societyId });
    if (!category) {
      throw ApiError.notFound('Category not found for this society.');
    }

    // Check dependency: subcategories
    const subcategoryCount = await Subcategory.countDocuments({ categoryId, societyId: scope.societyId });
    if (subcategoryCount > 0) {
      throw ApiError.badRequest(
        `Cannot delete Category [${category.name}] because ${subcategoryCount} linked Subcategory(s) exist. Remove or reassign them first.`
      );
    }

    // Check dependency: master items
    const itemCount = await InventoryItems.countDocuments({ categoryId, societyId: scope.societyId });
    if (itemCount > 0) {
      throw ApiError.badRequest(
        `Cannot delete Category [${category.name}] because ${itemCount} linked Item(s) exist. Remove or reassign them first.`
      );
    }

    await Category.findByIdAndDelete(categoryId);
    return { id: categoryId, deleted: true, message: `Category [${category.name}] deleted successfully.` };
  }

  async listCategories(context, query = {}) {
    const scope = this.buildSocietyScope(context);
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;

    const filter = { societyId: scope.societyId };
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.$or = [
        { name: new RegExp(escapeRegex(query.search), 'i') },
        { code: new RegExp(escapeRegex(query.search), 'i') }
      ];
    }

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [items, totalRecords] = await Promise.all([
      Category.find(filter).sort({ [sortBy]: sortOrder }).skip(skip).limit(limit).lean(),
      Category.countDocuments(filter)
    ]);

    const totalPages = Math.max(1, Math.ceil(totalRecords / limit));
    return {
      items,
      meta: { totalRecords, limit, page, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 }
    };
  }

  // --- Subcategory Methods ---
  async createSubcategory(context, payload) {
    const scope = this.buildSocietyScope(context);
    const codeUpper = payload.code.toUpperCase();

    const category = await Category.findOne({ _id: payload.categoryId, societyId: scope.societyId });
    if (!category) {
      throw ApiError.notFound('Parent Category not found for this society.');
    }

    const existing = await Subcategory.findOne({
      categoryId: payload.categoryId,
      code: codeUpper
    });
    if (existing) {
      throw ApiError.conflict(`Subcategory with code [${codeUpper}] already exists in this category.`);
    }

    const subcategory = await Subcategory.create({
      societyId: scope.societyId,
      categoryId: payload.categoryId,
      name: payload.name,
      code: codeUpper,
      description: payload.description || ''
    });

    return subcategory;
  }

  async getSubcategoryById(context, subcategoryId) {
    const scope = this.buildSocietyScope(context);
    const subcategory = await Subcategory.findOne({ _id: subcategoryId, societyId: scope.societyId })
      .populate('categoryId', 'name code')
      .lean();
    if (!subcategory) {
      throw ApiError.notFound('Subcategory not found for this society.');
    }
    return subcategory;
  }

  async updateSubcategory(context, subcategoryId, payload) {
    const scope = this.buildSocietyScope(context);
    const subcategory = await Subcategory.findOne({ _id: subcategoryId, societyId: scope.societyId });
    if (!subcategory) {
      throw ApiError.notFound('Subcategory not found for this society.');
    }

    const targetCategoryId = payload.categoryId || subcategory.categoryId;
    if (payload.categoryId) {
      const category = await Category.findOne({ _id: payload.categoryId, societyId: scope.societyId });
      if (!category) {
        throw ApiError.notFound('Target parent Category not found for this society.');
      }
      subcategory.categoryId = payload.categoryId;
    }

    if (payload.code) {
      const codeUpper = payload.code.toUpperCase();
      const existing = await Subcategory.findOne({
        categoryId: targetCategoryId,
        code: codeUpper,
        _id: { $ne: subcategoryId }
      });
      if (existing) {
        throw ApiError.conflict(`Subcategory with code [${codeUpper}] already exists in this category.`);
      }
      subcategory.code = codeUpper;
    }

    if (payload.name !== undefined) subcategory.name = payload.name;
    if (payload.description !== undefined) subcategory.description = payload.description;
    if (payload.status !== undefined) subcategory.status = payload.status;

    await subcategory.save();
    return this.getSubcategoryById(context, subcategoryId);
  }

  async deleteSubcategory(context, subcategoryId) {
    const scope = this.buildSocietyScope(context);
    const subcategory = await Subcategory.findOne({ _id: subcategoryId, societyId: scope.societyId });
    if (!subcategory) {
      throw ApiError.notFound('Subcategory not found for this society.');
    }

    // Check dependency: master items
    const itemCount = await InventoryItems.countDocuments({ subcategoryId, societyId: scope.societyId });
    if (itemCount > 0) {
      throw ApiError.badRequest(
        `Cannot delete Subcategory [${subcategory.name}] because ${itemCount} linked Item(s) exist. Remove or reassign them first.`
      );
    }

    await Subcategory.findByIdAndDelete(subcategoryId);
    return { id: subcategoryId, deleted: true, message: `Subcategory [${subcategory.name}] deleted successfully.` };
  }

  async listSubcategories(context, query = {}) {
    const scope = this.buildSocietyScope(context);
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;

    const filter = { societyId: scope.societyId };
    if (query.categoryId) filter.categoryId = query.categoryId;
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.$or = [
        { name: new RegExp(escapeRegex(query.search), 'i') },
        { code: new RegExp(escapeRegex(query.search), 'i') }
      ];
    }

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [items, totalRecords] = await Promise.all([
      Subcategory.find(filter).populate('categoryId', 'name code').sort({ [sortBy]: sortOrder }).skip(skip).limit(limit).lean(),
      Subcategory.countDocuments(filter)
    ]);

    const totalPages = Math.max(1, Math.ceil(totalRecords / limit));
    return {
      items,
      meta: { totalRecords, limit, page, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 }
    };
  }

  // --- Inventory Items (Master SKU) Methods ---
  async createItem(context, payload) {
    const scope = this.buildSocietyScope(context);
    const codeUpper = payload.code.toUpperCase();

    const category = await Category.findOne({ _id: payload.categoryId, societyId: scope.societyId });
    if (!category) {
      throw ApiError.notFound('Category not found for this society.');
    }

    if (payload.subcategoryId) {
      const subcategory = await Subcategory.findOne({ _id: payload.subcategoryId, categoryId: payload.categoryId });
      if (!subcategory) {
        throw ApiError.notFound('Subcategory not found for specified Category.');
      }
    }

    const existing = await InventoryItems.findOne({
      societyId: scope.societyId,
      code: codeUpper
    });
    if (existing) {
      throw ApiError.conflict(`Inventory item SKU with code [${codeUpper}] already exists.`);
    }

    const item = await InventoryItems.create({
      societyId: scope.societyId,
      categoryId: payload.categoryId,
      subcategoryId: payload.subcategoryId || null,
      name: payload.name,
      code: codeUpper,
      unit: payload.unit,
      brand: payload.brand || '',
      model: payload.model || '',
      type: payload.type || '',
      isSerialized: Boolean(payload.isSerialized),
      description: payload.description || ''
    });

    return item;
  }

  async getItemById(context, itemId) {
    const scope = this.buildSocietyScope(context);
    const item = await InventoryItems.findOne({ _id: itemId, societyId: scope.societyId })
      .populate('categoryId', 'name code')
      .populate('subcategoryId', 'name code')
      .lean();
    if (!item) {
      throw ApiError.notFound('Inventory SKU item not found for this society.');
    }
    return item;
  }

  async updateItem(context, itemId, payload) {
    const scope = this.buildSocietyScope(context);
    const item = await InventoryItems.findOne({ _id: itemId, societyId: scope.societyId });
    if (!item) {
      throw ApiError.notFound('Inventory SKU item not found for this society.');
    }

    if (payload.code) {
      const codeUpper = payload.code.toUpperCase();
      const existing = await InventoryItems.findOne({
        societyId: scope.societyId,
        code: codeUpper,
        _id: { $ne: itemId }
      });
      if (existing) {
        throw ApiError.conflict(`Inventory item SKU with code [${codeUpper}] already exists.`);
      }
      item.code = codeUpper;
    }

    const targetCategoryId = payload.categoryId || item.categoryId;
    if (payload.categoryId) {
      const category = await Category.findOne({ _id: payload.categoryId, societyId: scope.societyId });
      if (!category) {
        throw ApiError.notFound('Category not found for this society.');
      }
      item.categoryId = payload.categoryId;
    }

    if (payload.subcategoryId !== undefined) {
      if (payload.subcategoryId) {
        const subcategory = await Subcategory.findOne({
          _id: payload.subcategoryId,
          categoryId: targetCategoryId
        });
        if (!subcategory) {
          throw ApiError.notFound('Subcategory not found under the specified Category.');
        }
        item.subcategoryId = payload.subcategoryId;
      } else {
        item.subcategoryId = null;
      }
    }

    if (payload.name !== undefined) item.name = payload.name;
    if (payload.unit !== undefined) item.unit = payload.unit;
    if (payload.brand !== undefined) item.brand = payload.brand;
    if (payload.model !== undefined) item.model = payload.model;
    if (payload.type !== undefined) item.type = payload.type;
    if (payload.description !== undefined) item.description = payload.description;
    if (payload.status !== undefined) item.status = payload.status;

    await item.save();
    return this.getItemById(context, itemId);
  }

  async deleteItem(context, itemId) {
    const scope = this.buildSocietyScope(context);
    const item = await InventoryItems.findOne({ _id: itemId, societyId: scope.societyId });
    if (!item) {
      throw ApiError.notFound('Inventory SKU item not found for this society.');
    }

    // Check 1: Active physical stock
    const activeStock = await Stock.findOne({
      itemMasterId: itemId,
      societyId: scope.societyId,
      $or: [{ quantity: { $gt: 0 } }, { reservedQuantity: { $gt: 0 } }]
    });
    if (activeStock) {
      throw ApiError.badRequest(
        `Cannot delete SKU Item [${item.name}] because active physical stock (${activeStock.quantity} units) exists. Deplete or transfer stock first, or mark item as inactive.`
      );
    }

    // Check 2: Active or deployed serialized assets
    const activeAsset = await Asset.findOne({
      itemMasterId: itemId,
      societyId: scope.societyId,
      status: { $in: ['active', 'in_repair', 'lost', 'disposal_requested'] }
    });
    if (activeAsset) {
      throw ApiError.badRequest(
        `Cannot delete SKU Item [${item.name}] because registered assets (e.g. tag [${activeAsset.assetTag}]) exist. Retire or dispose assets first.`
      );
    }

    // Clean up empty stock balance tracking records
    await Stock.deleteMany({ itemMasterId: itemId, societyId: scope.societyId });
    await InventoryItems.findByIdAndDelete(itemId);

    return { id: itemId, deleted: true, message: `Inventory item [${item.name}] deleted successfully.` };
  }

  async listItems(context, query = {}) {
    const scope = this.buildSocietyScope(context);
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;

    const filter = { societyId: scope.societyId };
    if (query.categoryId) filter.categoryId = query.categoryId;
    if (query.subcategoryId) filter.subcategoryId = query.subcategoryId;
    if (query.isSerialized !== undefined) filter.isSerialized = query.isSerialized;
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.$or = [
        { name: new RegExp(escapeRegex(query.search), 'i') },
        { code: new RegExp(escapeRegex(query.search), 'i') },
        { brand: new RegExp(escapeRegex(query.search), 'i') },
        { model: new RegExp(escapeRegex(query.search), 'i') }
      ];
    }

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [items, totalRecords] = await Promise.all([
      InventoryItems.find(filter)
        .populate('categoryId', 'name code')
        .populate('subcategoryId', 'name code')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      InventoryItems.countDocuments(filter)
    ]);

    const totalPages = Math.max(1, Math.ceil(totalRecords / limit));
    return {
      items,
      meta: { totalRecords, limit, page, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 }
    };
  }
}

export const catalogService = new CatalogService();

