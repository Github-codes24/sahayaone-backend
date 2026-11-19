# 👥 Society Panel Customer & Merchant Management Module - Technical Design & Implementation Plan

This document provides the technical design, data schema mappings, query aggregation strategies, API endpoints, role permissions, and verification steps for the **Society Customer & Merchant Management Module** (`src/panels/society/customer/`).

---

## 📌 1. Architectural Overview & Scoping Rules

### 1. Multi-Tenant Bank Scoping
- All queries automatically filter by `bankId` resolved from JWT session via `resolveSocietyContext` middleware.
- Unauthenticated or invalid token requests return `401 Unauthorized`.

### 2. Branch Data Isolation
- **Branch Managers, QC Officers, Receipt Executives, & Support Staff**: Restricted to viewing customers and merchants assigned to their branch (`branchId`).
- **Bank Owners, Bank Receipt Managers, & Society Admins**: Can view records across all branches or apply multi-branch filters (`branchId` / `branchIds`).

### 3. Authorized Roles & Access Control
The following roles are authorized to access the Customer Management APIs:
1. **Bank Owner / Society Admin** (`BANK_OWNER`, `BANK_ADMIN`, `SOCIETY_ADMIN`, `SUPER_ADMIN`)
2. **Branch Manager** (`BRANCH_MANAGER`, `MANAGER`)
3. **Branch Quality Check Officer** (`QC_EMPLOYEE`, `QUALITY_CHECK`, `QC`)
4. **Receipt Management Executive** (`RECEIPT_MANAGEMENT_EXECUTIVE`, `RECEIPT_EXECUTIVE`)
5. **Bank Receipt Manager** (`BANK_RECEIPT_MANAGER`, `RECEIPT_MANAGER`)
6. **Customer Support Executive** (`CUSTOMER_SUPPORT_EXECUTIVE`, `SUPPORT_EXECUTIVE`, `CUSTOMER_SUPPORT`)

---

## 📊 2. Aggregated Field Specifications

Each customer or merchant object in the API response includes:

| Field Name | Type | Description | Source Schema / Resolution |
| :--- | :--- | :--- | :--- |
| `id` | ObjectId / String | Record ID | `SocietyCustomerLink._id` or `MerchantProfile._id` |
| `userId` | ObjectId | Linked User ID | `User._id` |
| `name` | String | Member Name | Customer: `firstName + lastName`, Merchant: `shopName` (Owner: `ownerName`) |
| `entityType` | Enum | Member Type | `CUSTOMER` or `MERCHANT` |
| `phoneNumber` | String | Primary Mobile Number | `phoneNumber` |
| `email` | String | Contact Email | `email` |
| `totalLoans` | Object | Loan Summary | Aggregated from `Loan`: `{ count, activeCount, totalAmount, outstandingAmount }` |
| `totalPigmy` | Object | Pigmy Deposit Summary | Aggregated from `PigmyCustomer`: `{ count, activeCount, totalBalance }` |
| `createdBy` | Object | Creator Employee Info | `{ name, role, employeeId, phone }` resolved via `SocietyEmployee` using creator's `userId` |
| `createdAt` | ISO Date | Onboarding Date | `createdAt` timestamp |
| `emiCardDetails` | Object | Linked EMI Card | `{ cardNumber, validThru, expiryDate, cardLimit, availableLimit, status }` resolved from `EmiCard` |
| `societyAccountDetails` | Object | Bank Account Info | `{ accountNumber, accountHolderName, ifscCode, bankName, branchName }` |

---

## 🛠️ 3. API Endpoints

### 1. `GET /api/v1/society/customers`
- **Description**: Paginated list of society customers and merchants with summary metrics.
- **Query Params**: `page`, `limit`, `search`, `type` (`CUSTOMER`, `MERCHANT`, `ALL`), `branchId`, `status`, `dateFrom`, `dateTo`.

### 2. `GET /api/v1/society/customers/:id`
- **Description**: Detailed member view including full loan list, pigmy accounts list, EMI card history, and society bank details.

### 3. `GET /api/v1/society/customers/dropdown`
- **Description**: Lightweight active customer & merchant dropdown selection list.

---

## 🧪 4. Verification & Testing Steps

1. Verify module files in `src/panels/society/customer/`:
   - `routes/society-customer.routes.js`
   - `controllers/society-customer.controller.js`
   - `services/society-customer.service.js`
   - `validators/society-customer.validator.js`
   - `CUSTOMER_API_DOCUMENTATION.md`
2. Test app import: `node -e "import('./src/app.js')"`
