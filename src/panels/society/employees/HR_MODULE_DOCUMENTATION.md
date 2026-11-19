# API & Implementation Documentation: Society HR Module

This document details the backend structure, database updates, and endpoints implemented for the **HR Department sub-module** in the **Society Panel**.

---

## 1. Database Model Updates

### 1.1 Daily Work Report Schema
Located at `src/models/daily-work-report.model.js`.
```javascript
{
  employeeId: Schema.Types.ObjectId, // ref: 'SocietyEmployee' (indexed)
  bankId: Schema.Types.ObjectId,     // ref: 'Bank' (indexed)
  branchId: Schema.Types.ObjectId,   // ref: 'Branch' (indexed)
  date: Date,                        // Report target date (indexed)
  product: String,                   // Product category (e.g. "Loan Disbursement")
  amount: Number,                    // Achieved amount (non-negative)
  remarks: String,                   // Optional log notes
  isDeleted: Boolean,                // Soft delete support (default: false)
  createdBy: Schema.Types.ObjectId   // ref: 'User'
}
```

### 1.2 Employee Schema Extension
Located at `src/models/society-employee.model.js`. Added:
```javascript
marriageAnniversaryDate: {
  type: Date,
  default: null
}
```

---

## 2. API Reference & Controller Responses

### 2.1 Daily Work Reports

#### Log Daily Work Report
* **Endpoint:** `POST /api/v1/society/employees/hr/work-reports`
* **Request Body:**
  ```json
  {
    "employeeId": "64bc7a2f1c8e1a1234567890",
    "date": "2026-07-31",
    "product": "Loan Disbursement",
    "amount": 200000,
    "remarks": "Completed target documentation."
  }
  ```
* **Success Response (`201 Created`):**
  ```json
  {
    "success": true,
    "statusCode": 201,
    "message": "Daily Work Report logged successfully.",
    "data": {
      "_id": "64c5d82a1c8e1a0987654321",
      "employeeId": "64bc7a2f1c8e1a1234567890",
      "bankId": "64bc7a2f1c8e1a1234567891",
      "branchId": "64bc7a2f1c8e1a1234567892",
      "date": "2026-07-31T00:00:00.000Z",
      "product": "Loan Disbursement",
      "amount": 200000,
      "remarks": "Completed target documentation.",
      "isDeleted": false,
      "createdAt": "2026-08-03T11:18:00.000Z",
      "updatedAt": "2026-08-03T11:18:00.000Z"
    }
  }
  ```

