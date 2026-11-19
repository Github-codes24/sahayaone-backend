# 🏬 Society Merchant Partner Management API Documentation

This document provides complete technical specifications, request/response payloads, multi-tenant context guidelines, file upload protocols, and Postman examples for the **Society Merchant Management API** (`/api/v1/society/merchants`).

---

## 📌 1. Architecture & Security Overview

1. **Authentication & Multi-Tenant Isolation**:
   - All endpoints require JWT Authentication header: `Authorization: Bearer <ACCESS_TOKEN>`.
   - Data access is automatically scoped to the logged-in user's Society Bank (`bankId`) via `resolveSocietyContext` middleware.
   - **Branch Scoping**:
     - **Branch Managers & QC Officers**: Restricted to merchants registered under their assigned branch (`branchId`). If a user is associated with a specific branch, they can only access and manage data belonging to that branch.
     - **Bank Owner / Admin**: Can list/filter merchants across all branches or filter by specific `branchId` / `branchIds`.

2. **Separation of Society Bank Account & Commercial Bank Details**:
   - **Society Bank Account (`societyAccount`)**: Internal co-operative society account details (`societyAccountNumber`, `ifscCode`, `accountHolderName`, `bankBranchName`) used for society credit/deposit linkage.
   - **Commercial Bank Details (`bankDetails`)**: External commercial bank details (`accountNumber`, `ifscCode`, `bankName`, `branchName`, `accountType`) used for external payouts or mandate debits.
   - `bankDetails` and `societyAccount` are kept strictly separate and independent.

3. **Bank Account Number Uniqueness Check**:
   - Every bank account number entered for a merchant profile is checked for uniqueness across the database (`MerchantProfile` bank details, `societyAccount`, and `SocietyCustomerLink` records).
   - Duplicate bank account numbers are rejected with a `409 Conflict` error.

4. **Loan Executive Restrictions & Authorized Personnel Management**:
   - **Loan Executives (`LOAN_EXECUTIVE`)**: When a Loan Executive registers a merchant partner, they **cannot** fill bank account details (`bankDetails` & `societyAccount` are set to `null` at creation). The merchant is created in `PENDING_BRANCH_APPROVAL` status and `INACTIVE` state.
   - **Authorized Personnel Only**: Only **Branch Managers**, **Bank Owners**, **Quality Check (QC)** officers (`QC_EMPLOYEE`, `QUALITY_CHECK`), **Society Admins**, and **Super Admins** are authorized to add or link merchant bank account details.

5. **Dedicated Link Bank API & Immutability in General Update API**:
   - **Link Bank API (`/society-account` or `/link-bank`)**: Dedicated endpoint to add or link co-operative society bank account details to a merchant. It populates `societyAccount` on `MerchantProfile` and syncs with `SocietyCustomerLink` without overwriting `bankDetails`.
   - **Update API Restriction (`PUT /:id`)**: Bank account details **cannot** be changed or edited via the general update API. Attempting to pass bank details in `PUT /:id` returns a `400 Bad Request` error directing users to use the Link Bank API.

6. **Pre-Approval Society Bank Account Linkage Verification**:
   - Attempting to approve a merchant partner (`approveMerchant`) strictly checks whether a society bank account (`societyAccount.societyAccountNumber` or `SocietyCustomerLink.societyAccountNumber`) exists or not. If no society account exists, approval fails with a `400 Bad Request` error requiring authorized personnel to link society bank account details first before approval.

7. **Mandatory Rejection Reason**:
   - Rejecting a merchant partner application (`rejectMerchant`) strictly requires a non-empty `reason` parameter in the request payload. Rejection requests submitted without a reason are rejected with a `400 Bad Request` validation error.

8. **Role Restrictions for Restoration & Deletion**:
   - **Soft Delete**, **Restore**, and **Permanent Delete** endpoints are strictly restricted to Bank Owners, Society Admins, and Branch Managers.

