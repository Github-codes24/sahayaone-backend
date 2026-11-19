# Customer Mobile App - API Documentation

This document describes the decoupled architecture and complete API specifications for the **Sahayaone Customer Mobile Application**.

---

## Architecture & Flow Overview

1. **Decoupled Architecture:**
   - **Auth Module (`/api/v1/customer/auth`):** Handles authentication, OTP verification, and MPIN registration/login. It returns clean user identity and lightweight flags (`isGuest`, `isMerchant`, `hasLoans`, `hasPigmy`), without dumping heavy database collections.
   - **Pigmy Module (`/api/v1/customer/pigmy`):** Dedicated endpoints to view customer's pigmy deposit accounts across all linked banks (individual & merchant pigmy accounts).
   - **Loan Module (`/api/v1/customer/loans`):** Dedicated endpoints to track loans across multiple banks, view repayment schedules, and pay EMI installments.
   - **Merchant Module (`/api/v1/customer/merchant`):** Dedicated endpoints for customers who are also registered merchants (shop profile, business category, merchant summary).
   - **Profile Module (`/api/v1/customer/profile`):** Unified KYC and personal profile data synchronized directly with Sahayaone onboarding records.

2. **Guest vs Onboarded Customer:**
   - **Guest (Without KYC):** If a user logs in before being formally onboarded, the system registers them with `isGuest: true`, `fullName: "Guest"`, and `kycStatus: "PENDING"`. They can freely navigate the app.
   - **Onboarded Customer (e.g. `8999230839`):** Fetches real KYC data (PAN, Aadhaar, verified documents, credit score, live photo) saved by the onboarding engine.

3. **Role & Data Isolation:**
   - If a customer's phone number was previously used for an internal staff role (e.g., Executive or Branch Staff), the Customer App strictly isolates the session and exposes only `role: "CUSTOMER"` and `userType: "CUSTOMER"`. No employee targets or internal bank staff data is exposed.

---

## Base URLs & Common Headers

- **Base URL:** `{{BASE_URL}}/api/v1/customer` (or `{{BASE_URL}}/api/v1/customer-mobile`)
- **Protected Request Headers:**
  ```http
  Authorization: Bearer <ACCESS_TOKEN>
  Content-Type: application/json
  ```

---

## 1. Authentication Module (`/auth`)

### 1.1 Mobile Number Verification (Send OTP)
Sends a 6-digit OTP code to the customer's phone number. If the user does not exist in the database, registers them as a **Guest** without blocking for KYC.

- **Endpoint:** `POST {{BASE_URL}}/api/v1/customer/auth/verify-mobile`
- **Request Body:**
  ```json
  {
    "phoneNumber": "8999230839"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "OTP sent successfully to your mobile number.",
    "data": {
      "registered": true,
      "isGuest": false,
      "isMpinSet": true,
      "mpinConfigured": true,
      "otp": "123456"
    }
  }
  ```

---

### 1.2 OTP Verification
Validates the OTP and returns a session access token with clean customer identity.

- **Endpoint:** `POST {{BASE_URL}}/api/v1/customer/auth/verify-otp`
- **Request Body:**
  ```json
  {
    "phoneNumber": "8999230839",
    "otp": "123456"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "OTP verification successful.",
    "data": {
      "user": {
        "id": "6a9ab9bb7282d1d9974dd672",
        "phoneNumber": "8999230839",
        "fullName": "SHAMSUDDIN ANSARI ANEESUDDIN ANSARI",
        "isGuest": false,
        "role": "CUSTOMER",
        "userType": "CUSTOMER",
        "status": "ACTIVE",
        "kycStatus": "VERIFIED",
        "panNumber": "DEEPA2450D",
        "aadhaarNumber": "800289977383",
        "isMerchant": true,
        "hasLoans": true,
        "loansCount": 2,
        "hasPigmy": true,
        "pigmyAccountsCount": 3,
        "isMpinSet": true
      },
      "accessToken": "eyJhbGciOiJIUzI1Ni...",
      "refreshToken": "eyJhbGciOiJIUzI1Ni...",
      "token": "eyJhbGciOiJIUzI1Ni..."
    }
  }
  ```

---

