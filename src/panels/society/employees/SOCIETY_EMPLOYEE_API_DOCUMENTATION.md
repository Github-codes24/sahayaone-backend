# API Documentation: Society Employee & HR Module

Comprehensive API Reference Documentation for the **Society Employee Management** and **HR Sub-Module** in the Sahayaone Enterprise Backend Gateway.

---

## 📌 Gateway Base Paths & Context Setup

- **Main Employee Base Route**: `/api/v1/society/employees`
- **HR Sub-Module Base Route**: `/api/v1/society/employees/hr`
- **Authentication**: All endpoints require a valid Bearer JWT Token (`rbacMiddleware.requireAuth`).
- **Tenant Context**: Automatically resolved via `resolveSocietyContext` (`req.society.bankId`, `req.society.branchId`, `req.society.isBankOwner`, `req.society.isBranchManager`).

---

## 📋 Comprehensive API Summary

### 1. Main Employee Management Routes (`society-employee.routes.js`)

| Method           | Endpoint                   | Access / Permission                           | Description                                                    |
| :--------------- | :------------------------- | :-------------------------------------------- | :------------------------------------------------------------- |
| `POST`           | `/`                        | `employee.create`                             | Create a new employee                                          |
| `GET`            | `/`                        | `employee.view`                               | List employees (filters: search, status, city, state, deleted) |
| `GET`            | `/locations` (or `/location`) | `Super Admin` / `Bank Owner` / `Branch Manager` / `HR` | List employees location coordinates (Latitude & Longitude)     |
| `GET`            | `/:id/location` (or `/location/:id`) | `Super Admin` / `Bank Owner` / `Branch Manager` / `HR` | Get specific employee location coordinates (Latitude & Longitude) |
| `GET`            | `/:id`                     | `employee.view`                               | Get employee details by ID                                     |
| `PUT`            | `/:id`                     | `employee.update`                             | Update complete employee profile                               |
| `DELETE`         | `/:id`                     | `employee.delete`                             | Deactivate (soft delete) or hard delete employee               |
| `PATCH` / `POST` | `/:id/restore`             | `Bank Owner` / `Branch Manager`               | Restore a soft-deleted employee                                |
| `PATCH`          | `/:id/role`                | `employee.update`                             | Reassign employee role                                         |
| `PATCH`          | `/:id/branch`              | `employee.update`                             | Reassign employee branch                                       |
| `PATCH`          | `/:id/personal-details`    | `employee.update`                             | Update HR Personal Details section                             |
| `PATCH`          | `/:id/job-details`         | `employee.update`                             | Update HR Job Details section                                  |
| `PATCH`          | `/:id/shift-settings`      | `employee.update`                             | Update Shift & Timing configurations                           |
| `PATCH`          | `/:id/attendance-settings` | `employee.update`                             | Update Attendance & Overtime rules                             |
| `PATCH`          | `/:id/woff-hoff-settings`  | `employee.update`                             | Update Weekly Off / Holiday / Leave rules                      |
| `PATCH`          | `/:id/kra-settings`        | `employee.update`                             | Update KRA performance target settings                         |



---

### 2. HR Sub-Module Routes (`society-employee-hr.routes.js`)

| Method | Endpoint                       | Access / Restriction            | Description                                                                                                                     |
| :----- | :----------------------------- | :------------------------------ | :------------------------------------------------------------------------------------------------------------------------------ |
| `POST` | `/hr/work-reports`             | Authenticated Staff             | Log a daily work report                                                                                                         |
| `GET`  | `/hr/work-reports`             | Authenticated Staff             | List daily work reports (paginated)                                                                                             |
| `GET`  | `/hr/work-reports/export`      | Authenticated Staff             | Export daily work reports to CSV                                                                                                |
| `GET`  | `/hr/kpa-reports`              | Authenticated Staff             | List KPA performance overview                                                                                                   |
| `GET`  | `/hr/kpa-reports/export`       | Authenticated Staff             | Export KPA reports to CSV                                                                                                       |
| `GET`  | `/hr/:id/kpa-reports/detail`   | Authenticated Staff             | Get KPA targets progress detail for employee                                                                                    |
| `GET`  | `/hr/product-incentives`       | Authenticated Staff             | Get universal product incentive configurations for the bank                                                                     |
| `POST` / `PUT` | `/hr/product-incentives` | Authenticated Staff             | Add or update universal product incentive configuration                                                                         |
| `GET`  | `/hr/important-dates`          | Authenticated Staff             | List upcoming Birthdays & Anniversaries feed                                                                                    |
| `GET`  | `/hr/breakdown`                | Authenticated Staff             | Get Employee Breakdown statistics (dept, desg, branch, gender, salary) & paginated list (filters: search, employeeId, branchId) |
| `POST` | `/hr/letters/offer`            | `Bank Owner Only`               | Generate Offer Letter PDF                                                                                                       |
| `POST` | `/hr/letters/confirmation`     | `Bank Owner Only`               | Generate Employment Confirmation Letter PDF                                                                                     |
| `POST` | `/hr/letters/performance`      | `Bank Owner Only`               | Generate Performance Appraisal Letter PDF                                                                                       |
| `POST` | `/hr/letters/promotion`        | `Bank Owner Only`               | Generate Promotion Letter PDF                                                                                                   |
| `POST` | `/hr/letters/transfer`         | `Bank Owner Only`               | Generate Branch Transfer Letter PDF                                                                                             |
| `POST` | `/hr/letters/salary-slip`      | `Bank Owner Only`               | Generate Detailed Salary Slip PDF                                                                                               |
| `POST` | `/hr/letters/salary-increment` | `Bank Owner Only`               | Generate Salary Increment Letter PDF                                                                                            |
| `POST` | `/hr/letters/termination`      | `Bank Owner Only`               | Generate Termination / Relieving Letter PDF                                                                                     |
| `GET`  | `/hr/letters/history`          | `Bank Owner` / `Branch Manager` | List Employee Letter History Logs (filters: employeeId, branchId, city, state, documentType, search)                            |
| `PATCH`| `/hr/bank/signature`            | `Bank Owner Only`               | Upload & Update Bank Official Signature Image & Signatory Profile Settings                                                     |
| `GET`  | `/hr/bank/signature`            | `Bank Owner Only`               | Retrieve Bank Official Signature Image & Signatory Profile Settings                                                            |

