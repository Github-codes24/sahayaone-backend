# API Documentation: Society Branch Management Module

Comprehensive API Reference Documentation for **Branch Management** and **Branch Manager HR Settings** in the Sahayaone Enterprise Backend Gateway.

---

## 📌 Gateway Base Paths & Context Setup

- **Base Route**: `/api/v1/society/branches`
- **Authentication**: All endpoints require a valid Bearer JWT Token (`rbacMiddleware.requireAuth`).
- **Tenant Context**: Automatically resolved via `resolveSocietyContext` (`req.society.bankId`, `req.society.branchId`, `req.society.isBankOwner`, `req.society.isBranchManager`).
- **Access Isolation**: Branch Managers calling list/dropdown APIs are automatically restricted to their assigned branch data.

---

## 📋 Comprehensive API Summary Table

| Method   | Endpoint                           | Permission / Access | Description                                                                                     |
| :------- | :--------------------------------- | :------------------ | :---------------------------------------------------------------------------------------------- |
| `POST`   | `/`                                | `branch.create`     | Create a new Branch & assigned Branch Manager                                                   |
| `GET`    | `/`                                | `branch.view`       | List all branches with filters (`search`, `status`, `city`, `state`, pagination)                |
| `GET`    | `/available-locations`             | `branch.view`       | Dropdown feed of available distinct `cities`, `states`, and state-to-cities `locations` mapping |
| `GET`    | `/cities-states`                   | `branch.view`       | Alias endpoint for available cities and states dropdown                                         |
| `GET`    | `/locations`                       | `branch.view`       | Alias endpoint for available cities and states dropdown                                         |
| `GET`    | `/dropdown`                        | `branch.view`       | Lightweight dropdown list (returns branch ID, branch name, code, state, city)                   |
| `GET`    | `/:id`                             | `branch.view`       | Get single Branch details by ID                                                                 |
| `PUT`    | `/:id`                             | `branch.update`     | Update Branch general details, card stock, and verification credits                             |
| `DELETE` | `/:id`                             | `branch.delete`     | Deactivate / Soft delete a Branch                                                               |
| `GET`    | `/:id/manager`                     | `branch.view`       | Get full Branch Manager profile with all 6 HR sections                                          |
| `PUT`    | `/:id/manager`                     | `branch.update`     | Update complete Branch Manager profile                                                          |
| `PATCH`  | `/:id/manager/personal-details`    | `branch.update`     | Update HR Personal Details section                                                              |
| `PATCH`  | `/:id/manager/job-details`         | `branch.update`     | Update HR Job Details section                                                                   |
| `PATCH`  | `/:id/manager/shift-settings`      | `branch.update`     | Update Shift & Timing configurations                                                            |
| `PATCH`  | `/:id/manager/attendance-settings` | `branch.update`     | Update Attendance & Overtime rules                                                              |
| `PATCH`  | `/:id/manager/woff-hoff-settings`  | `branch.update`     | Update Weekly Off / Holiday / Leave rules                                                       |
| `PATCH`  | `/:id/manager/kra-settings`        | `branch.update`     | Update KRA performance target settings                                                          |

---

## 🛠️ API Endpoint Specifications

---

### 1. Create Branch & Branch Manager

- **HTTP Method**: `POST`
- **Route**: `/api/v1/society/branches`
- **Permission**: `branch.create` (Bank Owner / Society Admin)
- **Request Body**:

```json
{
  "branch": {
    "name": "Mumbai Fort Branch",
    "code": "MUM01",
    "email": "mumbai.fort@societybank.com",
    "phoneNumber": "02222661122",
    "state": "Maharashtra",
    "address": {
      "addressLine1": "Fort Commercial Complex, MG Road",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001"
    },
    "cardStock": 100,
    "verificationCredits": 50
  },
  "manager": {
    "fullName": "Amit Verma",
    "email": "amit.verma@societybank.com",
    "phoneNumber": "9876543210",
    "password": "Password@123",
    "employeeCode": "BM-MUM-101",
    "personalDetails": {
      "gender": "MALE",
      "dateOfBirth": "1988-05-15"
    },
    "jobDetails": {
      "designation": "Branch Manager",
      "department": "Branch Operations",
      "salary": 75000,
      "joiningDate": "2026-01-01"
    }
  }
}
```