### 1.3 Register / Set MPIN
Sets a 4-digit security PIN for quick login.

- **Endpoint:** `POST {{BASE_URL}}/api/v1/customer/auth/register-mpin`
- **Headers:** `Authorization: Bearer <ACCESS_TOKEN>`
- **Request Body:**
  ```json
  {
    "mpin": "4321"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "MPIN configured successfully. Session initialized.",
    "data": {
      "user": {
        "id": "6a9ab9bb7282d1d9974dd672",
        "phoneNumber": "8999230839",
        "fullName": "SHAMSUDDIN ANSARI ANEESUDDIN ANSARI",
        "isGuest": false,
        "role": "CUSTOMER",
        "kycStatus": "VERIFIED",
        "isMerchant": true,
        "isMpinSet": true
      },
      "accessToken": "eyJhbGciOiJIUzI1Ni...",
      "refreshToken": "eyJhbGciOiJIUzI1Ni...",
      "token": "eyJhbGciOiJIUzI1Ni..."
    }
  }
  ```

---

### 1.4 Login with MPIN
Direct login using 4-digit passcode without requiring OTP.

- **Endpoint:** `POST {{BASE_URL}}/api/v1/customer/auth/login-mpin`
- **Request Body:**
  ```json
  {
    "phoneNumber": "8999230839",
    "mpin": "4321"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Authentication successful. Customer session initialized.",
    "data": {
      "user": {
        "id": "6a9ab9bb7282d1d9974dd672",
        "phoneNumber": "8999230839",
        "fullName": "SHAMSUDDIN ANSARI ANEESUDDIN ANSARI",
        "isGuest": false,
        "role": "CUSTOMER",
        "kycStatus": "VERIFIED",
        "isMerchant": true,
        "hasLoans": true,
        "hasPigmy": true
      },
      "accessToken": "eyJhbGciOiJIUzI1Ni...",
      "refreshToken": "eyJhbGciOiJIUzI1Ni..."
    }
  }
  ```

---

### 1.5 Resend OTP
- **Endpoint:** `POST {{BASE_URL}}/api/v1/customer/auth/resend-otp`
- **Request Body:**
  ```json
  {
    "phoneNumber": "8999230839"
  }
  ```

---

### 1.6 Forgot MPIN (Step 1: Request Reset Code)
Sends a 6-digit OTP code to reset the MPIN.

- **Endpoint:** `POST {{BASE_URL}}/api/v1/customer/auth/forgot-mpin`
- **Request Body:**
  ```json
  {
    "phoneNumber": "8999230839"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "We've sent a verification code to your phone number. Please enter it to reset your MPIN.",
    "data": {
      "success": true,
      "message": "We've sent a verification code to your phone number. Please enter it to reset your MPIN.",
      "otp": "123456"
    }
  }
  ```

---

### 1.7 Verify Reset OTP (Step 2: Get Reset Transition Token)
Verifies the OTP code received during the Forgot MPIN request and returns a temporary token (`tempToken`) required to authorize setting the new MPIN.

- **Endpoint:** `POST {{BASE_URL}}/api/v1/customer/auth/verify-reset-otp`
- **Request Body:**
  ```json
  {
    "phoneNumber": "8999230839",
    "otp": "123456"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Verification successful! Please choose a new 4-digit MPIN.",
    "data": {
      "success": true,
      "tempToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "message": "Verification successful! Please choose a new 4-digit MPIN."
    }
  }
  ```

---

### 1.8 Reset MPIN (Step 3: Submit New 4-Digit MPIN)
Consumes the `tempToken` received in Step 2 to securely update the customer's MPIN and initializes a full authenticated session.

- **Endpoint:** `POST {{BASE_URL}}/api/v1/customer/auth/reset-mpin`
- **Headers:**
  ```http
  Authorization: Bearer <tempToken>
  Content-Type: application/json
  ```
