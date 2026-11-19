# Society Panel Reports & Analytics API Documentation

The **Reports & Analytics API** (`/api/v1/society/reports`) provides high-performance, date-filtered, industrial fintech reports for **Bank Owners**, **Branch Managers**, **Accounts Executives**, and authorized personnel within Co-operative Banks & Credit Societies.

---

## 🔐 Base URL & Authentication

- **Base Endpoint**: `https://<domain>/api/v1/society/reports`
- **Headers Required**:
  ```http
  Authorization: Bearer <jwt_token>
  Content-Type: application/json
  ```
- **Tenant Context**: Automatically resolved via `resolveSocietyContext` middleware using the authenticated user's database identity record (`bankId`, `branchId`).

---

## 🛡️ Permissions & RBAC Controls

| Capability Key | Description | Authorized System Roles |
| :--- | :--- | :--- |
| `report.view` | View report catalog and fetch paginated report JSON data. | `BANK_OWNER`, `MANAGER`, `ACCOUNTANT`, `RECEIPT_MANAGEMENT_EXECUTIVE` |
| `report.export` | Stream and download UTF-8 BOM CSV exports for spreadsheet analysis. | `BANK_OWNER`, `MANAGER`, `ACCOUNTANT`, `RECEIPT_MANAGEMENT_EXECUTIVE` |

> [!NOTE]
> **Branch Filtering Isolation**: Branch filtering via query parameters (`?branchId=...`) is allowed **exclusively for Bank Owners** (`BANK_OWNER`, `SOCIETY_ADMIN`, `VENDOR`, `SUPER_ADMIN`). All non-bank-owner roles (Branch Managers, Accountants, Employees) are strictly locked to their assigned session branch.

---

## 📊 List of Supported Report Types (`:reportType`)

| Enum Value | Report Code | Category | Description |
| :--- | :--- | :--- | :--- |
| `CREDIT_RECEIPTS` | `FIN-CR-01` | Financial & Ledger | Credit Receipts (CR) ledger with GL Code, GL Head Name, status breakdown, and maker-checker audit. |
| `DEBIT_RECEIPTS` | `FIN-DR-02` | Financial & Ledger | Debit Receipts (DR) outflow voucher report with beneficiary account details. |
| `TRANSFER_CONTRA_RECEIPTS` | `FIN-TC-03` | Financial & Ledger | Inter-branch fund transfers (TR) and bank contra vouchers (CT) ledger. |
| `CASH_PAYMENTS` | `FIN-CP-04` | Financial & Ledger | Counter cash collections, field cash submissions, and opening/closing cash drawer balance reconciliation. |
| `BRANCH_FINANCIAL_SUMMARY` | `FIN-BS-05` | Financial & Ledger | Executive overview of total credits, total debits, net movement, and pending approvals per branch. |
| `LEADS_AND_LOANS` | `BUS-LN-06` | Loans & Business | Customer lead conversion tracking, loan requested amounts, verification stages, and total principal disbursed. |
| `CIBIL_ASSESSMENT_AUDIT` | `BUS-CB-07` | Loans & Business | Audit log of customer CIBIL checks, average credit score, and risk classification (High/Medium/Low Risk). |
| `ATTENDANCE_SUMMARY` | `OPS-AT-08` | HR & Operations | Employee punch-in/out audit, late arrivals, present/absent days, working hours, and shift compliance. |
| `STAFF_DIRECTORY` | `OPS-EM-09` | HR & Operations | Society staff roster, system role allocations, branch assignments, KYC status, and active employment audit. |
| `DAILY_WORK_REPORT` | `OPS-DW-10` | HR & Operations | Field collection and loan executive daily work logs, field visits made, customer contacts, and cash collected. |
| `CARDS_CREDIT_USAGE` | `FIN-CC-11` | Credits & Verification | Verification credit purchases, branch allocations, consumption audit, and issued EMI card tracking. |
| `MERCHANT_SUMMARY` | `BUS-MC-12` | Loans & Business | Onboarded merchant partners, active/pending verification audit, and total sales transaction volume. |

---

## 🚀 API Endpoints Specification

### 1. Get Report Catalog

Returns a metadata list of all available reports, their categories, supported filter parameters, and export formats.

- **Method**: `GET`
- **Path**: `/catalog`
- **Required Permission**: `report.view`
- **Query Parameters**:
  - `category` (optional, string): Filter catalog by category (e.g. `Financial`, `Loans`, `HR`, `Credits`).

#### Example Request
```http
GET /api/v1/society/reports/catalog?category=Financial HTTP/1.1
Host: localhost:5000
Authorization: Bearer <token>
```