9. **User Credential Generation & Lifecycle**:
   - Creating a Merchant Partner automatically provisions a linked `User` login document (`role: MERCHANT`, `userType: PARTNER`).
   - Soft-deleting a merchant disables their `User` account (`isDeleted: true`).
   - Restoring a merchant re-activates their `User` account (`isDeleted: false`, `status: ACTIVE`).
   - Permanently deleting a merchant removes both `MerchantProfile` and `User` documents from MongoDB.

---

## 📋 2. Endpoint Summary Table

| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/society/merchants` | Bank Owner / Branch Manager / QC | List merchants (with `stats`, `isDeleted` filter, city/state, & search) |
| `GET` | `/api/v1/society/merchants/dropdown` | Society Staff | Dropdown list of active merchants for selection |
| `GET` | `/api/v1/society/merchants/:id` | Bank Owner / Branch Manager / QC | Get detailed merchant profile and document links |
| `POST` | `/api/v1/society/merchants` | Society Staff / Loan Executive | Register new Merchant Partner (Loan Executive creates without bank details) |
| `POST` | `/api/v1/society/merchants/:id/society-account` | Authorized Personnel Only | Link / Add Society Bank Account details (Same pattern as Pigmy API) |
| `POST` | `/api/v1/society/merchants/:id/link-bank` | Authorized Personnel Only | Alias endpoint to link / add bank account details |
| `PUT` | `/api/v1/society/merchants/:id` | Authorized Personnel Only | Update Merchant profile (Bank details modification blocked; use Link Bank API) |
| `DELETE` | `/api/v1/society/merchants/:id` | **Bank Owner / Manager Only** | Soft delete merchant partner account |
| `PATCH` / `PUT` | `/api/v1/society/merchants/:id/restore` | **Bank Owner / Manager Only** | Restore soft-deleted merchant partner account |
| `DELETE` | `/api/v1/society/merchants/:id/permanent` | **Bank Owner / Manager Only** | Permanently (hard) delete merchant account from MongoDB |
| `POST` / `PUT` / `PATCH` | `/api/v1/society/merchants/:id/approve` | **Bank Owner / Manager / QC** | Approve merchant partner (requires linked society bank account) |
| `POST` / `PUT` / `PATCH` | `/api/v1/society/merchants/:id/reject` | **Bank Owner / Manager / QC** | Reject merchant partner (requires mandatory `reason`) |

---

## 🛠️ 3. Detailed API Reference

### 1. List Merchants (with Stats, Deleted Filter, & Multi-Filters)

Retrieves paginated merchant accounts with aggregated `stats` summary metrics (including `deletedMerchants` count), keyword search, location (city/state) branch filters, and soft-delete filters.

- **HTTP Method**: `GET`
- **URL**: `http://localhost:5001/api/v1/society/merchants?page=1&limit=10&isDeleted=true`
- **Headers**:
  ```http
  Authorization: Bearer <ACCESS_TOKEN>
  ```
- **Query Parameters**:
  - `page` (number, default: 1): Page number.
  - `limit` (number, default: 10): Items per page.
  - `isDeleted` (boolean / string, optional):
    - `true`: Return soft-deleted merchants only.
    - `false` (default): Return active/non-deleted merchants only.
    - `"all"`: Return both active and deleted merchants.
  - `search` (string, optional): Search across shop name, owner name, email, phone, GSTIN, PAN, Aadhaar, or branch details.
  - `status` (string, optional): Filter by status (`ACTIVE`, `INACTIVE`, `BLOCKED`, `DELETED`, `ALL`).
  - `approvalStatus` (string, optional): Filter by approval status (`PENDING_BRANCH_APPROVAL`, `APPROVED`, `REJECTED`).
  - `city` / `cities` (string / array, optional): Filter merchants linked to branches in specific cities (e.g. `city=Nagpur`).
  - `state` / `states` (string / array, optional): Filter merchants linked to branches in specific states (e.g. `states=Maharashtra,Gujarat`).
  - `branchId` (string, optional): Filter by single branch ID.
  - `branchIds` (string / array, optional): Filter by multiple branch IDs.
  - `startDate` / `endDate` / `dateFrom` / `dateTo` / `fromDate` / `toDate` / `createdFrom` / `createdTo` / `from` / `to` / `date` (ISO / YYYY-MM-DD Date string, optional): Creation date range filter (`createdAt`).
  - `createdBy` / `onboardedBy` (string, optional): Filter merchants created/onboarded by specific Executive or User Object ID.

- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Merchants list retrieved successfully.",
    "data": {
      "stats": {
        "totalMerchants": 13,
        "activeMerchants": 10,
        "pendingMerchants": 1,
        "approvedMerchants": 10,
        "rejectedMerchants": 1,
        "inactiveMerchants": 1,
        "blockedMerchants": 1,
        "deletedMerchants": 1
      },
      "items": [
        {
          "srNo": 1,
          "id": "66ce7a901234567890abcdef",
          "merchantId": "66ce7a901234567890abcdef",
          "merchantCode": "MER-ABC123",
          "userId": "66ce7a901234567890aaaaaa",
          "bankId": "64bc7a2f1c8e1a1234567000",
          "branchId": "64bc7a2f1c8e1a1234567892",
          "branchName": "Khamla Branch",
          "shopName": "Vigneswara Supermarket",
          "ownerName": "Ramesh Gupta",
          "email": "vigneswara@gmail.com",
          "phoneNumber": "9823011223",
          "bankDetails": {
            "accountHolderName": "Ramesh Gupta",
            "accountNumber": "912010045678901",
            "ifscCode": "MAHB0001234",
            "bankName": "Bank of Maharashtra",
            "branchName": "Khamla Nagpur",
            "accountType": "CURRENT"
          },
          "societyAccount": {
            "societyAccountNumber": "912010045678901",
            "ifscCode": "MAHB0001234",
            "accountHolderName": "Ramesh Gupta",
            "bankBranchName": "Khamla Nagpur"
          },
          "approvalStatus": "APPROVED",
          "status": "ACTIVE",
          "createdAt": "2026-08-27T00:00:00.000Z"
        }
      ],
      "meta": {
        "totalRecords": 13,
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

### 2. Active Merchants Dropdown List

Retrieves a quick list of active merchant partners for dropdown select fields in loan applications or sales transactions.

- **HTTP Method**: `GET`
- **URL**: `http://localhost:5001/api/v1/society/merchants/dropdown`
- **Headers**:
  ```http
  Authorization: Bearer <ACCESS_TOKEN>
  ```
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Merchants dropdown list retrieved successfully.",
    "data": [
      {
        "id": "66ce7a901234567890abcdef",
        "merchantId": "66ce7a901234567890abcdef",
        "shopName": "Vigneswara Supermarket",
        "ownerName": "Ramesh Gupta",
        "label": "Vigneswara Supermarket (Ramesh Gupta)",
        "phoneNumber": "9823011223",
        "email": "vigneswara@gmail.com",
        "branchId": "64bc7a2f1c8e1a1234567892",
        "branchName": "Khamla Branch"
      }
    ]
  }
  ```

---

### 3. Create New Merchant Partner

Registers a new Merchant Partner under the society bank branch.
- **Loan Executive Workflow**: If created by a `LOAN_EXECUTIVE`, bank details are automatically set to `null` (Loan Executives cannot enter bank details). The merchant is created in `PENDING_BRANCH_APPROVAL` status and `INACTIVE` state.
- **Authorized Person Creation**: If created by Authorized Personnel (Branch Manager, Bank Owner, QC), bank details can be filled and are validated for co-operative bank standards and bank account number uniqueness across the DB.

- **HTTP Method**: `POST`
- **URL**: `http://localhost:5001/api/v1/society/merchants`
- **Headers**:
  ```http
  Authorization: Bearer <ACCESS_TOKEN>
  Content-Type: multipart/form-data
  ```
- **Option A: Request Body (Loan Executive - `LOAN_EXECUTIVE`)**:
  ```json
  {
    "shopName": "Vigneswara Supermarket",
    "ownerName": "Ramesh Gupta",
    "email": "vigneswara@gmail.com",
    "phoneNumber": "9823011223",
    "aadhaarNumber": "451234567890",
    "panNumber": "ABCDE1234F",
    "gstinNumber": "27ABCDE1234F1Z5",
    "branchId": "64bc7a2f1c8e1a1234567892"
  }
  ```

- **Option B: Request Body (Authorized Personnel - Branch Manager, Bank Owner, QC)**:
  ```json
  {
    "shopName": "Vigneswara Supermarket",
    "ownerName": "Ramesh Gupta",
    "email": "vigneswara@gmail.com",
    "phoneNumber": "9823011223",
    "aadhaarNumber": "451234567890",
    "panNumber": "ABCDE1234F",
    "gstinNumber": "27ABCDE1234F1Z5",
    "branchId": "64bc7a2f1c8e1a1234567892",
    "societyAccount": {
      "accountHolderName": "Ramesh Gupta",
      "accountNumber": "912010045678901",
      "societyAccountNumber": "912010045678901",
      "ifscCode": "MAHB0001234",
      "bankName": "Bank of Maharashtra",
      "branchName": "Khamla Nagpur",
      "bankBranchName": "Khamla Nagpur",
      "accountType": "CURRENT"
    }
  }
  ```
  *(Note: Keys `societyAccount`, `societyBankAccount`, and `bankDetails` as well as root-level bank fields `accountNumber` / `societyAccountNumber`, `accountHolderName`, `ifscCode`, `bankName`, `branchName` / `bankBranchName` are all supported).*

- **Response Example A (Created by Loan Executive - `201 Created`)**:
  ```json
  {
    "success": true,
    "statusCode": 201,
    "message": "Merchant created successfully.",
    "data": {
      "id": "66ce7a901234567890abcdef",
      "merchantCode": "MER-197391",
      "shopName": "Vigneswara Supermarket",
      "ownerName": "Ramesh Gupta",
      "email": "vigneswara@gmail.com",
      "phoneNumber": "9823011223",
      "bankDetails": null,
      "societyAccount": null,
      "approvalStatus": "PENDING_BRANCH_APPROVAL",
      "status": "INACTIVE",
      "onboardedBy": {
        "id": "64bc7a2f1c8e1a1234567111",
        "name": "Loan Executive Officer",
        "role": "LOAN_EXECUTIVE"
      }
    }
  }
  ```

- **Response Example B (Created by Authorized Personnel - `201 Created`)**:
  ```json
  {
    "success": true,
    "statusCode": 201,
    "message": "Merchant created successfully.",
    "data": {
      "id": "66ce7a901234567890abcdef",
      "merchantCode": "MER-197391",
      "shopName": "Vigneswara Supermarket",
      "ownerName": "Ramesh Gupta",
      "email": "vigneswara@gmail.com",
      "phoneNumber": "9823011223",
      "bankDetails": {
        "accountHolderName": "Ramesh Gupta",
        "accountNumber": "912010045678901",
        "ifscCode": "MAHB0001234",
        "bankName": "Bank of Maharashtra",
        "branchName": "Khamla Nagpur",
        "accountType": "CURRENT"
      },
      "societyAccount": {
        "societyAccountNumber": "912010045678901",
        "ifscCode": "MAHB0001234",
        "accountHolderName": "Ramesh Gupta",
        "bankBranchName": "Khamla Nagpur"
      },
      "approvalStatus": "APPROVED",
      "status": "ACTIVE",
      "onboardedBy": {
        "id": "64bc7a2f1c8e1a1234567888",
        "name": "Branch Manager",
        "role": "BRANCH_MANAGER"
      }
    }
  }
  ```

---

### 4. Link / Add Society Bank Account Details (Dedicated Link Bank API)

Links co-operative society bank account details to a merchant.
- **Pattern**: Matches Pigmy API `/society-account` route structure.
- **Functionality**: Updates `societyAccount` on `MerchantProfile` and syncs with `SocietyCustomerLink` (without overwriting commercial `bankDetails`).
- **Uniqueness Check**: Validates account number uniqueness across the entire database (`MerchantProfile` and `SocietyCustomerLink`).

- **HTTP Method**: `POST`
- **URL**: 
  - `http://localhost:5001/api/v1/society/merchants/66ce7a901234567890abcdef/society-account`
  - OR `http://localhost:5001/api/v1/society/merchants/66ce7a901234567890abcdef/link-bank`
- **Headers**:
  ```http
  Authorization: Bearer <ACCESS_TOKEN>
  Content-Type: application/json
  ```
- **Body**:
  ```json
  {
    "societyAccountNumber": "912010045678901",
    "accountHolderName": "Ramesh Gupta",
    "ifscCode": "MAHB0001234",
    "bankName": "Bank of Maharashtra",
    "bankBranchName": "Khamla Nagpur",
    "accountType": "CURRENT"
  }
  ```
  | Field | Type | Required | Description |
  | :--- | :--- | :--- | :--- |
  | `accountNumber` / `societyAccountNumber` | string | **Yes** | Internal society/bank account number |
  | `accountHolderName` | string | Optional | Name of account holder (defaults to merchant owner name) |
  | `ifscCode` | string | Optional | Bank IFSC Code |
  | `bankName` | string | Optional | Bank name |
  | `branchName` / `bankBranchName` | string | Optional | Branch name |
  | `accountType` | string | Optional | `SAVINGS`, `CURRENT`, `CC`, `OD` (default: `CURRENT`) |

- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Merchant bank account details linked successfully.",
    "data": {
      "id": "66ce7a901234567890abcdef",
      "shopName": "Vigneswara Supermarket",
      "bankDetails": {
        "accountHolderName": "Ramesh Gupta",
        "accountNumber": "912010045678901",
        "ifscCode": "MAHB0001234",
        "bankName": "Bank of Maharashtra",
        "branchName": "Khamla Nagpur",
        "accountType": "CURRENT"
      },
      "societyAccount": {
        "societyAccountNumber": "912010045678901",
        "ifscCode": "MAHB0001234",
        "accountHolderName": "Ramesh Gupta",
        "bankBranchName": "Khamla Nagpur"
      }
    }
  }
  ```

---

### 5. Update Merchant Profile (Bank Details Editing Blocked)

Updates general merchant profile details (e.g. shop name, owner name, phone, email, documents).
- **Immutability of Bank Details**: Bank details **cannot** be changed or edited via `PUT /:id`. Passing bank details to this endpoint returns a `400 Bad Request` error directing users to use the Link Bank API (`/society-account` or `/link-bank`).

- **HTTP Method**: `PUT`
- **URL**: `http://localhost:5001/api/v1/society/merchants/66ce7a901234567890abcdef`
- **Headers**:
  ```http
  Authorization: Bearer <ACCESS_TOKEN>
  Content-Type: application/json
  ```
