import { ApiError } from '../../../../common/api.error.js';
import StockAdjustment from '../models/stockAdjustment.model.js';
import Stock from '../models/stocks.model.js';
import Asset from '../models/Itemsasset.model.js';
import InventoryItems from '../models/inventoryItem.model.js';
import InventoryTransaction from '../models/inventoryTransaction.model.js';

export class StockAdjustmentService {
  buildSocietyScope(context) {
    if (!context?.bankId) {
      throw ApiError.forbidden('A valid society bank context is required.');
    }
    return { societyId: context.bankId };
  }

  // --- 1. Create Stock Adjustment Request ---
  async createStockAdjustment(context, payload) {
    const scope = this.buildSocietyScope(context);
    const branchId = payload.branchId || context.branchId;

    if (!branchId) {
      throw ApiError.badRequest('A valid Branch ID is required.');
    }

    const item = await InventoryItems.findOne({ _id: payload.itemMasterId, societyId: scope.societyId });
    if (!item) {
      throw ApiError.notFound('Inventory SKU item not found.');
    }

    if (payload.assetId) {
      const asset = await Asset.findOne({ _id: payload.assetId, societyId: scope.societyId });
      if (!asset) {
        throw ApiError.notFound('Referenced asset not found.');
      }
    }

    const locationType = payload.locationType || 'Branch';
    const locationId = payload.locationId || branchId;

    const adjustment = await StockAdjustment.create({
      societyId: scope.societyId,
      branchId,
      itemMasterId: item._id,
      assetId: payload.assetId || null,
      locationType,
      locationId,
      adjustmentType: payload.adjustmentType,
      quantity: payload.quantity,
      reason: payload.reason,
      status: 'PENDING',
      requestedBy: context.userId,
      remarks: payload.remarks || ''
    });

    return this.getAdjustmentById(context, adjustment._id);
  }

  // --- 2. List Stock Adjustments ---
  async listStockAdjustments(context, query = {}) {
    const scope = this.buildSocietyScope(context);
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;

    const filter = { societyId: scope.societyId };

    if (query.branchId) {
      filter.branchId = query.branchId;
    } else if (context.branchId && !context.isBankOwner) {
      filter.branchId = context.branchId;
    }

    if (query.status) filter.status = query.status;
    if (query.reason) filter.reason = query.reason;
    if (query.adjustmentType) filter.adjustmentType = query.adjustmentType;

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [items, totalRecords] = await Promise.all([
      StockAdjustment.find(filter)
        .populate('itemMasterId', 'name code unit isSerialized')
        .populate('assetId', 'assetTag serialNumber status condition')
        .populate('requestedBy', 'fullName email phoneNumber')
        .populate('approvedBy', 'fullName email phoneNumber')
        .populate('branchId', 'name code')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      StockAdjustment.countDocuments(filter)
    ]);

    const totalPages = Math.max(1, Math.ceil(totalRecords / limit));
    return {
      items,
      meta: { totalRecords, limit, page, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 }
    };
  }

  // --- 3. Get Stock Adjustment by ID ---
  async getAdjustmentById(context, adjustmentId) {
    const scope = this.buildSocietyScope(context);
    const adjustment = await StockAdjustment.findOne({ _id: adjustmentId, societyId: scope.societyId })
      .populate('itemMasterId', 'name code unit isSerialized')
      .populate('assetId', 'assetTag serialNumber status condition')
      .populate('requestedBy', 'fullName email phoneNumber')
      .populate('approvedBy', 'fullName email phoneNumber')
      .populate('branchId', 'name code')
      .lean();

    if (!adjustment) {
      throw ApiError.notFound('Stock adjustment request not found.');
    }

    return adjustment;
  }

