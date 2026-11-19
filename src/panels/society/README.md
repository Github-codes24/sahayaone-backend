# Sahayaone ERP - Society Panel Module

This directory contains the core implementation for the **Society Panel** within the Sahayaone ERP Backend infrastructure.

Detailed API Specifications, endpoint guides, request/response models, and HR configuration tab schemas are documented in:
👉 [docs/panels/society/README.md](../../../docs/panels/society/README.md)

---

## 📂 Sub-module Structure

* `auth/`: Authentication endpoints (`login`, `refresh`, `logout`, `me`) supporting Bank Owner, Branch Manager, and Society Employee.
* `branches/`: Branch creation, listing (city/state filters), available cities/states dropdown (`GET /available-locations`), soft deletion, and 6 HR tabs Branch Manager profile updates. Documented in: 👉 [branches/SOCIETY_BRANCH_API_DOCUMENTATION.md](./branches/SOCIETY_BRANCH_API_DOCUMENTATION.md)
* `permissions/`: Centralized system permissions registry endpoint (`GET /api/v1/society/permissions`).
* `roles/`: Bank-scoped Society Role CRUD (`create`, `list`, `get`, `update`, `delete` with employee safety checks).
* `employees/`: Society Employee management (`create` with transaction, `list`, `get`, `update`, `delete`, `changeRole`, `changeBranch`, 6 HR tabs).
* `leads/`: Tenant-scoped Leads listing, search/filter, CSV export, detail, and soft deletion.
* `attendance/`: Employee, Branch Manager, and Society Staff attendance marking (punch-in, punch-out, today status, monthly report, leave application). Documented in: 👉 [attendance/SOCIETY_ATTENDANCE_API_DOCUMENTATION.md](./attendance/SOCIETY_ATTENDANCE_API_DOCUMENTATION.md)
* `attendance-report/`: State/branch filters and tenant-scoped Daily, Monthly, and Yearly attendance reporting.
* `inventory/`: Tenant-scoped inventory list, search/filter, CSV export, add, edit, and soft deletion.
* `credit-receipt/`: Credit Receipt list/export/create/view/update/delete APIs.
* `debit-receipt/`: Debit Receipt list/export/create/view/update/delete APIs.
* `transfer-receipt/`: Transfer Receipt list/export/create/view/update/delete APIs.
* `contra-receipt/`: Contra Receipt list/export/create/view/update/delete APIs.
* `receipts/shared/`: Shared tenant-safe receipt persistence, validation, formatting, CSV, and routing logic.
* `kycVerification/`: DigiLocker KYC verification integration endpoints (initiate session, complete verification, status reports, and PDF download). Documented in: 👉 [kycVerification/KYC_API_DOCUMENTATION.md](./kycVerification/KYC_API_DOCUMENTATION.md)
* `reports/`: Date-filtered industrial fintech report catalog, report generation, and UTF-8 BOM CSV exports across 12 report types. Documented in: 👉 [reports/REPORTS_API_DOCUMENTATION.md](./reports/REPORTS_API_DOCUMENTATION.md)
* `middlewares/`: Multi-tenant resolution (`resolveSocietyContext`), privilege guards (`requireBankOwner`, `requireBranchManager`, `requireSocietyPermission`).

---

## Common Requirements for the Following APIs

Base URL:

```text
http://localhost:5000/api/v1/society
```

All routes require:

```http
Authorization: Bearer <accessToken>
```

Mutation routes also require:

```http
Content-Type: application/json
```

The authenticated society context supplies `bankId` and, where applicable, `branchId`. Clients must not supply tenant identity, receipt type, receipt number, or audit identity.

---

## Section 6: Leads (`/api/v1/society/leads`)

### 6.1 Export Leads

* **Method**: `GET`
* **URL**: `/api/v1/society/leads/export`
* **Required Permission**: `lead.view`
* **Query Parameters**:
  * `page`: Integer, optional, default `1`.
  * `limit`: Integer, optional, default `10`, maximum `100`.
  * `search`: String, optional. Searches application number, customer name, phone number, and address.
  * `status`: Optional. Allowed values: `NEW`, `PENDING_DOWN_PAYMENT`, `ACTIVE`, `COMPLETED`, `REJECTED`.
