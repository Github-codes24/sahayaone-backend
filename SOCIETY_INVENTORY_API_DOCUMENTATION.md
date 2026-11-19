# Society Inventory Module - API Documentation

This document provides complete REST API specifications, required permissions, request body payloads, headers, query parameters, and response schemas for the **Society Inventory Panel** (`src/panels/society/inventory/`).

---

## Base Path & Authentication

- **Base URL**: `/api/v1/society/inventory`
- **Host / Ports**:
  - Backend API Gateway: `http://localhost:5001` or `https://devapi.sahayaone.com`
  - Frontend Dev Proxy: `http://localhost:5173` *(forwards `/api` to port 5001)*
- **Authentication**: Bearer Token required (`Authorization: Bearer <JWT_TOKEN>`)
- **Tenant Context**: Automatically resolved via `resolveSocietyContext` middleware from the logged-in user profile (`req.society.bankId`).

### Key Foreign Key IDs & Where to Find Them

| Identifier Parameter | Required Endpoint to Retrieve / Create | Underlying Database Model | Description |
| :--- | :--- | :--- | :--- |
| **`itemMasterId`** | `GET /api/v1/society/inventory/items`<br>`POST /api/v1/society/inventory/items` | `InventoryItems` | Master SKU ID (e.g., Laptop, Paper Ream, Chair) |
| **`centralInventoryId`**| `GET /api/v1/society/inventory/central`<br>`POST /api/v1/society/inventory/central` | `CentralInventory` | Central warehouse location ID |
| **`branchId`** | `GET /api/v1/society/branches` | `Branch` | Co-operative society branch ID |
| **`vendorId`** | `GET /api/v1/society/inventory/vendors`<br>`POST /api/v1/society/inventory/vendors` | `Vendor` | Third-party supplier / vendor ID |
| **`assetId`** | `GET /api/v1/society/inventory/assets` | `Asset` | Unique physical serialized asset unit ID |
| **`categoryId`** | `GET /api/v1/society/inventory/categories` | `Category` | Top-level item category ID |
| **`subcategoryId`** | `GET /api/v1/society/inventory/subcategories` | `Subcategory` | Secondary item subcategory ID |

---

### Role & Permission Access Control Matrix

> [!NOTE]
> **Universal Staff Access**: All 11 society staff roles (`EMPLOYEE`, `HR`, `LOAN_EXECUTIVE`, `COLLECTION_EXECUTIVE`, `RECEIPT_MANAGEMENT_EXECUTIVE`, `BANK_RECEIPT_MANAGER`, `ACCOUNTANT`, `SUPPORT_EXECUTIVE`, `BRANCH_INVENTORY_OFFICER`, `BRANCH_MANAGER`, `INVENTORY_MANAGER`) possess baseline permissions to view the item catalog, submit & view requisitions, cancel their own pending requisitions, and view/return their own assigned assets.

| Endpoint Group | Capability Permission Key | Bank Owner / Society Admin | Inventory Manager | Branch Manager | Branch Officer | All Staff Roles (Employee, HR, Loan, Collection, Accounts, etc.) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Inventory Stats & Overview** (`GET /stats/overview`, `/stats/central`, `/stats/branch`) | `inventory_report.view`, `central_stock.view`, `branch_request.view` | ✅ Allowed | ✅ Allowed | ✅ Allowed (Branch Scoped) | ✅ Allowed (Branch Scoped) | ❌ Forbidden |
| **Catalog Create & Management** (`POST /categories`, `/subcategories`, `/items`) | `inventory_catalog.create` | ✅ Allowed | ✅ Allowed | ❌ Forbidden | ❌ Forbidden | ❌ Forbidden |
| **Catalog Edit & Delete** (`PUT /categories/:id`, `DELETE /categories/:id`, etc.) | `inventory_catalog.update`, `inventory_catalog.delete` | ✅ Allowed | ✅ Allowed | ❌ Forbidden | ❌ Forbidden | ❌ Forbidden |
| **Catalog View** (`GET /categories`, `/subcategories`, `/items`, `/:id`) | `inventory_catalog.view` | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed |
| **Vendor Management** (`POST /vendors`, `PUT /vendors/:id`, `DELETE /vendors/:id`) | `vendor.create`, `vendor.update`, `vendor.delete` | ✅ Allowed | ✅ Allowed | ❌ Forbidden | ❌ Forbidden | ❌ Forbidden |
| **Vendor View** (`GET /vendors`, `GET /vendors/:id`) | `vendor.view` | ✅ Allowed | ✅ Allowed | ❌ Forbidden | ❌ Forbidden | ❌ Forbidden |
| **Central Warehouse Create & Edit** (`POST /central`, `PUT /central/:id`) | `central_stock.create`, `central_stock.update` | ✅ Allowed | ✅ Allowed | ❌ Forbidden | ❌ Forbidden | ❌ Forbidden |
| **Central Warehouse Delete** (`DELETE /central/:id`) | `central_stock.delete` | ✅ Allowed | ✅ Allowed | ❌ Forbidden | ❌ Forbidden | ❌ Forbidden |
| **Central Warehouse View** (`GET /central`, `GET /central/:id`) | `central_stock.view` | ✅ Allowed | ✅ Allowed | ❌ Forbidden | ❌ Forbidden | ❌ Forbidden |
| **Stock Receiving** (`POST /central/stock-in`, `/stock/central/receive`, `/central/receive`) | `central_stock.receive` | ✅ Allowed | ✅ Allowed | ❌ Forbidden | ❌ Forbidden | ❌ Forbidden |
| **Item Requisition Create** (`POST /requests`, `POST /branch/requests`) | `branch_request.create` OR `employee_request.create` | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed |
| **Item Requisition View** (`GET /requests`, `GET /branch/requests`, `/:id`) | `branch_request.view` OR `employee_request.view` | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed (Own Scoped) |
| **Item Requisition Cancel** (`POST /requests/:id/cancel`, `/branch/requests/:id/cancel`) | `branch_request.create` OR `employee_request.create` | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed (Own Pending) |
| **Branch Requisition Approval** (`POST /branch/requests/:id/approve|reject`) | `branch_request.approve`, `.reject` | ✅ Allowed | ✅ Allowed | ✅ Allowed | ❌ Forbidden | ❌ Forbidden |
| **Branch Stock Issue** (`POST /branch/requests/:id/fulfill`, `/branch/issues/direct`) | `branch_request.issue` | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | ❌ Forbidden |
| **Transfer Request** (`POST /transfers`) | `transfer.create` | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | ❌ Forbidden |
| **Transfer Approval** (`POST /transfers/:id/approve|reject`) | `transfer.approve` | ✅ Allowed | ✅ Allowed | ✅ Allowed | ❌ Forbidden | ❌ Forbidden |
| **Transfer Dispatch & Receive** (`POST /transfers/:id/dispatch|receive`) | `transfer.dispatch`, `transfer.receive` | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | ❌ Forbidden |
| **Asset View & Assignments** (`GET /assets`, `GET /my-assets`, `POST /assets/assign`) | `asset.view`, `asset.assign` | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed (`GET` Own Scoped) |
| **Asset Return** (`POST /assets/:id/return`, `POST /my-assets/:id/return`) | `asset.return` | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed (Own Assigned) |
| **Asset Maintenance & Lost** (`POST /assets/:id/report-damage|repair-complete|report-lost|recover`) | `asset.update` | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | ❌ Forbidden |
| **Asset Disposal Request** (`POST /assets/:id/request-disposal`) | `asset.request_dispose` | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | ❌ Forbidden |
| **Asset Disposal Approval** (`POST /assets/:id/approve-disposal`) | `asset.dispose` | ✅ Allowed | ✅ Allowed | ❌ Forbidden | ❌ Forbidden | ❌ Forbidden |
| **Stock Adjustment Create** (`POST /stock-adjustments`) | `stock_adjustment.create` | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | ❌ Forbidden |
| **Stock Adjustment Edit & Cancel** (`PUT /stock-adjustments/:id`, `DELETE /stock-adjustments/:id`) | `stock_adjustment.update`, `stock_adjustment.delete` | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | ❌ Forbidden |
| **Stock Adjustment Approve** (`POST /stock-adjustments/:id/approve|reject`) | `stock_adjustment.approve` | ✅ Allowed | ✅ Allowed | ✅ Allowed | ❌ Forbidden | ❌ Forbidden |
| **Legacy Inventory Management** (`GET/POST /`, `GET /export`, `PUT/DELETE /:id`) | `inventory.view`, `inventory.create`, `inventory.update`, `inventory.delete` | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed | ❌ Forbidden |

---

## 0. Inventory Statistics & Overview APIs (`INVENTORY_REPORT` & `STATS`)

### 0.1 Consolidated Society-Wide Inventory Overview
- **HTTP Method**: `GET`
- **Endpoint**: `/api/v1/society/inventory/stats/overview`
- **Required Capability**: `inventory_report.view`
- **Allowed Roles**: `BANK_OWNER`, `SOCIETY_ADMIN`, `INVENTORY_MANAGER`

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Overall society inventory statistics retrieved successfully.",
  "data": {
    "overview": {
      "totalCategories": 12,
      "totalSubcategories": 34,
      "totalMasterSKUs": 145,
      "totalVendors": 20,
      "totalCentralWarehouses": 2
    },
    "stockDistribution": {
      "totalSocietyStockUnits": 4200,
      "centralStock": {
        "quantity": 3000,
        "reservedQuantity": 250,
        "availableQuantity": 2750
      },
      "branchStock": {
        "quantity": 1200,
        "reservedQuantity": 50,
        "availableQuantity": 1150
      }
    },
    "assets": {
      "total": 350,
      "active": 310,
      "inRepair": 15,
      "retired": 20,
      "lost": 5
    },
    "pendingActions": {
      "requisitionsAwaitingApproval": 4,
      "transfersAwaitingApproval": 2,
      "stockAdjustmentsAwaitingApproval": 1
    }
  }
}
```

### 0.2 Central Level Inventory Statistics
- **HTTP Method**: `GET`
- **Endpoint**: `/api/v1/society/inventory/stats/central`
- **Required Capability**: `central_stock.view`
- **Allowed Roles**: `BANK_OWNER`, `SOCIETY_ADMIN`, `INVENTORY_MANAGER`

#### Query Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `centralInventoryId` | String (MongoId) | No | - | Filter metrics for a specific central warehouse |
| `period` | String | No | `30d` | Inbound activity timeframe (`7d`, `30d`, `90d`, `all`) |

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Central inventory statistics retrieved successfully.",
  "data": {
    "warehouses": {
      "total": 2,
      "active": 2
    },
    "stock": {
      "totalQuantity": 3000,
      "totalReservedQuantity": 250,
      "availableQuantity": 2750,
      "totalUniqueSKUs": 120,
      "outOfStockCount": 3,
      "lowStockCount": 8
    },
    "serializedAssets": {
      "total": 220,
      "active": 200,
      "inRepair": 10,
      "retired": 8,
      "lost": 2
    },
    "inboundActivity": {
      "period": "30d",
      "inboundTransactionsCount": 18,
      "totalUnitsReceived": 850
    },
    "categoryDistribution": [
      {
        "categoryId": "66d81234567890abcdef1001",
        "categoryName": "IT Equipment",
        "categoryCode": "CAT-IT",
        "totalUnits": 1200,
        "uniqueSkusCount": 45
      }
    ]
  }
}
```

