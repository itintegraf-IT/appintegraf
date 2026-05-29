/**
 * Tabulky s účty a globálním nastavením – nesmí se mazat / vkládat při obnově,
 * pokud není ve výběru modul `system` (ochrana před omylem nebo chybným registry).
 */
export const BACKUP_PRISMA_MODELS_REQUIRE_SYSTEM = new Set([
  "users",
  "roles",
  "user_roles",
  "departments",
  "user_secondary_departments",
  "system_settings",
  "shared_mails",
  "user_shared_mails",
  "calendar_department_approvers",
  "contract_types",
  "contract_workflow_steps",
  "user_tokens",
  "user_totp_backup_codes",
]);

export function isBackupTableProtectedWithoutSystem(prismaModel: string | undefined): boolean {
  if (!prismaModel) return false;
  return BACKUP_PRISMA_MODELS_REQUIRE_SYSTEM.has(prismaModel);
}