---

## 🛠️ Main Employee Management APIs

---

### 1. Create Employee

- **HTTP Method**: `POST`
- **Route**: `/api/v1/society/employees`
- **Permission**: `employee.create`
- **Request Body**:

```json
{
  "fullName": "Rahul Sharma",
  "email": "rahul.sharma@societybank.com",
  "phoneNumber": "9876543210",
  "password": "Password@123",
  "roleId": "64bc7a2f1c8e1a1234567890",
  "branchId": "64bc7a2f1c8e1a1234567891",
  "employeeCode": "EMP-1002",
  "gender": "MALE",
  "designation": "Loan Officer",
  "department": "Credit",
  "salary": 45000,
  "joiningDate": "2026-01-15"
}
```

- **Success Response (`201 Created`)**:

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Employee created successfully.",
  "data": {
    "id": "64bc7a2f1c8e1a1234567892",
    "fullName": "Rahul Sharma",
    "email": "rahul.sharma@societybank.com",
    "role": { "id": "64bc7a2f1c8e1a1234567890", "name": "Loan Officer" },
    "branch": { "id": "64bc7a2f1c8e1a1234567891", "name": "Head Office" },
    "status": "ACTIVE"
  }
}
```

---

### 2. List Employees

- **HTTP Method**: `GET`
- **Route**: `/api/v1/society/employees`
- **Permission**: `employee.view`
- **Query Parameters**:
  - `page` (integer, default: `1`)
  - `limit` (integer, default: `10`, max: `100`)
  - `search` (string) — searches name, employeeCode, email, phoneNumber, Mongo `_id`, or `userId`
  - `employeeId` / `employeeCode` / `id` (string) — searches employee directly by employee code or Mongo `_id` / `userId`
  - `status` (`'ACTIVE'`, `'INACTIVE'`, `'ALL'`, `'DELETED'`)
  - `includeDeleted` (`true` | `false`) — includes both active and deleted records (Restricted to **Bank Owner / Super Admin** & **Branch Manager**)
  - `isDeleted` (`true` | `false`) — filters soft-deleted records exclusively (Restricted to **Bank Owner / Super Admin** & **Branch Manager**)
  - `city` (string) — filters employees in branches located in this city
  - `state` (string) — filters employees in branches located in this state
  - `branchId` (24-hex string) — filter by specific branch
  - `roleId` (24-hex string) — filter by specific role
  - `includeBranchManagers` (boolean, default: `true`)
  - `includeStats` (`true` | `false`, default: `false`) — returns full aggregate HR & employee statistics summary object
  - `sortBy` (default: `'createdAt'`), `sortOrder` (`'asc'` | `'desc'`)

- **Request Example**:

```http
GET /api/v1/society/employees?includeStats=true&city=Mumbai
Authorization: Bearer <token>
```

- **Success Response (`200 OK`)**:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Employees retrieved successfully.",
  "stats": {
    "totalEmployees": 45,
    "totalActive": 40,
    "totalSoftDeleted": 2,
    "totalBranchManagers": 5,
    "totalRegularEmployees": 40,
    "genderRatio": {
      "MALE": 28,
      "FEMALE": 16,
      "OTHER": 1
    },
    "newHiresThisMonth": 4,
    "upcomingBirthdaysThisMonth": 3,
    "departmentWise": {
      "Loans & Disbursals": 18,
      "Credit": 12,
      "Operations": 10,
      "Accounts": 5
    },
    "designationWise": {
      "Branch Manager": 5,
      "Loan Officer": 18,
      "Cashier": 12,
      "Clerk": 10
    },
    "totalMonthlySalaryBudget": 1850000,
    "averageSalary": 41111
  },
  "data": [
    {
      "srNo": 1,
      "type": "EMPLOYEE",
      "id": "64bc7a2f1c8e1a1234567892",
      "employeeCode": "EMP-1002",
      "fullName": "Rahul Sharma",
      "email": "rahul.sharma@societybank.com",
      "phoneNumber": "9876543210",
      "designation": "Loan Officer",
      "branch": {
        "id": "64bc7a2f1c8e1a1234567891",
        "name": "Mumbai Branch",
        "state": "Maharashtra"
      },
      "status": "INACTIVE"
    }
  ],
  "meta": {
    "totalRecords": 1,
    "limit": 10,
    "page": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

---

### 2b. List Employees Location Coordinates (Latitude & Longitude)

- **HTTP Method**: `GET`
- **Route**: `/api/v1/society/employees/locations`
- **Access Control**: **Super Admin**, **Bank Owner**, **Branch Manager**, and **HR / HR Executive** (`requireHrOrBankOwnerOrManager`)
- **Query Parameters**:
  - `page` (integer, default: `1`)
  - `limit` (integer, default: `10`)
  - `search` (string) — searches name, employeeCode, email, phoneNumber
  - `status` (`'ACTIVE'`, `'INACTIVE'`, `'ALL'`, `'DELETED'`)
  - `branchId` (24-hex string) — filter locations for employees in a specific branch
  - `sortBy` (default: `'createdAt'`), `sortOrder` (`'asc'` | `'desc'`)

- **Request Example**:

```http
GET /api/v1/society/employees/locations?branchId=64bc7a2f1c8e1a1234567891
Authorization: Bearer <token>
```

- **Success Response (`200 OK`)**:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Employee locations retrieved successfully.",
  "data": [
    {
      "srNo": 1,
      "type": "EMPLOYEE",
      "id": "64bc7a2f1c8e1a1234567892",
      "employeeId": "EMP-1002",
      "userId": "64bc7a2f1c8e1a1234567890",
      "employeeCode": "EMP-1002",
      "fullName": "Rahul Sharma",
      "email": "rahul.sharma@societybank.com",
      "phoneNumber": "9876543210",
      "designation": "Bank Receipt Manager",
      "department": "Loans & Disbursals",
      "bankId": "64bc7a2f1c8e1a1234567800",
      "branchId": "64bc7a2f1c8e1a1234567891",
      "branch": {
        "id": "64bc7a2f1c8e1a1234567891",
        "name": "Mumbai Branch",
        "code": "MUM01",
        "state": "Maharashtra"
      },
      "location": {
        "latitude": 19.0760,
        "longitude": 72.8777,
        "coordinates": [72.8777, 19.0760],
        "address": "123 Commercial Complex, Khamla, Nagpur, Maharashtra",
        "lastUpdatedAt": "2026-09-03T10:30:00.000Z"
      }
    }
  ],
  "meta": {
    "totalRecords": 1,
    "limit": 10,
    "page": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

---

### 3. Get Employee Details

- **HTTP Method**: `GET`
- **Route**: `/api/v1/society/employees/:id`
- **Permission**: `employee.view`
- **Description**: Returns full employee profile with HR settings (Personal Details, Job Details, Shift Settings, Attendance Settings, WOFF/HOFF Settings, KRA Settings).

---

### 3b. Get Single Employee Location Coordinates (Latitude & Longitude)

- **HTTP Method**: `GET`
- **Route**: `/api/v1/society/employees/:id/location`
- **Route Alias**: `/api/v1/society/employees/location/:id`
- **Access Control**: **Super Admin**, **Bank Owner**, **Branch Manager**, and **HR / HR Executive** (`requireHrOrBankOwnerOrManager`)
- **URL Parameters**: `:id` (Employee Mongo `_id`, `userId`, or `employeeCode`)

- **Request Example**:

```http
GET /api/v1/society/employees/64bc7a2f1c8e1a1234567892/location
# OR
GET /api/v1/society/employees/location/64bc7a2f1c8e1a1234567892
Authorization: Bearer <token>
```

- **Success Response (`200 OK`)**:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Employee location retrieved successfully.",
  "data": {
    "latitude": 19.0760,
    "longitude": 72.8777,
    "coordinates": [72.8777, 19.0760],
    "address": "123 Commercial Complex, Khamla, Nagpur, Maharashtra",
    "lastUpdatedAt": "2026-09-03T10:30:00.000Z"
  }
}
```


