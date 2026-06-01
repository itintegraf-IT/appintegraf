import { getEventTypeLabel } from "@/app/(dashboard)/calendar/lib/event-types";

export type CalendarEventMetaMode = "hidden" | "global" | "global_vedeni";

export type EventMetaInput = {
  users: { first_name: string; last_name: string } | null;
  users_deputy: { first_name: string; last_name: string } | null;
  deputy_id: number | null;
  approval_status: string | null;
  calendar_approvals?: Array<{ users: { first_name: string; last_name: string } | null }>;
  ukoly_task_id?: number | null;
  makety_task_id?: number | null;
  calendar_event_participants?: Array<{
    users: { first_name: string; last_name: string } | null;
  }>;
};

function isModuleTask(e: { ukoly_task_id?: number | null; makety_task_id?: number | null }) {
  return e.ukoly_task_id != null || e.makety_task_id != null;
}

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

/** Hlavní text v buňce kalendáře (týden / měsíc / seznam) – typ události, u úkolů název. */
export function getCalendarEventPrimaryLabel(e: {
  title: string;
  event_type: string | null;
  ukoly_task_id?: number | null;
  makety_task_id?: number | null;
}): string {
  if (isModuleTask(e)) return e.title;
  return getEventTypeLabel(e.event_type);
}

/** Text stavu schválení (shodně s detailem události). */
export function getCalendarEventApprovalStatusLabel(e: {
  approval_status: string | null;
  deputy_id: number | null;
}): string {
  if (!e.approval_status) return "";
  switch (e.approval_status) {
    case "approved":
      return "Schváleno";
    case "rejected":
      return "Zamítnuto";
    case "deputy_approved":
      return "Čeká na schválení";
    case "pending":
      return e.deputy_id ? "Čeká na schválení" : "Čeká na zástupce";
    default:
      return "";
  }
}

/** Kompaktní řádek celodenní události v globálním týdenním kalendáři. */
export function getCalendarGlobalAllDayCompactLabel(
  e: EventMetaInput & { title: string; event_type: string | null }
): string {
  const typeLabel = getCalendarEventPrimaryLabel(e);
  if (!e.users) return typeLabel;
  return `${typeLabel} · ${e.users.first_name} ${e.users.last_name}`;
}

/** Tooltip celodenní události v globálním týdenním řádku „Celý den“. */
export function calendarEventGlobalAllDayTooltip(
  e: EventMetaInput & { title: string; event_type: string | null },
  mode: CalendarEventMetaMode
): string {
  if (isModuleTask(e)) return e.title;
  const typeLabel = getEventTypeLabel(e.event_type);
  const parts: string[] = [typeLabel, e.title];
  const status = getCalendarEventApprovalStatusLabel(e);
  if (status) parts.push(status);
  parts.push(...buildEventMetaLines(e, mode));
  return parts.join(" — ");
}

/** Tooltip u události v mřížce – typ, původní název a meta (globální). */
export function calendarEventTooltipTitle(
  e: EventMetaInput & { title: string; event_type: string | null },
  mode: CalendarEventMetaMode
): string {
  if (isModuleTask(e)) return e.title;
  const typeLabel = getEventTypeLabel(e.event_type);
  const extra = buildEventMetaLines(e, mode);
  if (extra.length === 0) return `${typeLabel} — ${e.title}`;
  return [typeLabel, e.title, ...extra].join(" — ");
}

/**
 * Křičky s popisky pro zobrazení u událostí (globální kalendář – týden / měsíc).
 */
export function buildEventMetaLines(
  e: EventMetaInput,
  mode: CalendarEventMetaMode
): string[] {
  if (mode === "hidden" || isModuleTask(e)) return [];
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
  if (isModuleTask(e)) {
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