- **Body**:
  ```json
  {
    "shopName": "Vigneswara Supermarket & General Store",
    "ownerName": "Ramesh Chandra Gupta"
  }
  ```
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Merchant updated successfully.",
    "data": {
      "id": "66ce7a901234567890abcdef",
      "shopName": "Vigneswara Supermarket & General Store",
      "ownerName": "Ramesh Chandra Gupta"
    }
  }
  ```
- **Error Response (`400 Bad Request` - Attempting Bank Details Edit)**:
  ```json
  {
    "success": false,
    "statusCode": 400,
    "message": "Bank account details cannot be changed or edited via the update API. Please use the dedicated Link Bank API (/society-account or /link-bank) to link or update bank account details."
  }
  ```

---

### 6. Restore Soft-Deleted Merchant (Bank Owner & Manager Only)

Restores a soft-deleted merchant profile and re-activates their linked `User` login account.

- **HTTP Method**: `PATCH` or `PUT`
- **URL**: `http://localhost:5001/api/v1/society/merchants/66ce7a901234567890abcdef/restore`
- **Headers**:
  ```http
  Authorization: Bearer <ACCESS_TOKEN>
  ```
- **Access Control**: **Bank Owner**, **Society Admin**, **Branch Manager**, **Super Admin**
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Merchant profile restored successfully.",
    "data": {
      "id": "66ce7a901234567890abcdef",
      "shopName": "Vigneswara Supermarket",
      "status": "ACTIVE"
    }
  }
  ```

---

### 7. Permanently (Hard) Delete Merchant (Bank Owner & Manager Only)

Permanently removes the `MerchantProfile` document and linked `User` login account from MongoDB.

- **HTTP Method**: `DELETE`
- **URL**: `http://localhost:5001/api/v1/society/merchants/66ce7a901234567890abcdef/permanent`
- **Headers**:
  ```http
  Authorization: Bearer <ACCESS_TOKEN>
  ```