### 0.3 Branch Level Inventory Statistics
- **HTTP Method**: `GET`
- **Endpoint**: `/api/v1/society/inventory/stats/branch`
- **Required Capability**: `branch_request.view`
- **Allowed Roles**: `BANK_OWNER`, `SOCIETY_ADMIN`, `INVENTORY_MANAGER`, `BRANCH_MANAGER`, `BRANCH_INVENTORY_OFFICER`
- *Note*: Branch Manager/Officer access is automatically scoped to their assigned `branchId`.

#### Query Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `branchId` | String (MongoId) | No | User's Branch | Society Admins can pass a specific branch or omit for network-wide branch aggregate |
| `period` | String | No | `30d` | Timeframe filter |

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Branch inventory statistics retrieved successfully.",
  "data": {
    "branchId": "66d81234567890abcdef1099",
    "stock": {
      "totalQuantity": 450,
      "totalReservedQuantity": 20,
      "availableQuantity": 430,
      "totalUniqueSKUs": 38,
      "lowStockCount": 4
    },
    "assets": {
      "totalInBranch": 85,
      "assignedToEmployees": 60,
      "availableInCustody": 20,
      "inRepair": 3,
      "retired": 2,
      "lost": 0
    },
    "requisitions": {
      "pending": 3,
      "approved": 2,
      "fulfilled": 45,
      "rejected": 1,
      "total": 51
    },
    "transfers": {
      "inboundInTransit": 1,
      "outboundInTransit": 0
    },
    "stockAdjustments": {
      "pendingApproval": 1
    }
  }
}
```

---

## 1. Catalog APIs (`CATALOG` Module)

### 1.1 Create Item Category
- **HTTP Method**: `POST`
- **Endpoint**: `/api/v1/society/inventory/categories`
- **Required Capability**: `inventory_catalog.create`
- **Allowed Roles**: `BANK_OWNER`, `SOCIETY_ADMIN`, `INVENTORY_MANAGER`

#### Request Body (`application/json`)
```json
{
  "name": "IT Equipment",
  "code": "CAT-IT",
  "description": "Information Technology hardware, computers, and peripherals"
}
```

#### Response (`201 Created`)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Inventory category created successfully.",
  "data": {
    "_id": "66d62884a1e9b20012345678",
    "societyId": "66d5b0a12e34567890abcdef",
    "name": "IT Equipment",
    "code": "CAT-IT",
    "description": "Information Technology hardware, computers, and peripherals",
    "status": "active",
    "createdAt": "2026-09-02T18:40:00.000Z",
    "updatedAt": "2026-09-02T18:40:00.000Z"
  }
}
```

---

### 1.2 List Categories
- **HTTP Method**: `GET`
- **Endpoint**: `/api/v1/society/inventory/categories`
- **Required Capability**: `inventory_catalog.view`

#### Query Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :---: | :---: | :--- |
| `page` | Integer | No | `1` | Page number |
| `limit` | Integer | No | `10` | Records per page |
| `search` | String | No | `""` | Search by category name or code |
| `status` | String | No | - | Filter by status (`active` / `inactive`) |
| `sortBy` | String | No | `createdAt` | Sort field (`name`, `code`, `createdAt`) |
| `sortOrder` | String | No | `desc` | Sort direction (`asc`, `desc`) |

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Inventory categories retrieved successfully.",
  "data": [
    {
      "_id": "66d62884a1e9b20012345678",
      "societyId": "66d5b0a12e34567890abcdef",
      "name": "IT Equipment",
      "code": "CAT-IT",
      "description": "Information Technology hardware",
      "status": "active",
      "createdAt": "2026-09-02T18:40:00.000Z"
    }
  ],
  "meta": {
    "totalRecords": 1,
    "limit": 10,
    "page": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

---

### 1.3 Get Category by ID
- **HTTP Method**: `GET`
- **Endpoint**: `/api/v1/society/inventory/categories/:id`
- **Required Capability**: `inventory_catalog.view`
- **Allowed Roles**: All roles

---

### 1.4 Update Category
- **HTTP Method**: `PUT`
- **Endpoint**: `/api/v1/society/inventory/categories/:id`
- **Required Capability**: `inventory_catalog.update`
- **Allowed Roles**: `BANK_OWNER`, `SOCIETY_ADMIN`, `INVENTORY_MANAGER`

#### Request Body (`application/json` - at least 1 field required)
```json
{
  "name": "IT Hardware & Peripherals",
  "description": "Updated description",
  "status": "active"
}
```

---

### 1.5 Delete Category
- **HTTP Method**: `DELETE`
- **Endpoint**: `/api/v1/society/inventory/categories/:id`
- **Required Capability**: `inventory_catalog.delete`
- **Allowed Roles**: `BANK_OWNER`, `SOCIETY_ADMIN`, `INVENTORY_MANAGER`
- *Guards*: Fails with `400 Bad Request` if subcategories or items exist under this category.

---

### 1.6 Create Subcategory
- **HTTP Method**: `POST`
- **Endpoint**: `/api/v1/society/inventory/subcategories`
- **Required Capability**: `inventory_catalog.create`
- **Allowed Roles**: `BANK_OWNER`, `SOCIETY_ADMIN`, `INVENTORY_MANAGER`

#### Request Body (`application/json`)
```json
{
  "categoryId": "66d62884a1e9b20012345678",
  "name": "Laptops",
  "code": "SUBCAT-LAPTOP",
  "description": "Portable notebook personal computers"
}
```

#### Response (`201 Created`)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Inventory subcategory created successfully.",
  "data": {
    "_id": "66d62900a1e9b20012345679",
    "societyId": "66d5b0a12e34567890abcdef",
    "categoryId": "66d62884a1e9b20012345678",
    "name": "Laptops",
    "code": "SUBCAT-LAPTOP",
    "description": "Portable notebook personal computers",
    "status": "active",
    "createdAt": "2026-09-02T18:41:00.000Z"
  }
}
```

---

### 1.7 List Subcategories
- **HTTP Method**: `GET`
- **Endpoint**: `/api/v1/society/inventory/subcategories`
- **Required Capability**: `inventory_catalog.view`

#### Query Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :---: | :---: | :--- |
| `categoryId` | ObjectId | No | - | Filter subcategories under a specific category |
| `page` | Integer | No | `1` | Page number |
| `limit` | Integer | No | `10` | Records per page |
| `search` | String | No | `""` | Search by subcategory name or code |

---

### 1.8 Get Subcategory by ID
- **HTTP Method**: `GET`
- **Endpoint**: `/api/v1/society/inventory/subcategories/:id`
- **Required Capability**: `inventory_catalog.view`

---

### 1.9 Update Subcategory
- **HTTP Method**: `PUT`
- **Endpoint**: `/api/v1/society/inventory/subcategories/:id`
- **Required Capability**: `inventory_catalog.update`
- **Allowed Roles**: `BANK_OWNER`, `SOCIETY_ADMIN`, `INVENTORY_MANAGER`

#### Request Body (`application/json` - at least 1 field required)
```json
{
  "name": "High-Performance Laptops",
  "description": "Workstations and ultrabooks",
  "status": "active"
}
```

---

### 1.10 Delete Subcategory
- **HTTP Method**: `DELETE`
- **Endpoint**: `/api/v1/society/inventory/subcategories/:id`
- **Required Capability**: `inventory_catalog.delete`
- **Allowed Roles**: `BANK_OWNER`, `SOCIETY_ADMIN`, `INVENTORY_MANAGER`
- *Guards*: Fails with `400 Bad Request` if master items exist under this subcategory.

---

### 1.11 Create Master SKU Item
- **HTTP Method**: `POST`
- **Endpoint**: `/api/v1/society/inventory/items`
- **Required Capability**: `inventory_catalog.create`
- **Allowed Roles**: `BANK_OWNER`, `SOCIETY_ADMIN`, `INVENTORY_MANAGER`

#### Request Body (`application/json`)
```json
{
  "categoryId": "66d62884a1e9b20012345678",
  "subcategoryId": "66d62900a1e9b20012345679",
  "name": "Dell XPS 15 9530",
  "code": "SKU-DELL-XPS15",
  "unit": "Pcs",
  "brand": "Dell",
  "model": "XPS 15",
  "type": "Hardware",
  "isSerialized": true,
  "description": "Core i9, 32GB RAM, 1TB SSD"
}
```

#### Response (`201 Created`)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Inventory SKU item created successfully.",
  "data": {
    "_id": "66d629f5a1e9b20012345680",
    "societyId": "66d5b0a12e34567890abcdef",
    "categoryId": "66d62884a1e9b20012345678",
    "subcategoryId": "66d62900a1e9b20012345679",
    "name": "Dell XPS 15 9530",
    "code": "SKU-DELL-XPS15",
    "unit": "Pcs",
    "brand": "Dell",
    "model": "XPS 15",
    "type": "Hardware",
    "isSerialized": true,
    "description": "Core i9, 32GB RAM, 1TB SSD",
    "status": "active",
    "createdAt": "2026-09-02T18:42:00.000Z"
  }
}
```

---

### 1.12 List Master SKU Items
- **HTTP Method**: `GET`
- **Endpoint**: `/api/v1/society/inventory/items`
- **Required Capability**: `inventory_catalog.view`

#### Query Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `categoryId` | ObjectId | No | Filter by Category ID |
| `subcategoryId` | ObjectId | No | Filter by Subcategory ID |
| `isSerialized` | Boolean | No | Filter serialized items (`true` / `false`) |
| `search` | String | No | Search by name, code, brand, or model |
| `page`, `limit` | Integer | No | Pagination control |

---

### 1.13 Get Master SKU Item by ID
- **HTTP Method**: `GET`
- **Endpoint**: `/api/v1/society/inventory/items/:id`
- **Required Capability**: `inventory_catalog.view`

