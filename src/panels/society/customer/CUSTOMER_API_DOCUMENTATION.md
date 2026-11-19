# 👥 Society Customer & Merchant Management API Documentation

This document provides technical specifications, authorization rules, multi-tenant scoping guidelines, request/response payload examples, and error responses for the **Society Customer & Merchant Management API** (`/api/v1/society/customers`).

---

## 📌 1. Architecture & Security Overview

1. **Authentication & Multi-Tenant Isolation**:
   - All endpoints require JWT Authentication header: `Authorization: Bearer <ACCESS_TOKEN>`.
   - All data access is automatically scoped to the logged-in user's Society Bank (`bankId`) via `resolveSocietyContext` middleware.
   - Unauthenticated or invalid token requests return `401 Unauthorized`.

2. **Branch Scoping Rules**:
   - **Bank-wide Roles** (`BANK_OWNER`, `BANK_ADMIN`, `SOCIETY_ADMIN`, `SUPER_ADMIN`, `BANK_RECEIPT_MANAGER`, `RECEIPT_MANAGER`): Possess bank-wide visibility across all branches and can filter members by specific `branchId`.
   - **Branch-bound Roles** (`BRANCH_MANAGER`, `QC_EMPLOYEE`, `RECEIPT_MANAGEMENT_EXECUTIVE`, `CUSTOMER_SUPPORT_EXECUTIVE`): Restricted strictly to viewing customers and merchants assigned to their logged-in branch (`branchId`).

3. **Authorized Roles**:
   - Bank Owner / Admin (`BANK_OWNER`, `BANK_ADMIN`, `SOCIETY_ADMIN`, `SUPER_ADMIN`)
   - Branch Manager (`BRANCH_MANAGER`, `MANAGER`)
   - Branch Quality Check Employee (`QC_EMPLOYEE`, `QUALITY_CHECK`, `QC`)
   - Receipt Management Executive (`RECEIPT_MANAGEMENT_EXECUTIVE`, `RECEIPT_EXECUTIVE`)
   - Bank Receipt Manager (`BANK_RECEIPT_MANAGER`, `RECEIPT_MANAGER`)
   - Customer Support Executive (`CUSTOMER_SUPPORT_EXECUTIVE`, `SUPPORT_EXECUTIVE`, `CUSTOMER_SUPPORT`)

4. **Unified Customer & Merchant View**:
   - The `/api/v1/society/customers` endpoint returns a unified member listing combining:
     - **Customers**: `SocietyCustomerLink` records joined with `CustomerProfile`.
     - **Merchants**: `MerchantProfile` records.
   - Filter by member entity type via query parameter `type=CUSTOMER`, `type=MERCHANT`, or `type=ALL` (default).

---

## 📋 2. Endpoint Summary Table

| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/society/customers` | Authorized Society Roles | Paginated list of society customers & merchants with Pigmy/Loans filters & summary stats |
| `GET` | `/api/v1/society/customers/dropdown` | Society Staff | Active customers & merchants dropdown list |
| `GET` | `/api/v1/society/customers/:id` | Authorized Society Roles | Detailed view of a customer or merchant with full loans, pigmy, & EMI card details |

---

## 🛠️ 3. Detailed API Reference

### 1. Unified Customer & Merchant List API (With Pigmy & Loan Filters)

Retrieves paginated customer and merchant accounts for the society bank with aggregated summary metrics (`stats`), total loans count/amount, total pigmy count/balance, creator Employee ID/name, EMI card expiry date (`validThru`), and society bank account details.

- **HTTP Method**: `GET`
- **URL**: `http://localhost:5001/api/v1/society/customers?page=1&limit=10&type=ALL&search=Ramesh&hasPigmy=true&hasLoans=true`
- **Headers**:
  ```http
  Authorization: Bearer <ACCESS_TOKEN>
  ```
