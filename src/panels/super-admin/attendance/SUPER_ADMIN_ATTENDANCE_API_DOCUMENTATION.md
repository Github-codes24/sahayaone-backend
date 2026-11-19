# Super Admin Panel Attendance & Attendance Report API Documentation

This document describes the complete API specification for **Super Admin Panel Attendance Operations and Attendance Reports**, enabling Super Admin users, Sub-Admins, and Onboarding Team members to mark punch-in/punch-out with geolocation, view today's snapshot, access monthly attendance sheets, view single-person 12-month yearly matrix reports, query detailed date-wise history logs, manage leave applications, and view attendance report summaries.

---

## 🌐 Base URL & Headers

### Base URLs
```text
http://localhost:5000/api/v1/super-admin/attendance
http://localhost:5000/api/v1/super-admin/attendance-report
```

### Headers
```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

---

## 📋 Endpoints Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/super-admin/attendance/today` | Fetch today's attendance snapshot, punch status, and shift details for logged-in admin |
| `POST` | `/api/v1/super-admin/attendance/punch-in` | Record Punch-In check-in with GPS coordinates & address |
| `POST` | `/api/v1/super-admin/attendance/punch-out` | Record Punch-Out check-out with working & overtime calculation |
| `GET` | `/api/v1/super-admin/attendance/report` | Fetch monthly attendance summary card counters for logged-in admin |
| `GET` | `/api/v1/super-admin/attendance/sheet` | Fetch monthly attendance sheet for Admin Panel personnel (`SUPER_ADMIN`, `SUB_ADMIN`, `ONBOARDING_TEAM`) |
| `GET` | `/api/v1/super-admin/attendance/yearly-matrix` | Fetch 12-month yearly matrix data for Admin personnel (JAN-DEC present days & avg attendance %) |
| `GET` | `/api/v1/super-admin/attendance/single-report` | Single person monthly attendance sheet & 12-month yearly matrix with punch locations |
| `GET` | `/api/v1/super-admin/attendance/user/:id/report` | Single person attendance report by user ID |
| `GET` | `/api/v1/super-admin/attendance/history` | Fetch detailed date-wise attendance history logs |
| `POST` | `/api/v1/super-admin/attendance/leave` | Submit leave application with date validation & overlap check |
| `GET` | `/api/v1/super-admin/attendance-report/filters` | Fetch available filter options (e.g. user roles) for attendance reporting |
| `GET` | `/api/v1/super-admin/attendance-report` | Fetch admin attendance report items with location & status |
| `GET` | `/api/v1/super-admin/attendance-report/single-person` | Single person report under attendance-report module |

---

## 📖 Detailed API Specifications

### 1. Today's Attendance Snapshot

* **API Use Case**: Retrieve today's punch-in/punch-out timestamps, current status (`PRESENT`, `ABSENT`, `LATE_PRESENT`), late minutes, working hours, and GPS location for the logged-in admin user.
* **Method**: `GET`
* **URL**: `/api/v1/super-admin/attendance/today`
* **Authentication**: Required (`Bearer <accessToken>`)
* **Query Parameters**: None
* **Request Body**: None

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Today attendance status retrieved successfully.",
  "data": {
    "todayAttendance": {
      "punchIn": "09:30 AM",
      "punchOut": "06:30 PM",
      "status": "PRESENT",
      "isLate": false,
      "lateMinutes": 0,
      "workingMinutes": 540,
      "formattedWorkingHours": "9 hrs",
      "location": {
        "latitude": 18.5204,
        "longitude": 73.8567,
        "address": "Head Office, MG Road, Pune, Maharashtra",
        "city": "Pune",
        "state": "Maharashtra",
        "pincode": "411001"
      }
    }
  }
}
```

---

### 2. Punch-In (Check-In)

* **API Use Case**: Record Punch-In timestamp and GPS location when an admin user starts their work shift.
* **Method**: `POST`
* **URL**: `/api/v1/super-admin/attendance/punch-in`
* **Authentication**: Required (`Bearer <accessToken>`)
* **Request Body**:
```json
{
  "latitude": 18.5204,
  "longitude": 73.8567,
  "address": "Head Office, MG Road, Pune, Maharashtra"
}
```
*(Supports payload aliases: `latitute`/`langitute`, `lat`/`lng`, or nested `location: { latitude, longitude, address }`)*

#### Request Field Rules:
* `latitude` / `latitute` / `lat` (Number or String, optional): Range `-90` to `90`.
* `longitude` / `langitute` / `lng` (Number or String, optional): Range `-180` to `180`.
* `address` (String, optional): Max 500 characters.

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Punched in successfully.",
  "data": {
    "success": true,
    "message": "Punched in successfully.",
    "todayAttendance": {
      "punchIn": "09:30 AM",
      "punchOut": null,
      "status": "PRESENT",
      "isLate": false,
      "lateMinutes": 0,
      "location": {
        "latitude": 18.5204,
        "longitude": 73.8567,
        "address": "Head Office, MG Road, Pune, Maharashtra",
        "city": "Pune",
        "state": "Maharashtra",
        "pincode": "411001"
      }
    }
  }
}
```

