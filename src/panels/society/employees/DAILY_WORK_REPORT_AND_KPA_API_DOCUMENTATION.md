# 📊 Daily Work Report & KPA Performance API Documentation

Welcome to the comprehensive API documentation for the **Daily Work Report (DWR)** and **Key Performance Area (KPA)** systems in the Sahayaone Co-operative Bank & Society ERP Platform.

---

## 📌 1. Architectural Overview

The Daily Work Report and KPA system provides automated and manual tracking of employee performance goals across **Society HR Panel** (`/api/v1/society/employees/hr`) and **Employee Mobile/Web Panel** (`/api/v1/employee`).

### Key Features:
1. **Real-time Automated Transaction Hooks**: Financial transactions (Receipt Creation, Receipt Approval, Cash Submissions) and Lead Onboarding automatically log work reports in real time with zero manual effort.
2. **KPA Goal Derivation**: When a yearly KPA target $Y$ is assigned, the backend automatically derives proportional performance goals:
   * **Yearly Goal**: $Y$
   * **Monthly Goal**: $\text{Math.round}(Y / 12)$
   * **Weekly Goal**: $\text{Math.round}(\text{Monthly Goal} / 4)$
   * **Daily Goal**: $\text{Math.round}(\text{Weekly Goal} / 5)$
3. **Role Matrix Auto-Seeding (Starting Target = 0)**: Upon employee or manager creation, default product target structures are automatically assigned matching their role, starting with `targetValue: 0`.
4. **Dual Panel Synchronization**: Loan Executives and Collection Executives operating on the Employee Panel (`/api/v1/employee`) share live KPA target metrics and work report history with the Society Admin HR Panel (`/api/v1/society/employees/hr`).
5. **Target Threshold Incentive Qualification**: Incentives (`earnedIncentive`) are applicable **ONLY IF** an employee's performance achievement meets or exceeds the assigned target goal ($\text{achieved} \ge \text{goal}$). If achievement is less than the target goal ($\text{achieved} < \text{goal}$), `earnedIncentive` defaults to `0` (`₹0`).

### 💡 Target Threshold Incentive Qualification Formula & Rules

| Condition | Target Status | Incentive Calculation Formula | `earnedIncentive` Output |
| :--- | :---: | :--- | :---: |
| **$\text{Achieved} < \text{Target Goal}$** | ❌ **Not Met** | Incentive calculation bypassed | `0` (`₹0`) |
| **$\text{Achieved} \ge \text{Target Goal}$** (`PRODUCT` / `%`) | ✅ **Met / Exceeded** | $\frac{\text{Incentive Value (\%)}}{100} \times \text{Achieved Amount}$ | Calculated Amount (e.g. `₹72,000`) |
| **$\text{Achieved} \ge \text{Target Goal}$** (`QUANTITY` / `PER_UNIT`) | ✅ **Met / Exceeded** | $\text{Incentive Value (₹/unit)} \times \text{Achieved Count}$ | Calculated Amount (e.g. `₹1,800`) |

---

## 🎯 2. Recommended KPA Role Configuration Matrix

| Role Code | Role Name | Default Seeded Products | Target Type | Starting Target | Auto Event Trigger |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **`LOAN_EXECUTIVE`** | **Loan Executive** | 1. `"Loan Disbursement"`<br>2. `"Lead Generation"` | `AMOUNT`<br>`COUNT` | `0`<br>`0` | Executive Lead Sourcing & Approved Loan Disbursals |
| **`COLLECTION_EXECUTIVE`** | **Collection Executive** | 1. `"Deposit Collection"` | `AMOUNT` | `0` | Cash Submissions & Collection Receipts |
| **`MANAGER`** / `BRANCH_MANAGER` | **Branch Manager** | 1. `"Loan Disbursement"`<br>2. `"Deposit Collection"`<br>3. `"Lead Generation"` | `AMOUNT`<br>`AMOUNT`<br>`COUNT` | `0`<br>`0`<br>`0` | Branch Receipt Approvals, Cash Submissions, & Lead Sourcing |
| **`RECEIPT_MANAGEMENT_EXECUTIVE`** | **Receipt Executive** | 1. `"Deposit Collection"` | `AMOUNT` | `0` | Counter Cash Receipts |
| **`ACCOUNTANT`** | **Accounts Executive** | 1. `"Share Capital"` | `AMOUNT` | `0` | GL Head Receipts & Cash Payments |
| **`SUPPORT_EXECUTIVE`** | **Customer Support Executive** | 1. `"Lead Generation"` | `COUNT` | `0` | Inquiry Lead Logging |
| **`HR`** / `HR_EXECUTIVE` | **HR Executive** | 1. `"Staff Onboarding"` | `COUNT` | `0` | Employee Creation & Onboarding |