* **Request Body**: Not required.
* **Response**: CSV download.

```http
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="leads.csv"
```

```csv
"Sr.No.","Application Number","Customer Name","Phone Number","Address","Status"
"1","LN1234567890","Clark Kent","9876543210","1901 Thornridge Circle","NEW"
```

### 6.2 List Leads

* **Method**: `GET`
* **URL**: `/api/v1/society/leads?page=1&limit=8&search=Clark&status=NEW`
* **Required Permission**: `lead.view`
* **Query Parameters**: Same as Export Leads.
* **Request Body**: Not required.
* **Response Payload (200 OK)**:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Leads retrieved successfully.",
  "data": [
    {
      "srNo": 1,
      "id": "66a1234567890abcdef00001",
      "applicationNumber": "LN1234567890",
      "customerName": "Clark Kent",
      "profileImage": "https://example.com/avatar.png",
      "phoneNumber": "9876543210",
      "address": "1901 Thornridge Circle",
      "status": "NEW"
    }
  ],
  "meta": {
    "totalRecords": 30,
    "limit": 8,
    "page": 1,
    "totalPages": 4,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### 6.3 Get Lead Details

* **Method**: `GET`
* **URL**: `/api/v1/society/leads/:id`
* **Required Permission**: `lead.view`
* **Path Parameter**: `id` must be a 24-character MongoDB ObjectId.
* **Request Body**: Not required.
* **Response Payload (200 OK)**:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Lead retrieved successfully.",
  "data": {
    "id": "66a1234567890abcdef00001",
    "applicationNumber": "LN1234567890",
    "customerName": "Clark Kent",
    "profileImage": "https://example.com/avatar.png",
    "phoneNumber": "9876543210",
    "address": "1901 Thornridge Circle",
    "status": "NEW"
  }
}
```

### 6.4 Delete Lead

* **Method**: `DELETE`
* **URL**: `/api/v1/society/leads/:id`
* **Required Permission**: `lead.delete`
* **Request Body**: Not required.
* **Behavior**: Soft deletes the tenant-owned lead.
* **Response Payload (200 OK)**:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Lead deleted successfully.",
  "data": {
    "id": "66a1234567890abcdef00001"
  }
}
```

---

## Common Receipt Contract

The four receipt modules share the same fields and route operations. Their server-controlled types and number prefixes are:

| Module | Type | Prefix |
| :--- | :--- | :--- |
| Credit Receipt | `CREDIT` | `CR-` |
| Debit Receipt | `DEBIT` | `DR-` |
| Transfer Receipt | `TRANSFER` | `TR-` |
| Contra Receipt | `CONTRA` | `CT-` |

### Receipt Create Body / Multipart Form-Data

Supports `multipart/form-data` file upload (`file`, `image`, `receiptImage`, or `document`) as well as `application/json`:

```json
{
  "name": "Mamta Lodhi",
  "glHead": "410105",
  "glHeadName": "Loan",
  "accountNumber": "36489745148",
  "date": "2026-07-20",
  "status": "NEW"
}
```

* `name`: Required string, maximum 150 characters.
* `glHead`: Required string, maximum 50 characters.
* `glHeadName`: Required string, maximum 150 characters.
* `accountNumber`: Required string, maximum 50 characters.
* `date`: Required ISO date.
* `status`: Optional; defaults to `NEW`. Allowed: `NEW`, `APPROVED`, `REJECTED`.
* `file` / `image` / `receiptImage` / `document`: Optional file attachment (JPG, PNG, WEBP, PDF up to 25MB). Automatically uploaded to S3.

`receiptNo`, `receiptType`, `bankId`, `branchId`, `createdBy`, `updatedBy`, and `deletedBy` are controlled by the server and are not accepted as client authority.

### Receipt List Query Parameters

