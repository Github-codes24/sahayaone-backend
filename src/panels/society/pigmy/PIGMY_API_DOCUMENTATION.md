# Society Panel Pigmy Deposit Management V2 - API Documentation

This document provides complete API specifications, required permissions, request body payloads, headers, query parameters, and response schemas for the **Society Panel Pigmy Deposit Management V2** endpoints located in `src/panels/society/pigmy/`.

---

## 1. Overview & Authentication Rules

### Authentication & Tenant Isolation
- **Authentication**: All endpoints require a valid JWT bearer token passed in the `Authorization` header (`Bearer <TOKEN>`).
- **Context Resolution**: The backend automatically resolves the user's isolated bank context (`bankId`), assigned branch (`branchId`), user role (`role`), and permissions via `resolveSocietyContext` middleware. Client-supplied bank and branch query overrides are strictly validated.
- **Base Endpoint Paths**:
  - `/api/v1/society/pigmy-customers`
  - `/api/v1/society/pigmy`

### Authorized Roles
Access is strictly restricted to the following authorized roles:
1. **Bank Owner / Society Admin**: `BANK_OWNER`, `BANK_ADMIN`, `SOCIETY_ADMIN`, `OWNER`, `SUPER_ADMIN`, `ADMIN`, `CHAIRMAN`
2. **Branch Manager**: `BRANCH_MANAGER`, `MANAGER`
3. **Branch QC Employee**: `QC_EMPLOYEE`, `QC_OFFICER`, `QUALITY_CHECK`, `QUALITY_CHECKER`, `EMPLOYEE`, `BRANCH_STAFF`

### Branch Data Isolation Rules
- **Branch-Bound Users (Branch Manager & Branch QC Employee)**: Automatically scoped to their assigned `branchId`. They can only view, modify, or approve Pigmy customer applications belonging to their branch.
- **Bank Owner / Society Admin**: Access is scoped to the bank (`bankId`). Bank Owners can view across all branches in their bank or filter by a specific `branchId`.

---

## 2. Core Business Rules

### 1. Bank Account vs Society Account Separation
- **Society Account (Credit Destination - Internal Cooperative Bank Account)**:
  Customer's internal account within the cooperative society/bank (e.g. `ACC-SB-998811`, Pune Cooperative Bank). Pigmy daily deposits are CREDITED (accumulated) into this Society Account.
- **Commercial Bank Account (Debit Source - External Commercial Bank)**:
  Customer's external bank account (e.g. HDFC Bank, State Bank of India) from where daily installments will be DEBITED via e-NACH auto-debit mandate.

### 2. Pre-Approval Society Account Validation
Before approving a Pigmy Deposit Customer (`POST /:id/approve`), the backend performs a mandatory check for the existence of the customer's society account number (`existingSavingsAccountNumber`, `societyAccount.societyAccountNumber`, or `SocietyCustomerLink.societyAccountNumber`).
- **If Society Account Exists**: Approval proceeds successfully, activating status (`ACTIVE`), mandate (`ACTIVE`), tenure dates (`startDate` and `endDate`), and generating agreement PDFs.
- **If Society Account Missing**: Approval is blocked with `400 Bad Request` requiring the user to add society account details first.

### 3. Tenure Start & End Activation
Pigmy deposit calculation and tenure officially start from the timestamp of Branch Manager / QC approval (`approvedAt`):
- `startDate` = `approvedAt`
- `endDate` = `approvedAt + tenureMonths` (e.g. exactly 1, 3, 6, or 12 months from approval date)
- `mandateStatus` = `ACTIVE`

---

## 3. API Specifications

### [API 1] List Pigmy Customer Leads
Retrieves a paginated list of Pigmy Deposit customer leads scoped by the user's bank and branch context.

- **Method**: `GET`
- **URL**: `/api/v1/society/pigmy-customers` or `/api/v1/society/pigmy`
- **Headers**:
  - `Authorization: Bearer <TOKEN>`