---

### 4. Update Employee Profile

- **HTTP Method**: `PUT`
- **Route**: `/api/v1/society/employees/:id`
- **Permission**: `employee.update`
- **Request Body**: Accepts full profile payload or partial updates.

---

### 5. Deactivate / Delete Employee

- **HTTP Method**: `DELETE`
- **Route**: `/api/v1/society/employees/:id`
- **Permission**: `employee.delete`
- **Query Parameters**: `permanent` or `force` or `isPermanent` (`true` for permanent hard delete; default: soft delete)
- **Success Response (`200 OK`)**:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Employee deactivated successfully."
}
```

---

### 6. Restore Soft-Deleted Employee

- **HTTP Method**: `PATCH` / `POST`
- **Route**: `/api/v1/society/employees/:id/restore`
- **Access Restricted To**: **Super Admin / Bank Owner** or **Branch Manager**
- **Success Response (`200 OK`)**:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Employee restored successfully.",
  "data": {
    "id": "64bc7a2f1c8e1a1234567892",
    "employeeId": "EMP-1002",
    "fullName": "Rahul Sharma",
    "status": "ACTIVE"
  }
}
```

- **Forbidden Error (`403 Forbidden`)**: If a regular employee tries to call restore:

```json
{
  "success": false,
  "statusCode": 403,
  "message": "Access denied. Only Super Admin / Bank Owner and Branch Manager can restore employees."
}
```