---

## ⚡ 3. Automated Event Triggers (Zero Manual Input Required)

| Source Event / Action | Trigger Module | Product Assigned | `sourceModule` | Auto Trigger Condition |
| :--- | :--- | :--- | :--- | :--- |
| **Receipt Created (Auto-Approved)** | Society Receipts | GL Head Name (`glHeadName` / `glHead`) or Receipt Type | `RECEIPT` | Executed ONLY when a Bank Owner creates a receipt. |
| **Receipt Approved** | Society Receipts | GL Head Name (`glHeadName` / `glHead`) or Receipt Type | `RECEIPT` | Executed when a Bank Owner approves a pending receipt (`/approve`). |
| **Cash Submitted** | Cash Payment | `"Cash Collection"` | `CASH_COLLECTION` | Executed when an executive/manager submits field cash (`/submit-cash`). |
| **Executive Lead Created** | Employee Leads | `"Lead Generation"` | `LOAN_DISBURSEMENT` / `LEAD` | Executed when a Loan Executive generates a lead or onboarding book. |

> 🔒 **Deduplication Safeguard**: Automatically tracked with `referenceId` (document ID of receipt/cash submission). Re-approving or editing a transaction will not create duplicate work reports.

---

## 📋 4. Endpoint Summary

### Society HR Sub-Module (`/api/v1/society/employees/hr`)
| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/work-reports` | Staff / Admin | Log a manual daily work report entry |
| `GET` | `/work-reports` | Staff / Admin | List daily work reports (paginated, with search & filters) |
| `GET` | `/work-reports/export` | Staff / Admin | Export daily work reports to UTF-8 BOM CSV |
| `GET` | `/kpa-reports` | Staff / Admin | List employee KPA performance overview |
| `GET` | `/kpa-reports/export` | Staff / Admin | Export employee KPA overview to CSV |
| `GET` | `/:id/kpa-reports/detail` | Staff / Admin | Get detailed KPA Target vs Achievement progress for an employee |
| `POST` | `/kpa-targets` or `/:id/kpa-targets` | Staff / Admin | Add a new KPA target for an employee (Synced with DWR) |
| `PUT` | `/kpa-targets` or `/:id/kpa-targets` | Staff / Admin | Update an existing KPA target (supports upsert) |
| `GET` | `/product-incentives` | Staff / Admin | Get universal product incentive configurations for the bank |
| `POST` / `PUT` | `/product-incentives` | Staff / Admin | Add/Update universal product incentive configuration for a product |

### Employee Mobile & Web Panel (`/api/v1/employee`)
| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/employee/kpa` | Authenticated Executive | Get logged-in employee's KPA progress breakdown |
| `GET` | `/api/v1/employee/work-reports` | Authenticated Executive | Get logged-in employee's daily work report history |
| `POST` | `/api/v1/employee/work-reports` | Authenticated Executive | Submit a daily work report from the Employee app |
| `GET` | `/api/v1/employee/dashboard/stats` | Authenticated Executive | Executive dashboard stats including `kpaSummary` object |

---

## 🛠️ 5. Detailed API Reference & Payloads

---

### 1. Log Daily Work Report (Manual Entry)

Logs a manual work achievement entry for an employee.

