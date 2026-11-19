# Super Admin Price Settings - API Documentation

Documentation for the **Super Admin Price Settings API** endpoints. These endpoints manage global unit pricing and minimum purchase limits for EMI Cards and Verification Credits across all panels (Super Admin, Onboarding Team, and Society Panel).

---

## Base Path
`/api/v1/super-admin/settings/price`

---

## Authentication & Authorization
- **Middleware**: Requires valid JWT bearer token.
- **Roles Allowed**: `SUPER_ADMIN`, `SUB_ADMIN`
- **Permissions Required**:
  - `GET`: `settings:view_only` or `settings:edit`
  - `PUT`: `settings:edit`

---

## Endpoints

### 1. Get Price Settings
Retrieves current global pricing and minimum purchase limits for EMI Cards and Verification Credits.

- **Method**: `GET`
- **URL**: `/api/v1/super-admin/settings/price`
- **Headers**:
  ```http
  Authorization: Bearer <super_admin_access_token>
  ```

- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Price settings retrieved successfully.",
    "data": {
      "_id": "66db281f9a1c1d0012a4e950",
      "emiCardPriceForBank": 499,
      "emiCardMinPurchaseQuantity": 100,
      "verificationCreditPriceForBank": 50,
      "verificationCreditMinPurchaseQuantity": 200,
      "EMI_CARD_CHARGES": 499,
      "EMI_CARD_PRICE": 499,
      "VERIFICATION_CREDIT_PRICE": 50,
      "MIN_EMI_CARD_LIMIT": 100,
      "MIN_VERIFICATION_CREDIT_LIMIT": 200,
      "updatedAt": "2026-09-10T12:15:00.000Z"
    }
  }
  ```

- **Field Descriptions**:
  | Field Name | Type | Description |
  | :--- | :--- | :--- |
  | `emiCardPriceForBank` | Number | Unit price (in ₹) per EMI Card for bank onboarding and credit purchase. |
  | `emiCardMinPurchaseQuantity` | Number | Minimum required quantity threshold for purchasing EMI Cards. |
  | `verificationCreditPriceForBank` | Number | Unit price (in ₹) per Verification Credit for bank onboarding. |
  | `verificationCreditMinPurchaseQuantity` | Number | Minimum required quantity threshold for purchasing Verification Credits. |
  | `EMI_CARD_CHARGES` | Number | Direct `Setting` collection key value for EMI Card charges. |
  | `VERIFICATION_CREDIT_PRICE` | Number | Direct `Setting` collection key value for Verification Credit unit price. |
  | `MIN_EMI_CARD_LIMIT` | Number | Direct `Setting` collection key value for minimum EMI Card limit. |
  | `MIN_VERIFICATION_CREDIT_LIMIT` | Number | Direct `Setting` collection key value for minimum Verification Credit limit. |

---

### 2. Update Price Settings
Updates global pricing rates and minimum purchase limits. Synchronizes changes in real time to both the `Setting` collection and the `PriceSetting` model.

- **Method**: `PUT`
- **URL**: `/api/v1/super-admin/settings/price`
- **Headers**:
  ```http
  Authorization: Bearer <super_admin_access_token>
  Content-Type: application/json
  ```

- **Request Body Options**:
  Standard camelCase payload:
  ```json
  {
    "emiCardPriceForBank": 499,
    "emiCardMinPurchaseQuantity": 100,
    "verificationCreditPriceForBank": 50,
    "verificationCreditMinPurchaseQuantity": 200
  }
  ```

  Alternative / Alias payload format:
  ```json
  {
    "EMI_CARD_CHARGES": 499,
    "MIN_EMI_CARD_LIMIT": 100,
    "VERIFICATION_CREDIT_PRICE": 50,
    "MIN_VERIFICATION_CREDIT_LIMIT": 200
  }
  ```

- **Validation Rules**:
  - `emiCardPriceForBank` / `EMI_CARD_CHARGES` / `EMI_CARD_PRICE`: Must be a number `>= 0`.
  - `emiCardMinPurchaseQuantity` / `MIN_EMI_CARD_LIMIT`: Must be an integer `>= 1`.
  - `verificationCreditPriceForBank` / `VERIFICATION_CREDIT_PRICE`: Must be a number `>= 0`.
  - `verificationCreditMinPurchaseQuantity` / `MIN_VERIFICATION_CREDIT_LIMIT`: Must be an integer `>= 1`.

- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Price settings updated successfully.",
    "data": {
      "_id": "66db281f9a1c1d0012a4e950",
      "emiCardPriceForBank": 499,
      "emiCardMinPurchaseQuantity": 100,
      "verificationCreditPriceForBank": 50,
      "verificationCreditMinPurchaseQuantity": 200,
      "EMI_CARD_CHARGES": 499,
      "EMI_CARD_PRICE": 499,
      "VERIFICATION_CREDIT_PRICE": 50,
      "MIN_EMI_CARD_LIMIT": 100,
      "MIN_VERIFICATION_CREDIT_LIMIT": 200,
      "updatedAt": "2026-09-10T12:25:00.000Z"
    }
  }
  ```

- **Error Responses**:
  - **`400 Bad Request / 422 Validation Error`**:
    ```json
    {
      "success": false,
      "statusCode": 422,
      "errorCode": "VALIDATION_ERROR",
      "message": "EMI Card Price For Bank cannot be negative",
      "details": [
        {
          "field": "emiCardPriceForBank",
          "message": "EMI Card Price For Bank cannot be negative"
        }
      ]
    }
    ```
  - **`401 Unauthorized`**:
    ```json
    {
      "success": false,
      "statusCode": 401,
      "errorCode": "UNAUTHORIZED",
      "message": "Authentication token missing or invalid."
    }
    ```
  - **`403 Forbidden`**:
    ```json
    {
      "success": false,
      "statusCode": 403,
      "errorCode": "FORBIDDEN",
      "message": "Access denied. Insufficient permissions to edit settings."
    }
    ```
