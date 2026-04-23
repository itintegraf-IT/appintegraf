export type CalendarEventMetaMode = "hidden" | "global" | "global_vedeni";

export type EventMetaInput = {
  users: { first_name: string; last_name: string } | null;
  users_deputy: { first_name: string; last_name: string } | null;
  deputy_id: number | null;
  approval_status: string | null;
  calendar_approvals?: Array<{ users: { first_name: string; last_name: string } | null }>;
  ukoly_task_id?: number | null;
  calendar_event_participants?: Array<{
    users: { first_name: string; last_name: string } | null;
  }>;
};

function participantNames(
  e: EventMetaInput
): string {
  const parts: string[] = [];
  for (const p of e.calendar_event_participants ?? []) {
    if (p.users) {
      const n = `${p.users.first_name} ${p.users.last_name}`;
      if (!parts.includes(n)) parts.push(n);
    }
  }
  return parts.join(", ");
}

/**
 * Křičky s popisky pro zobrazení u událostí (globální kalendář – týden / měsíc).
 */
export function buildEventMetaLines(
  e: EventMetaInput,
  mode: CalendarEventMetaMode
): string[] {
  if (mode === "hidden" || e.ukoly_task_id != null) return [];
  const lines: string[] = [];
  if (e.users) {
    lines.push(`Vlastník: ${e.users.first_name} ${e.users.last_name}`);
  }
  if (e.deputy_id && e.users_deputy) {
    lines.push(`Zástup: ${e.users_deputy.first_name} ${e.users_deputy.last_name}`);
  }
  if (
    mode === "global_vedeni" &&
    e.approval_status === "approved" &&
    e.calendar_approvals?.[0]?.users
  ) {
    const m = e.calendar_approvals[0].users;
    lines.push(`Schválil vedoucí: ${m.first_name} ${m.last_name}`);
  }
  return lines;
}

/** Sloupec „Lidé“ v seznamu / výsledcích hledání */
export function getPeopleColumnText(e: EventMetaInput, mode: CalendarEventMetaMode): string {
  if (e.ukoly_task_id != null) {
    if (e.users) return `Řešitel: ${e.users.first_name} ${e.users.last_name}`;
    return "—";
  }
  if (mode === "hidden") {
    const names: string[] = [];
    if (e.users) names.push(`${e.users.first_name} ${e.users.last_name}`);
    if (e.users_deputy) {
      names.push(`${e.users_deputy.first_name} ${e.users_deputy.last_name} (zástup)`);
    }
    for (const p of e.calendar_event_participants ?? []) {
      if (p.users) {
        const n = `${p.users.first_name} ${p.users.last_name}`;
        if (!names.includes(n)) names.push(n);
      }
    }
    return names.join(", ") || "—";
  }
  const parts: string[] = [];
  if (e.users) {
    parts.push(`Vlastník: ${e.users.first_name} ${e.users.last_name}`);
  }
  if (e.deputy_id && e.users_deputy) {
    parts.push(`Zástup: ${e.users_deputy.first_name} ${e.users_deputy.last_name}`);
  }
  if (
    mode === "global_vedeni" &&
    e.approval_status === "approved" &&
    e.calendar_approvals?.[0]?.users
  ) {
    const m = e.calendar_approvals[0].users;
    parts.push(`Schválil vedoucí: ${m.first_name} ${m.last_name}`);
  }
  const pax = participantNames(e);
  if (pax) {
    parts.push(`Účastníci: ${pax}`);
  }
  return parts.join(" | ") || "—";
}