---

### 3. Punch-Out (Check-Out)

* **API Use Case**: Record Punch-Out timestamp and GPS location when an admin user completes their work shift, calculating total working minutes and overtime.
* **Method**: `POST`
* **URL**: `/api/v1/super-admin/attendance/punch-out`
* **Authentication**: Required (`Bearer <accessToken>`)
* **Request Body**:
```json
{
  "latitude": 18.5204,
  "longitude": 73.8567,
  "address": "Head Office, MG Road, Pune, Maharashtra"
}
```

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Punched out successfully.",
  "data": {
    "success": true,
    "message": "Punched out successfully.",
    "todayAttendance": {
      "punchIn": "09:30 AM",
      "punchOut": "06:30 PM",
      "status": "PRESENT",
      "workingMinutes": 540,
      "overtimeMinutes": 60,
      "isEarlyLeave": false,
      "location": {
        "latitude": 18.5204,
        "longitude": 73.8567,
        "address": "Head Office, MG Road, Pune, Maharashtra"
      }
    }
  }
}
```

---

### 4. Monthly Summary Report Cards

* **API Use Case**: Retrieve monthly attendance counters (present days, absent days, half days, leave days, late days, attendance percentage) for the logged-in admin user.
* **Method**: `GET`
* **URL**: `/api/v1/super-admin/attendance/report`
* **Authentication**: Required (`Bearer <accessToken>`)
* **Query Parameters**:
  * `month` (Integer, optional): `1` to `12`. Defaults to current month.
  * `year` (Integer, optional): `2020` to `2035`. Defaults to current year.

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Monthly attendance report retrieved successfully.",
  "data": {
    "month": 9,
    "year": 2026,
    "totalDays": 30,
    "presentDays": 22,
    "absentDays": 2,
    "halfDays": 1,
    "leaveDays": 1,
    "lateDays": 2,
    "totalWorkingMinutes": 11880,
    "formattedTotalWorkingHours": "198 hrs",
    "totalOvertimeMinutes": 240,
    "formattedTotalOvertime": "4 hrs",
    "attendancePercentage": 75.0
  }
}
```

---

### 5. Monthly Attendance Sheet (Admin Personnel Only)

* **API Use Case**: Retrieve the complete monthly attendance sheet/grid for all Admin Panel personnel (`SUPER_ADMIN`, `SUB_ADMIN`, and `ONBOARDING_TEAM` members), formatted day-by-day (1..31) with search and pagination.
* **Method**: `GET`
* **URLs**:
  * `/api/v1/super-admin/attendance/sheet`
  * `/api/v1/super-admin/attendance/monthly-sheet`
  * `/api/v1/super-admin/attendance/monthly-data`
