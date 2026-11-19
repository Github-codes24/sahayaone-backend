# Super Admin Profile & Password Management Module

This module provides profile viewing, profile editing (including avatar S3 uploads), self password change, and Super Admin user password reset capabilities for the Super Admin panel.

---

## 🚀 Route Prefix
`http://localhost:5000/api/v1/super-admin/profile`

---

## 🛠 Endpoints Overview

| Method | Endpoint | Description | Auth & Roles |
|---|---|---|---|
| `GET` | `/` | Fetch authenticated admin profile details | `requireAuth` |
| `PUT` | `/` | Update profile details (Name, Email, Phone, Avatar S3 Upload) | `requireAuth` |
| `POST` | `/change-password` | Change password for logged-in user ("Security" tab) | `requireAuth` |
| `POST` | `/reset-user-password/:id` | Reset password for a target Sub-Admin account | `SUPER_ADMIN` |

---

## 📁 Module Directory Structure
```
src/panels/super-admin/profile/
├── controllers/
│   └── profile.controller.js
├── services/
│   └── profile.service.js
├── validators/
│   └── profile.validator.js
├── routes/
│   └── profile.routes.js
├── index.js
└── README.md
```
