# Merchant Panel Documentation

This folder contains the complete documentation, implementation guide, and API reference for the **Merchant Panel** of the Sahayaone Platform.

---

## 📚 Documentation Index

### 1. 🛠️ [Implementation Guide & Frontend Integration (`IMPLEMENTATION_GUIDE.md`)](./IMPLEMENTATION_GUIDE.md)
Contains system architecture, credit deduction lifecycle, end-to-end user workflows, sequence diagrams, and step-by-step frontend UI integration guides (React/Next.js code snippets, screen layouts, state management, and error handling matrix).

👉 **[Read IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)**

---

### 2. 📖 [Complete API Documentation (`API_DOCUMENTATION.md`)](./API_DOCUMENTATION.md)
Contains full REST API reference for all merchant endpoints, request/response JSON schemas, query parameters, HTTP status codes, and sample cURL/Axios calls for:
- Verification Credit Request APIs (`/api/v1/merchant/verification-credits/*`)
- DigiLocker KYC Verification APIs (`/api/v1/merchant/kyc-verification/*`)
- Experian CIBIL Score APIs (`/api/v1/merchant/cibil-score/*`)
- Society Panel Credit Request Approval APIs (`/api/v1/society/cards-credit/merchant-requests/*`)

👉 **[Read API_DOCUMENTATION.md](./API_DOCUMENTATION.md)**

---

## Quick Reference Summary

- **Base Gateway URL**: `/api/v1/merchant`
- **Authentication**: JWT Bearer (`Authorization: Bearer <TOKEN>`)
- **Allowed Roles**: `MERCHANT`, `VENDOR`
- **Credit Vault**: Verification credits are held and deducted directly at the **Branch level** (`branch.availableVerificationCredits` & `branch.verificationCredits`).