- **Request Body:**
  ```json
  {
    "mpin": "9999"
  }
  ```
  *(Note: Accepts `"mpin"` or `"newMpin"`, and accepts `tempToken` / `token` in request body as fallback)*
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Your MPIN has been updated successfully. You can now log in using your new MPIN.",
    "data": {
      "user": {
        "id": "6a9ab9bb7282d1d9974dd672",
        "phoneNumber": "8999230839",
        "fullName": "SHAMSUDDIN ANSARI ANEESUDDIN ANSARI",
        "isGuest": false,
        "role": "CUSTOMER",
        "userType": "CUSTOMER",
        "status": "ACTIVE",
        "kycStatus": "VERIFIED",
        "panNumber": "DEEPA2450D",
        "aadhaarNumber": "800289977383",
        "isMerchant": true,
        "hasLoans": true,
        "hasPigmy": true,
        "isMpinSet": true
      },
      "accessToken": "eyJhbGciOiJIUzI1Ni...",
      "refreshToken": "eyJhbGciOiJIUzI1Ni...",
      "token": "eyJhbGciOiJIUzI1Ni..."
    }
  }
  ```

---

### 1.9 Refresh Session Token
- **Endpoint:** `POST {{BASE_URL}}/api/v1/customer/auth/refresh`
- **Request Body:**
  ```json
  {
    "refreshToken": "eyJhbGciOiJIUzI1Ni..."
  }
  ```

---

### 1.10 Customer Logout
- **Endpoint:** `POST {{BASE_URL}}/api/v1/customer/auth/logout`
- **Headers:** `Authorization: Bearer <ACCESS_TOKEN>`

---

## 2. Pigmy Deposit Module (`/pigmy`)

### 2.1 List All Pigmy Accounts (Across All Banks)
Retrieves all pigmy deposit accounts linked to the logged-in customer across all banks, along with a dashboard summary.

- **Endpoint:** `GET {{BASE_URL}}/api/v1/customer/pigmy/accounts` (or `GET {{BASE_URL}}/api/v1/customer/pigmy`)
- **Headers:** `Authorization: Bearer <ACCESS_TOKEN>`
- **Query Parameters (Optional):**
  - `bankId`: Filter by specific bank ID.
  - `status`: Filter by status (`ACTIVE`, `INACTIVE`).
  - `customerType`: Filter by `INDIVIDUAL` or `MERCHANT`.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Pigmy accounts and dashboard summary retrieved successfully.",
    "data": {
      "summary": {
        "totalAccountsCount": 3,
        "activeAccountsCount": 2,
        "totalDailyDeposit": 3000,
        "totalMaturityAmount": 820800,
        "individualAccountsCount": 0,
        "merchantAccountsCount": 3
      },
      "accounts": [
        {
          "id": "6a9d43e95bae3ea3cc2e63c7",
          "accountNumber": "PIGACC-433482584",
          "pigmyCustomerCode": "PIG-508462",
          "fullName": "SHAMSUDDIN ANSARI",
          "customerType": "MERCHANT",
          "isMerchant": true,
          "shopName": "Kamla Raj Traders",
          "bankId": "6a7c15cf266474a6d606d2f0",
          "bankName": "ASB Bank",
          "branchId": "6a7c15cf266474a6d606d2f5",
          "branchName": "LALA",
          "dailyDepositAmount": 1500,
          "depositFrequency": "DAILY",
          "tenureMonths": 12,
          "interestRate": 6.5,
          "maturityAmount": 574560,
          "status": "ACTIVE",
          "approvalStatus": "APPROVED",
          "savingsAccountNumber": "ACC-SB-998815",
          "mandateStatus": "ACTIVE",
          "createdAt": "2026-09-07T07:15:12.000Z"
        }
      ]
    }
  }
  ```

---

