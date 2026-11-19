import { normalizeRoleCode } from './society-role.constant.js';

export const DEFAULT_KPA_MATRIX_BY_ROLE = Object.freeze({
  MANAGER: [
    { product: 'Loan Disbursement', targetType: 'AMOUNT', targetValue: 0 },
    { product: 'Deposit Collection', targetType: 'AMOUNT', targetValue: 0 },
    { product: 'Lead Generation', targetType: 'COUNT', targetValue: 0 }
  ],
  LOAN_EXECUTIVE: [
    { product: 'Loan Disbursement', targetType: 'AMOUNT', targetValue: 0 },
    { product: 'Lead Generation', targetType: 'COUNT', targetValue: 0 }
  ],
  COLLECTION_EXECUTIVE: [
    { product: 'Deposit Collection', targetType: 'AMOUNT', targetValue: 0 }
  ],
  RECEIPT_MANAGEMENT_EXECUTIVE: [
    { product: 'Deposit Collection', targetType: 'AMOUNT', targetValue: 0 }
  ],
  ACCOUNTANT: [
    { product: 'Share Capital', targetType: 'AMOUNT', targetValue: 0 }
  ],
  SUPPORT_EXECUTIVE: [
    { product: 'Lead Generation', targetType: 'COUNT', targetValue: 0 }
  ],
  HR: [
    { product: 'Staff Onboarding', targetType: 'COUNT', targetValue: 0 }
  ]
});

/**
 * Returns default KPA targets for a given role code (all targetValue start at 0)
 */
export function getDefaultKraTargetsForRole(roleCode) {
  if (!roleCode) return [];
  const normalized = normalizeRoleCode(roleCode);
  const targets = DEFAULT_KPA_MATRIX_BY_ROLE[normalized] || [
    { product: 'General Work Performance', targetType: 'AMOUNT', targetValue: 0 }
  ];

  return targets.map(t => ({ ...t }));
}
