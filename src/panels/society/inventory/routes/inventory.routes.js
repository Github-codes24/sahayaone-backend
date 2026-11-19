import { Router } from 'express';
import { validateRequest } from '../../../../middlewares/request-validator.middleware.js';
import { rbacMiddleware } from '../../../../middlewares/rbac.middleware.js';
import { resolveSocietyContext } from '../../middlewares/society-context.middleware.js';
import { requireSocietyPermission } from '../../middlewares/society-permission.middleware.js';
import { INVENTORY_PERMISSIONS } from '../../../../constants/inventory-permission.constant.js';

import { inventoryController } from '../controllers/inventory.controller.js';
import { catalogController } from '../controllers/catalog.controller.js';
import { vendorController } from '../controllers/vendor.controller.js';
import { centralStockController } from '../controllers/central-stock.controller.js';
import { branchRequestController } from '../controllers/branch-request.controller.js';
import { transferController } from '../controllers/transfer.controller.js';
import { assetController } from '../controllers/asset.controller.js';
import { stockAdjustmentController } from '../controllers/stock-adjustment.controller.js';
import { inventoryStatsController } from '../controllers/inventory-stats.controller.js';

import {
  createInventorySchema,
  updateInventorySchema,
  inventoryListSchema,
  inventoryIdSchema
} from '../validators/inventory.validator.js';

import {
  mongoIdParamSchema,
  createCategorySchema,
  updateCategorySchema,
  categoryListSchema,
  createSubcategorySchema,
  updateSubcategorySchema,
  subcategoryListSchema,
  createItemSchema,
  updateItemSchema,
  itemListSchema
} from '../validators/catalog.validator.js';

import {
  createVendorSchema,
  updateVendorSchema,
  vendorListSchema,
  vendorIdSchema
} from '../validators/vendor.validator.js';

import {
  centralInventoryIdSchema,
  createCentralInventorySchema,
  updateCentralInventorySchema,
  centralInventoryListSchema,
  receiveStockSchema
} from '../validators/central-stock.validator.js';

import {
  createBranchRequestSchema,
  branchRequestListSchema,
  branchRequestIdParamSchema,
  approveRejectRequestSchema,
  cancelBranchRequestSchema,
  fulfillRequestSchema,
  directIssueSchema
} from '../validators/branch-request.validator.js';

import {
  createTransferSchema,
  transferListSchema,
  transferIdParamSchema,
  approveRejectTransferSchema,
  dispatchTransferSchema,
  receiveTransferSchema
} from '../validators/transfer.validator.js';

import {
  createAssetSchema,
  assetListSchema,
  assetIdParamSchema,
  assignAssetSchema,
  returnAssetSchema,
  reportDamageSchema,
  repairCompleteSchema,
  requestDisposalSchema,
  approveDisposalSchema,
  reportLostSchema,
  recoverAssetSchema
} from '../validators/asset.validator.js';

import {
  createStockAdjustmentSchema,
  updateStockAdjustmentSchema,
  stockAdjustmentListSchema,
  stockAdjustmentIdParamSchema,
  approveRejectAdjustmentSchema
} from '../validators/stock-adjustment.validator.js';

import {
  centralStatsQuerySchema,
  branchStatsQuerySchema,
  overallStatsQuerySchema
} from '../validators/inventory-stats.validator.js';

const router = Router();
router.use(rbacMiddleware.requireAuth, resolveSocietyContext);

// ==========================================
// 0. INVENTORY STATS & OVERVIEW ROUTES
// ==========================================
router.get(
  '/stats/overview',
  requireSocietyPermission(INVENTORY_PERMISSIONS.INVENTORY_REPORT.VIEW),
  validateRequest(overallStatsQuerySchema),
  inventoryStatsController.getOverallStats
);
router.get(
  '/stats/central',
  requireSocietyPermission(INVENTORY_PERMISSIONS.CENTRAL_STOCK.VIEW),
  validateRequest(centralStatsQuerySchema),
  inventoryStatsController.getCentralStats
);
router.get(
  '/stats/branch',
  requireSocietyPermission(INVENTORY_PERMISSIONS.BRANCH_REQUEST.VIEW),
  validateRequest(branchStatsQuerySchema),
  inventoryStatsController.getBranchStats
);

