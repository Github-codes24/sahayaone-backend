import { ApiError } from '../../../../common/api.error.js';
import Request from '../models/request.model.js';
import RequestItem from '../models/requestedItem.model.js';
import InventoryItems from '../models/inventoryItem.model.js';
import Stock from '../models/stocks.model.js';
import Asset from '../models/Itemsasset.model.js';
import AssetsAssignment from '../models/assetsAssignment.model.js';
import InventoryTransaction from '../models/inventoryTransaction.model.js';

export class BranchRequestService {
  buildSocietyScope(context) {
    if (!context?.bankId) {
      throw ApiError.forbidden('A valid society bank context is required.');
    }
    return { societyId: context.bankId };
  }

  resolveBranchId(context, explicitBranchId) {
    const branchId = explicitBranchId || context.branchId;
    if (!branchId) {
      throw ApiError.badRequest('A valid Branch ID is required.');
    }
    return branchId;
  }

  // --- 1. Create Requisition Header + Line Items ---
  async createRequest(context, payload) {
    const scope = this.buildSocietyScope(context);
    const branchId = this.resolveBranchId(context, payload.branchId);

    // Validate SKU Item Masters exist in society
    const itemIds = payload.items.map((i) => i.itemMasterId);
    const existingItems = await InventoryItems.find({
      _id: { $in: itemIds },
      societyId: scope.societyId
    }).lean();

    if (existingItems.length !== itemIds.length) {
      throw ApiError.badRequest('One or more requested inventory item SKUs do not exist.');
    }

    const request = await Request.create({
      societyId: scope.societyId,
      employeeId: context.userId,
      branchId,
      status: 'PENDING',
      remarks: payload.remarks || ''
    });

    const requestItemsToInsert = payload.items.map((item) => ({
      requestId: request._id,
      itemMasterId: item.itemMasterId,
      quantity: item.quantity,
      status: 'PENDING'
    }));

    await RequestItem.insertMany(requestItemsToInsert);

    const items = await RequestItem.find({ requestId: request._id })
      .populate('itemMasterId', 'name code unit type isSerialized')
      .lean();

    return {
      ...request.toObject(),
      items
    };
  }

  // --- 2. List Requisitions with Role Scoping ---
  async listRequests(context, query = {}) {
    const scope = this.buildSocietyScope(context);
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 10);
    const skip = (page - 1) * limit;

    const filter = { societyId: scope.societyId };

    // Branch scoping
    if (query.branchId) {
      filter.branchId = query.branchId;
    } else if (context.branchId && !context.isBankOwner) {
      filter.branchId = context.branchId;
    }

    // Employee self-scoping
    if (context.isEmployee && !context.isBranchManager && !context.isBankOwner) {
      filter.employeeId = context.userId;
    } else if (query.employeeId) {
      filter.employeeId = query.employeeId;
    }

    if (query.status) {
      filter.status = query.status;
    }

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [requests, totalRecords] = await Promise.all([
      Request.find(filter)
        .populate('employeeId', 'fullName email phoneNumber')
        .populate('branchId', 'name code branchCode')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      Request.countDocuments(filter)
    ]);

    // Attach items for each request
    const requestIds = requests.map((r) => r._id);
    const allItems = await RequestItem.find({ requestId: { $in: requestIds } })
      .populate('itemMasterId', 'name code unit isSerialized')
      .lean();

    const itemsByRequest = allItems.reduce((acc, item) => {
      const key = String(item.requestId);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});

    const enriched = requests.map((r) => ({
      ...r,
      items: itemsByRequest[String(r._id)] || []
    }));

