# Co-operative Bank Management API Documentation

This module manages the lifecycle, onboarding, credit allocation, document uploads, pricing calculations, status approvals, and password management for **Co-operative Banks** within the Super Admin panel.

---

## 🚀 Base URL
```
http://localhost:5000/api/v1/super-admin/co-operative-bank
```

---

## 🔐 Authentication & RBAC Permissions
All management routes require a valid Bearer JWT token in the `Authorization` header:
`Authorization: Bearer <token>`

Required Roles: `SUPER_ADMIN`, `SUB_ADMIN`, `HO_ADMIN`, `EMPLOYEE`

Permissions:
- View Banks: `co_operative_bank:view_only`
- Create Bank: `co_operative_bank:create`
- Edit / Update / Status / Credit / Change Password: `co_operative_bank:edit`
- Delete Bank: `co_operative_bank:delete`

---

## 🛠 Summary of Endpoints

| Method | Endpoint | Description | Permission Required |
|---|---|---|---|
| `GET` | `/` | List Co-operative Banks (with pagination, search, status filter) | `co_operative_bank:view_only` |
| `GET` | `/:id` | Get details of a single Co-operative Bank by ID | `co_operative_bank:view_only` |
| `GET` | `/dropdown` | List active banks for dropdown selections | `co_operative_bank:view_only` |
| `POST` | `/` | Create a new Co-operative Bank (supports multipart document uploads) | `co_operative_bank:create` |
| `PUT` / `PATCH` | `/:id` | **Update existing Co-operative Bank details** (supports multipart uploads) | `co_operative_bank:edit` |
| `PATCH` | `/:id/change-password`<br>`PATCH /change-password` | **Change Password for Co-operative Bank Account** *(PATCH method only)* | `co_operative_bank:edit` |
| `PATCH` | `/:id/status` | Update bank onboarding status (`APPROVED`, `REJECTED`, `ACTIVE`, etc.) | `co_operative_bank:edit` |
| `POST` / `PUT` | `/:id/add-credit` | Add EMI Card or Verification Credits to Bank | `co_operative_bank:edit` |
| `POST` | `/verify-cash-otp` | Verify 6-digit Cash Payment OTP sent via MSG91 | Auth Required |
| `POST` | `/resend-cash-otp` | Resend Cash Payment OTP via MSG91 | Auth Required |
| `POST` | `/verify-online-payment` | Verify Razorpay online onboarding payment | Auth Required |
| `POST` | `/payment-webhook` | Public Razorpay webhook endpoint for automated approval | Public / Signature Verified |
| `POST` | `/calculate-emi-card-price` | Calculate dynamic total price for EMI Card quantity | Auth Required |
| `POST` | `/calculate-verification-credit-price` | Calculate dynamic total price for Verification Credits | Auth Required |
| `POST` | `/calculate-price` | Calculate combined total price (EMI + Verification Credits + GST) | Auth Required |
| `DELETE` | `/:id` | Soft delete a Co-operative Bank | `co_operative_bank:delete` |

---

## 📌 Endpoint Details & Payloads

---

### 1. 🔑 Change Co-operative Bank Password (PATCH Only)

Update the password of a Co-operative Bank account and its linked User login credentials.

- **Method**: `PATCH`
- **Endpoint**: `/api/v1/super-admin/co-operative-bank/:id/change-password` or `/api/v1/super-admin/co-operative-bank/change-password`
- **Headers**: `Content-Type: application/json`, `Authorization: Bearer <TOKEN>`
- **Permission**: `co_operative_bank:edit`

#### Request Body
```json
{
  "newPassword": "NewSecurePassword@123",
  "confirmPassword": "NewSecurePassword@123"
}
```
*Alternatively, `password` field can be sent in place of `newPassword`.*