// ==========================================
// 1. CATALOG ROUTES (`CATALOG` module)
// ==========================================
// Category endpoints
router.post(
  '/categories',
  requireSocietyPermission(INVENTORY_PERMISSIONS.CATALOG.CREATE),
  validateRequest(createCategorySchema),
  catalogController.createCategory
);
router.get(
  '/categories',
  requireSocietyPermission(INVENTORY_PERMISSIONS.CATALOG.VIEW),
  validateRequest(categoryListSchema),
  catalogController.listCategories  
);
router.get(
  '/categories/:id',
  requireSocietyPermission(INVENTORY_PERMISSIONS.CATALOG.VIEW),
  validateRequest(mongoIdParamSchema),
  catalogController.getCategoryById
);
router.put(
  '/categories/:id',
  requireSocietyPermission(INVENTORY_PERMISSIONS.CATALOG.UPDATE),
  validateRequest(updateCategorySchema),
  catalogController.updateCategory
);
router.delete(
  '/categories/:id',
  requireSocietyPermission(INVENTORY_PERMISSIONS.CATALOG.DELETE),
  validateRequest(mongoIdParamSchema),
  catalogController.deleteCategory
);

// Subcategory endpoints
router.post(
  '/subcategories',
  requireSocietyPermission(INVENTORY_PERMISSIONS.CATALOG.CREATE),
  validateRequest(createSubcategorySchema),
  catalogController.createSubcategory
);
router.get(
  '/subcategories',
  requireSocietyPermission(INVENTORY_PERMISSIONS.CATALOG.VIEW),
  validateRequest(subcategoryListSchema),
  catalogController.listSubcategories
);
router.get(
  '/subcategories/:id',
  requireSocietyPermission(INVENTORY_PERMISSIONS.CATALOG.VIEW),
  validateRequest(mongoIdParamSchema),
  catalogController.getSubcategoryById
);
router.put(
  '/subcategories/:id',
  requireSocietyPermission(INVENTORY_PERMISSIONS.CATALOG.UPDATE),
  validateRequest(updateSubcategorySchema),
  catalogController.updateSubcategory
);
router.delete(
  '/subcategories/:id',
  requireSocietyPermission(INVENTORY_PERMISSIONS.CATALOG.DELETE),
  validateRequest(mongoIdParamSchema),
  catalogController.deleteSubcategory
);

// Master Item SKU endpoints
router.post(
  '/items',
  requireSocietyPermission(INVENTORY_PERMISSIONS.CATALOG.CREATE),
  validateRequest(createItemSchema),
  catalogController.createItem
);
router.get(
  '/items',
  requireSocietyPermission(INVENTORY_PERMISSIONS.CATALOG.VIEW),
  validateRequest(itemListSchema),
  catalogController.listItems
);
router.get(
  '/items/:id',
  requireSocietyPermission(INVENTORY_PERMISSIONS.CATALOG.VIEW),
  validateRequest(mongoIdParamSchema),
  catalogController.getItemById
);
router.put(
  '/items/:id',
  requireSocietyPermission(INVENTORY_PERMISSIONS.CATALOG.UPDATE),
  validateRequest(updateItemSchema),
  catalogController.updateItem
);
router.delete(
  '/items/:id',
  requireSocietyPermission(INVENTORY_PERMISSIONS.CATALOG.DELETE),
  validateRequest(mongoIdParamSchema),
  catalogController.deleteItem
);