- **Access Control**: **Bank Owner**, **Society Admin**, **Branch Manager**, **Super Admin**
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Merchant permanently deleted successfully.",
    "data": {
      "id": "66ce7a901234567890abcdef",
      "message": "Merchant permanently deleted successfully."
    }
  }
  ```

---

### 8. Soft Delete Merchant Partner (Bank Owner & Manager Only)

Soft deletes a merchant partner profile (`isDeleted: true`) and deactivates their user login credentials.

- **HTTP Method**: `DELETE`
- **URL**: `http://localhost:5001/api/v1/society/merchants/66ce7a901234567890abcdef`
- **Headers**:
  ```http
  Authorization: Bearer <ACCESS_TOKEN>
  ```
- **Access Control**: **Bank Owner**, **Society Admin**, **Branch Manager**, **Super Admin**
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Merchant soft-deleted successfully.",
    "data": {
      "id": "66ce7a901234567890abcdef",
      "message": "Merchant soft-deleted successfully."
    }
  }
  ```

---

### 9. Approve Merchant Onboarding (Branch Manager / Bank Owner / Quality Check)

Approves an onboarded merchant lead submitted by a Loan Executive.
- **Mandatory Pre-Condition Check**: A valid society bank account **must exist** (`societyAccount.societyAccountNumber` or `SocietyCustomerLink.societyAccountNumber`) before approval. If no society account exists, returns `400 Bad Request`.
- **Approval Execution**: Updates `approvalStatus` to `APPROVED`, sets profile `status` to `ACTIVE`, populates `approvedAt` and `approvedBy`, updates `societyAccount` on merchant document, and enables the linked `User` account (`isApproved: true`, `status: ACTIVE`) so the merchant can login.
- **Branch Scoping**: Restricted to merchants belonging to the logged-in user's authorized branch (Bank Owners can approve across all branches).

- **HTTP Method**: `POST`, `PUT`, or `PATCH`
- **URL**: `http://localhost:5001/api/v1/society/merchants/66ce7a901234567890abcdef/approve` (or `http://localhost:5001/api/v1/society/merchants/approve` with `{"merchantId": "66ce7a901234567890abcdef"}` in body)
- **Headers**:
  ```http
  Authorization: Bearer <ACCESS_TOKEN>
  Content-Type: application/json
  ```
