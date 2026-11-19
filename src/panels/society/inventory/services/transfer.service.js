import { ApiError } from '../../../../common/api.error.js';
import Transfer from '../models/transfer.model.js';
import TransferItem from '../models/transferItem.model.js';
import InventoryItems from '../models/inventoryItem.model.js';
import Stock from '../models/stocks.model.js';
import Asset from '../models/Itemsasset.model.js';
import InventoryTransaction from '../models/inventoryTransaction.model.js';

export class TransferService {
  buildSocietyScope(context) {
    if (!context?.bankId) {
      throw ApiError.forbidden('A valid society bank context is required.');
    }
    return { societyId: context.bankId };
  }

  // --- 1. Create Inter-Location Transfer Request ---
  async createTransfer(context, payload) {
    const scope = this.buildSocietyScope(context);

    // Prevent transfer between identical locations
    if (
      payload.fromLocationType === payload.toLocationType &&
      String(payload.fromLocationId) === String(payload.toLocationId)
    ) {
      throw ApiError.badRequest('Origin and destination locations cannot be identical.');
    }

    // Verify item masters
    const itemIds = payload.items.map((i) => i.itemMasterId);
    const existingItems = await InventoryItems.find({
      _id: { $in: itemIds },
      societyId: scope.societyId
    }).lean();

    if (existingItems.length !== itemIds.length) {
      throw ApiError.badRequest('One or more transfer items do not exist.');
    }

    const transfer = await Transfer.create({
      societyId: scope.societyId,
      fromLocationType: payload.fromLocationType,
      fromLocationId: payload.fromLocationId,
      toLocationType: payload.toLocationType,
      toLocationId: payload.toLocationId,
      requestedBy: context.userId,
      status: 'PENDING',
      remarks: payload.remarks || ''
    });

    const transferItemsToInsert = payload.items.map((item) => ({
      transferId: transfer._id,
      itemMasterId: item.itemMasterId,
      quantity: item.quantity
    }));

    await TransferItem.insertMany(transferItemsToInsert);

    return this.getTransferById(context, transfer._id);
  }

  // --- 2. List Transfers ---
  async listTransfers(context, query = {}) {
    const scope = this.buildSocietyScope(context);
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;

    const filter = { societyId: scope.societyId };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.fromLocationId) {
      filter.fromLocationId = query.fromLocationId;
    }

    if (query.toLocationId) {
      filter.toLocationId = query.toLocationId;
    }

    // Branch scoping: if branch manager/officer, show transfers where their branch is either origin or destination
    if (context.branchId && !context.isBankOwner) {
      filter.$or = [
        { fromLocationId: context.branchId },
        { toLocationId: context.branchId }
      ];
    }

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [transfers, totalRecords] = await Promise.all([
      Transfer.find(filter)
        .populate('requestedBy', 'fullName email phoneNumber')
        .populate('fromLocationId', 'name code address')
        .populate('toLocationId', 'name code address')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transfer.countDocuments(filter)
    ]);

    const transferIds = transfers.map((t) => t._id);
    const allItems = await TransferItem.find({ transferId: { $in: transferIds } })
      .populate('itemMasterId', 'name code unit isSerialized')
      .lean();

    const itemsByTransfer = allItems.reduce((acc, item) => {
      const key = String(item.transferId);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});

    const enriched = transfers.map((t) => ({
      ...t,
      items: itemsByTransfer[String(t._id)] || []
    }));

