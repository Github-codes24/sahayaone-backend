# Merchant Panel: Complete API Documentation

Complete REST API documentation for the **Merchant Panel** of the Sahayaone Platform. Covers authentication, headers, endpoints, request schemas, response JSONs, and error codes.

---

## Table of Contents

1. [Authentication & Request Headers](#1-authentication--request-headers)
2. [Verification Credit Request APIs](#2-verification-credit-request-apis)
3. [DigiLocker KYC Verification APIs](#3-digilocker-kyc-verification-apis)
4. [Experian CIBIL Score APIs](#4-experian-cibil-score-apis)
5. [Society Panel Approval APIs (Bank/Society View)](#5-society-panel-approval-apis-banksociety-view)
6. [Error Handling & Response Codes](#6-error-handling--response-codes)

---

## 1. Authentication & Request Headers

- **Base Gateway URL**: `/api/v1`
- **Request Headers**:
  ```http
  Authorization: Bearer <JWT_ACCESS_TOKEN>
  Content-Type: application/json
  ```
- **Allowed Roles**: `MERCHANT`, `VENDOR`
- **Tenant Context**: Context is resolved automatically from the logged-in user's profile (`merchantId`, `bankId`, `branchId`).

---

## 2. Verification Credit Request & Balance APIs

**Base Path**: `/api/v1/merchant/verification-credits`

### 2.1 Get Available Verification Credit Balance
- **Method**: `GET`
- **Path**: `/` or `/balance` or `/available` (e.g. `GET /api/v1/merchant/verification-credits`)
- **Description**: Returns the merchant's current available verification credits balance, total credits, used credits, and linked branch/bank details.
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Merchant available verification credit balance retrieved successfully.",
    "data": {
      "availableVerificationCredits": 45,
      "totalVerificationCredits": 50,
      "usedVerificationCredits": 5,
      "merchant": {
        "id": "66e123456789abcdef000999",
        "shopName": "Rahul Electronics",
        "merchantName": "Rahul Sharma"
      },
      "branch": {
        "id": "66e456789012abcdef000333",
        "name": "Central Branch",
        "code": "BR001"
      },
      "bank": {
        "id": "66e987654321fedcba000222",
        "name": "Sahayaone Co-op Bank",
        "code": "BANK01"
      }
    }
  }
  ```

### 2.2 Submit Verification Credit Request
- **Method**: `POST`
- **Path**: `/request`
- **Description**: Submits a request for verification credits to the merchant's associated Bank/Society.
- **Request Body**:
  ```json
  {
    "creditQuantity": 50,
    "notes": "Requesting verification credit quota for festival season onboarding."
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "success": true,
    "message": "Verification credit request submitted successfully to associated Bank.",
    "data": {
      "requestId": "66e123456789abcdef000111",
      "bankId": "66e987654321fedcba000222",
      "branchId": "66e456789012abcdef000333",
      "creditQuantity": 50,
      "status": "PENDING",
      "createdAt": "2026-09-11T11:55:00.000Z"
    }
  }
  ```

---

### 2.2 Get Merchant Credit Request History
- **Method**: `GET`
- **Path**: `/requests` (also available via `/request-history`)
- **Query Parameters**:
  - `page` (number, default `1`)
  - `limit` (number, default `10`)
  - `status` (string, optional: `PENDING`, `APPROVED`, `REJECTED`)
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Credit request history retrieved successfully.",
    "data": [
      {
        "id": "66e123456789abcdef000111",
        "creditQuantity": 50,
        "status": "APPROVED",
        "approvedQuantity": 50,
        "responseRemarks": "Approved full allocation.",
        "createdAt": "2026-09-11T11:55:00.000Z"
      }
    ],
    "meta": {
      "totalRecords": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
  ```

---

## 3. DigiLocker KYC Verification APIs

**Base Path**: `/api/v1/merchant/kyc-verification`

### 3.1 Initiate DigiLocker Session
- **Method**: `POST`
- **Path**: `/initiate`
- **Description**: Initiates DigiLocker OAuth session. Validates `branch.availableVerificationCredits > 0`.
- **Request Body**:
  ```json
  {
    "documentType": "AADHAAR",
    "idNumber": "123456789012",
    "redirectUrl": "https://merchant.example.com/kyc-callback",
    "consent": true
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "success": true,
    "message": "DigiLocker KYC session initiated successfully.",
    "data": {
      "refid": "KYC_M_1757572800000_1234",
      "authorizationUrl": "https://digilocker.meritverify.com/oauth/authorize?...",
      "status": "INITIATED"
    }
  }
  ```

---

### 3.2 Complete Verification & Deduct Credit
- **Method**: `POST`
- **Path**: `/complete`
- **Description**: Completes DigiLocker verification, parses identity XML, and **deducts 1 credit from assigned Branch**.
- **Request Body**:
  ```json
  {
    "refid": "KYC_M_1757572800000_1234"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "DigiLocker KYC verification completed successfully.",
    "data": {
      "refid": "KYC_M_1757572800000_1234",
      "documentType": "AADHAAR",
      "status": "VERIFIED",
      "personalDetails": {
        "fullName": "Rahul Sharma",
        "gender": "M",
        "dob": "1992-05-15",
        "address": "123 Green Park, Mumbai",
        "aadhaarVerified": true,
        "panVerified": false
      },
      "verifiedAt": "2026-09-11T11:50:00.000Z",
      "creditDeducted": 1
    }
  }
  ```

---

### 3.3 Get KYC Verification History
- **Method**: `GET`
- **Path**: `/history`
- **Query Parameters**: `page`, `limit`, `documentType`, `status`, `search`
- **Response** (`200 OK`): Paginated history of DigiLocker verifications.

---

### 3.4 Get Report Detail by Ref ID
- **Method**: `GET`
- **Path**: `/report/:refid`
- **Response** (`200 OK`): Detailed JSON record for specified `refid`.

---

### 3.5 Download KYC Report PDF
- **Method**: `GET`
- **Path**: `/report/:refid/download-pdf/:documentType`
- **Parameters**: `:documentType` = `AADHAAR` or `PAN`
- **Response**: Binary PDF Stream (`application/pdf`).

---

## 4. Experian CIBIL Score APIs

**Base Path**: `/api/v1/merchant/cibil-score`

### 4.1 Check Customer CIBIL Score
- **Method**: `POST`
- **Path**: `/`
- **Description**: Generates customer CIBIL score report via Experian API. Uses 30-day cache rule. For fresh queries, **deducts 1 credit from assigned Branch**.
- **Request Body**:
  ```json
  {
    "fullName": "Rahul Sharma",
    "dob": "1992-05-15",
    "pan": "ABCDE1234F",
    "mobileNumber": "9876543210"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Credit report fetched successfully.",
    "data": {
      "requestId": "CR_1757572800000_5678",
      "status": "completed",
      "pdfUrl": "https://storage.example.com/cibil-reports/cibil-report-123.pdf",
      "reportJson": {
        "score": 765,
        "summary": { "totalAccounts": 4, "activeAccounts": 2 }
      },
      "creditDeducted": 1
    }
  }
  ```

---

### 4.2 Get CIBIL History List
- **Method**: `GET`
- **Path**: `/`
- **Query Parameters**: `page`, `limit`, `status`, `search`

---

### 4.3 Get CIBIL Report Detail by ID
- **Method**: `GET`
- **Path**: `/:id`
- **Response** (`200 OK`): Detailed report record and PDF URL.

---

## 5. Society Panel Approval APIs (Bank/Society View)

**Base Path**: `/api/v1/society/cards-credit`

### 5.1 List Merchant Requests (Bank Owner & All-Branch View)
- **Method**: `GET`
- **Path**: `/merchant-requests`
- **Description**: Allows Bank Owners, Society Admins, and Super Admins to view merchant credit requests across all branches under their Bank/Society.
- **Query Parameters**:
  - `branchId` (string, optional: specific Branch ID or `ALL` for all branches under Bank)
  - `bankId` (string, optional: specific Bank ID or `ALL` for all banks)
  - `startDate` (string, optional e.g. `2026-09-01`)
  - `endDate` (string, optional e.g. `2026-09-30`)
  - `status` (string, optional: `PENDING`, `APPROVED`, `REJECTED`, `ALL`)
  - `search` (string, optional: search by shop name, merchant name, branch code, or request ID)
  - `page` (number, default `1`)
  - `limit` (number, default `10`)
  - `sortBy` (string, default `createdAt`)
  - `sortOrder` (string, default `desc`)

---

### 5.2 Approve or Reject Merchant Request
- **Method**: `PATCH`
- **Path**: `/merchant-requests/:id/status`
- **Description**: Approving transfers `approvedQuantity` credits from Bank wallet balance to the Merchant's assigned `Branch` balance.
- **Request Body (Approve)**:
  ```json
  {
    "status": "APPROVED",
    "approvedQuantity": 50,
    "responseRemarks": "Approved full request."
  }
  ```
- **Request Body (Reject)**:
  ```json
  {
    "status": "REJECTED",
    "responseRemarks": "Quota exhausted for this period."
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Merchant credit request approved successfully.",
    "data": {
      "requestId": "66e123456789abcdef000111",
      "status": "APPROVED",
      "approvedQuantity": 50,
      "approvedAt": "2026-09-11T11:58:00.000Z",
      "responseRemarks": "Approved full request.",
      "branchNewBalance": 50
    }
  }
  ```

---

## 6. Error Handling & Response Codes

### Standard Error Schema

```json
{
  "success": false,
  "message": "No verification credits available in assigned branch. Please request credits from associated Bank/Society.",
  "errorCode": "BAD_REQUEST",
  "data": null
}
```

### HTTP Response Codes Matrix

| HTTP Status | Error Scenario |
| :--- | :--- |
| `400 Bad Request` | Branch verification credits exhausted, validation error |
| `401 Unauthorized` | Missing or invalid JWT access token |
| `403 Forbidden` | Role not authorized (`MERCHANT` or `VENDOR` required) |
| `404 Not Found` | Requested report or session refid not found |
| `500 Internal Error` | Provider API gateway failure or database exception |