- **Query Parameters**:
  - `page` (number, default: `1`): Page number.
  - `limit` (number, default: `10`): Items per page (max `100`).
  - `search` (string, optional): Search keyword matching customer/merchant name, phone number, email, society account number, or customer ID.
  - `type` (string, enum: `CUSTOMER`, `MERCHANT`, `ALL`, default: `ALL`): Filter by member entity type.
  - `product` (string, enum: `PIGMY`, `LOAN`, `BOTH`, `NONE`, `ALL`, optional): Filter members having specific product accounts.
  - `hasPigmy` (boolean / string: `true` / `false` / `1` / `0`, optional): Filter members with or without Pigmy deposit accounts.
  - `hasLoans` (boolean / string: `true` / `false` / `1` / `0`, optional): Filter members with or without Loan accounts.
  - `pigmyStatus` (string, optional): Filter members having Pigmy accounts matching specific status (e.g., `ACTIVE`).
  - `loanStatus` (string, optional): Filter members having Loans matching specific status (e.g., `APPROVED`, `ACTIVE`).
  - `status` (string, optional): Filter by member status (`ACTIVE`, `INACTIVE`, `PENDING`, etc.).
  - `branchId` (string, optional): Filter by branch Object ID (Bank Owners / Bank Receipt Managers only).
  - `dateFrom` / `dateTo` (ISO Date, optional): Filter by onboarding date range.

#### 📊 Summary Statistics Breakdown (`stats`)

| Stat Field | Type | Description |
| :--- | :--- | :--- |
| `totalRecords` | number | Total number of customer & merchant records in the filtered result set. |
| `totalCustomers` | number | Count of individual **Customers** in the result set. |
| `totalMerchants` | number | Count of business **Merchants** in the result set. |
| `pigmyCustomersCount` | number | Count of **unique members (people/merchants)** who hold at least 1 Pigmy deposit account. |
| `loanCustomersCount` | number | Count of **unique members (people/merchants)** who have at least 1 Loan account. |
| `totalPigmyCount` | number | Total number of **Pigmy deposit accounts/schemes** across all members combined. |
| `totalLoansCount` | number | Total number of **Loan accounts** across all members combined. |

> **Difference Example**:
> - If Customer A has 3 Pigmy accounts and Customer B has 1 Pigmy account:
>   - `pigmyCustomersCount` = **2** (Unique people who have Pigmy accounts)
>   - `totalPigmyCount` = **4** (Total Pigmy deposit accounts: 3 + 1)

- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Society customer & merchant list retrieved successfully.",
    "data": {
      "stats": {
        "totalRecords": 2,
        "totalCustomers": 1,
        "totalMerchants": 1,
        "pigmyCustomersCount": 2,
        "loanCustomersCount": 2,
        "totalLoansCount": 3,
        "totalPigmyCount": 4
      },
      "items": [
        {
          "srNo": 1,
          "id": "66ce7a901234567890abcdef",
          "userId": "66ce7a901234567890aaaaaa",
          "customerId": "CUST-987654",
          "name": "Rajesh Kumar",
          "shopName": null,
          "ownerName": null,
          "entityType": "CUSTOMER",
          "phoneNumber": "9876543210",
          "email": "rajesh.kumar@gmail.com",
          "status": "ACTIVE",
          "branchId": "64bc7a2f1c8e1a1234567892",
          "branchName": "Main Branch",
          "totalLoans": {
            "count": 2,
            "activeCount": 1,
            "totalAmount": 150000,
            "outstandingAmount": 45000
          },
          "totalPigmy": {
            "count": 3,
            "activeCount": 3,
            "totalBalance": 37500
          },
          "createdBy": {
            "id": "64bc7a2f1c8e1a1234567111",
            "name": "Amit Sharma",
            "role": "LOAN_EXECUTIVE",
            "phone": "9823011223",
            "employeeId": "EMP-1042"
          },
          "createdAt": "2026-08-15T10:30:00.000Z",
          "emiCardDetails": {
            "id": "66ce7a901234567890card01",
            "cardNumber": "4590123456789012",
            "cardHolderName": "Rajesh Kumar",
            "validThru": "12/28",
            "expiryDate": "2028-12-31T00:00:00.000Z",
            "cardLimit": 100000,
            "availableLimit": 55000,
            "status": "ACTIVE"
          },
          "societyAccountDetails": {
            "accountNumber": "SOC-900123456",
            "accountHolderName": "Rajesh Kumar",
            "ifscCode": "MAHB0001234",
            "bankName": "Main Branch Bank",
            "branchName": "Main Branch",
            "pincode": "440010"
          }
        },
        {
          "srNo": 2,
          "id": "66ce7a901234567890merchant",
          "userId": "66ce7a901234567890muser",
          "customerId": "MER-197391",
          "name": "Vigneswara Supermarket (Ramesh Gupta)",
          "shopName": "Vigneswara Supermarket",
          "ownerName": "Ramesh Gupta",
          "entityType": "MERCHANT",
          "phoneNumber": "9823011223",
          "email": "vigneswara@gmail.com",
          "status": "ACTIVE",
          "branchId": "64bc7a2f1c8e1a1234567892",
          "branchName": "Main Branch",
          "totalLoans": {
            "count": 1,
            "activeCount": 1,
            "totalAmount": 200000,
            "outstandingAmount": 120000
          },
          "totalPigmy": {
            "count": 1,
            "activeCount": 1,
            "totalBalance": 50000
          },
          "createdBy": {
            "id": "64bc7a2f1c8e1a1234567111",
            "name": "Amit Sharma",
            "role": "LOAN_EXECUTIVE",
            "phone": "9823011223",
            "employeeId": "EMP-1042"
          },
          "createdAt": "2026-08-20T14:15:00.000Z",
          "emiCardDetails": null,
          "societyAccountDetails": {
            "accountNumber": "912010045678901",
            "accountHolderName": "Ramesh Gupta",
            "ifscCode": "MAHB0001234",
            "bankName": "Bank of Maharashtra",
            "branchName": "Khamla Nagpur",
            "pincode": ""
          }
        }
      ],
      "meta": {
        "totalRecords": 2,
        "limit": 10,
        "page": 1,
        "totalPages": 1,
        "hasNextPage": false,
        "hasPrevPage": false
      }
    }
  }
  ```

---

### 2. Member Details API

Retrieves comprehensive profile details for a specific customer or merchant, including full loan history, pigmy accounts list, EMI card status/expiry, creator employee details, and society bank account details.

- **HTTP Method**: `GET`
- **URL**: `http://localhost:5001/api/v1/society/customers/66ce7a901234567890abcdef`
- **Headers**:
  ```http
  Authorization: Bearer <ACCESS_TOKEN>
  ```
- **Path Parameters**:
  - `id` (string, required): MongoDB ObjectId of customer link or merchant profile.
- **Query Parameters**:
  - `type` (string, optional: `CUSTOMER` or `MERCHANT`): Optional explicit entity type hint.

- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Customer details retrieved successfully.",
    "data": {
      "id": "66ce7a901234567890abcdef",
      "userId": "66ce7a901234567890aaaaaa",
      "customerId": "CUST-987654",
      "name": "Rajesh Kumar",
      "shopName": null,
      "ownerName": null,
      "entityType": "CUSTOMER",
      "phoneNumber": "9876543210",
      "email": "rajesh.kumar@gmail.com",
      "status": "ACTIVE",
      "branchId": "64bc7a2f1c8e1a1234567892",
      "branchName": "Main Branch",
      "personalDetails": {
        "firstName": "Rajesh",
        "lastName": "Kumar",
        "fullName": "Rajesh Kumar",
        "phoneNumber": "9876543210",
        "email": "rajesh.kumar@gmail.com",
        "gender": "MALE",
        "dob": "1992-05-15T00:00:00.000Z",
        "panNumber": "ABCDE1234F",
        "aadhaarNumber": "123456789012",
        "kycStatus": "VERIFIED",
        "creditScore": 750,
        "cibilStatus": "APPROVED",
        "onboardingStage": "COMPLETED",
        "residentialPincode": "440010",
        "currentPinCode": "440010",
        "activeAddress": {
          "addressLine": "Flat 302, Green Valley Apartments",
          "pinCode": "440010"
        },
        "addressHistory": []
      },
      "documents": {
        "panImage": "https://s3.amazonaws.com/bucket/pan-123.jpg",
        "aadhaarImage": "https://s3.amazonaws.com/bucket/aadhaar-123.jpg",
        "livePhoto": "https://s3.amazonaws.com/bucket/live-photo-123.jpg",
        "profileImage": "https://s3.amazonaws.com/bucket/avatar-123.jpg",
        "avatar": "https://s3.amazonaws.com/bucket/avatar-123.jpg",
        "cibilReportUrl": "https://s3.amazonaws.com/bucket/cibil-report-123.pdf",
        "rawKycData": null,
        "rawCibilData": null
      },
      "bankDetails": [
        {
          "accountNumber": "SOC-900123456",
          "accountHolderName": "Rajesh Kumar",
          "ifscCode": "MAHB0001234",
          "bankName": "Main Branch Bank",
          "branchName": "Main Branch",
          "pincode": "440010",
          "isPrimary": true
        }
      ],
      "totalLoans": {
        "count": 2,
        "activeCount": 1,
        "totalAmount": 150000,
        "outstandingAmount": 45000,
        "loansList": [
          {
            "id": "66ce7a901234567890loan01",
            "applicationId": "LN-2026-0091",
            "status": "ACTIVE",
            "totalLoanAmount": 100000,
            "outstandingAmount": 45000,
            "emiAmount": 4500,
            "createdAt": "2026-08-16T11:00:00.000Z"
          }
        ]
      },
      "totalPigmy": {
        "count": 1,
        "activeCount": 1,
        "totalBalance": 12500,
        "pigmyList": [
          {
            "id": "66ce7a901234567890pigmy01",
            "pigmyAccountNumber": "PGM-789012",
            "schemeName": "Daily Pigmy Deposit 100",
            "depositAmount": 100,
            "currentBalance": 12500,
            "status": "ACTIVE",
            "createdAt": "2026-08-18T09:30:00.000Z"
          }
        ]
      },
      "createdBy": {
        "id": "64bc7a2f1c8e1a1234567111",
        "name": "Amit Sharma",
        "role": "LOAN_EXECUTIVE",
        "phone": "9823011223",
        "employeeId": "EMP-1042"
      },
      "createdAt": "2026-08-15T10:30:00.000Z",
      "emiCardDetails": {
        "id": "66ce7a901234567890card01",
        "cardNumber": "4590123456789012",
        "cardHolderName": "Rajesh Kumar",
        "validThru": "12/28",
        "expiryDate": "2028-12-31T00:00:00.000Z",
        "cardLimit": 100000,
        "availableLimit": 55000,
        "status": "ACTIVE"
      },
      "societyAccountDetails": {
        "accountNumber": "SOC-900123456",
        "accountHolderName": "Rajesh Kumar",
        "ifscCode": "MAHB0001234",
        "bankName": "Main Branch Bank",
        "branchName": "Main Branch",
        "pincode": "440010"
      }
    }
  }
  ```

---

### 3. Active Members Dropdown Selection API

Retrieves a quick selection list of active society customers and merchants for dropdown fields.

- **HTTP Method**: `GET`
- **URL**: `http://localhost:5001/api/v1/society/customers/dropdown`
- **Headers**:
  ```http
  Authorization: Bearer <ACCESS_TOKEN>
  ```
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Customer dropdown list retrieved successfully.",
    "data": [
      {
        "id": "66ce7a901234567890abcdef",
        "userId": "66ce7a901234567890aaaaaa",
        "name": "Rajesh Kumar",
        "label": "Rajesh Kumar (SOC-900123456)",
        "entityType": "CUSTOMER",
        "phoneNumber": "9876543210",
        "societyAccountNumber": "SOC-900123456"
      }
    ]
  }
  ```