// ==========================================
// 2. VENDOR ROUTES (`VENDOR` module)
// ==========================================
router.post(
  '/vendors',
  requireSocietyPermission(INVENTORY_PERMISSIONS.VENDOR.CREATE),
  validateRequest(createVendorSchema),
  vendorController.createVendor
);
router.get(
  '/vendors',
  requireSocietyPermission(INVENTORY_PERMISSIONS.VENDOR.VIEW),
  validateRequest(vendorListSchema),
  vendorController.listVendors
);
router.get(
  '/vendors/:id',
  requireSocietyPermission(INVENTORY_PERMISSIONS.VENDOR.VIEW),
  validateRequest(vendorIdSchema),
  vendorController.getVendorById
);
router.put(
  '/vendors/:id',
  requireSocietyPermission(INVENTORY_PERMISSIONS.VENDOR.UPDATE),
  validateRequest(updateVendorSchema),
  vendorController.updateVendor
);
router.delete(
  '/vendors/:id',
  requireSocietyPermission(INVENTORY_PERMISSIONS.VENDOR.DELETE),
  validateRequest(vendorIdSchema),
  vendorController.deleteVendor
);

// ==========================================
// 3. CENTRAL STOCK ROUTES (`CENTRAL_STOCK` module)
// ==========================================
router.post(
  '/central',
  requireSocietyPermission(INVENTORY_PERMISSIONS.CENTRAL_STOCK.CREATE),
  validateRequest(createCentralInventorySchema),
  centralStockController.createCentralInventory
);
router.get(
  '/central',
  requireSocietyPermission(INVENTORY_PERMISSIONS.CENTRAL_STOCK.VIEW),
  validateRequest(centralInventoryListSchema),
  centralStockController.listCentralInventories
);
router.get(
  '/central/:id',
  requireSocietyPermission(INVENTORY_PERMISSIONS.CENTRAL_STOCK.VIEW),
  validateRequest(centralInventoryIdSchema),
  centralStockController.getCentralInventoryById
);
router.put(
  '/central/:id',
  requireSocietyPermission(INVENTORY_PERMISSIONS.CENTRAL_STOCK.UPDATE),
  validateRequest(updateCentralInventorySchema),
  centralStockController.updateCentralInventory
);
router.delete(
  '/central/:id',
  requireSocietyPermission(INVENTORY_PERMISSIONS.CENTRAL_STOCK.DELETE),
  validateRequest(centralInventoryIdSchema),
  centralStockController.deleteCentralInventory
);
router.post(
  '/central/stock-in',
  requireSocietyPermission(INVENTORY_PERMISSIONS.CENTRAL_STOCK.RECEIVE),
  validateRequest(receiveStockSchema),
  centralStockController.receiveStock
);
router.post(
  '/stock/central/receive',
  requireSocietyPermission(INVENTORY_PERMISSIONS.CENTRAL_STOCK.RECEIVE),
  validateRequest(receiveStockSchema),
  centralStockController.receiveStock
);
router.post(
  '/central/receive',
  requireSocietyPermission(INVENTORY_PERMISSIONS.CENTRAL_STOCK.RECEIVE),
  validateRequest(receiveStockSchema),
  centralStockController.receiveStock
);


// ==========================================
// 4. REQUISITION & ISSUE ROUTES (`BRANCH_REQUEST` / `EMPLOYEE_REQUEST` module)
// ==========================================
// Create requisition (Staff Member / Branch Officer / Branch Manager)
router.post(
  '/branch/requests',
  requireSocietyPermission([
    INVENTORY_PERMISSIONS.BRANCH_REQUEST.CREATE,
    INVENTORY_PERMISSIONS.EMPLOYEE_REQUEST.CREATE
  ]),
  validateRequest(createBranchRequestSchema),
  branchRequestController.createRequest
);
router.post(
  '/requests',
  requireSocietyPermission([
    INVENTORY_PERMISSIONS.BRANCH_REQUEST.CREATE,
    INVENTORY_PERMISSIONS.EMPLOYEE_REQUEST.CREATE
  ]),
  validateRequest(createBranchRequestSchema),
  branchRequestController.createRequest
);

