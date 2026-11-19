# Society Panel Attendance & Attendance Report API Documentation

This document describes the API endpoints for **Society Panel Attendance Operations and Attendance Reports**, enabling employees, branch managers, and society admins to mark punch-in/punch-out with geolocation, view monthly attendance sheets, access single-person monthly & 12-month yearly attendance matrix reports, and submit leave requests.

---

## 🌐 Base URL & Headers

### Base URL
```text
http://localhost:5000/api/v1/society/attendance
http://localhost:5000/api/v1/society/attendance-report
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
| `GET` | `/api/v1/society/attendance/today` | Fetch today's attendance snapshot, punch status, and shift details |
| `POST` | `/api/v1/society/attendance/punch-in` | Record employee Punch-In check-in with GPS coordinates & address |
| `POST` | `/api/v1/society/attendance/punch-out` | Record employee Punch-Out check-out with working & overtime calculation |
| `GET` | `/api/v1/society/attendance/report` | Fetch monthly attendance cards summary (present, absent, overtime, etc.) |
| `GET` | `/api/v1/society/attendance/sheet` | Fetch all employee monthly attendance sheet/grid with location, branch, search, & pagination |
| `GET` | `/api/v1/society/attendance/yearly-matrix` | Fetch all employee 12-month yearly matrix data (JAN-DEC present days & avg attendance %) |
| `GET` | `/api/v1/society/attendance/single-report` | **NEW**: Single person monthly attendance sheet & 12-month yearly matrix with punch locations |
| `GET` | `/api/v1/society/attendance/employee/:id/report` | **NEW**: Single person monthly attendance sheet & 12-month yearly matrix by employee ID |
| `GET` | `/api/v1/society/attendance-report/single-person` | **NEW**: Single person attendance report endpoint under attendance-report module |
| `GET` | `/api/v1/society/attendance-report/employee/:id` | **NEW**: Single person attendance report by ID under attendance-report module |
| `GET` | `/api/v1/society/attendance/history` | Fetch detailed date-wise attendance history logs |
| `POST` | `/api/v1/society/attendance/leave` | Submit leave application with date validation & overlap check |

---

## 📖 Detailed API Specifications

### 1. Punch-In (Check-In)

* **Method**: `POST`
* **URL**: `/api/v1/society/attendance/punch-in`
* **Headers**: `Authorization: Bearer <token>`
* **Request Body**:
```json
{
  "latitude": 18.5204,
  "longitude": 73.8567,
  "address": "Nagpur Branch Office, Wardha Road, Nagpur"
}
```
*(Supports payload aliases: `latitute`, `langitute`, `lat`, `lng`, or nested `location: { latitude, longitude, address }`)*

#### Field Rules:
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
        "address": "Nagpur Branch Office, Wardha Road, Nagpur",
        "city": "Nagpur",
        "state": "Maharashtra",
        "pincode": "440015"
      }
    }
  }
}
```

---

### 2. Punch-Out (Check-Out)

* **Method**: `POST`
* **URL**: `/api/v1/society/attendance/punch-out`
* **Headers**: `Authorization: Bearer <token>`
* **Request Body**:
```json
{
  "latitute": 18.5204,
  "langitute": 73.8567,
  "address": "Nagpur Branch Office, Wardha Road, Nagpur"
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
        "address": "Nagpur Branch Office, Wardha Road, Nagpur",
        "city": "Nagpur",
        "state": "Maharashtra",
        "pincode": "440015"
      }
    }
  }
}
```

---

### 3. Single Person Attendance Report (Monthly Sheet & 12-Month Matrix)

Retrieves a complete individual attendance report for a specific employee or branch manager. Includes employee profile info, day-by-day punch log with GPS coordinates and reverse-geocoded addresses for the requested month, and a full 12-month (JAN-DEC) attendance matrix.

* **Method**: `GET`
* **URLs**:
  * `/api/v1/society/attendance/single-report?employeeId=66e1234567890abcdef00012&month=9&year=2026`
  * `/api/v1/society/attendance/employee/66e1234567890abcdef00012/report?month=9&year=2026`
  * `/api/v1/society/attendance-report/single-person?employeeId=66e1234567890abcdef00012&month=9&year=2026`
  * `/api/v1/society/attendance-report/employee/66e1234567890abcdef00012?month=9&year=2026`
