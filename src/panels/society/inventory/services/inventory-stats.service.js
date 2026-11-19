import mongoose from 'mongoose';
import { ApiError } from '../../../../common/api.error.js';
import Stock from '../models/stocks.model.js';
import Asset from '../models/Itemsasset.model.js';
import CentralInventory from '../models/centralInventory.model.js';
import InventoryItems from '../models/inventoryItem.model.js';
import Category from '../models/category.model.js';
import Subcategory from '../models/subcategory.model.js';
import Vendor from '../models/vendor.model.js';
import Request from '../models/request.model.js';
import Transfer from '../models/transfer.model.js';
import StockAdjustment from '../models/stockAdjustment.model.js';
import InventoryTransaction from '../models/inventoryTransaction.model.js';

export class InventoryStatsService {
  buildSocietyScope(context) {
    if (!context?.bankId) {
      throw ApiError.forbidden('A valid society bank context is required.');
    }
    return { societyId: new mongoose.Types.ObjectId(String(context.bankId)) };
  }

  getDateThreshold(period = '30d') {
    const now = new Date();
    if (period === '7d') {
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
    if (period === '90d') {
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    }
    if (period === 'all') {
      return new Date(0);
    }
    // Default 30 days
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  // ==========================================
  // 1. CENTRAL INVENTORY STATS
  // ==========================================
  async getCentralInventoryStats(context, query = {}) {
    const scope = this.buildSocietyScope(context);
    const dateThreshold = this.getDateThreshold(query.period);

    const warehouseFilter = { societyId: scope.societyId };
    const stockMatch = { societyId: scope.societyId, locationType: 'CentralInventory' };
    const assetMatch = { societyId: scope.societyId, currentLocationType: 'CentralInventory' };
    const txMatch = {
      locationType: 'CentralInventory',
      type: 'STOCK_IN',
      createdAt: { $gte: dateThreshold }
    };

    if (query.centralInventoryId) {
      const warehouseId = new mongoose.Types.ObjectId(String(query.centralInventoryId));
      warehouseFilter._id = warehouseId;
      stockMatch.locationId = warehouseId;
      assetMatch.currentLocationId = warehouseId;
      txMatch.locationId = warehouseId;
    }

    const [
      totalWarehouses,
      activeWarehouses,
      stockStats,
      assetStats,
      inboundStats,
      categoryDistribution
    ] = await Promise.all([
      CentralInventory.countDocuments(warehouseFilter),
      CentralInventory.countDocuments({ ...warehouseFilter, status: 'active' }),

      // Aggregate Stock at Central
      Stock.aggregate([
        { $match: stockMatch },
        {
          $group: {
            _id: null,
            totalQuantity: { $sum: '$quantity' },
            totalReservedQuantity: { $sum: '$reservedQuantity' },
            totalUniqueSKUs: { $addToSet: '$itemMasterId' },
            outOfStockCount: {
              $sum: { $cond: [{ $eq: ['$quantity', 0] }, 1, 0] }
            },
            lowStockCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gt: ['$quantity', 0] },
                      { $lte: ['$quantity', 10] }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        },
        {
          $project: {
            _id: 0,
            totalQuantity: 1,
            totalReservedQuantity: 1,
            availableQuantity: { $subtract: ['$totalQuantity', '$totalReservedQuantity'] },
            totalUniqueSKUs: { $size: '$totalUniqueSKUs' },
            outOfStockCount: 1,
            lowStockCount: 1
          }
        }
      ]),

      // Aggregate Serialized Assets at Central
      Asset.aggregate([
        { $match: assetMatch },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),

      // Inbound Volume in the selected period
      InventoryTransaction.aggregate([
        { $match: txMatch },
        {
          $group: {
            _id: null,
            inboundTransactionsCount: { $sum: 1 },
            totalUnitsReceived: { $sum: '$quantity' }
          }
        }
      ]),

      // Stock by Category at Central
      Stock.aggregate([
        { $match: stockMatch },
        {
          $lookup: {
            from: 'inventoryitems',
            localField: 'itemMasterId',
            foreignField: '_id',
            as: 'item'
          }
        },
        { $unwind: '$item' },
        {
          $lookup: {
            from: 'inventorycategories',
            localField: 'item.categoryId',
            foreignField: '_id',
            as: 'category'
          }
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$item.categoryId',
            categoryName: { $first: { $ifNull: ['$category.name', 'Uncategorized'] } },
            categoryCode: { $first: { $ifNull: ['$category.code', 'N/A'] } },
            totalUnits: { $sum: '$quantity' },
            uniqueSkus: { $addToSet: '$itemMasterId' }
          }
        },
        {
          $project: {
            _id: 0,
            categoryId: '$_id',
            categoryName: 1,
            categoryCode: 1,
            totalUnits: 1,
            uniqueSkusCount: { $size: '$uniqueSkus' }
          }
        },
        { $sort: { totalUnits: -1 } },
        { $limit: 10 }
      ])
    ]);

    const stockSummary = stockStats[0] || {
      totalQuantity: 0,
      totalReservedQuantity: 0,
      availableQuantity: 0,
      totalUniqueSKUs: 0,
      outOfStockCount: 0,
      lowStockCount: 0
    };

    const assetSummary = {
      total: 0,
      active: 0,
      inRepair: 0,
      retired: 0,
      lost: 0
    };

    for (const stat of assetStats) {
      assetSummary.total += stat.count;
      if (stat._id === 'active') assetSummary.active = stat.count;
      else if (stat._id === 'in_repair') assetSummary.inRepair = stat.count;
      else if (stat._id === 'retired') assetSummary.retired = stat.count;
      else if (stat._id === 'lost') assetSummary.lost = stat.count;
    }

    const inboundSummary = inboundStats[0] || {
      inboundTransactionsCount: 0,
      totalUnitsReceived: 0
    };

    return {
      warehouses: {
        total: totalWarehouses,
        active: activeWarehouses
      },
      stock: stockSummary,
      serializedAssets: assetSummary,
      inboundActivity: {
        period: query.period || '30d',
        ...inboundSummary
      },
      categoryDistribution
    };
  }

  // ==========================================
  // 2. BRANCH INVENTORY STATS
  // ==========================================
  async getBranchInventoryStats(context, query = {}) {
    const scope = this.buildSocietyScope(context);

    // Enforce branch scope if not society owner/admin
    let targetBranchId = query.branchId ? new mongoose.Types.ObjectId(String(query.branchId)) : null;
    if (context.branchId && !context.isBankOwner) {
      targetBranchId = new mongoose.Types.ObjectId(String(context.branchId));
    }

    const stockMatch = { societyId: scope.societyId, locationType: 'Branch' };
    const assetMatch = { societyId: scope.societyId, currentLocationType: 'Branch' };
    const requestMatch = { societyId: scope.societyId };
    const inboundTransferMatch = { societyId: scope.societyId, toLocationType: 'Branch', status: 'DISPATCHED' };
    const outboundTransferMatch = { societyId: scope.societyId, fromLocationType: 'Branch', status: 'DISPATCHED' };
    const adjustmentMatch = { societyId: scope.societyId, locationType: 'Branch', status: 'PENDING' };

    if (targetBranchId) {
      stockMatch.locationId = targetBranchId;
      assetMatch.currentLocationId = targetBranchId;
      requestMatch.branchId = targetBranchId;
      inboundTransferMatch.toLocationId = targetBranchId;
      outboundTransferMatch.fromLocationId = targetBranchId;
      adjustmentMatch.locationId = targetBranchId;
    }

    const [
      stockStats,
      assetStats,
      assignedAssetCount,
      requisitionStats,
      inboundTransfersCount,
      outboundTransfersCount,
      pendingAdjustmentsCount
    ] = await Promise.all([
      // Branch Stock summary
      Stock.aggregate([
        { $match: stockMatch },
        {
          $group: {
            _id: null,
            totalQuantity: { $sum: '$quantity' },
            totalReservedQuantity: { $sum: '$reservedQuantity' },
            totalUniqueSKUs: { $addToSet: '$itemMasterId' },
            lowStockCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gt: ['$quantity', 0] },
                      { $lte: ['$quantity', 5] }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        },
        {
          $project: {
            _id: 0,
            totalQuantity: 1,
            totalReservedQuantity: 1,
            availableQuantity: { $subtract: ['$totalQuantity', '$totalReservedQuantity'] },
            totalUniqueSKUs: { $size: '$totalUniqueSKUs' },
            lowStockCount: 1
          }
        }
      ]),

      // Assets at Branch
      Asset.aggregate([
        { $match: assetMatch },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),

      // Assets currently assigned to employees in branch
      Asset.countDocuments({
        ...assetMatch,
        currentEmployeeId: { $ne: null }
      }),

      // Branch Requisitions breakdown by status
      Request.aggregate([
        { $match: requestMatch },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),

      // In-transit incoming transfers
      Transfer.countDocuments(inboundTransferMatch),

      // In-transit outgoing transfers
      Transfer.countDocuments(outboundTransferMatch),

      // Pending stock adjustments
      StockAdjustment.countDocuments(adjustmentMatch)
    ]);

    const stockSummary = stockStats[0] || {
      totalQuantity: 0,
      totalReservedQuantity: 0,
      availableQuantity: 0,
      totalUniqueSKUs: 0,
      lowStockCount: 0
    };

    const assetSummary = {
      totalInBranch: 0,
      assignedToEmployees: assignedAssetCount,
      availableInCustody: 0,
      inRepair: 0,
      retired: 0,
      lost: 0
    };

    for (const stat of assetStats) {
      assetSummary.totalInBranch += stat.count;
      if (stat._id === 'in_repair') assetSummary.inRepair = stat.count;
      else if (stat._id === 'retired') assetSummary.retired = stat.count;
      else if (stat._id === 'lost') assetSummary.lost = stat.count;
    }
    assetSummary.availableInCustody = Math.max(0, assetSummary.totalInBranch - assignedAssetCount - assetSummary.inRepair - assetSummary.retired - assetSummary.lost);

    const requisitions = {
      pending: 0,
      approved: 0,
      fulfilled: 0,
      rejected: 0,
      total: 0
    };
    for (const req of requisitionStats) {
      requisitions.total += req.count;
      if (req._id === 'PENDING') requisitions.pending = req.count;
      else if (req._id === 'APPROVED') requisitions.approved = req.count;
      else if (req._id === 'FULFILLED') requisitions.fulfilled = req.count;
      else if (req._id === 'REJECTED') requisitions.rejected = req.count;
    }

    return {
      branchId: targetBranchId ? String(targetBranchId) : 'ALL_BRANCHES',
      stock: stockSummary,
      assets: assetSummary,
      requisitions,
      transfers: {
        inboundInTransit: inboundTransfersCount,
        outboundInTransit: outboundTransfersCount
      },
      stockAdjustments: {
        pendingApproval: pendingAdjustmentsCount
      }
    };
  }

  // ==========================================
  // 3. CONSOLIDATED OVERALL INVENTORY STATS
  // ==========================================
  async getOverallInventoryStats(context) {
    const scope = this.buildSocietyScope(context);

    const [
      categoriesCount,
      subcategoriesCount,
      itemsCount,
      vendorsCount,
      warehousesCount,
      stockByLocation,
      assetBreakdown,
      pendingRequestsCount,
      pendingTransfersCount,
      pendingAdjustmentsCount
    ] = await Promise.all([
      Category.countDocuments({ societyId: scope.societyId }),
      Subcategory.countDocuments({ societyId: scope.societyId }),
      InventoryItems.countDocuments({ societyId: scope.societyId }),
      Vendor.countDocuments({ societyId: scope.societyId }),
      CentralInventory.countDocuments({ societyId: scope.societyId }),

      // Stock split: Central vs Branch
      Stock.aggregate([
        { $match: { societyId: scope.societyId } },
        {
          $group: {
            _id: '$locationType',
            totalQuantity: { $sum: '$quantity' },
            totalReservedQuantity: { $sum: '$reservedQuantity' }
          }
        }
      ]),

      // Overall Assets status breakdown
      Asset.aggregate([
        { $match: { societyId: scope.societyId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),

      // Pending action badge counts
      Request.countDocuments({ societyId: scope.societyId, status: 'PENDING' }),
      Transfer.countDocuments({ societyId: scope.societyId, status: 'PENDING' }),
      StockAdjustment.countDocuments({ societyId: scope.societyId, status: 'PENDING' })
    ]);

    let centralStockQty = 0;
    let centralReservedQty = 0;
    let branchStockQty = 0;
    let branchReservedQty = 0;

    for (const loc of stockByLocation) {
      if (loc._id === 'CentralInventory') {
        centralStockQty = loc.totalQuantity;
        centralReservedQty = loc.totalReservedQuantity;
      } else if (loc._id === 'Branch') {
        branchStockQty = loc.totalQuantity;
        branchReservedQty = loc.totalReservedQuantity;
      }
    }

    const assets = {
      total: 0,
      active: 0,
      inRepair: 0,
      retired: 0,
      lost: 0
    };
    for (const stat of assetBreakdown) {
      assets.total += stat.count;
      if (stat._id === 'active') assets.active = stat.count;
      else if (stat._id === 'in_repair') assets.inRepair = stat.count;
      else if (stat._id === 'retired') assets.retired = stat.count;
      else if (stat._id === 'lost') assets.lost = stat.count;
    }

    return {
      overview: {
        totalCategories: categoriesCount,
        totalSubcategories: subcategoriesCount,
        totalMasterSKUs: itemsCount,
        totalVendors: vendorsCount,
        totalCentralWarehouses: warehousesCount
      },
      stockDistribution: {
        totalSocietyStockUnits: centralStockQty + branchStockQty,
        centralStock: {
          quantity: centralStockQty,
          reservedQuantity: centralReservedQty,
          availableQuantity: Math.max(0, centralStockQty - centralReservedQty)
        },
        branchStock: {
          quantity: branchStockQty,
          reservedQuantity: branchReservedQty,
          availableQuantity: Math.max(0, branchStockQty - branchReservedQty)
        }
      },
      assets,
      pendingActions: {
        requisitionsAwaitingApproval: pendingRequestsCount,
        transfersAwaitingApproval: pendingTransfersCount,
        stockAdjustmentsAwaitingApproval: pendingAdjustmentsCount
      }
    };
  }
}

export const inventoryStatsService = new InventoryStatsService();