---

### 7. Change Employee Role

- **HTTP Method**: `PATCH`
- **Route**: `/api/v1/society/employees/:id/role`
- **Request Body**: `{ "roleId": "64bc7a2f1c8e1a1234567890" }`

---

### 8. Change Employee Branch

- **HTTP Method**: `PATCH`
- **Route**: `/api/v1/society/employees/:id/branch`
- **Request Body**: `{ "branchId": "64bc7a2f1c8e1a1234567891" }`

---

### 9. HR Tab Section Updates (6 Sub-endpoints)

- **PATCH `/:id/personal-details`**: Updates personal info (`fullName`, `email`, `phoneNumber`, `gender`, `dob`, `address`, `bloodGroup`, `password`).
- **PATCH `/:id/job-details`**: Updates job info (`designation`, `department`, `salary`, `joiningDate`, `probationPeriodMonths`).
- **PATCH `/:id/shift-settings`**: Updates timings (`punchInTime`, `punchOutTime`, `lateAllowedMinutes`, `halfDayMinutes`, `fullDayMinutes`, `weeklyOff`).
- **PATCH `/:id/attendance-settings`**: Updates punch mode (`SINGLE`/`DOUBLE`/`MULTIPLE`), no-out-punch rules, overtime rules, late cut policies.
- **PATCH `/:id/woff-hoff-settings`**: Updates weekly off rules, holiday rules, sandwich leave rules, encashment rules.
- **PATCH `/:id/kra-settings`**: Updates KRA goals (`year`, `targets` array with `product`, `targetType`, `targetValue`).

---

## 📊 HR Sub-Module APIs (`/api/v1/society/employees/hr`)

---

### 10. Log Daily Work Report

- **HTTP Method**: `POST`
- **Route**: `/api/v1/society/employees/hr/work-reports`
- **Description**: Log a manual daily work report entry. *(Note: Work reports are also automatically recorded when system events occur, such as receipt approvals or cash collections).*
- **Request Body**:

```json
{
  "employeeId": "64bc7a2f1c8e1a1234567892",
  "date": "2026-08-24",
  "product": "Loan Disbursement",
  "amount": 200000,
  "remarks": "Achieved daily disbursal target."
}
```

- **Success Response (`201 Created`)**:

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Daily Work Report logged successfully.",
  "data": {
    "id": "64c5d82a1c8e1a0987654321",
    "product": "Loan Disbursement",
    "amount": 200000,
    "date": "2026-08-24T00:00:00.000Z",
    "isAutoGenerated": false,
    "sourceModule": "MANUAL",
    "referenceId": null
  }
}
```

---

### 11. List Daily Work Reports

- **HTTP Method**: `GET`
- **Route**: `/api/v1/society/employees/hr/work-reports`
- **Query Parameters**: `page`, `limit`, `search`, `designations`, `states`, `branchId` / `branchIds`, `date`

---

### 12. Export Daily Work Reports (CSV)

- **HTTP Method**: `GET`
- **Route**: `/api/v1/society/employees/hr/work-reports/export`
- **Header**: `Content-Type: text/csv`

---

### 13. List KPA Reports

- **HTTP Method**: `GET`
- **Route**: `/api/v1/society/employees/hr/kpa-reports`
- **Query Parameters**: `page`, `limit`, `search`, `designations`, `states`, `branchId`, `startDate`, `endDate`

---

### 14. Export KPA Reports (CSV)

- **HTTP Method**: `GET`
- **Route**: `/api/v1/society/employees/hr/kpa-reports/export`
- **Header**: `Content-Type: text/csv`

---

### 15. Get Employee KPA Progress Detail

- **HTTP Method**: `GET`
- **Route**: `/api/v1/society/employees/hr/:id/kpa-reports/detail`
- **Query Parameters**: `year` (e.g. `2026`), `product` (e.g. `"Loan Disbursement"`)
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
      "designation": "Loan Officer"
    },
    "product": "Loan Disbursement",
    "year": 2026,
    "yearly": { "goal": 2400000, "achieved": 1440000, "percentage": 60 },
    "monthly": { "goal": 200000, "achieved": 130000, "percentage": 65 },
    "weekly": { "goal": 50000, "achieved": 36000, "percentage": 72 },
    "daily": { "goal": 10000, "achieved": 8000, "percentage": 80 }
  }
}
```

---

### 16. List Important Dates Feed

- **HTTP Method**: `GET`
- **Route**: `/api/v1/society/employees/hr/important-dates`
- **Query Parameters**: `search`, `celebrationTypes` (`Birthday`, `Work Anniversary`, `Marriage Anniversary`), `date`, `month`

---

### 17. Get Employee Breakdown & Statistics

