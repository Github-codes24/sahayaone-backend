# Sahayaone - Enterprise Loan Management ERP Backend

Sahayaone is a clean, scalable, production-ready Enterprise Loan Management ERP backend. It utilizes Node.js, Express, Mongoose, and modern JavaScript (ES Modules).

For a complete specification of all backend endpoints, payloads, validation schemas, and error responses, refer to the [API Reference Documentation](file:///c:/Users/Dell/Desktop/sahayaone-backend/API_DOCUMENTATION.md).

---

## 1. Core Architectural Characteristics

- **Modular MVC Design**: Each domain component (`auth`, `user`, `customer`, `loan`, `kyc`) is self-contained. It groups routes, controllers, services, repositories, validators, and models in a single module.
- **Hybrid Data Collections**: Features a unified identity collection (`User`) for simple, secure logins alongside polymorphic profile collections (`EmployeeProfile`, `CustomerProfile`, `MerchantProfile`).
- **Clean Separation of Concerns**: Controllers delegate request checking and response formatting. Services handle core business logic, and Repositories run database operations.
- **Pluggable Architecture**: Integrates pluggable strategy patterns for SMS, file storage (AWS S3, Cloudinary, Local), and email delivery (SMTP, SES, Mailgun).

---

## 2. Directory Layout Reference

```text
Sahayaone/
├── src/
│   ├── config/             # Environment & service config loaders
│   ├── common/             # Cross-cutting concerns & shared base classes
│   │   ├── controllers/    # BaseController
│   │   ├── repositories/   # BaseRepository
│   │   ├── services/       # BaseService
│   │   ├── errors/         # Centralized custom error library
│   │   ├── middleware/     # Auth, RBAC, auditing, request validation, security
│   │   └── utils/          # Winston loggers, JWT, crypto, date formatting
│   ├── modules/            # Isolated business domain modules
│   │   ├── auth/           # Login flows, strategy selection
│   │   ├── user/           # Core User identities & Employee profiles
│   │   ├── customer/       # Customer profiles & device fingerprints
│   │   ├── role/           # Roles, permissions models
│   │   ├── branch/         # Internal branches configuration
│   │   ├── loan/           # Loan applications, products, ledgers
│   │   ├── kyc/            # Verification step logs
│   │   └── notification/   # Notification gateways (Email/SMS dispatchers)
│   ├── database/           # Mongoose connections pool & plugins (Soft Delete)
│   ├── emails/             # Layout templates & mail clients (SMTP/SES)
│   └── storage/            # Disk strategy providers (S3/Cloudinary/Local)
├── server.js               # Express configurations & listener hooks
├── index.js                # System process starter & exception tracker
└── package.json            # NPM dependencies (ESM enabled)
```

---

## 3. Quickstart & Setup Guide

### 1. Configure the Environment
Ensure your local environment configuration is set up:
```bash
cp .env.example .env
```

### 2. Install Project Dependencies
Run the installation process to fetch security, validation, database, and logging libraries:
```bash
npm install
```

### 3. Bootstrap Seed Data (Super Admin)
Run the automated migration seeder script to populate default admin credentials:
```bash
npm run seed
```
- **Username**: `admin@sahayaone.com`
- **Password**: `Admin@123`
- **Role**: `SUPER_ADMIN`

### 4. Boot Up Local Server
Start the development server with real-time file watching:
```bash
npm run dev
```
The application gateway listens on: `http://localhost:5000/api/v1`

---

## 4. Coding Conventions & Best Practices

1. **Imports Requirement**: Always include the `.js` extension when importing local files:
   ```javascript
   import { environment } from './config/environment.js'; // Correct
   import { environment } from './config/environment';    // Error
   ```
2. **Error Throwing**: Never throw raw JavaScript strings or generic errors. Always use custom application exceptions:
   ```javascript
   import { ApiError } from '../errors/apiError.js';
   throw ApiError.badRequest('The requested loan scheme is invalid.');
   ```
3. **Database soft deletes**: This project implements soft deletes using Mongoose. To query a record that includes soft-deleted items, pass the `includeDeleted: true` query flag:
   ```javascript
   const query = User.find({ includeDeleted: true });
   ```