* `page`: Integer, optional, default `1`, minimum `1`.
* `limit`: Integer, optional, default `10`, range `1`–`100`.
* `search`: Optional string. Searches receipt number, name, GL head, GL head name, and account number.
* `status`: Optional; `NEW`, `APPROVED`, or `REJECTED`.
* `dateFrom`: Optional ISO start date.
* `dateTo`: Optional ISO end date.
* `sortBy`: Optional; `receiptNo`, `name`, `glHead`, `glHeadName`, `accountNumber`, `date`, `status`, or `createdAt`.
* `sortOrder`: Optional; `asc` or `desc`, default `desc`.

### Paginated Receipt Response

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Receipts retrieved successfully.",
  "data": [
    {
      "srNo": 1,
      "id": "66b1234567890abcdef00001",
      "receiptNo": "CR-000001",
      "name": "Mamta Lodhi",
      "glHead": "410105",
      "glHeadName": "Loan",
      "accountNumber": "36489745148",
      "date": "2026-07-20T00:00:00.000Z",
      "status": "NEW",
      "image": "https://s3.amazonaws.com/bucket/society/receipts/1723875000000_receipt.jpg",
      "imageKey": "society/receipts/1723875000000_receipt.jpg"
    }
  ],
  "meta": {
    "totalRecords": 30,
    "limit": 8,
    "page": 1,
    "totalPages": 4,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### Single Receipt Response

Create returns `201`; view and update return `200`.

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Receipt created successfully.",
  "data": {
    "id": "66b1234567890abcdef00001",
    "receiptNo": "CR-000001",
    "name": "Mamta Lodhi",
    "glHead": "410105",
    "glHeadName": "Loan",
    "accountNumber": "36489745148",
    "date": "2026-07-20T00:00:00.000Z",
    "status": "NEW",
    "image": "https://s3.amazonaws.com/bucket/society/receipts/1723875000000_receipt.jpg",
    "imageKey": "society/receipts/1723875000000_receipt.jpg"
  }
}
```

### Receipt Delete Response

*Deleting a receipt automatically removes its associated image file from S3 bucket storage.*

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Receipt deleted successfully.",
  "data": {
    "id": "66b1234567890abcdef00001"
  }
}
```

### Receipt CSV Response

```csv
"Sr.No.","Receipt No","Name","GL Head","GL Head Name","A/C No.","Date","Status","Image URL"
"1","CR-000001","Mamta Lodhi","410105","Loan","36489745148","2026-07-20","NEW","https://s3.amazonaws.com/bucket/society/receipts/1723875000000_receipt.jpg"
```

---

## Section 7: Credit Receipt (`/api/v1/society/credit-receipts`)

### 7.1 Export Credit Receipts

* **Method**: `GET`
* **URL**: `/api/v1/society/credit-receipts/export?search=Mamta&status=NEW&dateFrom=2026-07-01&dateTo=2026-07-31`
* **Required Permission**: `receipt.view`
* **Request Body**: Not required.
* **Response**: CSV download named `credit-receipts.csv`.

### 7.2 List Credit Receipts

* **Method**: `GET`
* **URL**: `/api/v1/society/credit-receipts?page=1&limit=8&search=Mamta&status=NEW`
* **Required Permission**: `receipt.view`
* **Request Body**: Not required.
* **Response**: Paginated Receipt Response with `CR-` receipt numbers.

### 7.3 Create Credit Receipt

* **Method**: `POST`
* **URL**: `/api/v1/society/credit-receipts`
* **Required Permission**: `receipt.create`
* **Request Body**:

```json
{
  "name": "Mamta Lodhi",
  "glHead": "410105",
  "glHeadName": "Loan",
  "accountNumber": "36489745148",
  "date": "2026-07-20",
  "status": "NEW"
}
```

* **Response**: Single Receipt Response (`201`) with a generated number such as `CR-000001`.

### 7.4 Get Credit Receipt Details

* **Method**: `GET`
* **URL**: `/api/v1/society/credit-receipts/:id`
* **Required Permission**: `receipt.view`
* **Request Body**: Not required.
* **Response**: Single Receipt Response (`200`) with message `Receipt retrieved successfully.`.