- **HTTP Method**: `GET`
- **Route**: `/api/v1/society/employees/hr/breakdown` (Alias: `/api/v1/society/employees/hr/employee-breakdown`)
- **Access Isolation**: Automatically restricted to the logged-in user's branch for Branch Users / Branch Managers.
- **Query Parameters**:
  - `search` (string) — searches full name, employeeCode, email, phone number
  - `employeeId` / `employeeCode` (string) — specific search by employee ID or employee code
  - `branchId` (24-hex string) / `branchIds` (string or array) — filter by target branch(es) (Bank Owner context only)
  - `status` (`'ACTIVE'`, `'INACTIVE'`, `'ALL'`, `'DELETED'`, default: `'ACTIVE'`)
  - `department` (string or array) — filter by department(s)
  - `designations` (string or array) — filter by designation(s)
  - `states` (string or array) — filter by state(s)
  - `sortBy` (default: `'createdAt'`), `sortOrder` (`'asc'` | `'desc'`)

- **Success Response (`200 OK`)**:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Employee breakdown statistics and list retrieved successfully.",
  "data": {
    "breakdown": {
      "totalEmployees": 45,
      "activeEmployees": 40,
      "inactiveEmployees": 5,
      "departmentWise": {
        "Loans & Disbursals": { "count": 20, "percentage": 44 },
        "Credit": { "count": 15, "percentage": 33 },
        "Accounts": { "count": 10, "percentage": 22 }
      },
      "designationWise": {
        "Loan Officer": { "count": 20, "percentage": 44 },
        "Branch Manager": { "count": 5, "percentage": 11 }
      },
      "branchWise": {
        "Head Office": { "count": 25, "percentage": 56 },
        "Mumbai Branch": { "count": 20, "percentage": 44 }
      },
      "genderRatio": {
        "MALE": 28,
        "FEMALE": 16,
        "OTHER": 1
      },
      "salarySummary": {
        "totalMonthlyBudget": 1850000,
        "formattedTotalMonthlyBudget": "₹18,50,000",
        "averageSalary": 41111,
        "formattedAverageSalary": "₹41,111",
        "minSalary": 25000,
        "formattedMinSalary": "₹25,000",
        "maxSalary": 85000,
        "formattedMaxSalary": "₹85,000"
      }
    },
    "items": [
      {
        "srNo": 1,
        "id": "64bc7a2f1c8e1a1234567892",
        "employeeCode": "EMP-1002",
        "employeeId": "EMP-1002",
        "fullName": "Rahul Sharma",
        "email": "rahul.sharma@societybank.com",
        "phoneNumber": "9876543210",
        "designation": "Loan Officer",
        "department": "Credit",
        "branch": {
          "id": "64bc7a2f1c8e1a1234567891",
          "name": "Mumbai Branch",
          "code": "MUM01",
          "state": "Maharashtra"
        },
        "status": "ACTIVE",
        "salary": 45000,
        "formattedSalary": "₹45,000",
        "joiningDate": "2026-01-15T00:00:00.000Z",
        "dutyHours": "09:30 to 18:30",
        "weeklyOff": "Sunday"
      }
    ],
    "totalRecords": 45
  }
}
```

---

### 18–25. PDF Letters & Payroll Document Generators

> 🔒 **Access Restricted**: **Bank Owner Only** (`requireBankOwner`).
> 💡 **Dual Response Format Support**:
> - **JSON Mode**: If client sends `Accept: application/json` header or `?format=json` query param, the endpoint returns a JSON response containing `fileUrl` (S3/storage URL) and `fileKey`.
> - **Binary Stream Mode**: Standard request returns the raw PDF binary stream for direct download, and exposes the S3 URL in response header `X-File-Url`.
>
> ✒️ **Mandatory Digital Signature Requirement**:
> - Every generated PDF letter automatically renders the bank's official signature image graphic directly above the `___________________________` signature line.
> - **Validation Rule**: An official Bank Authorized Signature **MUST exist** (either saved in Bank profile via `PATCH /hr/bank/signature` or passed in the request body as `signatureUrl` / `signatureBase64`). If no signature image exists, the API returns `400 Bad Request`:
>   ```json
>   {
>     "success": false,
>     "statusCode": 400,
>     "errorCode": "BAD_REQUEST",
>     "message": "Official Bank Authorized Signature image is required to generate employee letters. Please upload the bank signature first."
>   }
>   ```
> - **Optional Per-Letter Overrides**: You can pass `signatoryName`, `signatoryDesignation`, `signatureUrl`, or `signatureBase64` in the POST request body of any letter endpoint to override the bank's default signature per letter.

#### Available Endpoints:

1. **Offer Letter**: `POST /api/v1/society/employees/hr/letters/offer`
2. **Confirmation Letter**: `POST /api/v1/society/employees/hr/letters/confirmation`
3. **Performance Letter**: `POST /api/v1/society/employees/hr/letters/performance`
4. **Promotion Letter**: `POST /api/v1/society/employees/hr/letters/promotion`
5. **Transfer Letter**: `POST /api/v1/society/employees/hr/letters/transfer`
6. **Salary Slip**: `POST /api/v1/society/employees/hr/letters/salary-slip`
7. **Salary Increment**: `POST /api/v1/society/employees/hr/letters/salary-increment`
8. **Termination Letter**: `POST /api/v1/society/employees/hr/letters/termination`

#### Sample Request Body (with optional Signature Overrides):

```json
{
  "employeeId": "64bc7a2f1c8e1a1234567892",
  "signatoryName": "Aman Verma",
  "signatoryDesignation": "Head - Human Resources",
  "signatureUrl": "https://storage.sahayaone.com/society/banks/66ca1a00/signature/bank_signature.png"
}
```

#### Sample JSON Response (`Accept: application/json` or `?format=json`):

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Offer letter generated successfully.",
  "data": {
    "employeeId": "64bc7a2f1c8e1a1234567892",
    "referenceNumber": "KHAMLA/HR/OL/2026/001",
    "fileUrl": "https://s3.ap-south-1.amazonaws.com/your-bucket/society/employees/bankId/empId/offer-letter/Offer_Letter_KHAMLA_HR_OL_2026_001.pdf",
    "fileKey": "society/employees/bankId/empId/offer-letter/Offer_Letter_KHAMLA_HR_OL_2026_001.pdf",
    "candidateName": "Rahul Sharma",
    "designation": "Loan Officer",
    "totalCtc": "Rs. 4,50,000",
    "generatedAt": "2026-08-26T13:15:00.000Z"
  }
}
```

