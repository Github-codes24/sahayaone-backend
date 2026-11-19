# Location API Documentation: Society Employee Locations

Comprehensive API reference documentation for retrieving real-time & batch location coordinates (Latitude & Longitude) of employees and field staff in the Sahayaone Enterprise Backend Gateway.

---

## 📌 Gateway Base Paths & Context Setup

* **Base Route**: `/api/v1/society/employees`
* **Authentication**: Required for all endpoints via Bearer JWT Token (`rbacMiddleware.requireAuth`).
* **Tenant Context**: Context is automatically resolved via `resolveSocietyContext` (`req.society.bankId`, `req.society.branchId`, `req.society.isBankOwner`, `req.society.isBranchManager`).
* **Access Control**: Restricted to **Super Admin**, **Bank Owner**, **Branch Manager**, and **HR / HR Executive** (`requireHrOrBankOwnerOrManager`).

---

## 📋 Location API Summary Table

| Method | Primary Endpoint | Route Aliases | Access / Role Restriction | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/society/employees/locations` | `/api/v1/society/employees/location` | `Super Admin` / `Bank Owner` / `Branch Manager` / `HR` | Retrieve paginated location coordinates (Lat/Long) for all employees in a bank/branch. |
| `GET` | `/api/v1/society/employees/:id/location` | `/api/v1/society/employees/location/:id` | `Super Admin` / `Bank Owner` / `Branch Manager` / `HR` | Retrieve real-time location coordinates (Lat/Long) for a specific employee by ID/Code. |

---

## 🛠️ Detailed Endpoint Specifications

### 1. List Employees Location Coordinates

Retrieves a paginated list of employees along with their current location coordinates (`latitude`, `longitude`), GeoJSON array (`[longitude, latitude]`), formatted office/current address, and timestamp of the last location update.

* **HTTP Method**: `GET`
* **Primary URL**: `http://localhost:5001/api/v1/society/employees/locations`
* **Route Alias**: `http://localhost:5001/api/v1/society/employees/location`
* **Middleware Stack**: `rbacMiddleware.requireAuth` ➔ `resolveSocietyContext` ➔ `requireHrOrBankOwnerOrManager` ➔ `validateRequest(employeeQuerySchema)`

#### Request Headers:
```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
Content-Type: application/json
```

#### Query Parameters:

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `search` | `string` | — | General search across `fullName`, `employeeCode` (e.g. `"EMP-LA2020-97551"`), `email`, or `phoneNumber` |
| `employeeId` / `employeeCode` | `string` | — | Direct filter for employee code / ID (e.g., `"EMP-LA2020-97551"` or Mongo `_id`) |
| `page` | `integer` | `1` | Page number for pagination |
| `limit` | `integer` | `10` | Number of items per page (max `100`) |
| `status` | `string` | `'ACTIVE'` | Filter by status (`'ACTIVE'`, `'INACTIVE'`, `'ALL'`, `'DELETED'`) |
| `branchId` | `string` | — | 24-character MongoDB `_id` to filter employees in a specific branch |
| `city` | `string` | — | Filter employees in branches located in this city |
| `state` | `string` | — | Filter employees in branches located in this state |
| `includeBranchManagers` | `boolean` | `true` | Include Branch Managers in location listings |
| `includeStats` | `boolean` | `false` | Include aggregate summary statistics object in response |
| `includeDeleted` | `boolean` | `false` | Includes soft-deleted employee records (Restricted to **Bank Owner** / **Branch Manager**) |
| `isDeleted` | `boolean` | `false` | Filters soft-deleted records exclusively (Restricted to **Bank Owner** / **Branch Manager**) |
| `sortBy` | `string` | `'createdAt'` | Field name to sort by |
| `sortOrder` | `string` | `'desc'` | Sort direction (`'asc'` or `'desc'`) |

#### Sample Requests (`cURL`):

**Option A: Dedicated `employeeId` or `employeeCode` query parameter:**
```bash
curl -X GET "http://localhost:5001/api/v1/society/employees/locations?employeeId=EMP-LA2020-97551" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

**Option B: General `search` query parameter:**
```bash
curl -X GET "http://localhost:5001/api/v1/society/employees/locations?search=EMP-LA2020-97551" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

#### Success Response (`200 OK`):

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
      "status": "ACTIVE",
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

### 2. Get Single Employee Location Coordinates

Retrieves the latest location coordinates (`latitude`, `longitude`, GeoJSON array, address, and timestamp) for a specific employee identified by their MongoDB ID, User ID, or Employee Code.

* **HTTP Method**: `GET`
* **Primary URL**: `http://localhost:5001/api/v1/society/employees/:id/location`
* **Route Alias**: `http://localhost:5001/api/v1/society/employees/location/:id`
* **Middleware Stack**: `rbacMiddleware.requireAuth` ➔ `resolveSocietyContext` ➔ `requireHrOrBankOwnerOrManager`

#### Request Headers:
```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
Content-Type: application/json
```

#### URL Parameters:

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `:id` | `string` | Yes | Target Employee's MongoDB `_id`, `userId`, or `employeeCode` |

#### Sample Request (`cURL`):

```bash
curl -X GET "http://localhost:5001/api/v1/society/employees/64bc7a2f1c8e1a1234567892/location" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json"
```

#### Success Response (`200 OK`):

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Employee location retrieved successfully.",
  "data": {
    "latitude": 19.0760,
    "longitude": 72.8777,
    "coordinates": [
      72.8777,
      19.0760
    ],
    "address": "123 Commercial Complex, Khamla, Nagpur, Maharashtra",
    "lastUpdatedAt": "2026-09-03T10:30:00.000Z"
  }
}
```

---

## ⚠️ Common Error Responses

### 1. 401 Unauthorized (Missing or Invalid Token)
```json
{
  "success": false,
  "statusCode": 401,
  "errorCode": "UNAUTHORIZED",
  "message": "Authentication required. Please provide a valid authorization token."
}
```

### 2. 403 Forbidden (Insufficient Privileges)
```json
{
  "success": false,
  "statusCode": 403,
  "errorCode": "FORBIDDEN",
  "message": "Access denied. Only Super Admin, Bank Owner, Branch Manager, or HR can view employee locations."
}
```

### 3. 404 Not Found (Employee Profile Not Found)
```json
{
  "success": false,
  "statusCode": 404,
  "errorCode": "NOT_FOUND",
  "message": "Employee location profile not found."
}
```

---

## 🧭 Location Schema Reference

The `location` object returned in employee data has the following schema structure:

| Field | Type | Description |
| :--- | :--- | :--- |
| `latitude` | `Number` | Latitude coordinate (e.g. `19.0760`) |
| `longitude` | `Number` | Longitude coordinate (e.g. `72.8777`) |
| `coordinates` | `Array<Number>` | GeoJSON format array `[longitude, latitude]` |
| `address` | `String` | Formatted physical address of current/last known location |
| `lastUpdatedAt` | `Date` / `ISO String` | ISO timestamp when the employee's location was last updated |