### 7.5 Update Credit Receipt

* **Method**: `PUT`
* **URL**: `/api/v1/society/credit-receipts/:id`
* **Required Permission**: `receipt.update`
* **Request Body**: At least one allowed receipt field.

```json
{
  "status": "APPROVED"
}
```

* **Response**: Single Receipt Response (`200`) with message `Receipt updated successfully.`.

### 7.6 Delete Credit Receipt

* **Method**: `DELETE`
* **URL**: `/api/v1/society/credit-receipts/:id`
* **Required Permission**: `receipt.delete`
* **Request Body**: Not required.
* **Response**: Receipt Delete Response.

---

## Section 8: Debit Receipt (`/api/v1/society/debit-receipts`)

### 8.1 Export Debit Receipts

* **Method**: `GET`
* **URL**: `/api/v1/society/debit-receipts/export?search=Hillery&status=APPROVED`
* **Required Permission**: `receipt.view`
* **Request Body**: Not required.
* **Response**: CSV download named `debit-receipts.csv`.

### 8.2 List Debit Receipts

* **Method**: `GET`
* **URL**: `/api/v1/society/debit-receipts?page=1&limit=8&search=Hillery&status=APPROVED`
* **Required Permission**: `receipt.view`
* **Request Body**: Not required.
* **Response**: Paginated Receipt Response with `DR-` receipt numbers.

### 8.3 Create Debit Receipt

* **Method**: `POST`
* **URL**: `/api/v1/society/debit-receipts`
* **Required Permission**: `receipt.create`
* **Request Body**:

```json
{
  "name": "Hillery Moses",
  "glHead": "410105",
  "glHeadName": "Loan",
  "accountNumber": "36489745148",
  "date": "2026-07-20",
  "status": "APPROVED"
}
```

* **Response**: Single Receipt Response (`201`) with a generated number such as `DR-000001`.

### 8.4 Get Debit Receipt Details

* **Method**: `GET`
* **URL**: `/api/v1/society/debit-receipts/:id`
* **Required Permission**: `receipt.view`
* **Request Body**: Not required.
* **Response**: Single Receipt Response (`200`).

### 8.5 Update Debit Receipt

* **Method**: `PUT`
* **URL**: `/api/v1/society/debit-receipts/:id`
* **Required Permission**: `receipt.update`
* **Request Body**:

```json
{
  "name": "Hillery Moses",
  "status": "REJECTED"
}
```

* **Response**: Single Receipt Response (`200`) with message `Receipt updated successfully.`.

### 8.6 Delete Debit Receipt

* **Method**: `DELETE`
* **URL**: `/api/v1/society/debit-receipts/:id`
* **Required Permission**: `receipt.delete`
* **Request Body**: Not required.
* **Response**: Receipt Delete Response.

---

## Section 9: Transfer Receipt (`/api/v1/society/transfer-receipts`)

### 9.1 Export Transfer Receipts

* **Method**: `GET`
* **URL**: `/api/v1/society/transfer-receipts/export?dateFrom=2026-07-01&dateTo=2026-07-31`
* **Required Permission**: `receipt.view`
* **Request Body**: Not required.
* **Response**: CSV download named `transfer-receipts.csv`.

### 9.2 List Transfer Receipts

* **Method**: `GET`
* **URL**: `/api/v1/society/transfer-receipts?page=1&limit=8&search=Vishwas`
* **Required Permission**: `receipt.view`
* **Request Body**: Not required.
* **Response**: Paginated Receipt Response with `TR-` receipt numbers.

### 9.3 Create Transfer Receipt

* **Method**: `POST`
* **URL**: `/api/v1/society/transfer-receipts`
* **Required Permission**: `receipt.create`
* **Request Body**:

```json
{
  "name": "Vishwas Patel",
  "glHead": "410105",
  "glHeadName": "Daily Deposit",
  "accountNumber": "36489745148",
  "date": "2026-07-20",
  "status": "NEW"
}
```

* **Response**: Single Receipt Response (`201`) with a generated number such as `TR-000001`.

### 9.4 Get Transfer Receipt Details

