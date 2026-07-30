/** Číslo zakázky (job_number) – párování s jiným systémem. */

export const JOB_NUMBER_REQUIRED_ERROR =
  "Zadejte číslo zakázky, nebo potvrďte založení bez něj.";

export const CONFIRM_WITHOUT_JOB_NUMBER_MESSAGE =
  "Opravdu chcete založit objednávku bez čísla zakázky? Párování s jiným systémem nebude možné.";

/** Normalizace čísla zakázky (trim, max 50, prázdné → null). */
export function normalizeJobNumber(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const trimmed = String(raw).trim().slice(0, 50);
  return trimmed || null;
}

export function parseConfirmedWithoutJobNumber(raw: unknown): boolean {
  return raw === true || raw === 1 || raw === "1" || raw === "true";
}

export type JobNumberValidation =
  | { ok: true; jobNumber: string | null }
  | { ok: false; error: string };

/**
 * Při create: číslo zakázky povinné, pokud uživatel výslovně nepotvrdil založení bez něj.
 */
export function requireJobNumberOrConfirm(params: {
  job_number?: unknown;
  confirmed_without_job_number?: unknown;
}): JobNumberValidation {
  const jobNumber = normalizeJobNumber(params.job_number);
  if (jobNumber) {
    return { ok: true, jobNumber };
  }
  if (parseConfirmedWithoutJobNumber(params.confirmed_without_job_number)) {
    return { ok: true, jobNumber: null };
  }
  return { ok: false, error: JOB_NUMBER_REQUIRED_ERROR };
}
