# 🚀 Onboarding Team Management API Documentation

This document provides comprehensive technical specifications, authentication & authorization rules, request/response payload examples, and endpoint details for the **Onboarding Team Management API** (`/api/v1/super-admin/onboarding-team`).

---

## 📌 1. Architecture & Security Overview

1. **Authentication & Authorization**:
   - All endpoints require a JWT Bearer Token passed via HTTP Header: `Authorization: Bearer <ACCESS_TOKEN>`.
   - Allowed Roles: `SUPER_ADMIN`, `SUB_ADMIN`, `HO_ADMIN`, `EMPLOYEE`.
   - Permission Scope Rules:
     - `onboarding_team:view_only`: Required for GET endpoints (`/filters`, `/`, `/:id`).
     - `onboarding_team:create`: Required for POST `/`.
     - `onboarding_team:edit`: Required for PUT `/:id`.
     - `onboarding_team:delete`: Required for DELETE `/:id`.

2. **User Account Auto-Provisioning**:
   - Creating an Onboarding Team member automatically provisions a corresponding `User` account with `role: ONBOARDING_TEAM` and `userType: ONBOARDING_TEAM`, allowing the team member to log in immediately.

3. **Data Scope Updates**:
   - `region` and `branch` (`branchId`) fields are **removed** from onboarding team member creation, request payloads, database schemas, and responses.

---

## 📋 2. Endpoint Summary Table

| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/super-admin/onboarding-team/filters` | `onboarding_team:view_only` | Retrieves filter dropdown options (`onboardingTeamTypes`). |
| `GET` | `/api/v1/super-admin/onboarding-team` | `onboarding_team:view_only` | Paginated list of onboarding team members with multi-field search & filters. |
| `GET` | `/api/v1/super-admin/onboarding-team/:id` | `onboarding_team:view_only` | Detailed profile view of an onboarding team member including onboarded banks. |
| `POST` | `/api/v1/super-admin/onboarding-team` | `onboarding_team:create` | Creates a new onboarding team member with optional profile image upload. |
| `PUT` | `/api/v1/super-admin/onboarding-team/:id` | `onboarding_team:edit` | Updates existing onboarding team member profile details or image. |
| `DELETE` | `/api/v1/super-admin/onboarding-team/:id` | `onboarding_team:delete` | Soft-deletes onboarding team member and associated user account. |

---

## 🛠️ 3. Detailed API Reference

### 1. Get Filter Dropdown Options

Retrieves dropdown filter options used for filtering the onboarding team list in the frontend interface.

- **HTTP Method**: `GET`
- **URL**: `http://localhost:5001/api/v1/super-admin/onboarding-team/filters`
- **Headers**:
  ```http
  Authorization: Bearer <ACCESS_TOKEN>
  ```

- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Filter dropdown options retrieved successfully.",
    "data": {
      "onboardingTeamTypes": [
        { "label": "Regional OnboardingTeam", "value": "Regional OnboardingTeam" },
        { "label": "Branch OnboardingTeam", "value": "Branch OnboardingTeam" },
        { "label": "Collection OnboardingTeam", "value": "Collection OnboardingTeam" }
      ]
    }
  }
  ```

---

### 2. List Onboarding Team Members (Paginated)

Retrieves a paginated list of onboarding team members with search capability across full name, email, phone number, and onboarding team type.

- **HTTP Method**: `GET`
- **URL**: `http://localhost:5001/api/v1/super-admin/onboarding-team?page=1&limit=10&search=Rahul&onboardingTeamType=Regional%20OnboardingTeam&status=ACTIVE&sortBy=createdAt&sortOrder=desc`
- **Headers**:
  ```http
  Authorization: Bearer <ACCESS_TOKEN>
  ```
- **Query Parameters**:
  - `page` (number, default: `1`): Page number.
  - `limit` (number, default: `10`, max: `100`): Records per page.
  - `search` (string, optional): Keyword search matching member name, email, phone, or onboarding team type.
  - `onboardingTeamType` (string / array, optional): Filter by onboarding team type (`Regional OnboardingTeam`, `Branch OnboardingTeam`, `Collection OnboardingTeam`).
  - `status` (string, enum: `ACTIVE`, `INACTIVE`, `BLOCKED`, optional): Filter by member status.
  - `sortBy` (string, default: `createdAt`): Sorting field.
  - `sortOrder` (string, enum: `asc`, `desc`, default: `desc`): Sort ordering.

- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Onboarding Team members list retrieved successfully.",
    "data": [
      {
        "srNo": 1,
        "id": "66ce7a901234567890abcdef",
        "memberId": "66ce7a901234567890abcdef",
        "userId": "66ce7a901234567890aaaaaa",
        "fullName": "Rahul Sharma",
        "name": "Rahul Sharma",
        "onboardingTeamName": "Rahul Sharma",
        "profileImage": "https://s3.amazonaws.com/bucket/onboarding-team/profile.jpg",
        "gender": "Male",
        "dob": "15/05/1995",
        "dateOfBirth": "15/05/1995",
        "phone": "9876543210",
        "phoneNumber": "9876543210",
        "email": "rahul.sharma@sahayaone.com",
        "password": "Password@123",
        "address": "123, Civil Lines, Nagpur, Maharashtra",
        "onboardingTeamType": "Regional OnboardingTeam",
        "salary": 45000,
        "formattedSalary": "₹45,000",
        "joiningDate": "2026-01-01T00:00:00.000Z",
        "registeredOn": "January 1, 2026",
        "meta": {
          "shift": "10:00-21:00",
          "weeklyOff": "Sat & Sun",
          "joined": "01-01-2026"
        },
        "personalDetails": {
          "fullName": "Rahul Sharma",
          "gender": "Male",
          "dateOfBirth": "15/05/1995",
          "phone": "9876543210",
          "email": "rahul.sharma@sahayaone.com",
          "password": "Password@123",
          "address": "123, Civil Lines, Nagpur, Maharashtra"
        },
        "jobDetails": {
          "onboardingTeamType": "Regional OnboardingTeam",
          "salary": 45000
        },
        "status": "ACTIVE",
        "createdAt": "2026-09-09T06:45:00.000Z",
        "updatedAt": "2026-09-09T06:45:00.000Z"
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

### 3. Get Onboarding Team Member Details by ID

Retrieves detailed profile specifications for a single onboarding team member, including personal details, job configuration, shift/WOFF rules, attendance rules, and a full list of banks onboarded by this member (`onboardedBanks`).

- **HTTP Method**: `GET`
- **URL**: `http://localhost:5001/api/v1/super-admin/onboarding-team/66ce7a901234567890abcdef`
- **Headers**:
  ```http
  Authorization: Bearer <ACCESS_TOKEN>
  ```
- **Path Parameters**:
  - `id` (string, required): 24-character MongoDB ObjectId of the member.

- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Onboarding Team member details retrieved successfully.",
    "data": {
      "id": "66ce7a901234567890abcdef",
      "memberId": "66ce7a901234567890abcdef",
      "userId": "66ce7a901234567890aaaaaa",
      "fullName": "Rahul Sharma",
      "name": "Rahul Sharma",
      "onboardingTeamName": "Rahul Sharma",
      "profileImage": "https://s3.amazonaws.com/bucket/onboarding-team/profile.jpg",
      "gender": "Male",
      "dob": "15/05/1995",
      "dateOfBirth": "15/05/1995",
      "phone": "9876543210",
      "phoneNumber": "9876543210",
      "email": "rahul.sharma@sahayaone.com",
      "password": "Password@123",
      "address": "123, Civil Lines, Nagpur, Maharashtra",
      "onboardingTeamType": "Regional OnboardingTeam",
      "salary": 45000,
      "formattedSalary": "₹45,000",
      "joiningDate": "2026-01-01T00:00:00.000Z",
      "registeredOn": "January 1, 2026",
      "meta": {
        "shift": "10:00-21:00",
        "weeklyOff": "Sat & Sun",
        "joined": "01-01-2026"
      },
      "personalDetails": {
        "fullName": "Rahul Sharma",
        "gender": "Male",
        "dateOfBirth": "15/05/1995",
        "phone": "9876543210",
        "email": "rahul.sharma@sahayaone.com",
        "password": "Password@123",
        "address": "123, Civil Lines, Nagpur, Maharashtra"
      },
      "jobDetails": {
        "onboardingTeamType": "Regional OnboardingTeam",
        "salary": 45000
      },
      "shiftAndWoff": {
        "shift": {
          "inTime": "10:00",
          "outTime": "21:00"
        },
        "weeklyOff": {
          "weeklyOffDays": ["Saturday", "Sunday"],
          "formattedDays": "Saturday, Sunday",
          "isWeeklyOffPayable": true,
          "isVariableWeeklyOff": true,
          "isSecondWeeklyOff": true
        }
      },
      "otherDetails": {
        "lateAllowedMins": "15 (As Per Shift)",
        "earlyAllowedMins": 15,
        "halfDayMins": 240,
        "fullDayMins": "480 (As Per Shift)"
      },
      "attendance": {
        "punch": {
          "shiftType": "Double",
          "noOutPunchAction": "Mark Half Day",
          "presentOnWoHolidayAction": "Mark as COFF"
        },
        "lateCut": {
          "allowedDays": 3,
          "action": "Half Day",
          "isLateCutAllowed": true,
          "isExtraLateCutDeduction": true,
          "isAdditionalLateCutInLeaveBalance": true
        }
      },
      "lunchAndEarlyGoing": {
        "lunchAllowedMins": "15 (As Per Shift)",
        "isLunchAllowed": true,
        "isEarlyGoingAllowed": true
      },
      "overtime": {
        "isOvertimeAllowed": true,
        "isCustomOT": true,
        "isBeforeOT": true,
        "otGracePeriodMins": 5,
        "ot1DayHrs": 4,
        "isOTAsPerShift": true,
        "isConsiderOTAsCOFF": true
      },
      "woffAndHoff": {
        "sandwichWeeklyOff": {
          "absentBeforeWO": true,
          "absentAfterWO": true,
          "absentBeforeOrAfterWO": true,
          "addWorkingHrsOnWODay": true,
          "lateDeductionNotAppliedOnWOIfPresent": true
        },
        "sandwichHolidays": {
          "absentBeforeHoliday": true,
          "absentAfterHoliday": true,
          "absentBeforeAndAfterHoliday": true,
          "addWorkingHoursOnHolidayDay": true,
          "lateDeductionNotAppliedOnHolidayIfPresent": true
        },
        "leaveBetweenHolidayOrWO": {
          "considerWOInLeaveApp": true,
          "considerHolidayInLeaveApp": true,
          "absentWoLeaveWoAbsent": true,
          "leaveWoAbsentWoAbsent": true,
          "absentHolidayLeaveHolidayAbsent": true,
          "leaveHolidayAbsentHolidayAbsent": true
        }
      },
      "totalOnboardedBanks": 2,
      "onboardedBanksCount": 2,
      "onboardedBanks": [
        {
          "id": "66ce7a901234567890bank01",
          "bankId": "66ce7a901234567890bank01",
          "name": "Nagpur Urban Co-operative Bank",
          "bankName": "Nagpur Urban Co-operative Bank",
          "code": "NUCB-001",
          "logo": "https://s3.amazonaws.com/bucket/banks/logo1.png",
          "email": "contact@nucb.com",
          "alternateEmail": null,
          "phoneNumber": "9823011223",
          "ubo": "Ramesh Gupta",
          "credit": 500000,
          "status": "ACTIVE",
          "paymentMethod": "UPI",
          "paymentStatus": "PAID",
          "totalAmountPaid": 25000,
          "createdAt": "2026-08-10T10:00:00.000Z",
          "updatedAt": "2026-08-10T10:00:00.000Z"
        }
      ],
      "onboardedBy": null,
      "createdBy": {
        "id": "64bc7a2f1c8e1a1234567111",
        "userId": "64bc7a2f1c8e1a1234567111",
        "name": "Super Admin",
        "email": "admin@sahayaone.com",
        "phone": "9999999999",
        "role": "SUPER_ADMIN"
      },
      "status": "ACTIVE",
      "createdAt": "2026-09-09T06:45:00.000Z",
      "updatedAt": "2026-09-09T06:45:00.000Z"
    }
  }
  ```

---

### 4. Create Onboarding Team Member

Creates a new onboarding team member record and auto-provisions a `User` account. Supports `multipart/form-data` for optional profile image upload.

- **HTTP Method**: `POST`
- **URL**: `http://localhost:5001/api/v1/super-admin/onboarding-team`
- **Headers**:
  ```http
  Authorization: Bearer <ACCESS_TOKEN>
  Content-Type: multipart/form-data
  ```
- **Request Body Parameters**:

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `fullName` | string | **Yes** | Full name of the team member. |
| `email` | string | **Yes** | Unique email address. |
| `phone` / `phoneNumber` | string | **Yes** | Unique phone number. |
| `gender` | string | No | Enum: `Male`, `Female`, `Other` (default: `Male`). |
| `dob` / `dateOfBirth` | string | No | Date of birth (ISO Date or `YYYY-MM-DD`). |
| `password` | string | No | Password for app login (default: `Password@123`). |
| `address` | string | No | Residential/Office address. |
| `onboardingTeamType` | string | No | Enum: `Regional OnboardingTeam`, `Branch OnboardingTeam`, `Collection OnboardingTeam` (default: `Regional OnboardingTeam`). |
| `salary` | number | No | Monthly salary amount. |
| `joiningDate` | string | No | Joining Date (ISO Date). |
| `shiftInTime` | string | No | Shift start time (e.g., `10:00`). |
| `shiftOutTime` | string | No | Shift end time (e.g., `21:00`). |
| `weeklyOffDays` | array[string] | No | Days of weekly off (e.g., `["Saturday", "Sunday"]`). |
| `status` | string | No | Enum: `ACTIVE`, `INACTIVE`, `BLOCKED` (default: `ACTIVE`). |
| `profileImage` | File | No | Profile image file upload (`image/jpeg`, `image/png`, `image/webp`). |

> ⚠️ **Note**: `region` and `branchId` fields have been **removed** from the request body.

- **Success Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "statusCode": 201,
    "message": "Onboarding Team member created successfully.",
    "data": {
      "id": "66ce7a901234567890abcdef",
      "memberId": "66ce7a901234567890abcdef",
      "userId": "66ce7a901234567890aaaaaa",
      "fullName": "Rahul Sharma",
      "email": "rahul.sharma@sahayaone.com",
      "phone": "9876543210",
      "onboardingTeamType": "Regional OnboardingTeam",
      "salary": 45000,
      "status": "ACTIVE",
      "createdAt": "2026-09-09T06:45:00.000Z"
    }
  }
  ```

- **Error Responses**:
  - `400 Bad Request`: Validation failure (e.g., missing required `fullName`, `email`, or `phone`).
  - `409 Conflict`: Member with the same email address or phone number already exists.

---

### 5. Update Onboarding Team Member

Updates profile details, password, shift/attendance settings, or profile image of an existing onboarding team member. Automatically synchronizes credential updates (`email`, `phone`, `fullName`, `password`, `status`) to the member's linked `User` login account.

- **HTTP Method**: `PUT`
- **URL**: `http://localhost:5001/api/v1/super-admin/onboarding-team/66ce7a901234567890abcdef`
- **Headers**:
  ```http
  Authorization: Bearer <ACCESS_TOKEN>
  Content-Type: multipart/form-data (or application/json)
  ```