---

### 1.14 Update Master SKU Item
- **HTTP Method**: `PUT`
- **Endpoint**: `/api/v1/society/inventory/items/:id`
- **Required Capability**: `inventory_catalog.update`
- **Allowed Roles**: `BANK_OWNER`, `SOCIETY_ADMIN`, `INVENTORY_MANAGER`

#### Request Body (`application/json` - at least 1 field required)
```json
{
  "name": "Dell XPS 15 9530 (Updated)",
  "brand": "Dell",
  "model": "XPS 15 (2024)",
  "description": "Upgraded thermal design, 32GB RAM",
  "status": "active"
}
```

---

### 1.15 Delete Master SKU Item
- **HTTP Method**: `DELETE`
- **Endpoint**: `/api/v1/society/inventory/items/:id`
- **Required Capability**: `inventory_catalog.delete`
- **Allowed Roles**: `BANK_OWNER`, `SOCIETY_ADMIN`, `INVENTORY_MANAGER`
- *Guards*: Blocked with `400 Bad Request` if physical stock quantity > 0 or registered serialized assets exist.


---

## 2. Vendor Directory APIs (`VENDOR` Module)

### 2.1 Register New Vendor
- **HTTP Method**: `POST`
- **Endpoint**: `/api/v1/society/inventory/vendors`
- **Required Capability**: `vendor.create`
- **Allowed Roles**: `BANK_OWNER`, `SOCIETY_ADMIN`, `INVENTORY_MANAGER`

#### Request Body (`application/json`)
```json
{
  "name": "TechSupplies Private Limited",
  "code": "VND-TECHSUPPLIES",
  "contactPerson": "Rajesh Kumar",
  "phone": "+919876543210",
  "email": "vendor@techsupplies.com",
  "address": "Plot 42, Tech Park, Mumbai",
  "gstNumber": "27AAACT1234A1Z5"
}
```

#### Response (`201 Created`)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Vendor registered successfully.",
  "data": {
    "_id": "66d62ab8a1e9b20012345681",
    "societyId": "66d5b0a12e34567890abcdef",
    "name": "TechSupplies Private Limited",
    "code": "VND-TECHSUPPLIES",
    "contactPerson": "Rajesh Kumar",
    "phone": "+919876543210",
    "email": "vendor@techsupplies.com",
    "address": "Plot 42, Tech Park, Mumbai",
    "gstNumber": "27AAACT1234A1Z5",
    "status": "active",
    "createdAt": "2026-09-02T18:43:00.000Z"
  }
}
```

---

### 2.2 List Vendors
- **HTTP Method**: `GET`
- **Endpoint**: `/api/v1/society/inventory/vendors`
- **Required Capability**: `vendor.view`
- **Allowed Roles**: `BANK_OWNER`, `SOCIETY_ADMIN`, `INVENTORY_MANAGER`

---

### 2.3 Get Vendor by ID
- **HTTP Method**: `GET`
- **Endpoint**: `/api/v1/society/inventory/vendors/:id`
- **Required Capability**: `vendor.view`
- **Allowed Roles**: `BANK_OWNER`, `SOCIETY_ADMIN`, `INVENTORY_MANAGER`

---

### 2.4 Update Vendor
- **HTTP Method**: `PUT`
- **Endpoint**: `/api/v1/society/inventory/vendors/:id`
- **Required Capability**: `vendor.update`
- **Allowed Roles**: `BANK_OWNER`, `SOCIETY_ADMIN`, `INVENTORY_MANAGER`

#### Request Body (`application/json` - at least 1 field required)
```json
{
  "name": "TechSupplies Global Pvt Ltd",
  "contactPerson": "Rajesh Kumar (Senior Manager)",
  "phone": "+919876543211",
  "email": "corporate@techsupplies.com",
  "address": "Plot 42-45, Tech Park, Mumbai",
  "status": "active"
}
```

---

### 2.5 Delete Vendor
- **HTTP Method**: `DELETE`
- **Endpoint**: `/api/v1/society/inventory/vendors/:id`
- **Required Capability**: `vendor.delete`
- **Allowed Roles**: `BANK_OWNER`, `SOCIETY_ADMIN`, `INVENTORY_MANAGER`
- *Guards*: Fails with `400 Bad Request` if registered assets are linked to this vendor.

---

## 3. Central Stock APIs (`CENTRAL_STOCK` Module)

### 3.1 Create Central Inventory Warehouse Location
- **HTTP Method**: `POST`
- **Endpoint**: `/api/v1/society/inventory/central`
- **Required Capability**: `central_stock.create`
- **Allowed Roles**: `BANK_OWNER`, `SOCIETY_ADMIN`, `INVENTORY_MANAGER`

#### Request Body (`application/json`)
```json
{
  "name": "Main Central Warehouse",
  "code": "WH-MAIN-CENTRAL",
  "address": "Building 5, Central Storage Complex, HQ",
  "managerId": "66d5b1202e34567890fedcba"
}
```

#### Response (`201 Created`)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Central inventory warehouse created successfully.",
  "data": {
    "_id": "66d62b50a1e9b20012345682",
    "societyId": "66d5b0a12e34567890abcdef",
    "name": "Main Central Warehouse",
    "code": "WH-MAIN-CENTRAL",
    "address": "Building 5, Central Storage Complex, HQ",
    "managerId": "66d5b1202e34567890fedcba",
    "status": "active",
    "createdAt": "2026-09-02T18:44:00.000Z"
  }
}
```

---

### 3.2 List Central Inventory Warehouses
- **HTTP Method**: `GET`
- **Endpoint**: `/api/v1/society/inventory/central`
- **Required Capability**: `central_stock.view`

---

### 3.3 Get Central Inventory Warehouse by ID
- **HTTP Method**: `GET`
- **Endpoint**: `/api/v1/society/inventory/central/:id`
- **Required Capability**: `central_stock.view`

---

### 3.4 Update Central Inventory Warehouse
- **HTTP Method**: `PUT`
- **Endpoint**: `/api/v1/society/inventory/central/:id`
- **Required Capability**: `central_stock.update`
- **Allowed Roles**: `BANK_OWNER`, `SOCIETY_ADMIN`, `INVENTORY_MANAGER`

#### Request Body (`application/json` - at least 1 field required)
```json
{
  "name": "Main Central Logistics & Storage Hub",
  "address": "Building 5 & 6, Central Complex, HQ",
  "managerId": "66d5b1202e34567890fedcba",
  "status": "active"
}
```

---

### 3.5 Delete Central Inventory Warehouse
- **HTTP Method**: `DELETE`
- **Endpoint**: `/api/v1/society/inventory/central/:id`
- **Required Capability**: `central_stock.delete`
- **Allowed Roles**: `BANK_OWNER`, `SOCIETY_ADMIN`, `INVENTORY_MANAGER`
- *Guards*: Fails with `400 Bad Request` if active stock balance exists or physical assets reside at this warehouse.

---

### 3.6 Receive Stock into Central Inventory (`Stock-In`)
- **HTTP Method**: `POST`
- **Primary Endpoint**: `/api/v1/society/inventory/central/stock-in`
- **Supported Aliases**:
  - `/api/v1/society/inventory/stock/central/receive`
  - `/api/v1/society/inventory/central/receive`
- **Required Capability**: `central_stock.receive`
- **Allowed Roles**: `BANK_OWNER`, `SOCIETY_ADMIN`, `INVENTORY_MANAGER`

#### Request Body Parameters (`application/json`)
| Field | Type | Required | Source / Where to Find | Description & Rules |
| :--- | :--- | :---: | :--- | :--- |
| `centralInventoryId` | String (MongoId) | **Yes** | `GET /api/v1/society/inventory/central` | Central warehouse receiving the stock |
| `itemMasterId` | String (MongoId) | **Yes** | `GET /api/v1/society/inventory/items` | Target catalog SKU item ID |
| `quantity` | Integer | **Yes** | Input | Units to receive (minimum `1`) |
| `vendorId` | String (MongoId) | No | `GET /api/v1/society/inventory/vendors` | Associated supplier ID (optional, nullable) |
| `assetTags` | Array of Strings | **Conditional** | Generated / Physical Barcodes | **Required only if `item.isSerialized === true`**. Array length must strictly equal `quantity`. Tags are auto-uppercased and unique per society. |
| `serialNumbers` | Array of Strings | No | Manufacturer Hardware Serials | Optional hardware serial numbers matching each unit in `assetTags` |
| `remarks` | String | No | Input | Optional shipment or audit notes (max 500 chars) |

---

#### Example A: Receiving Non-Serialized (Consumable) Stock
*No `assetTags` or `serialNumbers` required:*
```json
{
  "centralInventoryId": "66d62b50a1e9b20012345682",
  "itemMasterId": "66d629f5a1e9b20012345680",
  "quantity": 50,
  "vendorId": "66d62ab8a1e9b20012345681",
  "remarks": "Batch of 50 A4 Paper reams received from supplier"
}
```

#### Example B: Receiving Serialized Hardware Equipment Stock
*Requires exactly `quantity` unique `assetTags`:*
```json
{
  "centralInventoryId": "66d62b50a1e9b20012345682",
  "itemMasterId": "66d629f5a1e9b20012345681",
  "quantity": 2,
  "vendorId": "66d62ab8a1e9b20012345681",
  "assetTags": ["TAG-LAP-001", "TAG-LAP-002"],
  "serialNumbers": ["SN-DELL-998811", "SN-DELL-998812"],
  "remarks": "Received 2 Dell Latitude laptops"
}
```

> [!IMPORTANT]
> - If `item.isSerialized === true`: The server automatically creates individual `Asset` records for each unit with status `'active'` and condition `'new'` located at `CentralInventory`.
> - If `item.isSerialized === false`: Stock quantity in `Stock` collection is incremented directly.
> - An immutable stock ledger record in `InventoryTransaction` with `type: 'STOCK_IN'` is recorded automatically.