// List requisitions (Self-scoped for employees; Branch-scoped for managers; Society-wide for admin)
router.get(
  '/branch/requests',
  requireSocietyPermission([
    INVENTORY_PERMISSIONS.BRANCH_REQUEST.VIEW,
    INVENTORY_PERMISSIONS.EMPLOYEE_REQUEST.VIEW
  ]),
  validateRequest(branchRequestListSchema),
  branchRequestController.listRequests
);
router.get(
  '/requests',
  requireSocietyPermission([
    INVENTORY_PERMISSIONS.BRANCH_REQUEST.VIEW,
    INVENTORY_PERMISSIONS.EMPLOYEE_REQUEST.VIEW
  ]),
  validateRequest(branchRequestListSchema),
  branchRequestController.listRequests
);

// Get requisition by ID (Ownership protected for employees)
router.get(
  '/branch/requests/:id',
  requireSocietyPermission([
    INVENTORY_PERMISSIONS.BRANCH_REQUEST.VIEW,
    INVENTORY_PERMISSIONS.EMPLOYEE_REQUEST.VIEW
  ]),
  validateRequest(branchRequestIdParamSchema),
  branchRequestController.getRequestById
);
router.get(
  '/requests/:id',
  requireSocietyPermission([
    INVENTORY_PERMISSIONS.BRANCH_REQUEST.VIEW,
    INVENTORY_PERMISSIONS.EMPLOYEE_REQUEST.VIEW
  ]),
  validateRequest(branchRequestIdParamSchema),
  branchRequestController.getRequestById
);

// Cancel requisition (Requester self-cancel / Manager)
router.post(
  '/branch/requests/:id/cancel',
  requireSocietyPermission([
    INVENTORY_PERMISSIONS.BRANCH_REQUEST.CREATE,
    INVENTORY_PERMISSIONS.EMPLOYEE_REQUEST.CREATE
  ]),
  validateRequest(cancelBranchRequestSchema),
  branchRequestController.cancelRequest
);
router.post(
  '/requests/:id/cancel',
  requireSocietyPermission([
    INVENTORY_PERMISSIONS.BRANCH_REQUEST.CREATE,
    INVENTORY_PERMISSIONS.EMPLOYEE_REQUEST.CREATE
  ]),
  validateRequest(cancelBranchRequestSchema),
  branchRequestController.cancelRequest
);

// Approve requisition (Branch Manager / Admin Authority)
router.post(
  '/branch/requests/:id/approve',
  requireSocietyPermission(INVENTORY_PERMISSIONS.BRANCH_REQUEST.APPROVE),
  validateRequest(approveRejectRequestSchema),
  branchRequestController.approveRequest
);
// Reject requisition (Branch Manager / Admin Authority)
router.post(
  '/branch/requests/:id/reject',
  requireSocietyPermission(INVENTORY_PERMISSIONS.BRANCH_REQUEST.REJECT),
  validateRequest(approveRejectRequestSchema),
  branchRequestController.rejectRequest
);
// Fulfill requisition (Issue available branch stock/asset to employee)
router.post(
  '/branch/requests/:id/fulfill',
  requireSocietyPermission(INVENTORY_PERMISSIONS.BRANCH_REQUEST.ISSUE),
  validateRequest(fulfillRequestSchema),
  branchRequestController.fulfillRequest
);
// Direct counter issue (Officer / Manager)
router.post(
  '/branch/issues/direct',
  requireSocietyPermission(INVENTORY_PERMISSIONS.BRANCH_REQUEST.ISSUE),
  validateRequest(directIssueSchema),
  branchRequestController.directIssue
);

