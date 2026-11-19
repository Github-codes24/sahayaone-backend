# Sahayaone ERP - Society Panel Branch Dropdown & Filtering API Documentation

This document describes the newly implemented **Branch Dropdown API** and the updated **`branchId` query filtering** support across all Society Panel GET list endpoints for **Bank Owner** sessions.

---

## 1. Overview

In multi-tenant society operations:
- **Bank Owner / Admin Users**: Own the bank entity across all branches. Their session context (`req.society.branchId`) is `null`, giving them access across all bank branches. They can now pass an optional `branchId` query parameter (e.g. `?branchId=66c1234567890abcdef00001`) on any GET list API to filter data specifically for that branch, or omit it to retrieve data across all branches.
- **Branch Manager / Employee Users**: Remain strictly locked to their database-resolved `req.society.branchId`. They can only access data belonging to their assigned branch.

---

## 2. New API: Branch Dropdown List

Returns a lightweight list of Branch IDs and Branch Names for dropdown selectors.

* **Method**: `GET`
* **URL**: `/api/v1/society/branches/dropdown`
* **Required Permission**: `branch.view`
* **Headers**:
  ```http
  Authorization: Bearer <accessToken>
  ```
* **Query Parameters**: None required.
* **Request Body**: None.

### Response Payload (`200 OK`)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Branch list retrieved successfully.",
  "data": [
    {
      "id": "66c1234567890abcdef00001",
      "branchId": "66c1234567890abcdef00001",
      "branchName": "Pune Branch",
      "name": "Pune Branch",
      "code": "PUNE01",
      "state": "Maharashtra"
    },
    {
      "id": "66c1234567890abcdef00002",
      "branchId": "66c1234567890abcdef00002",
      "branchName": "Mumbai Main Branch",
      "name": "Mumbai Main Branch",
      "code": "MUM01",
      "state": "Maharashtra"
    }
  ]
}
```

---

## 3. Updated GET List APIs with `branchId` Support

The following 8 modules accept the `branchId` query parameter for Bank Owner sessions:

### 3.1 Cash Payment (`/api/v1/society/cash-payments`)
* **Endpoint**: `GET /api/v1/society/cash-payments?branchId=66c1234567890abcdef00001&page=1&limit=10&search=John`
* **Permission**: `cash_payment.view`
* **Query Parameters**:
  * `branchId`: Optional 24-character hex ObjectId.
  * `page`: Integer, optional (default `1`).
  * `limit`: Integer, optional (default `10`).
  * `search`: String, optional.

---

### 3.2 Credit Receipts (`/api/v1/society/credit-receipts`)
* **Endpoints**:
  * `GET /api/v1/society/credit-receipts?branchId=66c1234567890abcdef00001&status=NEW&page=1&limit=10`
  * `GET /api/v1/society/credit-receipts/export?branchId=66c1234567890abcdef00001&status=NEW`
* **Permission**: `receipt.view`
* **Query Parameters**:
  * `branchId`: Optional 24-character hex ObjectId.
  * `page`, `limit`, `search`, `status`, `dateFrom`, `dateTo`, `sortBy`, `sortOrder`.

---

### 3.3 Debit Receipts (`/api/v1/society/debit-receipts`)
* **Endpoints**:
  * `GET /api/v1/society/debit-receipts?branchId=66c1234567890abcdef00001&page=1&limit=10`
  * `GET /api/v1/society/debit-receipts/export?branchId=66c1234567890abcdef00001`
* **Permission**: `receipt.view`
* **Query Parameters**:
  * `branchId`: Optional 24-character hex ObjectId.

---

### 3.4 Contra Receipts (`/api/v1/society/contra-receipts`)
* **Endpoints**:
  * `GET /api/v1/society/contra-receipts?branchId=66c1234567890abcdef00001&page=1&limit=10`
  * `GET /api/v1/society/contra-receipts/export?branchId=66c1234567890abcdef00001`
* **Permission**: `receipt.view`
* **Query Parameters**:
  * `branchId`: Optional 24-character hex ObjectId.

---

### 3.5 Merchants (`/api/v1/society/merchants`)
* **Endpoints**:
  * `GET /api/v1/society/merchants?branchId=66c1234567890abcdef00001&status=ACTIVE&page=1&limit=10`
  * `GET /api/v1/society/merchants/dropdown?branchId=66c1234567890abcdef00001`
* **Query Parameters**:
  * `branchId`: Optional 24-character hex ObjectId.

---

### 3.6 Society Dashboard (`/api/v1/society/dashboard`)
* **Endpoints**:
  * `GET /api/v1/society/dashboard/stats?branchId=66c1234567890abcdef00001&timeFilter=Today`
  * `GET /api/v1/society/dashboard/revenue-chart?branchId=66c1234567890abcdef00001&year=2026`
  * `GET /api/v1/society/dashboard/loan-distributed-chart?branchId=66c1234567890abcdef00001`
  * `GET /api/v1/society/dashboard/services-stats?branchId=66c1234567890abcdef00001`
  * `GET /api/v1/society/dashboard/overview?branchId=66c1234567890abcdef00001`
* **Query Parameters**:
  * `branchId`: Optional 24-character hex ObjectId. Filters KPI stats, stock, credits, and loan aggregations by branch.

---

### 3.7 Employees (`/api/v1/society/employees`)
* **Endpoint**: `GET /api/v1/society/employees?branchId=66c1234567890abcdef00001&page=1&limit=10`
* **Permission**: `employee.view`
* **Query Parameters**:
  * `branchId`: Optional 24-character hex ObjectId.

---

### 3.8 Leads (`/api/v1/society/leads`)
* **Endpoints**:
  * `GET /api/v1/society/leads?branchId=66c1234567890abcdef00001&status=NEW&page=1&limit=10`
  * `GET /api/v1/society/leads/export?branchId=66c1234567890abcdef00001&status=NEW`
* **Permission**: `lead.view`
* **Query Parameters**:
  * `branchId`: Optional 24-character hex ObjectId.

---

## 4. Summary of Code Base Modifications

| File Path | Description of Changes |
| :--- | :--- |
| `src/panels/society/branches/routes/branch.routes.js` | Added `GET /dropdown` route. |
| `src/panels/society/branches/controllers/branch.controller.js` | Added `getDropdown` handler. |
| `src/panels/society/branches/services/branch.service.js` | Implemented `listBranchesDropdown` service. |
| `src/panels/society/cash-payment/validators/cashPayment.validator.js` | Added `branchId` to query validation schema. |
| `src/panels/society/cash-payment/controllers/cashPayment.controller.js` | Passed `req.society` to service functions. |
| `src/panels/society/cash-payment/services/cashPayment.service.js` | Added `bankId` & `branchId` filter logic. |
| `src/panels/society/receipts/shared/receipt.validator.js` | Added `branchId` to `receiptListSchema.query`. |
| `src/panels/society/receipts/shared/receipt.service.js` | Updated `buildScope`, `list`, and `exportCsv` for `queryBranchId`. |
| `src/panels/society/dashboard/validators/society-dashboard.validator.js` | Added `branchId` to all 4 dashboard query schemas. |
| `src/panels/society/leads/validators/society-lead.validator.js` | Added `branchId` to `leadListSchema.query`. |
| `src/panels/society/leads/services/society-lead.service.js` | Updated `buildScope` to evaluate `queryBranchId`. |