#### Sample Binary PDF Download Response Headers:

```http
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename=Offer_Letter_64bc7a2f1c8e1a1234567892.pdf
X-File-Url: https://s3.ap-south-1.amazonaws.com/your-bucket/society/employees/bankId/empId/offer-letter/Offer_Letter_KHAMLA_HR_OL_2026_001.pdf
Access-Control-Expose-Headers: Content-Disposition, X-File-Url
```

---

### 26. Employee Letter History Logs

- **HTTP Method**: `GET`
- **Route**: `/api/v1/society/employees/hr/letters/history` (or `/api/v1/society/employees/hr/letter-history`)
- **Access Control**:
  - **Bank Owner**: Access logs across **all branches** of the bank. Accepts `branchId`, `city`, `state` filters.
  - **Branch Manager**: Access logs scoped to their assigned branch.
- **Query Parameters**:
  | Parameter | Type | Description |
  | :--- | :--- | :--- |
  | `page` | Integer | Page number (default: `1`) |
  | `limit` | Integer | Records per page (default: `10`) |
  | `search` | String | Search on `referenceNumber`, `employeeName`, `employeeEmail`, `detailsSummary`, `documentType` |
  | `employeeId` | String (Hex24) | Filter history logs for a specific employee |
  | `branchId` | String (Hex24) | Filter history logs by specific branch |
  | `city` | String / Array | Filter history logs by branch city (e.g. `Mumbai`, `Pune`) |
  | `state` | String / Array | Filter history logs by branch state (e.g. `Maharashtra`) |
  | `documentType` | String | Filter by letter type e.g. `Offer Letter`, `Salary Slip`, `Confirmation Letter`, `OFFER_LETTER`, `SALARY_SLIP` |
  | `sortBy` | String | Sort field (default: `issuedDate`) |
  | `sortOrder` | String | Sort direction: `asc` or `desc` (default: `desc`) |

