# SIP (Systemic Investment Plan) Module API Documentation

This document provides complete REST API specifications and business use cases for the **Systemic Investment Plan (SIP)** module in **sahayaone-backend**.

> [!IMPORTANT]
> **Business Rule & Access Control**: 
> - **Customers cannot self-create SIP subscriptions**. Customers have **read-only access** to explore active schemes and view their own subscribed SIP accounts.
> - **SIP Subscriptions are created exclusively by Bank Staff / Employees** (or Bank Owners) on behalf of verified customers after validating active account status and KYC approval.

---

## 1. Module Overview & Specifications

- **Base URL**: `/api/v1`
- **Content-Type**: `application/json`
- **Authentication**: JWT Bearer Token passed via HTTP Header: `Authorization: Bearer <JWT_TOKEN>`
- **Tenant Context**: Society / Bank Context passed via header: `x-society-id: <SOCIETY_ID>`

---

## 2. All SIP API Endpoints & Business Use Cases Summary

| Endpoint | Method | Permitted Roles | Primary Business Use Case |
| :--- | :--- | :--- | :--- |
| [`/api/v1/sip/schemes`](#31-create-sip-scheme) | `POST` | `BANK_OWNER` | **Scheme Creation**: Bank Owner defines a new daily SIP product with interest rate tiers and duration plans. |
| [`/api/v1/sip/schemes`](#32-get-all-active-sip-schemes) | `GET` | All / Public | **Scheme Catalog**: List all active SIP products for customer mobile display and branch agent offerings. |
| [`/api/v1/sip/schemes/:id`](#33-get-sip-scheme-by-id) | `GET` | All / Public | **Scheme Details**: Fetch comprehensive scheme terms, duration tiers (1, 3, 6, 12 months), and investment limits. |
| [`/api/v1/sip/schemes/:id`](#34-update-sip-scheme) | `PUT` | `BANK_OWNER` | **Scheme Maintenance**: Modify allowed investment amounts, interest rates, or custom ranges for an existing scheme. |
| [`/api/v1/sip/schemes/:id/status`](#35-update-sip-scheme-status) | `PATCH` | `BANK_OWNER` | **Scheme Lifecycle Control**: Toggle scheme availability between `ACTIVE` and `INACTIVE`. |
| [`/api/v1/sip/bank`](#41-create-customer-sip-bank-employee) | `POST` | `EMPLOYEE` / `BANK_OWNER` | **Bank Onboarding**: Bank employee subscribes a customer to a daily SIP plan after checking active bank account & KYC. |
| [`/api/v1/sip/my-sips`](#51-get-my-sip-subscriptions) | `GET` | `CUSTOMER` | **Customer Portfolio View**: Customer views a list of all their active, matured, or pending SIP accounts. |
| [`/api/v1/sip/:id`](#52-get-sip-subscription-by-id) | `GET` | `CUSTOMER` | **Customer SIP Ledger**: Customer views detailed progress, next due date, maturity amount, and total invested amount. |

---

## 3. Scheme Management APIs (Bank Owner Panel)

### 3.1 Create SIP Scheme

#### Business Use Case
The Bank Owner creates a new daily investment scheme product (e.g., *"Daily Gold Savings SIP"*). The owner configures fixed daily contribution tiers (e.g., ₹100, ₹300, ₹500, ₹1000) or custom amount ranges (e.g., ₹3,000 to ₹50,000), along with interest rates associated with specific investment durations (1, 3, 6, or 12 months).

- **HTTP Method**: `POST`
- **Path**: `/api/v1/sip/schemes`
- **Permitted Role**: `BANK_OWNER`

#### Request Payload
```json
{
  "schemeCode": "DAILY_GOLD_SIP",
  "schemeName": "Daily Gold Investment Scheme",
  "description": "Daily recurring investment scheme offering competitive compounding interest rates.",
  "frequency": "DAILY",
  "durationPlans": [
    {
      "durationMonths": 1,
      "interestRate": 6.5
    },
    {
      "durationMonths": 3,
      "interestRate": 7.0
    },
    {
      "durationMonths": 6,
      "interestRate": 7.5
    },
    {
      "durationMonths": 12,
      "interestRate": 8.5
    }
  ],
  "allowedAmounts": [100, 300, 500, 1000, 1500, 2100],
  "customAmountEnabled": true,
  "customAmountMin": 3000,
  "customAmountMax": 50000,
  "status": "ACTIVE"
}
```

#### Field Specifications
| Field | Type | Required | Description & Constraints |
| :--- | :--- | :--- | :--- |
| `schemeCode` | String | Yes | Unique, uppercase identifier code (e.g. `DAILY_GOLD_SIP`) |
| `schemeName` | String | Yes | Display name of the scheme (2 to 100 chars) |
| `description` | String | No | Detailed explanation of benefits and terms |
| `frequency` | String | Yes | Must be `"DAILY"` |
| `durationPlans` | Array | Yes | Array of objects defining `durationMonths` (`1, 3, 6, 12`) and `interestRate` (%) |
| `allowedAmounts` | Array | Yes | Fixed daily amounts allowed (`[100, 300, 500, 800, 1000, 1200, 1500, 1800, 2100]`) |
| `customAmountEnabled` | Boolean | No | Allows custom daily investment amount within min/max boundaries |
| `customAmountMin` | Number | Conditional | Required if custom amounts enabled (Min `3000`) |
| `customAmountMax` | Number | Conditional | Required if custom amounts enabled (Must be > `customAmountMin`) |
| `status` | String | No | Default `"ACTIVE"`. Allowed: `["ACTIVE", "INACTIVE"]` |

#### Response (`201 Created`)
```json
{
  "success": true,
  "message": "SIP scheme created successfully",
  "data": {
    "_id": "66d812ab4f8c92001e3e4a11",
    "schemeCode": "DAILY_GOLD_SIP",
    "schemeName": "Daily Gold Investment Scheme",
    "frequency": "DAILY",
    "status": "ACTIVE",
    "createdAt": "2026-09-04T10:14:00.000Z"
  }
}
```

---

### 3.2 Get All Active SIP Schemes

#### Business Use Case
Used by the Customer Mobile App and Bank Agent Portal to fetch a list of available active SIP schemes. Enables users to browse investment options, compare interest rates, and view minimum contribution requirements.

- **HTTP Method**: `GET`
- **Path**: `/api/v1/sip/schemes`
- **Permitted Role**: All / Public

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Active SIP schemes fetched successfully",
  "data": [
    {
      "_id": "66d812ab4f8c92001e3e4a11",
      "schemeCode": "DAILY_GOLD_SIP",
      "schemeName": "Daily Gold Investment Scheme",
      "description": "Daily recurring investment scheme offering competitive compounding interest rates.",
      "frequency": "DAILY",
      "durationPlans": [
        { "durationMonths": 1, "interestRate": 6.5 },
        { "durationMonths": 3, "interestRate": 7.0 },
        { "durationMonths": 6, "interestRate": 7.5 },
        { "durationMonths": 12, "interestRate": 8.5 }
      ],
      "allowedAmounts": [100, 300, 500, 1000, 1500, 2100],
      "customAmountEnabled": true,
      "customAmountMin": 3000,
      "customAmountMax": 50000,
      "status": "ACTIVE"
    }
  ]
}
```

---

### 3.3 Get SIP Scheme By ID

#### Business Use Case
Fetches detailed specifications of a single scheme selected by a user or staff member. Used when rendering the scheme calculator page or reviewing detailed interest rate schedules.

- **HTTP Method**: `GET`
- **Path**: `/api/v1/sip/schemes/:id`
- **Permitted Role**: All / Public

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "SIP scheme fetched successfully",
  "data": {
    "_id": "66d812ab4f8c92001e3e4a11",
    "schemeCode": "DAILY_GOLD_SIP",
    "schemeName": "Daily Gold Investment Scheme",
    "status": "ACTIVE"
  }
}
```

---

### 3.4 Update SIP Scheme

#### Business Use Case
The Bank Owner updates parameters of an existing scheme, such as raising interest rates for a promotion, expanding allowed daily amounts, or adjusting custom investment limits.

- **HTTP Method**: `PUT`
- **Path**: `/api/v1/sip/schemes/:id`
- **Permitted Role**: `BANK_OWNER`

#### Request Payload
```json
{
  "schemeName": "Enhanced Daily Gold SIP",
  "allowedAmounts": [100, 300, 500, 1000, 2000, 3000],
  "customAmountMax": 100000
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "SIP scheme updated successfully",
  "data": {
    "_id": "66d812ab4f8c92001e3e4a11",
    "schemeName": "Enhanced Daily Gold SIP",
    "updatedAt": "2026-09-04T12:00:00.000Z"
  }
}
```

---

### 3.5 Update SIP Scheme Status

#### Business Use Case
The Bank Owner pauses or deactivates a scheme (e.g. setting status to `INACTIVE`) so no new customer SIP subscriptions can be created under it, without deleting historical records.

- **HTTP Method**: `PATCH`
- **Path**: `/api/v1/sip/schemes/:id/status`
- **Permitted Role**: `BANK_OWNER`

#### Request Payload
```json
{
  "status": "INACTIVE"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "SIP scheme status updated successfully",
  "data": {
    "_id": "66d812ab4f8c92001e3e4a11",
    "status": "INACTIVE"
  }
}
```

---

## 4. Bank Staff Operations API

### 4.1 Create Customer SIP (Bank Staff / Employee)

#### Business Use Case
When a customer visits a bank branch or meets an authorized field executive/pigmy collector to open a daily SIP, the bank staff uses this API to book the subscription. The backend validates:
1. Employee identity & bank/branch context.
2. Customer existence and active account status (`status === "ACTIVE"`).
3. Active bank account ownership (`accountId` linked to `customerId`).
4. Scheme validity, duration eligibility, and contribution limits.
5. Calculates Maturity Date, Next Due Date, Total Daily Installments, and Estimated Maturity Amount automatically on the server.

- **HTTP Method**: `POST`
- **Path**: `/api/v1/sip/bank`
- **Permitted Role**: `EMPLOYEE` / `BANK_OWNER`

#### Request Payload
```json
{
  "customerId": "65f1234567890abcdef12345",
  "accountId": "66a9876543210fedcba54321",
  "schemeId": "66d812ab4f8c92001e3e4a11",
  "branchId": "66b111222333444555666777",
  "frequency": "DAILY",
  "durationMonths": 6,
  "amount": 500
}
```

#### Field Specifications
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `customerId` | String | Yes | 24-character hex ObjectId of an active customer |
| `accountId` | String | Yes | 24-character hex ObjectId of customer's active bank account |
| `schemeId` | String | Yes | 24-character hex ObjectId of an active SIP scheme |
| `branchId` | String | Conditional | Required for Bank Owner. Auto-resolved for branch staff |
| `frequency` | String | Yes | Must be `"DAILY"` |
| `durationMonths` | Number | Yes | Allowed values: `1`, `3`, `6`, or `12` |
| `amount` | Number | Yes | Integer >= 100 matching scheme rules |

#### Response (`201 Created`)
```json
{
  "success": true,
  "message": "SIP created for customer successfully",
  "data": {
    "_id": "66d819999a0b12003f9a1289",
    "customerId": "65f1234567890abcdef12345",
    "accountId": "66a9876543210fedcba54321",
    "schemeId": "66d812ab4f8c92001e3e4a11",
    "branchId": "66b111222333444555666777",
    "bankId": "66a1234567890abcdef99999",
    "schemeCode": "DAILY_GOLD_SIP",
    "schemeName": "Daily Gold Investment Scheme",
    "amount": 500,
    "frequency": "DAILY",
    "durationMonths": 6,
    "interestRate": 7.5,
    "startDate": "2026-09-04T15:44:00.000Z",
    "maturityDate": "2027-03-04T15:44:00.000Z",
    "nextDueDate": "2026-09-05T15:44:00.000Z",
    "totalInstallments": 181,
    "paidInstallments": 0,
    "totalInvested": 0,
    "totalInterestEarned": 0,
    "maturityAmount": 9410.625,
    "status": "PENDING",
    "createdBy": "65e999888777666555444333",
    "createdAt": "2026-09-04T15:44:00.000Z"
  }
}
```

---

## 5. Customer Viewing APIs (Mobile App)

### 5.1 Get My SIP Subscriptions

#### Business Use Case
The Customer opens their mobile app and navigates to the *"My Investments / SIPs"* screen. This API retrieves all daily SIP accounts owned by the authenticated customer, along with current statuses (`PENDING`, `ACTIVE`, `COMPLETED`, `MATURED`).

- **HTTP Method**: `GET`
- **Path**: `/api/v1/sip/my-sips`
- **Permitted Role**: `CUSTOMER`

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Customer SIP subscriptions fetched successfully",
  "data": [
    {
      "_id": "66d819999a0b12003f9a1289",
      "schemeCode": "DAILY_GOLD_SIP",
      "schemeName": "Daily Gold Investment Scheme",
      "amount": 500,
      "frequency": "DAILY",
      "durationMonths": 6,
      "interestRate": 7.5,
      "startDate": "2026-09-04T15:44:00.000Z",
      "maturityDate": "2027-03-04T15:44:00.000Z",
      "nextDueDate": "2026-09-05T15:44:00.000Z",
      "totalInstallments": 181,
      "paidInstallments": 15,
      "totalInvested": 7500,
      "maturityAmount": 9410.625,
      "status": "ACTIVE"
    }
  ]
}
```

---

### 5.2 Get SIP Subscription By ID

#### Business Use Case
The Customer taps on a specific SIP card in their mobile app to inspect full account details, scheme descriptions, start/maturity timeline, next payment date, and total accumulated interest.

- **HTTP Method**: `GET`
- **Path**: `/api/v1/sip/:id`
- **Permitted Role**: `CUSTOMER`

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "SIP subscription fetched successfully",
  "data": {
    "_id": "66d819999a0b12003f9a1289",
    "customerId": "65f1234567890abcdef12345",
    "schemeId": {
      "_id": "66d812ab4f8c92001e3e4a11",
      "schemeCode": "DAILY_GOLD_SIP",
      "schemeName": "Daily Gold Investment Scheme",
      "description": "Daily recurring investment scheme offering competitive compounding interest rates."
    },
    "amount": 500,
    "durationMonths": 6,
    "interestRate": 7.5,
    "totalInstallments": 181,
    "paidInstallments": 15,
    "totalInvested": 7500,
    "status": "ACTIVE"
  }
}
```