* **Authentication**: Required (`Bearer <accessToken>`)
* **Query Parameters**:
  * `month` (Integer, optional): `1` to `12`. Defaults to current month.
  * `year` (Integer, optional): `2020` to `2035`. Defaults to current year.
  * `search` (String, optional): Search keyword matching admin name, email, phone, or code.
  * `page` (Integer, optional): Page number (default: `1`).
  * `limit` (Integer, optional): Records per page (default: `10`).

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Monthly attendance sheet retrieved successfully.",
  "data": {
    "month": 9,
    "year": 2026,
    "monthName": "September 2026",
    "daysInMonth": 30,
    "summaryStats": {
      "totalEmployees": 15,
      "totalPresentDays": 310,
      "totalAbsentDays": 20,
      "totalLeaveDays": 10,
      "totalHalfDays": 5,
      "averageAttendancePercentage": 82.5
    },
    "items": [
      {
        "srNo": 1,
        "id": "66e1234567890abcdef00001",
        "employeeName": "System Admin",
        "designation": "Super Admin",
        "employeeCode": "ADM-0001",
        "email": "admin@sahayaone.com",
        "phoneNumber": "9876543210",
        "summary": {
          "totalDays": 30,
          "presentDays": 22,
          "absentDays": 2,
          "halfDays": 1,
          "leaveDays": 1,
          "lateDays": 2,
          "totalWorkingMinutes": 11880,
          "formattedTotalWorkingHours": "198 hrs",
          "totalOvertimeMinutes": 240,
          "formattedTotalOvertime": "4 hrs",
          "attendancePercentage": 75.0
        },
        "daysMap": {
          "1": "P", "2": "P", "3": "P", "4": "WO", "5": "P", "6": "HD", "7": "A", "8": "L"
        },
        "days": [
          {
            "day": 1,
            "date": "2026-09-01",
            "dayName": "Tue",
            "statusCode": "P",
            "status": "PRESENT",
            "punchIn": "09:30 AM",
            "punchOut": "06:30 PM",
            "punchInLocation": {
              "latitude": 18.5204,
              "longitude": 73.8567,
              "address": "Head Office, MG Road, Pune"
            },
            "punchOutLocation": {
              "latitude": 18.5204,
              "longitude": 73.8567,
              "address": "Head Office, MG Road, Pune"
            },
            "punchInLatitude": 18.5204,
            "punchInLongitude": 73.8567,
            "punchOutLatitude": 18.5204,
            "punchOutLongitude": 73.8567,
            "isLate": false,
            "lateMinutes": 0,
            "workingMinutes": 540,
            "formattedWorkingHours": "9 hrs"
          }
        ]
      }
    ],
    "meta": {
      "totalRecords": 15,
      "limit": 10,
      "page": 1,
      "totalPages": 2,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

---

### 6. Yearly Attendance Matrix (12-Month Summary)

* **API Use Case**: Retrieve 12-month (JAN-DEC) attendance matrix showing present days and attendance percentage per month across Admin Panel personnel.
* **Method**: `GET`
* **URLs**:
  * `/api/v1/super-admin/attendance/yearly-matrix`
  * `/api/v1/super-admin/attendance/matrix`
  * `/api/v1/super-admin/attendance/yearly-data`
* **Authentication**: Required (`Bearer <accessToken>`)
* **Query Parameters**:
  * `year` (Integer, optional): Target year (default: current year).

---

### 7. Single Person Attendance Report

* **API Use Case**: Fetch complete individual attendance report for a specific Admin user or Onboarding Team member, including monthly day-by-day punch log (with GPS coordinates) and full 12-month (JAN-DEC) matrix.
* **Method**: `GET`
* **URLs**:
  * `/api/v1/super-admin/attendance/single-report?userId=66e1234567890abcdef00001&month=9&year=2026`
  * `/api/v1/super-admin/attendance/user/66e1234567890abcdef00001/report?month=9&year=2026`
  * `/api/v1/super-admin/attendance-report/single-person?userId=66e1234567890abcdef00001&month=9&year=2026`
  * `/api/v1/super-admin/attendance-report/user/66e1234567890abcdef00001?month=9&year=2026`
* **Authentication**: Required (`Bearer <accessToken>`)
* **Query Parameters**:
  * `userId` / `employeeId` / `id` (ObjectId, optional): Target admin user ID. Defaults to logged-in user.
  * `month` (Integer, optional): `1` to `12`.
  * `year` (Integer, optional): `2020` to `2035`.

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Single person attendance report retrieved successfully.",
  "data": {
    "success": true,
    "employee": {
      "id": "66e1234567890abcdef00001",
      "userId": "66e1234567890abcdef00001",
      "type": "SUPER_ADMIN",
      "fullName": "System Admin",
      "designation": "Super Admin",
      "employeeCode": "ADM-0001",
      "email": "admin@sahayaone.com",
      "phoneNumber": "9876543210"
    },
    "month": 9,
    "year": 2026,
    "monthName": "September 2026",
    "monthlySummary": {
      "totalDays": 30,
      "presentDays": 22,
      "absentDays": 2,
      "halfDays": 1,
      "leaveDays": 1,
      "lateDays": 2,
      "totalWorkingMinutes": 11880,
      "formattedTotalWorkingHours": "198 hrs",
      "totalOvertimeMinutes": 240,
      "formattedTotalOvertime": "4 hrs",
      "attendancePercentage": 75.0
    },
    "dailySheet": [
      {
        "day": 1,
        "date": "2026-09-01",
        "dayName": "Tue",
        "statusCode": "P",
        "status": "PRESENT",
        "punchIn": "09:30 AM",
        "punchOut": "06:30 PM",
        "punchInLocation": {
          "latitude": 18.5204,
          "longitude": 73.8567,
          "address": "Head Office, MG Road, Pune"
        },
        "punchOutLocation": {
          "latitude": 18.5204,
          "longitude": 73.8567,
          "address": "Head Office, MG Road, Pune"
        },
        "workingMinutes": 540,
        "formattedWorkingHours": "9 hrs"
      }
    ],
    "yearlySummary": {
      "year": 2026,
      "totalPresentDaysYear": 185.5,
      "totalPossibleDaysYear": 365,
      "averageAttendancePercentage": 78.4,
      "formattedAverageAttendance": "78.4%"
    },
    "yearlyMatrix": [
      { "month": 1, "code": "JAN", "name": "January", "presentDays": 22, "daysInMonth": 31, "formatted": "22 Days", "attendancePercentage": 71.0 },
      { "month": 9, "code": "SEP", "name": "September", "presentDays": 22.5, "daysInMonth": 30, "formatted": "22.5 Days", "attendancePercentage": 75.0 }
    ]
  }
}
```

---

### 8. Attendance Report List

* **API Use Case**: Fetch list of attendance records with punch-in/out times, total hours, and locations for admin reports.
* **Method**: `GET`
* **URL**: `/api/v1/super-admin/attendance-report?period=DAILY&date=2026-09-10`
* **Authentication**: Required (`Bearer <accessToken>`)
* **Query Parameters**:
  * `period` (String, optional): `DAILY`, `MONTHLY`, or `YEARLY`. Default: `DAILY`.
  * `date` (String, optional): Target date string (`YYYY-MM-DD`).
  * `search` (String, optional): Search keyword.
  * `page` (Integer, optional): Default `1`.
  * `limit` (Integer, optional): Default `10`.

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Attendance report retrieved successfully.",
  "data": {
    "items": [
      {
        "srNo": 1,
        "id": "66e1234567890abcdef00001",
        "name": "System Admin",
        "profileImage": null,
        "designation": "Super Admin",
        "punchIn": "09:30 AM",
        "punchOut": "06:30 PM",
        "punchInLocation": {
          "latitude": 18.5204,
          "longitude": 73.8567,
          "address": "Head Office, MG Road, Pune"
        },
        "punchOutLocation": {
          "latitude": 18.5204,
          "longitude": 73.8567,
          "address": "Head Office, MG Road, Pune"
        },
        "punchInLatitude": 18.5204,
        "punchInLongitude": 73.8567,
        "punchOutLatitude": 18.5204,
        "punchOutLongitude": 73.8567,
        "totalHrs": "9 hrs",
        "status": "P"
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
}
```

---

### 9. Apply Leave

* **API Use Case**: Submit leave application for an admin user with overlap and date validation.
* **Method**: `POST`
* **URL**: `/api/v1/super-admin/attendance/leave`
* **Authentication**: Required (`Bearer <accessToken>`)
* **Request Body**:
```json
{
  "leaveType": "CASUAL",
  "startDate": "2026-09-20",
  "endDate": "2026-09-22",
  "reason": "Family function"
}
```

#### Request Field Rules:
* `leaveType` (String, required): Enum `['CASUAL', 'SICK', 'EARNED', 'MATERNITY', 'PATERNITY', 'UNPAID']`.
* `startDate` (Date string YYYY-MM-DD, required).
* `endDate` (Date string YYYY-MM-DD, required): Must be on or after `startDate`.
* `reason` (String, optional): Max 500 characters.

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Leave application submitted successfully.",
  "data": {
    "success": true,
    "message": "Leave application submitted successfully.",
    "leave": {
      "id": "66e9876543210fedcba00099",
      "leaveType": "CASUAL",
      "startDate": "2026-09-20",
      "endDate": "2026-09-22",
      "daysCount": 3,
      "status": "PENDING",
      "reason": "Family function"
    }
  }
}
```

---

### 10. Date-wise Attendance History Logs

* **API Use Case**: Fetch detailed date-wise attendance logs with pagination and date range filtering.
* **Method**: `GET`
* **URL**: `/api/v1/super-admin/attendance/history`
* **Authentication**: Required (`Bearer <accessToken>`)
* **Query Parameters**:
  * `startDate` (Date string YYYY-MM-DD, optional).
  * `endDate` (Date string YYYY-MM-DD, optional).
  * `page` (Integer, optional): Default `1`.
  * `limit` (Integer, optional): Default `10`.

---

## ⚡ Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "statusCode": 400,
  "errorCode": "VALIDATION_ERROR",
  "message": "Validation Error",
  "errors": [
    {
      "field": "startDate",
      "message": "startDate must be a valid ISO date string."
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "statusCode": 401,
  "errorCode": "UNAUTHORIZED",
  "message": "Authentication token is missing or expired."
}
```

### 404 Not Found
```json
{
  "success": false,
  "statusCode": 404,
  "errorCode": "RESOURCE_NOT_FOUND",
  "message": "Admin user profile not found."
}
```