- **Success Response (`200 OK`)**:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Employee letter history logs retrieved successfully.",
  "data": [
    {
      "srNo": 1,
      "id": "66ca2b1e8f2a1b0011223344",
      "referenceNumber": "KHAMLA/HR/OL/2026/001",
      "employeeId": "64bc7a2f1c8e1a1234567890",
      "employeeName": "Aman Sharma",
      "employeeEmail": "aman.sharma@sahayaone.com",
      "employeeCode": "EMP-1001",
      "branchId": "64bc7a2f1c8e1a1234567891",
      "branchName": "Khamla Branch",
      "branchCity": "Nagpur",
      "branchState": "Maharashtra",
      "documentType": "Offer Letter",
      "documentTypeCode": "OFFER_LETTER",
      "issuedDate": "2026-08-22T00:00:00.000Z",
      "formattedIssuedDate": "22/08/2026",
      "detailsSummary": "Designation: Senior Loan Officer | CTC: ₹4,50,000",
      "fileUrl": "https://storage.example.com/society/employees/bankId/empId/offer-letter/Offer_Letter_KHAMLA_HR_OL_2026_001.pdf",
      "fileKey": "society/employees/bankId/empId/offer-letter/Offer_Letter_KHAMLA_HR_OL_2026_001.pdf",
      "createdAt": "2026-08-22T10:30:00.000Z"
    },
    {
      "srNo": 2,
      "id": "66ca2b1e8f2a1b0011223345",
      "referenceNumber": "KHAMLA/HR/SS/2026/08/001",
      "employeeId": "64bc7a2f1c8e1a1234567892",
      "employeeName": "Lala Patil",
      "employeeEmail": "lala.patil@sahayaone.com",
      "employeeCode": "EMP-1002",
      "branchId": "64bc7a2f1c8e1a1234567891",
      "branchName": "Khamla Branch",
      "branchCity": "Nagpur",
      "branchState": "Maharashtra",
      "documentType": "Salary Slip",
      "documentTypeCode": "SALARY_SLIP",
      "issuedDate": "2026-08-19T00:00:00.000Z",
      "formattedIssuedDate": "19/08/2026",
      "detailsSummary": "Period: August 2026 | Net Salary: ₹48,000",
      "fileUrl": "https://storage.example.com/society/employees/bankId/empId/salary-slip/Salary_Slip_KHAMLA_HR_SS_2026_08_001.pdf",
      "fileKey": "society/employees/bankId/empId/salary-slip/Salary_Slip_KHAMLA_HR_SS_2026_08_001.pdf",
      "createdAt": "2026-08-19T14:15:00.000Z"
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
```

---

## 📩 13. Send MSG91 Email Notification for Employee Letters

Dispatches or resends an official HR Letter notification email to an employee via **MSG91 Email Builder** using the template ID configured in `panel-control.config.js`.

- **HTTP Method**: `POST`
- **URL**: `http://localhost:5001/api/v1/society/employees/hr/letters/send-email`
- **Alternative URL (By Log ID)**: `http://localhost:5001/api/v1/society/employees/hr/letters/:logId/send-email`
- **Permission**: Allowed for **Bank Owner**, **Branch Manager**, and **HR / HR Executive**. (_Branch Managers / Branch Members are restricted to employees associated with their assigned branch_).

> 💡 **Note**: `logId` is **OPTIONAL**!
> If you don't have a `logId`, you do NOT need to pass it. You can send an email by simply providing `employeeId` and `documentTypeCode`.

> 📎 **Automatic PDF Email Attachments**:
> All employee letters (Offer Letter, Confirmation Letter, Performance Letter, Promotion Letter, Transfer Letter, Salary Slip, Increment Letter, Termination Letter) are automatically sent with the PDF document attached to the email.
>
> **Key Implementation Details**:
>
> - **Email Provider Attachment Support (`msg91-email.provider.js`)**: Added attachment formatting in `Msg91EmailProvider` to parse Base64, Buffers, or file objects and attach them directly to MSG91 Email API (`v5/email/send`) requests under the `attachments` payload array.
> - **PDF Attachment Resolution in HR Email Service (`hr-letter-email.service.js`)**: Updated `hrLetterEmailService.sendLetterEmail` to resolve PDF document buffers:
>   - **Direct Buffer**: Uses `options.pdfBuffer` if supplied.
>   - **Remote URL / Local Storage**: Fetches/reads existing PDF files from `fileUrl` (S3/HTTP URL or local file path).
>   - **Auto-Generation Fallback**: Dynamically generates the PDF document for the letter type if no stored PDF buffer is found.
>   - **Filename**: Formats the PDF filename dynamically (e.g. `offer-letter_Bhushan_Sahare.pdf`) and passes it into `mailer.sendMail({ ..., attachments })`.

### MSG91 Email Template Mapping (`panel-control.config.js`):

| Document Type       | Document Code                           | Config Template Key (`SOCIETY_PANEL`) | MSG91 Template ID                              |
| :------------------ | :-------------------------------------- | :------------------------------------ | :--------------------------------------------- |
| Offer Letter        | `OFFER_LETTER`                          | `OFFER_LETTER`                        | `hr_employee_offer_letter_notification`        |
| Confirmation Letter | `CONFIRMATION_LETTER`                   | `CONFIRMATION_LETTER`                 | `hr_employee_confirmation_letter_notification` |
| Performance Letter  | `PERFORMANCE_LETTER`                    | `PERFORMANCE_LETTER`                  | `template_20_08_2026_16_08`                    |
| Promotion Letter    | `PROMOTION_LETTER`                      | `PROMOTION_LETTER`                    | `hr_employee_promotion_letter_notification`    |
| Transfer Letter     | `TRANSFER_LETTER`                       | `TRANSFER_LETTER`                     | `hr_employee_transfer_letter_notification`     |
| Salary Slip         | `SALARY_SLIP`                           | `SALARY_SLIP`                         | `hr_employee_salary_slip_notification_2`       |
| Salary Increment    | `INCREMENT_LETTER` / `SALARY_INCREMENT` | `INCREMENT_LETTER`                    | `hr_employee_salary_increment_notification`    |
| Termination Letter  | `TERMINATION_LETTER`                    | `TERMINATION_LETTER`                  | `hr_employee_termination_letter_notification`  |

### 🧪 Test Case 1: Send Offer Letter Email via MSG91

- **URL**: `http://localhost:5001/api/v1/society/employees/hr/letters/send-email`
- **HTTP Method**: `POST`
- **Headers**:
  ```http
  Authorization: Bearer <ACCESS_TOKEN>
  Content-Type: application/json
  ```
- **Request Body (JSON)**:

  ```json
  {
    "logId": "66ca2b1e8f2a1b0011223344",
    "employeeId": "64bc7a2f1c8e1a1234567892",
    "documentTypeCode": "OFFER_LETTER",
    "customEmail": "stark@bank.com",
    "variables": {
      "reportingManager": "Aman Verma",
      "placeOfPosting": "Nagpur Khamla Branch"
    }
  }
  ```

- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Email notification sent successfully to stark@bank.com with PDF attachment.",
    "data": {
      "recipientEmail": "stark@bank.com",
      "templateId": "hr_employee_offer_letter_notification",
      "documentTypeCode": "OFFER_LETTER",
      "hasAttachment": true,
      "messageId": "msg_91_unique_id"
    }
  }
  ```

### 🧪 Test Case 2: Send Email Without `logId` (Using `employeeId` & `documentTypeCode`)

> 💡 **When to Omit `logId`**: You do **NOT** need a `logId` to send an employee letter email. Providing just `employeeId` and `documentTypeCode` will automatically locate the employee and attach their PDF letter.

- **URL**: `http://localhost:5001/api/v1/society/employees/hr/letters/send-email`
- **HTTP Method**: `POST`
- **Headers**:
  ```http
  Authorization: Bearer <ACCESS_TOKEN>
  Content-Type: application/json
  ```
- **Request Body (JSON)**:
  ```json
  {
    "employeeId": "64bc7a2f1c8e1a1234567892",
    "documentTypeCode": "OFFER_LETTER"
  }
  ```

- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Email notification sent successfully to rahul.sharma@societybank.com with PDF attachment.",
    "data": {
      "recipientEmail": "rahul.sharma@societybank.com",
      "templateId": "hr_employee_offer_letter_notification",
      "documentTypeCode": "OFFER_LETTER",
      "hasAttachment": true,
      "messageId": "msg_91_unique_id"
    }
  }
  ```

---

### 📌 How to Pass `logId` (3 Flexible Options)

When sending an email notification for a specific letter log entry recorded in letter history, you can pass `logId` in **3 different ways**:

#### Option 1: Pass `logId` in Request Body
- **URL**: `http://localhost:5001/api/v1/society/employees/hr/letters/send-email`
- **HTTP Method**: `POST`
- **Request Body (JSON)**:
  ```json
  {
    "logId": "66ca2b1e8f2a1b0011223344"
  }
  ```
  *(When `logId` is provided, `employeeId` and `documentTypeCode` are automatically resolved from that log record!)*

