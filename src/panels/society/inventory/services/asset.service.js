import { ApiError } from '../../../../common/api.error.js';
import Asset from '../models/Itemsasset.model.js';
import AssetsAssignment from '../models/assetsAssignment.model.js';
import InventoryItems from '../models/inventoryItem.model.js';
import InventoryTransaction from '../models/inventoryTransaction.model.js';
import Stock from '../models/stocks.model.js';

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class AssetService {
  buildSocietyScope(context) {
    if (!context?.bankId) {
      throw ApiError.forbidden('A valid society bank context is required.');
    }
    return { societyId: context.bankId };
  }

  // --- 0. Create / Register Individual Asset ---
  async createAsset(context, payload) {
    const scope = this.buildSocietyScope(context);
    const userId = context.userId;

    // 1. Verify Master Item exists and is serialized
    const item = await InventoryItems.findOne({
      _id: payload.itemMasterId,
      societyId: scope.societyId
    });
    if (!item) {
      throw ApiError.notFound('Catalog SKU item not found.');
    }
    if (!item.isSerialized) {
      throw ApiError.badRequest(`Item [${item.name}] is not marked as serialized. Only serialized items can be registered as assets.`);
    }

    // 2. Validate asset tag uniqueness
    const tagUpper = payload.assetTag.trim().toUpperCase();
    const existingTag = await Asset.findOne({
      societyId: scope.societyId,
      assetTag: tagUpper
    });
    if (existingTag) {
      throw ApiError.conflict(`Asset tag [${tagUpper}] already exists in this society.`);
    }

    // 3. Validate serial number uniqueness (if provided)
    if (payload.serialNumber && payload.serialNumber.trim()) {
      const snTrimmed = payload.serialNumber.trim();
      const existingSn = await Asset.findOne({
        societyId: scope.societyId,
        serialNumber: snTrimmed
      });
      if (existingSn) {
        throw ApiError.conflict(`Serial number [${snTrimmed}] already exists in this society.`);
      }
    }

    // 4. Resolve Location
    const locationType = payload.currentLocationType || 'Branch';
    const locationId = payload.currentLocationId || payload.branchId || payload.centralInventoryId || context.branchId;

    if (!locationId) {
      throw ApiError.badRequest('A valid location ID (branchId or centralInventoryId) is required.');
    }

    // 5. Create Asset
    const asset = await Asset.create({
      societyId: scope.societyId,
      itemMasterId: item._id,
      assetTag: tagUpper,
      serialNumber: payload.serialNumber ? payload.serialNumber.trim() : '',
      currentLocationType: locationType,
      currentLocationId: locationId,
      currentEmployeeId: null,
      condition: payload.condition || 'new',
      status: 'active',
      purchaseDate: payload.purchaseDate,
      purchasePrice: payload.purchasePrice,
      vendorId: payload.vendorId || null,
      warrantyStartDate: payload.warrantyStartDate,
      warrantyEndDate: payload.warrantyEndDate,
      remarks: payload.remarks || ''
    });

    // 6. Increment Stock at that Location
    await Stock.findOneAndUpdate(
      {
        societyId: scope.societyId,
        itemMasterId: item._id,
        locationType: locationType,
        locationId: locationId
      },
      {
        $inc: { quantity: 1 },
        $setOnInsert: { reservedQuantity: 0 }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 7. Log Transaction
    await InventoryTransaction.create({
      itemMasterId: item._id,
      assetId: asset._id,
      locationType: locationType,
      locationId: locationId,
      type: 'STOCK_IN',
      quantity: 1,
      performedBy: userId,
      remarks: `Direct Asset Registration: [${tagUpper}]`
    });

    return Asset.findById(asset._id)
      .populate('itemMasterId', 'name code unit brand model type')
      .populate('vendorId', 'name code')
      .lean();
  }

  // --- 1. List Assets with Scoping ---
  async listAssets(context, query = {}) {
    const scope = this.buildSocietyScope(context);
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;

    const filter = { societyId: scope.societyId };

    // Employee scoping: only own assigned assets
    if (context.isEmployee && !context.isBranchManager && !context.isBankOwner) {
      filter.currentEmployeeId = context.userId;
    } else {
      if (query.currentEmployeeId) filter.currentEmployeeId = query.currentEmployeeId;
      if (query.currentLocationType) filter.currentLocationType = query.currentLocationType;
      if (query.currentLocationId) filter.currentLocationId = query.currentLocationId;
      if (query.branchId) {
        filter.$or = [
          { currentLocationType: 'Branch', currentLocationId: query.branchId },
          { currentLocationType: 'User' } // Can further filter via branch in assignment if needed
        ];
      } else if (context.branchId && !context.isBankOwner) {
        filter.$or = [
          { currentLocationType: 'Branch', currentLocationId: context.branchId },
          { currentLocationType: 'User' }
        ];
      }
    }

    if (query.itemMasterId) filter.itemMasterId = query.itemMasterId;
    if (query.status) filter.status = query.status;
    if (query.condition) filter.condition = query.condition;

    if (query.search) {
      const searchRegex = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ assetTag: searchRegex }, { serialNumber: searchRegex }];
    }

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [items, totalRecords] = await Promise.all([
      Asset.find(filter)
        .populate('itemMasterId', 'name code unit brand model type')
        .populate('currentEmployeeId', 'fullName email phoneNumber')
        .populate('vendorId', 'name code')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      Asset.countDocuments(filter)
    ]);

    const totalPages = Math.max(1, Math.ceil(totalRecords / limit));
    return {
      items,
      meta: { totalRecords, limit, page, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 }
    };
  }

  // --- 2. Get Asset by ID with Lifecycle History ---
  async getAssetById(context, assetId) {
    const scope = this.buildSocietyScope(context);
    const asset = await Asset.findOne({ _id: assetId, societyId: scope.societyId })
      .populate('itemMasterId', 'name code unit brand model type')
      .populate('currentEmployeeId', 'fullName email phoneNumber')
      .populate('vendorId', 'name code contactPerson')
      .lean();

    if (!asset) {
      throw ApiError.notFound('Asset not found.');
    }

    // Ownership check for employees: can only inspect their own assigned assets
    if (context.isEmployee && !context.isBranchManager && !context.isBankOwner) {
      const assignedId = asset.currentEmployeeId?._id
        ? asset.currentEmployeeId._id.toString()
        : asset.currentEmployeeId?.toString();
      if (assignedId !== context.userId.toString()) {
        throw ApiError.forbidden('Access denied. You can only view assets assigned to you.');
      }
    }

    const history = await AssetsAssignment.find({ assetId: asset._id })
      .populate('employeeId', 'fullName email phoneNumber')
      .populate('branchId', 'name code')
      .populate('assignedBy', 'fullName email')
      .sort({ assignedAt: -1 })
      .lean();

    return {
      ...asset,
      assignmentHistory: history
    };
  }

  // --- 3. Assign Asset to Employee ---
  async assignAsset(context, payload) {
    const scope = this.buildSocietyScope(context);
    const branchId = payload.branchId || context.branchId;

    const asset = await Asset.findOne({ _id: payload.assetId, societyId: scope.societyId });
    if (!asset) {
      throw ApiError.notFound('Asset not found.');
    }

    if (asset.status !== 'active') {
      throw ApiError.badRequest(`Cannot assign asset in status [${asset.status}]. Must be active.`);
    }

    if (asset.currentEmployeeId) {
      throw ApiError.badRequest(`Asset is already assigned to an employee.`);
    }

    asset.currentLocationType = 'User';
    asset.currentLocationId = payload.employeeId;
    asset.currentEmployeeId = payload.employeeId;
    if (payload.condition) asset.condition = payload.condition;
    await asset.save();

    const assignment = await AssetsAssignment.create({
      assetId: asset._id,
      employeeId: payload.employeeId,
      branchId,
      assignedBy: context.userId,
      assignedAt: new Date(),
      condition: payload.condition || asset.condition,
      remarks: payload.remarks || 'Asset assigned'
    });

    await InventoryTransaction.create({
      itemMasterId: asset.itemMasterId,
      assetId: asset._id,
      locationType: 'User',
      locationId: payload.employeeId,
      type: 'ISSUE',
      quantity: 1,
      performedBy: context.userId,
      remarks: payload.remarks || `Assigned asset [${asset.assetTag}] to employee`
    });

    return {
      asset: await this.getAssetById(context, asset._id),
      assignmentId: assignment._id
    };
  }

  // --- 4. Return Asset from Employee (➔ AVAILABLE) ---
  async returnAsset(context, assetId, payload) {
    const scope = this.buildSocietyScope(context);
    const asset = await Asset.findOne({ _id: assetId, societyId: scope.societyId });

    if (!asset) {
      throw ApiError.notFound('Asset not found.');
    }

    if (!asset.currentEmployeeId) {
      throw ApiError.badRequest('Asset is not currently assigned to any employee.');
    }

    // Ownership check for employees: can only return their own assigned assets
    if (context.isEmployee && !context.isBranchManager && !context.isBankOwner) {
      if (asset.currentEmployeeId.toString() !== context.userId.toString()) {
        throw ApiError.forbidden('Access denied. You can only return assets assigned to you.');
      }
    }

    const previousEmployeeId = asset.currentEmployeeId;

    // Close open assignment record
    const openAssignment = await AssetsAssignment.findOne({
      assetId: asset._id,
      employeeId: previousEmployeeId,
      returnedAt: null
    }).sort({ assignedAt: -1 });

    const targetBranchId = openAssignment?.branchId || context.branchId;

    if (openAssignment) {
      openAssignment.returnedAt = new Date();
      if (payload.remarks) {
        openAssignment.remarks = openAssignment.remarks
          ? `${openAssignment.remarks} | Return: ${payload.remarks}`
          : payload.remarks;
      }
      await openAssignment.save();
    }

    // Asset returns to Branch inventory -> AVAILABLE
    asset.currentLocationType = 'Branch';
    asset.currentLocationId = targetBranchId;
    asset.currentEmployeeId = null;
    asset.condition = payload.condition || 'good';
    asset.status = payload.condition === 'damaged' ? 'in_repair' : 'active';
    await asset.save();

    await InventoryTransaction.create({
      itemMasterId: asset.itemMasterId,
      assetId: asset._id,
      locationType: 'Branch',
      locationId: targetBranchId,
      type: 'RETURN',
      quantity: 1,
      performedBy: context.userId,
      remarks: payload.remarks || `Asset [${asset.assetTag}] returned by employee`
    });

    return this.getAssetById(context, asset._id);
  }

  // --- 5. Report Damaged ➔ MAINTENANCE (`in_repair`) ---
  async reportDamage(context, assetId, payload) {
    const scope = this.buildSocietyScope(context);
    const asset = await Asset.findOne({ _id: assetId, societyId: scope.societyId });

    if (!asset) {
      throw ApiError.notFound('Asset not found.');
    }

    asset.status = 'in_repair';
    asset.condition = 'damaged';
    asset.remarks = payload.remarks
      ? `MAINTENANCE: ${payload.remarks}`
      : 'Moved to maintenance due to damage.';
    await asset.save();

    return this.getAssetById(context, asset._id);
  }

  // --- 6. Complete Maintenance / Repair ➔ AVAILABLE ---
  async repairComplete(context, assetId, payload = {}) {
    const scope = this.buildSocietyScope(context);
    const asset = await Asset.findOne({ _id: assetId, societyId: scope.societyId });

    if (!asset) {
      throw ApiError.notFound('Asset not found.');
    }

    if (asset.status !== 'in_repair') {
      throw ApiError.badRequest(`Asset is not in maintenance (current status: [${asset.status}]).`);
    }

    asset.status = 'active';
    asset.condition = payload.condition || 'good';
    asset.remarks = payload.remarks
      ? `REPAIR COMPLETED: ${payload.remarks}`
      : 'Repaired and restored to available inventory.';
    await asset.save();

    return this.getAssetById(context, asset._id);
  }

  // --- 7. Request Disposal (Officer Recommends Scrap) ---
  async requestDisposal(context, assetId, payload) {
    const scope = this.buildSocietyScope(context);
    const asset = await Asset.findOne({ _id: assetId, societyId: scope.societyId });

    if (!asset) {
      throw ApiError.notFound('Asset not found.');
    }

    asset.remarks = `PENDING_DISPOSAL: ${payload.remarks}`;
    await asset.save();

    return {
      assetId: asset._id,
      assetTag: asset.assetTag,
      status: asset.status,
      disposalRequested: true,
      message: 'Disposal recommendation submitted for Branch Manager approval.'
    };
  }

  // --- 8. Approve Disposal ➔ DISPOSED / Scrapped (Branch Manager Authority) ---
  async approveDisposal(context, assetId, payload = {}) {
    const scope = this.buildSocietyScope(context);
    const asset = await Asset.findOne({ _id: assetId, societyId: scope.societyId });

    if (!asset) {
      throw ApiError.notFound('Asset not found.');
    }

    asset.status = 'retired';
    asset.condition = 'scrapped';
    asset.remarks = payload.remarks
      ? `DISPOSED / SCRAPPED: ${payload.remarks}`
      : 'Asset decommissioned and scrapped upon manager approval.';
    await asset.save();

    await InventoryTransaction.create({
      itemMasterId: asset.itemMasterId,
      assetId: asset._id,
      locationType: asset.currentLocationType,
      locationId: asset.currentLocationId,
      type: 'ADJUSTMENT',
      quantity: 1,
      performedBy: context.userId,
      remarks: `Scrapped and retired asset [${asset.assetTag}]`
    });

    return this.getAssetById(context, asset._id);
  }

  // --- 9. Report Lost ➔ INVESTIGATION (`lost`) ---
  async reportLost(context, assetId, payload) {
    const scope = this.buildSocietyScope(context);
    const asset = await Asset.findOne({ _id: assetId, societyId: scope.societyId });

    if (!asset) {
      throw ApiError.notFound('Asset not found.');
    }

    asset.status = 'lost';
    asset.remarks = payload.remarks
      ? `UNDER_INVESTIGATION: ${payload.remarks}`
      : 'Asset reported missing/lost and under investigation.';
    await asset.save();

    return this.getAssetById(context, asset._id);
  }

  // --- 10. Recover Asset ➔ RECOVERED / AVAILABLE ---
  async recoverAsset(context, assetId, payload = {}) {
    const scope = this.buildSocietyScope(context);
    const asset = await Asset.findOne({ _id: assetId, societyId: scope.societyId });

    if (!asset) {
      throw ApiError.notFound('Asset not found.');
    }

    if (asset.status !== 'lost') {
      throw ApiError.badRequest(`Asset is not marked as lost (current status: [${asset.status}]).`);
    }

    asset.status = 'active';
    asset.condition = payload.condition || 'good';
    asset.remarks = payload.remarks
      ? `RECOVERED: ${payload.remarks}`
      : 'Asset recovered and restored to active inventory.';
    await asset.save();

    await InventoryTransaction.create({
      itemMasterId: asset.itemMasterId,
      assetId: asset._id,
      locationType: asset.currentLocationType,
      locationId: asset.currentLocationId,
      type: 'ADJUSTMENT',
      quantity: 1,
      performedBy: context.userId,
      remarks: `Recovered lost asset [${asset.assetTag}]`
    });

    return this.getAssetById(context, asset._id);
  }
}

export const assetService = new AssetService();