#### Response (`201 Created`)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Stock received into central inventory successfully.",
  "data": {
    "warehouse": {
      "id": "66d62b50a1e9b20012345682",
      "name": "Main Central Warehouse",
      "code": "WH-MAIN-CENTRAL"
    },
    "item": {
      "id": "66d629f5a1e9b20012345680",
      "name": "Dell XPS 15 9530",
      "code": "SKU-DELL-XPS15",
      "isSerialized": true
    },
    "quantityReceived": 2,
    "totalCentralStock": 2,
    "createdAssetsCount": 2,
    "transactionId": "66d62c10a1e9b20012345683"
  }
}
```


---

## 4. Requisition & Issue APIs (`BRANCH_REQUEST` & `EMPLOYEE_REQUEST` Modules)

### 4.1 Create Item Requisition
- **HTTP Method**: `POST`
- **Endpoints**: 
  - `/api/v1/society/inventory/requests` *(Recommended alias)*
  - `/api/v1/society/inventory/branch/requests`
- **Required Capability**: `branch_request.create` OR `employee_request.create`
- **Allowed Roles**: **All 11 Society Staff Roles** (`EMPLOYEE`, `HR`, `LOAN_EXECUTIVE`, `COLLECTION_EXECUTIVE`, `RECEIPT_MANAGEMENT_EXECUTIVE`, `BANK_RECEIPT_MANAGER`, `ACCOUNTANT`, `SUPPORT_EXECUTIVE`, `BRANCH_INVENTORY_OFFICER`, `BRANCH_MANAGER`, `INVENTORY_MANAGER`, `BANK_OWNER`, `SOCIETY_ADMIN`)

#### Request Body (`application/json`)
```json
{
  "branchId": "66d62884a1e9b20012345678",
  "remarks": "Required for daily branch operations",
  "items": [
    {
      "itemMasterId": "66d629f5a1e9b20012345680",
      "quantity": 1
    }
  ]
}
```

> [!NOTE]
> `branchId` is optional. If omitted, it automatically resolves to the logged-in user's assigned branch (`req.society.branchId`).

---

### 4.2 List Requisitions
- **HTTP Method**: `GET`
- **Endpoints**: 
  - `/api/v1/society/inventory/requests` *(Recommended alias)*
  - `/api/v1/society/inventory/branch/requests`
- **Required Capability**: `branch_request.view` OR `employee_request.view`
- **Allowed Roles**: All Society Staff Roles
- **Scoping Behavior**:
  - **Regular Staff / Employee**: Automatically scoped to their own requests only (`employeeId = context.userId`).
  - **Branch Manager**: Scoped to all requests within their branch (`branchId = context.branchId`).
  - **Bank Owner / Society Admin**: Society-wide visibility across all branches.
- **Query Parameters**:
  - `status`: Filter by `PENDING`, `APPROVED`, `REJECTED`, `FULFILLED`, `CANCELLED`
  - `branchId`: Filter by Branch (Manager / Admin only)
  - `employeeId`: Filter by Employee (Manager / Admin only)
  - `page`, `limit`, `sortBy`, `sortOrder`

---

### 4.3 Get Requisition Details by ID
- **HTTP Method**: `GET`
- **Endpoints**: 
  - `/api/v1/society/inventory/requests/:id` *(Recommended alias)*
  - `/api/v1/society/inventory/branch/requests/:id`
- **Required Capability**: `branch_request.view` OR `employee_request.view`
- **Security Check**: Staff members can only view requisitions they personally submitted. Managers/Admins can view any request within their scope.

---

### 4.4 Cancel Pending Requisition (Requester Self-Cancel)
- **HTTP Method**: `POST`
- **Endpoints**: 
  - `/api/v1/society/inventory/requests/:id/cancel` *(Recommended alias)*
  - `/api/v1/society/inventory/branch/requests/:id/cancel`
- **Required Capability**: `branch_request.create` OR `employee_request.create`
- **Allowed Roles**: Requisition creator (or Manager / Admin)
- **Guards**: Only requisitions in `PENDING` status can be cancelled. Requisitions already `APPROVED`, `REJECTED`, or `FULFILLED` return `400 Bad Request`.

#### Request Body (`application/json` - Optional)
```json
{
  "remarks": "Ordered duplicate items by mistake"
}
```

---

### 4.5 Approve Requisition (Branch Manager Authority)
- **HTTP Method**: `POST`
- **Endpoint**: `/api/v1/society/inventory/branch/requests/:id/approve`
- **Required Capability**: `branch_request.approve`
- **Allowed Roles**: `BRANCH_MANAGER`, `SOCIETY_ADMIN`, `INVENTORY_MANAGER`

```json
{
  "remarks": "Approved by Branch Manager"
}
```

---

### 4.6 Reject Requisition (Branch Manager Authority)
- **HTTP Method**: `POST`
- **Endpoint**: `/api/v1/society/inventory/branch/requests/:id/reject`
- **Required Capability**: `branch_request.reject`
- **Allowed Roles**: `BRANCH_MANAGER`, `SOCIETY_ADMIN`, `INVENTORY_MANAGER`

---

### 4.5 Fulfill Requisition (Issue Stock/Asset to Employee)
- **HTTP Method**: `POST`
- **Endpoint**: `/api/v1/society/inventory/branch/requests/:id/fulfill`
- **Required Capability**: `branch_request.issue`
- **Allowed Roles**: `BRANCH_INVENTORY_OFFICER`, `BRANCH_MANAGER`, `SOCIETY_ADMIN`
- **Behavior**:
  - **Stock Available**: Deducts consumable stock or assigns serialized assets, marks request `FULFILLED`.
  - **Stock Missing**: Returns `422 Unprocessable Entity` with `missingItems` list prompting transfer creation.

```json
{
  "assetTagMapping": [
    {
      "itemMasterId": "66d629f5a1e9b20012345680",
      "assetTags": ["TAG-LAP-001", "TAG-LAP-002"]
    }
  ],
  "remarks": "Handed over to employee"
}
```

---

### 4.6 Direct Counter Issue
- **HTTP Method**: `POST`
- **Endpoint**: `/api/v1/society/inventory/branch/issues/direct`
- **Required Capability**: `branch_request.issue`

```json
{
  "branchId": "66d62884a1e9b20012345678",
  "employeeId": "66d5b1202e34567890fedcba",
  "itemMasterId": "66d629f5a1e9b20012345680",
  "quantity": 1,
  "assetTags": ["TAG-LAP-001"],
  "remarks": "Direct counter allocation"
}
```

---

## 5. Inter-Location Transfer APIs (`TRANSFER` Module)

### 5.1 Create Transfer Request
- **HTTP Method**: `POST`
- **Endpoint**: `/api/v1/society/inventory/transfers`
- **Required Capability**: `transfer.create`
- **Allowed Roles**: `BRANCH_INVENTORY_OFFICER`, `BRANCH_MANAGER`, `INVENTORY_MANAGER`, `SOCIETY_ADMIN`

```json
{
  "fromLocationType": "CentralInventory",
  "fromLocationId": "66d62b50a1e9b20012345682",
  "toLocationType": "Branch",
  "toLocationId": "66d62884a1e9b20012345678",
  "remarks": "Stock replenishment for branch onboarding",
  "items": [
    {
      "itemMasterId": "66d629f5a1e9b20012345680",
      "quantity": 5
    }
  ]
}
```

---

### 5.2 Approve Transfer (Manager / Admin Authority)
- **HTTP Method**: `POST`
- **Endpoint**: `/api/v1/society/inventory/transfers/:id/approve`
- **Required Capability**: `transfer.approve`

---

### 5.3 Dispatch Transfer (Origin Location)
- **HTTP Method**: `POST`
- **Endpoint**: `/api/v1/society/inventory/transfers/:id/dispatch`
- **Required Capability**: `transfer.dispatch`

```json
{
  "assetTagsMapping": [
    {
      "itemMasterId": "66d629f5a1e9b20012345680",
      "assetTags": ["TAG-LAP-001", "TAG-LAP-002", "TAG-LAP-003", "TAG-LAP-004", "TAG-LAP-005"]
    }
  ],
  "remarks": "Dispatched via courier consignment #TRK9981"
}
```

---

### 5.4 Receive Transfer (Destination Branch)
- **HTTP Method**: `POST`
- **Endpoint**: `/api/v1/society/inventory/transfers/:id/receive`
- **Required Capability**: `transfer.receive`
- **Allowed Roles**: `BRANCH_INVENTORY_OFFICER`, `BRANCH_MANAGER`

```json
{
  "remarks": "Package received intact and verified"
}
```

---

## 6. Asset Lifecycle APIs (`ASSET` Module)

The Asset Lifecycle module governs individual, serialized equipment units (e.g. laptops, biometric scanners, cash-counting machines, tablets, and POS terminals). Unlike bulk consumable inventory tracked merely by quantity, every serialized asset is tracked as a distinct unit instance with its own barcode tag (`assetTag`), serial number, physical condition, warranty data, and custody chain.

### Asset Lifecycle State Transition Diagram
```
                     +---------------------------+
                     |  Central Stock Receive    |
                     |  (Asset Created: active)  |
                     +-------------+-------------+
                                   |
                     +-------------v-------------+
      +------------> |     AVAILABLE IN POOL     | <-----------+
      |              |   (status: active, good)  |             |
      |              +-------------+-------------+             |
      |                            |                           |
6.4 Return Asset             6.3 Assign Asset            6.6 Repair Complete
      |                            |                           |
      |              +-------------v-------------+             |
      +------------+ |    ASSIGNED TO EMPLOYEE   |             |
      | (if damaged) |    (currentLocation: User)|             |
      |              +-------------+-------------+             |
      |                            |                           |
      v                      6.5 Report Damage                 |
+--------------------+             |             +-------------+-------------+
|    MAINTENANCE     | <-----------+             |      RECOVERED ASSET      |
| (status: in_repair)|                           |       (6.10 Recover)      |
+---------+----------+                           +-------------^-------------+
          |                                                    |
6.7 Request Disposal                             6.9 Report Lost (audit/theft)
          |                                                    |
+---------v----------+                           +-------------+-------------+
| DISPOSAL PENDING   |                           |    UNDER INVESTIGATION    |
| (Manager Review)   |                           |       (status: lost)      |
+---------+----------+                           +---------------------------+
          |
6.8 Approve Disposal
          |