* **Method**: `GET`
* **URL**: `/api/v1/society/transfer-receipts/:id`
* **Required Permission**: `receipt.view`
* **Request Body**: Not required.
* **Response**: Single Receipt Response (`200`).

### 9.5 Update Transfer Receipt

* **Method**: `PUT`
* **URL**: `/api/v1/society/transfer-receipts/:id`
* **Required Permission**: `receipt.update`
* **Request Body**:

```json
{
  "glHeadName": "Daily Agent Collection",
  "status": "APPROVED"
}
```

* **Response**: Single Receipt Response (`200`) with message `Receipt updated successfully.`.

### 9.6 Delete Transfer Receipt

* **Method**: `DELETE`
* **URL**: `/api/v1/society/transfer-receipts/:id`
* **Required Permission**: `receipt.delete`
* **Request Body**: Not required.
* **Response**: Receipt Delete Response.

---

## Section 10: Contra Receipt (`/api/v1/society/contra-receipts`)

### 10.1 Export Contra Receipts

* **Method**: `GET`
* **URL**: `/api/v1/society/contra-receipts/export?search=Shalini&status=APPROVED`
* **Required Permission**: `receipt.view`
* **Request Body**: Not required.
* **Response**: CSV download named `contra-receipts.csv`.

### 10.2 List Contra Receipts

* **Method**: `GET`
* **URL**: `/api/v1/society/contra-receipts?page=1&limit=8&search=Shalini&status=APPROVED`
* **Required Permission**: `receipt.view`
* **Request Body**: Not required.
* **Response**: Paginated Receipt Response with `CT-` receipt numbers.

### 10.3 Create Contra Receipt

* **Method**: `POST`
* **URL**: `/api/v1/society/contra-receipts`
* **Required Permission**: `receipt.create`
* **Request Body**:

```json
{
  "name": "Shalini Jain",
  "glHead": "410105",
  "glHeadName": "Investment",
  "accountNumber": "36489745148",
  "date": "2026-07-20",
  "status": "APPROVED"
}
```

* **Response**: Single Receipt Response (`201`) with a generated number such as `CT-000001`.

### 10.4 Get Contra Receipt Details

* **Method**: `GET`
* **URL**: `/api/v1/society/contra-receipts/:id`
* **Required Permission**: `receipt.view`
* **Request Body**: Not required.
* **Response**: Single Receipt Response (`200`).

### 10.5 Update Contra Receipt

* **Method**: `PUT`
* **URL**: `/api/v1/society/contra-receipts/:id`
* **Required Permission**: `receipt.update`
* **Request Body**:

```json
{
  "glHeadName": "Bank",
  "status": "APPROVED"
}
```

* **Response**: Single Receipt Response (`200`) with message `Receipt updated successfully.`.

### 10.6 Delete Contra Receipt

* **Method**: `DELETE`
* **URL**: `/api/v1/society/contra-receipts/:id`
* **Required Permission**: `receipt.delete`
* **Request Body**: Not required.
* **Response**: Receipt Delete Response.

---

## Section 11: Attendance Report (`/api/v1/society/attendance-report`)

The first two supplied screenshots represent this single read-only report component. All records are scoped by the authenticated bank and branch context. A bank owner may filter across owned branches, while a branch-level user remains restricted to the assigned branch.

### 11.1 Get Attendance Filter Options

* **Method**: `GET`
* **URL**: `/api/v1/society/attendance-report/filters?state=Maharashtra`
* **Required Permission**: `attendance.view`
* **Query Parameters**:
  * `state`: Optional State/UT string used to filter the branch dropdown.