    const totalPages = Math.max(1, Math.ceil(totalRecords / limit));
    return {
      items: enriched,
      meta: { totalRecords, limit, page, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 }
    };
  }

  // --- 3. Get Request Details by ID ---
  async getRequestById(context, requestId) {
    const scope = this.buildSocietyScope(context);
    const request = await Request.findOne({ _id: requestId, societyId: scope.societyId })
      .populate('employeeId', 'fullName email phoneNumber')
      .populate('branchId', 'name code branchCode')
      .lean();

    if (!request) {
      throw ApiError.notFound('Requisition request not found.');
    }

    // Ownership check for employees: can only view own requests
    if (context.isEmployee && !context.isBranchManager && !context.isBankOwner) {
      const ownerId = request.employeeId?._id ? request.employeeId._id.toString() : request.employeeId.toString();
      if (ownerId !== context.userId.toString()) {
        throw ApiError.forbidden('Access denied. You can only view your own requisition requests.');
      }
    }

    const items = await RequestItem.find({ requestId: request._id })
      .populate('itemMasterId', 'name code unit type brand model isSerialized')
      .lean();

    return {
      ...request,
      items
    };
  }

  // --- 4. Approve Requisition (Branch Manager Authority) ---
  async approveRequest(context, requestId, payload = {}) {
    const scope = this.buildSocietyScope(context);
    const request = await Request.findOne({ _id: requestId, societyId: scope.societyId });

    if (!request) {
      throw ApiError.notFound('Requisition request not found.');
    }

    if (request.status !== 'PENDING') {
      throw ApiError.badRequest(`Cannot approve request with current status [${request.status}].`);
    }

    request.status = 'APPROVED';
    if (payload.remarks) {
      request.remarks = request.remarks
        ? `${request.remarks} | Approval note: ${payload.remarks}`
        : payload.remarks;
    }
    await request.save();

    await RequestItem.updateMany({ requestId: request._id }, { $set: { status: 'APPROVED' } });

    return this.getRequestById(context, requestId);
  }

  // --- 5. Reject Requisition (Branch Manager Authority) ---
  async rejectRequest(context, requestId, payload = {}) {
    const scope = this.buildSocietyScope(context);
    const request = await Request.findOne({ _id: requestId, societyId: scope.societyId });

    if (!request) {
      throw ApiError.notFound('Requisition request not found.');
    }

    if (request.status !== 'PENDING') {
      throw ApiError.badRequest(`Cannot reject request with current status [${request.status}].`);
    }

    request.status = 'REJECTED';
    if (payload.remarks) {
      request.remarks = request.remarks
        ? `${request.remarks} | Rejection reason: ${payload.remarks}`
        : payload.remarks;
    }
    await request.save();

    await RequestItem.updateMany({ requestId: request._id }, { $set: { status: 'REJECTED' } });

    return this.getRequestById(context, requestId);
  }

  // --- 5b. Cancel Requisition (Requester Self-Cancel) ---
  async cancelRequest(context, requestId, payload = {}) {
    const scope = this.buildSocietyScope(context);
    const request = await Request.findOne({ _id: requestId, societyId: scope.societyId });

    if (!request) {
      throw ApiError.notFound('Requisition request not found.');
    }

    // Ownership check: only the requester or manager can cancel
    if (context.isEmployee && !context.isBranchManager && !context.isBankOwner) {
      if (request.employeeId.toString() !== context.userId.toString()) {
        throw ApiError.forbidden('Access denied. You can only cancel your own requisition request.');
      }
    }

    if (request.status !== 'PENDING') {
      throw ApiError.badRequest(`Cannot cancel request with current status [${request.status}]. Only PENDING requests can be cancelled.`);
    }

    request.status = 'CANCELLED';
    if (payload.remarks) {
      request.remarks = request.remarks
        ? `${request.remarks} | Cancellation reason: ${payload.remarks}`
        : payload.remarks;
    }
    await request.save();

    await RequestItem.updateMany({ requestId: request._id }, { $set: { status: 'CANCELLED' } });

    return this.getRequestById(context, requestId);
  }

  // --- 6. Fulfill / Issue Request ---
  // Stock Available ➔ ISSUE to Employee
  // Stock Missing ➔ Returns 422 with missingItems details to trigger TRANSFER
  async fulfillRequest(context, requestId, payload = {}) {
    const scope = this.buildSocietyScope(context);
    const request = await Request.findOne({ _id: requestId, societyId: scope.societyId });

    if (!request) {
      throw ApiError.notFound('Requisition request not found.');
    }

    if (request.status === 'FULFILLED') {
      throw ApiError.badRequest('Requisition request is already fulfilled.');
    }

    if (request.status === 'REJECTED') {
      throw ApiError.badRequest('Cannot fulfill a rejected requisition.');
    }

    const requestItems = await RequestItem.find({ requestId: request._id })
      .populate('itemMasterId')
      .lean();

    if (!requestItems || requestItems.length === 0) {
      throw ApiError.badRequest('No line items found for this requisition.');
    }

    const branchId = request.branchId;
    const missingItems = [];
    const stockItemsToDeduct = [];
    const assetsToAssign = [];

    // Parse explicit assetTag mappings if provided
    const assetTagMapping = (payload.assetTagMapping || []).reduce((acc, m) => {
      acc[String(m.itemMasterId)] = m.assetTags || [];
      return acc;
    }, {});

    for (const line of requestItems) {
      const itemMaster = line.itemMasterId;
      const requestedQty = line.quantity;

      if (!itemMaster.isSerialized) {
        // Consumable Item Stock check
        const currentStock = await Stock.findOne({
          societyId: scope.societyId,
          itemMasterId: itemMaster._id,
          locationType: 'Branch',
          locationId: branchId
        }).lean();

        const availableQty = currentStock ? Math.max(0, currentStock.quantity - (currentStock.reservedQuantity || 0)) : 0;

        if (availableQty < requestedQty) {
          missingItems.push({
            itemMasterId: itemMaster._id,
            name: itemMaster.name,
            code: itemMaster.code,
            isSerialized: false,
            requestedQuantity: requestedQty,
            availableQuantity: availableQty,
            shortageQuantity: requestedQty - availableQty
          });
        } else {
          stockItemsToDeduct.push({ itemMasterId: itemMaster._id, quantity: requestedQty });
        }
      } else {
        // Serialized Asset check
        let candidateAssets = [];
        const mappedTags = assetTagMapping[String(itemMaster._id)];

        if (mappedTags && mappedTags.length > 0) {
          if (mappedTags.length !== requestedQty) {
            throw ApiError.badRequest(
              `Item [${itemMaster.name}] requires exactly ${requestedQty} asset tag(s), but ${mappedTags.length} provided.`
            );
          }
          candidateAssets = await Asset.find({
            societyId: scope.societyId,
            itemMasterId: itemMaster._id,
            currentLocationType: 'Branch',
            currentLocationId: branchId,
            status: 'active',
            assetTag: { $in: mappedTags }
          });

          if (candidateAssets.length !== requestedQty) {
            throw ApiError.badRequest(
              `One or more specified asset tags for [${itemMaster.name}] are not available at this branch.`
            );
          }
        } else {
          // Auto-pick available assets from branch
          candidateAssets = await Asset.find({
            societyId: scope.societyId,
            itemMasterId: itemMaster._id,
            currentLocationType: 'Branch',
            currentLocationId: branchId,
            status: 'active'
          }).limit(requestedQty);
        }

        if (candidateAssets.length < requestedQty) {
          missingItems.push({
            itemMasterId: itemMaster._id,
            name: itemMaster.name,
            code: itemMaster.code,
            isSerialized: true,
            requestedQuantity: requestedQty,
            availableQuantity: candidateAssets.length,
            shortageQuantity: requestedQty - candidateAssets.length
          });
        } else {
          assetsToAssign.push({ itemMasterId: itemMaster._id, assets: candidateAssets });
        }
      }
    }

    // If stock is missing, notify caller to initiate Transfer
    if (missingItems.length > 0) {
      throw new ApiError(
        422,
        'Stock missing at branch. Please initiate an inter-location transfer to fulfill this requisition.',
        { stockAvailable: false, missingItems }
      );
    }

    // Fulfill Consumables
    for (const deduct of stockItemsToDeduct) {
      await Stock.updateOne(
        {
          societyId: scope.societyId,
          itemMasterId: deduct.itemMasterId,
          locationType: 'Branch',
          locationId: branchId
        },
        {
          $inc: { quantity: -deduct.quantity }
        }
      );

      await InventoryTransaction.create({
        itemMasterId: deduct.itemMasterId,
        locationType: 'Branch',
        locationId: branchId,
        type: 'ISSUE',
        quantity: deduct.quantity,
        referenceType: 'Request',
        referenceId: request._id,
        performedBy: context.userId,
        remarks: payload.remarks || `Issued ${deduct.quantity} unit(s) against Requisition #${request._id}`
      });
    }

    // Fulfill Serialized Assets
    const assignedTags = [];
    for (const group of assetsToAssign) {
      for (const asset of group.assets) {
        asset.currentLocationType = 'User';
        asset.currentLocationId = request.employeeId;
        asset.currentEmployeeId = request.employeeId;
        await asset.save();

        await AssetsAssignment.create({
          assetId: asset._id,
          employeeId: request.employeeId,
          branchId,
          assignedBy: context.userId,
          assignedAt: new Date(),
          condition: asset.condition || 'good',
          remarks: payload.remarks || `Assigned against Requisition #${request._id}`
        });

        await InventoryTransaction.create({
          itemMasterId: asset.itemMasterId,
          assetId: asset._id,
          locationType: 'User',
          locationId: request.employeeId,
          type: 'ISSUE',
          quantity: 1,
          referenceType: 'Request',
          referenceId: request._id,
          performedBy: context.userId,
          remarks: `Issued asset [${asset.assetTag}] to Employee`
        });

        assignedTags.push(asset.assetTag);
      }
    }

    // Mark Request as FULFILLED
    request.status = 'FULFILLED';
    await request.save();
    await RequestItem.updateMany({ requestId: request._id }, { $set: { status: 'FULFILLED' } });

    return {
      success: true,
      requestId: request._id,
      status: 'FULFILLED',
      assignedAssetsCount: assignedTags.length,
      assignedAssetTags: assignedTags,
      message: 'Requisition fulfilled and stock/assets successfully issued to employee.'
    };
  }

  // --- 7. Direct Counter Issue (Without prior requisition) ---
  async directIssue(context, payload) {
    const scope = this.buildSocietyScope(context);
    const branchId = this.resolveBranchId(context, payload.branchId);

    const item = await InventoryItems.findOne({ _id: payload.itemMasterId, societyId: scope.societyId });
    if (!item) {
      throw ApiError.notFound('Inventory SKU item not found.');
    }

    const qty = payload.quantity;

    if (!item.isSerialized) {
      // Consumable direct issue
      const stock = await Stock.findOne({
        societyId: scope.societyId,
        itemMasterId: item._id,
        locationType: 'Branch',
        locationId: branchId
      });

      if (!stock || stock.quantity < qty) {
        throw ApiError.badRequest(
          `Insufficient stock at branch. Available: ${stock?.quantity || 0}, Requested: ${qty}.`
        );
      }

      stock.quantity -= qty;
      await stock.save();

      const transaction = await InventoryTransaction.create({
        itemMasterId: item._id,
        locationType: 'Branch',
        locationId: branchId,
        type: 'ISSUE',
        quantity: qty,
        performedBy: context.userId,
        remarks: payload.remarks || `Direct counter issue of ${qty} ${item.unit} to employee`
      });

      return {
        item: { id: item._id, name: item.name, code: item.code, isSerialized: false },
        quantityIssued: qty,
        remainingBranchStock: stock.quantity,
        transactionId: transaction._id
      };
    } else {
      // Serialized asset direct issue
      const tags = payload.assetTags || [];
      if (tags.length !== qty) {
        throw ApiError.badRequest(`Exactly ${qty} asset tag(s) required for serialized item [${item.name}].`);
      }

      const candidateAssets = await Asset.find({
        societyId: scope.societyId,
        itemMasterId: item._id,
        currentLocationType: 'Branch',
        currentLocationId: branchId,
        status: 'active',
        assetTag: { $in: tags }
      });

      if (candidateAssets.length !== qty) {
        throw ApiError.badRequest('One or more specified asset tags are not available at this branch.');
      }

      const assignedAssets = [];
      for (const asset of candidateAssets) {
        asset.currentLocationType = 'User';
        asset.currentLocationId = payload.employeeId;
        asset.currentEmployeeId = payload.employeeId;
        await asset.save();

        await AssetsAssignment.create({
          assetId: asset._id,
          employeeId: payload.employeeId,
          branchId,
          assignedBy: context.userId,
          assignedAt: new Date(),
          condition: asset.condition || 'good',
          remarks: payload.remarks || 'Direct counter asset assignment'
        });

        await InventoryTransaction.create({
          itemMasterId: asset.itemMasterId,
          assetId: asset._id,
          locationType: 'User',
          locationId: payload.employeeId,
          type: 'ISSUE',
          quantity: 1,
          performedBy: context.userId,
          remarks: `Direct counter issue of asset [${asset.assetTag}] to employee`
        });

        assignedAssets.push({ id: asset._id, assetTag: asset.assetTag });
      }

      return {
        item: { id: item._id, name: item.name, code: item.code, isSerialized: true },
        quantityIssued: qty,
        assignedAssets
      };
    }
  }
}

export const branchRequestService = new BranchRequestService();