    const totalPages = Math.max(1, Math.ceil(totalRecords / limit));
    return {
      items: enriched,
      meta: { totalRecords, limit, page, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 }
    };
  }

  // --- 3. Get Transfer By ID ---
  async getTransferById(context, transferId) {
    const scope = this.buildSocietyScope(context);
    const transfer = await Transfer.findOne({ _id: transferId, societyId: scope.societyId })
      .populate('requestedBy', 'fullName email phoneNumber')
      .populate('fromLocationId', 'name code address')
      .populate('toLocationId', 'name code address')
      .lean();

    if (!transfer) {
      throw ApiError.notFound('Transfer request not found.');
    }

    const items = await TransferItem.find({ transferId: transfer._id })
      .populate('itemMasterId', 'name code unit type brand model isSerialized')
      .lean();

    return {
      ...transfer,
      items
    };
  }

  // --- 4. Approve Transfer (Manager / Admin) ---
  async approveTransfer(context, transferId, payload = {}) {
    const scope = this.buildSocietyScope(context);
    const transfer = await Transfer.findOne({ _id: transferId, societyId: scope.societyId });

    if (!transfer) {
      throw ApiError.notFound('Transfer request not found.');
    }

    if (transfer.status !== 'PENDING') {
      throw ApiError.badRequest(`Cannot approve transfer with current status [${transfer.status}].`);
    }

    transfer.status = 'APPROVED';
    if (payload.remarks) {
      transfer.remarks = transfer.remarks
        ? `${transfer.remarks} | Approval note: ${payload.remarks}`
        : payload.remarks;
    }
    await transfer.save();

    return this.getTransferById(context, transfer._id);
  }

  // --- 5. Reject Transfer (Manager / Admin) ---
  async rejectTransfer(context, transferId, payload = {}) {
    const scope = this.buildSocietyScope(context);
    const transfer = await Transfer.findOne({ _id: transferId, societyId: scope.societyId });

    if (!transfer) {
      throw ApiError.notFound('Transfer request not found.');
    }

    if (transfer.status !== 'PENDING') {
      throw ApiError.badRequest(`Cannot reject transfer with current status [${transfer.status}].`);
    }

    transfer.status = 'REJECTED';
    if (payload.remarks) {
      transfer.remarks = transfer.remarks
        ? `${transfer.remarks} | Rejection reason: ${payload.remarks}`
        : payload.remarks;
    }
    await transfer.save();

    return this.getTransferById(context, transfer._id);
  }

  // --- 6. Dispatch Transfer (Origin Location) ---
  async dispatchTransfer(context, transferId, payload = {}) {
    const scope = this.buildSocietyScope(context);
    const transfer = await Transfer.findOne({ _id: transferId, societyId: scope.societyId });

    if (!transfer) {
      throw ApiError.notFound('Transfer request not found.');
    }

    if (transfer.status !== 'APPROVED') {
      throw ApiError.badRequest(`Cannot dispatch transfer with current status [${transfer.status}]. Must be APPROVED.`);
    }

    const items = await TransferItem.find({ transferId: transfer._id }).populate('itemMasterId');
    if (!items || items.length === 0) {
      throw ApiError.badRequest('No line items found in transfer.');
    }

    const assetTagsMapping = (payload.assetTagsMapping || []).reduce((acc, m) => {
      acc[String(m.itemMasterId)] = m.assetTags || [];
      return acc;
    }, {});

    // Verify stock at origin and deduct/reserve
    for (const line of items) {
      const itemMaster = line.itemMasterId;
      const qty = line.quantity;

      if (!itemMaster.isSerialized) {
        // Consumable item check at origin
        const originStock = await Stock.findOne({
          societyId: scope.societyId,
          itemMasterId: itemMaster._id,
          locationType: transfer.fromLocationType,
          locationId: transfer.fromLocationId
        });

        if (!originStock || originStock.quantity < qty) {
          throw ApiError.badRequest(
            `Insufficient stock at origin for [${itemMaster.name}]. Available: ${originStock?.quantity || 0}, Required: ${qty}.`
          );
        }

        originStock.quantity -= qty;
        await originStock.save();

        await InventoryTransaction.create({
          itemMasterId: itemMaster._id,
          locationType: transfer.fromLocationType,
          locationId: transfer.fromLocationId,
          type: 'TRANSFER',
          quantity: qty,
          referenceType: 'Transfer',
          referenceId: transfer._id,
          performedBy: context.userId,
          remarks: `Dispatched ${qty} unit(s) for Transfer #${transfer._id}`
        });
      } else {
        // Serialized asset dispatch
        const tags = assetTagsMapping[String(itemMaster._id)] || [];
        if (tags.length !== qty) {
          throw ApiError.badRequest(
            `Item [${itemMaster.name}] requires exactly ${qty} asset tags for dispatch, but received ${tags.length}.`
          );
        }

        const assets = await Asset.find({
          societyId: scope.societyId,
          itemMasterId: itemMaster._id,
          currentLocationType: transfer.fromLocationType,
          currentLocationId: transfer.fromLocationId,
          status: 'active',
          assetTag: { $in: tags }
        });

        if (assets.length !== qty) {
          throw ApiError.badRequest(
            `One or more asset tags for [${itemMaster.name}] are not available at the origin location.`
          );
        }

        // Set status to in_repair / in_transit or retain notes
        for (const asset of assets) {
          asset.remarks = `Dispatched in Transfer #${transfer._id}`;
          await asset.save();

          await InventoryTransaction.create({
            itemMasterId: itemMaster._id,
            assetId: asset._id,
            locationType: transfer.fromLocationType,
            locationId: transfer.fromLocationId,
            type: 'TRANSFER',
            quantity: 1,
            referenceType: 'Transfer',
            referenceId: transfer._id,
            performedBy: context.userId,
            remarks: `Dispatched asset [${asset.assetTag}] for Transfer #${transfer._id}`
          });
        }
      }
    }

    transfer.status = 'DISPATCHED';
    if (payload.remarks) {
      transfer.remarks = transfer.remarks
        ? `${transfer.remarks} | Dispatch note: ${payload.remarks}`
        : payload.remarks;
    }
    await transfer.save();

    return this.getTransferById(context, transfer._id);
  }

  // --- 7. Receive Transfer (Destination Location) ---
  async receiveTransfer(context, transferId, payload = {}) {
    const scope = this.buildSocietyScope(context);
    const transfer = await Transfer.findOne({ _id: transferId, societyId: scope.societyId });

    if (!transfer) {
      throw ApiError.notFound('Transfer request not found.');
    }

    if (transfer.status !== 'DISPATCHED') {
      throw ApiError.badRequest(
        `Cannot receive transfer with current status [${transfer.status}]. Must be DISPATCHED.`
      );
    }

    const items = await TransferItem.find({ transferId: transfer._id }).populate('itemMasterId');

    for (const line of items) {
      const itemMaster = line.itemMasterId;
      const qty = line.quantity;

      if (!itemMaster.isSerialized) {
        // Consumable stock added to destination
        await Stock.findOneAndUpdate(
          {
            societyId: scope.societyId,
            itemMasterId: itemMaster._id,
            locationType: transfer.toLocationType,
            locationId: transfer.toLocationId
          },
          {
            $inc: { quantity: qty }
          },
          { upsert: true, new: true }
        );

        await InventoryTransaction.create({
          itemMasterId: itemMaster._id,
          locationType: transfer.toLocationType,
          locationId: transfer.toLocationId,
          type: 'TRANSFER',
          quantity: qty,
          referenceType: 'Transfer',
          referenceId: transfer._id,
          performedBy: context.userId,
          remarks: `Received ${qty} unit(s) from Transfer #${transfer._id}`
        });
      } else {
        // Serialized assets relocated to destination
        const dispatchedAssets = await Asset.find({
          societyId: scope.societyId,
          itemMasterId: itemMaster._id,
          remarks: { $regex: `Transfer #${transfer._id}` }
        });

        for (const asset of dispatchedAssets) {
          asset.currentLocationType = transfer.toLocationType;
          asset.currentLocationId = transfer.toLocationId;
          asset.currentEmployeeId = null;
          asset.status = 'active';
          asset.remarks = `Received at destination from Transfer #${transfer._id}`;
          await asset.save();

          await InventoryTransaction.create({
            itemMasterId: itemMaster._id,
            assetId: asset._id,
            locationType: transfer.toLocationType,
            locationId: transfer.toLocationId,
            type: 'TRANSFER',
            quantity: 1,
            referenceType: 'Transfer',
            referenceId: transfer._id,
            performedBy: context.userId,
            remarks: `Received asset [${asset.assetTag}] at destination from Transfer #${transfer._id}`
          });
        }
      }
    }

    transfer.status = 'RECEIVED';
    if (payload.remarks) {
      transfer.remarks = transfer.remarks
        ? `${transfer.remarks} | Receipt note: ${payload.remarks}`
        : payload.remarks;
    }
    await transfer.save();

    return this.getTransferById(context, transfer._id);
  }
}

export const transferService = new TransferService();
