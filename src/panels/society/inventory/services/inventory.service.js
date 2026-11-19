import { ApiError } from '../../../../common/api.error.js';
import { SocietyInventory } from '../models/society-inventory.model.js';

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class InventoryService {
  buildScope(context) {
    if (!context?.bankId) throw ApiError.forbidden('A valid society bank context is required.');
    const scope = { bankId: context.bankId };
    if (context.branchId) scope.branchId = context.branchId;
    return scope;
  }

  format(item, srNo = null) {
    const data = {
      id: item._id,
      assets: item.assets,
      quantity: item.quantity
    };
    return srNo === null ? data : { srNo, ...data };
  }

  buildFilter(context, query = {}) {
    const filter = this.buildScope(context);
    if (query.search) filter.assets = new RegExp(escapeRegex(query.search), 'i');
    if (query.minQuantity !== undefined || query.maxQuantity !== undefined) {
      filter.quantity = {};
      if (query.minQuantity !== undefined) filter.quantity.$gte = Number(query.minQuantity);
      if (query.maxQuantity !== undefined) filter.quantity.$lte = Number(query.maxQuantity);
    }
    return filter;
  }

  async list(context, query = {}) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;
    const filter = this.buildFilter(context, query);
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const [items, totalRecords] = await Promise.all([
      SocietyInventory.find(filter).sort({ [sortBy]: sortOrder }).skip(skip).limit(limit).lean(),
      SocietyInventory.countDocuments(filter)
    ]);
    const totalPages = Math.max(1, Math.ceil(totalRecords / limit));
    return {
      items: items.map((item, index) => this.format(item, skip + index + 1)),
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

  async create(context, payload, userId) {
    const scope = this.buildScope(context);
    const existing = await SocietyInventory.findOne({
      ...scope,
      assets: new RegExp(`^${escapeRegex(payload.assets)}$`, 'i')
    });
    if (existing) throw ApiError.conflict(`Inventory asset [${payload.assets}] already exists.`);
    const item = await SocietyInventory.create({
      ...scope,
      branchId: context.branchId || null,
      assets: payload.assets,
      quantity: payload.quantity,
      createdBy: userId
    });
    return this.format(item);
  }

  async update(context, id, payload, userId) {
    const item = await SocietyInventory.findOne({ _id: id, ...this.buildScope(context) });
    if (!item) throw ApiError.notFound('Inventory item not found.');
    if (payload.assets !== undefined && payload.assets.toLowerCase() !== item.assets.toLowerCase()) {
      const duplicate = await SocietyInventory.findOne({
        ...this.buildScope(context),
        _id: { $ne: id },
        assets: new RegExp(`^${escapeRegex(payload.assets)}$`, 'i')
      });
      if (duplicate) throw ApiError.conflict(`Inventory asset [${payload.assets}] already exists.`);
      item.assets = payload.assets;
    }
    if (payload.quantity !== undefined) item.quantity = payload.quantity;
    item.updatedBy = userId;
    await item.save();
    return this.format(item);
  }

  async remove(context, id, userId) {
    const item = await SocietyInventory.findOne({ _id: id, ...this.buildScope(context) });
    if (!item) throw ApiError.notFound('Inventory item not found.');
    item.isDeleted = true;
    item.deletedAt = new Date();
    item.deletedBy = userId;
    await item.save();
    return { id: item._id };
  }

  async exportCsv(context, query = {}) {
    const filter = this.buildFilter(context, query);
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const items = await SocietyInventory.find(filter).sort({ [sortBy]: sortOrder }).lean();
    const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Sr.No.', 'Assets', 'Quantity'],
      ...items.map((item, index) => [index + 1, item.assets, item.quantity])
    ];
    return rows.map((row) => row.map(escape).join(',')).join('\n');
  }
}

export const inventoryService = new InventoryService();
