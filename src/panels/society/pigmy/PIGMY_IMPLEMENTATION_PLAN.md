# Society Panel Pigmy Deposit Management V2 - Implementation Plan & Steps

This document details the architectural plan, step-by-step implementation notes, role-based authorization rules, database model changes, and verification steps for the **Society Panel Pigmy Deposit Management V2** module located in `src/panels/society/pigmy/`.

---

## 1. Architectural Architecture & Objectives

### Goals
1. **Society Panel Isolation**: Implement dedicated REST endpoints in `src/panels/society/pigmy/` for managing Pigmy deposit accounts.
2. **Authorized Personnel**: Restrict access strictly to:
   - **Bank Owner / Society Admin** (`BANK_OWNER`, `BANK_ADMIN`, `SOCIETY_ADMIN`, `OWNER`, `SUPER_ADMIN`, `ADMIN`, `CHAIRMAN`)
   - **Branch Manager** (`BRANCH_MANAGER`, `MANAGER`)
   - **Branch QC Employee** (`QC_EMPLOYEE`, `QC_OFFICER`, `QUALITY_CHECK`, `QUALITY_CHECKER`, `EMPLOYEE`, `BRANCH_STAFF`)
3. **Branch-Level Data Isolation**:
   - Users bound to a specific branch (`branchId`) can ONLY view, modify, or approve Pigmy customer leads belonging to their assigned branch.
   - Bank Owners can view across all branches or filter by `branchId`.
4. **Mandatory Society Account Verification Before Approval**:
   - Approval MUST verify that the customer's internal society account number (`societyAccountNumber`) exists in the database.
   - If missing/null/empty, approval is rejected with a clear `400 Bad Request` error asking the user to add society account details first.
5. **Add Society Account API**:
   - Provide a dedicated endpoint to add or link society account details (`societyAccountNumber`, `ifscCode`, `accountHolderName`, `bankBranchName`, `pincode`) on both `PigmyCustomer` and `SocietyCustomerLink`.

---

## 2. Step-by-Step Implementation Guide