- **Query Parameters**:
  | Parameter | Type | Default | Description |
  |---|---|---|---|
  | `page` | Integer | `1` | Page number |
  | `limit` | Integer | `10` | Records per page (max 100) |
  | `search` | String | `""` | Search across full name, phone number, pigmy code, account number, shop name, PAN, Aadhaar |
  | `customerType` | String | `ALL` | Filter by `INDIVIDUAL`, `MERCHANT`, or `ALL` |
  | `savingsAccountOption` | String | `ALL` | Filter by `EXISTING`, `CREATE_NEW`, or `ALL` |
  | `approvalStatus` | String | `ALL` | Filter by `PENDING_BRANCH_APPROVAL`, `APPROVED`, `REJECTED`, or `ALL` |
  | `status` | String | `ALL` | Filter by `ACTIVE`, `INACTIVE`, `BLOCKED`, or `ALL` |
  | `branchId` | String | `null` | Branch MongoDB ID (Bank Owners only) |
  | `fromDate` | String | `null` | Start date filter (`YYYY-MM-DD`) |
  | `toDate` | String | `null` | End date filter (`YYYY-MM-DD`) |
  | `sortBy` | String | `createdAt` | Field to sort by |
  | `sortOrder` | String | `desc` | `asc` or `desc` |

- **Response Sample**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Pigmy customer leads list retrieved successfully.",
  "data": [
    {
      "id": "6a9d3de4bbe97987b9c9ceca",
      "pigmyCustomerId": "6a9d3de4bbe97987b9c9ceca",
      "pigmyCustomerCode": "PIG-508462",
      "accountNumber": "PIGACC-892727508",
      "userId": "6a9ab9bb7282d1d9974dd672",
      "bankId": "6a7c15cf266474a6d606d2f0",
      "bankName": "Pune Cooperative Bank",
      "branchId": "6a7c34898aec45570868df7a",
      "branchName": "Pune Main Branch",
      "customerType": "MERCHANT",
      "isMerchant": true,
      "fullName": "Sunil Verma",
      "primaryPhoneNumber": "9876543210",
      "secondaryPhoneNumber": "9822001122",
      "email": "sunil.verma@gmail.com",
      "societyAccount": {
        "societyAccountNumber": "ACC-SB-998811",
        "ifscCode": "PUNB0123400",
        "accountHolderName": "Sunil Verma",
        "bankBranchName": "Pune Main Branch"
      },
      "bankAccountDetails": {
        "accountHolderName": "Sunil Verma",
        "accountNumber": "00112233445566",
        "ifscCode": "HDFC0000123",
        "bankName": "HDFC Bank",
        "accountType": "SAVINGS"
      },
      "mandateDetails": {
        "mandateId": "MAND-PIG-508462",
        "mandateStatus": "ACTIVE",
        "autoDebitAmount": 1500,
        "autoDebitFrequency": "DAILY"
      },
      "scheme": {
        "id": "6a9904a0d08232152a955651",
        "code": "DAILY004",
        "name": "Daily Savings plan",
        "interestRate": 8,
        "tenureMonths": 6,
        "dailyDepositAmount": 1500,
        "maturityAmount": 280800
      },
      "approvalStatus": "APPROVED",
      "status": "ACTIVE",
      "startDate": "2026-09-06T14:00:00.000Z",
      "endDate": "2027-03-06T14:00:00.000Z",
      "productType": "PIGMY",
      "createdAt": "2026-09-06T10:18:12.739Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  },
  "stats": {
    "total": 45,
    "individual": 30,
    "merchant": 15,
    "pending": 5,
    "approved": 38,
    "rejected": 2
  }
}
```

---

### [API 2] View Single Pigmy Customer Details
Fetches full details for a single Pigmy customer by MongoDB ID, Pigmy Customer Code, Account Number, or Phone Number.

- **Method**: `GET`
- **URL**: `/api/v1/society/pigmy-customers/:id` or `/api/v1/society/pigmy/:id`
- **Headers**:
  - `Authorization: Bearer <TOKEN>`
- **Path Parameter**:
  - `id`: Pigmy customer MongoDB ID, Pigmy Code (`PIG-XXXXXX`), Account Number (`PIGACC-XXXXXX`), or Phone Number.

- **Response Sample**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Pigmy customer details retrieved successfully.",
  "data": {
    "id": "6a9d3de4bbe97987b9c9ceca",
    "pigmyCustomerId": "6a9d3de4bbe97987b9c9ceca",
    "pigmyCustomerCode": "PIG-508462",
    "accountNumber": "PIGACC-892727508",
    "userId": "6a9ab9bb7282d1d9974dd672",
    "bankId": "6a7c15cf266474a6d606d2f0",
    "bankName": "Pune Cooperative Bank",
    "branchId": "6a7c34898aec45570868df7a",
    "branchName": "Pune Main Branch",
    "customerType": "MERCHANT",
    "isMerchant": true,
    "fullName": "Sunil Verma",
    "ownerName": "Sunil Verma",
    "primaryPhoneNumber": "9876543210",
    "phoneNumber": "9876543210",
    "secondaryPhoneNumber": "9822001122",
    "email": "sunil.verma@gmail.com",
    "dob": "1990-08-20",
    "gender": "MALE",
    "address": "Flat 402, Shivajinagar, Pune",
    "residenceAddress": "Flat 402, Shivajinagar, Pune",
    "aadhaarNumber": "800289977383",
    "panNumber": "DEEPA2450D",
    "shopName": "Rajesh Kirana & General Store",
    "shopAddress": "Shop 12, Market Yard, Pune",
    "businessProofType": "GST",
    "businessProofNumber": "27RAJES1234K1Z5",
    "gstinNumber": "27RAJES1234K1Z5",
    "savingsAccountOption": "EXISTING",
    "hasSavingsAccount": true,
    "existingSavingsAccountNumber": "ACC-SB-998811",
    "newSavingsAccountRequested": false,
    "societyAccount": {
      "societyAccountNumber": "ACC-SB-998811",
      "ifscCode": "PUNB0123400",
      "accountHolderName": "Sunil Verma",
      "bankBranchName": "Pune Main Branch"
    },
    "bankAccountDetails": {
      "accountHolderName": "Sunil Verma",
      "accountNumber": "00112233445566",
      "ifscCode": "HDFC0000123",
      "bankName": "HDFC Bank",
      "branchName": "N/A",
      "accountType": "SAVINGS"
    },
    "mandateDetails": {
      "mandateId": "MAND-PIG-508462",
      "mandateStatus": "ACTIVE",
      "autoDebitAmount": 1500,
      "autoDebitFrequency": "DAILY",
      "mandateStartDate": "2026-09-06T14:00:00.000Z",
      "mandateEndDate": "2027-03-06T14:00:00.000Z"
    },
    "scheme": {
      "id": "6a9904a0d08232152a955651",
      "code": "DAILY004",
      "name": "Daily Savings plan",
      "interestRate": 8,
      "tenureMonths": 6,
      "isCustomAmount": false,
      "dailyDepositAmount": 1500,
      "maturityAmount": 280800
    },
    "documents": {
      "ownerAadhaar": "https://s3-noi.aces3.ai/sahayaone/customers/aadhaar.jpg",
      "ownerPan": "https://s3-noi.aces3.ai/sahayaone/customers/pan.jpg",
      "profilePhoto": "https://s3-noi.aces3.ai/sahayaone/customers/profile.jpg",
      "shopPhoto": "https://s3-noi.aces3.ai/sahayaone/pigmy/shop.jpg",
      "businessProof": "https://s3-noi.aces3.ai/sahayaone/pigmy/gst.jpg"
    },
    "agreements": {
      "requiredPdfCount": 1,
      "pigmyAgreementPdfUrl": "https://s3-noi.aces3.ai/sahayaone/agreements/PIGMY-AGREEMENT-PIG-508462.pdf",
      "pigmyAgreementDocId": "DOC-PIG-PIG-508462",
      "pigmyAgreementStatus": "GENERATED",
      "savingsAccountPdfUrl": null,
      "savingsAccountDocId": null,
      "savingsAccountStatus": "NOT_APPLICABLE"
    },
    "approvalStatus": "APPROVED",
    "status": "ACTIVE",
    "approvedAt": "2026-09-06T14:00:00.000Z",
    "onboardedBy": {
      "id": "6a91593e7405a7f29065ee0e",
      "userId": "6a91593e7405a7f29065ee0e",
      "name": "Executive Name",
      "phone": "8665686876",
      "role": "LOAN_EXECUTIVE"
    },
    "productType": "PIGMY",
    "createdAt": "2026-09-06T10:18:12.739Z",
    "updatedAt": "2026-09-06T14:00:00.000Z"
  }
}
```

---

### [API 3] Add / Link Society Bank Account Details
Adds or updates the customer's internal society account number (`societyAccountNumber`), IFSC code, account holder name, and branch details.

- **Method**: `POST`
- **URL**: `/api/v1/society/pigmy-customers/:id/society-account` or `/api/v1/society/pigmy-customers/society-account`
- **Headers**:
  - `Authorization: Bearer <TOKEN>`
  - `Content-Type: application/json`
- **Request Payload**:
```json
{
  "pigmyCustomerId": "6a9d3de4bbe97987b9c9ceca",
  "societyAccountNumber": "ACC-SB-998811",
  "ifscCode": "PUNB0123400",
  "accountHolderName": "Sunil Verma",
  "bankBranchName": "Pune Main Branch",
  "pincode": "411001"
}
```
- **Payload Fields**:
  | Field Name | Type | Requirement | Description |
  |---|---|---|---|
  | `pigmyCustomerId` | String | Optional | Target Pigmy Customer MongoDB ID (if not in URL parameter) |
  | `societyAccountNumber` | String | **Mandatory** | Internal society savings/pigmy account number |
  | `ifscCode` | String | Optional | Cooperative Bank IFSC code |
  | `accountHolderName` | String | Optional | Name of account holder |
  | `bankBranchName` | String | Optional | Branch name |
  | `pincode` | String | Optional | Residential pincode |

- **Response Sample**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Society bank account details added successfully.",
  "data": {
    "id": "6a9d3de4bbe97987b9c9ceca",
    "pigmyCustomerId": "6a9d3de4bbe97987b9c9ceca",
    "pigmyCustomerCode": "PIG-508462",
    "societyAccount": {
      "societyAccountNumber": "ACC-SB-998811",
      "ifscCode": "PUNB0123400",
      "accountHolderName": "Sunil Verma",
      "bankBranchName": "Pune Main Branch"
    },
    "existingSavingsAccountNumber": "ACC-SB-998811",
    "hasSavingsAccount": true,
    "savingsAccountOption": "EXISTING"
  }
}
```

---

### [API 4] Branch Manager / QC Employee Approval (With Account Check)
Approves the Pigmy deposit application, activates deposit tenure, sets `mandateStatus = "ACTIVE"`, and generates agreement PDF links.

- **Method**: `POST`
- **URL**: `/api/v1/society/pigmy-customers/:id/approve` or `/api/v1/society/pigmy/:id/approve`
- **Headers**:
  - `Authorization: Bearer <TOKEN>`
  - `Content-Type: application/json`
- **Request Payload**:
```json
{
  "remarks": "All KYC documents verified. Customer society account linked."
}
```

- **Error Response (Society Account Missing)**:
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Cannot approve Pigmy Customer [PIG-508462]: Customer society account number is missing or does not exist. Please add society account details first before approval."
}
```