// ==========================================
// 5. INTER-LOCATION TRANSFER ROUTES (`TRANSFER` module)
// ==========================================
// Create transfer request (Warehouse ➔ Branch or Branch ➔ Branch)
router.post(
  '/transfers',
  requireSocietyPermission(INVENTORY_PERMISSIONS.TRANSFER.CREATE),
  validateRequest(createTransferSchema),
  transferController.createTransfer
);
// List transfers
router.get(
  '/transfers',
  requireSocietyPermission(INVENTORY_PERMISSIONS.TRANSFER.VIEW),
  validateRequest(transferListSchema),
  transferController.listTransfers
);
// Get transfer by ID
router.get(
  '/transfers/:id',
  requireSocietyPermission(INVENTORY_PERMISSIONS.TRANSFER.VIEW),
  validateRequest(transferIdParamSchema),
  transferController.getTransferById
);
// Approve transfer (Manager / Admin Authority)
router.post(
  '/transfers/:id/approve',
  requireSocietyPermission(INVENTORY_PERMISSIONS.TRANSFER.APPROVE),
  validateRequest(approveRejectTransferSchema),
  transferController.approveTransfer
);
// Reject transfer (Manager / Admin Authority)
router.post(
  '/transfers/:id/reject',
  requireSocietyPermission(INVENTORY_PERMISSIONS.TRANSFER.APPROVE),
  validateRequest(approveRejectTransferSchema),
  transferController.rejectTransfer
);
// Dispatch transfer from origin
router.post(
  '/transfers/:id/dispatch',
  requireSocietyPermission(INVENTORY_PERMISSIONS.TRANSFER.DISPATCH),
  validateRequest(dispatchTransferSchema),
  transferController.dispatchTransfer
);
// Receive transfer at destination
router.post(
  '/transfers/:id/receive',
  requireSocietyPermission(INVENTORY_PERMISSIONS.TRANSFER.RECEIVE),
  validateRequest(receiveTransferSchema),
  transferController.receiveTransfer
);

// ==========================================
// 6. ASSET LIFECYCLE ROUTES (`ASSET` module)
// ==========================================
// Create / Register Asset directly
router.post(
  '/assets',
  requireSocietyPermission(INVENTORY_PERMISSIONS.ASSET.CREATE),
  validateRequest(createAssetSchema),
  assetController.createAsset
);

// List assets (General & Self-scoped for Employee)
router.get(
  '/assets',
  requireSocietyPermission(INVENTORY_PERMISSIONS.ASSET.VIEW),
  validateRequest(assetListSchema),
  assetController.listAssets
);
router.get(
  '/my-assets',
  requireSocietyPermission(INVENTORY_PERMISSIONS.ASSET.VIEW),
  validateRequest(assetListSchema),
  assetController.listAssets
);

// Get asset by ID + history
router.get(
  '/assets/:id',
  requireSocietyPermission(INVENTORY_PERMISSIONS.ASSET.VIEW),
  validateRequest(assetIdParamSchema),
  assetController.getAssetById
);
// Assign asset to employee
router.post(
  '/assets/assign',
  requireSocietyPermission(INVENTORY_PERMISSIONS.ASSET.ASSIGN),
  validateRequest(assignAssetSchema),
  assetController.assignAsset
);
// Return asset from employee (➔ AVAILABLE)
router.post(
  '/assets/:id/return',
  requireSocietyPermission(INVENTORY_PERMISSIONS.ASSET.RETURN),
  validateRequest(returnAssetSchema),
  assetController.returnAsset
);
router.post(
  '/my-assets/:id/return',
  requireSocietyPermission(INVENTORY_PERMISSIONS.ASSET.RETURN),
  validateRequest(returnAssetSchema),
  assetController.returnAsset
);
// Report damage (➔ MAINTENANCE / in_repair)
router.post(
  '/assets/:id/report-damage',
  requireSocietyPermission(INVENTORY_PERMISSIONS.ASSET.UPDATE),
  validateRequest(reportDamageSchema),
  assetController.reportDamage
);
// Repair complete (➔ AVAILABLE)
router.post(
  '/assets/:id/repair-complete',
  requireSocietyPermission(INVENTORY_PERMISSIONS.ASSET.UPDATE),
  validateRequest(repairCompleteSchema),
  assetController.repairComplete
);
// Request disposal (Officer recommends scrap)
router.post(
  '/assets/:id/request-disposal',
  requireSocietyPermission(INVENTORY_PERMISSIONS.ASSET.REQUEST_DISPOSE),
  validateRequest(requestDisposalSchema),
  assetController.requestDisposal
);
// Approve disposal (Branch Manager / Admin Authority ➔ DISPOSED / scrapped)
router.post(
  '/assets/:id/approve-disposal',
  requireSocietyPermission(INVENTORY_PERMISSIONS.ASSET.DISPOSE),
  validateRequest(approveDisposalSchema),
  assetController.approveDisposal
);
// Report lost (➔ INVESTIGATION / lost)
router.post(
  '/assets/:id/report-lost',
  requireSocietyPermission(INVENTORY_PERMISSIONS.ASSET.UPDATE),
  validateRequest(reportLostSchema),
  assetController.reportLost
);
// Recover asset (➔ AVAILABLE)
router.post(
  '/assets/:id/recover',
  requireSocietyPermission(INVENTORY_PERMISSIONS.ASSET.UPDATE),
  validateRequest(recoverAssetSchema),
  assetController.recoverAsset
);