* **Request Body**: Not required.
* **Response Payload (200 OK)**:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Attendance filters retrieved successfully.",
  "data": {
    "states": ["Maharashtra"],
    "branches": [
      {
        "id": "66c1234567890abcdef00001",
        "name": "Pune Branch",
        "code": "PUNE01",
        "state": "Maharashtra"
      }
    ]
  }
}
```

### 11.2 Get Attendance Report

* **Method**: `GET`
* **URL**: `/api/v1/society/attendance-report?state=Maharashtra&branchId=66c1234567890abcdef00001&search=Harleen&period=DAILY&date=2026-08-03&page=1&limit=10`
* **Required Permission**: `attendance.view`
* **Query Parameters**:
  * `state`: Optional State/UT string.
  * `branchId`: Optional 24-character branch ObjectId. Branch-level users are always restricted to their authenticated branch.
  * `search`: Optional employee name or designation search.
  * `period`: `DAILY`, `MONTHLY`, or `YEARLY`; default `DAILY`.
  * `date`: Optional ISO reference date; defaults to current date.
  * `page`: Optional integer, default `1`.
  * `limit`: Optional integer, default `10`, range `1`-`100`.
* **Request Body**: Not required.
* **Status Values**:
  * `P`: Present.
  * `L`: Leave.
  * `A`: Absent.
* **Response Payload (200 OK)**:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Attendance report retrieved successfully.",
  "data": [
    {
      "srNo": 1,
      "id": "66c1234567890abcdef00002",
      "name": "Harleen Quinzel",
      "profileImage": null,
      "designation": "Branch Manager",
      "punchIn": "9:07 AM",
      "punchOut": "5:07 PM",
      "totalHrs": "8 hrs",
      "status": "P"
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

When an active employee has no matching attendance record, `punchIn`, `punchOut`, and `totalHrs` are `null`, and status defaults to `A`. The `search=Harleen` example returns only the matching employee.

---

## Section 12: Inventory (`/api/v1/society/inventory`)

Inventory exposes only the screenshot-supported business fields `assets` and `quantity`. Tenant, branch, and audit fields are server-controlled.

### 12.1 Export Inventory

* **Method**: `GET`
* **URL**: `/api/v1/society/inventory/export?search=Computer&minQuantity=100&maxQuantity=2000&sortBy=quantity&sortOrder=desc`
* **Required Permission**: `inventory.view`
* **Query Parameters**: Same filters and sorting as List Inventory.
* **Request Body**: Not required.
* **Response Payload (200 OK)**: CSV download named `inventory.csv`.

```http
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="inventory.csv"
```

```csv
"Sr.No.","Assets","Quantity"
"1","Computer","1800"
```

### 12.2 List Inventory

* **Method**: `GET`
* **URL**: `/api/v1/society/inventory?page=1&limit=10&search=Computer&minQuantity=100&maxQuantity=2000&sortBy=quantity&sortOrder=desc`
* **Required Permission**: `inventory.view`
* **Query Parameters**:
  * `page`: Optional integer, default `1`.
  * `limit`: Optional integer, default `10`, maximum `100`.
  * `search`: Optional asset-name search.
  * `minQuantity`: Optional integer, minimum `0`.
  * `maxQuantity`: Optional integer, minimum `0`; must not be smaller than `minQuantity`.
  * `sortBy`: `assets`, `quantity`, or `createdAt`; default `createdAt`.
  * `sortOrder`: `asc` or `desc`; default `desc`.
* **Request Body**: Not required.
* **Response Payload (200 OK)**:

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

### 12.3 Create Inventory

* **Method**: `POST`
* **URL**: `/api/v1/society/inventory`
* **Required Permission**: `inventory.create`
* **Request Body**:

```json
{
  "assets": "Computer",
  "quantity": 1800
}
```

* `assets`: Required trimmed string, maximum 150 characters.
* `quantity`: Required integer, minimum `0`.
* **Response Payload (201 Created)**:

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

### 12.4 Update Inventory

* **Method**: `PUT`
* **URL**: `/api/v1/society/inventory/:id`
* **Required Permission**: `inventory.update`
* **Path Parameter**: `id` must be a 24-character MongoDB ObjectId.
* **Request Body**: At least one of the two fields is required.

```json
{
  "assets": "Desktop Computer",
  "quantity": 2000
}
```

* **Response Payload (200 OK)**:

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

### 12.5 Delete Inventory

* **Method**: `DELETE`
* **URL**: `/api/v1/society/inventory/:id`
* **Required Permission**: `inventory.delete`
* **Request Body**: Not required.
* **Behavior**: Soft deletes the tenant-owned inventory item.
* **Response Payload (200 OK)**:

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

## 13 Cash Payment

### Base URL

```
/api/v1/society/cash-payment
```

### Authentication

All APIs require a valid **Bearer Token**.

Example Header:

```http
Authorization: Bearer <access_token>
```

---

## 13.1 Get Cash Payment List

Returns all onboarding employees along with their cash collection, submitted amount and pending cash.

### Endpoint

```http
GET /api/v1/society/cash-payment
```

### Permission

```
cash_payment.view
```

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| page | Number | Page number |
| limit | Number | Records per page |
| search | String | Search employee by name |

### Example

```http
GET /api/v1/society/cash-payment?page=1&limit=10
```

### Success Response

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [
      {
        "employeeId": "6a6c497d78eb3b7bec56bade",
        "employeeName": "hhh",
        "designation": "Onboarding Team",
        "totalCashCollection": 0,
        "totalCashSubmitted": 5000,
        "totalCashPending": -5000
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "totalRecords": 1,
      "totalPages": 1
    }
  }
}
```