- **Access Control**: **Branch Manager**, **Bank Owner**, **Society Admin**, **Quality Check (QC)**, **Super Admin**
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Merchant \"Vigneswara Supermarket\" has been approved successfully. Merchant can now login.",
    "data": {
      "message": "Merchant \"Vigneswara Supermarket\" has been approved successfully. Merchant can now login.",
      "merchant": {
        "id": "66ce7a901234567890abcdef",
        "merchantId": "66ce7a901234567890abcdef",
        "merchantCode": "MER-197391",
        "code": "MER-197391",
        "shopName": "Vigneswara Supermarket",
        "ownerName": "Ramesh Gupta",
        "phoneNumber": "9823011223",
        "email": "vigneswara@gmail.com",
        "bankDetails": {
          "accountHolderName": "Ramesh Gupta",
          "accountNumber": "912010045678901",
          "ifscCode": "MAHB0001234",
          "bankName": "Bank of Maharashtra",
          "branchName": "Khamla Nagpur",
          "accountType": "CURRENT"
        },
        "societyAccount": {
          "societyAccountNumber": "912010045678901",
          "ifscCode": "MAHB0001234",
          "accountHolderName": "Ramesh Gupta",
          "bankBranchName": "Khamla Nagpur"
        },
        "approvalStatus": "APPROVED",
        "status": "ACTIVE",
        "bankId": "6a7c15cf266474a6d606d2f0",
        "branchId": "64bc7a2f1c8e1a1234567892",
        "branchName": "Khamla Branch",
        "approvedAt": "2026-09-05T12:15:00.000Z"
      }
    }
  }
  ```
- **Error Response (`400 Bad Request` - Unlinked Society Account)**:
  ```json
  {
    "success": false,
    "statusCode": 400,
    "message": "Cannot approve Merchant [MER-197391]: Merchant society account number is missing or does not exist. Please add society account details first before approval."
  }
  ```

---

### 10. Reject Merchant Onboarding (Branch Manager / Bank Owner / Quality Check)

Rejects an onboarded merchant lead submitted by a Loan Executive.
- **Mandatory Requirement**: `reason` field in request payload is **mandatory**. Rejection requests without a reason will return `400 Bad Request`.
- **Rejection Execution**: Updates `approvalStatus` to `REJECTED`, sets profile `status` to `INACTIVE`, records `rejectionReason`, `rejectedAt`, and `rejectedBy`, and updates the linked `User` account (`isApproved: false`, `status: REJECTED`).
- **Branch Scoping**: Restricted to merchants belonging to the logged-in user's authorized branch (Bank Owners can reject across all branches).

- **HTTP Method**: `POST`, `PUT`, or `PATCH`
- **URL**: `http://localhost:5001/api/v1/society/merchants/66ce7a901234567890abcdef/reject` (or `http://localhost:5001/api/v1/society/merchants/reject`)
- **Headers**:
  ```http
  Authorization: Bearer <ACCESS_TOKEN>
  Content-Type: application/json
  ```