### 2.2 Get Single Pigmy Account Details
- **Endpoint:** `GET {{BASE_URL}}/api/v1/customer/pigmy/accounts/:id` (or `GET {{BASE_URL}}/api/v1/customer/pigmy/:id`)
- **Headers:** `Authorization: Bearer <ACCESS_TOKEN>`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Pigmy account details retrieved successfully.",
    "data": {
      "id": "6a9d43e95bae3ea3cc2e63c7",
      "accountNumber": "PIGACC-433482584",
      "pigmyCustomerCode": "PIG-508462",
      "fullName": "SHAMSUDDIN ANSARI",
      "customerType": "MERCHANT",
      "isMerchant": true,
      "shopName": "Kamla Raj Traders",
      "bankName": "ASB Bank",
      "branchName": "LALA",
      "dailyDepositAmount": 1500,
      "depositFrequency": "DAILY",
      "tenureMonths": 12,
      "interestRate": 6.5,
      "maturityAmount": 574560,
      "status": "ACTIVE",
      "approvalStatus": "APPROVED",
      "societyAccount": {
        "societyAccountNumber": "ACC-SB-998815",
        "ifscCode": "ASBB0001234"
      },
      "documents": {
        "aadhaarImage": "https://...",
        "panImage": "https://...",
        "shopPhoto": "https://..."
      }
    }
  }
  ```

---

## 3. Loan Module (`/loans`)

### 3.1 List All Customer Loans (Across All Banks)
Retrieves all loan contracts associated with the customer from any bank.

- **Endpoint:** `GET {{BASE_URL}}/api/v1/customer/loans`
- **Headers:** `Authorization: Bearer <ACCESS_TOKEN>`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Loans list and dashboard summary retrieved successfully.",
    "data": {
      "totalOutstanding": 54159,
      "totalLoanAmount": 81818,
      "activeLoansCount": 2,
      "loans": [
        {
          "_id": "6aa0f78d53f604cea2dbbed7",
          "applicationId": "ADV-029081951",
          "status": "APPROVED",
          "currentStep": "COMPLETED",
          "totalAmount": 54159,
          "totalLoanAmount": 54159,
          "totalPayableAmount": 54159,
          "outstandingAmount": 54159,
          "emiAmount": 9026,
          "tenureMonths": 6,
          "paidEmisCount": 0,
          "assignedBankId": {
            "_id": "6a7c15cf266474a6d606d2f0",
            "name": "ASB Bank"
          },
          "branchId": {
            "_id": "6a7c15cf266474a6d606d2f5",
            "name": "LALA"
          },
          "productDetails": {
            "brandName": "Apple",
            "modelName": "iPhone 15 Pro"
          },
          "schedule": [
            {
              "monthName": "Month 1",
              "amount": 9026,
              "dueDate": "2026-10-05T00:00:00.000Z",
              "status": "UPCOMING"
            }
          ]
        }
      ]
    }
  }
  ```

---

### 3.2 Get Single Loan Details & Repayment Ledger
- **Endpoint:** `GET {{BASE_URL}}/api/v1/customer/loans/:id`
- **Headers:** `Authorization: Bearer <ACCESS_TOKEN>`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Loan details retrieved successfully.",
    "data": {
      "_id": "6aa0f78d53f604cea2dbbed7",
      "applicationId": "ADV-029081951",
      "status": "APPROVED",
      "productPrice": 54159,
      "totalPayableAmount": 54159,
      "outstandingAmount": 54159,
      "emiAmount": 9026,
      "tenureMonths": 6,
      "paidEmisCount": 0,
      "nextEmiDueDate": "2026-10-05T00:00:00.000Z",
      "assignedBankId": {
        "_id": "6a7c15cf266474a6d606d2f0",
        "name": "ASB Bank"
      },
      "schedule": [
        {
          "monthName": "Month 1",
          "amount": 9026,
          "dueDate": "2026-10-05T00:00:00.000Z",
          "status": "DUE"
        },
        {
          "monthName": "Month 2",
          "amount": 9026,
          "dueDate": "2026-11-05T00:00:00.000Z",
          "status": "UPCOMING"
        }
      ]
    }
  }
  ```

---

### 3.3 Pay Next EMI Installment
- **Endpoint:** `POST {{BASE_URL}}/api/v1/customer/loans/:id/pay-emi`
- **Headers:** `Authorization: Bearer <ACCESS_TOKEN>`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "EMI payment simulated successfully.",
    "data": {
      "_id": "6aa0f78d53f604cea2dbbed7",
      "paidEmisCount": 1,
      "outstandingAmount": 45133,
      "status": "ACTIVE"
    }
  }
  ```

---

## 4. Merchant Module (`/merchant`)

### 4.1 Get Merchant Profile & All Associated Shops
If the logged-in customer is registered as an onboarded merchant at one or multiple shops/branches, returns their merchant shop profiles and bank linkages.