- **Path Parameters**:
  - `id` (string, required): Member MongoDB ObjectId.

- **Request Body Parameters** (all fields optional, supports flat properties or structured section objects):

| Field Category | Parameter Names | Type | Description |
| :--- | :--- | :--- | :--- |
| **Personal Info** | `fullName`, `gender`, `dob` / `dateOfBirth`, `address` | string | Basic member profile details. |
| **Contact Info** | `email`, `phone` / `phoneNumber` | string | Unique email and phone number (validates uniqueness against other members). |
| **Security / Auth** | `password` | string | Optional new password (min 6 chars). Hashes via `bcrypt` and updates linked `User.passwordHash`. |
| **Job Details** | `onboardingTeamType`, `salary`, `joiningDate` | string / number | Enum: `Regional OnboardingTeam`, `Branch OnboardingTeam`, `Collection OnboardingTeam`. |
| **Shift & Weekly Off** | `shiftInTime`, `shiftOutTime`, `weeklyOffDays`, `isWeeklyOffPayable`, `isVariableWeeklyOff`, `isSecondWeeklyOff` | string / array / boolean | Shift timings and weekly off configurations. |
| **Timing Limits** | `lateAllowedMins`, `earlyAllowedMins`, `halfDayMins`, `fullDayMins` | number | Shift grace periods and day threshold minutes. |
| **Attendance Rules** | `shiftType`, `noOutPunchAction`, `presentOnWoHolidayAction`, `lateCutAllowedDays`, `lateCutAction`, `isLateCutAllowed`, `isExtraLateCutDeduction`, `isAdditionalLateCutInLeaveBalance` | string / number / boolean | Attendance punch and late cut deduction rules. |
| **Lunch & Overtime** | `lunchAllowedMins`, `isLunchAllowed`, `isEarlyGoingAllowed`, `isOvertimeAllowed`, `isCustomOT`, `isBeforeOT`, `otGracePeriodMins`, `ot1DayHrs`, `isOTAsPerShift`, `isConsiderOTAsCOFF` | number / boolean | Lunch break and overtime calculation parameters. |
| **Sandwich Rules** | `sandwichWeeklyOff`, `sandwichHolidays`, `leaveBetweenHolidayOrWO` | object | WOFF & HOFF sandwich leave penalty configurations. |
| **Section Objects** | `personalDetails`, `jobDetails`, `shiftAndWoff`, `otherDetails`, `attendance`, `lunchAndEarlyGoing`, `overtime`, `woffAndHoff` | object | Accepts section payload objects as returned by `GET /:id`. |
| **Status & Image** | `status`, `profileImage` | string / File | Status (`ACTIVE`, `INACTIVE`, `BLOCKED`) & optional image file. |