- **Request Body**:
  ```json
  {
    "merchantId": "66ce7a901234567890abcdef",
    "reason": "Incomplete business proof verification."
  }
  ```
  | Field | Type | Required | Description |
  | :--- | :--- | :--- | :--- |
  | `merchantId` | string | Optional (if in URL parameter) | Merchant MongoDB Object ID |
  | `reason` | string | **Yes** | Reason for rejecting the merchant onboarding application |

- **Access Control**: **Branch Manager**, **Bank Owner**, **Society Admin**, **Quality Check (QC)**, **Super Admin**
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Merchant onboarding for \"Vigneswara Supermarket\" has been rejected.",
    "data": {
      "message": "Merchant onboarding for \"Vigneswara Supermarket\" has been rejected.",
      "merchant": {
        "id": "66ce7a901234567890abcdef",
        "merchantId": "66ce7a901234567890abcdef",
        "shopName": "Vigneswara Supermarket",
        "approvalStatus": "REJECTED",
        "status": "INACTIVE",
        "rejectionReason": "Incomplete business proof verification.",
        "rejectedAt": "2026-09-05T12:16:00.000Z"
      }
    }
  }
  ```
- **Error Response (`400 Bad Request` - Missing Rejection Reason)**:
  ```json
  {
    "success": false,
    "statusCode": 400,
    "message": "Rejection reason (reason) is required to reject Merchant application."
  }
  ```