- **HTTP Method**: `POST`
- **URL**: `http://localhost:5001/api/v1/society/employees/hr/work-reports`
- **Headers**:
  ```http
  Authorization: Bearer <ACCESS_TOKEN>
  Content-Type: application/json
  ```
- **Request Body (JSON)**:
  ```json
  {
    "employeeId": "64bc7a2f1c8e1a1234567892",
    "date": "2026-08-27T00:00:00.000Z",
    "product": "Loan Disbursement",
    "amount": 250000,
    "remarks": "Disbursed home loan for account #HL-98210"
  }
  ```
- **Success Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "statusCode": 201,
    "message": "Daily Work Report logged successfully.",
    "data": {
      "id": "66ce7a901234567890abcdef",
      "employeeId": "64bc7a2f1c8e1a1234567892",
      "employeeName": "Rahul Sharma",
      "date": "2026-08-27T00:00:00.000Z",
      "product": "Loan Disbursement",
      "amount": 250000,
      "formattedAmount": "₹2,50,000",
      "isAutoGenerated": false,
      "sourceModule": "MANUAL",
      "remarks": "Disbursed home loan for account #HL-98210"
    }
  }
  ```

---

### 2. List Daily Work Reports (with Stats & Multi-Filters)

Retrieves daily work reports with pagination, aggregated `stats` summary, keyword search, location/designation multi-filters, source module filters, and date range filters.

- **HTTP Method**: `GET`
- **URL**: `http://localhost:5001/api/v1/society/employees/hr/work-reports?page=1&limit=10&states=Maharashtra&search=Rahul`
- **Headers**:
  ```http
  Authorization: Bearer <ACCESS_TOKEN>
  ```
- **Query Parameters**:
  * `page` (number, default: 1): Page number.
  * `limit` (number, default: 10): Items per page.
  * `search` (string, optional): Keyword search matching employee name, code, email, phone, product, or remarks.
  * `states` (string / array, optional): Filter by employee state or branch location (e.g. `states=Maharashtra,Gujarat`).
  * `designations` (string / array, optional): Filter by designation (e.g. `designations=Receipt Management Executive,Loan Executive`).
  * `branchId` (string, optional): Filter by single branch ID.
  * `branchIds` (string / array, optional): Filter by multiple branch IDs.
  * `sourceModule` (string, optional): Filter by source module (`RECEIPT`, `CASH_COLLECTION`, `MANUAL`, `LOAN_DISBURSEMENT`).
  * `date` / `dateFrom` / `dateTo` / `startDate` / `endDate` (ISO Date, optional): Filter by specific date or date range.
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Daily Work Reports list retrieved successfully.",
    "data": {
      "stats": {
        "totalWorkReports": 25,
        "totalAmount": 1250000,
        "formattedTotalAmount": "₹12,50,000",
        "autoGeneratedCount": 18,
        "manualCount": 7
      },
      "items": [
        {
          "srNo": 1,
          "id": "66ce7a901234567890abcdef",
          "employeeId": "64bc7a2f1c8e1a1234567892",
          "employeeName": "Rahul Sharma",
          "designation": "Loan Executive",
          "branchName": "Khamla Branch",
          "product": "Loan Disbursement",
          "amount": 250000,
          "formattedAmount": "₹2,50,000",
          "isAutoGenerated": false,
          "sourceModule": "MANUAL",
          "remarks": "Disbursed home loan for account #HL-98210",
          "date": "2026-08-27T00:00:00.000Z"
        }
      ],
      "meta": {
        "totalRecords": 25,
        "limit": 10,
        "page": 1,
        "totalPages": 3,
        "hasNextPage": true,
        "hasPrevPage": false
      }
    }
  }
  ```

---

### 2.5. List Employee KPA Performance Reports (with Stats & Multi-Filters)

Retrieves paginated employee KPA performance overview with aggregated `stats` summary metrics, keyword search, and location/role filters.

- **HTTP Method**: `GET`
- **URL**: `http://localhost:5001/api/v1/society/employees/hr/kpa-reports?page=1&limit=10&states=Maharashtra&search=akaza`
- **Headers**:
  ```http
  Authorization: Bearer <ACCESS_TOKEN>
  ```