> 🔒 **User Account Sync**:
> Updating `fullName`, `email`, `phone`, `password`, or `status` automatically syncs the changes to the member's linked `User` document so login credentials remain strictly aligned.

- **Sample Request Payload (Flat or Password Change)**:
  ```json
  {
    "fullName": "Rahul V. Sharma",
    "email": "rahul.sharma@sahayaone.com",
    "phone": "9876543210",
    "password": "NewPassword@2026",
    "salary": 50000,
    "status": "ACTIVE"
  }
  ```

- **Sample Request Payload (Section Objects as returned by GET `/:id`)**:
  ```json
  {
    "personalDetails": {
      "fullName": "Rahul V. Sharma",
      "email": "rahul.sharma@sahayaone.com",
      "phone": "9876543210",
      "password": "NewPassword@2026"
    },
    "jobDetails": {
      "onboardingTeamType": "Regional OnboardingTeam",
      "salary": 50000
    },
    "shiftAndWoff": {
      "shift": { "inTime": "09:30", "outTime": "18:30" },
      "weeklyOff": { "weeklyOffDays": ["Sunday"] }
    }
  }
  ```

- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Onboarding Team member updated successfully.",
    "data": {
      "id": "66ce7a901234567890abcdef",
      "memberId": "66ce7a901234567890abcdef",
      "userId": "66ce7a901234567890aaaaaa",
      "fullName": "Rahul V. Sharma",
      "phone": "9876543210",
      "email": "rahul.sharma@sahayaone.com",
      "password": "Password@123",
      "onboardingTeamType": "Regional OnboardingTeam",
      "salary": 50000,
      "status": "ACTIVE",
      "updatedAt": "2026-09-09T07:00:00.000Z"
    }
  }
  ```

- **Error Responses**:
  - `400 Bad Request`: Validation failure (e.g. invalid member ID format or password < 6 chars).
  - `404 Not Found`: Member not found.
  - `409 Conflict`: Updated email or phone number is already registered to another active member.

---

### 6. Delete Onboarding Team Member (Soft Delete)

Soft-deletes an onboarding team member and their corresponding user login account.

- **HTTP Method**: `DELETE`
- **URL**: `http://localhost:5001/api/v1/super-admin/onboarding-team/66ce7a901234567890abcdef`
- **Headers**:
  ```http
  Authorization: Bearer <ACCESS_TOKEN>
  ```
- **Path Parameters**:
  - `id` (string, required): Member MongoDB ObjectId.

- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Onboarding Team member deleted successfully.",
    "data": {
      "id": "66ce7a901234567890abcdef",
      "message": "Onboarding Team Member deleted successfully."
    }
  }
  ```

- **Error Response (`404 Not Found`)**:
  ```json
  {
    "success": false,
    "statusCode": 404,
    "message": "Onboarding Team Member not found for deletion."
  }
  ```