- **Success Response**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Pigmy Deposit Account [PIG-508462] approved successfully. Deposit tenure and auto-debit collection activated.",
  "data": {
    "id": "6a9d3de4bbe97987b9c9ceca",
    "pigmyCustomerCode": "PIG-508462",
    "code": "PIG-508462",
    "approvalStatus": "APPROVED",
    "status": "ACTIVE",
    "approvedAt": "2026-09-06T17:55:54.673Z",
    "startDate": "2026-09-06T17:55:54.673Z",
    "endDate": "2027-03-06T17:55:54.673Z",
    "societyAccount": {
      "societyAccountNumber": "ACC-SB-998811",
      "ifscCode": "PUNB0123400",
      "accountHolderName": "Sunil Verma",
      "bankBranchName": "Pune Main Branch"
    },
    "mandateDetails": {
      "mandateId": "MAND-PIG-508462",
      "mandateStatus": "ACTIVE",
      "autoDebitAmount": 1500,
      "autoDebitFrequency": "DAILY",
      "mandateStartDate": "2026-09-06T17:55:54.673Z",
      "mandateEndDate": "2027-03-06T17:55:54.673Z"
    },
    "agreements": {
      "requiredPdfCount": 1,
      "pigmyAgreementPdfUrl": "https://s3-noi.aces3.ai/sahayaone/agreements/PIGMY-AGREEMENT-PIG-508462.pdf",
      "pigmyAgreementDocId": "DOC-PIG-PIG-508462",
      "pigmyAgreementStatus": "GENERATED"
    }
  }
}
```

---

### [API 5] Branch Manager / QC Employee Rejection
Rejects a Pigmy deposit application and sets status to `INACTIVE`.

- **Method**: `POST`
- **URL**: `/api/v1/society/pigmy-customers/:id/reject` or `/api/v1/society/pigmy/:id/reject`
- **Headers**:
  - `Authorization: Bearer <TOKEN>`
  - `Content-Type: application/json`
- **Request Payload** (**Mandatory Field**: `reason`):
```json
{
  "reason": "Address proof mismatch."
}
```

- **Error Response (If Rejection Reason Missing)**:
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Rejection reason (reason) is required to reject Pigmy Customer application."
}
```

- **Success Response**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Pigmy Deposit Account [PIG-508462] rejected successfully.",
  "data": {
    "id": "6a9d3de4bbe97987b9c9ceca",
    "pigmyCustomerCode": "PIG-508462",
    "approvalStatus": "REJECTED",
    "status": "INACTIVE",
    "rejectionReason": "Address proof mismatch.",
    "rejectedAt": "2026-09-06T18:00:00.000Z"
  }
}
```