- **Endpoint:** `GET {{BASE_URL}}/api/v1/customer/merchant/profile` (or `GET {{BASE_URL}}/api/v1/customer/merchant`)
- **Headers:** `Authorization: Bearer <ACCESS_TOKEN>`
- **Response (When user is a Merchant):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Merchant profile(s) retrieved successfully.",
    "data": {
      "isMerchant": true,
      "totalShopsCount": 1,
      "shops": [
        {
          "id": "6a9af6f8724e5e8dfc4e6a88",
          "_id": "6a9af6f8724e5e8dfc4e6a88",
          "merchantCode": "MER-604514",
          "shopName": "Kamla Raj Traders",
          "ownerName": "SHAMSUDDIN ANSARI ANEESUDDIN ANSARI",
          "phoneNumber": "8999230839",
          "email": "komalraj10@gmail.com",
          "businessCategory": "RETAIL",
          "businessProofType": "GST",
          "businessProofNumber": "ASCW5613132035A",
          "gstinNumber": "22AAAAA0000A1Z5",
          "address": "House No.1128/J/311, Hasanbag, Nagpur, Maharashtra, 440009",
          "shopAddress": "House No.1128/J/311, Hasanbag, Nagpur, Maharashtra, 440009",
          "pincode": "440009",
          "bankId": "6a7c15cf266474a6d606d2f0",
          "bankName": "ASB Bank",
          "branchId": "6a7c34898aec45570868df7a",
          "branchName": "LALA",
          "status": "ACTIVE",
          "approvalStatus": "APPROVED",
          "qrCodeUrl": null,
          "upiId": null,
          "createdAt": "2026-09-04T16:51:04.168Z"
        }
      ],
      "merchant": {
        "id": "6a9af6f8724e5e8dfc4e6a88",
        "_id": "6a9af6f8724e5e8dfc4e6a88",
        "merchantCode": "MER-604514",
        "shopName": "Kamla Raj Traders",
        "ownerName": "SHAMSUDDIN ANSARI ANEESUDDIN ANSARI",
        "phoneNumber": "8999230839",
        "email": "komalraj10@gmail.com",
        "businessCategory": "RETAIL",
        "businessProofType": "GST",
        "businessProofNumber": "ASCW5613132035A",
        "gstinNumber": "22AAAAA0000A1Z5",
        "address": "House No.1128/J/311, Hasanbag, Nagpur, Maharashtra, 440009",
        "shopAddress": "House No.1128/J/311, Hasanbag, Nagpur, Maharashtra, 440009",
        "pincode": "440009",
        "bankId": "6a7c15cf266474a6d606d2f0",
        "bankName": "ASB Bank",
        "branchId": "6a7c34898aec45570868df7a",
        "branchName": "LALA",
        "status": "ACTIVE",
        "approvalStatus": "APPROVED"
      }
    }
  }
  ```
- **Response (When user is NOT a Merchant):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Customer is not registered as a merchant.",
    "data": {
      "isMerchant": false,
      "totalShopsCount": 0,
      "shops": [],
      "merchant": null,
      "message": "Customer is not registered as a merchant."
    }
  }
  ```

---

