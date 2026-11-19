import {
  ALL_INVENTORY_PERMISSIONS,
  getAvailableInventoryPermissionsGrouped
} from './inventory-permission.constant.js';

export const SOCIETY_PERMISSIONS = Object.freeze({
  DASHBOARD: {
    VIEW: 'dashboard.view'
  },
  BRANCH: {
    VIEW: 'branch.view',
    CREATE: 'branch.create',
    UPDATE: 'branch.update',
    DELETE: 'branch.delete'
  },
  EMPLOYEE: {
    VIEW: 'employee.view',
    CREATE: 'employee.create',
    UPDATE: 'employee.update',
    DELETE: 'employee.delete'
  },
  ROLE: {
    VIEW: 'role.view',
    CREATE: 'role.create',
    UPDATE: 'role.update',
    DELETE: 'role.delete'
  },
  LEAD: {
    VIEW: 'lead.view',
    CREATE: 'lead.create',
    UPDATE: 'lead.update',
    DELETE: 'lead.delete'
  },
  INVENTORY: {
    VIEW: 'inventory.view',
    CREATE: 'inventory.create',
    UPDATE: 'inventory.update',
    DELETE: 'inventory.delete'
  },
  KYC: {
    VIEW: 'kyc.view',
    CREATE: 'kyc.create',
    UPDATE: 'kyc.update'
  },
  CREDIT_SCORE: {
    VIEW: 'credit_score.view',
    CREATE: 'credit_score.create'
  },
  RECEIPT: {
    VIEW: 'receipt.view',
    CREATE: 'receipt.create',
    UPDATE: 'receipt.update',
    APPROVE: 'receipt.approve',
    DELETE: 'receipt.delete'
  },
  ATTENDANCE: {
    VIEW: 'attendance.view',
    CREATE: 'attendance.create',
    UPDATE: 'attendance.update'
  },
  PAYROLL: {
    VIEW: 'payroll.view',
    CREATE: 'payroll.create',
    UPDATE: 'payroll.update'
  },
  DAILY_WORK_REPORT: {
    VIEW: 'daily_work_report.view',
    CREATE: 'daily_work_report.create',
    UPDATE: 'daily_work_report.update'
  },
  KRA: {
    VIEW: 'kra.view',
    CREATE: 'kra.create',
    UPDATE: 'kra.update'
  },
  CARDS_CREDIT: {
    VIEW: 'cards_credit.view',
    CREATE: 'cards_credit.create',
    UPDATE: 'cards_credit.update'
  },
  CASH_PAYMENT: {
    VIEW: 'cash_payment.view',
    CREATE: 'cash_payment.create'
  },
  MERCHANT: {
    VIEW: 'merchant.view',
    CREATE: 'merchant.create',
    UPDATE: 'merchant.update',
    DELETE: 'merchant.delete'
  },
  HELP_SUPPORT: {
    VIEW: 'help_support.view'
  },
  REPORT: {
    VIEW: 'report.view',
    EXPORT: 'report.export'
  }
});

// Flat list of all valid permission string values, including inventory module permissions
export const ALL_SOCIETY_PERMISSIONS = [
  ...Object.values(SOCIETY_PERMISSIONS).flatMap((mod) => Object.values(mod)),
  ...ALL_INVENTORY_PERMISSIONS
];

