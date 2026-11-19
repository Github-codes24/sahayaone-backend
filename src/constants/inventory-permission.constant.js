export const INVENTORY_PERMISSIONS = Object.freeze({
    CATALOG: {
        VIEW: 'inventory_catalog.view',
        CREATE: 'inventory_catalog.create',
        UPDATE: 'inventory_catalog.update',
        DELETE: 'inventory_catalog.delete'
    },
    VENDOR: {
        VIEW: 'vendor.view',
        CREATE: 'vendor.create',
        UPDATE: 'vendor.update',
        DELETE: 'vendor.delete'
    },
    CENTRAL_STOCK: {
        VIEW: 'central_stock.view',
        CREATE: 'central_stock.create',
        UPDATE: 'central_stock.update',
        DELETE: 'central_stock.delete',
        RECEIVE: 'central_stock.receive',
        DISPATCH: 'central_stock.dispatch'
    },
    BRANCH_REQUEST: {
        VIEW: 'branch_request.view',
        CREATE: 'branch_request.create',
        APPROVE: 'branch_request.approve',
        REJECT: 'branch_request.reject',
        ISSUE: 'branch_request.issue'
    },
    TRANSFER: {
        VIEW: 'transfer.view',
        CREATE: 'transfer.create',
        APPROVE: 'transfer.approve',
        DISPATCH: 'transfer.dispatch',
        RECEIVE: 'transfer.receive'
    },
    ASSET: {
        VIEW: 'asset.view',
        CREATE: 'asset.create',
        ASSIGN: 'asset.assign',
        RETURN: 'asset.return',
        UPDATE: 'asset.update',       // covers "mark damaged / condition update"
        DISPOSE: 'asset.dispose',
        REQUEST_DISPOSE: 'asset.request_dispose'
    },
    STOCK_ADJUSTMENT: {
        VIEW: 'stock_adjustment.view',
        CREATE: 'stock_adjustment.create',
        UPDATE: 'stock_adjustment.update',
        DELETE: 'stock_adjustment.delete',
        APPROVE: 'stock_adjustment.approve'
    },
    EMPLOYEE_REQUEST: {
        VIEW: 'employee_request.view',
        CREATE: 'employee_request.create',
        APPROVE: 'employee_request.approve',
        REJECT: 'employee_request.reject'
    },
    INVENTORY_REPORT: {
        VIEW: 'inventory_report.view',
        EXPORT: 'inventory_report.export'
    }
});

export const ALL_INVENTORY_PERMISSIONS = Object.values(INVENTORY_PERMISSIONS).flatMap((mod) =>
    Object.values(mod)
);