- **Query Parameters**:
  * `page` (number, default: 1): Page number.
  * `limit` (number, default: 10): Items per page.
  * `search` (string, optional): Keyword search matching employee name, code, email, or phone.
  * `states` (string / array, optional): Filter by employee state or branch location (e.g. `states=Maharashtra,Gujarat`).
  * `designations` (string / array, optional): Filter by designation (e.g. `designations=Receipt Management Executive,Loan Executive`).
  * `branchId` (string, optional): Filter by single branch ID.
  * `branchIds` (string / array, optional): Filter by multiple branch IDs.
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "KPA Employee list retrieved successfully.",
    "data": {
      "stats": {
        "totalEmployees": 14,
        "totalTargetAmount": 4000000,
        "formattedTotalTargetAmount": "₹40,00,000",
        "totalAchievedAmount": 10000,
        "formattedTotalAchievedAmount": "₹10,000",
        "overallPercentage": 1
      },
      "items": [
        {
          "srNo": 1,
          "id": "6a7c77f9affdd15dd90d20dc",
          "employeeName": "Shujal",
          "designation": "sales Executive",
          "branch": "LALA",
          "phoneNumber": "9743819183",
          "email": "mohammedinamdar5@gmail.com"
        }
      ],
      "meta": {
        "totalRecords": 14,
        "limit": 10,
        "page": 1,
        "totalPages": 2,
        "hasNextPage": true,
        "hasPrevPage": false
      }
    }
  }
  ```

---

### 3. Get Employee KPA Progress Detail

Retrieves detailed Goal vs. Achievement breakdown for an employee across 4 date ranges (Fiscal Year, Monthly, Weekly, Daily).

- **HTTP Method**: `GET`
- **URL**: `http://localhost:5001/api/v1/society/employees/hr/64bc7a2f1c8e1a1234567892/kpa-reports/detail?year=2026&product=Loan%20Disbursement`
- **Headers**:
  ```http
  Authorization: Bearer <ACCESS_TOKEN>
  ```
- **Query Parameters**:
  * `year` (number, default: current year): Fiscal year (April 1 - March 31).
  * `product` (string, optional): Product name filter (e.g. `"Loan Disbursement"`, `"Deposit Collection"`, `"Lead Generation"`).
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Employee KPA targets details retrieved successfully.",
    "data": {
      "employee": {
        "id": "64bc7a2f1c8e1a1234567892",
        "fullName": "Rahul Sharma",
        "designation": "Loan Executive",
        "phoneNumber": "9876543210",
        "email": "rahul.sharma@sahayaone.com",
        "branchName": "Khamla Branch"
      },
      "product": "Loan Disbursement",
      "year": 2026,
      "incentive": {
        "type": "PRODUCT",
        "value": 5,
        "formattedValue": "5% of product cost"
      },
      "yearly": {
        "goal": 2400000,
        "formattedGoal": "₹24,00,000",
        "achieved": 1440000,
        "formattedAchieved": "₹14,40,000",
        "percentage": 60,
        "earnedIncentive": 72000,
        "formattedEarnedIncentive": "₹72,000"
      },
      "monthly": {
        "goal": 200000,
        "formattedGoal": "₹2,00,000",
        "achieved": 130000,
        "formattedAchieved": "₹1,30,000",
        "percentage": 65,
        "earnedIncentive": 6500,
        "formattedEarnedIncentive": "₹6,500"
      },
      "weekly": {
        "goal": 50000,
        "formattedGoal": "₹50,000",
        "achieved": 36000,
        "formattedAchieved": "₹36,000",
        "percentage": 72,
        "earnedIncentive": 1800,
        "formattedEarnedIncentive": "₹1,800"
      },
      "daily": {
        "goal": 10000,
        "formattedGoal": "₹10,000",
        "achieved": 8000,
        "formattedAchieved": "₹8,000",
        "percentage": 80,
        "earnedIncentive": 400,
        "formattedEarnedIncentive": "₹400"
      },
      "breakdown": {
        "creditReceipts": { "count": 2, "amount": 10000, "formattedAmount": "₹10,000" },
        "debitReceipts": { "count": 1, "amount": 2000, "formattedAmount": "₹2,000" },
        "cashSubmissions": { "count": 0, "amount": 0, "formattedAmount": "₹0" },
        "loansDisbursed": { "count": 0, "amount": 0, "formattedAmount": "₹0" },
        "leadsGenerated": { "count": 0 },
        "manualEntries": { "count": 0, "amount": 0, "formattedAmount": "₹0" }
      }
    }
  }
  ```

---

### 4. Add New KPA Target

Adds a new performance target to an employee's profile and returns updated KPA metrics with calculated incentives (incentive configuration is applied universally per product).

- **HTTP Method**: `POST`
- **URL**: `http://localhost:5001/api/v1/society/employees/hr/kpa-targets` *(or `POST /hr/:id/kpa-targets`)*
- **Headers**:
  ```http
  Authorization: Bearer <ACCESS_TOKEN>
  Content-Type: application/json
  ```