#### Sample Success Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": "66c0e8a71234567890abcdef",
    "bankId": "66c0e8a71234567890abcdef",
    "bankName": "Urban Co-operative Bank",
    "name": "Urban Co-operative Bank",
    "email": "contact@urbancobank.com",
    "message": "Co-operative Bank password changed successfully."
  },
  "message": "Co-operative Bank password changed successfully."
}
```

#### Error Responses
- **`400 Bad Request`**: Password length less than 6 characters or `newPassword` and `confirmPassword` do not match.
- **`404 Not Found`**: Bank with the given ID does not exist.

---

### 2. ✏️ Update Existing Co-operative Bank

Update general details, contact info, pricing breakdown, features, or re-upload bank documents.

- **Method**: `PUT` or `PATCH`
- **Endpoint**: `/api/v1/super-admin/co-operative-bank/:id`
- **Headers**: `Content-Type: multipart/form-data` or `application/json`, `Authorization: Bearer <TOKEN>`
- **Permission**: `co_operative_bank:edit`

#### Supported Form Fields / Body Payload
```json
{
  "bankName": "Urban Co-operative Bank Ltd",
  "authorizedPerson": "Rajesh Sharma",
  "email": "admin@urbancobank.com",
  "phoneNumber": "9876543210",
  "code": "UCBANK",
  "newPassword": "UpdatedPassword@123",
  "accountBankName": "HDFC Bank",
  "accountNumber": "987654321098",
  "ifsc": "HDFC0001234",
  "accountHolderName": "Urban Co-op Bank Ltd",
  "features": ["EMI_CARDS", "VERIFICATION_CREDITS", "LOAN_MANAGEMENT"],
  "emiCardQuantity": 150,
  "verificationCreditQuantity": 300,
  "emiCardPrice": 11000,
  "verificationCreditPrice": 11000,
  "cgst": 990,
  "sgst": 990,
  "status": "ACTIVE"
}
```

#### Uploadable Document Fields (`multipart/form-data`):
- `logo` / `bankLogo` - Bank Logo image (`.jpg`, `.jpeg`, `.png`, `.webp`)
- `registrationCertificate` - Bank Registration Certificate (`.pdf`, `.jpg`, `.png`)
- `companyPan` - Bank PAN Card
- `boardResolution` - Board Resolution Document
- `gstDeclaration` - GST Certificate / Declaration
- `directorKyc` - Director KYC Document
- `cancelledCheque` - Cancelled Cheque image/PDF

#### Sample Success Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": "66c0e8a71234567890abcdef",
    "bankId": "66c0e8a71234567890abcdef",
    "bankName": "Urban Co-operative Bank Ltd",
    "name": "Urban Co-operative Bank Ltd",
    "code": "UCBANK",
    "email": "admin@urbancobank.com",
    "phoneNumber": "9876543210",
    "credit": 0,
    "formattedCredit": "₹0",
    "ubo": "Rajesh Sharma",
    "authorizedPerson": "Rajesh Sharma",
    "bankAccountDetails": {
      "bankName": "HDFC Bank",
      "accountNumber": "987654321098",
      "ifsc": "HDFC0001234",
      "accountHolder": "Urban Co-op Bank Ltd"
    },
    "features": ["EMI_CARDS", "VERIFICATION_CREDITS", "LOAN_MANAGEMENT"],
    "status": "ACTIVE",
    "pricing": {
      "emiCardQuantity": 150,
      "verificationCreditQuantity": 300,
      "emiCardPrice": 11000,
      "verificationCreditPrice": 11000,
      "totalAmount": 22000,
      "cgst": 990,
      "sgst": 990,
      "totalPayableAmount": 23980
    }
  },
  "message": "Co-operative Bank updated successfully."
}
```

---

### 3. 📋 List Co-operative Banks

Fetch paginated list of Co-operative Banks with search & status filters.

- **Method**: `GET`
- **Endpoint**: `/api/v1/super-admin/co-operative-bank`
- **Query Parameters**:
  - `page`: Page number (default: `1`)
  - `limit`: Records per page (default: `10`, max: `100`)
  - `search`: Search term across bank name, email, phone, code, UBO
  - `status`: Filter by status (`PENDING`, `ON_VERIFICATION`, `APPROVED`, `REJECTED`, `ACTIVE`, `INACTIVE`, `BLOCKED`)
  - `sortBy`: Field to sort by (e.g. `createdAt`, `name`)
  - `sortOrder`: `asc` or `desc`

#### Sample Request
`GET /api/v1/super-admin/co-operative-bank?page=1&limit=10&status=ACTIVE&search=Urban`

---

### 4. 🔍 Get Co-operative Bank Details

Fetch single bank details including pricing breakdown, credit logs, uploaded document URLs, and onboarding status.

- **Method**: `GET`
- **Endpoint**: `/api/v1/super-admin/co-operative-bank/:id`

---

### 5. ➕ Create Co-operative Bank

Register a new Co-operative Bank with manual/cash or Razorpay online payment onboarding.

- **Method**: `POST`
- **Endpoint**: `/api/v1/super-admin/co-operative-bank`
- **Headers**: `Content-Type: multipart/form-data`, `Authorization: Bearer <TOKEN>`
- **Permission**: `co_operative_bank:create`

---

### 6. 💳 Add Credit to Co-operative Bank

Manually allocate EMI Cards or Verification Credits to a bank account.

- **Method**: `POST` or `PUT`
- **Endpoint**: `/api/v1/super-admin/co-operative-bank/:id/add-credit`
- **Request Body**:
```json
{
  "quantity": 50,
  "type": "EMI" // Options: "EMI" (EMI Cards) or "VERIFICATION" (Verification Credits)
}
```

---

### 7. 🚦 Update Bank Status (Approve / Reject)

Approve or reject a pending bank onboarding application.

- **Method**: `PATCH`
- **Endpoint**: `/api/v1/super-admin/co-operative-bank/:id/status`
- **Request Body**:
```json
{
  "status": "APPROVED", // Options: PENDING, ON_VERIFICATION, APPROVED, REJECTED, INACTIVE, BLOCKED (If ACTIVE is passed, it is mapped to APPROVED)
  "remarks": "Documents verified successfully."
}
```
*Note: If `status` is `REJECTED`, `remarks` is mandatory.*

---

### 8. ❌ Delete Co-operative Bank

Soft delete a bank record.

- **Method**: `DELETE`
- **Endpoint**: `/api/v1/super-admin/co-operative-bank/:id`

---

## 📁 Directory Structure
```
src/panels/super-admin/co-operative-bank/
├── controllers/
│   └── co-operative-bank.controller.js
├── services/
│   └── co-operative-bank.service.js
├── validators/
│   └── co-operative-bank.validator.js
├── routes/
│   └── co-operative-bank.routes.js
├── index.js
└── README.md
```