---

## 13.2 Get Employee Cash Payment Details

Returns complete cash payment details for a selected employee.

### Endpoint

```http
GET /api/v1/society/cash-payment/:employeeId
```

### Permission

```
cash_payment.view
```

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| page | Number | Page number |
| limit | Number | Records per page |
| fromDate | Date | Filter from date |
| toDate | Date | Filter to date |

### Example

```http
GET /api/v1/society/cash-payment/6a6c497d78eb3b7bec56bade?page=1&limit=10
```

### Success Response

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "employee": {
      "_id": "6a6c497d78eb3b7bec56bade",
      "fullName": "hhh",
      "phone": "8676663468",
      "email": "ayush@gmail.com"
    },
    "summary": {
      "totalCashCollection": 0,
      "totalCashSubmitted": 5000,
      "totalCashPending": -5000
    },
    "history": [
      {
        "_id": "6a7051e6d31b15ccba6092b4",
        "date": "2026-08-03T00:00:00.000Z",
        "amountSubmitted": 5000,
        "remarks": "",
        "status": "SUBMITTED"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "totalRecords": 1,
      "totalPages": 1
    }
  }
}
```

---

## 13.3 Submit Cash

Creates a new cash submission for an onboarding employee.

### Endpoint

```http
POST /api/v1/society/cash-payment/:employeeId
```

### Permission

```
cash_payment.create
```

### Request Body

```json
{
  "date": "2026-08-03",
  "amountSubmitted": 5000,
  "remarks": "Cash deposited successfully"
}
```

### Success Response

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "_id": "6a7051e6d31b15ccba6092b4",
    "employeeId": "6a6c497d78eb3b7bec56bade",
    "employeeName": "hhh",
    "date": "2026-08-03T00:00:00.000Z",
    "amountSubmitted": 5000,
    "remarks": "Cash deposited successfully",
    "status": "SUBMITTED",
    "createdAt": "2026-08-03T08:31:34.622Z"
  }
}
```

---

## Validation Error

```json
{
  "success": false,
  "statusCode": 422,
  "message": "Invalid request payload format",
  "details": [
    {
      "field": "date",
      "message": "date is required"
    },
    {
      "field": "amountSubmitted",
      "message": "amountSubmitted is required"
    }
  ]
}
```

---

## Permissions

| API | Permission |
|-----|------------|
| GET /cash-payment | `cash_payment.view` |
| GET /cash-payment/:employeeId | `cash_payment.view` |
| POST /cash-payment/:employeeId | `cash_payment.create` |

---

## Implemented Route Count

| Module | Route Count |
| :--- | ---: |
| Leads | 4 |
| Credit Receipt | 6 |
| Debit Receipt | 6 |
| Transfer Receipt | 6 |
| Contra Receipt | 6 |
| Attendance Report | 2 |
| Inventory | 5 |
| Cash Payment | 3 |
| **Total** | **38** |