- **Request Body (JSON)**:
  ```json
  {
    "employeeId": "64bc7a2f1c8e1a1234567892",
    "year": 2026,
    "product": "Deposit Collection",
    "targetType": "AMOUNT",
    "targetValue": 1200000
  }
  ```

- **Success Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "statusCode": 201,
    "message": "KPA performance target added successfully.",
    "data": {
      "employee": {
        "id": "64bc7a2f1c8e1a1234567892",
        "fullName": "Rahul Sharma",
        "designation": "Loan Executive"
      },
      "product": "Deposit Collection",
      "year": 2026,
      "incentive": {
        "type": "PRODUCT",
        "value": 5,
        "formattedValue": "5% of product cost"
      },
      "yearly": { "goal": 1200000, "formattedGoal": "₹12,00,000", "achieved": 450000, "percentage": 38, "earnedIncentive": 22500, "formattedEarnedIncentive": "₹22,500" },
      "monthly": { "goal": 100000, "formattedGoal": "₹1,00,000", "achieved": 45000, "percentage": 45, "earnedIncentive": 2250, "formattedEarnedIncentive": "₹2,250" },
      "weekly": { "goal": 25000, "formattedGoal": "₹25,000", "achieved": 15000, "percentage": 60, "earnedIncentive": 750, "formattedEarnedIncentive": "₹750" },
      "daily": { "goal": 5000, "formattedGoal": "₹5,000", "achieved": 3000, "percentage": 60, "earnedIncentive": 150, "formattedEarnedIncentive": "₹150" }
    }
  }
  ```

---

### 5. Update Existing KPA Target

Updates an existing KPA target value, fiscal year, or target type for an employee (supports automatic upsert).

- **HTTP Method**: `PUT`
- **URL**: `http://localhost:5001/api/v1/society/employees/hr/kpa-targets` *(or `PUT /hr/:id/kpa-targets`)*
- **Headers**:
  ```http
  Authorization: Bearer <ACCESS_TOKEN>
  Content-Type: application/json
  ```
