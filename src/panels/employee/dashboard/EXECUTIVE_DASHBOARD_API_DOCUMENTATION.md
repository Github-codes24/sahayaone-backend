# Executive App - Business Overview Cards API

### Endpoint
`GET /api/v1/employee/dashboard/business-cards`

---

### Headers
```http
Authorization: Bearer <EXECUTIVE_ACCESS_TOKEN>
Content-Type: application/json
```

---

### Request Body / Query Params
None

---

### Response (`200 OK`)

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Executive business overview cards successfully retrieved.",
  "data": {
    "totalLoans": 24,
    "totalPigmy": 8,
    "totalMerchants": 5,
    "cdLoan": {
      "title": "CD Loan",
      "subtitle": "View Customer Loan data",
      "label": "Total Loan",
      "count": 24
    },
    "smartPigmy": {
      "title": "Smart Pigmy",
      "subtitle": "View Smart Pigmy data",
      "label": "Total Pigmy",
      "count": 8
    },
    "merchantOnboard": {
      "title": "Merchant Onboard",
      "subtitle": "View merchant data",
      "label": "Total Merchant",
      "count": 5
    },
    "cards": [
      {
        "id": "cd_loan",
        "title": "CD Loan",
        "subtitle": "View Customer Loan data",
        "label": "Total Loan",
        "count": 24,
        "formattedText": "Total Loan: 24"
      },
      {
        "id": "smart_pigmy",
        "title": "Smart Pigmy",
        "subtitle": "View Smart Pigmy data",
        "label": "Total Pigmy",
        "count": 8,
        "formattedText": "Total Pigmy: 8"
      },
      {
        "id": "merchant_onboard",
        "title": "Merchant Onboard",
        "subtitle": "View merchant data",
        "label": "Total Merchant",
        "count": 5,
        "formattedText": "Total Merchant: 5"
      }
    ]
  }
}
```

---

### Error Response (`401 Unauthorized`)

```json
{
  "success": false,
  "statusCode": 401,
  "errorCode": "AUTH_UNAUTHORIZED",
  "message": "Authentication required. Please provide a valid bearer token."
}
```