+---------v----------+
|     DISPOSED       |
|  (status: retired, |
| condition: scrapped|
+--------------------+
```

---

### 6.0 Register / Create Asset Directly
- **HTTP Method**: `POST`
- **Endpoint**: `/api/v1/society/inventory/assets`
- **Required Capability**: `asset.create`
- **Allowed Roles**: `BRANCH_MANAGER`, `INVENTORY_MANAGER`, `SOCIETY_ADMIN`, `BANK_OWNER`
- **Description**: Directly registers an individual serialized asset (e.g. existing branch equipment, opening balances, or direct purchases). Verifies that the catalog SKU is marked as serialized (`isSerialized: true`), validates uniqueness of `assetTag` and `serialNumber` in the society, increments the stock level at the specified branch/warehouse, and records an immutable `STOCK_IN` transaction ledger entry.
- **Real-World Use Cases**:
  - **Use Case 1 (Opening Balance / Legacy Asset Ingestion)**: Branch operations migrates to Sahayaone Inventory and registers existing workstations or cash-counting machines already physically located at the branch.
  - **Use Case 2 (Direct Local Procurement)**: A branch locally purchases an emergency biometric scanner directly with petty cash and registers its tag and serial number into the system without routing through the central warehouse.

#### Request Body Parameters (`application/json`)
| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `itemMasterId` | String (MongoId) | **Yes** | 24-character ID of the catalog SKU item (must have `isSerialized: true`) |
| `assetTag` | String | **Yes** | Unique society asset barcode tag (e.g., `AST-MN-0042`) |
| `serialNumber` | String | No | Physical OEM serial number (e.g., `SN-SAMS-F23-9981`) |
| `currentLocationType` | String | No | Location type: `'Branch'` or `'CentralInventory'` (default: `'Branch'`) |
| `currentLocationId` | String (MongoId) | No | Target branch ID or warehouse ID (defaults to user's branch or provided `branchId`) |
| `branchId` | String (MongoId) | No | Convenience alias for branch location |
| `condition` | String | No | Initial physical condition: `'new'`, `'good'`, `'fair'` (default: `'new'`) |
| `purchasePrice` | Number | No | Unit cost / procurement price |
| `purchaseDate` | Date (ISO) | No | Date acquired (e.g., `2026-09-29T10:00:00.000Z`) |
| `vendorId` | String (MongoId) | No | 24-character ID of the supplier vendor |
| `warrantyStartDate` | Date (ISO) | No | Date warranty coverage starts |
| `warrantyEndDate` | Date (ISO) | No | Date warranty expires |
| `remarks` | String | No | Initial registration notes (max 500 characters) |

#### Request Body Example
```json
{
  "itemMasterId": "6abb5e3e7d4b5c2eddd3cc17",
  "assetTag": "AST-MN-0042",
  "serialNumber": "SN-SAMS-F23-9981",
  "currentLocationType": "Branch",
  "branchId": "6ab125e189e49cc1f25e7a53",
  "condition": "new",
  "purchasePrice": 16500,
  "purchaseDate": "2026-09-29T10:00:00.000Z",
  "warrantyStartDate": "2026-09-29T10:00:00.000Z",
  "warrantyEndDate": "2027-09-29T10:00:00.000Z",
  "remarks": "Opening stock registration for field verification device"
}
```

#### Response (`201 Created`)
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Asset registered successfully.",
  "data": {
    "_id": "6abb650a7d4b5c2eddd3ceab",
    "societyId": "6ab1239b89e49cc1f25e7942",
    "itemMasterId": {
      "_id": "6abb5e3e7d4b5c2eddd3cc17",
      "name": "samsung F23",
      "code": "SKU-DELL-XPS15",
      "unit": "Pcs",
      "isSerialized": true
    },
    "assetTag": "AST-MN-0042",
    "serialNumber": "SN-SAMS-F23-9981",
    "currentLocationType": "Branch",
    "currentLocationId": "6ab125e189e49cc1f25e7a53",
    "currentEmployeeId": null,
    "condition": "new",
    "status": "active",
    "purchasePrice": 16500,
    "remarks": "Opening stock registration for field verification device",
    "createdAt": "2026-09-29T12:00:00.000Z",
    "updatedAt": "2026-09-29T12:00:00.000Z"
  }
}
```

---

### 6.1 List Assets
- **HTTP Method**: `GET`
- **Endpoints**: 
  - `/api/v1/society/inventory/my-assets` *(Staff self-scoped endpoint)*
  - `/api/v1/society/inventory/assets`
- **Required Capability**: `asset.view`
- **Description**: Retrieves a paginated list of serialized assets filtered by location, custodian, operational status, physical condition, or master SKU. The API applies strict role-based data isolation: non-manager employees are restricted to viewing only assets assigned to their personal user ID; Branch Managers see assets currently located at or assigned to staff in their branch; Bank Owners and Society Admins have full visibility across all branches and central warehouses.
- **Real-World Use Cases**:
  - **Use Case 1 (Branch Asset Audit)**: A Branch Manager initiates an inventory verification drill before the end of the financial quarter, retrieving all active equipment physically stationed at the Pune Branch or held by branch employees.
  - **Use Case 2 (Staff Equipment Portal)**: A field Loan Officer opens the "My Equipment" section of their staff portal (`/my-assets`) to verify the serial numbers and warranty statuses of the biometric scanner and tablet assigned to them.
  - **Use Case 3 (Maintenance Queue Oversight)**: An Inventory Officer queries `status=in_repair` across the society to generate a report of all devices currently dispatched to external service centers.

#### Scoping Behavior
- **Regular Staff / Employee**: Automatically scoped to assets currently assigned to them (`currentEmployeeId = context.userId`).
- **Branch Manager**: Scoped to all branch assets (located at branch or assigned to branch users).
- **Bank Owner / Society Admin**: Society-wide asset visibility.

#### Query Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `page` | Integer | No | `1` | Page number (min `1`) |
| `limit` | Integer | No | `10` | Records per page (min `1`, max `100`) |
| `currentLocationType` | String | No | - | Filter by location type: `'CentralInventory'`, `'Branch'`, `'User'` |
| `currentLocationId` | String (MongoId) | No | - | Warehouse, Branch, or User ID |
| `branchId` | String (MongoId) | No | - | Filter by branch location |
| `currentEmployeeId` | String (MongoId) | No | - | Filter by assigned employee |
| `itemMasterId` | String (MongoId) | No | - | Filter by catalog item SKU |
| `status` | String | No | - | Filter by status: `'active'`, `'in_repair'`, `'retired'`, `'lost'` |
| `condition` | String | No | - | Filter by condition: `'new'`, `'good'`, `'fair'`, `'damaged'`, `'scrapped'` |
| `search` | String | No | - | Search query matched against `assetTag` or `serialNumber` |
| `sortBy` | String | No | `'createdAt'` | Sort field: `'assetTag'`, `'serialNumber'`, `'status'`, `'condition'`, `'createdAt'` |
| `sortOrder` | String | No | `'desc'` | Sort direction: `'asc'`, `'desc'` |

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Assets retrieved successfully.",
  "data": [
    {
      "_id": "66d62c10a1e9b20012345683",
      "societyId": "66d62884a1e9b20012345600",
      "itemMasterId": {
        "_id": "66d629f5a1e9b20012345680",
        "name": "Dell XPS 15 9530",
        "code": "SKU-DELL-XPS15",
        "unit": "Piece",
        "brand": "Dell",
        "model": "XPS 15",
        "type": "Hardware"
      },
      "assetTag": "TAG-LAP-001",
      "serialNumber": "SN-DELL-998811",
      "currentLocationType": "Branch",
      "currentLocationId": "66d62884a1e9b20012345678",
      "currentEmployeeId": {
        "_id": "66d62884a1e9b20012345699",
        "fullName": "Rahul Sharma",
        "email": "rahul.sharma@sahayaone.com",
        "phoneNumber": "9876543210"
      },
      "vendorId": {
        "_id": "66d62ab8a1e9b20012345681",
        "name": "TechSupplies Pvt Ltd",
        "code": "VEN-TECHSUP"
      },
      "condition": "good",
      "status": "active",
      "remarks": "Assigned for field inspections",
      "createdAt": "2026-09-29T10:00:00.000Z",
      "updatedAt": "2026-09-29T10:30:00.000Z"
    }
  ],
  "meta": {
    "totalRecords": 1,
    "limit": 10,
    "page": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

---

### 6.2 Get Asset by ID & History
- **HTTP Method**: `GET`
- **Endpoint**: `/api/v1/society/inventory/assets/:id`
- **Required Capability**: `asset.view`
- **Description**: Fetches comprehensive profile details for a specific asset (catalog specifications, vendor details, purchase cost, warranty expiry, current custodian) along with its complete, chronological custody chain (`AssetsAssignment` history). Non-manager employees are prevented from inspecting assets that are not assigned to them.
- **Real-World Use Cases**:
  - **Use Case 1 (Custody & Responsibility Dispute)**: When an office laptop is turned in with physical damage, the Branch Manager queries the asset's history to review every prior employee who possessed the unit, their assignment dates, and their hand-over remarks.
  - **Use Case 2 (Warranty Claim Verification)**: IT Support looks up an asset's purchase invoice date, supplier vendor ID, and warranty expiration dates before booking an official RMA on-site motherboard repair ticket with the manufacturer.

#### Path Parameter
| Parameter | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `id` | String (MongoId) | **Yes** | 24-character hexadecimal MongoDB ObjectId of the asset |

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Asset details and lifecycle history retrieved successfully.",
  "data": {
    "_id": "66d62c10a1e9b20012345683",
    "societyId": "66d62884a1e9b20012345600",
    "itemMasterId": {
      "_id": "66d629f5a1e9b20012345680",
      "name": "Dell XPS 15 9530",
      "code": "SKU-DELL-XPS15",
      "unit": "Piece",
      "brand": "Dell",
      "model": "XPS 15",
      "type": "Hardware"
    },
    "assetTag": "TAG-LAP-001",
    "serialNumber": "SN-DELL-998811",
    "currentLocationType": "Branch",
    "currentLocationId": "66d62884a1e9b20012345678",
    "currentEmployeeId": {
      "_id": "66d62884a1e9b20012345699",
      "fullName": "Rahul Sharma",
      "email": "rahul.sharma@sahayaone.com",
      "phoneNumber": "9876543210"
    },
    "vendorId": {
      "_id": "66d62ab8a1e9b20012345681",
      "name": "TechSupplies Pvt Ltd",
      "code": "VEN-TECHSUP",
      "contactPerson": "Anand Verma"
    },
    "condition": "good",
    "status": "active",
    "remarks": "Assigned for field inspections",
    "createdAt": "2026-09-29T10:00:00.000Z",
    "updatedAt": "2026-09-29T10:30:00.000Z",
    "assignmentHistory": [
      {
        "_id": "66d62f80a1e9b20012345690",
        "assetId": "66d62c10a1e9b20012345683",
        "employeeId": {
          "_id": "66d62884a1e9b20012345699",
          "fullName": "Rahul Sharma",
          "email": "rahul.sharma@sahayaone.com",
          "phoneNumber": "9876543210"
        },
        "branchId": {
          "_id": "66d62884a1e9b20012345678",
          "name": "Pune Main Branch",
          "code": "BR-PUNE-01"
        },
        "assignedBy": {
          "_id": "66d62884a1e9b20012345655",
          "fullName": "Branch Manager",
          "email": "manager@sahayaone.com"
        },
        "assignedAt": "2026-09-29T10:30:00.000Z",
        "returnedAt": null,
        "condition": "good",
        "remarks": "Issued for Q3 audit operations"
      }
    ]
  }
}
```

---

### 6.3 Assign Asset to Employee
- **HTTP Method**: `POST`
- **Endpoint**: `/api/v1/society/inventory/assets/assign`
- **Required Capability**: `asset.assign`
- **Allowed Roles**: `BRANCH_MANAGER`, `INVENTORY_MANAGER`, `SOCIETY_ADMIN`, `BANK_OWNER`
- **Description**: Transfers custody of an available asset to a specific staff member. Atomically updates the asset's location to `currentLocationType: 'User'`, records `currentEmployeeId`, creates a new active entry in `AssetsAssignment` (`returnedAt: null`), and creates an audit entry in `InventoryTransaction` (`type: 'ISSUE'`).
- **Guards**:
  - The target asset must be in `active` status and cannot already be assigned to another staff member.
  - The employee must exist and belong to the active society bank.
- **Real-World Use Cases**:
  - **Use Case 1 (New Hire Provisioning)**: An HR / Branch Administrator provisions an unassigned laptop (`AST-DELL-004`) to a newly joined Branch Accountant on their first day of work.
  - **Use Case 2 (Field Survey Equipment Allocation)**: Branch Operations assigns a portable biometric Aadhaar scanner to a Loan Verification Officer for customer doorstep verification visits.

#### Request Body Parameters (`application/json`)
| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `assetId` | String (MongoId) | **Yes** | 24-character ID of the active serialized asset |
| `employeeId` | String (MongoId) | **Yes** | 24-character ID of the employee receiving the asset |
| `branchId` | String (MongoId) | No | Branch where assignment is recorded (defaults to user's branch) |
| `condition` | String | No | Initial condition: `'new'`, `'good'`, `'fair'` (default: `'good'`) |
| `remarks` | String | No | Assignment notes or purpose (max 500 characters) |

#### Request Body Example
```json
{
  "assetId": "66d62c10a1e9b20012345683",
  "employeeId": "66d62884a1e9b20012345699",
  "branchId": "66d62884a1e9b20012345678",
  "condition": "good",
  "remarks": "Issued for Q3 loan verification field work"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Asset assigned to employee successfully.",
  "data": {
    "asset": {
      "_id": "66d62c10a1e9b20012345683",
      "assetTag": "TAG-LAP-001",
      "serialNumber": "SN-DELL-998811",
      "currentLocationType": "User",
      "currentLocationId": "66d62884a1e9b20012345699",
      "currentEmployeeId": {
        "_id": "66d62884a1e9b20012345699",
        "fullName": "Rahul Sharma",
        "email": "rahul.sharma@sahayaone.com"
      },
      "status": "active",
      "condition": "good"
    },
    "assignmentId": "66d62f80a1e9b20012345690"
  }
}
```

---

### 6.4 Return Asset from Employee (➔ AVAILABLE)
- **HTTP Method**: `POST`
- **Endpoints**: 
  - `/api/v1/society/inventory/my-assets/:id/return` *(Staff self-return endpoint)*
  - `/api/v1/society/inventory/assets/:id/return`
- **Required Capability**: `asset.return`
- **Allowed Roles**: Assigned Employee, Branch Manager, Society Admin, Bank Owner
- **Description**: Relinquishes staff custody and returns the asset to branch pool inventory (`currentEmployeeId: null`, `currentLocationType: 'Branch'`). Closes the open `AssetsAssignment` record by setting `returnedAt: new Date()` and logging return notes. If the returned condition is `'damaged'`, the system automatically transitions the asset status to `'in_repair'`.
- **Security Check**: Non-manager employees calling `/my-assets/:id/return` can only return assets that are directly assigned to their own user ID.
- **Real-World Use Cases**:
  - **Use Case 1 (Staff Resignation Clearance)**: A resigning employee returns their laptop and identity card printer during clearance; the manager inspects the hardware condition as `'good'` and marks the return complete.
  - **Use Case 2 (Return with Fault/Damage)**: An employee returns an office tablet with a cracked screen; the return is recorded with `condition: 'damaged'`, prompting the backend to immediately move the unit to maintenance status (`in_repair`).

#### Path Parameter
| Parameter | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `id` | String (MongoId) | **Yes** | 24-character hexadecimal MongoDB ObjectId of the asset |

#### Request Body Parameters (`application/json`)
| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `condition` | String | **Yes** | Return condition: `'new'`, `'good'`, `'fair'`, `'damaged'`. *(If `'damaged'`, status automatically becomes `'in_repair'`)* |
| `remarks` | String | No | Notes on return reason or physical state (max 500 chars) |

#### Request Body Example
```json
{
  "condition": "good",
  "remarks": "Employee returned asset upon project completion"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Asset returned and restored to available inventory.",
  "data": {
    "_id": "66d62c10a1e9b20012345683",
    "assetTag": "TAG-LAP-001",
    "serialNumber": "SN-DELL-998811",
    "currentLocationType": "Branch",
    "currentLocationId": "66d62884a1e9b20012345678",
    "currentEmployeeId": null,
    "status": "active",
    "condition": "good",
    "remarks": "Employee returned asset upon project completion"
  }
}
```

---

### 6.5 Report Damaged (➔ MAINTENANCE / `in_repair`)
- **HTTP Method**: `POST`
- **Endpoint**: `/api/v1/society/inventory/assets/:id/report-damage`
- **Required Capability**: `asset.update`
- **Allowed Roles**: `BRANCH_MANAGER`, `BRANCH_INVENTORY_OFFICER`, `SOCIETY_ADMIN`, `BANK_OWNER`
- **Description**: Marks an active or idle asset as damaged or defective, immediately moving its operational status to `'in_repair'` and updating `condition: 'damaged'`. Logs detailed incident notes and locks the asset from being assigned to any employee until repair is completed.
- **Real-World Use Cases**:
  - **Use Case 1 (Branch Hardware Failure)**: A branch passbook printer fails due to a power spike; the Branch Inventory Officer reports the damage with diagnostic notes and schedules a service engineer visit.
  - **Use Case 2 (Field Transit Accident)**: A field executive reports that an office-issued mobile terminal fell during a client visit; the device is taken out of service into `in_repair` to prevent faulty operations.

#### Path Parameter
| Parameter | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `id` | String (MongoId) | **Yes** | 24-character hexadecimal MongoDB ObjectId of the asset |

#### Request Body Parameters (`application/json`)
| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `remarks` | String | **Yes** | Detailed description of the damage and repair needs (max 500 chars) |

#### Request Body Example
```json
{
  "remarks": "Screen cracked during field audit, sent to authorized service center"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Asset marked as damaged and moved to maintenance.",
  "data": {
    "_id": "66d62c10a1e9b20012345683",
    "assetTag": "TAG-LAP-001",
    "status": "in_repair",
    "condition": "damaged",
    "remarks": "MAINTENANCE: Screen cracked during field audit, sent to authorized service center"
  }
}
```

---

### 6.6 Repair Complete (➔ AVAILABLE)
- **HTTP Method**: `POST`
- **Endpoint**: `/api/v1/society/inventory/assets/:id/repair-complete`
- **Required Capability**: `asset.update`
- **Allowed Roles**: `BRANCH_MANAGER`, `BRANCH_INVENTORY_OFFICER`, `SOCIETY_ADMIN`, `BANK_OWNER`
- **Description**: Concludes maintenance on an asset that was undergoing repair. Transitions the asset's `status` back to `'active'`, re-evaluates its operational condition (`'good'` or `'fair'`), and prefixes maintenance remarks with `REPAIR COMPLETED: ...`.
- **Guards**: Fails with `400 Bad Request` if the asset is not currently in `'in_repair'` status.
- **Real-World Use Cases**:
  - **Use Case 1 (Authorized Service Handover)**: The vendor returns a repaired thermal receipt printer with a replaced motherboard; the inventory officer runs print tests and marks the repair complete.
  - **Use Case 2 (Internal Maintenance Sign-off)**: An internal IT technician replaces a swollen laptop battery, runs diagnostics, and restores the machine to the branch's pool of ready-to-use workstations.

#### Path Parameter
| Parameter | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `id` | String (MongoId) | **Yes** | 24-character hexadecimal MongoDB ObjectId of the asset |

#### Request Body Parameters (`application/json`)
| Field | Type | Required | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `condition` | String | No | `'good'` | Post-repair condition: `'good'`, `'fair'` |
| `remarks` | String | No | - | Repair summary, replaced parts, or testing notes (max 500 chars) |

#### Request Body Example
```json
{
  "condition": "good",
  "remarks": "Screen replacement complete, tested and working"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Asset repair completed and restored to available inventory.",
  "data": {
    "_id": "66d62c10a1e9b20012345683",
    "assetTag": "TAG-LAP-001",
    "status": "active",
    "condition": "good",
    "remarks": "REPAIR COMPLETED: Screen replacement complete, tested and working"
  }
}
```

---

### 6.7 Request Disposal (Officer Scrap Recommendation)
- **HTTP Method**: `POST`
- **Endpoint**: `/api/v1/society/inventory/assets/:id/request-disposal`
- **Required Capability**: `asset.request_dispose`
- **Allowed Roles**: `BRANCH_INVENTORY_OFFICER`, `BRANCH_MANAGER`, `SOCIETY_ADMIN`
- **Description**: Initiates the first step of a dual-control decommissioning process. A Branch Inventory Officer or Technician submits a formal recommendation that an asset be written off / scrapped because repair costs exceed its salvage value or it has reached end-of-life. Sets `disposalRequested: true` and logs justification remarks for management review.
- **Real-World Use Cases**:
  - **Use Case 1 (Beyond Economical Repair - BER)**: A service center reports that a water-damaged field scanner requires ₹18,000 for replacement components, while a new unit costs ₹20,000; the officer recommends write-off.
  - **Use Case 2 (Cybersecurity Obsolescence)**: Old branch desktops running deprecated operating systems that cannot support modern security updates are submitted for formal disposal approval.

#### Path Parameter
| Parameter | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `id` | String (MongoId) | **Yes** | 24-character hexadecimal MongoDB ObjectId of the asset |

#### Request Body Parameters (`application/json`)
| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `remarks` | String | **Yes** | Justification explaining why the asset is beyond repair and should be scrapped |

#### Request Body Example
```json
{
  "remarks": "Technician confirmed motherboard dead, repair cost exceeds value, scrap recommended"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Disposal recommendation submitted for Branch Manager approval.",
  "data": {
    "assetId": "66d62c10a1e9b20012345683",
    "assetTag": "TAG-LAP-001",
    "status": "in_repair",
    "disposalRequested": true,
    "message": "Disposal recommendation submitted for Branch Manager approval."
  }
}
```

---

### 6.8 Approve Disposal (Branch Manager / Admin Authority ➔ `retired` / `scrapped`)
- **HTTP Method**: `POST`
- **Endpoint**: `/api/v1/society/inventory/assets/:id/approve-disposal`
- **Required Capability**: `asset.dispose`
- **Allowed Roles**: `BRANCH_MANAGER`, `SOCIETY_ADMIN`, `INVENTORY_MANAGER`, `BANK_OWNER`
- **Description**: The authorizing second step for decommissioning. A Branch Manager or Society Admin approves the disposal request, permanently setting the asset `status: 'retired'` and `condition: 'scrapped'`, nullifying any custodian links, and recording an immutable audit log.
- **Real-World Use Cases**:
  - **Use Case 1 (Annual Asset Depreciation Write-off)**: The Society Board / Branch Manager reviews recommended scrapped equipment and formally approves derecognition from the balance sheet.
  - **Use Case 2 (E-Waste Recycling Handover)**: Obsolete servers or dead UPS batteries are officially handed over to an authorized government e-waste contractor, and the records are closed as retired.

#### Path Parameter
| Parameter | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `id` | String (MongoId) | **Yes** | 24-character hexadecimal MongoDB ObjectId of the asset |

#### Request Body Parameters (`application/json`)
| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `remarks` | String | No | Final decommissioning approval notes (max 500 chars) |

#### Request Body Example
```json
{
  "remarks": "Approved for physical scrapping and write-off after manager inspection"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Asset disposal approved and marked as scrapped/retired.",
  "data": {
    "_id": "66d62c10a1e9b20012345683",
    "assetTag": "TAG-LAP-001",
    "status": "retired",
    "condition": "scrapped",
    "remarks": "DISPOSED / SCRAPPED: Approved for physical scrapping and write-off after manager inspection"
  }
}
```

---

### 6.9 Report Lost (➔ INVESTIGATION / `lost`)
- **HTTP Method**: `POST`
- **Endpoint**: `/api/v1/society/inventory/assets/:id/report-lost`
- **Required Capability**: `asset.update`
- **Allowed Roles**: `BRANCH_MANAGER`, `BRANCH_INVENTORY_OFFICER`, `SOCIETY_ADMIN`, `BANK_OWNER`
- **Description**: Flags an asset as missing or stolen during branch audits or field operations. Sets `status: 'lost'`, appends `UNDER_INVESTIGATION:` to remarks, and prevents any further issuance or transfer while inquiry is conducted.
- **Real-World Use Cases**:
  - **Use Case 1 (Audit Discrepancy)**: During annual physical stock-taking, a barcode tag listed in the register cannot be located anywhere in the branch premises; the officer marks it lost pending further verification.
  - **Use Case 2 (Transit / Field Theft)**: A Loan Officer reports that an office mobile tablet was stolen from a vehicle during field visits; the branch manager flags the asset as lost and attaches the police FIR details in remarks.

#### Path Parameter
| Parameter | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `id` | String (MongoId) | **Yes** | 24-character hexadecimal MongoDB ObjectId of the asset |

#### Request Body Parameters (`application/json`)
| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `remarks` | String | **Yes** | Incident details and last known location/custodian of the lost asset |

#### Request Body Example
```json
{
  "remarks": "Asset not found during physical branch audit in cabinet B-3"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Asset reported lost and moved under investigation.",
  "data": {
    "_id": "66d62c10a1e9b20012345683",
    "assetTag": "TAG-LAP-001",
    "status": "lost",
    "condition": "good",
    "remarks": "UNDER_INVESTIGATION: Asset not found during physical branch audit in cabinet B-3"
  }
}
```

---

### 6.10 Recover Asset (➔ AVAILABLE)
- **HTTP Method**: `POST`
- **Endpoint**: `/api/v1/society/inventory/assets/:id/recover`
- **Required Capability**: `asset.update`
- **Allowed Roles**: `BRANCH_MANAGER`, `BRANCH_INVENTORY_OFFICER`, `SOCIETY_ADMIN`, `BANK_OWNER`
- **Description**: Restores a previously lost or missing asset back to active inventory upon discovery or recovery. Sets `status: 'active'`, allows reassessing the physical condition (`'good'`, `'fair'`, or `'damaged'`), and prepends `RECOVERED:` to remarks.
- **Guards**: Fails with `400 Bad Request` if the asset is not currently in `'lost'` status.
- **Real-World Use Cases**:
  - **Use Case 1 (Misplaced Equipment Rediscovered)**: A biometric scanner presumed lost is found during store room reorganization inside an unlabeled box; the officer inspects the hardware and marks it recovered.
  - **Use Case 2 (Recovered Stolen Property)**: Police recover an office tablet after an investigation; IT verifies the device serial number, tests functionality, and recovers it back into active inventory.

#### Path Parameter
| Parameter | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `id` | String (MongoId) | **Yes** | 24-character hexadecimal MongoDB ObjectId of the asset |

#### Request Body Parameters (`application/json`)
| Field | Type | Required | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `condition` | String | No | `'good'` | Condition upon recovery: `'good'`, `'fair'`, `'damaged'` |
| `remarks` | String | No | - | Recovery location and inspection findings (max 500 chars) |

#### Request Body Example
```json
{
  "condition": "good",
  "remarks": "Recovered from storage locker, verified operational"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Asset recovered and restored to active inventory.",
  "data": {
    "_id": "66d62c10a1e9b20012345683",
    "assetTag": "TAG-LAP-001",
    "status": "active",
    "condition": "good",
    "remarks": "RECOVERED: Recovered from storage locker, verified operational"
  }
}
```


---

## 7. Stock Adjustment APIs (`STOCK_ADJUSTMENT` Module)

### 7.1 Create Stock Adjustment Request
- **HTTP Method**: `POST`
- **Endpoint**: `/api/v1/society/inventory/stock-adjustments`
- **Required Capability**: `stock_adjustment.create`
- **Allowed Roles**: `BRANCH_INVENTORY_OFFICER`, `BRANCH_MANAGER`, `SOCIETY_ADMIN`, `BANK_OWNER`, `INVENTORY_MANAGER`

#### Request Body Parameters (`application/json`)
| Field | Type | Required | Source / Where to Find | Description & Rules |
| :--- | :--- | :---: | :--- | :--- |
| `branchId` | String (MongoId) | **Yes** *(for Admin/Owner)* | `GET /api/v1/society/branches` | Branch where adjustment is being logged. *(Required for Bank Owner/Admin tokens)* |
| `itemMasterId` | String (MongoId) | **Yes** | `GET /api/v1/society/inventory/items` | Target catalog SKU ID |
| `adjustmentType` | String | **Yes** | Enum | `'INCREASE'` (adds stock) or `'DECREASE'` (deducts stock) |
| `quantity` | Integer | **Yes** | Input | Number of units to adjust (min `1`) |
| `reason` | String | **Yes** | Enum | `'DAMAGE'`, `'LOST'`, `'AUDIT_DISCREPANCY'`, `'RECOVERY'`, `'EXPIRED'` |
| `locationType` | String | No | Enum | Location scope: `'Branch'` (default) or `'CentralInventory'` |
| `locationId` | String (MongoId) | No | Branch / Warehouse ID | Defaults to `branchId` if omitted |
| `assetId` | String (MongoId) | No | `GET /api/v1/society/inventory/assets` | Specific serialized asset being adjusted/scrapped |
| `remarks` | String | No | Input | Audit trail explanation (max 500 chars) |

> [!IMPORTANT]
> **Branch ID Context**: Users logged in with society-wide authority (e.g. `BANK_OWNER` or `SOCIETY_ADMIN`) do not have a default `branchId` assigned to their token. They **must explicitly supply `branchId`** in the request body.

#### Request Body
```json
{
  "branchId": "{{BRANCH_ID}}",
  "itemMasterId": "{{ITEM_MASTER_CONSUMABLE}}",
  "locationType": "Branch",
  "locationId": "{{BRANCH_ID}}",
  "adjustmentType": "DECREASE",
  "quantity": 2,
  "reason": "DAMAGE",
  "remarks": "Found water damage during weekly stock check"
}
```

#### Request Body Example
```json
{
  "branchId": "66d62884a1e9b20012345678",
  "itemMasterId": "66d629f5a1e9b20012345680",
  "locationType": "Branch",
  "locationId": "66d62884a1e9b20012345678",
  "adjustmentType": "DECREASE",
  "quantity": 2,
  "reason": "DAMAGE",
  "assetId": null,
  "remarks": "Water leakage in storeroom damaged 2 boxes"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Stock adjustment request created successfully.",
  "data": {
    "_id": "66d81234567890abcdef7001",
    "societyId": "66d62884a1e9b20012345600",
    "branchId": {
      "_id": "66d62884a1e9b20012345678",
      "name": "Pune Main Branch",
      "code": "BR-PUNE-01"
    },
    "itemMasterId": {
      "_id": "66d629f5a1e9b20012345680",
      "name": "Dell XPS 15 9530",
      "code": "SKU-DELL-XPS15",
      "unit": "Piece",
      "isSerialized": true
    },
    "assetId": null,
    "locationType": "Branch",
    "locationId": "66d62884a1e9b20012345678",
    "adjustmentType": "DECREASE",
    "quantity": 2,
    "reason": "DAMAGE",
    "status": "PENDING",
    "requestedBy": {
      "_id": "66d62884a1e9b20012345699",
      "fullName": "Branch Officer",
      "email": "officer@sahayaone.com"
    },
    "approvedBy": null,
    "remarks": "Water leakage in storeroom damaged 2 boxes",
    "createdAt": "2026-09-29T12:00:00.000Z"
  }
}
```


---

### 7.2 List Stock Adjustments
- **HTTP Method**: `GET`
- **Endpoint**: `/api/v1/society/inventory/stock-adjustments`
- **Required Capability**: `stock_adjustment.view`
- **Allowed Roles**: `BANK_OWNER`, `SOCIETY_ADMIN`, `INVENTORY_MANAGER`, `BRANCH_MANAGER`, `BRANCH_INVENTORY_OFFICER`

#### Query Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `page` | Integer | No | `1` | Page number (min `1`) |
| `limit` | Integer | No | `10` | Records per page (min `1`, max `100`) |
| `branchId` | String (MongoId) | No | - | Filter by branch (automatically branch-scoped for branch staff) |
| `status` | String | No | - | Status filter: `'PENDING'`, `'APPROVED'`, `'REJECTED'` |
| `reason` | String | No | - | Reason filter: `'DAMAGE'`, `'LOST'`, `'AUDIT_DISCREPANCY'`, `'RECOVERY'`, `'EXPIRED'` |
| `adjustmentType` | String | No | - | Type filter: `'INCREASE'`, `'DECREASE'` |
| `sortBy` | String | No | `'createdAt'` | Sort field: `'createdAt'`, `'status'`, `'quantity'` |
| `sortOrder` | String | No | `'desc'` | Sort direction: `'asc'`, `'desc'` |

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Stock adjustments retrieved successfully.",
  "data": [
    {
      "_id": "66d81234567890abcdef7001",
      "societyId": "66d62884a1e9b20012345600",
      "branchId": {
        "_id": "66d62884a1e9b20012345678",
        "name": "Pune Main Branch",
        "code": "BR-PUNE-01"
      },
      "itemMasterId": {
        "_id": "66d629f5a1e9b20012345680",
        "name": "Dell XPS 15 9530",
        "code": "SKU-DELL-XPS15",
        "unit": "Piece",
        "isSerialized": true
      },
      "assetId": null,
      "locationType": "Branch",
      "locationId": "66d62884a1e9b20012345678",
      "adjustmentType": "DECREASE",
      "quantity": 2,
      "reason": "DAMAGE",
      "status": "PENDING",
      "requestedBy": {
        "_id": "66d62884a1e9b20012345699",
        "fullName": "Branch Officer",
        "email": "officer@sahayaone.com",
        "phoneNumber": "9876543210"
      },
      "approvedBy": null,
      "remarks": "Water leakage in storeroom damaged 2 boxes",
      "createdAt": "2026-09-29T12:00:00.000Z",
      "updatedAt": "2026-09-29T12:00:00.000Z"
    }
  ],
  "meta": {
    "totalRecords": 1,
    "limit": 10,
    "page": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

---

### 7.3 Get Stock Adjustment by ID
- **HTTP Method**: `GET`
- **Endpoint**: `/api/v1/society/inventory/stock-adjustments/:id`
- **Required Capability**: `stock_adjustment.view`
- **Allowed Roles**: `BANK_OWNER`, `SOCIETY_ADMIN`, `INVENTORY_MANAGER`, `BRANCH_MANAGER`, `BRANCH_INVENTORY_OFFICER`

#### Path Parameter
| Parameter | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `id` | String (MongoId) | **Yes** | 24-character hexadecimal MongoDB ObjectId of the stock adjustment |

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Stock adjustment details retrieved successfully.",
  "data": {
    "_id": "66d81234567890abcdef7001",
    "societyId": "66d62884a1e9b20012345600",
    "branchId": {
      "_id": "66d62884a1e9b20012345678",
      "name": "Pune Main Branch",
      "code": "BR-PUNE-01"
    },
    "itemMasterId": {
      "_id": "66d629f5a1e9b20012345680",
      "name": "Dell XPS 15 9530",
      "code": "SKU-DELL-XPS15",
      "unit": "Piece",
      "isSerialized": true
    },
    "assetId": null,
    "locationType": "Branch",
    "locationId": "66d62884a1e9b20012345678",
    "adjustmentType": "DECREASE",
    "quantity": 2,
    "reason": "DAMAGE",
    "status": "PENDING",
    "requestedBy": {
      "_id": "66d62884a1e9b20012345699",
      "fullName": "Branch Officer",
      "email": "officer@sahayaone.com",
      "phoneNumber": "9876543210"
    },
    "approvedBy": null,
    "remarks": "Water leakage in storeroom damaged 2 boxes",
    "createdAt": "2026-09-29T12:00:00.000Z",
    "updatedAt": "2026-09-29T12:00:00.000Z"
  }
}
```

---

### 7.4 Approve Stock Adjustment (Branch Manager Authority)
- **HTTP Method**: `POST`
- **Endpoint**: `/api/v1/society/inventory/stock-adjustments/:id/approve`
- **Required Capability**: `stock_adjustment.approve`
- **Allowed Roles**: `BRANCH_MANAGER`, `SOCIETY_ADMIN`, `INVENTORY_MANAGER`

#### Request Body (`application/json` - optional)
```json
{
  "remarks": "Verified physical inventory damage and approved stock write-down"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Stock adjustment approved and applied successfully.",
  "data": {
    "_id": "66d81234567890abcdef7001",
    "status": "APPROVED",
    "approvedBy": "66d62884a1e9b20012345655",
    "remarks": "Water leakage in storeroom damaged 2 boxes | Approved: Verified physical inventory damage and approved stock write-down"
  }
}
```

---

### 7.5 Reject Stock Adjustment (Branch Manager Authority)
- **HTTP Method**: `POST`
- **Endpoint**: `/api/v1/society/inventory/stock-adjustments/:id/reject`
- **Required Capability**: `stock_adjustment.approve`
- **Allowed Roles**: `BRANCH_MANAGER`, `SOCIETY_ADMIN`, `INVENTORY_MANAGER`

#### Request Body (`application/json` - optional)
```json
{
  "remarks": "Physical verification showed items are intact"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Stock adjustment rejected successfully.",
  "data": {
    "_id": "66d81234567890abcdef7001",
    "status": "REJECTED",
    "remarks": "Physical verification showed items are intact"
  }
}
```

---

### 7.6 Edit Stock Adjustment (PENDING Status Only)
- **HTTP Method**: `PUT`
- **Endpoint**: `/api/v1/society/inventory/stock-adjustments/:id`
- **Required Capability**: `stock_adjustment.update`
- **Allowed Roles**: `BRANCH_MANAGER`, `BRANCH_INVENTORY_OFFICER`, `SOCIETY_ADMIN`, `INVENTORY_MANAGER`
- *Guards*: Fails with `400 Bad Request` if adjustment is already `APPROVED` or `REJECTED`.

#### Request Body (`application/json` - at least 1 field required)
```json
{
  "quantity": 3,
  "adjustmentType": "DECREASE",
  "reason": "DAMAGE",
  "remarks": "Re-verified physical box count, damaged unit count increased to 3"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Stock adjustment updated successfully.",
  "data": {
    "_id": "66d81234567890abcdef7001",
    "status": "PENDING",
    "quantity": 3,
    "adjustmentType": "DECREASE",
    "reason": "DAMAGE"
  }
}
```

---

### 7.7 Delete / Cancel Stock Adjustment (PENDING Status Only)

- **HTTP Method**: `DELETE`
- **Endpoint**: `/api/v1/society/inventory/stock-adjustments/:id`
- **Required Capability**: `stock_adjustment.delete`
- **Allowed Roles**: `BRANCH_MANAGER`, `BRANCH_INVENTORY_OFFICER`, `SOCIETY_ADMIN`, `INVENTORY_MANAGER`
- *Guards*: Fails with `400 Bad Request` if adjustment is already `APPROVED` or `REJECTED`.

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Pending stock adjustment request deleted/cancelled successfully.",
  "data": {
    "id": "66d81234567890abcdef7001",
    "deleted": true
  }
}
```

---

## 8. Legacy Inventory APIs (`/api/v1/society/inventory`)

> [!NOTE]
> These endpoints manage basic tenant-scoped inventory tracking (`assets` and `quantity`).

### 8.1 Export Inventory (CSV)
- **HTTP Method**: `GET`
- **Endpoint**: `/api/v1/society/inventory/export`
- **Required Permission**: `inventory.view`
- **Query Parameters**:
  - `search`: Filter by asset name
  - `minQuantity`: Minimum quantity filter
  - `maxQuantity`: Maximum quantity filter
  - `sortBy`: Sorting field (`assets`, `quantity`, `createdAt`; default: `createdAt`)
  - `sortOrder`: `asc` or `desc` (default: `desc`)
- **Response**: CSV file download (`inventory.csv`).

### 8.2 List Legacy Inventory
- **HTTP Method**: `GET`
- **Endpoint**: `/api/v1/society/inventory`
- **Required Permission**: `inventory.view`
- **Query Parameters**: Same as Export (`page`, `limit`, `search`, `minQuantity`, `maxQuantity`, `sortBy`, `sortOrder`).
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Inventory retrieved successfully.",
  "data": [
    {
      "srNo": 1,
      "id": "66d1234567890abcdef00001",
      "assets": "Computer",
      "quantity": 1800
    }
  ],
  "meta": {
    "totalRecords": 1,
    "limit": 10,
    "page": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

### 8.3 Create Legacy Inventory Item
- **HTTP Method**: `POST`
- **Endpoint**: `/api/v1/society/inventory`
- **Required Permission**: `inventory.create`
- **Request Body (`application/json`)**:
```json
{
  "assets": "Computer",
  "quantity": 1800
}
```
- **Response (`201 Created`)**:
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Inventory added successfully.",
  "data": {
    "id": "66d1234567890abcdef00001",
    "assets": "Computer",
    "quantity": 1800
  }
}
```