- **Request Body (JSON)**:
  ```json
  {
    "employeeId": "64bc7a2f1c8e1a1234567892",
    "year": 2026,
    "product": "Deposit Collection",
    "targetType": "AMOUNT",
    "targetValue": 2400000
  }
  ```
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "KPA performance target updated successfully.",
    "data": {
      "employee": {
        "id": "64bc7a2f1c8e1a1234567892",
        "fullName": "Rahul Sharma",
        "designation": "Loan Executive"
      },
      "product": "Deposit Collection",
      "year": 2026,
      "incentive": {
        "type": "QUANTITY",
        "value": 150,
        "formattedValue": "₹150 per quantity"
      },
      "yearly": { "goal": 2400000, "formattedGoal": "₹24,00,000", "achieved": 450000, "percentage": 19, "earnedIncentive": 67500, "formattedEarnedIncentive": "₹67,500" },
      "monthly": { "goal": 200000, "formattedGoal": "₹2,00,000", "achieved": 45000, "percentage": 23, "earnedIncentive": 6750, "formattedEarnedIncentive": "₹6,750" },
      "weekly": { "goal": 50000, "formattedGoal": "₹50,000", "achieved": 15000, "percentage": 30, "earnedIncentive": 2250, "formattedEarnedIncentive": "₹2,250" },
      "daily": { "goal": 10000, "formattedGoal": "₹10,000", "achieved": 3000, "percentage": 30, "earnedIncentive": 450, "formattedEarnedIncentive": "₹450" }
    }
  }
  ```

---

### 5.1. Manage Universal Product Incentives (Bank-Wide Configuration)

Configures universal incentive rules per product across all bank employees.

- **HTTP Method**: `GET` / `POST` / `PUT`
- **URL**: `http://localhost:5001/api/v1/society/employees/hr/product-incentives`
- **Headers**:
  ```http
  Authorization: Bearer <ACCESS_TOKEN>
  Content-Type: application/json
  ```
- **Request Body (for `POST` / `PUT`)**:
  ```json
  {
    "product": "Deposit Collection",
    "incentiveType": "PRODUCT",
    "incentiveValue": 5
  }
  ```
  > 💡 **Incentive Types**:
  > - `"PRODUCT"` (or `"PERCENTAGE"`): Percentage of total product sales/cost amount achieved (e.g. `5` = 5% of total product amount).
  > - `"QUANTITY"` (or `"PER_UNIT"`): Fixed price/rate per quantity unit or count achieved (e.g. `150` = ₹150 per unit quantity).
  > - `"NONE"`: Default (no incentive applied).

- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Universal product incentive updated successfully.",
    "data": [
      {
        "product": "Deposit Collection",
        "incentiveType": "PRODUCT",
        "incentiveValue": 5,
        "formattedIncentiveValue": "5% of product cost"
      },
      {
        "product": "Loan Disbursement",
        "incentiveType": "QUANTITY",
        "incentiveValue": 200,
        "formattedIncentiveValue": "₹200 per quantity"
      }
    ]
  }
  ```

---

### 6. Employee Panel - Get My KPA Progress

Allows a logged-in Loan Executive or Collection Executive to view their live KPA performance targets and achievements directly from the Employee Panel app.

- **HTTP Method**: `GET`
- **URL**: `http://localhost:5001/api/v1/employee/kpa?product=Loan%20Disbursement`
- **Headers**:
  ```http
  Authorization: Bearer <EMPLOYEE_JWT_TOKEN>
  ```
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Your KPA targets performance details retrieved successfully.",
    "data": {
      "employee": {
        "id": "64bc7a2f1c8e1a1234567892",
        "fullName": "Rahul Sharma",
        "designation": "Loan Executive",
        "branchName": "Khamla Branch"
      },
      "product": "Loan Disbursement",
      "year": 2026,
      "incentive": {
        "type": "PRODUCT",
        "value": 5,
        "formattedValue": "5% of product cost"
      },
      "yearly": { "goal": 2400000, "formattedGoal": "₹24,00,000", "achieved": 1440000, "formattedAchieved": "₹14,40,000", "percentage": 60, "earnedIncentive": 72000, "formattedEarnedIncentive": "₹72,000" },
      "monthly": { "goal": 200000, "formattedGoal": "₹2,00,000", "achieved": 130000, "formattedAchieved": "₹1,30,000", "percentage": 65, "earnedIncentive": 6500, "formattedEarnedIncentive": "₹6,500" },
      "weekly": { "goal": 50000, "formattedGoal": "₹50,000", "achieved": 36000, "formattedAchieved": "₹36,000", "percentage": 72, "earnedIncentive": 1800, "formattedEarnedIncentive": "₹1,800" },
      "daily": { "goal": 10000, "formattedGoal": "₹10,000", "achieved": 8000, "formattedAchieved": "₹8,000", "percentage": 80, "earnedIncentive": 400, "formattedEarnedIncentive": "₹400" }
    }
  }
  ```

---

### 7. Employee Panel - Get My Daily Work Reports

- **HTTP Method**: `GET`
- **URL**: `http://localhost:5001/api/v1/employee/work-reports?page=1&limit=10`
- **Headers**:
  ```http
  Authorization: Bearer <EMPLOYEE_JWT_TOKEN>
  ```
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Your Daily Work Reports list retrieved successfully.",
    "data": [
      {
        "srNo": 1,
        "id": "66ce7a901234567890abcdef",
        "date": "2026-08-27T00:00:00.000Z",
        "product": "Cash Collection",
        "amount": 15000,
        "formattedAmount": "₹15,000",
        "isAutoGenerated": true,
        "sourceModule": "CASH_COLLECTION"
      }
    ],
    "meta": { "totalRecords": 1, "limit": 10, "page": 1, "totalPages": 1 }
  }
  ```

---

### 8. Employee Panel - Submit Daily Work Report

- **HTTP Method**: `POST`
- **URL**: `http://localhost:5001/api/v1/employee/work-reports`
- **Headers**:
  ```http
  Authorization: Bearer <EMPLOYEE_JWT_TOKEN>
  Content-Type: application/json
  ```