#### Get Daily Work Reports List
* **Endpoint:** `GET /api/v1/society/employees/hr/work-reports`
* **Query Params:** `page`, `limit`, `search`, `designations`, `states`, `branchIds`, `date`
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Daily Work Reports list retrieved successfully.",
    "data": [
      {
        "srNo": 1,
        "id": "64c5d82a1c8e1a0987654321",
        "employeeName": "Clark Kent",
        "designation": "Branch Manager",
        "branch": "Mumbai Branch",
        "product": "Loan Disbursement",
        "amount": 200000,
        "formattedAmount": "₹2,00,000",
        "remarks": "Completed target documentation.",
        "date": "2026-07-31T00:00:00.000Z"
      }
    ],
    "meta": {
      "totalRecords": 30,
      "limit": 10,
      "page": 1,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
  ```

#### Export Daily Work Reports (CSV)
* **Endpoint:** `GET /api/v1/society/employees/hr/work-reports/export`
* **Response Header:** `Content-Type: text/csv`
* **Output Stream Example:**
  ```csv
  Sr.No.,Employee Name,Designation,Branch,Product,Amount,Remarks,Date
  1,"Clark Kent","Branch Manager","Mumbai Branch","Loan Disbursement",200000,"Completed target documentation.","07-31-2026"
  ```

---

### 2.2 KPA Reports

#### Get KPA Employee List
* **Endpoint:** `GET /api/v1/society/employees/hr/kpa-reports`
* **Query Params:** Same search filters as work reports.
* **Success Response (`200 OK`):** Returns paginated basic profiles list of active bank/branch staff.

#### Get Employee KPA Progress Detail
* **Endpoint:** `GET /api/v1/society/employees/hr/:id/kpa-reports/detail`
* **Query Params:** `year` (e.g. 2026), `product` (e.g. "Loan Disbursement")
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Employee KPA targets details retrieved successfully.",
    "data": {
      "employee": {
        "id": "64bc7a2f1c8e1a1234567890",
        "fullName": "Clark Kent",
        "designation": "Branch Manager",
        "phoneNumber": "9876543210",
        "email": "clark.kent@mail.com",
        "branchName": "Mumbai Branch"
      },
      "product": "Loan Disbursement",
      "year": 2026,
      "yearly": { "goal": 2400000, "formattedGoal": "₹24,00,000", "achieved": 1440000, "formattedAchieved": "₹14,40,000", "percentage": 60 },
      "monthly": { "goal": 200000, "formattedGoal": "₹2,00,000", "achieved": 130000, "formattedAchieved": "₹1,30,000", "percentage": 65 },
      "weekly": { "goal": 50000, "formattedGoal": "₹50,000", "achieved": 36000, "formattedAchieved": "₹36,000", "percentage": 72 },
      "daily": { "goal": 10000, "formattedGoal": "₹10,000", "achieved": 8000, "formattedAchieved": "₹8,000", "percentage": 80 }
    }
  }
  ```

---

### 2.3 Important Dates

#### Get Celebrations Feed
* **Endpoint:** `GET /api/v1/society/employees/hr/important-dates`
* **Query Params:** `celebrationTypes` (Birthday/Work Anniversary/Marriage Anniversary), `date`
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Important Dates feed retrieved successfully.",
    "data": [
      {
        "srNo": 1,
        "id": "64bc7a2f1c8e1a1234567890_work",
        "employeeName": "Clark Kent",
        "designation": "Branch Manager",
        "state": "Maharashtra",
        "branch": "Mumbai Branch",
        "celebration": "2 Years Work Anniversary",
        "day": 5
      }
    ]
  }
  ```

---

### 2.4 Letters & Payroll PDF Generation
*All endpoints are `POST`.*
* **JSON Mode (`Accept: application/json` or `?format=json`):** Returns JSON containing `fileUrl` (S3/storage URL), `fileKey`, and document metadata.
* **PDF Download Mode:** Returns binary stream (`Content-Type: application/pdf`) and exposes S3 URL in `X-File-Url` response header.
* **Automatic PDF Email Attachments:**
  All employee letters (Offer Letter, Confirmation Letter, Performance Letter, Promotion Letter, Transfer Letter, Salary Slip, Increment Letter, Termination Letter) are automatically sent with the PDF document attached to outgoing email notifications.
  - **Email Provider Attachment Support (`msg91-email.provider.js`)**: Added attachment formatting in `Msg91EmailProvider` to parse Base64, Buffers, or file objects and attach them directly to MSG91 Email API (`v5/email/send`) requests under the `attachments` payload array.
  - **PDF Attachment Resolution in HR Email Service (`hr-letter-email.service.js`)**: Updated `hrLetterEmailService.sendLetterEmail` to resolve PDF document buffers (Direct Buffer, Remote URL/S3 fetch, or Auto-Generation fallback) and format the PDF filename dynamically (e.g. `offer-letter_Bhushan_Sahare.pdf`).

#### Endpoints
1. **Offer Letter**: `POST /letters/offer`
   * Body: `{ "employeeId": "string" }`
2. **Confirmation**: `POST /letters/confirmation`
   * Body: `{ "employeeId": "string", "confirmationDate": "2026-08-01" }`
3. **Performance**: `POST /letters/performance`
   * Body: `{ "employeeId": "string", "letterText": "Review details here..." }`
4. **Promotion**: `POST /letters/promotion`
   * Body: `{ "employeeId": "string", "promotedToDesignation": "Senior Manager", "promotionDate": "2026-08-01" }`
5. **Transfer**: `POST /letters/transfer`
   * Body: `{ "employeeId": "string", "transferToBranchId": "target_branch_id", "transferDate": "2026-08-01" }`
6. **Salary Slip**: `POST /letters/salary-slip`
   * Body: `{ "employeeId": "string", "fromMonth": "July", "toMonth": "July" }`
7. **Salary Increment**: `POST /letters/salary-increment`
   * Body: `{ "employeeId": "string", "incrementPercentage": 10, "fromMonth": "August" }`
8. **Termination Letter**: `POST /letters/termination`
   * Body: `{ "employeeId": "string", "terminationDate": "2026-08-31", "reason": "Contract Completion" }`

---

### 2.5 Employee Breakdown Statistics & List

#### Get Employee Breakdown
* **Endpoint:** `GET /api/v1/society/employees/hr/breakdown` (or `GET /api/v1/society/employees/hr/employee-breakdown`)
* **Access Isolation:** Automatically restricted to the logged-in user's branch for Branch Users (Branch Managers).
* **Query Params:**
  - `search` (string) — searches full name, employeeCode, email, phone number
  - `employeeId` / `employeeCode` (string) — specific search by employee ID or employee code
  - `branchId` (string) / `branchIds` (string/array) — filter by branch(es) (Bank Owner context only)
  - `status` (`'ACTIVE'`, `'INACTIVE'`, `'ALL'`, `'DELETED'`)
  - `department` (string/array) — filter by department(s)
  - `designations` (string/array) — filter by designation(s)
  - `states` (string/array) — filter by state(s)
* **Success Response (`200 OK`):**
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