// Formatted structure for UI checkbox rendering
export const getAvailableSocietyPermissionsGrouped = () => {
  return {
    modules: [
      {
        module: 'dashboard',
        label: 'Dashboard',
        permissions: [{ key: SOCIETY_PERMISSIONS.DASHBOARD.VIEW, label: 'View' }]
      },
      {
        module: 'branch',
        label: 'Branch Management',
        permissions: [
          { key: SOCIETY_PERMISSIONS.BRANCH.VIEW, label: 'View' },
          { key: SOCIETY_PERMISSIONS.BRANCH.CREATE, label: 'Create' },
          { key: SOCIETY_PERMISSIONS.BRANCH.UPDATE, label: 'Edit' },
          { key: SOCIETY_PERMISSIONS.BRANCH.DELETE, label: 'Delete' }
        ]
      },
      {
        module: 'employee',
        label: 'Employee Management',
        permissions: [
          { key: SOCIETY_PERMISSIONS.EMPLOYEE.VIEW, label: 'View' },
          { key: SOCIETY_PERMISSIONS.EMPLOYEE.CREATE, label: 'Create' },
          { key: SOCIETY_PERMISSIONS.EMPLOYEE.UPDATE, label: 'Edit' },
          { key: SOCIETY_PERMISSIONS.EMPLOYEE.DELETE, label: 'Delete' }
        ]
      },
      {
        module: 'role',
        label: 'Roles & Permissions',
        permissions: [
          { key: SOCIETY_PERMISSIONS.ROLE.VIEW, label: 'View' },
          { key: SOCIETY_PERMISSIONS.ROLE.CREATE, label: 'Create' },
          { key: SOCIETY_PERMISSIONS.ROLE.UPDATE, label: 'Edit' },
          { key: SOCIETY_PERMISSIONS.ROLE.DELETE, label: 'Delete' }
        ]
      },
      {
        module: 'lead',
        label: 'Leads & Applications',
        permissions: [
          { key: SOCIETY_PERMISSIONS.LEAD.VIEW, label: 'View' },
          { key: SOCIETY_PERMISSIONS.LEAD.CREATE, label: 'Create' },
          { key: SOCIETY_PERMISSIONS.LEAD.UPDATE, label: 'Edit' },
          { key: SOCIETY_PERMISSIONS.LEAD.DELETE, label: 'Delete' }
        ]
      },
      {
        module: 'inventory',
        label: 'Inventory',
        permissions: [
          { key: SOCIETY_PERMISSIONS.INVENTORY.VIEW, label: 'View' },
          { key: SOCIETY_PERMISSIONS.INVENTORY.CREATE, label: 'Create' },
          { key: SOCIETY_PERMISSIONS.INVENTORY.UPDATE, label: 'Edit' },
          { key: SOCIETY_PERMISSIONS.INVENTORY.DELETE, label: 'Delete' }
        ]
      },
      {
        module: 'kyc',
        label: 'Customer KYC Verification',
        permissions: [
          { key: SOCIETY_PERMISSIONS.KYC.VIEW, label: 'View' },
          { key: SOCIETY_PERMISSIONS.KYC.CREATE, label: 'Create' },
          { key: SOCIETY_PERMISSIONS.KYC.UPDATE, label: 'Edit' }
        ]
      },
      {
        module: 'credit_score',
        label: 'Credit Score Assessment',
        permissions: [
          { key: SOCIETY_PERMISSIONS.CREDIT_SCORE.VIEW, label: 'View' },
          { key: SOCIETY_PERMISSIONS.CREDIT_SCORE.CREATE, label: 'Create' }
        ]
      },
      {
        module: 'receipt',
        label: 'Receipts & Collections',
        permissions: [
          { key: SOCIETY_PERMISSIONS.RECEIPT.VIEW, label: 'View' },
          { key: SOCIETY_PERMISSIONS.RECEIPT.CREATE, label: 'Create' },
          { key: SOCIETY_PERMISSIONS.RECEIPT.UPDATE, label: 'Edit' },
          { key: SOCIETY_PERMISSIONS.RECEIPT.APPROVE, label: 'Approve & Reject' },
          { key: SOCIETY_PERMISSIONS.RECEIPT.DELETE, label: 'Delete' }
        ]
      },
      {
        module: 'attendance',
        label: 'Attendance & Shifts',
        permissions: [
          { key: SOCIETY_PERMISSIONS.ATTENDANCE.VIEW, label: 'View' },
          { key: SOCIETY_PERMISSIONS.ATTENDANCE.CREATE, label: 'Create' },
          { key: SOCIETY_PERMISSIONS.ATTENDANCE.UPDATE, label: 'Edit' }
        ]
      },
      {
        module: 'payroll',
        label: 'Payroll',
        permissions: [
          { key: SOCIETY_PERMISSIONS.PAYROLL.VIEW, label: 'View' },
          { key: SOCIETY_PERMISSIONS.PAYROLL.CREATE, label: 'Create' },
          { key: SOCIETY_PERMISSIONS.PAYROLL.UPDATE, label: 'Edit' }
        ]
      },
      {
        module: 'daily_work_report',
        label: 'Daily Work Reports',
        permissions: [
          { key: SOCIETY_PERMISSIONS.DAILY_WORK_REPORT.VIEW, label: 'View' },
          { key: SOCIETY_PERMISSIONS.DAILY_WORK_REPORT.CREATE, label: 'Create' },
          { key: SOCIETY_PERMISSIONS.DAILY_WORK_REPORT.UPDATE, label: 'Edit' }
        ]
      },
      {
        module: 'kra',
        label: 'KRA & Target Settings',
        permissions: [
          { key: SOCIETY_PERMISSIONS.KRA.VIEW, label: 'View' },
          { key: SOCIETY_PERMISSIONS.KRA.CREATE, label: 'Create' },
          { key: SOCIETY_PERMISSIONS.KRA.UPDATE, label: 'Edit' }
        ]
      },
      {
        module: 'cards_credit',
        label: 'Cards & Credits Management',
        permissions: [
          { key: SOCIETY_PERMISSIONS.CARDS_CREDIT.VIEW, label: 'View' },
          { key: SOCIETY_PERMISSIONS.CARDS_CREDIT.CREATE, label: 'Create' },
          { key: SOCIETY_PERMISSIONS.CARDS_CREDIT.UPDATE, label: 'Edit' }
        ]
      },
      {
        module: 'cash_payment',
        label: 'Cash Payments',
        permissions: [
          { key: SOCIETY_PERMISSIONS.CASH_PAYMENT.VIEW, label: 'View' },
          { key: SOCIETY_PERMISSIONS.CASH_PAYMENT.CREATE, label: 'Create' }
        ]
      },
      {
        module: 'merchant',
        label: 'Merchant Management',
        permissions: [
          { key: SOCIETY_PERMISSIONS.MERCHANT.VIEW, label: 'View' },
          { key: SOCIETY_PERMISSIONS.MERCHANT.CREATE, label: 'Create' },
          { key: SOCIETY_PERMISSIONS.MERCHANT.UPDATE, label: 'Edit' },
          { key: SOCIETY_PERMISSIONS.MERCHANT.DELETE, label: 'Delete' }
        ]
      },
      {
        module: 'help_support',
        label: 'Help & Support',
        permissions: [{ key: SOCIETY_PERMISSIONS.HELP_SUPPORT.VIEW, label: 'View' }]
      },
      {
        module: 'report',
        label: 'Reports & Analytics',
        permissions: [
          { key: SOCIETY_PERMISSIONS.REPORT.VIEW, label: 'View' },
          { key: SOCIETY_PERMISSIONS.REPORT.EXPORT, label: 'Export' }
        ]
      }
    ],
    predefinedRoles: [
      {
        code: 'MANAGER',
        name: 'Branch Manager',
        description: 'Branch management, employee oversight, loan applications, KYC, receipts, and operational supervision.'
      },
      {
        code: 'RECEIPT_MANAGER',
        name: 'Bank Receipt Manager',
        description: 'Bank-wide receipt management, approvals, rejections, audits, and collection tracking across all branches.'
      },
      {
        code: 'HR',
        name: 'HR Executive',
        description: 'Human resources, employee management, shift/attendance settings, payroll, and performance management.'
      },
      {
        code: 'LOAN_EXECUTIVE',
        name: 'Loan Executive',
        description: 'Customer lead management, KYC document verification, CIBIL credit score evaluation, and loan processing.'
      },
      {
        code: 'COLLECTION_EXECUTIVE',
        name: 'Collection Executive',
        description: 'Field cash collection, daily work reporting (DWR), and collection receipt issuance.'
      },
      {
        code: 'RECEIPT_MANAGEMENT_EXECUTIVE',
        name: 'Receipt Management Executive',
        description: 'Receipt issuance, receipt audits, collection tracking, and counter cash register management.'
      },
      {
        code: 'ACCOUNTANT',
        name: 'Accounts Executive',
        description: 'Accounting, cash payment processing, receipt audit, inventory control, and payroll verification.'
      },
      {
        code: 'SUPPORT_EXECUTIVE',
        name: 'Customer Support Executive',
        description: 'Customer assistance, lead entry, walk-in inquiries, and helpdesk support.'
      },
      {
        code: 'QC',
        name: 'Quality Check (QC)',
        description: 'Quality check and compliance approval for merchants, leads, inventory, CIBIL credit score evaluation, KYC verification, receipt audit, and reports.'
      }
    ]
  };
};