export const getAvailableInventoryPermissionsGrouped = () => {
    return {
        modules: [
            {
                module: 'inventory_catalog',
                label: 'Inventory Catalog',
                permissions: [
                    { key: INVENTORY_PERMISSIONS.CATALOG.VIEW, label: 'View' },
                    { key: INVENTORY_PERMISSIONS.CATALOG.CREATE, label: 'Create' },
                    { key: INVENTORY_PERMISSIONS.CATALOG.UPDATE, label: 'Edit' },
                    { key: INVENTORY_PERMISSIONS.CATALOG.DELETE, label: 'Delete' }
                ]
            },
            {
                module: 'vendor',
                label: 'Vendor Management',
                permissions: [
                    { key: INVENTORY_PERMISSIONS.VENDOR.VIEW, label: 'View' },
                    { key: INVENTORY_PERMISSIONS.VENDOR.CREATE, label: 'Create' },
                    { key: INVENTORY_PERMISSIONS.VENDOR.UPDATE, label: 'Edit' },
                    { key: INVENTORY_PERMISSIONS.VENDOR.DELETE, label: 'Delete' }
                ]
            },
            {
                module: 'central_stock',
                label: 'Central Stock',
                permissions: [
                    { key: INVENTORY_PERMISSIONS.CENTRAL_STOCK.VIEW, label: 'View' },
                    { key: INVENTORY_PERMISSIONS.CENTRAL_STOCK.CREATE, label: 'Create Warehouse' },
                    { key: INVENTORY_PERMISSIONS.CENTRAL_STOCK.UPDATE, label: 'Edit Warehouse' },
                    { key: INVENTORY_PERMISSIONS.CENTRAL_STOCK.DELETE, label: 'Delete Warehouse' },
                    { key: INVENTORY_PERMISSIONS.CENTRAL_STOCK.RECEIVE, label: 'Receive' },
                    { key: INVENTORY_PERMISSIONS.CENTRAL_STOCK.DISPATCH, label: 'Dispatch' }
                ]
            },
            {
                module: 'branch_request',
                label: 'Branch Stock Request',
                permissions: [
                    { key: INVENTORY_PERMISSIONS.BRANCH_REQUEST.VIEW, label: 'View' },
                    { key: INVENTORY_PERMISSIONS.BRANCH_REQUEST.CREATE, label: 'Create' },
                    { key: INVENTORY_PERMISSIONS.BRANCH_REQUEST.APPROVE, label: 'Approve' },
                    { key: INVENTORY_PERMISSIONS.BRANCH_REQUEST.REJECT, label: 'Reject' },
                    { key: INVENTORY_PERMISSIONS.BRANCH_REQUEST.ISSUE, label: 'Issue' }
                ]
            },
            {
                module: 'transfer',
                label: 'Branch Transfer',
                permissions: [
                    { key: INVENTORY_PERMISSIONS.TRANSFER.VIEW, label: 'View' },
                    { key: INVENTORY_PERMISSIONS.TRANSFER.CREATE, label: 'Create' },
                    { key: INVENTORY_PERMISSIONS.TRANSFER.APPROVE, label: 'Approve' },
                    { key: INVENTORY_PERMISSIONS.TRANSFER.DISPATCH, label: 'Dispatch' },
                    { key: INVENTORY_PERMISSIONS.TRANSFER.RECEIVE, label: 'Receive' }
                ]
            },
            {
                module: 'asset',
                label: 'Asset Lifecycle',
                permissions: [
                    { key: INVENTORY_PERMISSIONS.ASSET.VIEW, label: 'View' },
                    { key: INVENTORY_PERMISSIONS.ASSET.CREATE, label: 'Create/Register Asset' },
                    { key: INVENTORY_PERMISSIONS.ASSET.ASSIGN, label: 'Assign' },
                    { key: INVENTORY_PERMISSIONS.ASSET.RETURN, label: 'Return' },
                    { key: INVENTORY_PERMISSIONS.ASSET.UPDATE, label: 'Mark Damaged/Update' },
                    { key: INVENTORY_PERMISSIONS.ASSET.DISPOSE, label: 'Dispose' },
                    { key: INVENTORY_PERMISSIONS.ASSET.REQUEST_DISPOSE, label: 'Request Dispose' }
                ]
            },
            {
                module: 'stock_adjustment',
                label: 'Stock Adjustment',
                permissions: [
                    { key: INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT.VIEW, label: 'View' },
                    { key: INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT.CREATE, label: 'Create' },
                    { key: INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT.UPDATE, label: 'Edit' },
                    { key: INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT.DELETE, label: 'Delete/Cancel' },
                    { key: INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT.APPROVE, label: 'Approve' }
                ]
            },
            {
                module: 'employee_request',
                label: 'Employee Request',
                permissions: [
                    { key: INVENTORY_PERMISSIONS.EMPLOYEE_REQUEST.VIEW, label: 'View' },
                    { key: INVENTORY_PERMISSIONS.EMPLOYEE_REQUEST.CREATE, label: 'Create' },
                    { key: INVENTORY_PERMISSIONS.EMPLOYEE_REQUEST.APPROVE, label: 'Approve' },
                    { key: INVENTORY_PERMISSIONS.EMPLOYEE_REQUEST.REJECT, label: 'Reject' }
                ]
            },
            {
                module: 'inventory_report',
                label: 'Inventory Reports',
                permissions: [
                    { key: INVENTORY_PERMISSIONS.INVENTORY_REPORT.VIEW, label: 'View' },
                    { key: INVENTORY_PERMISSIONS.INVENTORY_REPORT.EXPORT, label: 'Export' }
                ]
            }
        ],
        predefinedRoles: [
            {
                code: 'SOCIETY_ADMIN',
                name: 'Society Admin',
                description: 'Full control over all inventory, branches, vendors, and asset lifecycle across the society.',
                permissions: ALL_INVENTORY_PERMISSIONS // gets everything, always
            },
            {
                code: 'INVENTORY_MANAGER',
                name: 'Inventory Manager',
                description: 'Manages catalog, vendors, central stock, and oversees/approves inventory across all branches.',
                permissions: ALL_INVENTORY_PERMISSIONS // same reach as admin, inventory-scoped
            },
            {
                code: 'BRANCH_MANAGER',
                name: 'Branch Manager',
                description: 'Approves and oversees inventory activity for their own branch.',
                permissions: [
                    INVENTORY_PERMISSIONS.CATALOG.VIEW,
                    INVENTORY_PERMISSIONS.BRANCH_REQUEST.VIEW,
                    INVENTORY_PERMISSIONS.BRANCH_REQUEST.CREATE,
                    INVENTORY_PERMISSIONS.BRANCH_REQUEST.APPROVE,
                    INVENTORY_PERMISSIONS.BRANCH_REQUEST.REJECT,
                    INVENTORY_PERMISSIONS.BRANCH_REQUEST.ISSUE,
                    INVENTORY_PERMISSIONS.TRANSFER.VIEW,
                    INVENTORY_PERMISSIONS.TRANSFER.CREATE,
                    INVENTORY_PERMISSIONS.TRANSFER.APPROVE,
                    INVENTORY_PERMISSIONS.TRANSFER.DISPATCH,
                    INVENTORY_PERMISSIONS.TRANSFER.RECEIVE,
                    INVENTORY_PERMISSIONS.ASSET.VIEW,
                    INVENTORY_PERMISSIONS.ASSET.CREATE,
                    INVENTORY_PERMISSIONS.ASSET.ASSIGN,
                    INVENTORY_PERMISSIONS.ASSET.RETURN,
                    INVENTORY_PERMISSIONS.ASSET.UPDATE,
                    INVENTORY_PERMISSIONS.ASSET.REQUEST_DISPOSE,
                    INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT.VIEW,
                    INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT.CREATE,
                    INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT.UPDATE,
                    INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT.DELETE,
                    INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT.APPROVE,
                    INVENTORY_PERMISSIONS.EMPLOYEE_REQUEST.VIEW,
                    INVENTORY_PERMISSIONS.EMPLOYEE_REQUEST.CREATE,
                    INVENTORY_PERMISSIONS.EMPLOYEE_REQUEST.APPROVE,
                    INVENTORY_PERMISSIONS.EMPLOYEE_REQUEST.REJECT,
                    INVENTORY_PERMISSIONS.INVENTORY_REPORT.VIEW // scoped to own branch at query level
                ]
                // scope note: enforce branchId = user.branchId in service layer for every action above
            },
            {
                code: 'BRANCH_INVENTORY_OFFICER',
                name: 'Branch Inventory Officer',
                description: 'Executes day-to-day inventory work at their branch — no approval authority.',
                permissions: [
                    INVENTORY_PERMISSIONS.CATALOG.VIEW,
                    INVENTORY_PERMISSIONS.BRANCH_REQUEST.VIEW,
                    INVENTORY_PERMISSIONS.BRANCH_REQUEST.CREATE,
                    INVENTORY_PERMISSIONS.BRANCH_REQUEST.ISSUE,
                    INVENTORY_PERMISSIONS.TRANSFER.VIEW,
                    INVENTORY_PERMISSIONS.TRANSFER.CREATE,
                    INVENTORY_PERMISSIONS.TRANSFER.DISPATCH,
                    INVENTORY_PERMISSIONS.TRANSFER.RECEIVE,
                    INVENTORY_PERMISSIONS.ASSET.VIEW,
                    INVENTORY_PERMISSIONS.ASSET.CREATE,
                    INVENTORY_PERMISSIONS.ASSET.ASSIGN,
                    INVENTORY_PERMISSIONS.ASSET.RETURN,
                    INVENTORY_PERMISSIONS.ASSET.UPDATE,
                    INVENTORY_PERMISSIONS.ASSET.REQUEST_DISPOSE,
                    INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT.VIEW,
                    INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT.CREATE,
                    INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT.UPDATE,
                    INVENTORY_PERMISSIONS.STOCK_ADJUSTMENT.DELETE,
                    INVENTORY_PERMISSIONS.EMPLOYEE_REQUEST.VIEW,
                    INVENTORY_PERMISSIONS.EMPLOYEE_REQUEST.CREATE
                    // no APPROVE anywhere — that's the whole point of this role
                ]
                // scope note: branchId = user.branchId, same as Branch Manager
            },
            {
                code: 'EMPLOYEE',
                name: 'Employee',
                description: 'Requests and manages their own assigned assets — no inventory management access.',
                permissions: [
                    INVENTORY_PERMISSIONS.CATALOG.VIEW,   // view catalog to select items for request
                    INVENTORY_PERMISSIONS.ASSET.VIEW,      // scoped to own assigned assets only
                    INVENTORY_PERMISSIONS.ASSET.RETURN,
                    INVENTORY_PERMISSIONS.EMPLOYEE_REQUEST.CREATE,
                    INVENTORY_PERMISSIONS.EMPLOYEE_REQUEST.VIEW, // scoped to own requests only
                    INVENTORY_PERMISSIONS.INVENTORY_REPORT.VIEW  // scoped to own only
                ]
                // scope note: employeeId = user._id at query level for VIEW/RETURN
            }
        ]
    };
};