### Step 1: Database Model Update
- **Target File**: [`src/models/pigmy-customer.model.js`](file:///e:/office/New%20folder/sahayaone-backend/src/models/pigmy-customer.model.js)
- **Change**: Added `societyAccount` subdocument field to `pigmyCustomerSchema`:
  ```javascript
  // Internal Society Bank Account Details (Credit Destination)
  societyAccount: {
    societyAccountNumber: { type: String, trim: true, default: null },
    ifscCode: { type: String, uppercase: true, trim: true, default: '' },
    accountHolderName: { type: String, trim: true, default: '' },
    bankBranchName: { type: String, trim: true, default: '' }
  }
  ```

---

### Step 2: Create Validation Schemas
- **Target File**: [`src/panels/society/pigmy/validators/society-pigmy.validator.js`](file:///e:/office/New%20folder/sahayaone-backend/src/panels/society/pigmy/validators/society-pigmy.validator.js)
- **Implemented Schemas**:
  - `addSocietyAccountSchema`: Validates mandatory `societyAccountNumber` and optional `ifscCode`, `accountHolderName`, `bankBranchName`, `pincode`, `pigmyCustomerId`, `customerId`, `userId`.
  - `approvePigmyCustomerSchema`: Validates optional `remarks`.
  - `rejectPigmyCustomerSchema`: Validates mandatory `reason` (rejection reason).
  - `listSocietyPigmyCustomersSchema`: Validates pagination, filters (`customerType`, `approvalStatus`, `status`, `branchId`), and date range.

---

### Step 3: Implement Service Layer Logic
- **Target File**: [`src/panels/society/pigmy/services/society-pigmy.service.js`](file:///e:/office/New%20folder/sahayaone-backend/src/panels/society/pigmy/services/society-pigmy.service.js)
- **Implemented Methods**:
  1. `resolveSocietyUserContext(societyUser, queryBranchId)`:
     - Resolves `bankId` and `branchId` from JWT user context, `SocietyEmployee`, or `BranchManager` profiles.
     - Evaluates role (`isBankOwner`).
     - If user is branch-bound, enforces `effectiveBranchId = userBranchId`.
  2. `formatPigmyCustomerDetails(pigmyCustomer, societyLink)`:
     - Formats complete details matching API specifications.
     - Structures the `societyAccount` object dynamically from `pigmyCustomer.societyAccount`, `existingSavingsAccountNumber`, or `SocietyCustomerLink`.
  3. `getPigmyCustomerDetails(societyUser, pigmyId)`:
     - Resolves Pigmy customer profile by MongoDB ID, Pigmy Code, Account Number, or Phone.
     - Enforces branch scoping (returns `404 Not Found` if user attempts to access a record from a different branch).
  4. `approvePigmyCustomer(societyUser, pigmyId, payload)`:
     - Enforces branch scoping.
     - **Pre-Approval Account Check**: Fetches `SocietyCustomerLink` and checks `pigmyCustomer.societyAccount.societyAccountNumber`, `pigmyCustomer.existingSavingsAccountNumber`, and `societyLink.societyAccountNumber`.
     - Throws `ApiError.badRequest('Cannot approve Pigmy Customer: Customer society account number is missing or does not exist. Please add society account details first before approval.')` if missing.
     - Sets `approvalStatus = 'APPROVED'`, `status = 'ACTIVE'`, `startDate = approvedAt`, `endDate = approvedAt + tenureMonths`, `mandateStatus = 'ACTIVE'`, and generates PDF agreement links.
     - Activates linked `User` (`status: 'ACTIVE'`, `isApproved: true`).
  5. `rejectPigmyCustomer(societyUser, pigmyId, payload)`:
     - Enforces branch scoping.
     - Sets `approvalStatus = 'REJECTED'`, `status = 'INACTIVE'`, `rejectedAt = new Date()`, `rejectionReason = payload.reason`.
  6. `addSocietyAccount(societyUser, pigmyIdOrPayload, payload)`:
     - Resolves target Pigmy customer and enforces branch scoping.
     - Validates `societyAccountNumber`.
     - Updates `PigmyCustomer`: `existingSavingsAccountNumber`, `hasSavingsAccount = true`, `savingsAccountOption = 'EXISTING'`, `societyAccount`.
     - Upserts `SocietyCustomerLink` via `OnboardingEngineService.linkSocietyAccount`.
  7. `listPigmyCustomers(societyUser, queryOptions)`:
     - Queries Pigmy customers strictly filtered by `bankId` and `branchId` (for branch-bound users).
     - Applies pagination, search, status filters, and aggregates statistics.

---

### Step 4: Implement Controller Layer
- **Target File**: [`src/panels/society/pigmy/controllers/society-pigmy.controller.js`](file:///e:/office/New%20folder/sahayaone-backend/src/panels/society/pigmy/controllers/society-pigmy.controller.js)
- **Handlers**:
  - `listPigmyCustomers`: Calls `societyPigmyService.listPigmyCustomers`
  - `getPigmyCustomerDetails`: Calls `societyPigmyService.getPigmyCustomerDetails`
  - `approvePigmyCustomer`: Calls `societyPigmyService.approvePigmyCustomer`
  - `rejectPigmyCustomer`: Calls `societyPigmyService.rejectPigmyCustomer`
  - `addSocietyAccount`: Calls `societyPigmyService.addSocietyAccount`

---

### Step 5: Define Router & RBAC Permissions
- **Target File**: [`src/panels/society/pigmy/routes/society-pigmy.routes.js`](file:///e:/office/New%20folder/sahayaone-backend/src/panels/society/pigmy/routes/society-pigmy.routes.js)
- **Middleware Chain**:
  - `rbacMiddleware.requireAuth`
  - `resolveSocietyContext`
  - `rbacMiddleware.requireRoles(['SUPER_ADMIN', 'SOCIETY_ADMIN', 'BANK_ADMIN', 'BANK_OWNER', 'OWNER', 'CHAIRMAN', 'ADMIN', 'BRANCH_MANAGER', 'MANAGER', 'QC_EMPLOYEE', 'QC_OFFICER', 'QUALITY_CHECK', 'QUALITY_CHECKER', 'EMPLOYEE', 'BRANCH_STAFF'])`

- **Endpoints**:
  - `GET /` -> `listPigmyCustomers`
  - `GET /:id` -> `getPigmyCustomerDetails`
  - `POST /society-account` -> `addSocietyAccount`
  - `POST /:id/society-account` -> `addSocietyAccount`
  - `POST /:id/approve` -> `approvePigmyCustomer`
  - `POST /:id/reject` -> `rejectPigmyCustomer`

---

### Step 6: Route Export & Gateway Mounting
- **Target Files**:
  - [`src/panels/society/pigmy/index.js`](file:///e:/office/New%20folder/sahayaone-backend/src/panels/society/pigmy/index.js): Exports `societyPigmyRouter`.
  - [`src/panels/society/component.routes.js`](file:///e:/office/New%20folder/sahayaone-backend/src/panels/society/component.routes.js): Mounted under `/pigmy-customers` and `/pigmy`.
  - [`src/app.js`](file:///e:/office/New%20folder/sahayaone-backend/src/app.js): Mounted under `/api/v1/society/pigmy-customers` and `/api/v1/society/pigmy`.

---

## 3. Verification & Testing Summary

### Test Execution Results
An automated integration test script was executed against the MongoDB database instance:

1. **Step 1: Attempt Approval Without Society Account**:
   - **Result**: `PASS`
   - **Output**: Threw `400 Bad Request` with message:
     `Cannot approve Pigmy Customer [PIG-TEST-9721]: Customer society account number is missing or does not exist. Please add society account details first before approval.`
2. **Step 2: Add Society Account**:
   - **Result**: `PASS`
   - **Output**: `ACC-SB-998811-TEST` successfully added to `PigmyCustomer` and synced to `SocietyCustomerLink`.
3. **Step 3: Attempt Approval After Adding Society Account**:
   - **Result**: `PASS`
   - **Output**: Application approved successfully:
     - `approvalStatus`: `"APPROVED"`
     - `status`: `"ACTIVE"`
     - `startDate`: `"2026-09-06T17:55:54.673Z"`
     - `endDate`: `"2027-03-06T17:55:54.673Z"` (6 Months Tenure)
     - `mandateStatus`: `"ACTIVE"`
     - `societyAccount`: Correctly populated in formatted details object.