#### Example Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Report catalog retrieved successfully.",
  "data": {
    "catalog": [
      {
        "id": "CREDIT_RECEIPTS",
        "code": "FIN-CR-01",
        "title": "Credit Receipts Ledger Report",
        "category": "Financial & Ledger",
        "description": "Voucher level audit of all Credit Receipts (CR) with GL Head tracking, status breakdown, and maker-checker details.",
        "supportedFilters": [
          "dateFrom",
          "dateTo",
          "branchId",
          "status",
          "glHead",
          "search"
        ],
        "exportFormats": [
          "CSV"
        ]
      }
    ]
  }
}
```

---

### 2. Generate / View Report Data

Fetches paginated report items, KPI summary cards, metadata, and applied filter echo.

- **Method**: `GET`
- **Path**: `/:reportType`
- **Required Permission**: `report.view`
- **Path Parameters**:
  - `reportType` (required, string): One of the supported report type enums (e.g. `CREDIT_RECEIPTS`, `ATTENDANCE_SUMMARY`).
- **Query Parameters**:

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `dateFrom` / `startDate` | ISO Date String | 1st of Current Month | Filter start date (e.g., `2026-08-01`). |
| `dateTo` / `endDate` | ISO Date String | Today End of Day | Filter end date (e.g., `2026-08-31`). |
| `branchId` | Mongo ObjectId | User Branch / ALL | Filter data by specific Branch ID. |
| `status` | String | ALL | Filter by status (`NEW`, `PENDING`, `APPROVED`, `REJECTED`, `ACTIVE`, `PRESENT`, `ABSENT`). |
| `glHead` | String | ALL | Filter by GL Head Code or Name. |
| `search` | String | "" | Free-text search on receipt number, customer name, employee code, account number. |
| `page` | Integer | `1` | Page number. |
| `limit` | Integer | `10` | Records per page (Max 500). |
| `sortBy` | String | `createdAt` / `date` | Field to sort by. |
| `sortOrder` | String | `desc` | Sort order (`asc` or `desc`). |

#### Example Request
```http
GET /api/v1/society/reports/CREDIT_RECEIPTS?startDate=2026-08-01&endDate=2026-08-31&page=1&limit=2 HTTP/1.1
Host: localhost:5000
Authorization: Bearer <token>
```

#### Example Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "CREDIT_RECEIPTS report generated successfully.",
  "data": {
    "meta": {
      "bankId": "66bc11a2f912a2001e3e4a11",
      "bankName": "Sahayaone Co-operative Society",
      "branchId": null,
      "generatedAt": "2026-08-22T11:45:00.000Z",
      "generatedByUserId": "66bc11a2f912a2001e3e4a22",
      "generatedBy": "Harleen Quinzel",
      "generatedByName": "Harleen Quinzel",
      "generatedByRole": "MANAGER",
      "reportCode": "FIN-CR-01",
      "reportTitle": "CREDIT Receipts Ledger Report",
      "dateRange": {
        "from": "2026-08-01T00:00:00.000Z",
        "to": "2026-08-31T23:59:59.999Z"
      },
      "appliedFilters": {
        "branchId": "ALL",
        "status": "ALL",
        "search": null
      }
    },
    "kpiSummary": {
      "totalVouchers": 45,
      "totalAmount": 1500000,
      "formattedTotalAmount": "₹15,00,000.00",
      "approvedAmount": 1200000,
      "formattedApprovedAmount": "₹12,00,000.00",
      "pendingAmount": 300000,
      "formattedPendingAmount": "₹3,00,000.00",
      "rejectedAmount": 0,
      "formattedRejectedAmount": "₹0.00"
    },
    "items": [
      {
        "srNo": 1,
        "id": "66c1e11af912a2001e3e4b01",
        "receiptNo": "CR-000001",
        "receiptType": "CREDIT",
        "date": "2026-08-15T10:30:00.000Z",
        "name": "Rajesh Kumar",
        "accountNumber": "ACC-987654",
        "glCode": "GL-1001",
        "glHeadName": "Member Savings Deposit",
        "amount": 50000,
        "formattedAmount": "₹50,000.00",
        "status": "APPROVED",
        "branchCode": "BR-01",
        "branchName": "Main Branch",
        "createdBy": "Anil Sharma",
        "approvedBy": "Harleen Quinzel",
        "rejectionReason": null,
        "createdAt": "2026-08-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "totalRecords": 45,
      "page": 1,
      "limit": 2,
      "totalPages": 23
    }
  }
}
```

---

### 3. Export Report in Multiple Formats (CSV / PDF)

Streams a downloadable file in either **CSV** or **PDF** format.

- **Method**: `GET`
- **Path**: `/:reportType/export`
- **Required Permission**: `report.export`
- **Path Parameters**: `reportType` (e.g. `CREDIT_RECEIPTS`, `TRANSFER_CONTRA_RECEIPTS`)
- **Query Parameters**:
  - `format`: `csv` (default) or `pdf`
  - Filter parameters: `startDate`, `endDate`, `dateFrom`, `dateTo`, `branchId`, `status`, `search`.

#### A. Export as CSV (Default)
```http
GET /api/v1/society/reports/CREDIT_RECEIPTS/export?format=csv&startDate=2026-08-01&endDate=2026-08-31 HTTP/1.1
Host: localhost:5000
Authorization: Bearer <token>
```

##### Response Headers:
```http
HTTP/1.1 200 OK
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="society-report-credit_receipts-2026-08-22.csv"
```

#### B. Export as PDF (Industrial Fintech ERP PDF)
```http
GET /api/v1/society/reports/CREDIT_RECEIPTS/export?format=pdf&startDate=2026-08-01&endDate=2026-08-31 HTTP/1.1
Host: localhost:5000
Authorization: Bearer <token>
```

##### Response Headers:
```http
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename="society-report-credit_receipts-2026-08-22.pdf"
```

---

## ❌ Error Codes & Responses

| Status Code | Error Message | Cause / Solution |
| :--- | :--- | :--- |
| `400 Bad Request` | `Invalid report type. Must be one of: CREDIT_RECEIPTS, DEBIT_RECEIPTS...` | The `:reportType` path parameter does not match valid report enums. |
| `401 Unauthorized` | `User identity not loaded. Access denied.` | Missing or invalid `Authorization: Bearer` JWT token. |
| `403 Forbidden` | `Access denied. Required capability [report.view] is not granted...` | The authenticated user's role lacks the required permission key. |
| `404 Not Found` | `Cannot GET /api/v1/society/reports/invalid` | Incorrect URL route. |