* **Authentication**: Required (`Bearer <accessToken>`)
* **Query Parameters**:
  * `employeeId` / `userId` / `id` (ObjectId string, optional): Target employee ID or user ID. If omitted, uses current logged-in user context.
  * `month` (Integer, optional): Month number (`1` to `12`). Defaults to current month.
  * `year` (Integer, optional): Year (`2020` to `2035`). Defaults to current year.

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Single person attendance report retrieved successfully.",
  "data": {
    "success": true,
    "employee": {
      "id": "66e1234567890abcdef00012",
      "userId": "66e1234567890abcdef00010",
      "type": "SOCIETY_EMPLOYEE",
      "fullName": "Rajesh Kumar Sharma",
      "designation": "Executive Officer",
      "employeeCode": "EMP-104",
      "email": "rajesh@sahayaone.com",
      "phoneNumber": "9876543210",
      "branchId": "66e1234567890abcdef00005",
      "branchName": "Khamla Branch",
      "profileImage": "https://cdn.sahayaone.com/profiles/rajesh.jpg"
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
          "address": "FC Road Office, Pune, Maharashtra",
          "city": "Pune",
          "state": "Maharashtra",
          "pincode": "411004"
        },
        "punchOutLocation": {
          "latitude": 18.5204,
          "longitude": 73.8567,
          "address": "FC Road Office, Pune, Maharashtra",
          "city": "Pune",
          "state": "Maharashtra",
          "pincode": "411004"
        },
        "punchInLatitude": 18.5204,
        "punchInLongitude": 73.8567,
        "punchOutLatitude": 18.5204,
        "punchOutLongitude": 73.8567,
        "isLate": false,
        "lateMinutes": 0,
        "isEarlyLeave": false,
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
      {
        "month": 1,
        "code": "JAN",
        "name": "January",
        "presentDays": 22,
        "daysInMonth": 31,
        "formatted": "22 Days",
        "attendancePercentage": 71.0
      },
      {
        "month": 2,
        "code": "FEB",
        "name": "February",
        "presentDays": 20,
        "daysInMonth": 28,
        "formatted": "20 Days",
        "attendancePercentage": 71.4
      },
      {
        "month": 9,
        "code": "SEP",
        "name": "September",
        "presentDays": 22.5,
        "daysInMonth": 30,
        "formatted": "22.5 Days",
        "attendancePercentage": 75.0
      }
    ]
  }
}
```

---

### 4. Get Attendance Report Items (With Geolocation & Coordinates)

* **Method**: `GET`
* **URL**: `/api/v1/society/attendance-report?period=DAILY&date=2026-09-10`
* **Headers**: `Authorization: Bearer <token>`

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
        "id": "66e1234567890abcdef00012",
        "name": "Rajesh Kumar Sharma",
        "profileImage": "https://cdn.sahayaone.com/profiles/rajesh.jpg",
        "designation": "Executive Officer",
        "punchIn": "09:30 AM",
        "punchOut": "06:30 PM",
        "punchInLocation": {
          "latitude": 18.5204,
          "longitude": 73.8567,
          "address": "FC Road Office, Pune, Maharashtra",
          "city": "Pune",
          "state": "Maharashtra",
          "pincode": "411004"
        },
        "punchOutLocation": {
          "latitude": 18.5204,
          "longitude": 73.8567,
          "address": "FC Road Office, Pune, Maharashtra",
          "city": "Pune",
          "state": "Maharashtra",
          "pincode": "411004"
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

## ⚙️ Key Implementation Highlights

1. **Flexible Coordinate Payload Acceptance**: Punch-In and Punch-Out APIs seamlessly parse standard `latitude`/`longitude`, client typos (`latitute`/`langitute`), short keys (`lat`/`lng`), or nested `location` objects.
2. **Complete Single-Person Attendance Report**: Consolidates employee profile, monthly day-by-day punch log (with GPS coordinates and reverse-geocoded address), and 12-month (JAN-DEC) matrix in a single request.
3. **Geo-Location Integration**: Punch locations (`punchInLocation` and `punchOutLocation`) are stored in MongoDB and returned in all report endpoints.