### 8.4 Update Legacy Inventory Item
- **HTTP Method**: `PUT`
- **Endpoint**: `/api/v1/society/inventory/:id`
- **Required Permission**: `inventory.update`
- **Request Body (`application/json` - at least 1 field required)**:
```json
{
  "assets": "Desktop Computer",
  "quantity": 2000
}
```
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Inventory updated successfully.",
  "data": {
    "id": "66d1234567890abcdef00001",
    "assets": "Desktop Computer",
    "quantity": 2000
  }
}
```

### 8.5 Delete Legacy Inventory Item (Soft Delete)
- **HTTP Method**: `DELETE`
- **Endpoint**: `/api/v1/society/inventory/:id`
- **Required Permission**: `inventory.delete`
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Inventory deleted successfully.",
  "data": {
    "id": "66d1234567890abcdef00001"
  }
}
```

---

## Error Handling Specifications

### 1. HTTP 403 Forbidden (Insufficient Capability)
Returned when a role without `inventory_catalog.create`, `vendor.create`, or `central_stock.receive` tries to call creation endpoints.
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Access denied. Required capability [inventory_catalog.create] is not granted to your assigned role."
}
```

### 2. HTTP 409 Conflict (Duplicate Code / Tag)
Returned when creating an entity with a code or barcode tag that already exists under the society.
```json
{
  "success": false,
  "statusCode": 409,
  "message": "Inventory item SKU with code [SKU-DELL-XPS15] already exists."
}
```

### 3. HTTP 400 Bad Request (Validation Failure)
Returned when Joi schema validation fails.
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation Error: \"name\" is required"
}
```