// ==========================================
// 7. STOCK ADJUSTMENT ROUTES (`STOCK_ADJUSTMENT` module)
// ==========================================
// Create stock adjustment request (Officer / Manager)
router.post(
  '/stock-adjustments',
  requireSocietyPermission(INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT.CREATE),
  validateRequest(createStockAdjustmentSchema),
  stockAdjustmentController.createStockAdjustment
);
// List stock adjustments
router.get(
  '/stock-adjustments',
  requireSocietyPermission(INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT.VIEW),
  validateRequest(stockAdjustmentListSchema),
  stockAdjustmentController.listStockAdjustments
);
// Get stock adjustment by ID
router.get(
  '/stock-adjustments/:id',
  requireSocietyPermission(INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT.VIEW),
  validateRequest(stockAdjustmentIdParamSchema),
  stockAdjustmentController.getAdjustmentById
);
// Edit stock adjustment (PENDING only)
router.put(
  '/stock-adjustments/:id',
  requireSocietyPermission(INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT.UPDATE),
  validateRequest(updateStockAdjustmentSchema),
  stockAdjustmentController.updateStockAdjustment
);
// Delete / Cancel stock adjustment (PENDING only)
router.delete(
  '/stock-adjustments/:id',
  requireSocietyPermission(INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT.DELETE),
  validateRequest(stockAdjustmentIdParamSchema),
  stockAdjustmentController.deleteStockAdjustment
);
// Approve stock adjustment (Branch Manager Authority)
router.post(
  '/stock-adjustments/:id/approve',
  requireSocietyPermission(INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT.APPROVE),
  validateRequest(approveRejectAdjustmentSchema),
  stockAdjustmentController.approveAdjustment
);
// Reject stock adjustment (Branch Manager Authority)
router.post(
  '/stock-adjustments/:id/reject',
  requireSocietyPermission(INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT.APPROVE),
  validateRequest(approveRejectAdjustmentSchema),
  stockAdjustmentController.rejectAdjustment
);

// ==========================================
// 8. LEGACY INVENTORY ROUTES
// ==========================================
router.get('/export', requireSocietyPermission('inventory.view'), validateRequest(inventoryListSchema), inventoryController.exportCsv);
router.get('/', requireSocietyPermission('inventory.view'), validateRequest(inventoryListSchema), inventoryController.list);
router.post('/', requireSocietyPermission('inventory.create'), validateRequest(createInventorySchema), inventoryController.create);
router.put('/:id', requireSocietyPermission('inventory.update'), validateRequest({ ...inventoryIdSchema, ...updateInventorySchema }), inventoryController.update);
router.delete('/:id', requireSocietyPermission('inventory.delete'), validateRequest(inventoryIdSchema), inventoryController.remove);

export default router;
