/**
 * Doporučené hodnoty `contract_workflow_steps.resolver` (DB ukládá řetězec).
 * @see docs/MODUL_EVIDENCE_SMLOUV.md
 */
export const ContractResolver = {
  DEPARTMENT_MANAGER: "department_manager",
  LEGAL_COUNSEL: "legal_counsel",
  FINANCIAL_APPROVAL: "financial_approval",
  EXECUTIVE: "executive",
  FIXED_USER: "fixed_user",
} as const;

export type ContractResolverValue =
  (typeof ContractResolver)[keyof typeof ContractResolver];

/**
 * Klíče v `system_settings` pro schvalovatele určené administrativně (uživatelské ID).
 * Hodnota: číslo uživatele jako text, např. "42".
 */
export const CONTRACT_SYSTEM_SETTING_KEYS = {
  legalUserId: "contracts_resolver_legal_user_id",
  financialUserId: "contracts_resolver_financial_user_id",
  executiveUserId: "contracts_resolver_executive_user_id",
} as const;