- **Success Response (`201 Created`)**:

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Branch and Branch Manager created successfully.",
  "data": {
    "id": "64bc7a2f1c8e1a1234567891",
    "branchCode": "MUM01",
    "name": "Mumbai Fort Branch",
    "status": "ACTIVE",
    "manager": {
      "id": "64bc7a2f1c8e1a1234567892",
      "fullName": "Amit Verma",
      "email": "amit.verma@societybank.com"
    }
  }
}
```

---

### 2. List Branches (With City & State Filters)

- **HTTP Method**: `GET`
- **Route**: `/api/v1/society/branches`
- **Permission**: `branch.view`
- **Query Parameters**:
  - `page` (integer, default: `1`)
  - `limit` (integer, default: `10`)
  - `search` (string) — searches name, code, email, phone number, state, city
  - `status` (`'ACTIVE'`, `'INACTIVE'`, `'ALL'`)
  - `state` (string) — filter by state name (matches `state` and `address.state`)
  - `city` (string) — filter by city name (matches `city` and `address.city`)
  - `sortBy` (default: `'createdAt'`), `sortOrder` (`'asc'` | `'desc'`)

- **Request Example**:

```http
GET /api/v1/society/branches?city=Mumbai&state=Maharashtra&status=ACTIVE
Authorization: Bearer <token>
```

- **Success Response (`200 OK`)**:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Branches retrieved successfully.",
  "data": {
    "stats": {
      "totalBranches": 5,
      "availableCardStock": 1200,
      "availableVerificationCredits": 650,
      "totalEmployees": 42,
      "totalMerchants": 18
    },
    "items": [
      {
        "srNo": 1,
        "id": "64bc7a2f1c8e1a1234567891",
        "name": "Mumbai Fort Branch",
        "code": "MUM01",
        "email": "mumbai.fort@societybank.com",
        "phoneNumber": "02222661122",
        "state": "Maharashtra",
        "city": "Mumbai",
        "address": {
          "addressLine1": "Fort Commercial Complex, MG Road",
          "city": "Mumbai",
          "state": "Maharashtra",
          "pincode": "400001"
        },
        "cardStock": 100,
        "verificationCredits": 50,
        "status": "ACTIVE",
        "branchManager": {
          "id": "64bc7a2f1c8e1a1234567892",
          "fullName": "Amit Verma",
          "email": "amit.verma@societybank.com",
          "phoneNumber": "9876543210"
        },
        "createdAt": "2026-01-01T10:00:00.000Z"
      }
    ],
    "meta": {
      "totalRecords": 5,
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

### 3. Get Available Cities & States Dropdown

- **HTTP Method**: `GET`
- **Route**: `/api/v1/society/branches/available-locations`
- **Aliases**: `/api/v1/society/branches/cities-states`, `/api/v1/society/branches/locations`
- **Permission**: `branch.view`
- **Description**: Returns distinct list of active `states`, `cities`, and hierarchical `locations` mapping for UI filter dropdowns.
- **Success Response (`200 OK`)**:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Available branch cities and states retrieved successfully.",
  "data": {
    "states": ["Gujarat", "Karnataka", "Maharashtra"],
    "cities": ["Ahmedabad", "Bengaluru", "Mumbai", "Pune"],
    "locations": [
      {
        "state": "Gujarat",
        "cities": ["Ahmedabad"]
      },
      {
        "state": "Karnataka",
        "cities": ["Bengaluru"]
      },
      {
        "state": "Maharashtra",
        "cities": ["Mumbai", "Pune"]
      }
    ]
  }
}
```

---

### 4. Lightweight Branch Dropdown

- **HTTP Method**: `GET`
- **Route**: `/api/v1/society/branches/dropdown`
- **Permission**: `branch.view`
- **Success Response (`200 OK`)**:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Branch list retrieved successfully.",
  "data": [
    {
      "id": "64bc7a2f1c8e1a1234567891",
      "branchId": "64bc7a2f1c8e1a1234567891",
      "branchName": "Mumbai Fort Branch",
      "name": "Mumbai Fort Branch",
      "code": "MUM01",
      "state": "Maharashtra",
      "city": "Mumbai"
    }
  ]
}
```

---

### 5. Get Single Branch Details

- **HTTP Method**: `GET`
- **Route**: `/api/v1/society/branches/:id`
- **Permission**: `branch.view`

---

### 6. Update Branch Details

- **HTTP Method**: `PUT`
- **Route**: `/api/v1/society/branches/:id`
- **Permission**: `branch.update`
- **Request Body**:

```json
{
  "name": "Mumbai Central Fort Branch",
  "phoneNumber": "02222663344",
  "cardStock": 150,
  "verificationCredits": 75,
  "status": "ACTIVE"
}
```

---

### 7. Deactivate / Delete Branch

- **HTTP Method**: `DELETE`
- **Route**: `/api/v1/society/branches/:id`
- **Permission**: `branch.delete`

---

### 8. Get Branch Manager HR Profile

- **HTTP Method**: `GET`
- **Route**: `/api/v1/society/branches/:id/manager`
- **Permission**: `branch.view`
- **Description**: Returns full Manager profile including all 6 HR configuration sections (`personalDetails`, `jobDetails`, `shiftSettings`, `attendanceSettings`, `woffHoffSettings`, `kraSettings`).

---

### 9–15. Branch Manager HR Section Section Updates

- **PATCH `/:id/manager/personal-details`**: Update personal info & credentials (`fullName`, `email`, `phoneNumber`, `gender`, `dateOfBirth`, `address`).
- **PATCH `/:id/manager/job-details`**: Update job info (`designation`, `department`, `salary`, `joiningDate`, `probationPeriodMonths`).
- **PATCH `/:id/manager/shift-settings`**: Update timings (`punchInTime`, `punchOutTime`, `lateAllowedMinutes`, `halfDayMinutes`, `fullDayMinutes`, `weeklyOff`).
- **PATCH `/:id/manager/attendance-settings`**: Update punch mode (`SINGLE`/`DOUBLE`/`MULTIPLE`), no-out-punch rules, overtime rules, late cut policies.
- **PATCH `/:id/manager/woff-hoff-settings`**: Update weekly off rules, holiday rules, sandwich leave rules, encashment rules.
- **PATCH `/:id/manager/kra-settings`**: Update KRA goals (`year`, `targets` array with `product`, `targetType`, `targetValue`).