### 4.2 Get Specific Merchant Shop Details
- **Endpoint:** `GET {{BASE_URL}}/api/v1/customer/merchant/shops/:id` (or `GET {{BASE_URL}}/api/v1/customer/merchant/:id`)
- **Headers:** `Authorization: Bearer <ACCESS_TOKEN>`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Merchant shop details retrieved successfully.",
    "data": {
      "id": "6a9af6f8724e5e8dfc4e6a88",
      "merchantCode": "MER-604514",
      "shopName": "Kamla Raj Traders",
      "ownerName": "SHAMSUDDIN ANSARI",
      "phoneNumber": "8999230839",
      "bankName": "ASB Bank",
      "branchName": "LALA",
      "address": "House No.1128/J/311, Hasanbag, Nagpur, Maharashtra, 440009",
      "status": "ACTIVE",
      "approvalStatus": "APPROVED"
    }
  }
  ```

---

### 4.3 Get Merchant Summary
Returns summary metrics for merchant-linked activities (merchant pigmy accounts and loans across shops).

- **Endpoint:** `GET {{BASE_URL}}/api/v1/customer/merchant/summary`
- **Headers:** `Authorization: Bearer <ACCESS_TOKEN>`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Merchant summary retrieved successfully.",
    "data": {
      "isMerchant": true,
      "totalShopsCount": 1,
      "shops": [
        {
          "id": "6a9af6f8724e5e8dfc4e6a88",
          "shopName": "Kamla Raj Traders",
          "merchantCode": "MER-604514",
          "bankName": "ASB Bank",
          "branchName": "LALA"
        }
      ],
      "summary": {
        "shopsCount": 1,
        "pigmyAccountsCount": 3,
        "activePigmyAccountsCount": 2,
        "totalPigmyDailyDeposit": 3000,
        "loansCount": 2
      },
      "merchantPigmyAccounts": [
        {
          "id": "6a9d43e95bae3ea3cc2e63c7",
          "accountNumber": "PIGACC-433482584",
          "shopName": "Rajesh Kirana & General Store",
          "bankName": "ASB Bank",
          "branchName": "LALA",
          "dailyDepositAmount": 1500,
          "tenureMonths": 6,
          "status": "ACTIVE"
        }
      ],
      "merchantLoans": [
        {
          "id": "6aa0f78d53f604cea2dbbed7",
          "applicationId": "ADV-029081951",
          "bankName": "ASB Bank",
          "totalAmount": 54159,
          "outstandingAmount": 38050,
          "status": "APPROVED"
        }
      ]
    }
  }
  ```

---

## 5. Profile Module (`/profile`)

### 5.1 Get Customer Profile
Fetches verified KYC profile details.

- **Endpoint:** `GET {{BASE_URL}}/api/v1/customer/profile` (or `GET {{BASE_URL}}/api/v1/customer/me`)
- **Headers:** `Authorization: Bearer <ACCESS_TOKEN>`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Profile retrieved successfully.",
    "data": {
      "userId": "6a9ab9bb7282d1d9974dd672",
      "phoneNumber": "8999230839",
      "fullName": "SHAMSUDDIN ANSARI ANEESUDDIN ANSARI",
      "isGuest": false,
      "role": "CUSTOMER",
      "kycStatus": "VERIFIED",
      "panNumber": "DEEPA2450D",
      "aadhaarNumber": "800289977383",
      "creditScore": 803,
      "cibilStatus": "APPROVED",
      "livePhoto": "https://...",
      "activeAddress": "Plot 12, Industrial Area",
      "residentialPincode": "440001",
      "isMerchant": true,
      "isMpinSet": true
    }
  }
  ```

---

## 6. Summary of Endpoints by Module

| Module | Method | Endpoint URL | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/v1/customer/auth/verify-mobile` | Send OTP / Guest registration |
| **Auth** | `POST` | `/api/v1/customer/auth/verify-otp` | Verify OTP & get session token |
| **Auth** | `POST` | `/api/v1/customer/auth/register-mpin` | Set 4-digit MPIN |
| **Auth** | `POST` | `/api/v1/customer/auth/login-mpin` | Login using MPIN |
| **Auth** | `POST` | `/api/v1/customer/auth/resend-otp` | Resend verification OTP |
| **Auth** | `POST` | `/api/v1/customer/auth/forgot-mpin` | Request MPIN reset OTP |
| **Auth** | `POST` | `/api/v1/customer/auth/reset-mpin` | Reset MPIN using OTP |
| **Pigmy** | `GET` | `/api/v1/customer/pigmy/accounts` | List all multi-bank pigmy accounts & summary |
| **Pigmy** | `GET` | `/api/v1/customer/pigmy/accounts/:id` | Get single pigmy account details |
| **Loans** | `GET` | `/api/v1/customer/loans` | List all multi-bank loans & dashboard summary |
| **Loans** | `GET` | `/api/v1/customer/loans/:id` | Get single loan details & EMI schedule |
| **Loans** | `POST` | `/api/v1/customer/loans/:id/pay-emi` | Pay next due EMI installment |
| **Merchant**| `GET` | `/api/v1/customer/merchant/profile` | Get merchant shop details (if merchant) |
| **Merchant**| `GET` | `/api/v1/customer/merchant/summary` | Get merchant pigmy & loan summary |
| **Profile** | `GET` | `/api/v1/customer/profile` | Get customer verified profile & KYC |