  // --- 4. Approve Stock Adjustment (Branch Manager Authority) ---
  async approveAdjustment(context, adjustmentId, payload = {}) {
    const scope = this.buildSocietyScope(context);
    const adjustment = await StockAdjustment.findOne({ _id: adjustmentId, societyId: scope.societyId });

    if (!adjustment) {
      throw ApiError.notFound('Stock adjustment request not found.');
    }

    if (adjustment.status !== 'PENDING') {
      throw ApiError.badRequest(`Cannot approve adjustment with current status [${adjustment.status}].`);
    }

    const qtyChange = adjustment.adjustmentType === 'INCREASE' ? adjustment.quantity : -adjustment.quantity;

    // Apply change to stock
    await Stock.findOneAndUpdate(
      {
        societyId: scope.societyId,
        itemMasterId: adjustment.itemMasterId,
        locationType: adjustment.locationType,
        locationId: adjustment.locationId
      },
      {
        $inc: { quantity: qtyChange }
      },
      { upsert: true, new: true }
    );

    // If linked to an asset, update asset operational status
    if (adjustment.assetId) {
      const asset = await Asset.findById(adjustment.assetId);
      if (asset) {
        if (adjustment.reason === 'DAMAGE') {
          asset.status = 'retired';
          asset.condition = 'scrapped';
        } else if (adjustment.reason === 'LOST') {
          asset.status = 'lost';
        } else if (adjustment.reason === 'RECOVERY') {
          asset.status = 'active';
          asset.condition = 'good';
        }
        await asset.save();
      }
    }

    adjustment.status = 'APPROVED';
    adjustment.approvedBy = context.userId;
    if (payload.remarks) {
      adjustment.remarks = adjustment.remarks
        ? `${adjustment.remarks} | Approved: ${payload.remarks}`
        : payload.remarks;
    }
    await adjustment.save();

    // Log transaction
    await InventoryTransaction.create({
      itemMasterId: adjustment.itemMasterId,
      assetId: adjustment.assetId || null,
      locationType: adjustment.locationType,
      locationId: adjustment.locationId,
      type: 'ADJUSTMENT',
      quantity: adjustment.quantity,
      referenceType: 'StockAdjustment',
      referenceId: adjustment._id,
      performedBy: context.userId,
      remarks: `Approved ${adjustment.adjustmentType} adjustment of ${adjustment.quantity} unit(s) due to ${adjustment.reason}`
    });

    return this.getAdjustmentById(context, adjustment._id);
  }

  // --- 5. Reject Stock Adjustment (Branch Manager Authority) ---
  async rejectAdjustment(context, adjustmentId, payload = {}) {
    const scope = this.buildSocietyScope(context);
    const adjustment = await StockAdjustment.findOne({ _id: adjustmentId, societyId: scope.societyId });

    if (!adjustment) {
      throw ApiError.notFound('Stock adjustment request not found.');
    }

    if (adjustment.status !== 'PENDING') {
      throw ApiError.badRequest(`Cannot reject adjustment with current status [${adjustment.status}].`);
    }

    adjustment.status = 'REJECTED';
    adjustment.approvedBy = context.userId;
    if (payload.remarks) {
      adjustment.remarks = adjustment.remarks
        ? `${adjustment.remarks} | Rejected: ${payload.remarks}`
        : payload.remarks;
    }
    await adjustment.save();

    return this.getAdjustmentById(context, adjustment._id);
  }

  // --- 6. Update Stock Adjustment (PENDING only) ---
  async updateStockAdjustment(context, adjustmentId, payload) {
    const scope = this.buildSocietyScope(context);
    const adjustment = await StockAdjustment.findOne({ _id: adjustmentId, societyId: scope.societyId });

    if (!adjustment) {
      throw ApiError.notFound('Stock adjustment request not found.');
    }

    if (adjustment.status !== 'PENDING') {
      throw ApiError.badRequest(
        `Cannot edit a stock adjustment with status [${adjustment.status}]. Only PENDING adjustments can be modified.`
      );
    }

    if (payload.assetId !== undefined) {
      if (payload.assetId) {
        const asset = await Asset.findOne({ _id: payload.assetId, societyId: scope.societyId });
        if (!asset) {
          throw ApiError.notFound('Referenced asset not found.');
        }
        adjustment.assetId = payload.assetId;
      } else {
        adjustment.assetId = null;
      }
    }

    if (payload.quantity !== undefined) adjustment.quantity = payload.quantity;
    if (payload.adjustmentType !== undefined) adjustment.adjustmentType = payload.adjustmentType;
    if (payload.reason !== undefined) adjustment.reason = payload.reason;
    if (payload.remarks !== undefined) adjustment.remarks = payload.remarks;

    await adjustment.save();
    return this.getAdjustmentById(context, adjustment._id);
  }

  // --- 7. Delete / Cancel Stock Adjustment (PENDING only) ---
  async deleteStockAdjustment(context, adjustmentId) {
    const scope = this.buildSocietyScope(context);
    const adjustment = await StockAdjustment.findOne({ _id: adjustmentId, societyId: scope.societyId });

    if (!adjustment) {
      throw ApiError.notFound('Stock adjustment request not found.');
    }

    if (adjustment.status !== 'PENDING') {
      throw ApiError.badRequest(
        `Cannot delete a stock adjustment with status [${adjustment.status}]. Approved or rejected adjustments are permanent ledger records.`
      );
    }

    await StockAdjustment.findByIdAndDelete(adjustmentId);
    return { id: adjustmentId, deleted: true, message: 'Pending stock adjustment request deleted/cancelled successfully.' };
  }
}

export const stockAdjustmentService = new StockAdjustmentService();