#### Option 2: Pass `logId` in URL Path
- **URL**: `http://localhost:5001/api/v1/society/employees/hr/letters/66ca2b1e8f2a1b0011223344/send-email`
- **HTTP Method**: `POST`
- **Request Body (JSON)**: `{}`

#### Option 3: Omit `logId` Completely (Direct Send via `employeeId`)
- **URL**: `http://localhost:5001/api/v1/society/employees/hr/letters/send-email`
- **HTTP Method**: `POST`
- **Request Body (JSON)**:
  ```json
  {
    "employeeId": "64bc7a2f1c8e1a1234567892",
    "documentTypeCode": "OFFER_LETTER"
  }
  ```

---

## ✒️ 14. Bank Official Signature & Signatory Management APIs

Bank Owners can upload and configure their bank's official signature image graphic (PNG/JPEG) and signatory details once. All 8 employee letters automatically render this signature image directly above the signatory line in generated PDFs.

### 14.1 Upload & Update Bank Signature Settings
- **HTTP Method**: `PATCH` / `POST`
- **URL**: `http://localhost:5001/api/v1/society/employees/hr/bank/signature`
- **Alternative URL**: `http://localhost:5001/api/v1/society/bank/signature`
- **Permission**: Allowed for **Bank Owner**, **Branch Manager**, and **HR / HR Executive**.
- **Content-Type**: `multipart/form-data` or `application/json`

#### Multipart Form Parameters:
- `signature` (File, Optional): PNG/JPEG signature image file.
- `signatoryName` (Text, Optional): Name of Authorized Signatory (e.g. `Aman Verma`).
- `signatoryDesignation` (Text, Optional): Title of Authorized Signatory (e.g. `Head - Human Resources`).
- `signatureUrl` (Text, Optional): Direct HTTP/S3 URL of signature image.
- `signatureBase64` (Text, Optional): Data URI / Base64 string of signature image (`data:image/png;base64,...`).

#### Sample Success Response (`200 OK`):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Bank signature and authorized signatory profile updated successfully.",
  "data": {
    "bankId": "66ca1a001122334455667788",
    "bankName": "ASB Bank Co-operative Society Ltd.",
    "signatoryName": "Aman Verma",
    "signatoryDesignation": "Head - Human Resources",
    "signatureUrl": "https://storage.sahayaone.com/society/banks/66ca1a00/signature/bank_signature.png",
    "signatureKey": "society/banks/66ca1a00/signature/bank_signature.png",
    "updatedAt": "2026-08-26T11:00:00.000Z"
  }
}
```

### 14.2 Retrieve Bank Signature Settings
- **HTTP Method**: `GET`
- **URL**: `http://localhost:5001/api/v1/society/employees/hr/bank/signature`
- **Permission**: Allowed for **Bank Owner**, **Branch Manager**, and **HR / HR Executive**.

#### Sample Success Response (`200 OK`):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Bank signature and authorized signatory profile retrieved successfully.",
  "data": {
    "bankId": "66ca1a001122334455667788",
    "bankName": "ASB Bank Co-operative Society Ltd.",
    "signatoryName": "Aman Verma",
    "signatoryDesignation": "Head - Human Resources",
    "signatureUrl": "https://storage.sahayaone.com/society/banks/66ca1a00/signature/bank_signature.png",
    "signatureKey": "society/banks/66ca1a00/signature/bank_signature.png"
  }
}
```