- **Request Body (JSON)**:
  ```json
  {
    "date": "2026-08-27T00:00:00.000Z",
    "product": "Loan Disbursement",
    "amount": 150000,
    "remarks": "Completed loan documentation and disbursal"
  }
  ```
- **Success Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "statusCode": 201,
    "message": "Daily Work Report logged successfully.",
    "data": {
      "id": "66ce7a901234567890abcdef",
      "date": "2026-08-27T00:00:00.000Z",
      "product": "Loan Disbursement",
      "amount": 150000,
      "formattedAmount": "₹1,50,000",
      "isAutoGenerated": false,
      "sourceModule": "MANUAL",
      "remarks": "Completed loan documentation and disbursal"
    }
  }
  ```

---

### 9. Employee Dashboard Stats (with `kpaSummary`)

- **HTTP Method**: `GET`
- **URL**: `http://localhost:5001/api/v1/employee/dashboard/stats`
- **Headers**:
  ```http
  Authorization: Bearer <EMPLOYEE_JWT_TOKEN>
  ```
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Dashboard statistics retrieved successfully.",
    "data": {
      "dueAccounts": 12,
      "todayCollections": { "raw": 45000, "formatted": "₹45K" },
      "totalLeads": 38,
      "pendingApplications": 5,
      "pendingApprovals": 2,
      "disbursalValue": { "raw": 3200000, "formatted": "₹32L" },
      "accountOpening": 18,
      "unresolvedTickets": 3,
      "kpaSummary": {
        "product": "Loan Disbursement",
        "yearly": { "goal": 2400000, "achieved": 1440000, "percentage": 60 },
        "monthly": { "goal": 200000, "achieved": 130000, "percentage": 65 },
        "weekly": { "goal": 50000, "achieved": 36000, "percentage": 72 },
        "daily": { "goal": 10000, "achieved": 8000, "percentage": 80 }
      }
    }
  }
  ```

---

## 🔒 6. Error Handling Reference

| Status Code | Error Message | Description |
| :--- | :--- | :--- |
| `400 Bad Request` | `"Employee ID is required for adding KPA target."` | Missing required employee identification. |
| `400 Bad Request` | `"Target product name is required."` | Product name field was omitted or empty. |
| `400 Bad Request` | `"Target value must be a non-negative number."` | `targetValue` was negative or invalid. |
| `404 Not Found` | `"Society Employee not found under this bank context."` | Employee ID does not exist under authenticated bank tenant. |
| `409 Conflict` | `"KPA target for product \"...\" already exists..."` | Target for product already exists. Use `PUT` endpoint to update. |
