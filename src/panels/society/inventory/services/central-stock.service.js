import { ApiError } from '../../../../common/api.error.js';
import CentralInventory from '../models/centralInventory.model.js';
import InventoryItems from '../models/inventoryItem.model.js';
import Vendor from '../models/vendor.model.js';
import Stock from '../models/stocks.model.js';
import Asset from '../models/Itemsasset.model.js';
import InventoryTransaction from '../models/inventoryTransaction.model.js';

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class CentralStockService {
  buildSocietyScope(context) {
    if (!context?.bankId) {
      throw ApiError.forbidden('A valid society bank context is required.');
    }
    return { societyId: context.bankId };
  }

  // --- Central Inventory Location Warehouse ---
  async createCentralInventory(context, payload) {
    const scope = this.buildSocietyScope(context);
    const codeUpper = payload.code.toUpperCase();

    const existing = await CentralInventory.findOne({
      societyId: scope.societyId,
      code: codeUpper
    });
    if (existing) {
      throw ApiError.conflict(`Central warehouse with code [${codeUpper}] already exists.`);
    }

    const warehouse = await CentralInventory.create({
      societyId: scope.societyId,
      name: payload.name,
      code: codeUpper,
      address: payload.address || '',
      managerId: payload.managerId
    });

    return warehouse;
  }

  async getCentralInventoryById(context, warehouseId) {
    const scope = this.buildSocietyScope(context);
    const warehouse = await CentralInventory.findOne({ _id: warehouseId, societyId: scope.societyId })
      .populate('managerId', 'fullName email phoneNumber')
      .lean();
    if (!warehouse) {
      throw ApiError.notFound('Central inventory warehouse not found for this society.');
    }
    return warehouse;
  }

  async updateCentralInventory(context, warehouseId, payload) {
    const scope = this.buildSocietyScope(context);
    const warehouse = await CentralInventory.findOne({ _id: warehouseId, societyId: scope.societyId });
    if (!warehouse) {
      throw ApiError.notFound('Central inventory warehouse not found for this society.');
    }

    if (payload.code) {
      const codeUpper = payload.code.toUpperCase();
      const existing = await CentralInventory.findOne({
        societyId: scope.societyId,
        code: codeUpper,
        _id: { $ne: warehouseId }
      });
      if (existing) {
        throw ApiError.conflict(`Central warehouse with code [${codeUpper}] already exists.`);
      }
      warehouse.code = codeUpper;
    }

    if (payload.name !== undefined) warehouse.name = payload.name;
    if (payload.address !== undefined) warehouse.address = payload.address;
    if (payload.managerId !== undefined) warehouse.managerId = payload.managerId;
    if (payload.status !== undefined) warehouse.status = payload.status;

    await warehouse.save();
    return this.getCentralInventoryById(context, warehouseId);
  }

  async deleteCentralInventory(context, warehouseId) {
    const scope = this.buildSocietyScope(context);
    const warehouse = await CentralInventory.findOne({ _id: warehouseId, societyId: scope.societyId });
    if (!warehouse) {
      throw ApiError.notFound('Central inventory warehouse not found for this society.');
    }

    // Check active stock
    const activeStock = await Stock.findOne({
      societyId: scope.societyId,
      locationType: 'CentralInventory',
      locationId: warehouseId,
      $or: [{ quantity: { $gt: 0 } }, { reservedQuantity: { $gt: 0 } }]
    });
    if (activeStock) {
      throw ApiError.badRequest(
        `Cannot delete Central Warehouse [${warehouse.name}] because active inventory balance (${activeStock.quantity} units) exists. Relocate or adjust stock first, or mark location as inactive.`
      );
    }

    // Check active assets residing in warehouse
    const activeAsset = await Asset.findOne({
      societyId: scope.societyId,
      currentLocationType: 'CentralInventory',
      currentLocationId: warehouseId,
      status: { $in: ['active', 'in_repair', 'lost', 'disposal_requested'] }
    });
    if (activeAsset) {
      throw ApiError.badRequest(
        `Cannot delete Central Warehouse [${warehouse.name}] because physical assets (e.g. tag [${activeAsset.assetTag}]) reside at this location.`
      );
    }

    // Clean up empty stock records
    await Stock.deleteMany({ locationType: 'CentralInventory', locationId: warehouseId, societyId: scope.societyId });
    await CentralInventory.findByIdAndDelete(warehouseId);

    return { id: warehouseId, deleted: true, message: `Central inventory warehouse [${warehouse.name}] deleted successfully.` };
  }

  async listCentralInventories(context, query = {}) {
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
      CentralInventory.find(filter)
        .populate('managerId', 'fullName email phoneNumber')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      CentralInventory.countDocuments(filter)
    ]);

    const totalPages = Math.max(1, Math.ceil(totalRecords / limit));
    return {
      items,
      meta: { totalRecords, limit, page, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 }
    };
  }


  // --- Receive / Stock In into Central Inventory ---
  async receiveStock(context, payload, userId) {
    const scope = this.buildSocietyScope(context);

    // 1. Verify Central Inventory Warehouse location exists
    const warehouse = await CentralInventory.findOne({
      _id: payload.centralInventoryId,
      societyId: scope.societyId
    });
    if (!warehouse) {
      throw ApiError.notFound('Central Inventory warehouse not found for this society.');
    }

    // 2. Verify SKU Item Master exists
    const item = await InventoryItems.findOne({
      _id: payload.itemMasterId,
      societyId: scope.societyId
    });
    if (!item) {
      throw ApiError.notFound('Inventory item master not found.');
    }

    // 3. Verify Vendor if provided
    if (payload.vendorId) {
      const vendor = await Vendor.findOne({ _id: payload.vendorId, societyId: scope.societyId });
      if (!vendor) {
        throw ApiError.notFound('Vendor not found.');
      }
    }

    const qty = Number(payload.quantity);

    // 4. Handle serialized items asset generation if item is serialized
    const createdAssets = [];
    if (item.isSerialized) {
      const tags = payload.assetTags || [];
      if (tags.length !== qty) {
        throw ApiError.badRequest(`Item [${item.name}] is serialized. Exactly ${qty} asset tags are required.`);
      }

      // Check for existing asset tags in society
      const existingAsset = await Asset.findOne({
        societyId: scope.societyId,
        assetTag: { $in: tags.map((t) => t.toUpperCase()) }
      });
      if (existingAsset) {
        throw ApiError.conflict(`Asset tag [${existingAsset.assetTag}] already exists in society.`);
      }

      // Create individual serialized assets
      for (let i = 0; i < qty; i++) {
        const assetTag = tags[i].toUpperCase();
        const serialNumber = payload.serialNumbers && payload.serialNumbers[i] ? payload.serialNumbers[i] : '';

        const asset = await Asset.create({
          societyId: scope.societyId,
          itemMasterId: item._id,
          assetTag,
          serialNumber,
          currentLocationType: 'CentralInventory',
          currentLocationId: warehouse._id,
          vendorId: payload.vendorId || null,
          condition: 'new',
          status: 'active'
        });
        createdAssets.push(asset._id);
      }
    }

    // 5. Update Stock level at Central Location
    const stock = await Stock.findOneAndUpdate(
      {
        societyId: scope.societyId,
        itemMasterId: item._id,
        locationType: 'CentralInventory',
        locationId: warehouse._id
      },
      {
        $inc: { quantity: qty },
        $setOnInsert: { reservedQuantity: 0 }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 6. Record Immutable Stock Transaction
    const transaction = await InventoryTransaction.create({
      itemMasterId: item._id,
      locationType: 'CentralInventory',
      locationId: warehouse._id,
      type: 'STOCK_IN',
      quantity: qty,
      performedBy: userId,
      remarks: payload.remarks || `Received ${qty} ${item.unit} into central inventory [${warehouse.name}]`
    });

    return {
      warehouse: { id: warehouse._id, name: warehouse.name, code: warehouse.code },
      item: { id: item._id, name: item.name, code: item.code, isSerialized: item.isSerialized },
      quantityReceived: qty,
      totalCentralStock: stock.quantity,
      createdAssetsCount: createdAssets.length,
      transactionId: transaction._id
    };
  }
}

export const centralStockService = new CentralStockService();
